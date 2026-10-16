// NEON DRIFT host: opens the full-viewport overlay above the whole site, owns the WebGL renderer + the loop, pauses the room
// while it runs, and tears everything down again on quit (geometries, materials, textures, renderer, GL context).
import * as THREE from 'three';
import { createSession } from './session.js';
import { createKeyboard } from './input.js';
import { createHud } from './hud.js';

const hooks = { pauseRoom() {}, resumeRoom() {}, duck() {}, emit() {} };
const settings = { seed: 7, pixelRatioCap: 2, carType: 'gt', paint: 0xff3ea5 };
let current = null;
let lastMemory = null; // renderer.info.memory right after the last session was disposed (leak checks)

/** Wires the host to the page: `pauseRoom()/resumeRoom()` stop/restart the room render loop, `duck(v)` scales the room audio. */
export function initGame3D(h) {
  Object.assign(hooks, h);
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch { return false; }
}

/**
 * Opens the game. Resolves with the running game (or null if it cannot run here). Only one game runs at a time.
 * @param {string} [id] game id ('drift')
 */
export function launchGame3D(id = 'drift', opts = {}) {
  if (current) return Promise.resolve(current.api);
  const overlay = document.createElement('div');
  overlay.className = 'g3d';
  overlay.id = 'g3d';
  overlay.setAttribute('role', 'application');
  overlay.setAttribute('aria-label', 'Neon Drift');
  const canvas = document.createElement('canvas');
  canvas.className = 'g3d-canvas';
  canvas.tabIndex = -1;
  overlay.append(canvas);
  document.body.append(overlay);
  document.body.classList.add('g3d-open');
  hooks.pauseRoom();
  hooks.duck(0);
  window.dispatchEvent(new CustomEvent('ori:overlay', { detail: { open: true } }));
  requestAnimationFrame(() => overlay.classList.add('in'));

  let renderer = null;
  let session = null;
  let hud = null;
  let kb = null;
  let raf = 0;
  let paused = false;
  let modal = null; // 'menu' | 'msg' | null
  let last = performance.now();
  let fpsFrames = 0;
  let fpsT0 = performance.now();
  let fps = 0;
  let gone = false;
  const seed = opts.seed ?? settings.seed;

  const teardown = () => {
    if (gone) return;
    gone = true;
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('resize', onResize);
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    kb?.dispose();
    hud?.dispose();
    session?.dispose();
    if (renderer) {
      renderer.dispose();
      lastMemory = { ...renderer.info.memory };
      renderer.forceContextLoss();
    }
    overlay.classList.remove('in');
    setTimeout(() => overlay.remove(), 260);
    document.body.classList.remove('g3d-open');
    hooks.duck(1);
    hooks.resumeRoom();
    window.dispatchEvent(new CustomEvent('ori:overlay', { detail: { open: false } }));
    current = null;
    hooks.emit('game3d:closed', { id });
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  };

  const quit = () => teardown();

  function fail(title, body) {
    // no renderer: show a friendly card with a way back
    hud = hud || createHud(overlay, { onPause() {}, onResume() {}, onRestart() {}, onQuit: quit });
    hud.root.hidden = true;
    modal = 'msg';
    hud.message(title, body, [{ label: 'Back to desktop', primary: true, run: quit }]);
    kb = kb || createKeyboard({ onKey: onKeyModal });
  }

  if (!webglAvailable()) {
    current = { api: null, quit };
    fail('WebGL 2 is not available', 'NEON DRIFT needs a browser with WebGL 2 turned on. Everything else on the site still works.');
    return Promise.resolve(null);
  }

  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (err) {
    current = { api: null, quit };
    fail('The graphics card said no', 'The browser could not start WebGL for the game. Try closing other tabs and opening it again.');
    return Promise.resolve(null);
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.pixelRatioCap));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x07030f, 1);

  session = createSession({ renderer, seed, carType: opts.carType || settings.carType, paint: opts.paint ?? settings.paint });
  hud = createHud(overlay, {
    onPause: () => pause(),
    onResume: () => resume(),
    onRestart: () => { session.restart(); resume(); },
    onQuit: quit,
  });
  kb = createKeyboard({
    onPause: () => pause(),
    onReset: () => session.resetToRoad(),
    onCamera: () => session.toggleCamera(),
    onKey: onKeyModal,
  });

  function onKeyModal(e) {
    if (!modal) return undefined;
    if (e.code === 'Escape' || e.code === 'KeyP') { if (modal === 'menu') resume(); else quit(); return true; }
    if (modal === 'menu' && (e.code === 'ArrowDown' || e.code === 'KeyS')) { hud.moveFocus(1); return true; }
    if (modal === 'menu' && (e.code === 'ArrowUp' || e.code === 'KeyW')) { hud.moveFocus(-1); return true; }
    if (e.code === 'Tab' || e.code === 'Enter' || e.code === 'Space') return 'native';
    return true;
  }

  function pause() {
    if (paused || gone) return;
    paused = true;
    modal = 'menu';
    kb.clear();
    hud.showMenu();
  }
  function resume() {
    if (!paused) return;
    paused = false;
    modal = null;
    hud.hideMenu();
    last = performance.now();
  }

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.pixelRatioCap));
    renderer.setSize(w, h, false);
    session.resize(w, h);
    if (paused) session.render(0); // a resized canvas is blank until it is drawn again
  }
  function onVis() {
    if (document.hidden) pause();
    else last = performance.now();
  }
  function onLost(e) {
    e.preventDefault();
    cancelAnimationFrame(raf);
    modal = 'msg';
    hud.message('Graphics interrupted', 'The browser reset the graphics card. The game continues as soon as it is back.', [{ label: 'Back to desktop', run: quit }]);
  }
  function onRestored() {
    hud.clearMessage();
    modal = paused ? 'menu' : null;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('resize', onResize);
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (!paused) {
      session.update(dt, kb);
      session.render(dt);
      hud.update(session.hud());
    }
    fpsFrames++;
    if (now - fpsT0 >= 500) {
      fps = (fpsFrames * 1000) / (now - fpsT0);
      fpsFrames = 0;
      fpsT0 = now;
    }
  }
  raf = requestAnimationFrame(frame);

  const api = {
    id,
    quit,
    pause,
    resume,
    get paused() { return paused; },
    get fps() { return fps; },
    get session() { return session; },
    get renderer() { return renderer; },
    setSeed(n) {
      session.dispose();
      session = createSession({ renderer, seed: n, carType: settings.carType, paint: settings.paint });
      session.resize(window.innerWidth, window.innerHeight);
    },
  };
  current = { api, quit };
  hooks.emit('game3d:opened', { id });
  return Promise.resolve(api);
}

