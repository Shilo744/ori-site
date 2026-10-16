import './styles.css';
import './ui/hud.css';
import * as THREE from 'three';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { createScene } from './scene/index.js';
import { createDesktop } from './ui/desktop.js';
import { SCREEN_CM } from './scene/macbook.js';
import { SCREEN_PX } from './screen-size.js';
import * as sound from './audio.js';
import { content } from './content.js';
import { getView } from './scene/views.js';
import { registerApp, getApp, listApps as registryList } from './ui/apps/registry.js';
import * as kit from './ui/games/kit.js';
import { storage } from './core/storage.js';
import { bus } from './core/bus.js';
import { achievements } from './core/achievements.js';
import { notifications } from './core/notify.js';
import { evalState as evalDaylight, makeState as makeDaylightState } from './scene/daylight.js';
import { system } from './core/system.js';
import { wallpaper } from './core/wallpaper.js';
import { theme } from './core/theme.js';
import { defineCatalog } from './core/achievements-catalog.js';
import { startTrackers } from './ui/trackers.js';
import { createNotificationUI } from './ui/notifications.js';
import { startOnboarding } from './ui/onboarding.js';
import { createIntro } from './ui/intro.js';
import { HUD_ICON, TIME_ICON } from './ui/hud-icons.js';
import { installCursors } from './ui/cursors.js';
import { listGames } from './ui/games/catalog.js';
import { listApps as listRegisteredApps } from './ui/apps/registry.js';
import { STATIONS, DESK_INDEX, stationView, badges, nearestUndiscovered } from './scene/stations.js';
import { createInteractions } from './scene/interactions.js';
import { registerRoom } from './scene/interactables.js';
import { initGame3D, launchGame3D, game3dDebug } from './game3d/host.js';
import { scores } from './ui/games/scores.js';

installCursors(); // one pointer for the whole page, from the very first frame (T57)

// `?fast=1` — tests only: skips the typewriter intro / boot delays and shortens camera flights.
const FAST = new URLSearchParams(window.location.search).has('fast');

// ── DOM ────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const stage = $('stage');
const hud = $('hud');
const promptEl = $('prompt');
const hintEl = $('hint');
const startBtn = $('intro-start');
let introUi = null; // the opening screen (ui/intro.js), created once the first frame is on its way
const soundBtn = $('btn-sound');
const viewBtn = $('btn-view');
const timeBtn = $('btn-time');
const clockEl = $('hud-clock');

$('hud-name').textContent = content.name;
$('hud-title').textContent = content.title;
document.title = `${content.name} — Portfolio ${content.year}`;

soundBtn.innerHTML = HUD_ICON.soundOn;
soundBtn.setAttribute('aria-pressed', 'true');
viewBtn.innerHTML = HUD_ICON.view;

// time-of-day button: icon follows the mode (auto / day / golden hour / night) — ui/hud-icons.js
const TIME_LABEL = { auto: 'Auto (local time)', day: 'Day', golden: 'Golden hour', night: 'Night' };

// ── renderer ───────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0);
stage.appendChild(renderer.domElement);

const css3d = new CSS3DRenderer();
css3d.domElement.classList.add('css3d');
stage.appendChild(css3d.domElement);

// ── scene ──────────────────────────────────────────────────────────────
let nightLevel = () => 0; // how dark the room is (0..1): theme "Auto" follows it; wired to the daylight system below
const desktop = createDesktop({
  fast: FAST,
  onPower: (kind) => handlePower(kind),
  night: () => nightLevel(),
  onVolume: (on) => { soundBtn.innerHTML = on ? HUD_ICON.soundOn : HUD_ICON.soundOff; soundBtn.setAttribute('aria-pressed', String(on)); if (introUi) introUi.setSound(on); }, // the speaker icon follows Settings / Control Center
});
const world = createScene({ renderer, screenElement: desktop.root, wallArt: wallpaper.id, wallHours: wallpaper.hours });
const { scene, mac } = world;
mac.setLid(false, 0); // the laptop starts shut; START opens it
const daylight = world.daylight;
const nightProbe = makeDaylightState();
nightLevel = () => evalDaylight(daylight.targetHours, nightProbe).night; // theme "Auto": dark once the room is dark (no cross-fade lag)
wallpaper.setHoursSource(() => daylight.targetHours); // the Dynamic wallpaper (desktop + wall art) follows the room's clock
theme.sync();
wallpaper.onChange(({ id }) => world.setWallArt(id, daylight.targetHours));
bus.on('wallpaper:paint', ({ id, hours }) => { if (id === 'dynamic') world.setWallArt(id, hours); });
if (FAST) daylight.transitionSeconds = 0.2; // tests: the 1.5 s cross-fade would take ~30 frames at software-GL speed
function syncTimeBtn() {
  timeBtn.innerHTML = TIME_ICON[daylight.mode];
  timeBtn.title = `Time of day: ${TIME_LABEL[daylight.mode]} (T)`;
  timeBtn.setAttribute('aria-label', `Time of day: ${TIME_LABEL[daylight.mode]}`);
}
syncTimeBtn();
timeBtn.addEventListener('click', () => { sound.click(); daylight.cycleMode(); syncTimeBtn(); });

