// Time of day for the whole room. One pure function turns "hours" (0–24) into a lighting state (colours, intensities,
// sky parameters, CSS variables…); `createDaylight` applies that state to the lights, materials, sky shader uniforms and the
// page — with modes Auto (real local time) / Day / Golden hour / Night and a 1.5 s eased cross-fade between them.
// Nothing here allocates per frame and no texture is regenerated: the sky is driven purely by uniforms.
import * as THREE from 'three';
import { storage } from '../core/storage.js';
import { bus } from '../core/bus.js';

// ───────────────────────── key frames ─────────────────────────
// hour → state. Colours are hex; the light colours/intensities are for the single shadow-casting key light
// (sun by day, moon at night); hemi/fill/env give the ambient fill.
const FRAMES = [
  { h: 0,    key: '#8ea6ff', keyI: 0.55, sky: '#26345f', gnd: '#0e1020', hemiI: 0.55, fill: '#5668a8', fillI: 0.16, env: 0.14, exp: 1.22, top: '#040a1e', hor: '#0d1838', glow: '#2a3a7a', stars: 1.0,  cloud: '#1b2447', cloudA: 0.3,  win: 1.0,  lamp: 1.0,  led: 1.0,  wall: '#9aa5cc', bg1: '#232b50', bg2: '#161b38', bg3: '#0a0d20', vig: 0.5,  screen: 1.7 },
  { h: 4.5,  key: '#7f9bff', keyI: 0.45, sky: '#2a3a70', gnd: '#12142a', hemiI: 0.5,  fill: '#5a6bb0', fillI: 0.15, env: 0.15, exp: 1.2,  top: '#0b1433', hor: '#3d3a6a', glow: '#55457a', stars: 0.7,  cloud: '#2a2f5a', cloudA: 0.35, win: 0.9,  lamp: 0.9,  led: 0.9,  wall: '#a6add0', bg1: '#2b3262', bg2: '#1b2147', bg3: '#0d1126', vig: 0.45, screen: 1.5 },
  { h: 6.3,  key: '#ffa76a', keyI: 0.9,  sky: '#ffcfa6', gnd: '#8a7b72', hemiI: 0.38, fill: '#ffcfb0', fillI: 0.22, env: 0.26, exp: 1.08, top: '#5b87c9', hor: '#ffb98c', glow: '#ff9a5a', stars: 0.0,  cloud: '#ffc9a8', cloudA: 0.55, win: 0.25, lamp: 0.2,  led: 0.55, wall: '#ffe9dc', bg1: '#fff0e4', bg2: '#f2d0b8', bg3: '#d9a98f', vig: 0.25, screen: 1.0 },
  { h: 8,    key: '#ffecd2', keyI: 1.55, sky: '#eef4ff', gnd: '#d9d3c9', hemiI: 0.5,  fill: '#e6edff', fillI: 0.36, env: 0.36, exp: 1.02, top: '#6fb0f0', hor: '#cfe5fa', glow: '#fff0c8', stars: 0.0,  cloud: '#ffffff', cloudA: 0.6,  win: 0.0,  lamp: 0.0,  led: 0.45, wall: '#ffffff', bg1: '#f1f1f5', bg2: '#d9dae1', bg3: '#b9bbc6', vig: 0.22, screen: 1.0 },
  { h: 13,   key: '#fff0d9', keyI: 1.75, sky: '#ffffff', gnd: '#dcd8d0', hemiI: 0.5, fill: '#e6edff', fillI: 0.34, env: 0.34, exp: 1.05,  top: '#58a2f0', hor: '#d4eafb', glow: '#fff6dd', stars: 0.0,  cloud: '#ffffff', cloudA: 0.7,  win: 0.0,  lamp: 0.0,  led: 0.45, wall: '#fffaf3', bg1: '#f1f1f5', bg2: '#d9dae1', bg3: '#b9bbc6', vig: 0.22, screen: 1.0 },
  { h: 17,   key: '#ffe8c8', keyI: 1.68, sky: '#fff3e4', gnd: '#d6cdbf', hemiI: 0.5,  fill: '#efeaff', fillI: 0.35, env: 0.36, exp: 1.0,  top: '#6aa6e8', hor: '#f3e3c8', glow: '#ffe0a0', stars: 0.0,  cloud: '#fff3e0', cloudA: 0.6,  win: 0.0,  lamp: 0.05, led: 0.5,  wall: '#fff8f0', bg1: '#f6efe6', bg2: '#e2d4c4', bg3: '#c4b19e', vig: 0.24, screen: 1.0 },
  { h: 18.4, key: '#ffb562', keyI: 1.62, sky: '#ffe4c4', gnd: '#b09a85', hemiI: 0.46, fill: '#ffd9b4', fillI: 0.3,  env: 0.3,  exp: 1.05, top: '#4d80c6', hor: '#ffb274', glow: '#ff9c50', stars: 0.0,  cloud: '#ffc690', cloudA: 0.65, win: 0.35, lamp: 0.45, led: 0.65, wall: '#fff0e0', bg1: '#fff0e0', bg2: '#efcba6', bg3: '#c99b78', vig: 0.3,  screen: 1.15 },
  { h: 19.6, key: '#ff7b58', keyI: 0.55, sky: '#b894b4', gnd: '#4a4258', hemiI: 0.42, fill: '#9a8ac8', fillI: 0.22, env: 0.22, exp: 1.12, top: '#27377a', hor: '#ff7456', glow: '#ff6a48', stars: 0.25, cloud: '#8a6a9a', cloudA: 0.5,  win: 0.85, lamp: 0.9,  led: 0.9,  wall: '#d9cdd8', bg1: '#5a4a78', bg2: '#3a3360', bg3: '#1d1a3c', vig: 0.4,  screen: 1.4 },
  { h: 21,   key: '#8fa8ff', keyI: 0.5,  sky: '#4a5b9c', gnd: '#1c2038', hemiI: 0.5,  fill: '#6070b8', fillI: 0.16, env: 0.17, exp: 1.18, top: '#0b173f', hor: '#2e3f75', glow: '#3a4f9a', stars: 0.85, cloud: '#2a3560', cloudA: 0.35, win: 1.0,  lamp: 1.0,  led: 1.0,  wall: '#a8b1d8', bg1: '#2c3668', bg2: '#1c2350', bg3: '#0e1230', vig: 0.48, screen: 1.6 },
];
FRAMES.push({ ...FRAMES[0], h: 24 });

