// Game kit shared by every arcade game: fixed-timestep loop, HiDPI canvas, input (keys / swipe / on-screen pad),
// pointer mapping for the CSS3D screen, HUD pills and the Start / Paused / Game Over overlay.
//
// Typical game:
//   const rt = createRuntime(ctx, { update, render, onSuspend, onResume });   // loop that follows the window lifecycle
//   const input = createInput(ctx, { target: el, keys: {...} });
//   return rt.hooks;                                                          // { pause, resume, onBlur, destroy }
import './games.css';
import { esc } from '../apps/shared.js';

// ───────────────────────── loop ─────────────────────────
/** Fixed-timestep loop: `update(1/hz)` at a constant rate, `render(alpha)` once per animation frame (alpha = 0..1 between updates). */
export function createLoop({ update, render, hz = 60, maxFrame = 0.25, maxSteps = 5 }) {
  const step = 1 / hz;
  let raf = 0;
  let last = 0;
  let acc = 0;
  let running = false;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    acc += Math.min((now - last) / 1000, maxFrame);
    last = now;
    let n = 0;
    while (acc >= step && n < maxSteps) { update(step); acc -= step; n++; }
    if (n === maxSteps) acc = 0; // way behind (slow machine): drop the backlog instead of spiralling
    render(acc / step);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
    },
    get running() { return running; },
  };
}

/**
 * A loop that follows the window lifecycle: it only runs while the window is active, the desktop is live and the page is
 * visible. `hooks` is what a game returns from `mount`.
 */
export function createRuntime(ctx, { update, render, onSuspend, onResume, hz = 60 }) {
  const loop = createLoop({ update, render, hz });
  let alive = true;
  const hooks = {
    pause() { loop.stop(); if (onSuspend) onSuspend(); },
    resume() { if (alive && !document.hidden) { loop.start(); if (onResume) onResume(); } },
    onBlur() { /* pause() follows */ },
    destroy() { alive = false; loop.stop(); },
  };
  const vis = () => { if (document.hidden) hooks.pause(); else if (ctx.isInteractive()) hooks.resume(); };
  document.addEventListener('visibilitychange', vis);
  const origDestroy = hooks.destroy;
  hooks.destroy = () => { document.removeEventListener('visibilitychange', vis); origDestroy(); };
  return { loop, hooks };
}

// ───────────────────────── canvas ─────────────────────────
/** Sizes a canvas for crisp output (device-pixel ratio capped — the screen is a 3D plane, more pixels only cost fps). */
export function fitCanvas(canvas, w, h, maxDpr = 1.5) {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, dpr, w, h };
}

/**
 * Pointer position in the canvas's logical space. Uses offsetX/offsetY (local to the element), because the screen is a
 * CSS3D plane and clientX/clientY are distorted by perspective. Returns null if the event did not land on the canvas.
 */
export function pointerPos(e, canvas, w, h) {
  if (e.target !== canvas) return null;
  return { x: (e.offsetX * w) / canvas.clientWidth, y: (e.offsetY * h) / canvas.clientHeight };
}

/**
 * Scales a fixed-size playfield (`w`×`h` logical px) down to whatever room the window has (flat mode, small windows).
 * `field` is wrapped in a box; `reserve()` returns extra vertical px to keep free (HUD, on-screen pad).
 */
export function createFit(host, field, w, h, { reserve = () => 0, pad = 10 } = {}) {
  const box = document.createElement('div');
  box.className = 'gk-fit';
  field.parentNode.insertBefore(box, field);
  box.appendChild(field);
  field.style.transformOrigin = '0 0';
  const refit = () => {
    const availW = host.clientWidth, availH = host.clientHeight;
    if (!availW || !availH) return;
    const hudH = host.querySelector('.gk-hud')?.offsetHeight || 0;
    const k = Math.max(0.3, Math.min(1, (availW - pad * 2) / w, (availH - hudH - reserve() - pad) / h));
    box.style.width = `${Math.round(w * k)}px`;
    box.style.height = `${Math.round(h * k)}px`;
    field.style.transform = k < 0.999 ? `scale(${k})` : '';
    box.dataset.k = k.toFixed(3);
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(refit) : null;
  if (ro) ro.observe(host);
  refit();
  return { refit, destroy: () => ro && ro.disconnect() };
}

// ───────────────────────── input ─────────────────────────
export const KEYS = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  action: ['Space'],
  pause: ['KeyP', 'Escape'],
  confirm: ['Enter'],
};

/**
 * Action-based input. Keyboard goes through `ctx.onKey` (active window only, never while typing in a field, Ctrl/Cmd/Alt
 * combos are left alone so Spotlight etc. keep working), touch through swipe + `createPad`.
 *   input.on('left', () => …)        handler return `false` = "not handled" (e.g. Esc then leaves the screen)
 *   input.isDown('left')             held right now (keys + pad)
 */
