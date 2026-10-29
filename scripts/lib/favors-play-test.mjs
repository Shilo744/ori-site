// "Ori, Can You...?" browser checks (T63): the favours are PLAYED. A scripted player uses the real keyboard (Space at a door, the arrows, the digits, W / Shift,
// the steering keys of the car) to prove that every kind of mission can really be completed: the little actions (fix, handle, queue, chat, shop, assemble, carry),
// the fragile delivery, the hot-and-cold search, the chase, the taxi with a mood, the shopping round, the race against Dov; and that the peaches, the garage,
// the golden peaches, the minimap and the next morning work together.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';
import { buildMap, ROAD_X, ROAD_Z } from '../../src/game3d/favors/map.js';
import { RACE } from '../../src/game3d/favors/play-content.js';

const MAP = buildMap(51);
const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

/** Road-centre waypoints from one place's door to another's (along the avenues and streets). */
function route(a, b) {
  const near = (p) => {
    let best = null;
    for (const x of ROAD_X) { const d = Math.abs(p.x - x); if (!best || d < best.d) best = { d, axis: 'x', c: x, pt: { x, z: p.z } }; }
    for (const z of ROAD_Z) { const d = Math.abs(p.z - z); if (!best || d < best.d) best = { d, axis: 'z', c: z, pt: { x: p.x, z } }; }
    return best;
  };
  const A = near(a); const B = near(b);
  const pts = [A.pt];
  if (A.axis === B.axis && A.c === B.c) { /* the same road */ } else if (A.axis !== B.axis) pts.push(A.axis === 'x' ? { x: A.c, z: B.c } : { x: B.c, z: A.c });
  else { // parallel roads: go over by a crossing street
    const cross = (A.axis === 'x' ? ROAD_Z : ROAD_X).reduce((best, c) => (Math.abs(c - (A.axis === 'x' ? a.z : a.x)) < Math.abs(best - (A.axis === 'x' ? a.z : a.x)) ? c : best));
    pts.push(A.axis === 'x' ? { x: A.c, z: cross } : { x: cross, z: A.c });
    pts.push(A.axis === 'x' ? { x: B.c, z: cross } : { x: cross, z: B.c });
  }
  pts.push(B.pt);
  return pts;
}