const camera = new THREE.PerspectiveCamera(26, 1, 5, 12000);

// camera "rest" states
const view = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 26 };
const OVERVIEW_BASE = [235, 230, 121];
const FAR_BASE = [245, 237, 131];
const OVERVIEW = {
  pos: new THREE.Vector3(...OVERVIEW_BASE),
  target: new THREE.Vector3(10, 104, -166),
  fov: 27,
};
const FAR_INTRO = {
  pos: new THREE.Vector3(...FAR_BASE),
  target: new THREE.Vector3(10, 104, -166),
  fov: 27,
};
const screenView = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 30 };

const screenM = new THREE.Matrix4();
function computeScreenView() {
  scene.updateMatrixWorld(true);
  // aim at the screen as it is when the lid is OPEN, even if the lid is still shut (wake from Sleep)
  mac.screenMatrixAt(mac.OPEN_DEG, screenM);
  const center = new THREE.Vector3().setFromMatrixPosition(screenM);
  const normal = new THREE.Vector3(0, 0, 1).transformDirection(screenM).normalize();
  const aspect = camera.aspect;
  const fov = aspect < 1.1 ? 36 : 30;
  const tan = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const fillH = aspect < 1.1 ? 0.5 : 0.88;
  const dh = SCREEN_CM.h / fillH / (2 * tan);
  const dw = SCREEN_CM.w / 0.94 / (2 * tan * aspect);
  const d = Math.max(dh, dw);
  screenView.pos.copy(center).addScaledVector(normal, d);
  screenView.target.copy(center);
  screenView.fov = fov;
  screenView.normal = normal;
}

// ── state machine ──────────────────────────────────────────────────────
let state = 'intro'; // intro → ready → entering → screen → exiting → overview
let tween = null;
const mouse = new THREE.Vector2();
const mouseS = new THREE.Vector2();

// Small screens: after the camera arrives, show the screen UI full-bleed (readable) instead of in 3D.
const flatHost = document.createElement('div');
flatHost.id = 'flat';
flatHost.hidden = true;
document.body.appendChild(flatHost);
const wantsFlat = () => window.innerWidth < 860;

function goFlat() {
  state = 'flat';
  mac.screen.visible = false;
  desktop.root.style.visibility = '';
  flatHost.appendChild(desktop.root);
  flatHost.hidden = false;
  desktop.root.classList.add('flat');
  desktop.setCompact(true);
  desktop.setLocked(false);
  document.body.classList.add('flat-mode');
  hintEl.classList.remove('on');
  viewBtn.hidden = false;
}

