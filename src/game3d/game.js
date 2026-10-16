// NEON DRIFT — the game controller: main menu with a live 3D preview, the flyover, the countdown, the race (rivals, ghost, HUD,
// toasts), the results, records / medals / achievements. It owns the 3D session and the runner (the pure race, race-runner.js) and is
// driven by the host: `update(dt, keyboard)`, `render(dt)`, `onKey(e)`, `pause()/resume()`, `dispose()`.
import * as THREE from 'three';
import { createSession } from './session.js';
import { createRunner, DIFFICULTY } from './race-runner.js';
import { createDriver } from './autodrive.js';
import { createChaseCam } from './chase-cam.js';
import { createHud } from './hud.js';
import { createMainMenu, createResults } from './menus.js';
import { flyoverPose, orbitPose, makePose, FLYOVER_SECONDS } from './game-cams.js';
import { createRecords, parFor, fmtTime, fmtDelta, MEDALS } from './records.js';
import { encodeGhost, decodeGhost, createPlayback } from './ghost.js';
import { BIOMES, BIOME_IDS } from './biomes.js';
import { PAINTS } from './car-parts.js';
import { frameAt, closest, generateTrack } from './track.js';
import { placeCar } from './physics.js';

const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const LAPS = 3;
const lengths = {};
/** "3.6 km" for a biome's track (the three tracks are generated once, ~10 ms each). */
function lengthText(id) {
  if (!lengths[id]) lengths[id] = `${(generateTrack(BIOMES[id].seed).length / 1000).toFixed(1)} km`;
  return lengths[id];
}

/**
 * @param {object} o
 *   renderer, overlay (the host's element), storage (get/set), scores, achievements (core), emit(name, data)
 *   quit()      leave the game (back to the desktop)
 *   quick       skip the menu: a free drive on `biome` (tests, screenshots)
 *   biome, look, tier, carType, paint, seed
 */
