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
import { createSocial } from './social.js';
import { speaker } from './dialogue/cast.js';
import { createInteriors } from './interior3d.js';
import { ROOMS, collidersOf } from './interiors.js';
import { createSfx } from './sfx.js';
import { withCaptions } from './captions.js';
import { FOODS, foodOfUse, fedFor, fedLine } from './buffs.js';
import { createPhoto } from './photo-ui.js';
import { KEY as PHOTO_KEY, ALLOWED as PHOTO_ALLOWED, placeKey } from './photo.js';
import { nearestCat, label as catLabel, pet as catPet, nameOf as catName, FRIEND_PEACHES as CAT_PEACHES } from './cats.js';
import { giftDue, noteHello, count as giftCount, collection as giftCollection, GIFT_IDS, LOVE as GIFT_LOVE } from './gifts.js';
import { createLeague } from './league-ui.js';
import { levelOf as levelOfDriver, board as leagueBoard, result as leagueResult, rivalOf, leagueIdOf, topBonus, eventBoard, eventResult, eventIdOf, eventOf, placeLine, OPEN } from './league.js';
import { createTrackWorld } from './track3d.js';
import { buildTrack, TRACKS, EXIT } from './tracks.js';
import { createSettings } from './settings.js';
import { describeSave, CODE_ERRORS } from './save.js';
import { trapTab } from './a11y.js';
import { createBeam } from './beam3d.js';
import { createQuests, rankFor, template } from './quests.js';
import { TEXT, nextTimeFor } from './texts.js';
import { disposeTree } from './gfx.js';
import { CROWD, DAY, PLACES, RANKS, CAST } from './content.js';
import { subSeed, mulberry32 } from '../rng.js';
import { createCampaign } from './campaign.js';
import { tallyFight, careerStats } from './career.js';
import { newTrophies, evaluate as trophyList } from './trophies.js';
import { createGuide } from './guide-ui.js';
import { createEventTracker, activeAt, bandLevel } from './events.js';
import { current as storyNow, chipText as storyChip, placeOf as storyPlace, takeClue, takeParty, CLUE_REWARD, PARTY, PARTY_EVENT } from './story.js';
import { createEventBeacon } from './event-beacon.js';
import { tourSteps, tourDone, whatNow } from './guide.js';
import { payFor } from './economy.js';
import { createMission, specFor, makeHail } from './missions.js';
import { createMissionWorld } from './mission-world.js';
import { createPlayUi } from './play-ui.js';
import { ECON, WEEK, RACE } from './play-content.js';
import { createBubbles } from './bubbles-ui.js';
import { createJournal } from './journal-ui.js';
import { createMapUi } from './map-ui.js';
import { LANDMARKS, CAR, CUP, lineFor } from './places-guide.js';
import { createArcade } from './arcade-ui.js';
import { createCoffee } from './coffee-ui.js';
import { NEAR as PARCEL_NEAR, pickRun, starsFor, REWARD as PARCEL_REWARD, GIVE_UP as PARCEL_GIVE_UP, chipFor as parcelChip } from './parcel.js';
import { STAMPS, got as stampsGot, count as stampCount, book as stampBook, newOpenStamps, REWARD as STAMP_REWARD } from './stamps.js';
import { readMetrics as wishMetrics, newDay as wishNewDay, rows as wishRows, settle as wishSettle, closeDay as wishCloseDay, BONUS as WISH_BONUS, LOG_DAYS as WISH_LOG_DAYS } from './wishes.js';
import { createFightMode } from './fight3d.js';
import { currentGoal, checkGoals, goalList } from './goals.js';
import { FIGHTERS, LADDER, availability, fighter, nextFight } from './fight-content.js';
import { MOVE_LIST, xpToNext, xpProgress } from './boxer.js';
import { xpFor } from './training.js';