function leaveFlat(next) {
  flatHost.hidden = true;
  document.body.classList.remove('flat-mode');
  desktop.root.classList.remove('flat');
  desktop.setCompact(false);
  mac.screen.visible = true;
  state = next;
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function flyTo(to, duration, { arc = 0, onDone } = {}) {
  tween = {
    t0: performance.now(),
    dur: FAST ? duration * 0.15 : duration,
    from: { pos: view.pos.clone(), target: view.target.clone(), fov: view.fov },
    to: { pos: to.pos.clone(), target: to.target.clone(), fov: to.fov },
    arc,
    onDone,
  };
}

function setView(v) {
  view.pos.copy(v.pos);
  view.target.copy(v.target);
  view.fov = v.fov;
}

// lid timings (ms); `?fast=1` shortens them like the camera flights
const lidMs = (ms) => (FAST ? ms * 0.15 : ms);

function enterScreen() {
  if (state !== 'overview' && state !== 'ready') return;
  const wasReady = state === 'ready';
  state = 'entering';
  document.body.classList.add('in-screen');
  computeScreenView();
  sound.unlock();
  sound.whoosh();
  promptEl.classList.remove('on');
  desktop.setLocked(true);
  if (wasReady) hud.classList.add('on');
  // waking the laptop: open the lid while the camera flies in; after Shut Down the boot animation runs again
  if (!mac.lidOpen) mac.setLid(true, lidMs(1100));
  if (poweredOff) { poweredOff = false; desktop.powerOn(); }
  flyTo(screenView, wasReady ? 2800 : 1900, {
    arc: wasReady ? 90 : 45,
    onDone: () => {
      state = 'screen';
      desktop.setLocked(false);
      viewBtn.hidden = false;
      if (!desktop.opened) {
        desktop.opened = true;
        desktop.open('home');
      }
      bus.emit('screen:enter');
      notifications.entered(); // a new visit: the limiter's quiet window starts
      startOnboarding({ fast: FAST, openSpotlight: () => desktop.openSpotlight(), open: (id, args) => desktop.open(id, args), isLive: () => state === 'screen' || state === 'flat' });
      runPendingOpen();
      if (wantsFlat()) { goFlat(); return; }
      hintEl.classList.add('on');
      setTimeout(() => hintEl.classList.remove('on'), 4200);
    },
  });
}

let poweredOff = false; // Shut Down: the next wake runs the boot animation (Sleep wakes instantly)

/** Apple menu → Sleep / Shut Down in 3D: the camera pulls back while the lid closes. Returns false in flat mode (the desktop blacks out instead). */
function handlePower(kind) {
  if (state !== 'screen') return false;
  if (kind === 'shutdown') poweredOff = true;
  exitScreen();
  setTimeout(() => { if (state === 'exiting' || state === 'overview') mac.setLid(false, lidMs(950)); }, lidMs(550));
  return true;
}

function exitScreen() {
  if (state === 'flat') {
    leaveFlat('screen');
    setView(screenView);
  }
  if (state !== 'screen') return;
  state = 'exiting';
  stationIdx = DESK_INDEX; // coming back from the laptop you are at the desk
  document.body.classList.remove('in-screen');
  desktop.setLocked(true);
  hintEl.classList.remove('on');
  sound.whoosh();
  flyTo(OVERVIEW, 1700, {
    arc: 30,
    onDone: () => { state = 'overview'; },
  });
}

// ── resize ─────────────────────────────────────────────────────────────
let cssForce = true; // the CSS3D transform is rewritten only when it changed; a resize / state change forces one
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  cssForce = true;
  renderer.setSize(w, h);
  css3d.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  // narrow / portrait windows → pull the camera back until the whole room fits horizontally
  const fit = (base, target, fov, extent) => {
    const baseDist = new THREE.Vector3(...base).distanceTo(target);
    const need = extent / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)) * camera.aspect);
    return Math.max(1, need / baseDist);
  };
  const kO = fit(OVERVIEW_BASE, OVERVIEW.target, OVERVIEW.fov, 250);
  const kF = fit(FAR_BASE, FAR_INTRO.target, FAR_INTRO.fov, 270);
  OVERVIEW.pos.set(...OVERVIEW_BASE).sub(OVERVIEW.target).multiplyScalar(kO).add(OVERVIEW.target);
  FAR_INTRO.pos.set(...FAR_BASE).sub(FAR_INTRO.target).multiplyScalar(kF).add(FAR_INTRO.target);

  STATIONS.forEach((s, i) => { if (!s.desk) stationView(s, camera.aspect, stationViews[i]); });
  computeScreenView();
  if (state === 'flat' && !wantsFlat()) { leaveFlat('screen'); setView(screenView); }
  else if (state === 'screen' && wantsFlat() && !tween) goFlat();
  if (!tween) {
    if (state === 'screen') setView(screenView);
    else if (state === 'overview' || state === 'ready') setView(restView());
    else if (state === 'intro') setView(FAR_INTRO);
  }
}
window.addEventListener('resize', resize);

