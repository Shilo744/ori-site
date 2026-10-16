// The 3D game host: opens the full-viewport overlay above the whole site, owns the WebGL renderer + the loop, pauses the room
// while it runs, and tears everything down again on quit (geometries, materials, textures, renderer, GL context). It runs one game at a time
// from the GAMES table (NEON DRIFT, and "Ori, Can You...?"); a game only gets a renderer, an overlay, its input and the clock.
// A game controller offers: open(), update(dt, input), render(dt), resize(w, h), pause(), resume(), paused, onEscape(), onReset(),
// onCamera(), onKey(e), state(), dispose() and a `hud` with message()/clearMessage(); optionally attachInput(input) and onAction(name).
import * as THREE from 'three';
import { createGame } from './game.js';
import { createKeyboard } from './input.js';
import { createHud } from './hud.js';
import { BIOMES } from './biomes.js';
import { defineDriftAchievements } from './achievements3d.js';
import { createFavorsGame } from './favors/game.js';
import { createInput as createFavorsInput } from './favors/input.js';
import { GAME as FAVORS } from './favors/content.js';

/** The games the host can run: how to build the controller and its input, what it is called, the colour behind the canvas. */
const GAMES = {
  drift: { title: 'NEON DRIFT', create: (o) => createGame(o), input: (hooks) => createKeyboard(hooks), clear: 0x07030f },
  favors: { title: FAVORS.title, create: (o) => createFavorsGame(o), input: (hooks, canvas) => createFavorsInput(hooks, canvas), clear: 0xbcd4ea },
};

const hooks = { pauseRoom() {}, resumeRoom() {}, duck() {}, emit() {}, storage: null, scores: null, achievements: null };
const settings = { pixelRatioCap: 2, tier: 'high' };
let current = null;
let lastMemory = null; // renderer.info.memory right after the last session was disposed (leak checks)

/** Wires the host to the page: `pauseRoom()/resumeRoom()` stop/restart the room loop, `duck(v)` scales the room audio, and the core services. */
export function initGame3D(h) {
  Object.assign(hooks, h);
  if (hooks.achievements) defineDriftAchievements(hooks.achievements);
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch { return false; }
}

/**
 * Opens the game. Resolves with the running game (or null if it cannot run here). Only one game runs at a time.
 * @param {string} [id] game id ('drift' | 'favors')
 * @param {object} [opts] { quick: skip the menu and start at once, tier, seed, … } (drift: biome, look, carType, paint)
 */