export function createGame(o) {
  const { renderer, overlay, quit } = o;
  const records = createRecords(o.storage);
  const prefs = { ...records.prefs(), ...(o.biome ? { biome: o.biome } : {}), ...(o.carType ? { car: o.carType } : {}), ...(o.paint !== undefined ? { paint: typeof o.paint === 'number' && o.paint > 8 ? Math.max(0, PAINTS.indexOf(o.paint)) : o.paint } : {}) };
  const settings = { look: o.look, tier: o.tier || 'high', seed: o.seed };
  let session = null;
  let runner = null;
  let phase = 'menu'; // menu | loading | intro | countdown | racing | finished | results
  let paused = false;
  let meshes = [];
  let ghostMesh = null;
  let ghostPlay = null;
  let playerMesh = null;
  let autopilot = false;
  let bot = null;
  let time = 0;
  let introT = 0;
  let finishT = 0;
  let goT = 0;
  let camMode = 0; // 0 chase, 1 far chase
  let hudTick = 0;
  let boardTick = 0;
  const orbitYaw = 0;
  let wasBoost = 0;
  const chase = createChaseCam();
  const pose = makePose();
  const input = { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false };
  const interp = { x: 0, y: 0, z: 0, psi: 0, vx: 0, vz: 0, speed: 0, u: 0, s: 0, lateral: 0, steer: 0, ax: 0, ay: 0, brake: 0, boosting: 0, drifting: 0, hit: 0 };
  const drift = { on: false, t0: 0, maxT: 0, base: 0 };
  const stats = { top: 0, driftPoints: 0 };
  const ghostPose = {};

  const hud = createHud(overlay, {
    onPause: () => api.pause(),
    onResume: () => api.resume(),
    onRestart: () => { api.resume(); startRace(); },
    onQuitToMenu: () => { api.resume(); openMenu(); },
    onQuit: () => quit(),
  });
  hud.show(false);
  const results = createResults(overlay, (id) => {
    if (id === 'retry') startRace();
    else if (id === 'next') { const i = BIOME_IDS.indexOf(prefs.biome); setPrefs({ biome: BIOME_IDS[(i + 1) % BIOME_IDS.length] }); startRace(); }
    else if (id === 'menu') openMenu();
    else if (id === 'quit') quit();
  });
  const loading = document.createElement('div');
  loading.className = 'g3d-loading';
  loading.hidden = true;
  loading.innerHTML = '<i></i><span>Loading track…</span>';
  overlay.appendChild(loading);

  // ── helpers ────────────────────────────────────────────────────────────
  function setPrefs(p) { Object.assign(prefs, p); records.setPrefs(p); }
  const biome = () => BIOMES[prefs.biome];
  const paintHex = () => PAINTS[prefs.paint] ?? PAINTS[0];
  function trackInfo(id) {
    const t = records.track(id);
    return { bestLap: t.bestLap, medal: t.medal, wins: t.wins, length: lengthText(id) };
  }

  /** (Re)builds the 3D session for the chosen biome. Keeps the host's renderer; everything of the old session is released. */
  function buildSession() {
    if (runner) teardownRace();
    if (session) session.dispose();
    session = createSession({ renderer, biome: prefs.biome, seed: settings.seed, look: settings.look, tier: settings.tier });
    session.resize(window.innerWidth, window.innerHeight);
    session.camera.position.set(0, 20, 0);
  }

  function teardownRace() {
    for (const m of meshes) session.removeCar(m);
    meshes = [];
    if (ghostMesh) { session.removeCar(ghostMesh); ghostMesh = null; }
    ghostPlay = null;
    runner = null;
    playerMesh = null;
    bot = null;
  }

  /** Cars on the grid for the given mode; returns the runner. */
  function buildRace(mode, laps, quick = false) {
    teardownRace();
    const track = session.track;
    const best = records.track(prefs.biome);
    runner = createRunner({ track, mode, laps, difficulty: prefs.difficulty, seed: 1, playerType: prefs.car, bestSplits: best.splits || null });
    meshes = runner.entries.map((e) => {
      const m = session.addCar({ type: e.type, paint: e.kind === 'player' ? paintHex() : e.paint, lite: e.kind !== 'player' });
      if (e.kind === 'player') playerMesh = m;
      return m;
    });
    // the ghost: the best lap of this track in a time trial
    if (mode === 'trial') {
      const str = records.ghost(prefs.biome);
      const g = str && decodeGhost(str);
      if (g) {
        ghostPlay = createPlayback(g);
        ghostMesh = session.addCar({ type: best.bestCar || 'gt', ghost: true });
      }
    }
    if (quick) {
      const p = runner.player.car;
      placeCar(p, track, 0, 0, 0);
      runner.skipToRacing();
    }
    bot = createDriver(track, runner.player.car, { skill: 0.95 });
    stats.top = 0;
    drift.on = false;
    // the HUD: standings rows with each car's colour
    hud.setTrack(track, runner.entries.map((e) => ({ name: e.name, color: hex(e.kind === 'player' ? paintHex() : e.paint) })));
    hud.setMode({ race: mode === 'race', map: true });
    return runner;
  }

  // ── menu ───────────────────────────────────────────────────────────────
  const menu = createMainMenu(overlay, {
    prefs,
    trackInfo,
    onChange(p) {
      const biomeChanged = p.biome !== prefs.biome;
      const carChanged = p.car !== prefs.car || p.paint !== prefs.paint;
      setPrefs(p);
      if (biomeChanged) rebuildPreview(true);
      else if (carChanged) rebuildPreview(false);
      else menu.refresh();
    },
    onStart: () => startRace(),
    onQuit: () => quit(),
  });

  function rebuildPreview(full) {
    if (full) {
      loading.hidden = false;
      menu.el.classList.add('wait');
      // let the "loading" card paint before the (blocking) build
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (api.disposed) return;
        buildSession();
        makePreview();
        loading.hidden = true;
        menu.el.classList.remove('wait');
        menu.refresh();
      }));
    } else {
      makePreview();
      menu.refresh();
    }
  }

  /** A single car on the pole position, parked, for the menu to orbit. */
  function makePreview() {
    buildRace('trial', LAPS);
    for (const e of runner.entries) { e.car.vx = e.car.vz = 0; }
    phase = 'menu';
  }

  function openMenu() {
    results.hide();
    hud.show(false);
    hud.countdown('');
    hud.skipHint(false);
    paused = false;
    phase = 'menu';
    if (!session || session.biome.id !== prefs.biome) buildSession();
    makePreview();
    menu.setPrefs(prefs);
    menu.show();
    // medals need the par lap; compute the visible tracks' pars lazily so the menu opens at once
    setTimeout(() => menu.refresh(), 0);
  }

  // ── race ───────────────────────────────────────────────────────────────
  function startRace(opts = {}) {
    if (opts.quick === undefined) opts = { ...opts, quick: !!o.quick }; // a free drive restarts as a free drive
    menu.hide();
    results.hide();
    hud.show(false);
    phase = 'loading';
    loading.hidden = false;
    const go = () => {
      if (api.disposed) return;
      if (!session || session.biome.id !== prefs.biome) buildSession();
      const mode = opts.quick ? 'trial' : prefs.mode;
      buildRace(mode, opts.quick ? 99 : LAPS, !!opts.quick);
      loading.hidden = true;
      hud.show(true);
      hud.showKeys();
      finishT = 0; goT = 0;
      camMode = 0;
      chase.reset();
      if (opts.quick) { phase = 'racing'; snapChase(); return; }
      phase = 'intro';
      introT = 0;
      hud.skipHint(true);
      o.emit && o.emit('drift:race-start', { biome: prefs.biome, mode });
    };
    if (opts.quick) go(); // tests and screenshots: no waiting
    else requestAnimationFrame(() => requestAnimationFrame(go)); // let the loading card paint before the blocking build
  }

  function beginCountdown() {
    hud.skipHint(false);
    phase = 'countdown';
    runner.start();
    chase.reset();
    snapChase();
  }

  function snapChase() {
    syncInterp(1);
    chase.update(session.camera, interp, 1, runner.player.car.p.vRef);
  }

  function endRace() {
    phase = 'results';
    const race = runner.race;
    const res = race.results();
    const biomeDef = biome();
    const me = res.find((x) => x.player);
    const mode = runner.mode;
    const rows = res.map((x) => {
      const e = runner.entries.find((q) => q.id === x.id);
      return { place: x.place, name: x.name, time: fmtTime(x.time), projected: x.projected, best: x.bestLap ? fmtTime(x.bestLap) : '—', you: x.player, color: hex(e.kind === 'player' ? paintHex() : e.paint) };
    });
    const pe = race.entries.find((q) => q.player);
    const lines = [];
    let banner = '';
    const prev = records.track(prefs.biome);
    let medal = prev.medal;
    if (pe.bestLap) {
      const par = parFor(records, biomeDef, runner.player.type);
      const r = records.recordLap(prefs.biome, pe.bestLap, { car: runner.player.type, par, splits: pe.bestSplitsNew || null });
      medal = r.medal;
      scores.record(`drift:${prefs.biome}:lap`, +pe.bestLap.toFixed(3), { lowerIsBetter: true, extra: { car: runner.player.type } });
      lines.push(['Best lap', `${fmtTime(pe.bestLap)}${r.isBest ? ' — new record' : ` · record ${fmtTime(r.best)}`}`]);
      if (r.isBest && prev.bestLap) banner = 'NEW RECORD';
      if (r.newMedal) { banner = banner || 'NEW MEDAL'; lines.push(['Medal', `${MEDALS[r.medal]} — par ${fmtTime(par)}`]); }
      else lines.push(['Medal', `${MEDALS[r.medal] === 'none' ? 'none yet' : MEDALS[r.medal]} · gold ≤ ${fmtTime(par)}`]);
      checkGold();
    }
    if (mode === 'race') {
      records.recordRace(prefs.biome, { place: me.place, time: me.time, difficulty: prefs.difficulty });
      scores.record(`drift:${prefs.biome}:race`, +me.time.toFixed(2), { lowerIsBetter: true, extra: { place: me.place, difficulty: prefs.difficulty } });
      if (me.penalty) lines.push(['Penalty', `+${me.penalty.toFixed(0)} s for ${pe.resets} reset${pe.resets > 1 ? 's' : ''}`]);
      raceAchievements(me.place);
    }
    results.show({
      kicker: `${biomeDef.name} · ${mode === 'race' ? `Race · ${DIFFICULTY[prefs.difficulty].name}` : 'Time Trial'} · ${LAPS} laps`,
      title: mode === 'race' ? (me.place === 1 ? 'Victory!' : `P${me.place} of ${res.length}`) : 'Time Trial done',
      banner, rows, medal, lines, timeHead: mode === 'race' ? 'Time' : 'Total',
      actions: [{ id: 'retry', label: 'Retry', primary: true }, { id: 'next', label: 'Next track' }, { id: 'menu', label: 'Menu' }, { id: 'quit', label: 'Quit to desktop' }],
    });
    o.emit && o.emit('drift:race-end', { biome: prefs.biome, place: me.place, mode });
  }

  // ── records, scores, achievements ──────────────────────────────────────
  const { scores, achievements } = o;
  function unlock(id) { if (achievements) achievements.unlock(id); }
  function raceAchievements(place) {
    unlock('drift-first');
    if (place <= 3) unlock('drift-podium');
    if (place === 1) { unlock('drift-win'); if (prefs.difficulty === 'hard') unlock('drift-hard'); }
  }
  function checkGold() {
    if (achievements) achievements.progress('drift-gold', records.goldCount());
  }

  // ── per-frame work ─────────────────────────────────────────────────────
  function syncInterp(alpha) {
    const c = runner.player.car;
    interp.x = c.prevX + (c.x - c.prevX) * alpha;
    interp.z = c.prevZ + (c.z - c.prevZ) * alpha;
    interp.psi = c.prevPsi + wrapPi(c.psi - c.prevPsi) * alpha;
    interp.y = c.y; interp.vx = c.vx; interp.vz = c.vz; interp.speed = c.speed; interp.u = c.u; interp.s = c.s; interp.lateral = c.lateral;
    interp.steer = c.steer; interp.ax = c.ax; interp.ay = c.ay; interp.brake = c.brake; interp.boosting = c.boosting; interp.drifting = c.drifting; interp.hit = c.hit;
  }

  function handleEvents() {
    const evs = runner.events;
    for (let i = 0; i < evs.length; i++) {
      const ev = evs[i];
      if (ev.type === 'ghost') {
        const best = records.track(prefs.biome);
        if (!best.bestLap || ev.time <= best.bestLap) { records.setGhost(prefs.biome, encodeGhost(ev.ghost)); }
        continue;
      }
      if (!ev.player) continue;
      if (ev.type === 'lap') {
        if (runner.mode === 'race' && ev.lap < LAPS) hud.toast(`LAP ${ev.lap + 1}/${LAPS}`, 'lap');
        if (ev.valid) {
          const prev = records.track(prefs.biome);
          const par = parFor(records, biome(), runner.player.type);
          const best = runner.race.entries[runner.playerIndex].bestSplitsNew;
          const first = !prev.bestLap;
          if (!prev.bestLap || ev.time < prev.bestLap) {
            records.recordLap(prefs.biome, ev.time, { car: runner.player.type, par, splits: best });
            if (!first) { hud.toast(`NEW RECORD ${fmtTime(ev.time)}`, 'best', 2600); if (ghostPlay && ev.time < ghostPlay.time) unlock('drift-ghost'); }
            else hud.toast(`LAP ${fmtTime(ev.time)}`, 'best', 2200);
          } else if (ev.best === ev.time) hud.toast(`BEST LAP ${fmtTime(ev.time)}`, 'best', 2200);
          else hud.toast(`${fmtTime(ev.time)}`, 'info');
          checkGold();
        } else hud.toast('LAP NOT COUNTED', 'warn', 2000);
      } else if (ev.type === 'finish') {
        finishT = 0;
        phase = 'finished';
        hud.countdown('FINISH', true);
        hud.flash('best');
      } else if (ev.type === 'reset') {
        hud.toast(ev.voided ? 'RESET · LAP VOID' : `RESET +${ev.penalty ? '3' : '0'}s`, 'warn');
        hud.flash('warn');
      } else if (ev.type === 'cut') hud.toast('SHORTCUT · LAP VOID', 'warn');
    }
    evs.length = 0;
  }

  function trackDrift() {
    const c = runner.player.car;
    if (c.drifting) {
      if (!drift.on) { drift.on = true; drift.base = c.driftScore; drift.maxT = 0; }
      drift.maxT = Math.max(drift.maxT, c.driftT);
    } else if (drift.on) {
      drift.on = false;
      const pts = Math.round((c.driftScore - drift.base) / 5) * 5;
      if (pts >= 250) { hud.toast(`DRIFT +${pts}`, 'drift'); stats.driftPoints += pts; records.recordDrift(drift.maxT, pts); }
      if (drift.maxT >= 10) unlock('drift-long');
    }
    if (c.boosting && !wasBoost) hud.toast('BOOST', 'boost', 900);
    wasBoost = c.boosting;
    if (c.speed * 3.6 > stats.top) stats.top = c.speed * 3.6;
    if (stats.top >= 300) unlock('drift-speed');
  }

  function hudFeed(dt) {
    const c = runner.player.car;
    const h = runner.hud();
    const race = runner.race;
    const pe = race.entries[runner.playerIndex];
    const s = {
      speed: c.speed, u: c.u, gear: c.gear, rev: Math.min(1, Math.max(0, (c.rpm - 1000) / 7000)), boost: c.boost, boosting: c.boosting, drifting: c.drifting,
      lapTime: runner.mode === 'race' ? h.t : h.lapTime, race: runner.mode === 'race', place: h.place, cars: h.cars, lap: h.lap, laps: h.laps,
      delta: h.delta, deltaAge: h.deltaAge, best: pe.bestLap, warn: h.wrongWay ? 'WRONG WAY' : '', t: time, mapDots: null,
    };
    if (runner.mode === 'race') s.lapTime = h.lapTime; // the lap clock; the race clock is in the results
    hudTick += dt;
    if (hudTick >= 1 / 20) {
      hudTick = 0;
      s.mapDots = runner.entries.map((e) => ({ x: e.car.x, z: e.car.z, you: e.kind === 'player', color: hex(e.kind === 'player' ? paintHex() : e.paint) }));
    }
    hud.update(s);
    boardTick += dt;
    if (boardTick >= 0.25 && runner.mode === 'race') {
      boardTick = 0;
      const me = pe;
      const spd = Math.max(25, c.speed);
      const order = race.standings().map((e) => {
        const i = runner.entries.findIndex((q) => q.id === e.id);
        const gapS = (e.dist - me.dist) / spd; // > 0: ahead of you
        return { i, you: e.player, gap: e.player ? 'YOU' : `${gapS >= 0 ? '+' : '−'}${Math.abs(gapS).toFixed(1)}` };
      });
      hud.setBoard(order);
    }
  }

  function placeMeshes(dt) {
    const a = runner.sim.alpha;
    for (let i = 0; i < runner.entries.length; i++) {
      const e = runner.entries[i];
      const c = e.car;
      const st = i === runner.playerIndex ? interp : e.view || (e.view = { ...interp });
      if (i !== runner.playerIndex) {
        st.x = c.prevX + (c.x - c.prevX) * a; st.z = c.prevZ + (c.z - c.prevZ) * a; st.psi = c.prevPsi + wrapPi(c.psi - c.prevPsi) * a;
        st.s = c.s; st.lateral = c.lateral; st.u = c.u; st.steer = c.steer; st.ax = c.ax; st.ay = c.ay; st.brake = c.brake; st.boosting = c.boosting; st.drifting = c.drifting;
      }
      meshes[i].update(st, session.track, dt);
    }
    if (ghostMesh && ghostPlay) {
      const pe = runner.race.entries[runner.playerIndex];
      const t = pe.lapStart != null ? Math.max(0, runner.race.t - pe.lapStart) : 0;
      const on = t < ghostPlay.time + 1 && phase !== 'menu';
      ghostMesh.group.visible = on;
      if (on) {
        ghostPlay.poseAt(t, ghostPose);
        // the ghost drives on the same road: its `s` / lateral come from the track
        const cl = ghostClosest(ghostPose.x, ghostPose.z);
        const st = ghostView;
        st.x = ghostPose.x; st.z = ghostPose.z; st.psi = ghostPose.psi; st.steer = ghostPose.steer; st.s = cl.s; st.lateral = cl.lateral;
        st.u = 30; st.ax = 0; st.ay = 0; st.brake = 0; st.boosting = 0; st.drifting = 0;
        ghostMesh.update(st, session.track, dt);
      }
    }
  }
  const ghostView = { ...interp };
  const ghostCl = {};
  let ghostIdx = -1;
  function ghostClosest(x, z) {
    const c = closest(session.track, x, z, ghostIdx, ghostCl);
    ghostIdx = c.idx;
    return c;
  }

  function applyPose(p) {
    session.camera.position.copy(p.pos);
    session.camera.lookAt(p.look);
    if (Math.abs(session.camera.fov - p.fov) > 0.01) { session.camera.fov = p.fov; session.camera.updateProjectionMatrix(); }
  }

  const flyCtx = { grid: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3(), car: new THREE.Vector3(), carFwd: new THREE.Vector3() };
  function prepareFlyover() {
    const t = session.track;
    const fr = frameAt(t, 0, {});
    flyCtx.fwd.set(fr.tx, 0, fr.tz);
    flyCtx.right.set(fr.rx, 0, fr.rz);
    const mid = frameAt(t, t.length - 62, {});
    flyCtx.grid.set(mid.x, mid.y, mid.z);
    const c = runner.player.car;
    flyCtx.car.set(c.x, c.y, c.z);
    flyCtx.carFwd.set(Math.cos(c.psi), 0, Math.sin(c.psi));
  }

  // ── the host-facing API ────────────────────────────────────────────────
  /** Countdown → GO: the lights go out when the runner says so. */
  function advancePhase() {
    if (phase === 'countdown') {
      const n = Math.ceil(runner.countdown);
      hud.countdown(runner.phase === 'countdown' && n >= 1 ? String(n) : '');
      if (runner.phase === 'racing') { phase = 'racing'; hud.countdown('GO!', true); goT = 0.9; hud.flash('go'); }
    }
  }

  const api = {
    disposed: false,
    get phase() { return phase; },
    get paused() { return paused; },
    get session() { return session; },
    get runner() { return runner; },
    get hud() { return hud; },
    get menu() { return menu; },
    get records() { return records; },
    get prefs() { return prefs; },
    /** Opens the main menu (or starts a free drive in quick mode). */
    open() {
      buildSession();
      if (o.quick) { startRace({ quick: true }); return; }
      openMenu();
    },
    update(dt, kb) {
      if (!runner || paused) return;
      time += dt;
      const pe = runner.race.entries[runner.playerIndex];
      if (phase === 'menu') {
        // parked cars; the camera orbits the player's car
        runner.update(dt, input);
        return;
      }
      if (phase === 'loading') return;
      if (autopilot && phase === 'racing') bot(runner.player.car, input, { others: runner.entries.filter((e) => e.kind !== 'player').map((e) => e.car) });
      else if (kb && phase === 'racing') kb.read(input);
      else { input.throttle = input.brake = input.steer = 0; input.handbrake = input.boost = false; }
      if (phase === 'intro') {
        introT += dt;
        if (introT >= FLYOVER_SECONDS) beginCountdown();
        return;
      }
      runner.update(dt, input);
      handleEvents();
      advancePhase();
      if (phase === 'racing') {
        if (goT > 0) { goT -= dt; if (goT <= 0) hud.countdown(''); }
        trackDrift();
      } else if (phase === 'finished') {
        finishT += dt;
        trackDrift();
        if (finishT > 2.2) { hud.countdown(''); endRace(); }
      }
    },
    render(dt) {
      if (!session) return;
      if (!runner) { session.render(dt, 0, 0); return; }
      const playing = phase === 'racing' || phase === 'countdown' || phase === 'finished' || phase === 'results';
      syncInterp(runner.sim.alpha);
      if (phase === 'menu') {
        const c = runner.player.car;
        orbitPose(time, c, pose, { yaw: orbitYaw, dist: 11.4 + (prefs.car === 'hyper' ? 0.9 : 0), height: 2.1, shift: window.innerWidth > 760 ? 3.1 : 0 });
        // the whole grid is behind the camera's car: look a little ahead of the car
        applyPose(pose);
      } else if (phase === 'intro') {
        prepareFlyover();
        flyoverPose(introT / FLYOVER_SECONDS, flyCtx, pose);
        applyPose(pose);
      } else if (playing || phase === 'loading') {
        chase.state.mode = camMode;
        chase.update(session.camera, interp, dt, runner.player.car.p.vRef);
      }
      placeMeshes(dt);
      if (playing || phase === 'intro' || (o.quick && phase === 'racing')) hudFeed(dt);
      const fx = Math.min(1, Math.max(0, (runner.player.car.speed * 3.6 - 200) / 90 + (runner.player.car.boosting ? 0.35 : 0)));
      session.render(dt, phase === 'menu' || phase === 'intro' ? 0 : fx, runner.player.car.s);
    },
    resize(w, h) { if (session) session.resize(w, h); },
    pause() {
      if (paused || !runner || !['intro', 'countdown', 'racing', 'finished'].includes(phase)) return false;
      paused = true;
      hud.showMenu();
      return true;
    },
    resume() {
      if (!paused) return;
      paused = false;
      hud.hideMenu();
    },
    /** Esc / P pressed during the game: toggles the pause menu, or goes back one level in the menus. */
    onEscape() {
      if (phase === 'menu') { quit(); return; }
      if (phase === 'results') { openMenu(); return; }
      if (paused) api.resume(); else api.pause();
    },
    onReset() {
      if (phase !== 'racing' || !runner) return;
      const r = runner.resetPlayer();
      if (!r.ok && r.wait > 0) hud.toast(`RESET IN ${r.wait.toFixed(1)}`, 'info', 900);
      else if (r.ok) chase.reset();
    },
    onCamera() { camMode = camMode === 0 ? 1 : 0; },
    /** Keys while a menu is up. Returns true (consumed), 'native' (let the browser act) or undefined (a normal game key). */
    onKey(e) {
      if (phase === 'menu') {
        if (e.code === 'Escape') { quit(); return true; }
        if (e.code === 'Enter') { startRace(); return true; }
        if (e.code === 'Space' || e.code === 'Tab') return 'native';
        if (e.code.startsWith('Arrow')) { menu.key(e); return true; }
        return true;
      }
      if (phase === 'loading') return true;
      if (phase === 'intro') {
        if (e.code === 'Space' || e.code === 'Enter') { introT = FLYOVER_SECONDS; return true; }
        if (e.code === 'Escape' || e.code === 'KeyP') { api.onEscape(); return true; }
        return true;
      }
      if (phase === 'results') {
        if (e.code === 'Escape') { openMenu(); return true; }
        if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') { results.focusMove(-1); return true; }
        if (e.code === 'ArrowRight' || e.code === 'ArrowDown') { results.focusMove(1); return true; }
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Tab') return 'native';
        return true;
      }
      if (paused) {
        if (e.code === 'Escape' || e.code === 'KeyP') { api.resume(); return true; }
        if (e.code === 'ArrowDown' || e.code === 'KeyS') { hud.moveFocus(1); return true; }
        if (e.code === 'ArrowUp' || e.code === 'KeyW') { hud.moveFocus(-1); return true; }
        if (e.code === 'Tab' || e.code === 'Enter' || e.code === 'Space') return 'native';
        return true;
      }
      return undefined;
    },
    // ── debug / tests ──
    get autopilot() { return autopilot; },
    set autopilot(v) { autopilot = !!v; },
    /** Runs n fixed steps (with the autopilot when it is on) and draws one frame. */
    step(n) {
      if (!runner) return;
      for (let i = 0; i < n; i++) {
        if (autopilot && runner.phase === 'racing') bot(runner.player.car, input, { others: [] });
        runner.step(input);
        if (runner.events.length) handleEvents();
      }
      runner.sim.alpha = 1;
      advancePhase();
      if (phase === 'racing' && goT > 0) { goT = 0; hud.countdown(''); } // a fast-forward does not wait for the GO! to fade
      snapChase();
    },
    teleport(s, speed = 60, lateral = 0) {
      if (!runner) return;
      placeCar(runner.player.car, session.track, s, lateral, speed);
      runner.race.entries[runner.playerIndex].prevS = runner.player.car.s;
      snapChase();
    },
    setCamera(mode) { camMode = mode; },
    skipIntro() { if (phase === 'intro') introT = FLYOVER_SECONDS; },
    setPrefs(p) { setPrefs(p); menu.setPrefs(prefs); },
    startRace,
    openMenu,
    /** Rebuilds the world with other options { biome, look, tier, seed }; a free drive stays a free drive, the menu stays the menu. */
    reconfigure(c = {}) {
      if (c.biome) prefs.biome = c.biome;
      if ('look' in c) settings.look = c.look;
      if ('tier' in c) settings.tier = c.tier || 'high';
      if ('seed' in c) settings.seed = c.seed;
      paused = false;
      hud.hideMenu();
      buildSession();
      if (o.quick) startRace({ quick: true }); else openMenu();
    },
    /** A snapshot for the tests: everything about the player's car and the race. */
    state() {
      if (!runner) return null;
      const c = runner.player.car;
      const h = runner.hud();
      return {
        seed: session.seed, biome: session.biome.id, look: session.world.look.name, phase, runnerPhase: runner.phase, mode: runner.mode, difficulty: prefs.difficulty,
        track: { length: Math.round(session.track.length), hairpins: session.track.stats.hairpins, minRadius: Math.round(session.track.stats.minRadius), attempts: session.track.attempts },
        s: Math.round(c.s), lateral: +c.lateral.toFixed(2), speedKmh: Math.round(c.speed * 3.6), gear: c.gear, rpm: Math.round(c.rpm),
        slipDeg: +(c.slip * 57.3).toFixed(1), drifting: c.drifting, boost: Math.round(c.boost), boosting: c.boosting, offroad: +c.offroad.toFixed(2),
        lap: h.lap, laps: h.laps, place: h.place, cars: h.cars, lapTime: +h.lapTime.toFixed(2), bestLap: h.bestLap ? +h.bestLap.toFixed(2) : 0, raceTime: +runner.race.t.toFixed(2),
        tick: runner.sim.tick, autopilot, x: +c.x.toFixed(1), z: +c.z.toFixed(1), car: prefs.car, paint: prefs.paint, ghost: !!ghostPlay,
      };
    },
    dispose() {
      api.disposed = true;
      teardownRace();
      if (session) session.dispose();
      session = null;
      hud.dispose();
      menu.dispose();
      results.dispose();
      loading.remove();
    },
  };
  return api;
}