const NUM = ['keyI', 'hemiI', 'fillI', 'env', 'exp', 'stars', 'cloudA', 'win', 'lamp', 'led', 'vig', 'screen'];
const COL = ['key', 'sky', 'gnd', 'fill', 'top', 'hor', 'glow', 'cloud', 'wall', 'bg1', 'bg2', 'bg3'];
// pre-parse the colours once
FRAMES.forEach((f) => COL.forEach((k) => { f[`_${k}`] = new THREE.Color(f[k]); }));

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const mixN = (a, b, t) => a + (b - a) * t;

/** A mutable state record with every field preallocated (so evaluating a state never allocates). */
export function makeState() {
  const s = { hours: 12, keyU: 0.5, keyV: 0.5, sunU: 0.5, sunV: 0.5, sunVis: 1, moonU: 0.5, moonV: -1, moonVis: 0, night: 0 };
  NUM.forEach((k) => { s[k] = 0; });
  COL.forEach((k) => { s[k] = new THREE.Color(); });
  return s;
}

const SUN_RISE = 6.2, SUN_SET = 19.4;
// arcs in sky-plane UV (u grows towards the back wall, v is up): the visible part of the window is roughly u 0.2–0.8, v 0.11–0.83
function arcs(h, s) {
  const ts = (h - SUN_RISE) / (SUN_SET - SUN_RISE);
  s.sunU = 0.2 + 0.6 * ts;
  s.sunV = 0.1 + 0.62 * Math.sin(Math.PI * ts);
  s.sunVis = smooth(clamp01((s.sunV - 0.075) / 0.07));
  const tm = (((h - SUN_SET) % 24) + 24) % 24 / 10.8;
  s.moonU = 0.2 + 0.6 * tm;
  s.moonV = 0.1 + 0.55 * Math.sin(Math.PI * tm);
  s.moonVis = tm >= 0 && tm <= 1 ? smooth(clamp01((s.moonV - 0.075) / 0.08)) : 0;
  // the key light swings smoothly from the moon's position to the sun's (and back) around dawn / dusk
  const wSun = smooth(clamp01((h - 5.5) / 1.4)) * (1 - smooth(clamp01((h - 18.7) / 1.4)));
  s.keyU = mixN(s.moonU, s.sunU, wSun);
  s.keyV = mixN(Math.max(0.12, s.moonV), Math.max(0.1, s.sunV), wSun);
}