// ── "Look around": three stations in the room (Window & bench ‹ Desk › Plant & clock) ──
const stationViews = STATIONS.map(() => ({ pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 30 }));
let stationIdx = DESK_INDEX;
/** The camera view the room rests in: the desk uses the (fitted) overview / first-view framing, the others their own. */
function restView() {
  if (stationIdx === DESK_INDEX) return state === 'ready' ? FAR_INTRO : OVERVIEW;
  return stationViews[stationIdx];
}
const navL = $('nav-left'), navR = $('nav-right'), dotsEl = $('st-dots');
STATIONS.forEach((s, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-label', s.label);
  b.title = s.label;
  b.addEventListener('click', () => goStation(i));
  dotsEl.appendChild(b);
});
let lastActivity = performance.now();
let navState = '';
function syncNav() {
  const live = state === 'ready' || state === 'overview';
  navL.hidden = navR.hidden = dotsEl.hidden = !live;
  if (!live) return;
  const b = badges(stationIdx, interactions.found());
  for (const [el, n] of [[navL, b.left], [navR, b.right]]) {
    const bd = el.querySelector('.bd');
    bd.hidden = n === 0;
    bd.textContent = String(n);
  }
  navL.disabled = stationIdx === 0;
  navR.disabled = stationIdx === STATIONS.length - 1;
  navL.setAttribute('aria-label', `Look left${b.left ? ` — ${b.left} undiscovered` : ''}`);
  navR.setAttribute('aria-label', `Look right${b.right ? ` — ${b.right} undiscovered` : ''}`);
  [...dotsEl.children].forEach((d, i) => d.classList.toggle('on', i === stationIdx));
}
/** Moves the camera to station `i` (0 = Window & bench, 1 = Desk, 2 = Plant & clock). */
function goStation(i, { instant = false } = {}) {
  if (state !== 'ready' && state !== 'overview') return false;
  const next = Math.max(0, Math.min(STATIONS.length - 1, i));
  lastActivity = performance.now();
  navL.classList.remove('hint'); navR.classList.remove('hint');
  if (next === stationIdx && !tween) return false;
  stationIdx = next;
  const v = restView();
  if (instant || system.get('reduceMotion')) { tween = null; setView(v); } else flyTo(v, 900);
  syncNav();
  sound.blip(520 + next * 60, 0.05, 'triangle', 0.04);
  bus.emit('station:change', { index: next, id: STATIONS[next].id });
  return true;
}
navL.addEventListener('click', () => goStation(stationIdx - 1));
navR.addEventListener('click', () => goStation(stationIdx + 1));
bus.on('room:discover', () => syncNav());
bus.on('room:reset', () => syncNav());
// swipe (touch / pen) on the room
{
  let o = null;
  window.addEventListener('pointerdown', (e) => { o = e.pointerType === 'mouse' || !(e.target === renderer.domElement) ? null : { x: e.clientX, y: e.clientY }; });
  window.addEventListener('pointerup', (e) => {
    if (!o) return;
    const dx = e.clientX - o.x, dy = e.clientY - o.y;
    o = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) goStation(stationIdx + (dx < 0 ? 1 : -1));
  });
}
// after a while with no input, point the arrow towards the nearest thing nobody has found yet
setInterval(() => {
  if ((state !== 'ready' && state !== 'overview') || system.get('reduceMotion')) return;
  if (performance.now() - lastActivity < (FAST ? 1500 : 10000)) return;
  const n = nearestUndiscovered(stationIdx, interactions.found());
  if (!n) return;
  (n.dir < 0 ? navL : navR).classList.add('hint');
  lastActivity = performance.now() + 60000; // once per idle spell
}, 800);
['pointermove', 'pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => { lastActivity = performance.now(); }, { passive: true }));

// ── input ──────────────────────────────────────────────────────────────
window.addEventListener('pointermove', (e) => {
  mouse.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
});

stage.addEventListener('click', (e) => {
  if (state === 'ready') {
    // first view: a click enters the screen only when it lands on the laptop; things in the room are handled by
    // scene/interactions.js (it stops the event); anything else just nudges the laptop
    if (e.target.closest('.mac') || hitsMac(e.clientX, e.clientY)) enterScreen(); else nudgeLaptop();
    return;
  }
  if (state !== 'overview') return;
  // the screen DOM is hidden while the lid is shut, so a closed laptop is picked in 3D
  if (e.target.closest('.mac') || (!mac.lidOpen && hitsMac(e.clientX, e.clientY))) enterScreen();
});
// canvas + screen clicks (screen element is a CSS3D child, so listen on it too)
desktop.root.addEventListener('click', () => {
  if (state === 'overview' || state === 'ready') enterScreen();
});
promptEl.addEventListener('click', () => { if (state === 'ready') enterScreen(); });

// a click on empty space in the first view: the laptop hops a little ("this is the thing to click")
let nudgeT = 1;
function nudgeLaptop() {
  nudgeT = 0;
  sound.blip(520, 0.05, 'triangle', 0.04);
  promptEl.classList.remove('nudge');
  void promptEl.offsetWidth;
  promptEl.classList.add('nudge');
}

viewBtn.addEventListener('click', () => {
  sound.click();
  if (state === 'screen' || state === 'flat') exitScreen();
  else if (state === 'overview' || state === 'ready') enterScreen();
});

soundBtn.addEventListener('click', () => {
  // the speaker button, Control Center and System Settings → Sound all share one state (core/system.js)
  if (sound.isEnabled() && system.get('volume') > 0) { system.set('muted', true); return; }
  if (system.get('volume') === 0) system.set('volume', 70);
  system.set('muted', false);
  sound.click();
});

window.addEventListener('keydown', (e) => {
  // ← → / A D look around while you are looking at the room
  if ((state === 'ready' || state === 'overview') && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target.closest && e.target.closest('input, textarea'))) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { goStation(stationIdx - 1); e.preventDefault(); return; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { goStation(stationIdx + 1); e.preventDefault(); return; }
  }
  // T cycles the time of day (only while looking at the room, never while typing)
  if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && !e.altKey && state !== 'screen' && state !== 'flat' && state !== 'entering' && !(e.target.closest && e.target.closest('input, textarea'))) {
    sound.click();
    daylight.cycleMode();
    syncTimeBtn();
    return;
  }
  if (e.key === 'Escape') {
    if (e.defaultPrevented) return; // the active app used Esc itself (e.g. a game pausing)
    if (state === 'screen' && desktop.closeOverlays()) return;
    if (state === 'screen' || state === 'flat') exitScreen();
  }
});

