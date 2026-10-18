// "Ori, Can You...?" — the game controller the host runs (see host.js for the contract): builds the neighbourhood, Ori and the crowd,
// drives them from the input, runs the game clock and the light of the day, feeds the quest engine (quests.js) and shows it on the phone
// and the HUD, and draws one frame. The favours themselves (the little actions at each place) arrive with T53; until then Space at the
// right door simply does the favour.
import * as THREE from 'three';
import { createSky } from '../sky3d.js';
import { createFavorsPost } from './post-fx.js';
import { buildMap, groundHeight, walkDistance, PLAYER_R } from './map.js';
import { createController, moveDir, WALK_SPEED } from './controller.js';
import { createVehicle } from './vehicle.js';
import { createTraffic } from './traffic.js';
import { createFire } from './fire.js';
import { createBodies } from './bodies.js';
import { createCameraRig } from './camera-rig.js';
import { createClock, skyAt, gradeAt } from './daycycle.js';
import { createCrowd } from './crowd.js';
import { createCrowd3d } from './crowd3d.js';
import { buildBuildings } from './buildings3d.js';
import { createMaterialLibrary } from './materials.js';
import { weatherPlan, weatherAt, applyOvercast, createRain } from './weather.js';
import { buildGround } from './ground3d.js';
import { buildProps } from './props3d.js';
import { buildBeach } from './beach3d.js';
import { createLife } from './life3d.js';
import { buildFurniture } from './furniture3d.js';
import { createOri } from './ori3d.js';
import { setOutlineView } from './people/materials.js';
import { createPerson } from './people/person.js';
import { randomSpec } from './people/specs.js';
import { prewarmOri, prewarmCrowd } from './people/loader.js';
import { createFavorsHud } from './hud.js';
import { createPhone } from './phone.js';
import { createSfx } from './sfx.js';
import { createBeam } from './beam3d.js';
import { createQuests, rankFor } from './quests.js';
import { TEXT, nextTimeFor } from './texts.js';
import { disposeTree } from './gfx.js';
import { CROWD, DAY, PLACES, RANKS } from './content.js';

const KEY_GAIN = 0.92; // sun / moon intensity
const HEMI_GAIN = 1.08; // (soft shadows: a lot of sky light fills them)
const NEAR_PLACE = 16; // metres: the label of a place shows when Ori is this close to its door
const USE_RANGE = 3.8; // metres from a door where Space does the favour

const PARTS = ['Early morning', 'Morning', 'Midday', 'Afternoon', 'Golden hour', 'Evening', 'Night'];
const partOfDay = (h) => (h < 7 ? PARTS[0] : h < 11 ? PARTS[1] : h < 14 ? PARTS[2] : h < 17.5 ? PARTS[3] : h < 19.8 ? PARTS[4] : h < 22 ? PARTS[5] : PARTS[6]);
const left = (m) => { if (m < 1) return 'now'; const t = Math.ceil(m); return t < 60 ? `${t} min` : `${Math.floor(t / 60)} h ${String(t % 60).padStart(2, '0')} min`; };