const KEY_GAIN = 0.92; // sun / moon intensity
const HEMI_GAIN = 1.08; // (soft shadows: a lot of sky light fills them)
const NEAR_PLACE = 16; // metres: the label of a place shows when Ori is this close to its door
const USE_RANGE = 3.8; // metres from a door where Space does the favour
const SETPIECES = { 3: [{ at: 16 * 60, id: 'dov-race' }], 4: [{ at: 9 * 60 + 20, id: 'city-inspection' }], 5: [{ at: 12 * 60, id: 'party-list' }] }; // the big moments of the week (quests.js plans them)
const KIND_LABEL = { chase: 'CATCH', find: 'SEARCH', race: 'RACE', taxi: 'FARE', list: 'SHOP', delivery: 'DELIVER' };
const PING_VOICE = { wave: 'sine', wobble: 0.3, bright: 0.4 };

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
  let carTag = null; // the bobbing "ORI CAR" tag over Ori's own car whenever he has stepped out of it (and from the start, until he first gets in)
  let ownCar = null; // the prop of his car
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
  let social = null;
  let interiors = null;
  let inside = null; // { id, info, colliders, hidden, saved, t } while Ori is in a building
  let trans = null; // the door: { t, dur, phase, fn } (a quick fade to black and back)
  let fadeEl = null;
  let goHint = null;
  let beam = null;
  let bubbles = null; // speech bubbles over heads (bubbles-ui.js)
  let journal = null; // the Tab card (journal-ui.js)
  let mapUi = null; // the big map (M)
  let guide = null; // the first-steps card and the "what now?" panel [experimental]
  let events = null; // the city's little events by the hour [experimental]
  let eventBeacon = null;
  let party = null; // the party in the park at the end of the story: { until } (seconds of game time)
  let parcel = null; // the parcel run in hand [experimental]: { from, to, meters, limit, t }
  let partyStay = 0;
  const tour = { pending: false, on: false, moved: 0, mapOpened: false, doneT: 0, x: null, z: null };
  let tracked = null; // the place he follows (from the big map): the beam and the arrow lead there
  let arcade = null; // the office computer (arcade-ui.js)
  let coffee = null; // the cafe job "Coffee Rush" (coffee-ui.js) [experimental]
  let photoUi = null; // photo mode (photo-ui.js) [experimental]
  let league = null; // the Sababa Cup board in Uzi's workshop (league-ui.js) [experimental]
  let trackWorld = null; // the tracks out of town (track3d.js) [experimental]
  let track = null; // the track he is on: { id, since } (null = in town)
  let hz = null; // the obstacles of that track: { list, down: Set of the indices knocked over, oil: seconds of slipping left }
  let night = null; // the Sababa Open in progress (three fights in one night): { ids, round, hpFrac }
  let fight = null; // the ring and the bouts (fight3d.js)
  let fightCam = null; // the camera of a fight (null = the chase camera)
  let afterLeave = null; // what to do once the ring has been left (the next fight, the menu)
  let goalTimer = 0;
  let saveTimer = 0;
  let taskBeam = false; // the beam belongs to a followed task (not to a goal)
  let campaign = null; // the week: money, upgrades, hearts, golden peaches (campaign.js)
  let play = null; // the DOM around the favours (play-ui.js)
  let mworld = null; // the street furniture of the missions (mission-world.js)
  const missions = new Map(); // task uid -> its mission (missions.js)
  let hail = null; // { m, ttl }: a taxi fare waving in the street
  let hailIn = 80;
  let hailRnd = null;
  let frameBump = 0; // the hardest knock of this frame (the cargo feels it)
  let boostFuel = 2.5;
  let goldenNear = -1;
  let dayStart = null; // the campaign at the start of this day (restarting the day goes back to it)
  const daySeed = () => (o.questSeed != null ? o.questSeed + (campaign ? campaign.day - 1 : 0) : campaign.daySeed());
  const sfx = withCaptions(createSfx({ isMuted: o.isMuted || (() => false), volume: o.volume || (() => 1) }), 'street', (t) => { try { hud.caption(t); } catch { /* the HUD is not up yet */ } }); // (sound captions: a setting, off by default)
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

  const settings = createSettings();
  let lastTap = 0;
  // the room's System Settings own the sound level and reduce motion: the pause menu reads and writes them through the host's hooks (a game without those hooks hides the rows)
  const sys = o.setVolume && o.setReduceMotion ? {
    volume: () => ((o.isMuted && o.isMuted()) ? 0 : (o.volume ? o.volume() : 1)),
    setVolume: (v) => { o.setVolume(v); const t = performance.now(); if (t - lastTap > 160) { lastTap = t; sfx.tap(); } }, // (a blip at the new level while the slider moves)
    reduceMotion: () => !!reduceMotion(),
    setReduceMotion: (b) => o.setReduceMotion(b),
  } : null;
  const hud = createFavorsHud(overlay, {
    onPause: () => api.onEscape(),
    onResume: () => api.resume(),
    onRestart: () => restartDay(),
    onQuit: quit,
    settings,
    sys,
    onExport: () => campaign.exportCode(),
    onImport: (text) => importSave(text),
    onHelp: () => guideToggle(),
    onTips: () => replayTour(),
    onStory: () => storyFollow(),
  });

  const timings = {}; // ms per stage of open() (dev: __ori.game3d.game.timings)
  function open() {
    if (opened) return;
    opened = true;
    const t0 = performance.now();
    const lap = (k) => { timings[k] = Math.round(performance.now() - t0); };
    campaign = createCampaign({ fresh: o.fresh ?? !!o.quick, onProblem: (kind) => hud.toast(kind === 'full' ? TEXT.saveFull : kind === 'corrupt' ? TEXT.saveCorrupt : TEXT.saveBlocked, 5600) });
    if (campaign.finale) campaign.reset();
    questSeed = daySeed();
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
    ownCar = props.cars.find((p) => p.mine) || null;
    if (ownCar && !o.quick) carTag = makeCarTag(ownCar);
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
    play = createPlayUi({ root: overlay, hud, sfx, map });
    mworld = createMissionWorld({ scene, makeCar: props.makeCar, tier, shadows, groundAt: (x, z) => groundHeight(map, x, z) });
    startQuests();
    interiors = createInteriors({ scene, lib, tier, shadows });
    fadeEl = document.createElement('div');
    fadeEl.className = 'fv-fade';
    goHint = document.createElement('button');
    goHint.type = 'button';
    goHint.className = 'fv-talkhint fv-gohint fv-glass';
    goHint.addEventListener('click', () => api.onAction('interact'));
    overlay.append(fadeEl, goHint);
    bubbles = createBubbles({ root: overlay });
    journal = createJournal({ root: overlay });
    guide = createGuide({ root: overlay, cardRoot: hud.root, onTrack: () => { const cg = currentGoal(campaign); const ti = cg && cg.place ? trackInfo(cg.place) : null; if (ti) { tracked = cg.place; hud.toast(`Following: ${ti.name}`, 1800); } }, onSkip: () => endTour(true) });
    tour.pending = !campaign.state.progress.tour && (o.tour ?? !o.quick);
    { const pr = campaign.state.progress; events = createEventTracker({ day: pr.evDay, done: Object.keys(pr.evDone || {}) }); }
    wishSync();
    eventBeacon = createEventBeacon();
    scene.add(eventBeacon.group);
    mapUi = createMapUi({ root: overlay, map, getView: mapView, onTrack: (id) => { const ti = trackInfo(id); tracked = ti ? id : null; if (ti) hud.toast(`Following: ${ti.name}`, 1800); } });
    arcade = createArcade({ root: overlay, sfx });
    coffee = createCoffee({ root: overlay, sfx });
    league = createLeague({ root: overlay, sfx });
    trackWorld = createTrackWorld({ scene });
    photoUi = createPhoto({ root: overlay, source: () => renderer.domElement, calm: () => !!reduceMotion(), onShoot: () => shoot() });
    social = createSocial({ overlay, hud, sfx, map, crowd, tier, ctrl: () => ctrl, quests: () => quests, ori: () => ori, hour: () => clock.hour, bubbles, onHello, getLove: () => campaign.state.love, getClue: (id) => storyClue(id) });
    fight = createFightMode({ scene, map, tier, shadows, overlay, getOri: () => ori, groundAt: (x, z) => groundHeight(map, x, z), setCamera: (c) => { fightCam = c; }, setFade, caption: (t) => hud.caption(t), isMuted: o.isMuted, volume: o.volume, reduceMotion, getLove: () => campaign.state.love });
    fight.onResult(onFightResult);
    fight.onLeave(afterFight);
    fight.onTrain(onTrainResult);
    phone.btn.style.display = 'none'; // (no phone: the messages were more annoying than fun)
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
    const ramp = campaign.ramp;
    quests = createQuests({ seed: questSeed, dist: map.dist, difficulty: o.difficulty || 'normal', rel: campaign.state.rel, day: campaign.day, rate: ramp.rate, slack: ramp.slack, noEpic: !ramp.epic, setpieces: SETPIECES[campaign.day] || [], mentors: campaign.eco.perks().mentors, noTasks: true });
    missions.clear();
    if (mworld) mworld.clear();
    hail = null;
    hailRnd = mulberry32(subSeed(questSeed, 99));
    hailIn = 70 + hailRnd() * 40;
    boostFuel = campaign.eco.perks().tank;
    goldenNear = -1;
    dayStart = JSON.stringify({ eco: campaign.eco.snapshot(), rel: campaign.state.rel, golden: campaign.state.golden, wins: campaign.state.wins });
    campaign.eco.newDay();
    if (play) play.setPeaches(campaign.eco.peaches);
    if (phone) phone.dispose();
    phone = createPhone(hud.root, overlay, {
      map, q: quests, sfx, placeOf: (t) => { const m = missions.get(t.uid); const gl = m && m.goal(); return gl && gl.place ? gl.place : t.at; },
      getPlayer: () => (inside ? { x: map.places[inside.id].door.x, z: map.places[inside.id].door.z, heading: ctrl.state.heading, near: inside.id, inside: inside.id } : { x: ctrl.state.x, z: ctrl.state.z, heading: ctrl.state.heading, near: nearest ? nearest.id : null }),
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
    if (!task || (task.state !== 'new' && task.state !== 'accepted')) { following = null; if (taskBeam) { beam.hide(); hud.goal(null); } taskBeam = false; return; }
    taskBeam = true;
    const gl = goalOf(task);
    beam.set(gl.x, gl.z, groundHeight(map, gl.x, gl.z));
  }
  /** Where the beam of a task points right now: the stage of its mission (the pickup, the shop, the runaway) or its door. */
  function goalOf(task) {
    const m = missions.get(task.uid);
    const gl = m && m.goal();
    if (gl && (!gl.place || gl.live)) return gl;
    const d = map.places[gl && gl.place ? gl.place : task.at].door;
    return { x: d.x - d.nx * 0.8, z: d.z - d.nz * 0.8, place: gl && gl.place ? gl.place : task.at };
  }
  const missionEnv = (uid) => ({ places: map.places, zones: map.zones, blocked: (x, z, r) => map.world.blocked(x, z, r), seed: subSeed(questSeed, uid * 7 + 1), day: campaign.day });
  /** What a mission sees of the world this frame. Inside a building Ori stands at its door (the rooms hang far from the street). */
  function missionCtx(dt) {
    const pl = inside ? map.places[inside.id].door : null;
    const car = drive && !inside ? { x: veh.state.x, z: veh.state.z, speed: veh.state.speed, heading: veh.state.heading, yawRate: veh.state.yawRate, boost: veh.state.boost } : null;
    return { dt, p: pl ? { x: pl.x, z: pl.z, speed: 0, sprinting: false } : { x: ctrl.state.x, z: ctrl.state.z, speed: ctrl.state.speed, sprinting: ctrl.state.sprinting }, car, bump: frameBump, rain: weatherNow.rain, perks: campaign.eco.perks(), min: quests.state.min };
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
        missions.set(task.uid, createMission(specFor(template(task.tplId)), missionEnv(task.uid)));
        sfx.buzz();
        if (ori && !intro && ctrl.state.speed < 1.2) { ori.holdFor('phone', 1.8); ori.flash(urgent ? 'surprised' : 'smile', 1.2); } // he looks at the phone when it buzzes
        if (urgent) { sfx.urgent(); if (!reduceMotion()) hud.shake(); }
        if (noFollow) noFollow = false; // a new task: the guide may speak again
      } else if (e.type === 'done') {
        sfx.ding();
        const m = missions.get(e.uid);
        const res = m && m.result;
        const lr = leagueRaceResult(task.tplId, res); // (the Sababa Cup: a rematch pays half)
        const pay = payFor({ ...task, doneAt: quests.state.min }, e.quality, { rel: quests.state.rel[task.rel], boost: (weatherNow.rain > 0.3 && m && (m.kind === 'delivery' || m.kind === 'taxi') ? 1.2 : 1) * (e.share ?? 1) });
        campaign.eco.earn(pay.total, 'favour');
        if (res && res.tip) campaign.eco.earn(Math.round(res.tip), res.special === 'race' ? 'race' : res.special ? 'set' : 'tip');
        if (res && res.special) campaign.mark(res.special, res.place || 1);
        if (lr) leagueDone(lr);
        const gained = pay.total + (res && res.tip ? Math.round(res.tip) : 0);
        play.setPeaches(campaign.eco.peaches, gained);
        hud.float(TEXT.peachesEarned(gained));
        missions.delete(e.uid);
        if (ori && ctrl.state.speed < 2.5) ori.play('thumbsUp');
        if (following === e.uid) { following = null; phone.setActive(null); noFollow = false; }
      } else if (e.type === 'failed') {
        // the time ran out: never a failure, always a rain check
        missions.delete(e.uid);
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
      } else if (e.type === 'declined' || e.type === 'delegated') { missions.delete(e.uid); if (following === e.uid) { following = null; phone.setActive(null); } }
      else if (e.type === 'day-end') endDay(e.report);
    }
    trackWatch();
    autoFollow();
    aimBeam();
  }

  function endDay(report) {
    if (over) return;
    over = true; // (time stands still while he sleeps)
    phone.close();
    play.cancelVerb();
    if (play.shopOpen) play.closeShop();
    for (const m of missions.values()) m.drain();
    missions.clear();
    mworld.clear();
    hail = null;
    campaign.summarize(report, { relNow: quests.state.rel });
    startTrans(() => { over = false; campaign.advance(); campaign.save(); beginDay(); hud.toast(TEXT.goodMorning(campaign.day), 2800); }, 0.55);
  }
  /** The next morning (or, after the last day, the party). */
  function nextDay() {
    campaign.advance();
    if (campaign.finale) { over = true; play.showDay({ ...campaign.summarize({ helped: 0, rank: '', score: 0, bestStreak: 0 }, { relNow: campaign.state.rel }), golden: campaign.state.golden.length, goldenTotal: 12 }, { eco: campaign.eco, party: campaign.party(), onAgain: () => { campaign.reset(); beginDay(); }, onQuit: quit }); return; }
    beginDay();
  }
  function beginDay() {
    parcel = null;
    wishSync();
    if (fight && fight.phase !== 'off') { afterLeave = null; fight.abort(); }
    questSeed = daySeed();
    clock.set(clock.startHour);
    if (track) leaveTrack({ instant: true });
    night = null;
    ctrl.teleport(map.spawn.x, map.spawn.z, map.spawn.heading);
    ctrl.state.stamina = 1;
    rig.state.yaw = map.spawn.heading;
    if (drive) exitCar();
    if (social) social.reset();
    plan = weatherPlan(questSeed);
    startQuests();
    api.resume();
    applySky(true);
    placeCamera(true);
    api.render(0);
  }

  /** A pasted save code (the pause menu): the game is replaced by it and the day starts again from there. */
  function importSave(text) {
    const r = campaign.importCode(text);
    if (!r.ok) return { ok: false, message: CODE_ERRORS[r.error] };
    play.hideDay();
    beginDay(); // (it closes the menu too)
    hud.toast(TEXT.saveLoaded(describeSave(r.save)), 3600);
    return { ok: true };
  }

  /** "Start the day again": this day from its morning, with the money and hearts it began with. */
  function restartDay() {
    if (dayStart) { const d = JSON.parse(dayStart); campaign.eco.restore(d.eco); campaign.state.rel = d.rel; campaign.state.golden = d.golden; campaign.state.wins = d.wins; }
    play.hideDay();
    beginDay();
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
  /** The floating "ORI CAR" tag over his car. */
  function makeCarTag(car) {
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
    return { sp, tex, car };
  }
  function enterCar(p) {
    if (drive || over) return;
    if (p.body) { bodies.remove(p.body); if (p.body.mesh) p.body.mesh.dispose(); p.body = null; } // (a car that was knocked about: it is driven from where it lies)
    if (p.dyn) { for (const c of p.dyn) map.world.removeDynamic(c); p.dyn = null; }
    if (p.col) p.col.off = true;
    props.setCarHidden(p, true);
    const mesh = props.makeCar(props.carKind(p), props.carColor(p));
    drive = { p, mesh };
    if (p.mine && campaign) { const tips = (campaign.state.progress.tips ||= {}); if (!tips.cup) { tips.cup = true; hud.toast("Car races are out of town! Drive east to the end of the main road (the flag on the map) and press R.", 6400); } }
    if (carTag) carTag.sp.visible = false; // (the tag comes back every time he steps out)
    if (tracked === 'car') tracked = null;
    const pk = campaign.eco.perks();
    veh = createVehicle(map.world, { x: p.x, z: p.z, heading: p.rot + Math.PI / 2, ...(p.mine ? { accel: 21 * pk.accel, top: 27 * pk.top * driverTop(), reverse: 17, maxSteer: 0.82, grip: 2.6 * pk.grip } : { accel: 9.5, top: 17 }) }); // Ori's own car is the quick one (the garage makes it quicker)
    veh.baseGrip = p.mine ? 2.6 * pk.grip : 1;
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
    if (p.mine) { if (carTag) carTag.car = p; else carTag = makeCarTag(p); } // "ORI CAR" over it, every time he steps out
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
    const pk = campaign.eco.perks();
    const fm = following != null ? missions.get(following) : null;
    const hold = !!(fm && fm.locked); // (the countdown of a race: the engine revs, the car does not move until GO)
    const wantBoost = !hold && mineCar && input.sprint && input.fwd > 0.05 && boostFuel > 0.04;
    if (wantBoost) boostFuel = Math.max(0, boostFuel - dts); else boostFuel = Math.min(pk.tank, boostFuel + dts * 0.55);
    veh.setGrip(veh.baseGrip * (1 - pk.rainGrip * weatherNow.wet) * (hz && hz.oil > 0 ? 0.3 : 1)); // a wet road is slippery (the tyres in the garage help), and so is oil
    veh.update(dts, hold ? { throttle: 0, steer: 0, brake: true, boost: false } : { throttle: input.fwd, steer: input.strafe, brake: !mineCar && input.sprint, boost: wantBoost }); // Ori's car boosts on Shift (while the tank lasts), the others brake
    if (hold) { s.speed = 0; s.vx = 0; s.vz = 0; }
    if (track) { trackCars(s, fm); trackHazards(s, dts); trackScrub(s, pk, dts); trackWall(s); }
    knockThings(s);
    frameBump = Math.max(frameBump, s.hit);
    const c = ctrl.state;
    c.stamina = Math.min(1, c.stamina + dts * 0.2); c.winded = false; // (sitting in the car he gets his breath back: no stuck bar when he steps out)
    c.x = s.x; c.z = s.z; c.heading = s.heading; c.vx = s.vx; c.vz = s.vz; c.speed = Math.abs(s.speed); c.sprinting = s.speed > (drive.p.mine ? 18 : 13);
    campaign.state.progress.driven = (campaign.state.progress.driven || 0) + c.speed * dts; // (the odometer, in metres)
    sfx.engine(Math.min(1, Math.abs(s.speed) / (drive.p.mine ? 27 : 17)), input.fwd, { boost: s.boost, reverse: s.speed < -0.5, slide: Math.min(1, Math.abs(s.yawRate) * Math.abs(s.speed) / 18), mine: !!drive.p.mine });
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
    const here = quests.open().filter((tk) => stagePlace(tk) === nearest.id);
    const pick = here.find((tk) => tk.uid === following) || here.sort((a, b) => a.deadline - b.deadline)[0];
    if (!pick) { if (nearest.id === 'workshop') openGarage(); else if (ROOMS[nearest.id]) enterPlace(nearest.id); else hud.toast(TEXT.nobodyAsked(nearest.name)); return; }
    startFavour(pick);
  }
  /** The place where a task's mission wants Ori right now (the pickup, a shop, the door of the favour). */
  function stagePlace(tk) { const m = missions.get(tk.uid); const gl = m && m.goal(); return gl && gl.place ? gl.place : tk.at; }
  /** Space at the place a favour is waiting for: its mission starts (a little action, the hand-over) - and becomes the one Ori follows. */
  function startFavour(task) {
    const m = missions.get(task.uid);
    if (!m) { quests.complete(task.uid, 0.85); syncQuests(); return; }
    if (following !== task.uid) { following = task.uid; noFollow = false; phone.setActive(task.uid); aimBeam(); }
    const ctx = missionCtx(0);
    let used = m.act(ctx);
    if (!used) { const c0 = { ...ctx, p: { ...ctx.p, speed: 0 }, car: ctx.car ? { ...ctx.car, speed: 0 } : null }; m.update(c0); used = m.events.length > 0; }
    if (used) handleMission(task.uid, m, task);
    else hud.toast(TEXT.nothingHere);
  }
  /** What a mission says it did: open a little action, a toast, a ping, a count, the end. */
  function handleMission(uid, m, task) {
    for (const e of m.drain()) {
      if (e.type === 'verb') {
        play.openVerb(e, { done: (q) => { m.verbDone(q); handleMission(uid, m, task); }, cancel: () => m.verbCancelled() }, { title: task.title, who: task.giverName });
      } else if (e.type === 'stage') {
        hud.toast(e.say, 3200);
        sfx.pop();
        if (ori && !drive) { if (e.id === 'carry') ori.hold('box'); else if (e.id === 'drop' || e.id === 'found' || e.id === 'caught') ori.hold(null); }
      } else if (e.type === 'hint') {
        hud.toast(e.say === 'taxi-car' ? TEXT.carForFare : e.say === 'chase-again' ? TEXT.chaseAgain : e.say, 2600);
      } else if (e.type === 'item') sfx.pop();
      else if (e.type === 'ping') sfx.blip(PING_VOICE, 360 + 760 * e.v);
      else if (e.type === 'count') { play.bigWord(e.n ? String(e.n) : TEXT.raceGo, 800); (e.n ? sfx.tap : sfx.ding)(); if (!e.n && track) beam.hide(); } // (on a track the road is the way: no beam)
      else if (e.type === 'lap') { sfx.ding(); play.bigWord(e.final ? 'FINAL LAP' : `LAP ${e.lap}`, 1100); }
      else if (e.type === 'checkpoint') { sfx.pop(); hud.toast(TEXT.raceCheck(e.n, e.of), 900); }
      else if (e.type === 'done') {
        if (ori) ori.hold(null);
        if (uid === 'hail') { endHail(true, e); continue; }
        quests.complete(uid, e.quality);
        syncQuests();
      }
    }
  }
  // ── hello, goals, the journal ──
  function onHello(h) {
    if (h.love) { const got = campaign.addLove(h.love); if (got > 0) sfx.pop(); }
    if (h.first) { campaign.bump('hellos'); if (h.id === 'shilo') campaign.bump('shiloHi'); if (!h.stranger) campaign.bump(`hi_${h.id}`); }
    if (!h.stranger) giftCheck(h.id); // (every hello: the gift counts game days, not the 40 seconds between two greetings)
    goalTick();
  }
  // ── the parcel run [experimental]: take a parcel at Uzi's garage, bring it to a door against the clock (a car is quick, a walk is slow), stars by time ──
  const placeDist = (a, b) => { const p = placePoint(a); const q = placePoint(b); return Math.hypot(p.x - q.x, p.z - q.z); };
  function startParcel() {
    if (!campaign || over) return;
    if (parcel) { hud.toast(`You are carrying one for ${PLACES[parcel.to].name} already!`, 2400); return; }
    const run = pickRun({ seed: campaign.day * 17 + (campaign.state.progress.parcels || 0) * 5 + 3, dist: placeDist });
    parcel = { ...run, t: 0 };
    tracked = run.to;
    hud.toast(`A parcel for ${PLACES[run.to].name}: ${run.limit} seconds. Faster is better!`, 4200);
    sfx.ding();
    storySync();
  }
  function deliverParcel() {
    const p = parcel;
    parcel = null;
    const stars = starsFor(p.t, p.limit);
    const r = PARCEL_REWARD[stars];
    campaign.eco.earn(r.peaches, 'parcel');
    play.setPeaches(campaign.eco.peaches, r.peaches);
    if (r.love) campaign.addLove(r.love);
    const pr = campaign.state.progress;
    pr.parcels = (pr.parcels || 0) + 1;
    pr.parcelStars = (pr.parcelStars || 0) + stars;
    if (tracked === p.to) tracked = null;
    hud.toast(`Delivered to ${PLACES[p.to].name}! ${stars ? '\u2605'.repeat(stars) : 'Thank you!'}  +${r.peaches} peaches`, 4200);
    sfx.ding();
    campaign.save();
    storySync();
  }
  function parcelTick() {
    if (!parcel) return;
    const d = inside ? (inside.id === parcel.to ? 0 : Infinity) : placeDistFromMe(parcel.to);
    if (d <= PARCEL_NEAR) { deliverParcel(); return; }
    if (parcel.t > parcel.limit * PARCEL_GIVE_UP) { hud.toast('The parcel went back to the garage. Uzi says: any time!', 3600); if (tracked === parcel.to) tracked = null; parcel = null; storySync(); }
  }
  const placeDistFromMe = (id) => { const p = placePoint(id); return Math.hypot(p.x - ctrl.state.x, p.z - ctrl.state.z); };
  // ── the story "The Peach Tree" [experimental]: five clues said at hello, then the party in the park ──
  const storySync = () => hud.story(!campaign ? '' : parcel ? parcelChip(parcel, parcel.t, PLACES[parcel.to].name) : storyChip(campaign.state.progress));
  function storyClue(id) {
    if (!campaign) return null;
    const r = takeClue(campaign.state.progress, id);
    if (!r) return null;
    campaign.eco.earn(CLUE_REWARD.peaches, 'story');
    play.setPeaches(campaign.eco.peaches, CLUE_REWARD.peaches);
    campaign.addLove(CLUE_REWARD.love);
    hud.toast(r.last ? 'That was the last clue: off to the park!' : `Clue ${r.index + 1} of 5`, 3200);
    sfx.ding();
    campaign.save();
    storySync();
    return r.clue;
  }
  function storyFollow() {
    const pl = parcel ? parcel.to : campaign ? storyPlace(campaign.state.progress) : null;
    const ti = pl ? trackInfo(pl) : null;
    if (ti) { tracked = pl; hud.toast(`Following: ${ti.name}`, 1800); }
  }
  function storyTick(dt) {
    if (!campaign) return;
    storySync();
    const c = storyNow(campaign.state.progress);
    if (!c || c.kind !== 'party' || over) { partyStay = 0; return; }
    partyStay = eventDist(PARTY.place) <= 18 ? partyStay + dt : Math.max(0, partyStay - dt);
    if (partyStay < PARTY.stay) return;
    const r = takeParty(campaign.state.progress);
    if (!r) return;
    partyStay = 0;
    party = { until: t + r.seconds };
    campaign.eco.earn(r.reward.peaches, 'story');
    play.setPeaches(campaign.eco.peaches, r.reward.peaches);
    campaign.addLove(r.reward.love);
    const lv = campaign.addXp(r.reward.xp);
    hud.toast(r.toast, 6500);
    hud.toast(r.line, 6500);
    sfx.ding();
    if (lv && lv.gained.length) hud.toast(TEXT.levelUp(lv.level), 3000);
    campaign.save();
    storySync();
  }
  // ── the city's little events by the hour [experimental]: announced, a beam over the place, the band you can hear, a little reward once a day ──
  function eventDist(id) {
    if (drive) return Infinity;
    if (inside) return inside.id === id ? 0 : Infinity;
    const p = placePoint(id);
    return p ? Math.hypot(p.x - ctrl.state.x, p.z - ctrl.state.z) : Infinity;
  }
  function eventTick(dt) {
    if (!events || !campaign || over) return;
    const pr = campaign.state.progress;
    for (const m of events.update(dt, { day: campaign.day, hour: clock.hour, dist: eventDist })) {
      if (m.type === 'start') { hud.toast(m.ev.toast, 4200); sfx.pop(); continue; }
      const r = m.ev.reward;
      campaign.eco.earn(r.peaches, 'event');
      play.setPeaches(campaign.eco.peaches, r.peaches);
      if (r.love) campaign.addLove(r.love);
      campaign.bump('evCount');
      hud.toast(`${m.ev.enjoyed} +${r.peaches} peaches`, 4200);
      sfx.ding();
      const snap = events.snapshot();
      pr.evDay = snap.day;
      pr.evDone = Object.fromEntries(snap.done.map((id) => [id, true]));
      campaign.save();
    }
  }
  function eventFrame() {
    if (!events || !eventBeacon) return;
    const quiet = inside || over || paused || (fight && fight.active);
    if (party && t >= party.until) party = null;
    const band = activeAt(clock.hour).find((e) => e.music) || (party ? PARTY_EVENT : null);
    let lvl = 0;
    if (band && !quiet) { const p = placePoint(band.place); if (p) lvl = bandLevel(Math.hypot(p.x - ctrl.state.x, p.z - ctrl.state.z)); }
    sfx.band(lvl);
    const open = party ? PARTY_EVENT : events.open(clock.hour)[0];
    const p = open && !quiet ? placePoint(open.place) : null;
    if (p) eventBeacon.show(open, p.x, groundHeight(map, p.x, p.z), p.z, t, clock.hour >= 19.5 || clock.hour < 6 ? 1 : 0); else eventBeacon.hide();
  }
  // ── the first steps and "what now?" [experimental] ──
  const tourState = () => ({ moved: tour.moved, hellos: campaign.state.progress.hellos || 0, mapOpened: tour.mapOpened });
  function startTour() { tour.pending = false; tour.on = true; tour.moved = 0; tour.mapOpened = false; tour.doneT = 0; tour.x = null; guide.showTour(tourSteps(tourState())); }
  function endTour(remember) { tour.pending = false; tour.on = false; if (guide) guide.hideTour(); if (remember && campaign) { campaign.state.progress.tour = 1; campaign.save(); } }
  function replayTour() { if (!guide) return; campaign.state.progress.tour = 0; api.resume(); startTour(); }
  function tourTick(dt) {
    if (tour.pending && !intro && !over && !paused) startTour();
    if (!tour.on) return;
    const st = ctrl.state;
    if (!inside && !drive) { if (tour.x != null) tour.moved += Math.min(8, Math.hypot(st.x - tour.x, st.z - tour.z)); tour.x = st.x; tour.z = st.z; } else tour.x = null;
    if (mapUi && mapUi.isOpen) tour.mapOpened = true;
    const steps = tourSteps(tourState());
    guide.updateTour(steps);
    if (tourDone(steps)) { tour.doneT += dt; if (tour.doneT > 3.5) endTour(true); } else tour.doneT = 0;
  }
  function whatNowData() { const cg = currentGoal(campaign); const ti = cg && cg.place ? trackInfo(cg.place) : null; return whatNow({ goal: cg, placeName: ti ? ti.name : null, tracked }); }
  function guideToggle() {
    if (!guide || paused || over || trans || (social && social.isTalking) || (fight && (fight.active || fight.ui.menuOpen || fight.ui.cardOpen)) || (arcade && arcade.isOpen) || (journal && journal.isOpen) || (mapUi && mapUi.isOpen) || (play && (play.verbOpen || play.shopOpen))) return;
    if (guide.isOpen) guide.close(); else { guide.openNow(whatNowData()); sfx.tap(); }
  }
  // ── food for the next fight [experimental]: Mum's soup, Auntie's tea, the kiosk's gum, a Perach snack, Roee's espresso: one bite at a time, for the next fight of the day ──
  function takeFood(id) {
    const f = FOODS[id];
    if (!f || !campaign) return false;
    const pr = campaign.state.progress;
    if (pr.fed && pr.fed.id === id && pr.fed.day === campaign.day) { hud.toast(`He has had ${f.name} already. Go and fight!`, 2800); return true; }
    pr.fed = { id, day: campaign.day };
    hud.toast(`${f.name}: ${f.line} (${f.tag}, next fight)`, 4400);
    sfx.sip();
    campaign.save();
    return true;
  }
  const fedMenuLine = () => { const f = campaign ? fedFor(campaign.state.progress.fed, campaign.day) : null; return f ? `Fed: ${fedLine(f)}` : ''; };
  const START = { x: EXIT.x, z: EXIT.z }; // (the start line of the races: the flag on the map, the gate in the street)
  let startArmed = true; // (the board comes up once per visit to the start line)
  let startStill = 0; // (seconds he has been standing still at the line)
  const startNear = (r = 18) => !!campaign && !inside && !trans && !over && !track && Math.hypot(ctrl.state.x - START.x, ctrl.state.z - START.z) < r; // (the gate at the edge of town)
  // ── the Sababa Cup [experimental] (Shilo's idea): a car racing league; the board is in Uzi's workshop, a race is the lap round the neighbourhood against a rival of the ladder, in his own car ──
  const driverTop = () => (campaign ? topBonus(campaign.state.progress.driverXp || 0) : 1); // (a better driver, a slightly quicker car: used each time he gets in)
  function openLeague() {
    if (!league || league.isOpen || !campaign || over) return;
    const pr = campaign.state.progress;
    const cur = quests.open().find((tk) => leagueIdOf(tk.tplId) || eventIdOf(tk.tplId));
    league.open({ xp: pr.driverXp || 0, won: pr.leagueWon || {}, waiting: cur ? raceName(cur.tplId) : null, onDrop: () => { const c2 = quests.open().find((tk) => leagueIdOf(tk.tplId) || eventIdOf(tk.tplId)); if (c2) { quests.reply(c2.uid, 'no'); syncQuests(); hud.toast('The race is dropped: pick another when you like.', 2600); } }, onPick: (r) => (r.event ? startEvent(r.id) : startLeague(r.id)) });
  }
  function startLeague(id) {
    const r = rivalOf(id);
    if (!r || !campaign) return;
    const pr = campaign.state.progress;
    const row = leagueBoard(pr.driverXp || 0, pr.leagueWon || {}).find((x) => x.id === id);
    if (!row || !row.open) { hud.toast(row && row.why ? row.why : 'Not yet.', 2400); return; }
    const cur = quests.open().find((tk) => leagueIdOf(tk.tplId) || eventIdOf(tk.tplId));
    if (cur) { // a race is waiting already: the same one says so, another pick swaps it (nothing is lost)
      const m = missions.get(cur.uid);
      if (leagueIdOf(cur.tplId) === id || (m && m.committed)) { hud.toast(`${raceName(cur.tplId)} is waiting at the glowing ring (follow the beam).`, 3800); league.close(); return; }
      quests.reply(cur.uid, 'no');
      syncQuests();
    }
    const task = quests.inject(`league-${id}`);
    if (!task) return;
    following = task.uid;
    phone.setActive(task.uid);
    noFollow = false;
    league.close();
    hud.toast(`The Sababa Cup: ${r.name}. "${r.line}" Take the car to the glowing ring.`, 5600);
    sfx.ding();
  }
  /** A Sababa Cup race is over: what it pays (a rematch half) is put on the mission's result before the prize is paid. null for any other favour. */
  function leagueRaceResult(tplId, res) {
    if (!campaign || !res) return null;
    const pr = campaign.state.progress;
    const eid = eventIdOf(tplId);
    if (eid) { const er = eventResult(pr.driverXp || 0, eid, res.place); if (!er) return null; res.tip = er.prize; return { id: eid, r: er, event: true, board: res.board }; } // (a cup out of town: the place decides)
    const id = leagueIdOf(tplId);
    if (!id) return null;
    const r = leagueResult(pr.driverXp || 0, id, res.place === 1 ? 1 : 2, !!(pr.leagueWon || {})[id]);
    if (!r) return null;
    res.tip = r.prize;
    return { id, r };
  }
  function leagueDone({ id, r, event, board }) {
    const pr = campaign.state.progress;
    pr.driverXp = r.total;
    campaign.bump('leagueRaces');
    if (r.win) (pr.leagueWon ||= {})[id] = true;
    if (event) { hud.toast(`The Sababa Cup: ${placeLine(eventOf(id).name, r.place, r.field)} +${r.xp} driver XP`, 5200); if (board) setTimeout(() => hud.toast(board, 5600), 2600); }
    else { const who = rivalOf(id).name; hud.toast(r.win ? `The Sababa Cup: you beat ${who}! +${r.xp} driver XP` : `${who} wins this one. +${r.xp} driver XP, and a coffee.`, 4800); }
    if (r.up) hud.toast(`Driver level ${r.level}! The car feels a little quicker next time you get in.`, 5600);
    campaign.save();
  }
  // ── the cups out of town [experimental] (Shilo: "tracks that are not inside the city, and not only one against one"): a pick on the board drives him to a track far away, where a whole field races at once ──
  const raceName = (tplId) => { const lid = leagueIdOf(tplId); if (lid) return `The race against ${rivalOf(lid).name}`; const eid = eventIdOf(tplId); return eid ? `The ${eventOf(eid).name} race` : 'The race'; };
  function startEvent(id) {
    const e = eventOf(id);
    if (!e || !campaign || !trackWorld) return;
    const pr = campaign.state.progress;
    const row = eventBoard(pr.driverXp || 0, pr.leagueWon || {}).find((x) => x.id === id);
    if (!row || !row.open) { hud.toast(row && row.why ? row.why : 'Not yet.', 2400); return; }
    const cur = quests.open().find((tk) => leagueIdOf(tk.tplId) || eventIdOf(tk.tplId));
    if (cur) {
      const m = missions.get(cur.uid);
      if (eventIdOf(cur.tplId) === id || (m && m.committed)) { hud.toast(`${raceName(cur.tplId)} is waiting (follow the beam).`, 3600); league.close(); return; }
      quests.reply(cur.uid, 'no');
      syncQuests();
    }
    const task = quests.inject(`cup-${id}`);
    if (!task) return;
    following = task.uid;
    phone.setActive(task.uid);
    noFollow = false;
    league.close();
    hud.toast(`The Sababa Cup: ${e.name}. ${e.title}.`, 4200);
    sfx.ding();
    travelToTrack(e.track, e.rivals.length);
  }
  /** The Sababa Open: three fights in one night: the three strongest fighters he can face. */
  const openIds = () => LADDER.filter((f) => availability(f, campaign.state.boxer, campaign.state.love).open).slice(-3).map((f) => f.id);
  const openAvailable = () => !!campaign && openIds().length >= 3;
  function startOpen() {
    if (!campaign || !fight || fight.active || trans || over) return;
    const ids = openIds();
    if (ids.length < 3) { hud.toast('The Sababa Open needs three fighters you can face: climb the ladder at The Ring first.', 3800); return; }
    league.close();
    if (drive) exitCar();
    night = { ids, round: 0, hpFrac: 1 };
    hud.toast(`The Sababa Open: three fights in one night. First: ${fighter(ids[0]).name}!`, 3800);
    startFight(ids[0], { round: OPEN.labels[0] });
  }
  /** The drive out of town: a fade, the track world shown, his car on its place on the grid (the back row). */
  function travelToTrack(id, nR) {
    if (trans || over || !trackWorld) return;
    play.bigWord(TRACKS[id].name.toUpperCase(), 1700);
    startTrans(() => {
      if (inside) doLeave();
      if (!drive && ownCar) enterCar(ownCar);
      if (!drive || !veh) return;
      const slot = buildTrack(id).slot(nR);
      trackWorld.show(id);
      track = { id, since: 0 };
      hz = { list: buildTrack(id).hazards, down: new Set(), oil: 0 };
      veh.place(slot.x, slot.z, slot.h);
      ctrl.teleport(slot.x, slot.z, slot.h);
      ctrl.state.vx = 0; ctrl.state.vz = 0;
      rig.state.yaw = slot.h;
      groundY = 0;
      placeCamera(true);
      play.setMinimapVisible(false);
    }, 0.9);
  }
  /** Back to the start line in town (a fade). */
  function leaveTrack({ instant = false } = {}) {
    if (!track) return;
    const go = () => {
      if (!track) return;
      trackWorld.hide();
      track = null; hz = null;
      startArmed = false; // (the board does not pop up the moment he is back)
      if (drive && veh) { const x = START.x - 9; veh.place(x, START.z, -Math.PI / 2); ctrl.teleport(x, START.z, -Math.PI / 2); ctrl.state.vx = 0; ctrl.state.vz = 0; rig.state.yaw = -Math.PI / 2; }
      groundY = 0;
      placeCamera(true);
      play.setMinimapVisible(true);
    };
    if (instant) go(); else startTrans(go, 0.8);
  }
  /** Each frame at a track: when no cup is open any more (it is over) he is taken back after a few seconds. */
  function trackWatch() {
    if (!track || trans) return;
    if (quests.open().some((tk) => eventIdOf(tk.tplId))) { track.since = 0; return; }
    const now = performance.now();
    if (!track.since) track.since = now;
    else if (now - track.since > 3800) leaveTrack();
  }
  /** The other cars of the field: solid. Three circles each (like Ori's car); a bump pushes him back, takes speed from the one who comes from behind, and shoves the rival sideways (missions.js `shove`). */
  const CAR_OFFS = [-1.35, 0, 1.35];
  function trackCars(s, fm) {
    if (!fm || !fm.cars) return;
    const fx = Math.sin(s.heading); const fz = Math.cos(s.heading);
    for (const c of fm.cars()) {
      if (Math.abs(c.x - s.x) > 6 || Math.abs(c.z - s.z) > 6) continue;
      const cx = Math.sin(c.h); const cz = Math.cos(c.h);
      let best = null;
      for (const a of CAR_OFFS) for (const b of CAR_OFFS) {
        const dx = s.x + fx * a - (c.x + cx * b); const dz = s.z + fz * a - (c.z + cz * b);
        const dd = Math.hypot(dx, dz);
        const pen = 2.0 - dd;
        if (pen > 0 && (!best || pen > best.pen)) best = { pen, nx: dd > 1e-3 ? dx / dd : -cx, nz: dd > 1e-3 ? dz / dd : -cz };
      }
      if (!best) continue;
      const { nx, nz, pen } = best; // (n: from the rival to Ori)
      s.x += nx * pen * 0.6; s.z += nz * pen * 0.6;
      const closing = -((s.vx - cx * c.v) * nx + (s.vz - cz * c.v) * nz); // > 0: they are coming together
      if (closing > 0) {
        s.speed = Math.max(-3, s.speed + (nx * fx + nz * fz) * closing * 0.6);
        s.hit = Math.max(s.hit, Math.min(6, closing * 0.7));
      }
      fm.shove(c.i, nx, nz, pen, Math.max(0, closing), (s.x - c.x) * cx + (s.z - c.z) * cz < 0);
    }
  }
  /** The obstacles on the road: a cone is knocked over (a little slower), a barrel is knocked away (slower), a stack of tyres is solid, oil takes the grip away for a moment. */
  function trackHazards(s, dts) {
    if (!hz) return;
    hz.oil = Math.max(0, hz.oil - dts);
    const fx = Math.sin(s.heading); const fz = Math.cos(s.heading);
    for (const o of hz.list) {
      if (hz.down.has(o.i) || Math.abs(o.x - s.x) > 7 || Math.abs(o.z - s.z) > 7) continue;
      let dmin = 99; let dx = 0; let dz = 1;
      for (const a of CAR_OFFS) { const ex = s.x + fx * a - o.x; const ez = s.z + fz * a - o.z; const dd = Math.hypot(ex, ez); if (dd < dmin) { dmin = dd; dx = ex; dz = ez; } }
      if (o.kind === 'oil') {
        if (dmin < o.r) { if (hz.oil <= 0) { s.heading += (o.i % 2 ? 1 : -1) * 0.22 * Math.min(1, Math.abs(s.speed) / 20); hud.toast('Oil! The tyres let go for a second.', 1400); } hz.oil = 1.2; }
        continue;
      }
      const reach = o.r + 1.0;
      if (dmin >= reach) continue;
      if (o.kind === 'tyres') { // solid: pushed out, most of the speed gone
        const k = dmin > 1e-3 ? 1 / dmin : 0;
        s.x += (dx * k || 0) * (reach - dmin); s.z += (dz * k || 1) * (reach - dmin);
        s.hit = Math.max(s.hit, Math.min(6, Math.abs(s.speed) * 0.35));
        s.speed *= 0.55;
        continue;
      }
      hz.down.add(o.i); // a cone or a barrel: knocked over
      trackWorld.knock(o.i, fx, fz);
      s.speed *= o.kind === 'cone' ? 0.95 : 0.8;
      s.hit = Math.max(s.hit, o.kind === 'cone' ? 1.2 : 3.4);
    }
  }
  /** Grip in a turn: a car cannot go round a tight bend at full speed (the faster and the sharper, the more it loses), so a driver brakes before it. The tyres from the garage hold more. */
  function trackScrub(s, pk, dts) {
    const lat = Math.abs(s.yawRate * s.speed); // the sideways pull of the turn (m/s²)
    const cap = 32 * (veh.baseGrip / 2.6) * (1 - pk.rainGrip * weatherNow.wet);
    if (lat > cap && Math.abs(s.speed) > 8) s.speed -= Math.sign(s.speed) * Math.min(Math.abs(s.speed) * 0.5, (lat - cap) * 0.3) * dts;
  }
  /** The barrier: the car cannot leave the road out of town (it is pushed back and loses speed). */
  function trackWall(s) {
    const T = buildTrack(track.id);
    const q = T.nearest(s.x, s.z);
    const lim = T.width / 2 + 1.1;
    if (q.dist <= lim) return;
    s.x = q.px + q.nx * lim; s.z = q.pz + q.nz * lim;
    const vo = s.vx * q.nx + s.vz * q.nz;
    if (vo > 0) { s.vx -= q.nx * vo * 1.4; s.vz -= q.nz * vo * 1.4; s.hit = Math.max(s.hit || 0, Math.min(1, vo / 14)); }
    s.speed *= 0.93;
  }
  // ── the street cats [experimental]: Space next to one pets it: a purr, a heart, a little love; the third pet makes it his friend ──
  const catSince = {}; // cat id -> the time (t) of its last pet
  const catList = () => (life ? life.cats.map((c) => ({ id: c.m.name.replace('cat-', ''), x: c.m.position.x, z: c.m.position.z, y: c.m.position.y })) : []);
  const catNear = () => {
    if (!campaign || inside || drive || trans) return null;
    const c = nearestCat(ctrl.state, catList());
    // a favour waiting at the door he stands at comes first (the kiosk cat sits next to the kiosk door: Space starts the favour, the cat can wait; G still goes inside)
    if (c && nearest && quests && Math.hypot(nearest.door.x - ctrl.state.x, nearest.door.z - ctrl.state.z) <= USE_RANGE && quests.open().some((tk) => stagePlace(tk) === nearest.id)) return null;
    return c;
  };
  function petCat() {
    const hit = catNear();
    if (!hit) return false;
    const cats = (campaign.state.progress.cats ||= {});
    const r = catPet(cats[hit.id] || 0, catSince[hit.id] == null ? null : t - catSince[hit.id]);
    const c = catList().find((x) => x.id === hit.id);
    if (!r.counted) { hud.toast(`${catName(hit.id)} is still purring.`, 1800); return true; }
    catSince[hit.id] = t;
    cats[hit.id] = r.pets;
    if (r.love) campaign.addLove(r.love);
    sfx.purr();
    if (bubbles && c) bubbles.heart(() => ({ x: c.x, y: c.y + 0.8, z: c.z })); // (a heart follows a function that says where, like the hello's)
    if (r.friend) {
      campaign.eco.earn(CAT_PEACHES, 'cat');
      play.setPeaches(campaign.eco.peaches, CAT_PEACHES);
      hud.toast(`${catName(hit.id)} is your friend now! +${CAT_PEACHES} peaches`, 4200);
      sfx.ding();
    } else hud.toast(r.pets === 1 ? 'A purr. A very small, very serious purr.' : 'Purr purr.', 2200);
    campaign.save();
    return true;
  }
  // ── gifts from the neighbours [experimental]: somebody he keeps greeting (on enough days) hands him something small ──
  function giftCheck(id) {
    if (!campaign) return;
    const pr = campaign.state.progress;
    noteHello(pr, id, campaign.day);
    const g = giftDue(pr, id);
    if (!g) return;
    (pr.gifts ||= {})[id] = true;
    campaign.addLove(GIFT_LOVE);
    hud.toast(`${g.who} gave you a gift: ${g.name}. "${g.line}"`, 5600);
    sfx.ding();
    if (ori) ori.play('cheer');
    campaign.save();
  }
  // ── photo mode [experimental]: V puts the HUD away, Space takes a polaroid (a PNG download), Esc / V come back; walking and the camera still work ──
  function photoFree() {
    return !!photoUi && !!campaign && !paused && !over && !trans && !(social && social.isTalking) && !(fight && (fight.active || fight.ui.menuOpen || fight.ui.cardOpen)) && !(arcade && arcade.isOpen) && !(coffee && coffee.isOpen) && !(league && league.isOpen) && !(journal && journal.isOpen) && !(mapUi && mapUi.isOpen) && !(guide && guide.isOpen) && !(play && (play.verbOpen || play.shopOpen));
  }
  function photoToggle() {
    if (!photoUi) return;
    if (photoUi.isOn) { photoUi.close(); sfx.tap(); return; }
    if (photoFree()) { photoUi.open(); sfx.tap(); }
  }
  function shoot() {
    if (!photoUi || !photoUi.isOn || !campaign) return;
    api.render(0); // a fresh frame: the canvas is read in the same breath
    const pr = campaign.state.progress;
    const pid = inside ? inside.id : nearPlace ? nearPlace.id : null;
    const place = inside ? map.places[inside.id].name : nearPlace ? nearPlace.name : null;
    photoUi.take({ place, day: campaign.day, label: clock.label() });
    pr.photos = (pr.photos || 0) + 1;
    (pr.photoPlaces ||= {})[placeKey(pid)] = true;
    sfx.pop();
    campaign.save();
  }
  // ── the stamp book [experimental]: a stamp for every place - the rooms at the door, the open places when he walks up to them; a full book pays a little ──
  function stamp(id) {
    if (!campaign || !PLACES[id]) return;
    const pr = campaign.state.progress;
    if (stampsGot(pr)[id]) return;
    (pr.stamps ||= {})[id] = true;
    const n = stampCount(pr);
    hud.toast(`Stamp: ${PLACES[id].name} (${n} / ${STAMPS.length})`, 3200);
    sfx.pop();
    if (n === STAMPS.length) {
      campaign.eco.earn(STAMP_REWARD.peaches, 'stamps');
      play.setPeaches(campaign.eco.peaches, STAMP_REWARD.peaches);
      campaign.addLove(STAMP_REWARD.love);
      hud.toast(`The stamp book is full! +${STAMP_REWARD.peaches} peaches`, 5000);
      sfx.ding();
    }
    campaign.save();
  }
  function stampTick() {
    if (!campaign || over || inside) return;
    const have = stampsGot(campaign.state.progress);
    if (STAMPS.every((id) => have[id])) return;
    for (const id of newOpenStamps({ x: ctrl.state.x, z: ctrl.state.z, points: { busstop: placePoint('busstop'), court: placePoint('court') }, park: map.zones.park || null }, have)) stamp(id);
  }
  // ── the daily wishes [experimental]: three small ones every morning, measured against what the game already counts; a done wish pays and earns a sticker, all three pay a bonus ──
  const wishNow = () => wishMetrics({ p: campaign.state.progress, b: campaign.state.boxer });
  function wishSync() {
    if (!campaign) return;
    const pr = campaign.state.progress;
    const w = pr.wish;
    if (w && w.day === campaign.day && w.list && w.list.length === 3) return;
    if (w && w.day > 0 && w.list && w.list.length) pr.wishLog = [...(pr.wishLog || []), wishCloseDay(w)].slice(-WISH_LOG_DAYS);
    pr.wish = wishNewDay({ seed: campaign.state.seed, day: campaign.day, metrics: wishNow(), prev: w });
    campaign.save();
  }
  function wishTick() {
    if (!campaign || over) return;
    const pr = campaign.state.progress;
    if (!pr.wish || !pr.wish.list || !pr.wish.list.length) return;
    const tips = (pr.tips ||= {});
    if (!tips.wishes && ((pr.hellos || 0) >= 5 || campaign.day >= 2)) { tips.wishes = true; hud.toast('Ori has three small wishes every day. They are in the journal.', 4600); }
    const s = wishSettle(pr.wish, wishNow(), clock.hour);
    if (!s.newly.length && !s.full) return;
    for (const r of s.newly) {
      pr.wish.done[r.id] = true;
      pr.wishDone = (pr.wishDone || 0) + 1;
      campaign.eco.earn(r.reward, 'wish');
      play.setPeaches(campaign.eco.peaches, r.reward);
      hud.toast(`Wish done: ${r.text}. +${r.reward} peaches`, 4200);
    }
    if (s.full) {
      pr.wish.bonus = true;
      pr.wishDays = (pr.wishDays || 0) + 1;
      campaign.eco.earn(WISH_BONUS.peaches, 'wish');
      play.setPeaches(campaign.eco.peaches, WISH_BONUS.peaches);
      campaign.addLove(WISH_BONUS.love);
      hud.toast(`All three wishes today! +${WISH_BONUS.peaches} peaches. What a day.`, 5200);
    }
    sfx.ding();
    campaign.save();
  }
  /** The achievements [experimental]: what the counters say now (the earned ones stay on the save). */
  function trophyCtx() { return { p: campaign.state.progress, b: campaign.state.boxer, love: campaign.state.love, day: campaign.day, golden: campaign.state.golden.length, lifetime: campaign.eco.state.lifetime }; }
  function trophyTick() {
    if (!campaign) return;
    const have = (campaign.state.progress.trophies ||= []);
    const fresh = newTrophies(trophyCtx(), have);
    if (!fresh.length) return;
    for (const t of fresh) have.push(t.id);
    if (fresh.length > 2) hud.toast(TEXT.trophies(fresh.length), 3600); else for (const t of fresh) hud.toast(TEXT.trophy(t.name), 3600);
    sfx.ding();
    campaign.save();
  }
  function goalTick() {
    if (!campaign) return;
    // he has seen the ring (the goal 'Find The Ring'); and a place he followed from the big map is reached
    if (fight && !inside && !drive && fight.near(ctrl.state.x, ctrl.state.z, 10) && !campaign.state.progress.ringSeen) campaign.bump('ringSeen');
    if (tracked && !inside && !drive) { const ti = trackInfo(tracked); const pt = ti ? placePoint(tracked) : null; if (!ti) tracked = null; else if (Math.hypot(pt.x - ctrl.state.x, pt.z - ctrl.state.z) < (tracked === 'court' ? 9 : 7)) { hud.toast(`You are at ${ti.name}`, 2200); tracked = null; } }
    for (const g of checkGoals(campaign)) {
      const r = g.reward;
      if (r.peaches) { campaign.eco.earn(r.peaches, 'goal'); play.setPeaches(campaign.eco.peaches, r.peaches); }
      if (r.love) campaign.addLove(r.love);
      const lv = r.xp ? campaign.addXp(r.xp) : null;
      hud.toast(TEXT.goalDone(g.title), 3400);
      sfx.ding();
      if (lv && lv.gained.length) hud.toast(TEXT.levelUp(lv.level), 3000);
      campaign.save();
    }
  }
  const initialOf = (name) => name.replace(/^(The|A|Little)\s+/i, '').charAt(0).toUpperCase();
  function ladderRows() {
    const b = campaign.state.boxer;
    const love = campaign.state.love;
    const next = nextFight(b, love);
    return FIGHTERS.filter((f) => !f.hidden || b.reveal || b.beaten.includes(f.id)).map((f) => {
      const av = availability(f, b, love);
      const secret = f.hidden && !b.beaten.includes(f.id);
      return { id: f.id, name: secret ? '???' : f.name, title: secret ? 'Somebody is waiting in the ring...' : f.title, color: CAST[f.cast].color, initial: secret ? '?' : initialOf(f.name), open: av.open, beaten: b.beaten.includes(f.id), next: !!next && next.id === f.id, why: av.why, hidden: !!f.hidden };
    });
  }
  // ── the map: the stars (ring, office, garage, cafe), the names, the place he follows ──
  /** Where a place is on the map: the ring's middle for the court, the park's middle for the park, the door for the rest. */
  function placePoint(id) {
    if (id === 'car') return ownCar ? { x: ownCar.x, z: ownCar.z } : ctrl.state;
    if (id === 'cup') return START;
    if (id === 'court' && fight) return fight.center;
    if (id === 'park' && map.zones.park) { const z = map.zones.park; return { x: (z.x0 + z.x1) / 2, z: (z.z0 + z.z1) / 2 }; }
    return map.places[id].door;
  }
  /** What the map says is where: the stars, and his car while it is parked. */
  function landmarkList(big) {
    const out = LANDMARKS.map((l) => { const p = placePoint(l.place); return { place: l.place, x: p.x, z: p.z, icon: l.icon, color: l.color, short: l.short, big: big || l.place === 'court', pulse: l.place === 'court' }; });
    out.push({ place: 'cup', x: EXIT.x, z: EXIT.z, icon: CUP.icon, color: CUP.color, short: CUP.short, big: !!big }); // (the flag at the start line of the races; a click on it leads there)
    for (const ev of (events ? events.open(clock.hour) : [])) { const p = placePoint(ev.place); if (p) out.push({ place: `${ev.place}:event`, x: p.x + 7, z: p.z - 7, icon: 'event', color: ev.color, short: ev.short, big: true, pulse: true }); }
    if (party) { const p = placePoint(PARTY_EVENT.place); out.push({ place: 'park:party', x: p.x + 7, z: p.z - 7, icon: 'event', color: PARTY_EVENT.color, short: PARTY_EVENT.short, big: true, pulse: true }); }
    if (ownCar && !drive) out.push({ place: 'car', x: ownCar.x, z: ownCar.z, icon: CAR.icon, color: CAR.color, short: CAR.short, big: false });
    return out;
  }
  /** A place he can follow: a place of the map, or his car. */
  function trackInfo(id) {
    if (!id) return null;
    if (id === 'car') return ownCar ? { name: CAR.name, sign: 'ORI CAR', door: { x: ownCar.x, z: ownCar.z, nx: 0, nz: 0 } } : null;
    if (id === 'cup') return { name: CUP.name, sign: 'RACES', door: { x: START.x, z: START.z, nx: 0, nz: 0 } };
    return map.places[id] || null;
  }
  function mapView() {
    const st = ctrl.state;
    const me = inside ? map.places[inside.id].door : st;
    const cg = currentGoal(campaign);
    const gid = tracked || (cg && cg.place) || null;
    const stars = new Set(LANDMARKS.map((l) => l.place));
    const labels = Object.keys(PLACES).filter((id) => !stars.has(id)).map((id) => { const p = placePoint(id); return { id, x: p.x, z: p.z, text: PLACES[id].name, size: 10, dy: -12 }; });
    return { player: { x: me.x, z: me.z, heading: st.heading }, goal: gid ? placePoint(gid) : null, tracked, landmarks: landmarkList(true), labels, time: t, stamps: stampsGot(campaign.state.progress) };
  }
  function journalData() {
    const b = campaign.state.boxer;
    const cur = currentGoal(campaign);
    return {
      day: campaign.day, clock: clock.label(), love: campaign.state.love, boxer: { level: b.level, xp: b.xp, need: xpToNext(b.level), wins: b.wins },
      moves: MOVE_LIST.map((m) => ({ ...m, open: m.lv <= b.level })), ladder: ladderRows(), goals: goalList(campaign).map((x) => ({ ...x, current: !!cur && cur.id === x.id })),
      peaches: campaign.eco.peaches, golden: campaign.state.golden.length,
      career: careerStats({ boxer: b, progress: campaign.state.progress, day: campaign.day, golden: campaign.state.golden.length, lifetime: campaign.eco.state.lifetime }),
      trophies: trophyList(trophyCtx(), campaign.state.progress.trophies || []),
      fed: fedMenuLine(),
      driver: levelOfDriver(campaign.state.progress.driverXp || 0),
      gifts: { list: giftCollection(campaign.state.progress), count: giftCount(campaign.state.progress), total: GIFT_IDS.length },
      stamps: { list: stampBook(campaign.state.progress), count: stampCount(campaign.state.progress), total: STAMPS.length },
      wishes: { rows: wishRows(campaign.state.progress.wish || {}, wishNow(), clock.hour), log: campaign.state.progress.wishLog || [], total: campaign.state.progress.wishDone || 0, fullDays: campaign.state.progress.wishDays || 0, bonus: WISH_BONUS.peaches },
    };
  }
  function openFightMenu() {
    if (!fight || fight.active || fight.ui.menuOpen || drive || inside || trans || over) return false;
    const b = campaign.state.boxer;
    fight.ui.showMenu({ rows: [...ladderRows(), { id: 'open', name: OPEN.name, title: OPEN.title, color: OPEN.color, initial: 'O', open: openAvailable(), why: 'Beat more fighters first', beaten: false, next: false, hidden: false }], level: b.level, xp: b.xp, xpNeed: xpToNext(b.level), love: campaign.state.love, fed: fedMenuLine(), onPick: (r) => (r.id === 'open' ? startOpen() : startFight(r.id)), onClose: () => {}, onTrain: () => startTraining() });
    sfx.tap();
    return true;
  }
  function startFight(id, { hpFrac = 1, round } = {}) {
    const def = fighter(id);
    if (!def || !fight || fight.active) return false;
    if (social) social.closeTalk();
    if (bubbles) bubbles.clear();
    if (journal.isOpen) journal.close();
    if (mapUi && mapUi.isOpen) mapUi.close();
    const food = fedFor(campaign.state.progress.fed, campaign.day);
    const started = fight.start(def, { level: campaign.state.boxer.level, seed: campaign.day * 31 + campaign.state.boxer.fights + 1, tips: (campaign.state.progress.tips ||= {}), buff: food, hpFrac, round });
    if (started && food) { campaign.state.progress.fed = null; hud.toast(`${food.name} kicks in: ${food.tag}`, 3600); campaign.save(); } // (a bite lasts for one fight)
    if (started) sfx.music(false); // (the ring has its own music; the street's loop comes back in afterFight)
    return started;
  }
  /** The speed bag in the corner of the ring (a 20-second drill, fight3d.js / training.js). */
  function startTraining() {
    if (!fight || fight.active) return false;
    if (social) social.closeTalk();
    if (bubbles) bubbles.clear();
    if (journal.isOpen) journal.close();
    if (mapUi && mapUi.isOpen) mapUi.close();
    const started = fight.startTraining({ tips: (campaign.state.progress.tips ||= {}) });
    if (started) sfx.music(false);
    return started;
  }
  /** The drill is over: a little XP (less each time on the same day), the card, and a warm word from Coach. */
  function onTrainResult(res) {
    const b = campaign.state.boxer;
    const p = campaign.state.progress;
    const tr = p.train && p.train.day === campaign.day ? p.train : (p.train = { day: campaign.day, n: 0 });
    const xp = xpFor(res, { today: tr.n });
    tr.n++;
    const xp0 = b.xp; const lv0 = b.level;
    const gain = campaign.addXp(xp);
    campaign.save();
    fight.ui.showResult({
      won: true, how: TEXT.bagCaption, title: `${'★'.repeat(res.stars)}${'☆'.repeat(3 - res.stars)} ${TEXT.bagStars(res.stars)}`, line: `${TEXT.bagLine(res.stars)}${res.maxCombo > 1 ? ` · ${TEXT.bagBest(res.maxCombo)}` : ''}`,
      xpGain: xp, level: b.level, levelFrom: lv0, xp: b.xp, xpFrom: xp0, peaches: 0, love: 0, moves: gain.moves, next: TEXT.bagLadder, retry: TEXT.bagAgain,
    }, {
      onLeave: () => { afterLeave = null; fight.leave(); },
      onAgain: () => { afterLeave = () => openFightMenu(); fight.leave(); },
      onRetry: () => { afterLeave = () => startTraining(); fight.leave(); },
    });
    if (gain.gained.length) sfx.ding();
  }
  /** The bout is over (the card after the fight): the XP, the peaches, the love, the new moves; the champion falls and somebody else steps up. */
  function onFightResult(res, opp) {
    const b = campaign.state.boxer;
    const won = res.winner === 'player';
    const first = won && !b.beaten.includes(opp.id);
    b.fights++;
    tallyFight(campaign.state.progress, res);
    let xp; let peaches; let love;
    if (won) {
      b.wins++;
      xp = Math.round(opp.reward.xp * (first ? 1 : 0.35) * (res.how === 'ko' ? 1 : 0.8));
      peaches = Math.round(opp.reward.peaches * (first ? 1 : 0.4));
      love = first ? opp.reward.love : 1;
      if (first) b.beaten.push(opp.id);
      if (first && opp.id === 'coach') b.reveal = true;
    } else { xp = 14; peaches = 0; love = 0; }
    xp += res.stats.perfect * 3 + res.stats.parry * 2;
    const xp0 = b.xp; const lv0 = b.level;
    const gain = campaign.addXp(xp);
    if (peaches) { campaign.eco.earn(peaches, 'fight'); play.setPeaches(campaign.eco.peaches, peaches); }
    if (love) campaign.addLove(love);
    campaign.save();
    fight.setCrowd(campaign.state.love);
    goalTick();
    const bossNext = won && first && opp.id === 'coach';
    const draw = res.winner === 'draw';
    let cont = null; // the Sababa Open: the next fight of the night
    if (night) {
      if (won && night.round < night.ids.length - 1) { const bt = fight.bout; night.round++; night.hpFrac = Math.min(1, (bt ? bt.P.hp / bt.P.maxHp : 0.5) + OPEN.heal); cont = { id: night.ids[night.round], hpFrac: night.hpFrac, round: OPEN.labels[night.round] }; }
      else {
        if (won) { campaign.eco.earn(OPEN.purse.peaches, 'fight'); play.setPeaches(campaign.eco.peaches, OPEN.purse.peaches); campaign.addXp(OPEN.purse.xp); campaign.bump('openWins'); hud.toast(`You won the Sababa Open! +${OPEN.purse.peaches} peaches`, 5600); sfx.ding(); }
        night = null;
      }
    }
    fight.ui.showResult({
      won, how: res.how === 'ko' ? 'KNOCK-OUT' : 'ON POINTS', title: won ? (res.how === 'ko' ? 'K.O.! You win!' : 'You win!') : draw ? 'A draw!' : 'Good fight!',
      line: `${opp.name}: ${won ? opp.win : opp.lose}`, xpGain: xp, level: b.level, levelFrom: lv0, xp: b.xp, xpFrom: xp0, peaches, love: Math.round(love * 10) / 10, moves: gain.moves,
      next: cont ? `Next: ${fighter(cont.id).name}` : bossNext ? 'The lights go out...' : won ? 'Back to the ladder' : 'Try again',
    }, {
      onLeave: () => { night = null; afterLeave = null; fight.leave(); },
      onAgain: () => { afterLeave = cont ? () => startFight(cont.id, { hpFrac: cont.hpFrac, round: cont.round }) : bossNext ? () => startFight('shilo') : won ? () => openFightMenu() : () => startFight(opp.id); fight.leave(); },
    });
    if (gain.gained.length) sfx.ding();
  }
  /** Back on the street, at the foot of the steps of the ring. */
  function afterFight() {
    if (!paused) sfx.music(true); // (back on the street: its loop again)
    const a = fight.apron();
    ctrl.teleport(a.x, a.z, a.heading);
    rig.state.yaw = a.heading;
    groundY = groundHeight(map, a.x, a.z);
    placeCamera(true);
    findPlaces();
    const f = afterLeave;
    afterLeave = null;
    if (f) setTimeout(f, 160);
  }

  /** The computer in the office: games inside the game. A run pays peaches by its score; the first one is a goal. */
  /** The cafe job: Space at the order pad in Roee's cafe. The lunch rush (12-14) pays more. */
  function openCoffee() {
    if (!coffee || coffee.isOpen || (arcade && arcade.isOpen) || play.shopOpen || play.verbOpen) return;
    const lunch = activeAt(clock.hour).some((e) => e.id === 'lunch');
    coffee.open({
      lunch,
      done: (r) => {
        const p = campaign.state.progress;
        campaign.bump('cafeRuns');
        p.cafeServed = (p.cafeServed || 0) + r.served;
        p.cafeBestServed = Math.max(p.cafeBestServed || 0, r.served);
        p.cafeBest = Math.max(p.cafeBest || 0, r.score);
        campaign.eco.earn(r.peaches, 'cafe');
        play.setPeaches(campaign.eco.peaches, r.peaches);
        hud.toast(`${r.served} customers served: +${r.peaches} peaches`, 3200);
        campaign.save();
        goalTick();
      },
    });
  }
  function openArcade() {
    if (!arcade || arcade.isOpen || play.shopOpen || play.verbOpen) return;
    const best = campaign.state.progress.best || {};
    arcade.open({
      done: (r) => {
        const p = campaign.state.progress;
        p.best = { ...(p.best || {}), [r.game]: Math.max((p.best && p.best[r.game]) || 0, r.score) };
        campaign.bump('arcade');
        campaign.eco.earn(r.peaches, 'arcade');
        play.setPeaches(campaign.eco.peaches, r.peaches);
        hud.toast(`${r.score} points: +${r.peaches} peaches`, 3000);
        sfx.ding();
        campaign.save();
        goalTick();
      },
      close: () => {},
    }, best);
  }
  function openGarage() { if (play.shopOpen || play.verbOpen) return; play.openShop(campaign.eco, () => { campaign.save(); play.setPeaches(campaign.eco.peaches); }); }
  /** Every frame: the followed mission (and any with something in hand) sees the world. */
  function runMissions(dt) {
    if (over || !quests) return;
    const ctx = missionCtx(dt);
    frameBump = 0;
    for (const [uid, m] of missions) {
      const task = quests.get(uid);
      if (!task || (task.state !== 'new' && task.state !== 'accepted')) { missions.delete(uid); continue; }
      if ((uid !== following && !m.committed) || play.verbOpen) continue;
      if (inside && m.kind !== 'verb' && m.kind !== 'gauntlet') continue; // (a delivery cannot be handed over from inside a flat)
      m.update(ctx);
      handleMission(uid, m, task);
    }
    if (hail) {
      hail.m.update(ctx);
      handleMission('hail', hail.m, { title: 'A fare', giverName: 'A passenger' });
      if (hail && !hail.m.committed) { hail.ttl -= dt; if (hail.ttl <= 0) endHail(false); }
    } else if (drive && !inside && drive.p.mine && !play.verbOpen && ![...missions.values()].some((m) => m.committed)) {
      hailIn -= dt;
      if (hailIn <= 0) { hailIn = 100 + hailRnd() * 90; startHail(); }
    }
  }
  function startHail() {
    const spec = makeHail(hailRnd, { places: map.places }, { x: veh.state.x, z: veh.state.z });
    hail = { m: createMission(spec, missionEnv(900 + Math.floor(hailRnd() * 99))), ttl: 90 };
    hud.toast(TEXT.hailSeen, 3600);
    sfx.buzz();
  }
  function endHail(done, e) {
    if (done && e) {
      const tip = Math.round(ECON.hailTip * (0.6 + 0.4 * e.quality) + (e.tip || 0));
      campaign.eco.earn(tip, 'tip');
      play.setPeaches(campaign.eco.peaches, tip);
      hud.float(TEXT.peachesEarned(tip));
      sfx.ding();
    } else hud.toast(TEXT.hailLost, 2200);
    hail = null;
  }
  /** The golden peaches: they hum when near, and are picked up by walking (or driving) through them. */
  function stepGolden(dt) {
    void dt;
    if (!mworld || inside) return;
    const pl = drive ? { x: veh.state.x, z: veh.state.z } : { x: ctrl.state.x, z: ctrl.state.z };
    const r = mworld.goldens(campaign.state.golden, t, pl);
    if (r.index < 0) return;
    if (r.dist < (drive ? 3.6 : 2.4)) {
      if (campaign.pickGolden(r.index)) {
        campaign.eco.earn(ECON.golden, 'golden');
        campaign.save();
        play.setPeaches(campaign.eco.peaches, ECON.golden);
        hud.toast(TEXT.goldenFound(campaign.state.golden.length), 2600);
        hud.float(TEXT.peachesEarned(ECON.golden));
        sfx.ding();
        sfx.pop();
        goldenNear = -1;
      }
    } else if (r.dist < 16 && goldenNear !== r.index) { goldenNear = r.index; hud.toast(TEXT.goldenNear, 2200); sfx.blip(PING_VOICE, 1200); } else if (r.dist > 34) goldenNear = -1;
  }

  // ── inside the buildings (T62): a quick fade at the door, the street is hidden, the room is built, the camera looks down into it ──
  const SKY_GLASS = new THREE.Color();
  function setFade(a) { if (fadeEl) fadeEl.style.opacity = String(a); }
  function startTrans(fn, dur = 0.26) { trans = { t: 0, dur, phase: 'out', fn }; }
  function enterPlace(pid, { instant = false } = {}) {
    if (inside || trans || drive || over || !ROOMS[pid] || !interiors) return false;
    if (instant) { doEnter(pid); return true; }
    startTrans(() => doEnter(pid));
    sfx.tap();
    return true;
  }
  function leavePlace({ instant = false } = {}) {
    if (!inside || trans) return false;
    if (instant) { doLeave(); return true; }
    startTrans(() => doLeave());
    sfx.tap();
    return true;
  }
  function doEnter(pid) {
    if (social) social.closeTalk();
    if (coffee && coffee.isOpen) coffee.close(); // (a card left open would keep the keyboard)
    if (league && league.isOpen) league.close();
    const hidden = [];
    for (const c of scene.children) { if (c.isLight || c === sky.mesh || c === ori.group || !c.visible) continue; c.visible = false; hidden.push(c); }
    stamp(pid); // (before `seen` below: a room he went into before the book existed is already stamped, quietly)
    (campaign.state.progress.seen ||= {})[pid] = true; // (the places he has been inside)
    { const wp = campaign.state.progress.wish; if (wp && wp.places) wp.places[pid] = true; } // (and the day's wish to go into some places)
    const info = interiors.enter(pid);
    const colliders = collidersOf(pid);
    for (const c of colliders) map.world.addDynamic(c);
    inside = { id: pid, info, colliders, hidden, saved: { dist: rig.state.dist, pitch: rig.state.pitch, yaw: rig.state.yaw }, t: 0, spot: null };
    ctrl.teleport(info.spawn.x, info.spawn.z, info.spawn.heading);
    ctrl.state.vx = 0; ctrl.state.vz = 0;
    rig.state.yaw = info.spawn.heading;
    rig.state.pitch = 0.9;
    rig.state.dist = 5 + 0.26 * Math.max(ROOMS[pid].w, ROOMS[pid].d);
    rig.state.fovAdd = 14;
    groundY = 0;
    if (social) social.setInside(info.npcs.map((n) => ({ id: n.id, name: n.name, x: n.x, z: n.z })));
    sfx.room(info.hum);
    applySky(true);
    placeCamera(true);
  }
  function doLeave() {
    const rec = inside;
    inside = null;
    if (coffee && coffee.isOpen) coffee.close();
    if (league && league.isOpen) league.close();
    if (social) { social.closeTalk(); social.setInside(null); }
    for (const c of rec.colliders) map.world.removeDynamic(c);
    interiors.leave();
    for (const c of rec.hidden) c.visible = true;
    const d = map.places[rec.id].door;
    ctrl.teleport(d.x + d.nx * 1.3, d.z + d.nz * 1.3, Math.atan2(d.nx, d.nz));
    rig.state.yaw = Math.atan2(d.nx, d.nz);
    rig.state.pitch = rec.saved.pitch;
    rig.state.dist = rec.saved.dist;
    rig.state.fovAdd = 0;
    groundY = groundHeight(map, ctrl.state.x, ctrl.state.z);
    sfx.room(null);
    fill.distance = 13;
    fill.color.setHex(0xffd2a0);
    applySky(true);
    findPlaces();
    placeCamera(true);
  }
  const EXIT_NEAR = 1.7;
  /** What Space would do inside right now: the nearest prop / person in reach, or the door. */
  function insideSpot() {
    if (!inside) return null;
    const st = ctrl.state;
    let best = null;
    let bd = Infinity;
    for (const sp of inside.info.spots) {
      const d = Math.hypot(sp.x - st.x, sp.z - st.z);
      if (d <= sp.reach && d < bd) { bd = d; best = sp; }
    }
    const ex = inside.info.exit;
    const de = Math.hypot(ex.x - st.x, ex.z - st.z);
    if (de < EXIT_NEAR && (!best || de < bd - 0.6)) return { kind: 'exit' };
    return best;
  }
  function spotLabel(sp) {
    const task = quests.open().some((t) => stagePlace(t) === inside.id);
    if (sp.kind === 'exit') return ['G', 'Leave'];
    if (inside.id === 'workshop' && sp.who === 'uzi' && !task) return ['Space', TEXT.garageTitle];
    if (sp.use === 'arcade') return ['Space', 'Play on the computer'];
    if (sp.use === 'coffeejob') return ['Space', 'Help Roee: Coffee Rush'];
    if (sp.use === 'parcel') return ['Space', parcel ? 'You have a parcel already' : 'Take a parcel (a delivery run)'];
    if (sp.use === 'league') return ['Space', 'The Sababa Cup: pick a race'];
    if (sp.kind === 'person') return ['Space', task && sp.work ? 'Do the favour' : 'Say hello'];
    if (sp.use === 'coffee') return ['Space', 'Get a coffee'];
    if (sp.use === 'number') return ['Space', 'Take a number'];
    if (sp.use === 'sit') return ['Space', 'Sit down'];
    if (sp.use === 'snack') return ['Space', 'Grab a snack'];
    { const fid = foodOfUse(sp.use); if (fid && fid !== 'espresso' && fid !== 'snack' && !(task && sp.work)) return ['Space', `Take ${FOODS[fid].name}`]; }
    return ['Space', task && sp.work ? 'Do the favour' : 'Have a look'];
  }
  function useInside() {
    const sp = insideSpot();
    if (!sp) { hud.toast('Nothing to use here. The door is behind you (G to leave).', 1800); return; }
    if (sp.kind === 'exit') { leavePlace(); return; }
    const here = quests.open().filter((tk) => stagePlace(tk) === inside.id);
    if (sp.work && here.length) {
      const pick = here.find((tk) => tk.uid === following) || here.sort((a, b) => a.deadline - b.deadline)[0];
      startFavour(pick);
      return;
    }
    if (inside.id === 'workshop' && sp.kind === 'person' && sp.who === 'uzi') { openGarage(); return; }
    if (sp.use === 'arcade') { openArcade(); return; }
    if (sp.use === 'coffeejob') { openCoffee(); return; }
    if (sp.use === 'parcel') { startParcel(); return; }
    if (sp.use === 'league') { openLeague(); return; }
    if (sp.kind === 'person') { if (social) social.start(sp.who, { x: sp.x, z: sp.z, from: 'space' }); return; }
    { const fid = foodOfUse(sp.use); if (fid) { takeFood(fid); if (sp.use !== 'coffee' && sp.use !== 'snack') return; } } // (the cafe's coffee and Perach's snack keep what they did, and now feed him too)
    if (sp.use === 'coffee') { ctrl.coffee(8); sfx.sip(); if (ori) ori.play('cheer'); } else if (sp.use === 'number') sfx.ding(); else sfx.pop();
    if (sp.say) hud.toast(sp.say, 3000);
  }
  /** The chip at the bottom: "G Go inside" at a door, or what Space does at the prop in reach. */
  function updateGoHint() {
    if (!goHint) return;
    let label = '';
    if (inside) {
      if (!trans && !(social && social.isTalking)) { const sp = insideSpot(); if (sp) { const [k, v] = spotLabel(sp); label = `<kbd>${k}</kbd> ${v}`; } }
    } else if (catNear() && !(social && social.isTalking)) {
      const k = catNear();
      label = `<kbd>Space</kbd> ${catLabel(k.id, ((campaign.state.progress.cats || {})[k.id]) || 0)}`;
    } else if (startNear() && !(social && social.isTalking)) {
      label = '<kbd>R</kbd> The Sababa Cup: pick a race';
    } else if (!trans && !drive && nearest && ROOMS[nearest.id] && !(social && social.isTalking) && Math.hypot(nearest.door.x - ctrl.state.x, nearest.door.z - ctrl.state.z) <= USE_RANGE) label = `<kbd>G</kbd> Go inside <small>${lineFor(nearest.id)}</small>`;
    else if (!trans && !drive && fight && !fight.active && !fight.ui.menuOpen && fight.near(ctrl.state.x, ctrl.state.z)) label = `<kbd>Space</kbd> Step into The Ring`;
    if (goHint.dataset.l !== label) { goHint.dataset.l = label; goHint.innerHTML = label; goHint.classList.toggle('on', !!label); }
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
    if (inside) roomLight(s);
    return s;
  }

  /** Inside: warm light from the room's lamp, brighter at night; the windows show the sky. */
  function roomLight(s) {
    const L = inside.info.light;
    hemi.intensity = Math.max(hemi.intensity, 0.85 + 0.55 * s.night);
    fill.position.set(L.x, L.y, L.z);
    fill.color.setHex(L.color);
    fill.distance = L.dist;
    fill.intensity = 5 + 16 * s.night;
    SKY_GLASS.setRGB(Math.min(1, s.hor[0] * 1.3 + 0.1), Math.min(1, s.hor[1] * 1.3 + 0.1), Math.min(1, s.hor[2] * 1.3 + 0.12), THREE.SRGBColorSpace);
    interiors.setSky(SKY_GLASS, 1 - s.night);
  }

  const extras = []; // dev / tests: extra people standing about (spawnPeople)
  let debugCam = null; // dev / tests: { pos, look, fov } overrides the chase camera (portraits)
  function placeCamera(snap = false) {
    if (snap) rig.reset();
    const dc = fightCam || debugCam;
    if (dc) {
      camera.position.set(...dc.pos);
      camera.lookAt(...dc.look);
      if (dc.fov && Math.abs(camera.fov - dc.fov) > 0.05) { camera.fov = dc.fov; camera.updateProjectionMatrix(); }
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
    get settings() { return settings; }, // (the host's frame-rate keeper looks at settings.resolution)
    get sfx() { return sfx; }, // (dev / tests: the band's state)
    get landmarks() { return landmarkList(true); }, // (dev / tests: the badges of the maps, the city events among them)
    get hud() { return hud; },
    get map() { return map; },
    get controller() { return ctrl; },
    get clock() { return clock; },
    get quests() { return quests; },
    get phone() { return phone; },
    get campaign() { return campaign; },
    get play() { return play; },
    get missions() { return missions; },
    get mworld() { return mworld; },
    get hail() { return hail; },
    /** Dev / tests: space at the door of a task (starts its mission) / the garage / the next morning. */
    startFavour(uid) { const tk = quests.get(uid); if (tk) startFavour(tk); },
    openGarage,
    get fight() { return fight; },
    get journal() { return journal; },
    get bubbles() { return bubbles; },
    get arcade() { return arcade; },
    get coffee() { return coffee; },
    get photo() { return photoUi; }, // (dev / tests)
    get league() { return league; }, // (dev / tests)
    get track() { return track; }, // (dev / tests: the track he is on, or null)
    get hz() { return hz; }, // (dev / tests: the obstacles of that track and which are down)
    get driverTop() { return driverTop(); }, // (dev / tests: the car's top-speed bonus of the driver level)
    get cats() { return catList(); }, // (dev / tests: where the street cats sit)
    get parcelRun() { return parcel; }, // (dev / tests)
    get crowd() { return crowd; }, // (dev / tests: the walkers)
    get social() { return social; },
    get mapUi() { return mapUi; },
    openFightMenu, startFight, goalTick, journalData, openArcade,
    /** Dev / tests: say hello to a cast member as if he stood next to Ori ('shilo', 'moti' ...). */
    sayHello(id) { const h = ctrl.state.heading; return social.hello({ id, name: speaker(id).name, x: ctrl.state.x + Math.sin(h) * 1.3, z: ctrl.state.z + Math.cos(h) * 1.3 }); },
    nextDay,
    restartDay,
    boostLeft() { return boostFuel; },
    spawnHail(spec) { if (drive && !hail) { if (spec) { hail = { m: createMission(spec, missionEnv(901)), ttl: 90 }; } else startHail(); } return !!hail; },
    /** Dev / tests: Ori gets into his own car at once, wherever he is; put the driven car somewhere (heading in radians). */
    enterOwnCar() { if (drive) return true; const p = props.cars.find((c) => c.mine); if (!p) return false; ctrl.teleport(p.x + 1.8, p.z, ctrl.state.heading); findCar(); if (nearCar) enterCar(nearCar); return !!drive; },
    placeCar(x, z, heading) { if (!veh) return false; veh.place(x, z, heading); ctrl.teleport(x, z, heading); return true; },
    setStamina(v) { ctrl.state.stamina = v; }, // (dev / tests)
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
      const fighting = !!(fight && fight.active);
      if (fighting) { input.fwd = 0; input.strafe = 0; input.sprint = false; input.orbit = 0; input.pitch = 0; input.zoom = 1; ctrl.teleport(fight.center.x, fight.center.z, ctrl.state.heading); groundY = fight.floorY; }
      const scale = over || intro || fighting ? 0 : 1; // the day does not slow down for a menu, but it waits while he fights
      const dts = dt * scale;
      t += dt;
      const yaw = rig.state.yaw;
      if ((social && social.isTalking) || trans || (guide && guide.isOpen) || (journal && journal.isOpen) || (mapUi && mapUi.isOpen) || (arcade && arcade.isOpen) || (coffee && coffee.isOpen) || (league && league.isOpen) || (fight && (fight.ui.menuOpen || fight.ui.cardOpen)) || (play && (play.verbOpen || play.shopOpen))) { input.fwd = 0; input.strafe = 0; input.sprint = false; } // (he stands and listens / the door is swinging / a little action has his hands)
      if (trans) {
        trans.t += dt;
        const u = Math.min(1, trans.t / trans.dur);
        if (trans.phase === 'out') { setFade(u); if (u >= 1) { trans.fn(); trans.phase = 'in'; trans.t = 0; } } else { setFade(1 - u); if (u >= 1) { trans = null; setFade(0); } }
      }
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
      if (fight) { fight.update(dt); fight.tick(dt, t); }
      crowd.update(intro ? dt : dts, ctrl.state);
      if (social) social.update(dt, { blocked: !!(intro || over || play.verbOpen || fighting), driving: !!drive });
      rig.update(dt, { ...ctrl.state, drive: !!drive }, intro ? {} : { orbit: input.orbit, pitch: input.pitch, zoom: input.zoom });
      findPlaces();
      if (inside) {
        nearest = map.places[inside.id]; nearPlace = nearest; nearCar = null;
        inside.t += dt;
        interiors.update(dt, ctrl.state);
        const ex = inside.info.exit;
        if (!trans && inside.t > 1.2 && ctrl.state.z > ex.z - 0.12 && Math.abs(ctrl.state.x - ex.x) < 0.9) leavePlace(); // he walked onto the doormat
      } else if (!drive) findCar();
      updateGoHint();
      play.update(dt);
      runMissions(dts);
      stepGolden(dts);
      syncQuests();
      goalTimer += dt;
      if (parcel) parcel.t += dt;
      if (goalTimer > 0.6) { goalTimer = 0; goalTick(); trophyTick(); tourTick(0.6); eventTick(0.6); storyTick(0.6); parcelTick(); wishTick(); stampTick(); }
      eventFrame();
      saveTimer += dt;
      if (saveTimer > 15) { saveTimer = 0; campaign.save(); } // (love and hellos are not lost if the tab is closed)
    },
    /** Draws one frame (also used by the tests with dt = 0). */
    render(dt) {
      if (!opened || disposed) return;
      const s = applySky();
      const st = ctrl.state;
      groundY += (groundHeight(map, st.x, st.z) - groundY) * Math.min(1, dt > 0 ? dt * 14 : 1);
      if (!(fight && fight.render(dt, t, s.night))) ori.update(dt, st, groundY, Math.max(st.winded ? 0.6 : 0, quests.state.chaos / 100));
      for (const p of extras) p.update(dt, { speed: 0 });
      if (!inside) fill.position.set(st.x + Math.sin(st.heading) * 1.2, groundY + 2.6, st.z + Math.cos(st.heading) * 1.2);
      if (fire) fire.update(dt);
      if (carTag) { carTag.sp.position.set(carTag.car.x, 3.0 + Math.sin(t * 3) * 0.25, carTag.car.z); carTag.sp.visible = !drive && !inside && !(fight && fight.active); }
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
      hud.update({ time: clock.label(), label: partOfDay(clock.hour), day: clock.progress, place: inside ? { name: map.places[inside.id].name, kind: 'Inside' } : drive ? { name: 'F · get out', kind: 'Driving' } : nearCar ? { name: 'F · get in', kind: 'Car' } : nearPlace ? { name: nearPlace.name, kind: nearPlace.kind === 'building' ? 'Here' : 'Near' } : null, stamina: drive ? 1 : st.stamina, winded: !drive && st.winded }); // (the run bar is for the legs: it is not shown in the car)
      void next; void rankIdx;
      hud.meters({ chaos: campaign.state.love, score: `Lv ${campaign.state.boxer.level}`, rankProgress: xpProgress(campaign.state.boxer) });
      const task = following != null ? quests.get(following) : null;
      let mview = null;
      if (task && (task.state === 'new' || task.state === 'accepted')) {
        const gl = goalOf(task);
        const mm = missions.get(task.uid);
        const from = inside ? map.places[inside.id].door : st;
        const m = Math.round(walkDistance(map, from.x, from.z, gl.x, gl.z));
        hud.goal({ title: `${task.giverName}: ${task.title}`, meta: track ? 'Out of town: stay on the road' : `${m} m · ${left(task.deadline - q.min)}` });
        hud.arrow(inside ? null : arrowFor({ door: { x: gl.x, z: gl.z }, sign: gl.place ? map.places[gl.place].sign : (mm && KIND_LABEL[mm.kind]) || 'GO' }));
        mview = mm && mm.kind !== 'verb' ? mm.view() : null;
      } else if (fight && fight.active) {
        hud.goal(null); hud.arrow(null); beam.hide();
        if (carTag) carTag.sp.visible = false;
      } else {
        // no task: the goal of the moment (a chip, the beam and the arrow); with none, the arrow points at Ori's car until he first gets in
        const cg = currentGoal(campaign);
        const tp = trackInfo(tracked); // a place he follows from the map beats the goal of the moment
        const gp = tp || (cg && cg.place ? map.places[cg.place] : null);
        if (tp) { const from2 = inside ? map.places[inside.id].door : st; hud.goal({ title: `Heading to ${tp.name}`, meta: `${Math.round(walkDistance(map, from2.x, from2.z, tp.door.x, tp.door.z))} m · M for the map` }); } else if (cg) hud.goal({ title: cg.title, meta: cg.need > 1 ? `${cg.have} / ${cg.need}` : cg.hint }); else hud.goal(null);
        if (gp && !inside) { const d = gp.door; beam.set(d.x - d.nx * 0.8, d.z - d.nz * 0.8, groundHeight(map, d.x, d.z)); } else beam.hide();
        const ca = carTag && !gp && !drive && !inside ? arrowFor({ door: { x: carTag.car.x, z: carTag.car.z }, sign: 'ORI CAR' }) : null;
        hud.arrow(gp && !inside ? arrowFor(gp) : ca);
      }
      play.setMission(mview);
      play.setRace(mview && mview.race ? mview.race : null);
      const tg = [];
      const fm = task ? missions.get(task.uid) : null;
      if (fm && !inside) tg.push(...fm.targets());
      if (hail) tg.push(...hail.m.targets());
      mworld.sync(tg, t, dt, drive ? veh.state : st);
      play.setPeaches(campaign.eco.peaches);
      play.setBoost(boostFuel / campaign.eco.perks().tank, !!drive && !!drive.p.mine);
      {
        const pins = [];
        const seen = new Set();
        for (const tk of quests.open()) {
          const id = stagePlace(tk);
          if (seen.has(id)) continue;
          seen.add(id);
          pins.push({ id, color: CAST[tk.giver].color, label: PLACES[id].sign.charAt(0), active: following === tk.uid });
        }
        const points = [];
        const gl = task && (task.state === 'new' || task.state === 'accepted') ? goalOf(task) : null;
        if (gl && (!gl.place || gl.live)) points.push({ x: gl.x, z: gl.z, color: '#ff9f43', ring: true });
        if (hail) { const hg = hail.m.goal(); if (hg) points.push({ x: hg.x, z: hg.z, color: '#ff6b9d', label: '?' }); }
        for (const x of fm && fm.targets ? fm.targets() : []) if (x.kind === 'rival') points.push({ x: x.x, z: x.z, color: '#e94f3d' });
        const me = inside ? map.places[inside.id].door : st;
        const cgm = currentGoal(campaign);
        const gid = tracked || (cgm && cgm.place) || null;
        play.setMinimap(t, { player: { x: me.x, z: me.z, heading: st.heading }, pins, points, landmarks: landmarkList(false), goal: !task && gid ? placePoint(gid) : null });
      }
      camera.updateMatrixWorld(true);
      if (bubbles) bubbles.update(dt, camera);
      if (fight) fight.follow(dt, camera);
      phone.update(t, dt, ctrl.state.speed);
    },
    resize(w, h) {
      if (!camera) return;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      setOutlineView(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
      if (post) post.setSize(w, h);
    },
    pause() { if (paused || !opened || over) return false; paused = true; sfx.music(false); sfx.band(0); hud.showPause(true); lastKb && lastKb.clear && lastKb.clear(); return true; },
    resume() { if (!paused) return; paused = false; if (!(fight && fight.active)) sfx.music(true); hud.showPause(false); }, // (in the ring the fight's own music plays: the street loop stays off)
    onEscape() { if (over) return; if (photoUi && photoUi.isOn) { photoToggle(); return; } if (arcade && arcade.isOpen) return; if (coffee && coffee.isOpen) return; if (league && league.isOpen) return; if (guide && guide.isOpen) { guide.close(); return; } if (mapUi && mapUi.isOpen) { mapUi.close(); return; } if (journal && journal.isOpen) { journal.close(); return; } if (fight && fight.ui.menuOpen) { fight.ui.closeMenu(true); return; } if (phone && phone.isOpen) { phone.close(); return; } if (paused) api.resume(); else api.pause(); },
    onReset() { /* R: nothing to reset yet */ },
    onCamera() { if (rig) { rig.state.yaw = ctrl.state.heading; rig.state.pitch = 0.42; } },
    onAction(name) {
      if (paused || !opened || over) return;
      if (photoUi && photoUi.isOn) { if (name === 'interact') shoot(); return; } // (in photo mode the shutter is Space / Enter / F)
      if (play.verbOpen) { const v = play.verb; if (v) { v.press('act'); setTimeout(() => v.release('act'), 90); } return; }
      if (play.shopOpen) return;
      if (fight && (fight.active || fight.ui.menuOpen || fight.ui.cardOpen)) return;
      if (name === 'phone') { journal.toggle(journalData); sfx.tap(); } else if (name === 'interact') { if (journal.isOpen) { journal.close(); return; } if (trans) return; if (drive) exitCar(); else if (inside) useInside(); else if (catNear()) petCat(); else if (nearCar) enterCar(nearCar); else if (fight && fight.near(ctrl.state.x, ctrl.state.z)) openFightMenu(); else useDoor(); }
    },
    onKey(e) {
      if (play && play.shopOpen && play.key(e)) return true; // (the garage can be opened from the day card)
      if (over) { if (e.code === 'Tab' || e.code === 'Enter' || e.code === 'Space') return 'native'; return true; }
      if (paused) {
        if (e.code === 'Escape' || e.code === 'KeyP') { api.resume(); return true; }
        const ae = document.activeElement;
        if (e.code === 'Tab') return trapTab(e, hud.menu); // (Tab walks round inside the menu: claimed, so the input layer lets it be)
        if (ae && ae.tagName === 'TEXTAREA') return 'native'; // (typing and pasting a save code)
        if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && ae && ae.type === 'range') return 'native'; // (the sound slider uses the sideways arrows itself)
        if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ArrowUp' || e.code === 'KeyW') {
          const bs = [...hud.menu.querySelectorAll('.g3d-btn, .fv-set input, .fv-code textarea')].filter((b) => !b.hidden && !b.closest('[hidden]'));
          const i = bs.indexOf(document.activeElement);
          bs[(i + (e.code === 'ArrowDown' || e.code === 'KeyS' ? 1 : -1) + bs.length) % bs.length].focus();
          return true;
        }
        if (e.code === 'Enter' || e.code === 'Space') return 'native';
        return true;
      }
      if (photoUi && photoUi.isOn) { if (e.code === PHOTO_KEY) { photoToggle(); return true; } return PHOTO_ALLOWED.has(e.code) ? undefined : true; } // (photo mode: walk and turn the camera, the rest waits)
      if (guide && guide.isOpen) { const r = guide.key(e); if (r) return r; }
      if (e.code === 'Slash' && e.shiftKey && !(social && social.isTalking)) { guideToggle(); return true; }
      if (fight && (fight.active || fight.ui.menuOpen || fight.ui.cardOpen) && fight.key(e)) return true;
      if (arcade && arcade.isOpen && arcade.key(e)) return true;
      if (coffee && coffee.isOpen && coffee.key(e)) return true;
      if (league && league.isOpen && league.key(e)) return true;
      if (journal && journal.key(e)) return true;
      if (mapUi && mapUi.isOpen) { const r = mapUi.key(e); if (r) return r; }
      if (e.code === PHOTO_KEY && photoFree()) { photoToggle(); return true; }
      if (e.code === 'KeyM' && mapUi && !(social && social.isTalking) && !trans) { mapUi.toggle(); sfx.tap(); return true; }
      if (e.code === 'KeyR' && league && campaign && !track && !trans && !(social && social.isTalking) && photoFree()) { if (startNear() || (inside && inside.id === 'workshop')) openLeague(); else hud.toast('The races are out of town: drive to the east end of the main road, to the flag on the map, and press R.', 4200); return true; } // (the board of the races, from anywhere)
      // the phone is a panel on the side: its keys (1-9, F, Y / L / N, [ ]) are used, everything else still walks Ori
      if (play && (play.verbOpen || play.shopOpen) && play.key(e)) return true;
      if (e.code === 'KeyG' && !(social && social.isTalking)) { if (!trans) { if (inside) leavePlace(); else if (nearest && !drive && ROOMS[nearest.id] && Math.hypot(nearest.door.x - ctrl.state.x, nearest.door.z - ctrl.state.z) <= USE_RANGE) enterPlace(nearest.id); } return true; }
      if (social && social.key(e)) return true;
      if (phone && phone.isOpen && phone.key(e)) return true;
      return undefined;
    },
    // ── debug / tests ──
    /** Runs n fixed steps of 1/120 s with the last input (or the given one); the quests follow the clock. */
    step(n = 1, inp = null) {
      for (let i = 0; i < n; i++) { ctrl.step(inp || wish); clock.tick(1 / 120); }
      rig.update(n / 120, { ...ctrl.state, drive: !!drive }, {});
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
    /** Dev / tests: stand cast members ('shilo', 'moti' ...) in a row in front of Ori. */
    spawnCast(ids, o) { return api.spawnPeople(ids.map((id) => speaker(id).spec), o); },
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
    /** Dev / tests: start a conversation ('ima', 'clerk', 'stranger:3', 'roee' ...), read its state, close it. */
    talk(id) { return social ? social.start(id, { from: 'dev' }) : false; },
    /** Dev / tests: walk into a building (instant = no fade) / out again; where Ori is. */
    enter(pid, o) { return enterPlace(pid, o || { instant: true }); },
    leave(o) { return leavePlace(o || { instant: true }); },
    insideId() { return inside ? inside.id : null; },
    insideInfo() { return inside ? { id: inside.id, spots: inside.info.spots, npcs: inside.info.npcs.map((n) => ({ id: n.id, x: n.x, z: n.z })), exit: inside.info.exit, spot: (insideSpot() || {}).kind || null, trans: !!trans } : null; },
    talkState() { return social ? social.state() : null; },
    talkKey(code) { return social ? social.key({ code }) : false; },
    clockInfo() { return { hour: clock.hour, label: clock.label(), progress: clock.progress, done: clock.done }; },
    /** Dev / tests: do the favour for a task at once (as Space at its door would). */
    doFavour(uid) { const r = quests.complete(uid, 1); syncQuests(); return r; },
    state() {
      if (!opened) return { phase: 'loading' };
      const s = ctrl.state;
      const q = quests.state;
      return {
        phase: over ? 'over' : 'play', paused, tier, driving: !!drive, tracked, mapOpen: !!(mapUi && mapUi.isOpen), tour: tour.on, guideOpen: !!(guide && guide.isOpen), photo: { on: !!(photoUi && photoUi.isOn) }, parcel: parcel ? { to: parcel.to, limit: parcel.limit, t: parcel.t, meters: parcel.meters } : null, story: campaign ? { n: campaign.state.progress.story || 0, end: campaign.state.progress.storyEnd || 0, chip: storyChip(campaign.state.progress), party: !!party } : null, events: events ? { open: events.open(clock.hour).map((e) => e.id), done: events.snapshot().done, beam: eventBeacon ? eventBeacon.shown : null, band: sfx.bandPlaying } : null, carTag: carTag ? { visible: carTag.sp.visible, x: carTag.car.x, z: carTag.car.z } : null, car: drive ? { x: veh.state.x, z: veh.state.z, speed: veh.state.speed, heading: veh.state.heading } : null, nearCar: nearCar ? { x: nearCar.x, z: nearCar.z, mine: !!nearCar.mine } : null, traffic: traffic ? traffic.cars.length : 0,
        clock: { hour: clock.hour, label: clock.label(), progress: clock.progress },
        player: { x: s.x, z: s.z, heading: s.heading, speed: s.speed, stamina: s.stamina, sprinting: s.sprinting, winded: s.winded, blocked: s.blocked, hash: ctrl.hash() },
        near: nearPlace ? nearPlace.id : null,
        camera: { x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw: rig.state.yaw, fov: camera.fov },
        crowd: crowd ? crowd.walkers.length : 0,
        quests: { min: q.min, open: quests.open().length, arrived: q.stats.arrived, done: q.stats.done, failed: q.stats.failed, score: q.score, chaos: q.chaos, rel: { ...q.rel }, rank: rankFor(q.score), following, phoneOpen: phone.isOpen, focus: q.focus.on },
        radius: PLAYER_R, walk: WALK_SPEED,
        love: campaign.state.love, boxer: { ...campaign.state.boxer, beaten: [...campaign.state.boxer.beaten] }, progress: { ...campaign.state.progress }, fight: fight ? fight.snapshot() : null, goal: (currentGoal(campaign) || {}).id || null,
        peaches: campaign.eco.peaches, day: campaign.day, golden: campaign.state.golden.length, perks: campaign.eco.perks(), verb: play.verbOpen, shop: play.shopOpen, boost: boostFuel,
        mission: following != null && missions.get(following) ? { kind: missions.get(following).kind, goal: missions.get(following).goal(), view: missions.get(following).view() } : null,
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
      play.dispose();
      mworld.dispose();
      if (campaign) campaign.save();
      if (fight) { fight.dispose(); fight = null; }
      if (bubbles) { bubbles.dispose(); bubbles = null; }
      if (journal) { journal.dispose(); journal = null; }
      if (mapUi) { mapUi.dispose(); mapUi = null; }
      if (guide) { guide.dispose(); guide = null; }
      if (eventBeacon) { scene.remove(eventBeacon.group); eventBeacon.dispose(); eventBeacon = null; }
      events = null;
      if (arcade) { arcade.dispose(); arcade = null; }
      if (coffee) { coffee.dispose(); coffee = null; }
      if (photoUi) { photoUi.dispose(); photoUi = null; }
      if (league) { league.dispose(); league = null; }
      if (trackWorld) { trackWorld.dispose(); trackWorld = null; }
      if (inside) { for (const c of inside.colliders) map.world.removeDynamic(c); inside = null; }
      if (interiors) { interiors.dispose(); interiors = null; }
      if (fadeEl) { fadeEl.remove(); fadeEl = null; }
      if (goHint) { goHint.remove(); goHint = null; }
      if (social) { social.dispose(); social = null; }
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