export function launchGame3D(id = 'drift', opts = {}) {
  if (current) return Promise.resolve(current.api);
  const def = GAMES[id];
  if (!def) return Promise.resolve(null);
  const overlay = document.createElement('div');
  overlay.className = 'g3d';
  overlay.id = 'g3d';
  overlay.dataset.game = id;
  overlay.setAttribute('role', 'application');
  overlay.setAttribute('aria-label', def.title);
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
  let game = null;
  let msgHud = null;
  let kb = null;
  let raf = 0;
  let modal = null; // 'msg' while a message card is up
  let last = performance.now();
  let fpsFrames = 0;
  let fpsT0 = performance.now();
  let fps = 0;
  let gone = false;

  const teardown = () => {
    if (gone) return;
    gone = true;
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('resize', onResize);
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    kb?.dispose();
    msgHud?.dispose();
    game?.dispose();
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
    // no renderer: a friendly card with a way back
    msgHud = createHud(overlay, { onPause() {}, onResume() {}, onRestart() {}, onQuitToMenu() {}, onQuit: quit });
    msgHud.root.hidden = true;
    modal = 'msg';
    msgHud.message(title, body, [{ label: 'Back to desktop', primary: true, run: quit }]);
    kb = createKeyboard({ onKey: onKeyModal });
  }

  if (!webglAvailable()) {
    current = { api: null, quit };
    fail('WebGL 2 is not available', `${def.title} needs a browser with WebGL 2 turned on. Everything else on the site still works.`);
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
  renderer.setClearColor(def.clear, 1);
  renderer.info.autoReset = false; // the composer renders several passes per frame: the session resets the counters once per frame

  game = def.create({
    renderer, overlay, quit, quick: !!opts.quick,
    storage: hooks.storage, scores: hooks.scores, achievements: hooks.achievements, emit: hooks.emit,
    biome: opts.biome, look: opts.look, tier: opts.tier || settings.tier, seed: opts.seed, carType: opts.carType, paint: opts.paint,
  });
  kb = def.input({
    onPause: () => game.onEscape(),
    onReset: () => game.onReset(),
    onCamera: () => game.onCamera(),
    onKey: onKeyModal,
    onAction: (name) => game.onAction && game.onAction(name),
  }, canvas);
  if (game.attachInput) game.attachInput(kb);

  function onKeyModal(e) {
    if (modal === 'msg') {
      if (e.code === 'Escape') { quit(); return true; }
      if (e.code === 'Tab' || e.code === 'Enter' || e.code === 'Space') return 'native';
      return true;
    }
    return game.onKey(e);
  }

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.pixelRatioCap));
    renderer.setSize(w, h, false);
    game.resize(w, h);
    if (game.paused) game.render(0); // a resized canvas is blank until it is drawn again
  }
  function onVis() {
    if (document.hidden) game.pause();
    else last = performance.now();
  }
  function onLost(e) {
    e.preventDefault();
    cancelAnimationFrame(raf);
    modal = 'msg';
    game.hud.message('Graphics interrupted', 'The browser reset the graphics card. The game continues as soon as it is back.', [{ label: 'Back to desktop', run: quit }]);
  }
  function onRestored() {
    game.hud.clearMessage();
    modal = null;
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
    if (!game.paused) {
      game.update(dt, kb);
      game.render(dt);
    }
    fpsFrames++;
    if (now - fpsT0 >= 500) {
      fps = (fpsFrames * 1000) / (now - fpsT0);
      fpsFrames = 0;
      fpsT0 = now;
    }
  }

  const api = {
    id,
    quit,
    pause: () => game.pause(),
    resume: () => game.resume(),
    get paused() { return game.paused; },
    get fps() { return fps; },
    get game() { return game; },
    get session() { return game.session; },
    get renderer() { return renderer; },
  };
  current = { api, quit };
  hooks.emit('game3d:opened', { id });
  if (opts.quick) {
    game.open(); // tests and screenshots: ready on return
    raf = requestAnimationFrame(frame);
  } else {
    // the first build takes a moment: let the overlay paint before it blocks the thread
    overlay.classList.add('booting');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (gone) return;
      game.open();
      overlay.classList.remove('booting');
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }));
  }
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
  /** The biome definitions (tests/dev tweak them: e.g. switch props off to bisect a leak). */
  biomes: BIOMES,
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
  /** The game as the tests see it: phase, the player's car, lap / place … (null until a race exists). */
  state: () => current?.api?.game.state() ?? null,
  /** The controller (menus, race, records) for tests and dev tools. */
  get game() { return current?.api?.game ?? null; },
  /** Runs n fixed physics steps (1/120 s each) with the autopilot / last input and redraws. */
  step(n = 1) {
    const g = current?.api?.game;
    if (!g) return null;
    g.step(n);
    g.render(1 / 60);
    return g.state();
  },
  /** NEON DRIFT: puts the car at arc length s with a speed (m/s). Ori, Can You...?: stands Ori at a place ('cafe') or { x, z }. Redraws. */
  teleport(...a) {
    const g = current?.api?.game;
    if (!g) return null;
    g.teleport(...a);
    g.render(1 / 60);
    return g.state();
  },
  /** Ori, Can You...?: a place's door, rect and walking distance from where Ori is. */
  place(id) { return current?.api?.game?.place?.(id) ?? null; },
  /** Ori, Can You...?: the game clock { hour, label, progress, done }; `setHour(h)` jumps the day. */
  clock() { return current?.api?.game?.clockInfo?.() ?? null; },
  setHour(h) { current?.api?.game?.setHour?.(h); current?.api?.game?.render?.(1 / 60); },
  camera(mode, ...rest) { const g = current?.api?.game; if (g) { g.setCamera(mode, ...rest); g.render(1 / 60); } },
  /** Rebuilds the world: { biome, look, tier, seed } (a free drive stays a free drive, the menu stays the menu). */
  reconfigure(o) { current?.api?.game.reconfigure(o); },
  setSeed(n) { this.reconfigure({ seed: n }); },
  setBiome(id) { this.reconfigure({ biome: id, seed: undefined }); },
  setLook(id) { this.reconfigure({ look: id }); },
  setTier(t) { settings.tier = t; this.reconfigure({ tier: t }); },
  autopilot(on = true) { if (current?.api) current.api.game.autopilot = on; },
  get biome() { return current?.api?.game?.prefs.biome ?? null; },
};