/** Fills `out` with the lighting state for `hours` (0–24). */
export function evalState(hours, out) {
  let h = ((hours % 24) + 24) % 24;
  let i = 0;
  while (i < FRAMES.length - 2 && h >= FRAMES[i + 1].h) i++;
  const a = FRAMES[i], b = FRAMES[i + 1];
  const t = smooth(clamp01((h - a.h) / (b.h - a.h)));
  out.hours = h;
  NUM.forEach((k) => { out[k] = mixN(a[k], b[k], t); });
  COL.forEach((k) => { out[k].copy(a[`_${k}`]).lerp(b[`_${k}`], t); });
  arcs(h, out);
  out.night = smooth(clamp01((out.stars - 0.1) / 0.8));
  return out;
}

function lerpState(a, b, t, out) {
  out.hours = b.hours;
  ['keyU', 'keyV', 'sunU', 'sunV', 'sunVis', 'moonU', 'moonV', 'moonVis', 'night', ...NUM].forEach((k) => { out[k] = mixN(a[k], b[k], t); });
  COL.forEach((k) => { out[k].copy(a[k]).lerp(b[k], t); });
  return out;
}
function copyState(from, to) {
  to.hours = from.hours;
  ['keyU', 'keyV', 'sunU', 'sunV', 'sunVis', 'moonU', 'moonV', 'moonVis', 'night', ...NUM].forEach((k) => { to[k] = from[k]; });
  COL.forEach((k) => { to[k].copy(from[k]); });
}

// ───────────────────────── the controller ─────────────────────────
export const MODES = ['auto', 'day', 'golden', 'night'];
export const MODE_HOURS = { day: 13.2, golden: 18.4, night: 23.0 };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * @param {object} o
 * @param {THREE.Scene} o.scene
 * @param {THREE.WebGLRenderer} o.renderer
 * @param {THREE.DirectionalLight} o.sun         key light (shadow caster)
 * @param {THREE.HemisphereLight} o.hemi
 * @param {THREE.DirectionalLight} o.fill
 * @param {object} o.mats                        { wallBack, wallLeft, floor, led, lamp }
 * @param {THREE.ShaderMaterial} o.skyMat
 * @param {THREE.PointLight} o.lampLight
 * @param {object} o.sky                         { center: Vector3, w, h } sky plane placement (to aim the sun through the window)
 * @param {THREE.Vector3} o.target               what the sun looks at
 */