// ── opening apps from outside the screen (a toast, the Trophies tag): enter the laptop first, then open ──
let pendingOpen = null;
function openApp(id, args) {
  if (state === 'screen' || state === 'flat') { desktop.open(id, args); return; }
  pendingOpen = { id, args };
  if (state === 'overview' || state === 'ready') enterScreen();
}
const runPendingOpen = () => { if (pendingOpen) { const p = pendingOpen; pendingOpen = null; desktop.open(p.id, p.args); } };

// ── achievements catalogue, trackers, notification banners / toasts, onboarding, Trophies tag ──
defineCatalog({ apps: listRegisteredApps({ hidden: false, category: 'app' }).length, games: listGames().length });
startTrackers({ hours: () => daylight.targetHours, night: () => nightLevel(), gameIds: () => listGames().map((g) => g.id) });
const notifUI = createNotificationUI({
  stack: desktop.root.querySelector('.nb-stack'), toasts: document.getElementById('toasts'),
  isScreenLive: () => state === 'screen' || state === 'flat', open: openApp, sound,
});
if (new URLSearchParams(location.search).has('quiet')) notifUI.quiet = true; // browser tests: keep banners off the UI under test
bus.on('achievement:unlock', (a) => { if (a && a.rarity !== 'common') sound.trophy(); }); // common ones are silent (T50)
if (FAST) notifications.setTimeScale(0.12); // ?fast=1 shrinks every wait, the limiter's too
bus.on('notify', (note) => {
  // held back (no banner, not Do Not Disturb): the menu-bar clock gives a soft nudge so the list is still discoverable
  if (!note.shown && !note.silent) {
    const c = desktop.root.querySelector('#mb-clock');
    if (c) { c.classList.remove('nudge'); void c.offsetWidth; c.classList.add('nudge'); }
  }
});
const trophiesEl = document.getElementById('hud-trophies');
function syncTrophies(pop = false) {
  const c = achievements.counts();
  trophiesEl.textContent = `Trophies ${c.unlocked}/${c.total}`;
  if (pop) { trophiesEl.classList.remove('pop'); void trophiesEl.offsetWidth; trophiesEl.classList.add('pop'); }
}
syncTrophies();
bus.on('achievement:unlock', () => syncTrophies(true));
bus.on('achievement:reset', () => syncTrophies());
trophiesEl.addEventListener('click', () => { sound.click(); openApp('arcade', { tab: 'trophies' }); });
bus.on('progress:reset', () => { interactions.reset(); });