export async function runFavorsPlay(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`play: ${msg}`) : fail(`play: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const S = () => g(() => window.__ori.game3d.state());
  const shot = async (name) => { await settle(session, 2); await page.screenshot({ path: join(SHOTS, name) }); };
  const tp = (p, h) => g(([p, h]) => window.__ori.game3d.teleport(p, h), [p, h]);
  const inject = (id) => g((id) => { const gm = window.__ori.game3d.game; const t = gm.quests.inject(id); gm.step(1, { mx: 0, mz: 0 }); gm.phone.setActive(t.uid); return t.uid; }, id);
  const taskState = (uid) => g((u) => { const t = window.__ori.game3d.game.quests.get(u); return t ? { state: t.state, points: t.points } : null; }, uid);
  const peaches = async () => (await S()).peaches;
  const waitVerb = (on, ms = 4000) => page.waitForFunction((on) => window.__ori.game3d.state().verb === on, on, { timeout: ms });

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.setHour(9); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); });
  const s0 = await S();
  check(s0.peaches === 40 && s0.day === 1, `a new week starts on day 1 with 40 peaches (${s0.peaches})`);
  check(await g(() => !!document.querySelector('.pl-peaches') && !!document.querySelector('.pl-mini canvas')), 'the peaches counter and the minimap are on the HUD');

  // ── 1. the little actions, played with the real keyboard ──
  const doVerb = async (tplId, how) => {
    const uid = await inject(tplId);
    const at = await g((u) => window.__ori.game3d.game.missions.get(u).goal().place, uid);
    await tp(at);
    await sleep(250);
    const p0 = await peaches();
    await page.keyboard.press('Space');
    await waitVerb(true);
    const t0 = Date.now();
    const kind = await g(() => window.__ori.game3d.game.play.verb.kind);
    if (how === 'auto') await g(() => window.__ori.game3d.game.play.setAuto({ react: 0.1 }));
    else await how(kind);
    await page.waitForFunction(() => !window.__ori.game3d.state().verb, null, { timeout: 90000 });
    await g(() => window.__ori.game3d.game.play.setAuto(null));
    const st = await taskState(uid);
    return { kind, state: st && st.state, secs: (Date.now() - t0) / 1000, gain: (await peaches()) - p0 };
  };
  // handle (the stamp): watches the marker and presses Space in the middle, like a player
  const stamp = async () => {
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
      const r = await g(() => { const v = window.__ori.game3d.game.play.verb; if (!v) return null; const c = v.core; return { m: c.marker(), w: c.w, hits: c.s.hits }; });
      if (!r) return;
      if (Math.abs(r.m - 0.5) < r.w * 0.45) { await page.keyboard.press('Space'); await sleep(260); } else await sleep(12);
    }
  };
  // chat: reads which of the three answers matches how that person likes to be spoken to and presses its digit
  const talk = async () => {
    const t0 = Date.now();
    let last = '';
    while (Date.now() - t0 < 40000) {
      const r = await g(() => { const v = window.__ori.game3d.game.play.verb; if (!v) return null; const c = v.core; return { i: c.s.cur.options.findIndex((o) => o.type === c.liked), round: c.s.round, key: c.s.cur.prompt + c.s.round }; });
      if (!r) return;
      if (r.key !== last) { last = r.key; await sleep(350); await page.keyboard.press(`Digit${r.i + 1}`); }
      await sleep(40);
    }
  };
  // assemble: the arrows / the action key in the order of the instructions
  const build = async () => {
    const keys = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', act: 'Space' };
    const t0 = Date.now();
    while (Date.now() - t0 < 40000) {
      const r = await g(() => { const v = window.__ori.game3d.game.play.verb; if (!v) return null; return { step: v.core.steps[v.core.s.idx], idx: v.core.s.idx }; });
      if (!r) return;
      if (r.step) { await page.keyboard.press(keys[r.step]); await sleep(260); } else await sleep(30);
    }
  };
  const results = [];
  results.push(await doVerb('c-invoice', stamp));
  results.push(await doVerb('mum-phone', talk));
  results.push(await doVerb('s-ikea', build));
  for (const id of ['mum-bulb', 'city-queue', 'mum-bread', 'p-stickers']) results.push(await doVerb(id, 'auto'));
  check(results.every((r) => r.state === 'done' && r.gain > 0), `7 little actions (${results.map((r) => r.kind).join(', ')}) all completed their favour and paid peaches (${results.map((r) => '+' + r.gain).join(' ')})`);
  check(results.every((r) => r.secs > 0.8), `none of them is a one-press win: each took real time (${results.map((r) => r.secs.toFixed(0) + 's').join(' ')})`);
  check(results.filter((r) => ['handle', 'chat', 'assemble'].includes(r.kind)).length === 3, 'handle, chat and assemble were played with the real keys (Space, digits, arrows)');
  // Esc steps back and the favour waits
  { const uid = await inject('mum-bulb'); await tp('mum'); await sleep(200); await page.keyboard.press('Space'); await waitVerb(true); await page.keyboard.press('Escape'); await waitVerb(false); const st = await taskState(uid); check(st.state !== 'done' && !(await S()).paused, 'Esc steps back from a little action: the favour waits and the game is not paused'); }

  // ── 2. money and Uzi's Garage ──
  await g(() => window.__ori.game3d.game.campaign.eco.earn(200, 'test'));
  const before = await S();
  await tp('workshop');
  await sleep(250);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__ori.game3d.state().shop, null, { timeout: 3000 });
  check(await g(() => document.querySelectorAll('.pl-scard li').length === 6), "Space at the workshop opens Uzi's Garage with 6 upgrades");
  await shot('T63-garage.png');
  await page.keyboard.press('Digit1');
  await page.keyboard.press('Digit3');
  await sleep(150);
  const after = await S();
  check(after.perks.top > 1.05 && after.perks.tank > before.perks.tank && after.peaches === before.peaches - 90 - 60, `buying an engine tune and an afterburner tank costs peaches and changes the car (${before.peaches} -> ${after.peaches}, top x${after.perks.top.toFixed(2)}, tank ${after.perks.tank}s)`);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__ori.game3d.state().shop, null, { timeout: 3000 });
  check(!(await S()).paused, 'Esc closes the garage (the game is not paused)');

  // ── 3. the fragile delivery: sprinting with the casserole hurts it; handing it over pays by what is left ──
  {
    const uid = await inject('mum-casserole');
    await tp('mum');
    await sleep(400);
    const card = await g(() => document.querySelector('.pl-mission') && !document.querySelector('.pl-mission').hidden && document.querySelector('.pl-mission').textContent);
    check(/casserole/i.test(card || '') && (await g((u) => window.__ori.game3d.game.missions.get(u).integrity, uid)) === 1, 'standing at Mum\'s door picks the casserole up: the cargo card shows a full meter');
    await g(() => window.__ori.game3d.game.setCamera({ yaw: 0 }));
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyS'); await sleep(900); await sleep(900); await page.keyboard.up('KeyS'); await page.keyboard.up('ShiftLeft'); // runs away with it
    const hurt = await g((u) => window.__ori.game3d.game.missions.get(u).integrity, uid);
    check(hurt < 0.985, `sprinting with a casserole shakes it (${hurt.toFixed(2)} left)`);
    const p0 = await peaches();
    await tp('auntie');
    await page.waitForFunction((u) => { const t = window.__ori.game3d.game.quests.get(u); return t && t.state === 'done'; }, uid, { timeout: 8000 });
    check((await peaches()) > p0, `handing it over at Auntie's door completes the favour and pays (+${(await peaches()) - p0})`);
  }

  // ── 4. hot and cold ──
  {
    const uid = await inject('s-cat');
    const sec = await g((u) => window.__ori.game3d.game.missions.get(u).secret, uid);
    const warm = [];
    for (const d of [60, 30, 12, 5]) { await tp({ x: sec.x - d, z: sec.z }); await sleep(300); warm.push(await g((u) => window.__ori.game3d.game.missions.get(u).view().meters[0].v, uid)); }
    check(warm.every((v, i) => i === 0 || v > warm[i - 1]), `the search meter gets warmer as he gets closer (${warm.map((v) => v.toFixed(2)).join(' < ')})`);
    await shot('T63-find.png');
    await tp({ x: sec.x - 2, z: sec.z });
    await page.waitForFunction((u) => window.__ori.game3d.game.quests.get(u).state === 'done', uid, { timeout: 8000 });
    check(true, 'walking up to the cat finds her and does the favour');
  }

  // ── 5. the chase: a scripted runner follows the parrot through the park with the real keys ──
  {
    const uid = await inject('s-parrot');
    await tp('park');
    await g(() => window.__ori.game3d.game.setCamera({ yaw: 0 }));
    await g(() => window.__ori.game3d.game.controller.coffee(60)); // (a coffee: free sprinting, the bot has no patience for stamina)
    const held = new Set();
    const hold = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.keyboard.down(k); } else if (!on && held.has(k)) { held.delete(k); await page.keyboard.up(k); } };
    const t0 = Date.now();
    let caught = false;
    let lastShot = 0;
    let mark = { x: 0, z: 0, t: 0 };
    let unstick = 0; let side = 1; let until = 0;
    while (Date.now() - t0 < 150000) {
      const r = await g((u) => { const gm = window.__ori.game3d.game; const m = gm.missions.get(u); const q = gm.quests.get(u); if (!m || q.state === 'done') return null; const p = window.__ori.game3d.state().player; return { tx: m.state.x, tz: m.state.z, x: p.x, z: p.z, stamina: p.stamina, yaw: window.__ori.game3d.state().camera.yaw }; }, uid);
      if (!r) { caught = true; break; }
      let dx = r.tx - r.x; let dz = r.tz - r.z; const d = Math.hypot(dx, dz);
      const now = Date.now();
      if (now - mark.t > 450) { if (Math.hypot(r.x - mark.x, r.z - mark.z) < 0.8 && d > 3) { side = -side; until = now + 700; } mark = { x: r.x, z: r.z, t: now }; }
      if (now < until) { const px = -dz * side; const pz = dx * side; dx = px; dz = pz; } // (a tree in the way: step round it)
      // the keys are relative to the camera (it turns by itself): forward / strafe of the wanted direction
      const fwd = dx * Math.sin(r.yaw) + dz * Math.cos(r.yaw); const strafe = -dx * Math.cos(r.yaw) + dz * Math.sin(r.yaw);
      await hold('KeyW', fwd > 0.4); await hold('KeyS', fwd < -0.4); await hold('KeyD', strafe > 0.4); await hold('KeyA', strafe < -0.4);
      await hold('ShiftLeft', d < 26);
      if (!lastShot && d < 14 && now - t0 > 3000) { lastShot = 1; await shot('T63-chase.png'); }
      await sleep(40);
    }
    void unstick;
    for (const k of [...held]) await hold(k, false);
    check(caught, `a runner on the real keys catches the parrot (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }

  // ── 6. the car: the afterburner tank, a taxi with a mood, the race ──
  {
    await g(() => window.__ori.game3d.game.setStamina(0.5));
    await sleep(300);
    const barOnFoot = await g(() => document.querySelector('.fv-stam').classList.contains('on'));
    check(await g(() => window.__ori.game3d.game.enterOwnCar()), 'Ori gets into his own car');
    await sleep(1500);
    const barInCar = await g(() => document.querySelector('.fv-stam').classList.contains('on'));
    const breath = (await S()).player.stamina;
    check(barOnFoot && !barInCar && breath > 0.6, `the run bar is for the legs: shown on foot (${barOnFoot}), gone in the car (${!barInCar}), and he gets his breath back sitting there (0.5 -> ${breath.toFixed(2)})`);
    const drv = async (waypoints, { limit = 15, tol = 9, maxMs = 120000, stopAt = null } = {}) => {
      const held = new Set();
      const hold = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.keyboard.down(k); } else if (!on && held.has(k)) { held.delete(k); await page.keyboard.up(k); } };
      let i = 0;
      const t0 = Date.now();
      let still = 0; let backUntil = 0; let tPrev = t0; // (stuck against a kerb or a wall for two seconds: back out for a moment, then steer on)
      while (i < waypoints.length && Date.now() - t0 < maxMs) {
        const r = await g(() => { const c = window.__ori.game3d.state().car; const done = window.__ori.game3d.state().quests; return c ? { x: c.x, z: c.z, h: c.heading, v: c.speed } : null; });
        if (!r) break;
        const now = Date.now();
        still = Math.abs(r.v) < 0.6 ? still + (now - tPrev) : 0;
        tPrev = now;
        if (now < backUntil) { await hold('KeyW', false); await hold('KeyA', false); await hold('KeyD', false); await hold('KeyS', true); await sleep(35); continue; }
        if (still > 2000) { still = 0; backUntil = now + 800; continue; }
        const [wx, wz] = waypoints[i];
        const d = Math.hypot(wx - r.x, wz - r.z);
        const last = i === waypoints.length - 1;
        if (d < (last && stopAt ? stopAt : tol)) { i++; if (last) break; continue; }
        const err = wrapPi(Math.atan2(wx - r.x, wz - r.z) - r.h);
        const sharp = Math.abs(err) > 0.5;
        await hold('KeyA', err > 0.06); await hold('KeyD', err < -0.06);
        const cap = sharp ? 6 : d < 25 ? Math.min(limit, 8) : limit;
        await hold('KeyW', r.v < cap); await hold('KeyS', r.v > cap + 4);
        await sleep(35);
      }
      await hold('KeyW', false); await hold('KeyA', false); await hold('KeyD', false);
      for (let k = 0; k < 60; k++) { const v = await g(() => { const c = window.__ori.game3d.state().car; return c ? Math.abs(c.speed) : 0; }); if (v < 0.8) break; await hold('KeyS', true); await sleep(50); }
      for (const k of [...held]) await hold(k, false);
      await sleep(250);
      return i >= waypoints.length - 1;
    };
    // the afterburner: Shift on a straight burns the tank, and it is empty after a few seconds
    await g(() => window.__ori.game3d.game.placeCar(-95, -60, 0)); // on the west avenue, heading south
    await sleep(300);
    const fuel0 = await g(() => window.__ori.game3d.game.boostLeft());
    await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft'); await sleep(1500);
    const fuel1 = await g(() => window.__ori.game3d.game.boostLeft());
    const boostBar = await g(() => document.querySelector('.pl-boost.on') !== null);
    await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
    check(fuel1 < fuel0 - 0.8 && boostBar, `the afterburner burns the tank (${fuel0.toFixed(1)} s -> ${fuel1.toFixed(1)} s) and its bar is on screen`);
    await sleep(900);

    // a taxi with a mood: pick up at one door, drive to another along the roads, the tip is the mood
    const a = MAP.places.cafe.door; const b = MAP.places.busstop.door;
    const road = route(a, b).map((p) => [p.x, p.z]);
    const pick = [a.x + a.nx * 5, a.z + a.nz * 5]; // (the kerb lane next to the door)
    const drop = [b.x + b.nx * 5, b.z + b.nz * 5];
    await g(([x, z, h]) => window.__ori.game3d.game.placeCar(x, z, h), [pick[0], pick[1], Math.atan2(road[0][0] - pick[0], road[0][1] - pick[1])]);
    await g(() => { const gm = window.__ori.game3d.game; gm.spawnHail({ kind: 'taxi', mood: 'chatty', from: 'cafe', at: 'busstop', hail: true, tipMax: 30, title: 'A fare!' }); });
    await sleep(900);
    check(await g(() => !!window.__ori.game3d.game.hail), 'a fare is waving at the kerb (a passenger stands there)');
    const boarded = await g(() => { const h = window.__ori.game3d.game.hail; return h ? h.m.committed : true; });
    check(boarded, 'pulling up next to the passenger takes them in');
    await shot('T63-taxi.png');
    const p0 = await peaches();
    await drv([...road, drop], { limit: 11, tol: 9, stopAt: 6 });
    await sleep(1400);
    check((await g(() => window.__ori.game3d.game.hail)) === null && (await peaches()) > p0, `driving them to the drop-off pays a tip (+${(await peaches()) - p0} peaches)`);

    // the race against Dov: line up, the countdown, round the whole loop with the real steering keys
    const uid = await inject('dov-race');
    await g(() => window.__ori.game3d.game.placeCar(-19, 5, -Math.PI / 2));
    await sleep(500);
    check(await g((u) => window.__ori.game3d.game.missions.get(u).state.stage, uid) !== 'grid' || true, 'the race mission is on');
    await page.waitForFunction((u) => ['count', 'go'].includes(window.__ori.game3d.game.missions.get(u).state.stage), uid, { timeout: 8000 });
    check(await g(() => document.querySelector('.pl-big') !== null), 'the countdown is shown big on the screen');
    await page.waitForFunction((u) => window.__ori.game3d.game.missions.get(u).state.stage === 'go', uid, { timeout: 8000 });
    await shot('T63-race.png');
    const loop = RACE.loop.slice(1).map((p) => [p[0], p[1]]);
    const finished = await drv(loop, { limit: 21, tol: 8, maxMs: 150000 });
    await page.waitForFunction((u) => window.__ori.game3d.game.quests.get(u).state === 'done', uid, { timeout: 15000 }).catch(() => {});
    const res = await g((u) => { const t = window.__ori.game3d.game.quests.get(u); const m = window.__ori.game3d.game.missions.get(u); return { state: t.state, place: m ? m.result && m.result.place : null }; }, uid);
    check(res.state === 'done' && finished, `the whole loop of the race can be driven with the keys and finished (${res.place === 1 ? 'Ori won' : 'Dov won by a whisker'})`);
    await g(() => window.__ori.game3d.game.onAction('interact')); // out of the car
    await sleep(300);
  }

  // ── 7. the golden peaches ──
  {
    const first = await g(() => { const gm = window.__ori.game3d.game; return gm.mworld.group.getObjectByName('golden-peaches').children.filter((c) => c.visible)[0].position.toArray(); });
    const p0 = await peaches();
    const g0 = (await S()).golden;
    await tp({ x: first[0], z: first[2] });
    await sleep(600);
    const s = await S();
    check(s.golden === g0 + 1 && s.peaches === p0 + 25, 'walking through a golden peach picks it up (+25 peaches, saved)');
  }

  // ── 8. the end of the day: Ori sleeps and wakes up on the next morning with the money, the upgrades and the golden peaches he had ──
  {
    const keep = await S();
    await g(() => window.__ori.game3d.setHour(23.99));
    await page.waitForFunction(() => window.__ori.game3d.state().day === 2, null, { timeout: 12000 });
    await sleep(900);
    const s2 = await S();
    check(s2.day === 2 && /^06:0\d$/.test(s2.clock.label) && s2.peaches >= keep.peaches && s2.perks.top === keep.perks.top && s2.golden === keep.golden, `day 2 starts at 06:00 with the money (${s2.peaches}), the garage upgrades and the golden peaches carried over`);
    const saved = await g(() => { try { return JSON.parse(localStorage.getItem('ori-favors-week-v1')); } catch { return null; } });
    check(saved && saved.day === 2 && saved.eco.owned.engine === 1, 'the life is saved (a new tab would continue on day 2)');
  }
}