/** Test/debug handle exposed as `__ori.game3d`. */
export const game3dDebug = {
  get running() { return !!(current && current.api); },
  get fps() { return current?.api ? Math.round(current.api.fps * 10) / 10 : 0; },
  get paused() { return !!current?.api?.paused; },
  get overlayOpen() { return !!current; },
  /** renderer.info.memory right after the last quit: all zeros when nothing leaked. */
  get lastMemory() { return lastMemory; },
  launch: (id, opts) => launchGame3D(id, opts),
  quit: () => current?.quit(),
  pause: () => current?.api?.pause(),
  resume: () => current?.api?.resume(),
  stats() {
    const a = current?.api;
    if (!a) return null;
    const r = a.renderer.info.render;
    const m = a.renderer.info.memory;
    return { calls: r.calls, triangles: r.triangles, geometries: m.geometries, textures: m.textures, programs: a.renderer.info.programs?.length ?? 0, fps: Math.round(a.fps * 10) / 10, pixelRatio: a.renderer.getPixelRatio() };
  },
  state: () => current?.api?.session.state() ?? null,
  /** Runs n fixed physics steps (1/120 s each) with the autopilot / last input and redraws. */
  step(n = 1) {
    const a = current?.api;
    if (!a) return null;
    a.session.step(n);
    a.session.render(1 / 60);
    return a.session.state();
  },
  setSeed(n) {
    settings.seed = n;
    current?.api?.setSeed(n);
  },
  autopilot(on = true) { if (current?.api) current.api.session.autopilot = on; },
  get seed() { return settings.seed; },
};
