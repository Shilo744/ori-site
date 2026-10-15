import './styles.css';
import * as THREE from 'three';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { createScene } from './scene/index.js';
import { createDesktop } from './ui/desktop.js';
import { SCREEN_CM } from './scene/macbook.js';
import { SCREEN_PX } from './screen-size.js';
import * as sound from './audio.js';
import { content } from './content.js';

// ── DOM ────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const stage = $('stage');
const hud = $('hud');
const promptEl = $('prompt');
const hintEl = $('hint');
const intro = $('intro');
const introText = $('intro-text');
const startBtn = $('intro-start');
const soundBtn = $('btn-sound');
const viewBtn = $('btn-view');
const clockEl = $('hud-clock');

$('hud-name').textContent = content.name;
$('hud-title').textContent = content.title;
document.title = `${content.name} — Portfolio ${content.year}`;

const ICON = {
  soundOn: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 4V5L7 9z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 4V5L7 9z"/><path d="M16 9.5l5 5M21 9.5l-5 5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  zoomOut: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h2.5l1.2-1.6h6.6L16.5 5H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm9 9.6a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2z"/></svg>',
};
soundBtn.innerHTML = ICON.soundOn;
viewBtn.innerHTML = ICON.zoomOut;

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
const desktop = createDesktop({
  onVolume: (on) => {
    sound.setEnabled(on);
    soundBtn.innerHTML = on ? ICON.soundOn : ICON.soundOff;
  },
});
const world = createScene({ renderer, screenElement: desktop.root });
const { scene, mac } = world;

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

function computeScreenView() {
  scene.updateMatrixWorld(true);
  const center = new THREE.Vector3().setFromMatrixPosition(mac.screen.matrixWorld);
  const normal = new THREE.Vector3(0, 0, 1).transformDirection(mac.screen.matrixWorld).normalize();
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
    dur: duration,
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
      if (wantsFlat()) { goFlat(); return; }
      hintEl.classList.add('on');
      setTimeout(() => hintEl.classList.remove('on'), 4200);
    },
  });
}

function exitScreen() {
  if (state === 'flat') {
    leaveFlat('screen');
    setView(screenView);
  }
  if (state !== 'screen') return;
  state = 'exiting';
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
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
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

  computeScreenView();
  if (state === 'flat' && !wantsFlat()) { leaveFlat('screen'); setView(screenView); }
  else if (state === 'screen' && wantsFlat() && !tween) goFlat();
  if (!tween) {
    if (state === 'screen') setView(screenView);
    else if (state === 'overview') setView(OVERVIEW);
    else if (state === 'intro' || state === 'ready') setView(FAR_INTRO);
  }
}
window.addEventListener('resize', resize);

// ── input ──────────────────────────────────────────────────────────────
window.addEventListener('pointermove', (e) => {
  mouse.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
});

stage.addEventListener('click', (e) => {
  if (state === 'ready') { enterScreen(); return; }
  if (state === 'overview' && e.target.closest('.mac')) enterScreen();
});
// canvas + screen clicks (screen element is a CSS3D child, so listen on it too)
desktop.root.addEventListener('click', () => {
  if (state === 'overview') enterScreen();
});

viewBtn.addEventListener('click', () => {
  sound.click();
  if (state === 'screen' || state === 'flat') exitScreen();
  else if (state === 'overview') enterScreen();
});

soundBtn.addEventListener('click', () => {
  const next = !sound.isEnabled();
  sound.setEnabled(next);
  soundBtn.innerHTML = next ? ICON.soundOn : ICON.soundOff;
  if (next) sound.click();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (state === 'screen' && desktop.closeOverlays()) return;
    if (state === 'screen' || state === 'flat') exitScreen();
  }
});

// ── intro sequence ─────────────────────────────────────────────────────
const introLines = [`${content.name} Portfolio Showcase ${content.year}`, 'Click start to begin'];