// ── interactive things in the room: hover outline + tag, click actions, "Discovered n/N" (T14) ──
const interactions = createInteractions({
  camera, canvas: renderer.domElement, getState: () => state,
  tagEl: document.getElementById('room-tag'), counterEl: document.getElementById('hud-found'),
  storage, achievements, bus,
});
registerRoom({
  it: interactions, world, screenEl: desktop.root, achievements,
  hooks: {
    cycleTime() { sound.click(); daylight.cycleMode(); syncTimeBtn(); return TIME_LABEL[daylight.mode]; },
    enterScreen,
  },
});

startBtn.addEventListener('click', () => {
  sound.unlock();
  sound.click();
  sound.startAmbient();
  if (introUi) introUi.leave(); // the veil's blur melts while the camera pushes in
  state = 'ready';
  promptEl.classList.add('on');
  hud.classList.add('on'); // the HUD (and the "Discovered n/11" counter) is there from the first view
  viewBtn.hidden = false;
  // first-visit hint: if nobody has touched anything after a few seconds, softly pulse one thing's outline
  setTimeout(() => { if (state === 'ready' && !interactions.touched && !system.get('reduceMotion')) interactions.hint(); }, FAST ? 900 : 6000);
  // the laptop opens its lid and boots while the room fades in
  setTimeout(() => { sound.chime(); }, 500);
  setTimeout(() => mac.setLid(true, lidMs(1500)), lidMs(350));
  desktop.boot();
});