export function createFavorsGame(o) {
  const { renderer, overlay, quit } = o;
  const tier = o.tier || 'high';
  const shadows = tier !== 'low';
  const reduceMotion = () => (o.reduceMotion ? o.reduceMotion() : window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let paused = false;
  let opened = false;
  let disposed = false;
  let over = false; // the day has ended: the report card is up
  let t = 0; // seconds since the game opened (waves, clouds)
  let questSeed = o.questSeed ?? 1;

  // world pieces (made in open())
  let map = null;
  let scene = null;
  let camera = null;
  let post = null;
  let sky = null;
  let hemi = null;
  let sun = null;
  let buildings = null;
  let lib = null;
  let rain = null;
  let plan = null; // the weather of the day (weather.js)
  let forcedWeather = null; // dev / tests: { rain, wet, overcast } held fixed
  let weatherNow = { rain: 0, wet: 0, overcast: 0 };
  let lampTick = 0;
  let ground = null;
  let props = null;
  let traffic = null;
  let veh = null; // the car's physics while Ori drives (null on foot)
  let drive = null; // { p: the parked car (a map prop), mesh: the moving copy }
  let nearCar = null; // the parked car within reach of Ori
  let camDist = 8.9;
  let bodies = null; // cars that were knocked about and now slide and spin on their own
  let fire = null; // the afterburner flames
  let carTag = null; // the bobbing "ORI CAR" arrow over Ori's own car, until he first gets in
  let beach = null;
  let life = null;
  let furniture = null;
  const scare = [];
  let ori = null;
  let crowd = null;
  let crowd3d = null;
  let ctrl = null;
  let rig = null;
  let envMap = null;
  let fill = null;
  let quests = null;
  let phone = null;
  let beam = null;
  const sfx = createSfx({ isMuted: o.isMuted || (() => false), volume: o.volume || (() => 1) });
  const clock = createClock({ startHour: o.startHour ?? DAY.startHour, realMinutes: o.dayMinutes ?? DAY.realMinutes });
  const input = { fwd: 0, strafe: 0, sprint: false, orbit: 0, pitch: 0, zoom: 1 };
  const wish = { mx: 0, mz: 0, sprint: false };
  let lastKb = null;
  let nearPlace = null; // the place whose door is within NEAR_PLACE
  let nearest = null; // the closest place whatever the distance (the phone measures from it)
  let groundY = 0;
  let intro = null; // the 4-second fly-in at the start of a game (skipped by quick launches, reduced motion and any key)
  let lastSky = null;
  let following = null; // uid of the task the beam points at
  let noFollow = false; // the player unpinned on purpose: do not pin the next one by itself
  const v3 = new THREE.Vector3();

  const hud = createFavorsHud(overlay, {
    onPause: () => api.onEscape(),
    onResume: () => api.resume(),
    onRestart: () => restartDay(true),
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
    sky.mesh.scale.setScalar(0.3); // (the dome is 3400 m wide: inside this camera's far plane it would be clipped away, and the sky would be the clear colour)
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
    lap('sky');

    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    lib = createMaterialLibrary({ tier, aniso });
    plan = weatherPlan(questSeed);
    ground = buildGround(map, { lib });
    lap('ground');
    buildings = buildBuildings(map, { lib, aniso, shadows, tier });
    lap('buildings');
    props = buildProps(map, { shadows, tier, lib });
    traffic = createTraffic({ props, seed: questSeed });
    bodies = createBodies({ world: map.world });
    fire = createFire(scene, { height: renderer.domElement.height * 0.9 });
    const mine = props.cars.find((p) => p.mine);
    if (mine && !o.quick) {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
      const x = cv.getContext('2d');
      x.fillStyle = 'rgba(20,24,36,0.86)'; x.beginPath(); x.roundRect(36, 30, 440, 120, 60); x.fill();
      x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 4; x.stroke();
      x.fillStyle = '#ffffff'; x.font = '800 62px Inter, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('ORI CAR', 256, 92);
      x.fillStyle = 'rgba(20,24,36,0.86)'; x.beginPath(); x.moveTo(216, 150); x.lineTo(296, 150); x.lineTo(256, 214); x.closePath(); x.fill();
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
      sp.scale.set(3.8, 1.9, 1); sp.renderOrder = 999;
      scene.add(sp);
      carTag = { sp, tex, car: mine };
    }
    lap('props');
    beach = buildBeach(map, { lib, shadows, tier });
    life = createLife(map, { lib, shadows, tier });
    furniture = buildFurniture(map, { lib, shadows, tier });
    scene.add(ground.group, buildings.group, props.group, beach.group, life.group, furniture.group);

    crowd = createCrowd(map, { count: CROWD.count, seed: 7 });
    // a few neighbours out on their balconies, near where the game starts
    const folkSpots = buildings.balconies.filter((s) => Math.hypot(s.x - map.spawn.x, s.z - map.spawn.z) < 110).sort((a, b) => Math.hypot(a.x - map.spawn.x, a.z - map.spawn.z) - Math.hypot(b.x - map.spawn.x, b.z - map.spawn.z));
    const balconyFolk = folkSpots.filter((_, i) => i % 3 === 1).slice(0, 8).map((s, i) => ({ ...s, look: { hair: i + 1, shirt: i * 3 + 1, pants: i, skin: (i * 2 + 1) % 5, height: 0.92 + (i % 3) * 0.04 } }));
    crowd3d = createCrowd3d(map, crowd, { shadows, extras: balconyFolk, range: tier === "low" ? 40 : tier === "medium" ? 65 : 95 });
    scene.add(crowd3d.mesh);
    lap('crowd');
    ori = createOri({ shadows, tier });
    scene.add(ori.group);
    setOutlineView(size.x * renderer.getPixelRatio(), size.y * renderer.getPixelRatio());
    lap('ori');
    ctrl = createController(map.world, { x: map.spawn.x, z: map.spawn.z, heading: map.spawn.heading });
    rig = createCameraRig(map.world, { yaw: map.spawn.heading, pitch: 0.38, dist: 8.9 });
    findPlaces();
    beam = createBeam();
    scene.add(beam.group);
    rain = createRain({ count: tier === 'high' ? 2600 : 1400 });
    scene.add(rain.mesh);
    startQuests();
    sfx.music(true);

    if (tier !== 'low') post = createFavorsPost(renderer, scene, camera, { tier, bloom: { strength: 0.32, radius: 0.55, threshold: 0.9 } });
    applySky(true);
    placeCamera(true);
    lap('setup');
    api.render(0); // (the first frame compiles the shaders)
    lap('first-frame');
    if (!o.quick && !reduceMotion()) startIntro();
  }

  // ── the fly-in: down from above the street to behind Ori while he checks his phone (it just buzzed) ──
  function startIntro() {
    intro = { t: 0, dur: 4.2, base: { yaw: rig.state.yaw, pitch: rig.state.pitch, dist: rig.state.dist } };
    ori.hold('phone');
    ori.setMood('smile');
  }
  function stepIntro(dt) {
    intro.t += dt;
    const u = Math.min(1, intro.t / intro.dur);
    const e = 1 - (1 - u) ** 3;
    const b = intro.base;
    rig.state.yaw = b.yaw + (1 - e) * 2.4;
    rig.state.pitch = b.pitch + (1 - e) * 0.55;
    rig.state.dist = b.dist * (1 + (1 - e) * 2.2);
    if (intro.t > 2.5) ori.hold(null);
    if (u >= 1) endIntro();
  }
  function endIntro() {
    if (!intro) return;
    rig.state.yaw = intro.base.yaw; rig.state.pitch = intro.base.pitch; rig.state.dist = intro.base.dist;
    ori.hold(null);
    intro = null;
  }

  // ── the favours: the quest engine, the phone, the beam ──
  function startQuests() {
    quests = createQuests({ seed: questSeed, dist: map.dist, difficulty: o.difficulty || 'normal' });
    if (phone) phone.dispose();
    phone = createPhone(hud.root, overlay, {
      map, q: quests, sfx,
      getPlayer: () => ({ x: ctrl.state.x, z: ctrl.state.z, heading: ctrl.state.heading, near: nearest ? nearest.id : null }),
      onPin: (uid) => { following = uid; noFollow = uid == null; aimBeam(); },
    });
    following = null;
    noFollow = false;
    over = false;
    aimBeam();
  }

  /** Stands the beam over the followed task's door (or hides it). */
  function aimBeam() {
    const task = following != null ? quests.get(following) : null;
    if (!task || (task.state !== 'new' && task.state !== 'accepted')) { following = null; beam.hide(); hud.goal(null); return; }
    const d = map.places[task.at].door;
    beam.set(d.x - d.nx * 0.8, d.z - d.nz * 0.8, groundHeight(map, d.x, d.z));
  }
  /** With nothing followed, the most urgent open task becomes the goal (unless the player said no). */
  function autoFollow() {
    if (following != null) { const tk = quests.get(following); if (tk && (tk.state === 'new' || tk.state === 'accepted')) return; following = null; }
    if (noFollow) return;
    const first = quests.list(nearest ? nearest.id : 'home')[0];
    if (first) { following = first.uid; phone.setActive(first.uid); }
    else { following = null; beam.hide(); }
  }

  function syncQuests() {
    const dm = clock.hour * 60 - quests.state.min;
    if (dm > 0) quests.tick(dm);
    for (const e of quests.drain()) {
      const task = e.uid != null ? quests.get(e.uid) : null;
      if (e.type === 'new') {
        const urgent = task.pri >= 3;
        phone.notify(task, { urgent });
        sfx.buzz();
        if (ori && !intro && ctrl.state.speed < 1.2) { ori.holdFor('phone', 1.8); ori.flash(urgent ? 'surprised' : 'smile', 1.2); } // he looks at the phone when it buzzes
        if (urgent) { sfx.urgent(); if (!reduceMotion()) hud.shake(); }
        if (noFollow) noFollow = false; // a new task: the guide may speak again
      } else if (e.type === 'done') {
        sfx.ding();
        hud.float(`+${e.points}`);
        if (ori && ctrl.state.speed < 2.5) ori.play('thumbsUp');
        if (following === e.uid) { following = null; phone.setActive(null); noFollow = false; }
      } else if (e.type === 'failed') {
        // the time ran out: never a failure, always a rain check
        sfx.soft();
        if (ori && ctrl.state.speed < 1.5) ori.play('shrug');
        hud.float(nextTimeFor(task.uid), true);
        hud.toast(e.mentor ? TEXT.mentorsTried(task.title) : TEXT.rainCheck(task.giverName, task.title));
        if (following === e.uid) { following = null; phone.setActive(null); noFollow = false; }
      } else if (e.type === 'coffee') {
        ctrl.coffee(8);
        sfx.sip();
        if (ori) ori.play('cheer');
        hud.toast(TEXT.coffee);
      } else if (e.type === 'focus') {
        hud.toast(e.on ? TEXT.focusOn : TEXT.focusOff(e.released || 0));
      } else if (e.type === 'declined' && following === e.uid) { following = null; phone.setActive(null); }
      else if (e.type === 'day-end') endDay(e.report);
    }
    autoFollow();
    aimBeam();
  }

  function endDay(report) {
    if (over) return;
    over = true;
    phone.close();
    hud.showReport(report, { onAgain: () => restartDay(true), onQuit: quit });
    sfx.ding();
  }

  function restartDay(newSeed = false) {
    if (newSeed) questSeed++;
    clock.set(clock.startHour);
    ctrl.teleport(map.spawn.x, map.spawn.z, map.spawn.heading);
    ctrl.state.stamina = 1;
    rig.state.yaw = map.spawn.heading;
    plan = weatherPlan(questSeed);
    startQuests();
    api.resume();
    applySky(true);
    placeCamera(true);
    api.render(0);
  }

  // ── cars: get in (F / Space next to one), drive, get out ──
  const CAR_REACH = 3.6;
  function findCar() {
    const st = ctrl.state;
    let best = null;
    let bd = CAR_REACH;
    for (const p of props.cars) { const d = Math.hypot(p.x - st.x, p.z - st.z); if (d < bd) { bd = d; best = p; } }
    nearCar = best;
  }
  function enterCar(p) {
    if (drive || over) return;
    if (p.body) { bodies.remove(p.body); if (p.body.mesh) p.body.mesh.dispose(); p.body = null; } // (a car that was knocked about: it is driven from where it lies)
    if (p.dyn) { for (const c of p.dyn) map.world.removeDynamic(c); p.dyn = null; }
    if (p.col) p.col.off = true;
    props.setCarHidden(p, true);
    const mesh = props.makeCar(props.carKind(p), props.carColor(p));
    drive = { p, mesh };
    if (carTag) { scene.remove(carTag.sp); carTag.sp.material.dispose(); carTag.tex.dispose(); carTag = null; } // he found it: the arrow's job is done
    veh = createVehicle(map.world, { x: p.x, z: p.z, heading: p.rot + Math.PI / 2, ...(p.mine ? { accel: 21, top: 27 } : { accel: 9.5, top: 17 }) }); // Ori's own car is the quick one
    ori.group.visible = false;
    ctrl.teleport(p.x, p.z, veh.state.heading);
    camDist = rig.state.dist;
    rig.state.dist = 11.5;
    nearCar = null;
    sfx.tap();
    hud.toast(TEXT.carIn);
  }
  function exitCar() {
    if (!drive) return;
    const { p, mesh } = drive;
    const s = veh.state;
    // the car stays where it was left (hidden instance moved there, three circles in the collision world), Ori steps out on the driver's side
    p.x = s.x; p.z = s.z; p.rot = s.heading - Math.PI / 2;
    props.setCarPose(p);
    props.setCarHidden(p, false);
    mesh.dispose();
    p.dyn = [-1.35, 0, 1.35].map((o) => map.world.addDynamic({ t: 1, x: s.x + Math.sin(s.heading) * o, z: s.z + Math.cos(s.heading) * o, r: 0.98 }));
    const fx = Math.sin(s.heading); const fz = Math.cos(s.heading);
    const rx = -fz; const rz = fx; // to the right of the car
    let ox = s.x + rx * 2.1; let oz = s.z + rz * 2.1;
    for (const [k, b] of [[2.1, 0], [-2.1, 0], [2.6, 2], [-2.6, 2], [2.1, -2], [-2.1, -2]]) {
      const tx = s.x + rx * k + fx * b; const tz = s.z + rz * k + fz * b;
      if (!map.world.blocked(tx, tz, PLAYER_R)) { ox = tx; oz = tz; break; }
    }
    ctrl.teleport(ox, oz, s.heading);
    ctrl.state.sprinting = false;
    drive = null; veh = null;
    ori.group.visible = true;
    rig.state.dist = camDist;
    sfx.engine(-1);
    sfx.tap();
    hud.toast(TEXT.carOut);
  }
  /** What the car Ori drives touches gets knocked loose: parked cars and traffic cars turn into free bodies that take the hit. */
  function knockThings(s) {
    const fx = Math.sin(s.heading); const fz = Math.cos(s.heading);
    const reach = (o) => [s.x + fx * o, s.z + fz * o];
    const touches = (x, z, rad = 3.1) => [-1.35, 0, 1.35].some((o) => { const [cx, cz] = reach(o); return Math.hypot(x - cx, z - cz) < rad; });
    for (const p of props.cars) {
      if (p === drive.p || p.body || !touches(p.x, p.z, 4.3)) continue; // (a parked car's collider is a long box: free it before the wall stops the car)
      if (p.dyn) { for (const c of p.dyn) map.world.removeDynamic(c); p.dyn = null; }
      if (p.col) p.col.off = true;
      props.setCarHidden(p, true);
      const mesh = props.makeCar(props.carKind(p), props.carColor(p));
      p.body = bodies.add({ x: p.x, z: p.z, heading: p.rot + Math.PI / 2, mesh, long: p.mine ? 1.5 : 1.35, src: { p } });
    }
    if (traffic) {
      for (const c of [...traffic.cars]) {
        if (!touches(c.x, c.z)) continue;
        const d = traffic.detach(c);
        if (d) bodies.add({ x: d.x, z: d.z, heading: d.heading, vx: d.vx, vz: d.vz, mesh: d.mesh, src: { traffic: true } });
      }
    }
    const hit = bodies.hitBy(s, drive.p.mine ? [-1.5, 0, 1.5] : [-1.35, 0, 1.35]);
    if (hit > 0) s.hit = Math.max(s.hit, hit);
  }
  function stepDrive(dts) {
    const s = veh.state;
    const mineCar = !!drive.p.mine;
    veh.update(dts, { throttle: input.fwd, steer: input.strafe, brake: !mineCar && input.sprint, boost: mineCar && input.sprint }); // Ori's car boosts on Shift, the others brake
    knockThings(s);
    const c = ctrl.state;
    c.x = s.x; c.z = s.z; c.heading = s.heading; c.vx = s.vx; c.vz = s.vz; c.speed = Math.abs(s.speed); c.sprinting = s.speed > (drive.p.mine ? 18 : 13);
    sfx.engine(Math.min(1, Math.abs(s.speed) / (drive.p.mine ? 27 : 17)), input.fwd);
    if (s.hit > 2.5) { sfx.pop(); s.hit = 0; if (!reduceMotion()) hud.shake(); }
    // the afterburner: flames out of the two tail pipes while the boost is on
    if (fire && s.boost > 0.15) {
      const fx = Math.sin(s.heading); const fz = Math.cos(s.heading);
      for (const side of [-0.42, 0.42]) for (let k = 0; k < 2; k++) fire.emit(s.x - fx * 2.55 - fz * side + (Math.random() - 0.5) * 0.15, 0.5 + Math.random() * 0.1, s.z - fz * 2.55 + fx * side + (Math.random() - 0.5) * 0.15, -fx * (6 + Math.random() * 5) + s.vx * 0.5 + (Math.random() - 0.5) * 1.2, (Math.random() - 0.3) * 0.8, -fz * (6 + Math.random() * 5) + s.vz * 0.5 + (Math.random() - 0.5) * 1.2, 0.5 + s.boost * 0.5);
    }
    drive.mesh.group.position.set(s.x, 0, s.z);
    drive.mesh.group.rotation.set(0, s.heading - Math.PI / 2, 0);
  }

  /** Space: do the favour at the door Ori stands at (the followed task first, then the soonest one there). T53 puts a little action here. */
  function useDoor() {
    if (!nearest) return;
    const d = nearest.door;
    if (Math.hypot(d.x - ctrl.state.x, d.z - ctrl.state.z) > USE_RANGE) { hud.toast(TEXT.nothingHere); return; }
    const here = quests.open().filter((tk) => tk.at === nearest.id);
    const pick = here.find((tk) => tk.uid === following) || here.sort((a, b) => a.deadline - b.deadline)[0];
    if (!pick) { hud.toast(TEXT.nobodyAsked(nearest.name)); return; }
    quests.complete(pick.uid, 0.85);
    syncQuests();
  }

  // the host owns the input object and passes it to update(); touch controls need it
  function applySky(force = false) {
    const h = clock.hour;
    if (!force && lastSky && Math.abs(h - lastSky.hour) < 0.004) return lastSky;
    const s = skyAt(h);
    weatherNow = forcedWeather || weatherAt(plan, h);
    applyOvercast(s, weatherNow.overcast);
    lastSky = s;
    const u = sky.material.uniforms;
    // (the day cycle's colours are what you SEE: sRGB; the shaders work in linear light)
    const S = THREE.SRGBColorSpace;
    u.uTop.value.setRGB(s.top[0], s.top[1], s.top[2], S);
    u.uMid.value.setRGB(s.mid[0], s.mid[1], s.mid[2], S);
    u.uHorizon.value.setRGB(s.hor[0], s.hor[1], s.hor[2], S);
    u.uBelow.value.setRGB(s.below[0], s.below[1], s.below[2], S);
    u.uSunColor.value.setRGB(s.sun[0], s.sun[1], s.sun[2], S);
    u.uCloudLit.value.setRGB(s.cloud[0], s.cloud[1], s.cloud[2], S);
    u.uCloudShade.value.setRGB(s.cloud[0] * 0.6, s.cloud[1] * 0.62, s.cloud[2] * 0.7, S);
    sky.sunDir.set(...s.sunDir);
    u.uSunSize.value = s.isDay ? 0.04 : 0.03;
    u.uGlow.value = s.isDay ? 0.8 : 0.25;
    u.uPower.value = s.isDay ? 3 : 1.5;
    u.uStars.value = s.stars;
    u.uCover.value = 0.4 + 0.5 * weatherNow.overcast;
    hemi.color.setRGB(...s.hemiS);
    hemi.groundColor.setRGB(...s.hemiG);
    hemi.intensity = s.hemiI * HEMI_GAIN;
    sun.color.setRGB(...s.key);
    sun.intensity = s.keyI * KEY_GAIN * (0.15 + 0.85 * s.sunVis);
    scene.fog.color.setRGB(s.fog[0], s.fog[1], s.fog[2], S);
    scene.fog.near = s.fogN;
    scene.fog.far = s.fogF;
    renderer.toneMappingExposure = s.exp;
    scene.environmentIntensity = 0.08 + 0.3 * (1 - s.night);
    // windows: lit ones glow when it is dark; by day the glass reflects the sky
    buildings.setLight({ win: s.win, lamps: s.lamps, day: 1 - s.night, glass: [s.hor[0] * 0.3 * (1 - s.night) + 0.03, s.hor[1] * 0.34 * (1 - s.night) + 0.045, s.hor[2] * 0.4 * (1 - s.night) + 0.07] });
    props.setLight({ lamps: s.lamps });
    furniture.setLight({ lamps: s.lamps });
    lib.setWeather({ wet: weatherNow.wet, lamps: s.lamps });
    fill.intensity = s.lamps * 9;
    return s;
  }

  const extras = []; // dev / tests: extra people standing about (spawnPeople)
  let debugCam = null; // dev / tests: { pos, look, fov } overrides the chase camera (portraits)
  function placeCamera(snap = false) {
    if (snap) rig.reset();
    if (debugCam) {
      camera.position.set(...debugCam.pos);
      camera.lookAt(...debugCam.look);
      if (debugCam.fov && Math.abs(camera.fov - debugCam.fov) > 0.05) { camera.fov = debugCam.fov; camera.updateProjectionMatrix(); }
      return;
    }
    const c = rig.state;
    camera.position.set(c.x, Math.max(c.y, groundY + 0.6) + (c.by || 0), c.z);
    camera.lookAt(c.lx, c.ly + groundY * 0.5 + (c.by || 0), c.lz);
    if (Math.abs(camera.fov - c.fov) > 0.05) { camera.fov = c.fov; camera.updateProjectionMatrix(); }
  }

  /** The street lamps closest to Ori: wet roads mirror their light (up to 8). */
  function nearestLamps() {
    const st = ctrl.state;
    const list = [];
    for (const p of map.props) {
      if (p.type !== 'lamp') continue;
      const d = Math.hypot(p.x - st.x, p.z - st.z);
      if (d < 46) list.push({ x: p.x + 0.88, y: 5.4, z: p.z, i: 1 - d / 52, d });
    }
    list.sort((a, b) => a.d - b.d);
    lib.setLamps(list.slice(0, 8));
  }

  function findPlaces() {
    let best = null;
    let bd = Infinity;
    const s = ctrl.state;
    for (const p of Object.values(map.places)) {
      const d = Math.hypot(p.door.x - s.x, p.door.z - s.z);
      if (d < bd) { bd = d; best = p; }
    }
    nearest = best;
    nearPlace = bd < NEAR_PLACE ? best : null;
  }

  /** The followed place on the screen: null when it is in view, else where on the edge the arrow goes. */
  function arrowFor(place) {
    const d = place.door;
    v3.set(d.x, 1.6, d.z).project(camera);
    const behind = v3.z > 1;
    let x = behind ? -v3.x : v3.x;
    let y = behind ? -v3.y : v3.y;
    if (!behind && Math.abs(x) < 0.94 && Math.abs(y) < 0.9) return null;
    const m = Math.max(Math.abs(x), Math.abs(y), 1e-6);
    x /= m; y /= m;
    const sx = Math.max(-1, Math.min(1, x)) * 0.9;
    const sy = Math.max(-1, Math.min(1, y)) * 0.84;
    return { x: 0.5 + sx / 2, y: 0.5 - sy / 2, angle: Math.atan2(x, y), label: place.sign };
  }

  const api = {
    /** The host waits for this before open(): Ori and the crowd are built off the main thread (at idle they usually are already). */
    preload: () => Promise.all([prewarmOri(tier), prewarmCrowd()]),
    get ori() { return ori; },
    get phase() { return opened ? (over ? 'over' : 'play') : 'loading'; },
    get paused() { return paused; },
    get hud() { return hud; },
    get map() { return map; },
    get controller() { return ctrl; },
    get clock() { return clock; },
    get quests() { return quests; },
    get phone() { return phone; },
    get scene() { return scene; },
    get camera() { return camera; },
    get timings() { return timings; },
    open,
    /** The host creates the input after the game: the touch controls need its joystick state. */
    attachInput(inp) { hud.bindTouch(inp, () => api.onAction('interact')); },
    update(dt, kb) {
      if (!opened || paused) return;
      lastKb = kb;
      kb.read(input, dt);
      if (intro && (Math.abs(input.fwd) + Math.abs(input.strafe) > 0.3 || input.sprint)) endIntro(); // any movement skips it
      if (intro) stepIntro(dt);
      const scale = over || intro ? 0 : 1; // the day never slows down: the phone is a panel on the side, not a menu
      const dts = dt * scale;
      t += dt;
      const yaw = rig.state.yaw;
      const dir = moveDir(yaw, input.fwd, input.strafe);
      wish.mx = dir.mx;
      wish.mz = dir.mz;
      wish.sprint = input.sprint;
      if (!over) { if (drive) stepDrive(dts); else ctrl.update(dts, wish); }
      if (bodies) {
        bodies.update(dts);
        for (const b of [...bodies.bodies]) {
          if (b.src && b.src.p) { b.src.p.x = b.x; b.src.p.z = b.z; b.src.p.rot = b.heading - Math.PI / 2; } // (so it can still be found and entered)
          else if (b.src && b.src.traffic && b.rest > 12) { bodies.remove(b); b.mesh.dispose(); if (traffic) traffic.spawn(ctrl.state); } // a wreck is towed away; a fresh car joins the traffic
        }
      }
      if (traffic) traffic.update(dts, [{ x: ctrl.state.x, z: ctrl.state.z, r: drive ? 1.1 : 0.45 }, ...(bodies ? bodies.bodies.map((b) => ({ x: b.x, z: b.z, r: 1.4 })) : [])]);
      clock.tick(dt, scale);
      crowd.update(intro ? dt : dts, ctrl.state);
      rig.update(dt, { ...ctrl.state }, intro ? {} : { orbit: input.orbit, pitch: input.pitch, zoom: input.zoom });
      findPlaces();
      if (!drive) findCar();
      syncQuests();
    },
    /** Draws one frame (also used by the tests with dt = 0). */
    render(dt) {
      if (!opened || disposed) return;
      const s = applySky();
      const st = ctrl.state;
      groundY += (groundHeight(map, st.x, st.z) - groundY) * Math.min(1, dt > 0 ? dt * 14 : 1);
      ori.update(dt, st, groundY, Math.max(st.winded ? 0.6 : 0, quests.state.chaos / 100));
      for (const p of extras) p.update(dt, { speed: 0 });
      fill.position.set(st.x + Math.sin(st.heading) * 1.2, groundY + 2.6, st.z + Math.cos(st.heading) * 1.2);
      if (fire) fire.update(dt);
      if (carTag) carTag.sp.position.set(carTag.car.x, 3.0 + Math.sin(t * 3) * 0.25, carTag.car.z);
      crowd3d.update(t, camera);
      lib.update(t);
      buildings.update(camera.position.x, camera.position.z);
      rain.update(camera, t, weatherNow.rain);
      scare.length = 0;
      scare.push(ctrl.state);
      for (const w of crowd.walkers) scare.push(w);
      life.update(dt, t, camera, scare);
      if (++lampTick % 12 === 1) nearestLamps();
      ground.update(t, s, weatherNow.overcast);
      sky.update(camera, t);
      beam.update(t);
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
      if (post) {
        camera.updateMatrixWorld();
        const gr = gradeAt(s);
        post.setLook({ tint: gr.tint, sat: gr.sat, contrast: gr.contrast, vignette: gr.vignette, ao: gr.ao, bloomStrength: gr.bloom, focus: Math.hypot(camera.position.x - st.x, camera.position.y - groundY - 1, camera.position.z - st.z), sun: { dir: s.sunDir, color: s.sun, shafts: gr.shafts } });
        post.render(dt);
      }
      else renderer.render(scene, camera);
      const q = quests.state;
      const rankIdx = RANKS.reduce((a, r, i) => (q.score >= r.min ? i : a), 0);
      const next = RANKS[rankIdx + 1];
      hud.update({ time: clock.label(), label: partOfDay(clock.hour), day: clock.progress, place: drive ? { name: 'F · get out', kind: 'Driving' } : nearCar ? { name: 'F · get in', kind: 'Car' } : nearPlace ? { name: nearPlace.name, kind: nearPlace.kind === 'building' ? 'Here' : 'Near' } : null, stamina: st.stamina, winded: st.winded });
      hud.meters({ chaos: q.chaos, score: q.score, rankProgress: next ? (q.score - RANKS[rankIdx].min) / (next.min - RANKS[rankIdx].min) : 1 });
      const task = following != null ? quests.get(following) : null;
      if (task && (task.state === 'new' || task.state === 'accepted')) {
        const place = map.places[task.at];
        const m = Math.round(walkDistance(map, st.x, st.z, place.door.x, place.door.z));
        hud.goal({ title: `${task.giverName}: ${task.title}`, meta: `${m} m · ${left(task.deadline - q.min)}` });
        hud.arrow(arrowFor(place));
      } else {
        hud.goal(null);
        // no task to follow: the edge arrow points at Ori's car instead (the floating tag shows once the car is on screen)
        const ca = carTag ? arrowFor({ door: { x: carTag.car.x, z: carTag.car.z }, sign: 'ORI CAR' }) : null;
        hud.arrow(ca);
        if (carTag) carTag.sp.visible = !ca;
      }
      phone.update(t, dt, ctrl.state.speed);
    },
    resize(w, h) {
      if (!camera) return;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      setOutlineView(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
      if (post) post.setSize(w, h);
    },
    pause() { if (paused || !opened || over) return false; paused = true; sfx.music(false); hud.showPause(true); lastKb && lastKb.clear && lastKb.clear(); return true; },
    resume() { if (!paused) return; paused = false; sfx.music(true); hud.showPause(false); },
    onEscape() { if (over) return; if (phone && phone.isOpen) { phone.close(); return; } if (paused) api.resume(); else api.pause(); },
    onReset() { /* R: nothing to reset yet */ },
    onCamera() { if (rig) { rig.state.yaw = ctrl.state.heading; rig.state.pitch = 0.42; } },
    onAction(name) {
      if (paused || !opened || over) return;
      if (name === 'phone') { phone.toggle(); sfx.tap(); } else if (name === 'interact') { if (drive) exitCar(); else if (nearCar) enterCar(nearCar); else useDoor(); }
    },
    onKey(e) {
      if (over) { if (e.code === 'Tab' || e.code === 'Enter' || e.code === 'Space') return 'native'; return true; }
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
      // the phone is a panel on the side: its keys (1-9, F, Y / L / N, [ ]) are used, everything else still walks Ori
      if (phone && phone.isOpen && phone.key(e)) return true;
      return undefined;
    },
    // ── debug / tests ──
    /** Runs n fixed steps of 1/120 s with the last input (or the given one); the quests follow the clock. */
    step(n = 1, inp = null) {
      for (let i = 0; i < n; i++) { ctrl.step(inp || wish); clock.tick(1 / 120); }
      rig.update(n / 120, { ...ctrl.state }, {});
      findPlaces();
      syncQuests();
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
      findPlaces();
      placeCamera(true);
      rig.reset();
      return api.state();
    },
    place(id) { const p = map.places[id]; return p ? { id: p.id, name: p.name, kind: p.kind, door: { ...p.door }, rect: { ...p.rect }, distance: map.dist[nearest ? nearest.id : 'home'][id] } : null; },
    /** Dev / tests: { yaw, pitch, dist } of the chase camera (yaw = the direction it looks along; 0 looks south). */
    setCamera(c = {}) { if (c.yaw != null) rig.state.yaw = c.yaw; if (c.pitch != null) rig.state.pitch = c.pitch; if (c.dist != null) rig.state.dist = c.dist; rig.reset(); placeCamera(true); },
    /** Dev / tests: put the camera anywhere (null gives the chase camera back). */
    setDebugCamera(cfg) { debugCam = cfg || null; if (!debugCam) rig.reset(); placeCamera(true); },
    /** Dev / tests: stand some people (person specs) in a row in front of Ori. Returns how many were made. */
    spawnPeople(specs, { spacing = 1.15, ahead = 3.2, quality = 0.5 } = {}) {
      const st = ctrl.state;
      const fx = Math.sin(st.heading); const fz = Math.cos(st.heading);
      const rx = Math.cos(st.heading); const rz = -Math.sin(st.heading);
      specs.forEach((sp, i) => {
        const p = createPerson(typeof sp === 'number' ? randomSpec(sp) : sp, { shadows, tier, quality });
        const o = (i - (specs.length - 1) / 2) * spacing;
        p.group.position.set(st.x + fx * ahead + rx * o, groundY, st.z + fz * ahead + rz * o);
        p.group.rotation.y = st.heading + Math.PI;
        scene.add(p.group);
        extras.push(p);
      });
      return extras.length;
    },
    setHour(h) { clock.set(h); applySky(true); syncQuests(); },
    /** Dev / tests: hold the weather fixed ({ rain, wet, overcast } 0..1) or give it back to the day (null). */
    setWeather(w) { forcedWeather = w ? { rain: w.rain ?? 0, wet: w.wet ?? w.rain ?? 0, overcast: w.overcast ?? w.rain ?? 0 } : null; applySky(true); return weatherNow; },
    weather() { return { ...weatherNow, plan: { ...plan } }; },
    clockInfo() { return { hour: clock.hour, label: clock.label(), progress: clock.progress, done: clock.done }; },
    /** Dev / tests: do the favour for a task at once (as Space at its door would). */
    doFavour(uid) { const r = quests.complete(uid, 1); syncQuests(); return r; },
    state() {
      if (!opened) return { phase: 'loading' };
      const s = ctrl.state;
      const q = quests.state;
      return {
        phase: over ? 'over' : 'play', paused, tier, driving: !!drive, car: drive ? { x: veh.state.x, z: veh.state.z, speed: veh.state.speed, heading: veh.state.heading } : null, nearCar: nearCar ? { x: nearCar.x, z: nearCar.z, mine: !!nearCar.mine } : null, traffic: traffic ? traffic.cars.length : 0,
        clock: { hour: clock.hour, label: clock.label(), progress: clock.progress },
        player: { x: s.x, z: s.z, heading: s.heading, speed: s.speed, stamina: s.stamina, sprinting: s.sprinting, winded: s.winded, blocked: s.blocked, hash: ctrl.hash() },
        near: nearPlace ? nearPlace.id : null,
        camera: { x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw: rig.state.yaw, fov: camera.fov },
        crowd: crowd ? crowd.walkers.length : 0,
        quests: { min: q.min, open: quests.open().length, arrived: q.stats.arrived, done: q.stats.done, failed: q.stats.failed, score: q.score, chaos: q.chaos, rank: rankFor(q.score), following, phoneOpen: phone.isOpen, focus: q.focus.on },
        radius: PLAYER_R, walk: WALK_SPEED,
      };
    },
    setTier() { /* the tier is chosen at launch; relaunch to change it */ },
    reconfigure() { /* nothing to rebuild yet */ },
    dispose() {
      if (disposed) return;
      disposed = true;
      hud.dispose();
      sfx.dispose();
      if (!opened) return;
      phone.dispose();
      beam.dispose();
      ori.dispose();
      for (const p of extras) { scene.remove(p.group); p.dispose(); }
      extras.length = 0;
      if (traffic) traffic.dispose();
      if (fire) { fire.dispose(); fire = null; }
      if (bodies) { bodies.dispose(); bodies = null; }
      if (carTag) { scene.remove(carTag.sp); carTag.sp.material.dispose(); carTag.tex.dispose(); carTag = null; }
      crowd3d.dispose();
      buildings.dispose();
      rain.dispose();
      lib.dispose();
      ground.dispose();
      props.dispose();
      beach.dispose();
      life.dispose();
      furniture.dispose();
      sky.dispose();
      if (post) post.dispose();
      if (sun && sun.shadow) sun.shadow.dispose(); // (the renderer does not free the shadow map by itself)
      disposeTree(scene);
      scene.clear();
      renderer.shadowMap.enabled = false;
    },
  };
  void PLACES;
  void envMap;
  return api;
}