async function typeIntro() {
  let out = '';
  for (let li = 0; li < introLines.length; li++) {
    for (const ch of introLines[li]) {
      out += ch;
      introText.textContent = out;
      await new Promise((r) => setTimeout(r, 22 + Math.random() * 28));
    }
    out += '\n';
    await new Promise((r) => setTimeout(r, 160));
  }
  startBtn.hidden = false;
}
typeIntro();

startBtn.addEventListener('click', () => {
  sound.unlock();
  sound.click();
  sound.startAmbient();
  intro.classList.add('out');
  setTimeout(() => (intro.style.display = 'none'), 1000);
  state = 'ready';
  promptEl.classList.add('on');
  // boot the laptop while the room fades in
  setTimeout(() => { sound.chime(); }, 500);
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

// ── macOS cursor drawn inside the screen (so it has the right size & perspective) ──
const pointerPx = { x: -1, y: -1, has: false };
window.addEventListener('pointermove', (e) => {
  pointerPx.x = e.clientX;
  pointerPx.y = e.clientY;
  pointerPx.has = true;
  if (state === 'screen') desktop.probeCursor(e.clientX, e.clientY);
});
window.addEventListener('pointerleave', () => { pointerPx.has = false; desktop.hideCursor(); });

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const plane = new THREE.Plane();
const hitP = new THREE.Vector3();
const nrm = new THREE.Vector3();
const org = new THREE.Vector3();
const inv = new THREE.Matrix4();

function updateCursor() {
  if (state !== 'screen' || !pointerPx.has) { desktop.hideCursor(); return; }
  ndc.set((pointerPx.x / window.innerWidth) * 2 - 1, -(pointerPx.y / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const m = mac.screen.matrixWorld;
  nrm.set(0, 0, 1).transformDirection(m);
  org.setFromMatrixPosition(m);
  plane.setFromNormalAndCoplanarPoint(nrm, org);
  if (!ray.ray.intersectPlane(plane, hitP)) { desktop.hideCursor(); return; }
  inv.copy(m).invert();
  hitP.applyMatrix4(inv); // px units, origin at the screen centre, +y up
  desktop.moveCursor(hitP.x + SCREEN_PX.w / 2, SCREEN_PX.h / 2 - hitP.y);
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

function frame() {
  const rawDt = clock.getDelta();
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
  parallax += ((lockedOnScreen ? 0 : 11) - parallax) * (1 - Math.pow(0.0005, Math.min(rawDt, 0.5)));
  if (state === 'screen' || state === 'flat') parallax = 0;
  const amp = parallax;
  dir.subVectors(view.target, view.pos).normalize();
  right.crossVectors(dir, camera.up).normalize();
  up.crossVectors(right, dir).normalize();
  tmp.copy(view.pos);
  tmp.addScaledVector(right, mouseS.x * amp);
  tmp.addScaledVector(up, -mouseS.y * amp * 0.6);

  // lazy sway while idling in the room
  if (state === 'ready' || state === 'intro' || state === 'overview') {
    tmp.addScaledVector(right, Math.sin(t * 0.25) * 7);
    tmp.y += Math.sin(t * 0.18) * 2.5;
  }

  camera.position.copy(tmp);
  camera.lookAt(view.target);
  if (camera.fov !== view.fov) {
    camera.fov = view.fov;
  }
  const dist = camera.position.distanceTo(view.target);
  camera.near = Math.max(1, dist * 0.05);
  camera.far = dist * 12 + 4000;
  camera.updateProjectionMatrix();

  // display glow on the keys when close
  const near = THREE.MathUtils.clamp(1 - (dist - 40) / 400, 0, 1);
  mac.glow.intensity = near * 1800;

  if (state !== 'flat') {
    renderer.render(scene, camera);
    css3d.render(scene, camera);
    updateCursor();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// small debug handle
window.__ori = { audio: sound.debugState, get state() { return state; }, enterScreen, exitScreen, desktop, camera, view, renderer, scene: world.scene };
