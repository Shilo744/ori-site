// "Ori, Can You...?" — the game controller the host runs (see host.js for the contract): builds the neighbourhood, Ori and the crowd,
// drives them from the input, runs the game clock and the light of the day, and draws one frame. Quests and the phone arrive with T52+;
// this is the stage: walk, run, look around, watch the day go by.
import * as THREE from 'three';
import { createSky } from '../sky3d.js';
import { createPost } from '../post.js';
import { buildMap, groundHeight, PLAYER_R } from './map.js';
import { createController, moveDir, WALK_SPEED } from './controller.js';
import { createCameraRig } from './camera-rig.js';
import { createClock, skyAt } from './daycycle.js';
import { createCrowd } from './crowd.js';
import { createCrowd3d } from './crowd3d.js';
import { buildBuildings } from './buildings3d.js';
import { buildGround } from './ground3d.js';
import { buildProps } from './props3d.js';
import { createOri } from './ori3d.js';
import { createFavorsHud } from './hud.js';
import { disposeTree } from './gfx.js';
import { PLACES, CROWD, DAY } from './content.js';

const KEY_GAIN = 1.0; // sun / moon intensity
const HEMI_GAIN = 0.8;
const NEAR_PLACE = 16; // metres: the label of a place shows when Ori is this close to its door

const PARTS = ['Early morning', 'Morning', 'Midday', 'Afternoon', 'Golden hour', 'Evening', 'Night'];
const partOfDay = (h) => (h < 7 ? PARTS[0] : h < 11 ? PARTS[1] : h < 14 ? PARTS[2] : h < 17.5 ? PARTS[3] : h < 19.8 ? PARTS[4] : h < 22 ? PARTS[5] : PARTS[6]);