// ── clocks ─────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
function tick() {
  const d = new Date();
  clockEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
tick();
setInterval(tick, 1000);

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();

/** Does a click at these client coordinates hit the MacBook model? */
function hitsMac(cx, cy) {
  ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.intersectObject(mac.group, true).length > 0;
}
// ── render loop ────────────────────────────────────────────────────────
const tmp = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const dir = new THREE.Vector3();
const clock = new THREE.Clock();

resize();
setView(FAR_INTRO);
viewBtn.hidden = true;

let parallax = 11; // camera sway amplitude (cm), eased toward 0 while on the screen

// debug/test state (see window.__ori below)
let camOverride = null;
let timeOfDay = null;
let ready = false;
let resolveReady;
const readyPromise = new Promise((res) => { resolveReady = res; });

// the opening screen: a veil over the live room; its button appears when fonts and the first frame are really there
introUi = createIntro({
  fast: FAST,
  name: content.name,
  tagline: content.title,
  year: content.year,
  whenReady: readyPromise,
  getHours: () => daylight.targetHours,
  soundOn: () => sound.isEnabled() && system.get('volume') > 0,
  onSoundToggle: () => soundBtn.click(),
  reduceMotion: () => system.get('reduceMotion'),
});
let fps = 0, fpsFrames = 0, fpsT0 = performance.now();

// While a full-screen game (NEON DRIFT, src/game3d) is open the room loop is stopped completely: ~0 GPU and CPU for the room.
let roomPaused = false;
let roomLoopAlive = true;
function pauseRoom() { roomPaused = true; }
function resumeRoom() {
  if (!roomPaused) return;
  roomPaused = false;
  if (!roomLoopAlive) { roomLoopAlive = true; clock.getDelta(); requestAnimationFrame(frame); } // drop the time spent away
}
initGame3D({
  pauseRoom,
  resumeRoom,
  duck: (v) => sound.setDuck(v),
  emit: (name, data) => bus.emit(name, data),
  storage,
  scores,
  achievements,
});

// On the laptop screen the camera is locked and the room is only a backdrop: the WebGL room is drawn at ~30 fps and the CSS3D transform
// is rewritten only when the camera / screen matrices really change, so hover, drag and typing in the DOM get the whole frame (T49).
const SCREEN_STEP = 1 / 31;
let screenAcc = 0;
const cssPrev = new Float32Array(48);
function cssChanged() {
  const sets = [camera.matrixWorldInverse.elements, camera.projectionMatrix.elements, mac.screen.matrixWorld.elements];
  let changed = cssForce;
  cssForce = false;
  for (let k = 0; k < 3; k++) {
    const a = sets[k];
    for (let i = 0; i < 16; i++) {
      if (Math.abs(a[i] - cssPrev[k * 16 + i]) > 1e-6) changed = true;
      cssPrev[k * 16 + i] = a[i];
    }
  }
  return changed;
}

function frame() {
  if (roomPaused) { roomLoopAlive = false; return; }
  let rawDt = clock.getDelta();
  if (state === 'screen' && !tween && !camOverride) {
    screenAcc += rawDt;
    if (screenAcc < SCREEN_STEP) { requestAnimationFrame(frame); return; }
    rawDt = screenAcc;
    screenAcc = 0;
  } else screenAcc = 0;
  const dt = Math.min(rawDt, 0.05);
  const t = clock.elapsedTime;

  if (tween) {
    const k = Math.min(1, (performance.now() - tween.t0) / tween.dur);
    const e = ease(k);
    view.pos.lerpVectors(tween.from.pos, tween.to.pos, e);
    view.pos.y += Math.sin(Math.PI * e) * tween.arc;
    view.target.lerpVectors(tween.from.target, tween.to.target, e);
    view.fov = THREE.MathUtils.lerp(tween.from.fov, tween.to.fov, e);
    if (k >= 1) {
      const done = tween.onDone;
      tween = null;
      if (done) done();
    }
  }

  // smoothed mouse parallax: only while looking at the room. Once you are on the screen the
  // view is locked (amplitude eases to 0 as you fly in and back up as you leave).
  mouseS.lerp(mouse, 1 - Math.pow(0.001, dt));
  const lockedOnScreen = state === 'screen' || state === 'entering' || state === 'flat';
  const calm = system.get('reduceMotion'); // Settings → Accessibility → Reduce motion: no parallax, no idle sway
  parallax += ((lockedOnScreen || calm ? 0 : 11) - parallax) * (1 - Math.pow(0.0005, Math.min(rawDt, 0.5)));
  if (state === 'screen' || state === 'flat') parallax = 0;
  // a debug camera preset (window.__ori.setView) replaces the view and switches parallax/sway off
  const V = camOverride || view;
  const amp = camOverride ? 0 : parallax;
  dir.subVectors(V.target, V.pos).normalize();
  right.crossVectors(dir, camera.up).normalize();
  up.crossVectors(right, dir).normalize();
  tmp.copy(V.pos);
  tmp.addScaledVector(right, mouseS.x * amp);
  tmp.addScaledVector(up, -mouseS.y * amp * 0.6);

  // lazy sway while idling in the room
  if (!camOverride && !calm && (state === 'ready' || state === 'intro' || state === 'overview')) {
    tmp.addScaledVector(right, Math.sin(t * 0.25) * 7);
    tmp.y += Math.sin(t * 0.18) * 2.5;
  }

  camera.position.copy(tmp);
  camera.lookAt(V.target);
  if (camera.fov !== V.fov) {
    camera.fov = V.fov;
  }
  const dist = camera.position.distanceTo(V.target);
  camera.near = Math.max(1, dist * 0.05);
  camera.far = dist * 12 + 4000;
  camera.updateProjectionMatrix();

  // display glow on the keys when close
  const near = THREE.MathUtils.clamp(1 - (dist - 40) / 400, 0, 1);
  mac.glow.intensity = near * 1800 * mac.openness * daylight.state.screen * world.life.flicker;

  if (world.life.homepod.active && sound.padOn()) world.life.homepod.setLevel(sound.padLevel()); // the HomePod ring follows the music
  if (nudgeT < 1) { nudgeT = Math.min(1, nudgeT + dt * 3.2); mac.group.scale.setScalar(1 + 0.045 * Math.sin(Math.PI * nudgeT)); if (nudgeT >= 1) mac.group.scale.setScalar(1); }
  if (state !== navState) { navState = state; syncNav(); }
  world.update(dt, t, state);

  if (state !== 'flat') {
    renderer.render(scene, camera);
    if (cssChanged() || state !== 'screen') css3d.render(scene, camera);
  }
  interactions.update(dt, t);

  // fps estimate over ~0.5 s windows (no allocations)
  fpsFrames++;
  const nowMs = performance.now();
  if (nowMs - fpsT0 >= 500) {
    fps = (fpsFrames * 1000) / (nowMs - fpsT0);
    fpsFrames = 0;
    fpsT0 = nowMs;
  }
  if (!ready) { ready = true; resolveReady(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ── debug / test handle (used by scripts/smoke.mjs and scripts/shot.mjs) ──
function debugSetView(name) {
  if (!name || name === 'free') { camOverride = null; return true; }
  if (name === 'overview') { camOverride = OVERVIEW; return true; }
  if (name === 'screen') { computeScreenView(); camOverride = screenView; return true; }
  const v = getView(name, world);
  if (!v) return false;
  camOverride = v;
  return true;
}

window.__ori = {
  audio: sound.debugState,
  get state() { return state; },
  get ready() { return ready; },
  whenReady: readyPromise,
  fast: FAST,
  enterScreen,
  exitScreen,
  desktop,
  camera,
  view,
  renderer,
  scene: world.scene,
  mac,
  /** Lid control for tests: setLid(true|false, ms). Read mac.lidAngle / mac.lidOpen. */
  setLid: (open, ms = 0) => mac.setLid(open, ms),
  /** Opens an app (or alias such as `about`) on the macOS desktop. Returns false for an unknown id. */
  openApp(id) {
    if (!desktop.listApps().includes(id) && !desktop.listAliases().includes(id)) return false;
    desktop.open(id);
    return true;
  },
  listApps: () => desktop.listApps(),
  registry: { registerApp, getApp, listApps: registryList },
  core: { storage, bus, achievements, notifications, theme, system, wallpaper },
  kit,
  /** ids of the game windows whose render loop is running (tests: only the active one may be). */
  loops: () => kit.loopsRunning(),
  /** NEON DRIFT (src/game3d): { running, fps, stats(), state(), step(n), setSeed(n), launch(), quit(), autopilot(on) … } */
  game3d: game3dDebug,
  launchGame3D,
  /** Look-around stations: ids, current index, badges. `setStation('window' | 'desk' | 'plant', instant = true)`. */
  stations: () => ({ ids: STATIONS.map((s) => s.id), index: stationIdx, id: STATIONS[stationIdx].id, badges: badges(stationIdx, interactions.found()), things: STATIONS.map((s) => s.things) }),
  setStation: (name, instant = true) => goStation(typeof name === 'number' ? name : STATIONS.findIndex((s) => s.id === name), { instant }),
  /** Camera preset: overview | desk | window | shelf | bench | plant | mac-close | iphone | ipad | screen | free */
  setView: debugSetView,
  daylight,
  /** Notification banners (duration, count(), dismissAll()). */
  banners: notifUI,
  /** The room's ambient life (cat, clock, steam, vacuum…): handles for T14 and the tests. */
  life: world.life,
  /** Room interactions (hover / click / discovery): ids(), found(), screenPos(id), activate(id), hoverId, reset(). */
  interactions,
  /** Time of day in hours (0–24): jumps there instantly (mode stays whatever it was; the clock override wins until setMode). */
  setTime(hours) {
    timeOfDay = hours;
    daylight.setHours(hours, 0);
    window.dispatchEvent(new CustomEvent('ori:settime', { detail: { hours } }));
  },
  get time() { return timeOfDay; },
  stats() {
    const r = renderer.info.render;
    const mem = renderer.info.memory;
    return { calls: r.calls, triangles: r.triangles, geometries: mem.geometries, textures: mem.textures, fps: Math.round(fps * 10) / 10 };
  },
};