export function createInput(ctx, { target, keys = KEYS, repeat = false, swipe = 28 } = {}) {
  const map = new Map(); // key code → [actions]
  Object.entries(keys).forEach(([action, codes]) => codes.forEach((c) => map.set(c, [...(map.get(c) || []), action])));
  const handlers = new Map(); // action → Set<fn>
  const down = new Set();

  function fire(action, e) {
    const set = handlers.get(action);
    if (!set) return false;
    let handled = false;
    set.forEach((fn) => { if (fn(e) !== false) handled = true; });
    return handled;
  }
  const api = {
    on(action, fn) {
      if (!handlers.has(action)) handlers.set(action, new Set());
      handlers.get(action).add(fn);
      return () => handlers.get(action).delete(fn);
    },
    isDown: (action) => down.has(action),
    /** Programmatic press/release (on-screen pad, swipes). */
    press(action, e) { down.add(action); return fire(action, e); },
    release(action) { down.delete(action); },
    /** Forget held keys (window lost focus: keyup would never arrive). */
    clear() { down.clear(); },
    destroy() { offKey(); api.clear(); handlers.clear(); if (swipeOff) swipeOff(); },
  };

  const offKey = ctx.onKey((e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const actions = map.get(e.code);
    if (!actions) return false;
    if (e.type === 'keyup') { actions.forEach((a) => down.delete(a)); return false; }
    let handled = false;
    actions.forEach((a) => {
      const wasDown = down.has(a);
      down.add(a);
      if (e.repeat && !repeat) { handled = true; return; } // swallow auto-repeat (still consumed so arrows never scroll)
      if (wasDown && !repeat) return;
      if (fire(a, e)) handled = true;
    });
    return handled;
  });

  // swipe (touch / pen): continuous — one long swipe can turn several times
  let swipeOff = null;
  if (target && swipe) {
    let o = null;
    let moved = false;
    const down_ = (e) => {
      if (e.pointerType === 'mouse') return;
      o = { x: e.offsetX, y: e.offsetY };
      moved = false;
      try { target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    const move = (e) => {
      if (!o) return;
      const dx = e.offsetX - o.x, dy = e.offsetY - o.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < swipe) return;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      o = { x: e.offsetX, y: e.offsetY };
      moved = true;
      fire(dir, e);
    };
    const up = (e) => {
      if (o && !moved) fire('tap', e);
      o = null;
    };
    target.addEventListener('pointerdown', down_);
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', () => { o = null; });
    swipeOff = () => {
      target.removeEventListener('pointerdown', down_);
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
    };
  }
  return api;
}

const ARROW = {
  up: '<path d="M12 5l-6 7h4v7h4v-7h4z"/>',
  down: '<path d="M12 19l6-7h-4V5h-4v7H6z"/>',
  left: '<path d="M5 12l7-6v4h7v4h-7v4z"/>',
  right: '<path d="M19 12l-7 6v-4H5v-4h7V6z"/>',
};

/**
 * On-screen controls for touch / flat mode (CSS shows them only when `.mac.compact` or the pointer is coarse).
 * `dirs`: show the D-pad; `buttons`: [{ action, label }] extra round buttons.
 */
export function createPad(parent, input, { dirs = true, buttons = [] } = {}) {
  const el = document.createElement('div');
  el.className = 'gk-pad';
  el.innerHTML = `${dirs ? `<div class="gk-dpad">${['up', 'left', 'right', 'down'].map((d) => `<button type="button" class="gk-pb gk-pb-${d}" data-a="${d}" aria-label="${d}"><svg viewBox="0 0 24 24" aria-hidden="true">${ARROW[d]}</svg></button>`).join('')}</div>` : '<div></div>'}
    <div class="gk-btns">${buttons.map((b) => `<button type="button" class="gk-pb gk-pb-act" data-a="${esc(b.action)}">${esc(b.label)}</button>`).join('')}</div>`;
  parent.appendChild(el);
  const press = (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    e.preventDefault();
    b.classList.add('on');
    try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    input.press(b.dataset.a, e);
  };
  const release = (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    b.classList.remove('on');
    input.release(b.dataset.a);
  };
  el.addEventListener('pointerdown', press);
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  return el;
}

// ───────────────────────── HUD ─────────────────────────
/** Row of rounded stat pills: items = [{ id, label, value, accent }]. `hud.set('score', 12)`, `hud.bump('score')`. */
export function createHud(parent, items) {
  const el = document.createElement('div');
  el.className = 'gk-hud';
  el.innerHTML = items.map((i) => `<div class="gk-pill${i.accent ? ` gk-${esc(i.accent)}` : ''}" data-id="${esc(i.id)}"><span>${esc(i.label)}</span><b>${esc(i.value ?? '')}</b></div>`).join('');
  parent.appendChild(el);
  const val = new Map(items.map((i) => [i.id, el.querySelector(`[data-id="${i.id}"]`)]));
  return {
    el,
    set(id, v) {
      const p = val.get(id);
      if (!p) return;
      const b = p.querySelector('b');
      const s = String(v);
      if (b.textContent !== s) b.textContent = s;
    },
    bump(id) {
      const p = val.get(id);
      if (!p) return;
      p.classList.remove('bump');
      void p.offsetWidth;
      p.classList.add('bump');
    },
    /** Append a clickable pill (e.g. a Walls/Wrap toggle). */
    addButton(id, label, onClick) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'gk-pill gk-toggle';
      b.dataset.id = id;
      b.innerHTML = `<span>${esc(label)}</span><b></b>`;
      b.addEventListener('click', onClick);
      el.appendChild(b);
      val.set(id, b);
      return b;
    },
  };
}