export function createFavorsGame(o) {
  const { renderer, overlay, quit } = o;
  const tier = o.tier || 'high';
  const shadows = tier !== 'low';
  let paused = false;
  let opened = false;
  let disposed = false;
  let t = 0; // seconds since the game opened (waves, clouds)

  // world pieces (made in open())
  let map = null;
  let scene = null;
  let camera = null;
  let post = null;
  let sky = null;
  let hemi = null;
  let sun = null;
  let buildings = null;
  let ground = null;
  let props = null;
  let ori = null;
  let crowd = null;
  let crowd3d = null;
  let ctrl = null;
  let rig = null;
  let envMap = null;
  let fill = null;
  const clock = createClock({ startHour: o.startHour ?? DAY.startHour, realMinutes: o.dayMinutes ?? DAY.realMinutes });
  const input = { fwd: 0, strafe: 0, sprint: false, orbit: 0, pitch: 0, zoom: 1 };
  const wish = { mx: 0, mz: 0, sprint: false };
  let lastKb = null;
  let nearPlace = null;
  let groundY = 0;
  let lastSky = null;

  const hud = createFavorsHud(overlay, {
    onPause: () => api.onEscape(),
    onResume: () => api.resume(),
    onRestart: () => restartDay(),
    onQuit: quit,
  });

  const timings = {}; // ms per stage of open() (dev: __ori.game3d.game.timings)
  function open() {
    if (opened) return;
    opened = true;
    const t0 = performance.now();
    const lap = (k) => { timings[k] = Math.round(performance.now() - t0); };
    map = buildMap(o.seed ?? 51);
    lap('map');
    scene = new THREE.Scene();
    const size = renderer.getSize(new THREE.Vector2());
    camera = new THREE.PerspectiveCamera(58, size.x / Math.max(1, size.y), 0.25, 1400);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    sky = createSky('noon', 0);
    scene.add(sky.mesh);
    if (tier !== 'low') { envMap = sky.makeEnvironment(renderer); scene.environment = envMap; }
    hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
    sun = new THREE.DirectionalLight(0xffffff, 2);
    if (shadows) {
      sun.castShadow = true;
      const s = tier === 'high' ? 2048 : 1024;
      sun.shadow.mapSize.set(s, s);
      const c = sun.shadow.camera;
      c.left = -60; c.right = 60; c.top = 60; c.bottom = -60; c.near = 10; c.far = 320;
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.35;
    }
    scene.add(hemi, sun, sun.target);
    // a little warm light that walks with Ori after dark, so he never disappears into the street
    fill = new THREE.PointLight(0xffd2a0, 0, 13, 1.6);
    scene.add(fill);
    scene.fog = new THREE.Fog(0xcfe6f8, 80, 520);

    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    lap('sky');
    ground = buildGround(map, { aniso });
    lap('ground');
    buildings = buildBuildings(map, { aniso });
    lap('buildings');
    props = buildProps(map, { shadows });
    lap('props');
    scene.add(ground.group, buildings.group, props.group);

    crowd = createCrowd(map, { count: CROWD.count, seed: 7 });
    crowd3d = createCrowd3d(map, crowd, { shadows });
    scene.add(crowd3d.mesh);

    lap('crowd');
    ori = createOri({ shadows });
    lap('ori');
    scene.add(ori.group);
    ctrl = createController(map.world, { x: map.spawn.x, z: map.spawn.z, heading: map.spawn.heading });
    rig = createCameraRig(map.world, { yaw: map.spawn.heading, pitch: 0.4, dist: 7.4 });

    if (tier !== 'low') post = createPost(renderer, scene, camera, { tier, bloom: { strength: 0.32, radius: 0.55, threshold: 0.9 } });
    if (post) post.fx.uniforms.uVignette.value = 0.2;
    applySky(true);
    placeCamera(true);
    lap('setup');
    api.render(0); // (the first frame compiles the shaders)
    lap('first-frame');
  }

  function applySky(force = false) {
    const h = clock.hour;
    if (!force && lastSky && Math.abs(h - lastSky.hour) < 0.004) return lastSky;
    const s = skyAt(h);
    lastSky = s;
    const u = sky.material.uniforms;
    u.uTop.value.setRGB(...s.top);
    u.uMid.value.setRGB(...s.mid);
    u.uHorizon.value.setRGB(...s.hor);
    u.uBelow.value.setRGB(...s.below);
    u.uSunColor.value.setRGB(...s.sun);
    u.uCloudLit.value.setRGB(...s.cloud);
    u.uCloudShade.value.setRGB(s.cloud[0] * 0.6, s.cloud[1] * 0.62, s.cloud[2] * 0.7);
    sky.sunDir.set(...s.sunDir);
    u.uSunSize.value = s.isDay ? 0.04 : 0.03;
    u.uGlow.value = s.isDay ? 0.8 : 0.25;
    u.uPower.value = s.isDay ? 3 : 1.5;
    u.uStars.value = s.stars;
    u.uCover.value = 0.4;
    hemi.color.setRGB(...s.hemiS);
    hemi.groundColor.setRGB(...s.hemiG);
    hemi.intensity = s.hemiI * HEMI_GAIN;
    sun.color.setRGB(...s.key);
    sun.intensity = s.keyI * KEY_GAIN * (0.15 + 0.85 * s.sunVis);
    scene.fog.color.setRGB(...s.fog);
    scene.fog.near = s.fogN;
    scene.fog.far = s.fogF;
    renderer.toneMappingExposure = s.exp;
    scene.environmentIntensity = 0.08 + 0.3 * (1 - s.night);
    // windows: lit ones glow when it is dark; by day the glass reflects the sky
    buildings.setLight({ win: s.win, lamps: s.lamps, glass: [s.hor[0] * 0.3 * (1 - s.night) + 0.03, s.hor[1] * 0.34 * (1 - s.night) + 0.045, s.hor[2] * 0.4 * (1 - s.night) + 0.07] });
    props.setLight({ lamps: s.lamps });
    fill.intensity = s.lamps * 9;
    return s;
  }

  function placeCamera(snap = false) {
    if (snap) rig.reset();
    const c = rig.state;
    camera.position.set(c.x, Math.max(c.y, groundY + 0.6), c.z);
    camera.lookAt(c.lx, c.ly + groundY * 0.5, c.lz);
    if (Math.abs(camera.fov - c.fov) > 0.05) { camera.fov = c.fov; camera.updateProjectionMatrix(); }
  }

  function nearest() {
    let best = null;
    let bd = NEAR_PLACE;
    const s = ctrl.state;
    for (const p of Object.values(map.places)) {
      const d = Math.hypot(p.door.x - s.x, p.door.z - s.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  function restartDay() {
    clock.set(clock.startHour);
    ctrl.teleport(map.spawn.x, map.spawn.z, map.spawn.heading);
    ctrl.state.stamina = 1;
    rig.state.yaw = map.spawn.heading;
    api.resume();
    applySky(true);
    placeCamera(true);
    api.render(0);
  }

  const api = {
    get phase() { return opened ? 'play' : 'loading'; },
    get paused() { return paused; },
    get hud() { return hud; },
    get map() { return map; },
    get controller() { return ctrl; },
    get clock() { return clock; },
    get timings() { return timings; },
    get scene() { return scene; },
    get camera() { return camera; },
    open,
    /** The host creates the input after the game: the touch controls need its joystick state. */
    attachInput(inp) { hud.bindTouch(inp, () => api.onAction('interact')); },
    update(dt, kb) {
      if (!opened || paused) return;
      lastKb = kb;
      kb.read(input, dt);
      t += dt;
      const yaw = rig.state.yaw;
      const dir = moveDir(yaw, input.fwd, input.strafe);
      wish.mx = dir.mx;
      wish.mz = dir.mz;
      wish.sprint = input.sprint;
      ctrl.update(dt, wish);
      clock.tick(dt);
      crowd.update(dt, ctrl.state);
      rig.update(dt, { ...ctrl.state }, { orbit: input.orbit, pitch: input.pitch, zoom: input.zoom });
      nearPlace = nearest();
    },
    /** Draws one frame (also used by the tests with dt = 0). */
    render(dt) {
      if (!opened || disposed) return;
      const s = applySky();
      const st = ctrl.state;
      groundY += (groundHeight(map, st.x, st.z) - groundY) * Math.min(1, dt > 0 ? dt * 14 : 1);
      ori.update(dt, st, groundY, st.winded ? 0.6 : 0);
      fill.position.set(st.x + Math.sin(st.heading) * 1.2, groundY + 2.6, st.z + Math.cos(st.heading) * 1.2);
      crowd3d.update(t);
      ground.update(t, s);
      sky.update(camera, t);
      if (shadows) {
        // the sun's shadow box follows Ori (snapped to texels so the shadows do not shimmer)
        const snap = 1.0;
        const cx = Math.round(st.x / snap) * snap;
        const cz = Math.round(st.z / snap) * snap;
        sun.target.position.set(cx, 0, cz);
        sun.position.set(cx + sky.sunDir.x * 150, Math.max(20, sky.sunDir.y * 150), cz + sky.sunDir.z * 150);
        sun.target.updateMatrixWorld();
      }
      placeCamera();
      renderer.info.reset();
      if (post) post.render(dt, st.sprinting ? 0.12 : 0);
      else renderer.render(scene, camera);
      hud.update({ time: clock.label(), label: partOfDay(clock.hour), day: clock.progress, place: nearPlace ? { name: nearPlace.name, kind: nearPlace.kind === 'building' ? 'Here' : 'Near' } : null, stamina: st.stamina, winded: st.winded });
    },
    resize(w, h) {
      if (!camera) return;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      if (post) post.setSize(w, h);
    },
    pause() { if (paused || !opened) return false; paused = true; hud.showPause(true); lastKb && lastKb.clear && lastKb.clear(); return true; },
    resume() { if (!paused) return; paused = false; hud.showPause(false); },
    onEscape() { if (paused) api.resume(); else api.pause(); },
    onReset() { /* R: nothing to reset yet */ },
    onCamera() { if (rig) { rig.state.yaw = ctrl.state.heading; rig.state.pitch = 0.4; } },
    onAction(name) {
      if (paused || !opened) return;
      if (name === 'interact' && nearPlace) hud.toast(nearPlace.kind === 'building' ? `${nearPlace.name}: the door is closed (for now)` : `${nearPlace.name}`);
    },
    onKey(e) {
      if (paused) {
        if (e.code === 'Escape' || e.code === 'KeyP') { api.resume(); return true; }
        if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ArrowUp' || e.code === 'KeyW') {
          const bs = [...hud.menu.querySelectorAll('.g3d-btn')];
          const i = bs.indexOf(document.activeElement);
          bs[(i + (e.code === 'ArrowDown' || e.code === 'KeyS' ? 1 : -1) + bs.length) % bs.length].focus();
          return true;
        }
        if (e.code === 'Tab' || e.code === 'Enter' || e.code === 'Space') return 'native';
        return true;
      }
      return undefined;
    },
    // ── debug / tests ──
    /** Runs n fixed steps of 1/120 s with the last input (or standing still). */
    step(n = 1, inp = null) {
      for (let i = 0; i < n; i++) { ctrl.step(inp || wish); clock.tick(1 / 120); }
      rig.update(n / 120, { ...ctrl.state }, {});
      nearPlace = nearest();
    },
    /** Puts Ori in front of a place's door ('home', 'cafe' …) or at {x, z}; the camera snaps behind him. */
    teleport(target, heading) {
      const p = typeof target === 'string' ? map.places[target] : null;
      if (typeof target === 'string' && !p) return null;
      const x = p ? p.door.x : target.x;
      const z = p ? p.door.z : target.z;
      const hd = heading ?? (p ? Math.atan2(-p.door.nx, -p.door.nz) : ctrl.state.heading); // facing the door
      ctrl.teleport(x, z, hd);
      rig.state.yaw = hd;
      groundY = groundHeight(map, x, z);
      nearPlace = nearest();
      placeCamera(true);
      rig.reset();
      return api.state();
    },
    place(id) { const p = map.places[id]; return p ? { id: p.id, name: p.name, kind: p.kind, door: { ...p.door }, rect: { ...p.rect }, distance: map.dist[nearPlace ? nearPlace.id : 'home'][id] } : null; },
    /** Dev / tests: { yaw, pitch, dist } of the chase camera (yaw = the direction it looks along; 0 looks south). */
    setCamera(c = {}) { if (c.yaw != null) rig.state.yaw = c.yaw; if (c.pitch != null) rig.state.pitch = c.pitch; if (c.dist != null) rig.state.dist = c.dist; rig.reset(); placeCamera(true); },
    setHour(h) { clock.set(h); applySky(true); },
    clockInfo() { return { hour: clock.hour, label: clock.label(), progress: clock.progress, done: clock.done }; },
    state() {
      if (!opened) return { phase: 'loading' };
      const s = ctrl.state;
      return {
        phase: 'play', paused, tier,
        clock: { hour: clock.hour, label: clock.label(), progress: clock.progress },
        player: { x: s.x, z: s.z, heading: s.heading, speed: s.speed, stamina: s.stamina, sprinting: s.sprinting, winded: s.winded, blocked: s.blocked, hash: ctrl.hash() },
        near: nearPlace ? nearPlace.id : null,
        camera: { x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw: rig.state.yaw, fov: camera.fov },
        crowd: crowd ? crowd.walkers.length : 0,
        radius: PLAYER_R, walk: WALK_SPEED,
      };
    },
    setTier() { /* the tier is chosen at launch; relaunch to change it */ },
    reconfigure() { /* nothing to rebuild yet */ },
    dispose() {
      if (disposed) return;
      disposed = true;
      hud.dispose();
      if (!opened) return;
      ori.dispose();
      crowd3d.dispose();
      buildings.dispose();
      ground.dispose();
      props.dispose();
      sky.dispose();
      if (post) post.dispose();
      if (sun && sun.shadow) sun.shadow.dispose(); // (the renderer does not free the shadow map by itself)
      if (envMap) { /* released with the sky */ }
      disposeTree(scene);
      scene.clear();
      renderer.shadowMap.enabled = false;
    },
  };
  void PLACES;
  return api;
}