export function createDaylight({ scene, renderer, sun, hemi, fill, mats, skyMat, lampLight, sky, target }) {
  const live = makeState();   // state for the current hour
  const shown = makeState();  // what is applied right now (live, or mid cross-fade)
  const from = makeState();
  let mode = storage.get('daylight:mode', 'auto');
  if (!MODES.includes(mode)) mode = 'auto';
  let manualHours = null;     // setTime(h): fixed hour for the harness
  let appliedHours = -99;
  let trans = null;           // { t0 }
  let lampOverride = null;    // null = follows the time of day; true / false = the user (T14 toggles it)
  let lampLevel = 0;          // eased 0..1
  let snapLamp = false;       // jump (no easing) on the next update — used by setHours()
  let time = 0;
  let transitionS = 1.5;       // cross-fade length when the mode changes (tests shorten it)

  const baseWall = [mats.wallBack.color.clone(), mats.wallLeft.color.clone()];
  const baseFloor = mats.floor.color.clone();
  const baseLed = mats.led.color.clone();
  const tmp = new THREE.Color();
  const root = document.documentElement;
  const theme = document.querySelector('meta[name="theme-color"]');
  const dir = new THREE.Vector3();
  const S = new THREE.Vector3();

  const clockHours = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; };
  const targetHours = () => (manualHours != null ? manualHours : mode === 'auto' ? clockHours() : MODE_HOURS[mode]);

  function apply(s) {
    // key light: aim from the sky-disc position through the window into the room
    S.set(sky.center.x, sky.center.y + (s.keyV - 0.5) * sky.h, sky.center.z - (s.keyU - 0.5) * sky.w);
    dir.copy(S).sub(target).normalize();
    sun.position.copy(target).addScaledVector(dir, 800);
    sun.color.copy(s.key);
    sun.intensity = s.keyI;
    hemi.color.copy(s.sky);
    hemi.groundColor.copy(s.gnd);
    hemi.intensity = s.hemiI;
    fill.color.copy(s.fill);
    fill.intensity = s.fillI;
    scene.environmentIntensity = s.env;
    renderer.toneMappingExposure = s.exp;

    // wall / floor tint
    mats.wallBack.color.copy(baseWall[0]).multiply(s.wall);
    mats.wallLeft.color.copy(baseWall[1]).multiply(s.wall);
    mats.floor.color.copy(baseFloor).multiply(s.wall);

    // LED strip: dim by day, warm and bright at night
    tmp.set(0xffd9a6);
    mats.led.color.copy(baseLed).lerp(tmp, s.led * 0.6).multiplyScalar(0.55 + 0.45 * s.led);

    // sky shader
    const u = skyMat.uniforms;
    u.uTop.value.copy(s.top);
    u.uHorizon.value.copy(s.hor);
    u.uSunGlow.value.copy(s.glow);
    u.uCloudCol.value.copy(s.cloud);
    u.uSun.value.set(s.sunU, s.sunV);
    u.uMoon.value.set(s.moonU, s.moonV);
    u.uSunVis.value = s.sunVis;
    u.uMoonVis.value = s.moonVis;
    u.uStars.value = s.stars;
    u.uCloudA.value = s.cloudA;
    u.uWin.value = s.win;
    u.uNight.value = s.night;

    // page background + vignette follow the light
    root.style.setProperty('--bg1', `#${s.bg1.getHexString()}`);
    root.style.setProperty('--bg2', `#${s.bg2.getHexString()}`);
    root.style.setProperty('--bg3', `#${s.bg3.getHexString()}`);
    root.style.setProperty('--vig', `rgba(${Math.round(30 - 22 * s.night)}, ${Math.round(30 - 22 * s.night)}, ${Math.round(50 - 26 * s.night)}, ${(s.vig * 0.7).toFixed(3)})`);
    if (theme) theme.setAttribute('content', `#${s.bg2.getHexString()}`);
    glassTokens(s.night);
    appliedHours = s.hours;
  }

  // the HUD glass (ui/hud.css reads --g-*): white frosted glass by day, deep blue-graphite at night; written only when the 1/40 step changes
  function glassTokens(night) {
    const step = Math.round(night * 40);
    if (step === glassTokens.step) return;
    glassTokens.step = step;
    const n = step / 40;
    const mix = (a, b) => Math.round(a + (b - a) * n);
    const f2 = (a, b) => (a + (b - a) * n).toFixed(2);
    root.style.setProperty('--g-bg', `rgba(${mix(255, 24)}, ${mix(255, 29)}, ${mix(255, 48)}, ${f2(0.6, 0.56)})`);
    root.style.setProperty('--g-bg-hover', `rgba(${mix(255, 44)}, ${mix(255, 52)}, ${mix(255, 82)}, ${f2(0.82, 0.78)})`);
    root.style.setProperty('--g-ink', `rgb(${mix(29, 245)}, ${mix(29, 245)}, ${mix(31, 247)})`);
    root.style.setProperty('--g-ink2', `rgba(${mix(40, 226)}, ${mix(40, 230)}, ${mix(48, 248)}, ${f2(0.7, 0.72)})`);
    root.style.setProperty('--g-edge', `rgba(255, 255, 255, ${f2(0.55, 0.16)})`);
    root.style.setProperty('--g-shadow', `0 6px 22px rgba(${mix(20, 0)}, ${mix(24, 0)}, ${mix(40, 8)}, ${f2(0.14, 0.45)})`);
    root.style.setProperty('--g-accent', `rgb(${mix(0, 10)}, ${mix(113, 132)}, ${mix(227, 255)})`);
  }

  function lampTarget() { return lampOverride == null ? shown.lamp : lampOverride ? 1 : 0; }

  function applyLamp() {
    lampLight.intensity = 12000 * lampLevel * lampLevel; // quadratic: a barely-on lamp adds almost nothing in daylight
    lampLight.visible = lampLevel > 0.01;
    mats.lamp.emissiveIntensity = 0.28 + 1.35 * lampLevel;
  }

  function begin() {
    // cross-fade from whatever is on screen right now to the new target
    copyState(shown, from);
    trans = { t0: time };
  }

  function setMode(next, { instant = false } = {}) {
    if (!MODES.includes(next)) return;
    mode = next;
    manualHours = null;
    storage.set('daylight:mode', mode);
    if (instant) { trans = null; appliedHours = -99; } else begin(); // instant: re-apply the exact state even if a cross-fade was mid-way
    bus.emit('daylight:change', info());
  }

  const info = () => ({ mode, hours: shown.hours, night: shown.night, lamp: lampLevel });

  /** Test hook: jump to an hour (no cross-fade unless `ms` is given). */
  function setHours(h, ms = 0) {
    manualHours = ((+h % 24) + 24) % 24;
    if (ms > 0) begin(); else { trans = null; appliedHours = -99; snapLamp = true; }
    bus.emit('daylight:change', info());
  }

  function update(dt) {
    time += dt;
    skyMat.uniforms.uTime.value = time;
    evalState(targetHours(), live);
    if (trans) {
      const k = Math.min(1, (time - trans.t0) / transitionS);
      lerpState(from, live, ease(k), shown);
      apply(shown);
      if (k >= 1) trans = null;
    } else if (Math.abs(live.hours - appliedHours) > 0.008 || appliedHours < -50) {
      copyState(live, shown);
      apply(shown);
    }
    // the floor lamp eases towards its target (also when toggled by hand)
    const lt = lampTarget();
    if (snapLamp) { snapLamp = false; lampLevel = lt; applyLamp(); }
    else if (Math.abs(lt - lampLevel) > 0.002) { lampLevel += (lt - lampLevel) * (1 - Math.exp(-dt * 3.2)); applyLamp(); }
  }

  const api = {
    update,
    state: shown,
    get mode() { return mode; },
    get transitionSeconds() { return transitionS; },
    set transitionSeconds(v) { transitionS = Math.max(0.01, +v || 1.5); },
    get hours() { return shown.hours; },
    /** The hour the light is heading for (differs from `hours` during a cross-fade; changes the moment setHours / setMode is called). */
    get targetHours() { return targetHours(); },
    /** true while a fixed hour was set by hand (the test harness) instead of following the real clock */
    get manual() { return manualHours != null; },
    setMode,
    cycleMode() { setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]); return mode; },
    setHours,
    info,
    /** Floor lamp: `lamp.setOn(true|false)` overrides the time of day; `lamp.auto()` hands control back. */
    lamp: {
      setOn(on) { lampOverride = !!on; bus.emit('daylight:lamp', lampOverride); },
      auto() { lampOverride = null; },
      toggle() { lampOverride = !(lampOverride == null ? lampLevel > 0.5 : lampOverride); bus.emit('daylight:lamp', lampOverride); return lampOverride; },
      get on() { return lampLevel > 0.5; },
      get level() { return lampLevel; },
    },
  };

  // first frame
  evalState(targetHours(), live);
  copyState(live, shown);
  apply(shown);
  lampLevel = lampTarget();
  applyLamp();
  return api;
}