// ───────────────────────── overlay ─────────────────────────
/**
 * Start / Paused / Game Over card. `show({ kicker, title, stats:[{label,value,accent}], hint, primary, secondary, banner })`.
 * Buttons call `onPrimary` / `onSecondary`; Enter is handled by the game (input action `confirm`).
 */
export function createOverlay(parent, { onPrimary, onSecondary } = {}) {
  const el = document.createElement('div');
  el.className = 'gk-ov';
  el.hidden = true;
  el.innerHTML = `<div class="gk-card" role="dialog" aria-live="polite">
    <div class="gk-kicker"></div><h2 class="gk-title"></h2><div class="gk-banner" hidden></div>
    <div class="gk-stats"></div><p class="gk-hint"></p>
    <div class="gk-actions"><button type="button" class="gk-btn gk-primary"></button><button type="button" class="gk-btn gk-secondary" hidden></button></div>
  </div>`;
  parent.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const primary = $('.gk-primary');
  const secondary = $('.gk-secondary');
  primary.addEventListener('click', () => onPrimary && onPrimary());
  secondary.addEventListener('click', () => onSecondary && onSecondary());
  let shown = false;
  return {
    el,
    get visible() { return shown; },
    show({ kicker = '', title = '', stats = [], hint = '', primary: p = 'Play', secondary: s = '', banner = '' } = {}) {
      $('.gk-kicker').textContent = kicker;
      $('.gk-title').textContent = title;
      const bn = $('.gk-banner');
      bn.hidden = !banner;
      bn.textContent = banner;
      $('.gk-stats').innerHTML = stats.map((x) => `<div class="gk-stat${x.accent ? ` gk-${esc(x.accent)}` : ''}"><span>${esc(x.label)}</span><b>${esc(x.value)}</b></div>`).join('');
      $('.gk-hint').textContent = hint;
      primary.textContent = p;
      secondary.hidden = !s;
      secondary.textContent = s;
      el.hidden = false;
      shown = true;
      requestAnimationFrame(() => el.classList.add('in'));
    },
    hide() {
      shown = false;
      el.classList.remove('in');
      el.hidden = true;
    },
  };
}

/** Handy particle pool for the neon look: bursts of fading glow dots. No per-frame allocation after warm-up. */
export function createParticles(max = 120) {
  const p = Array.from({ length: max }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, r: 2, hue: 0, grav: 0 }));
  let cursor = 0;
  return {
    burst(x, y, n, { speed = 90, life = 0.6, r = 2.4, hue = 160, spread = Math.PI * 2, angle = 0, grav = 0 } = {}) {
      for (let i = 0; i < n; i++) {
        const q = p[cursor];
        cursor = (cursor + 1) % max;
        const a = angle + (Math.random() - 0.5) * spread;
        const s = speed * (0.35 + Math.random() * 0.65);
        q.on = true; q.x = x; q.y = y; q.vx = Math.cos(a) * s; q.vy = Math.sin(a) * s;
        q.life = q.max = life * (0.6 + Math.random() * 0.4); q.r = r * (0.6 + Math.random() * 0.7); q.hue = hue + (Math.random() - 0.5) * 24; q.grav = grav;
      }
    },
    update(dt) {
      for (let i = 0; i < max; i++) {
        const q = p[i];
        if (!q.on) continue;
        q.life -= dt;
        if (q.life <= 0) { q.on = false; continue; }
        q.vy += q.grav * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vx *= 0.985; q.vy *= 0.985;
      }
    },
    draw(g) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < max; i++) {
        const q = p[i];
        if (!q.on) continue;
        const k = q.life / q.max;
        g.globalAlpha = k;
        g.fillStyle = `hsl(${q.hue} 100% 62%)`;
        g.beginPath();
        g.arc(q.x, q.y, q.r * (0.4 + k * 0.6), 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    },
    clear() { p.forEach((q) => { q.on = false; }); },
  };
}
