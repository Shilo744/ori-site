// Window manager for the macOS desktop: creates windows for registered apps, owns focus / z-order / minimise /
// zoom / drag, builds the per-window `ctx` handed to apps and forwards keys + pause/resume to the active app.
import './wm.css';
import * as sound from '../audio.js';
import { content } from '../content.js';
import { SCREEN_PX } from '../screen-size.js';
import { storage } from '../core/storage.js';
import { bus } from '../core/bus.js';
import { achievements } from '../core/achievements.js';
import { notify } from '../core/notify.js';
import { resolve } from './apps/registry.js';
import { LIGHTS } from './apps/shared.js';

const isTextTarget = (t) => !!t && !!t.closest && !!t.closest('input, textarea, select, [contenteditable="true"]');

/**
 * @param {object} o
 * @param {HTMLElement} o.root        the `.mac` element
 * @param {HTMLElement} o.layer       the `.wins` container
 * @param {() => boolean} o.isLocked  desktop locked (camera not on the screen / boot)
 * @param {() => boolean} o.isCompact flat mode
 * @param {() => number} o.scale      CSS3D scale of the screen (drag maths)
 * @param {object} o.hooks            { beforeOpen(), beforeCreate(def), change(), frontChange(def|null) }
 */
export function createWM({ root, layer, isLocked, isCompact, scale, hooks = {} }) {
  const wins = new Map(); // app id → { id, def, el, body, inst, title, keys:Set, minimized, ro }
  let z = 10;
  let frontId = null;

  const entryOf = (el) => [...wins.values()].find((w) => w.el === el) || null;

  function makeCtx(entry) {
    return {
      sound,
      storage,
      bus,
      achievements,
      notify,
      content,
      open: (id, args) => open(id, args),
      win: {
        setTitle(t) {
          entry.title = String(t);
          const tt = entry.el.querySelector(':scope > header .tt');
          if (tt) tt.textContent = entry.title;
        },
        close: () => close(entry.id),
        size: () => ({ w: entry.el.offsetWidth, h: entry.el.offsetHeight }),
      },
      /** Key handler for this window: gets keydown + keyup while it is the active window and the desktop is live. Return true to preventDefault. */
      onKey(handler) {
        entry.keys.add(handler);
        return () => entry.keys.delete(handler);
      },
      isInteractive: () => !isLocked() && !entry.minimized,
      isCompact,
    };
  }

  const safe = (fn, what) => { try { fn(); } catch (e) { console.error(`[wm] ${what} failed`, e); } };
  const pause = (e) => e.inst && e.inst.pause && safe(() => e.inst.pause(), `${e.id}.pause`);
  const resume = (e) => e.inst && e.inst.resume && !e.minimized && safe(() => e.inst.resume(), `${e.id}.resume`);

  function setFront(id) {
    if (frontId === id) return;
    const prev = wins.get(frontId);
    frontId = id;
    if (prev) { prev.inst?.onBlur && safe(() => prev.inst.onBlur(), `${prev.id}.onBlur`); pause(prev); }
    const next = wins.get(id);
    if (next) {
      next.inst?.onFocus && safe(() => next.inst.onFocus(), `${next.id}.onFocus`);
      if (!isLocked()) resume(next);
    }
    if (hooks.frontChange) hooks.frontChange(next ? next.def : null);
    bus.emit('window:focus', id);
  }

  function focus(id) {
    const e = wins.get(id);
    if (!e) return;
    e.el.style.zIndex = ++z;
    wins.forEach((v) => v.el.classList.remove('active'));
    e.el.classList.add('active');
    setFront(id);
  }

  function close(id) {
    const e = wins.get(id);
    if (!e) return;
    e.ro?.disconnect();
    e.inst?.destroy && safe(() => e.inst.destroy(), `${id}.destroy`);
    e.el.classList.add('closing');
    setTimeout(() => e.el.remove(), 170);
    wins.delete(id);
    if (frontId === id) frontId = null;
    if (hooks.change) hooks.change();
    const last = [...wins.keys()].pop();
    if (last) focus(last);
    else if (hooks.frontChange) hooks.frontChange(null);
    bus.emit('window:close', id);
  }

  function minimize(id) {
    const e = wins.get(id);
    if (!e || e.minimized) return;
    e.minimized = true;
    e.el.classList.add('min');
    pause(e);
  }

  /** Un-minimise + focus; resumes the app when it was already the front window (focus alone would not). */
  function restore(id, args) {
    const e = wins.get(id);
    if (!e) return;
    const wasMin = e.minimized;
    const wasFront = frontId === id;
    e.minimized = false;
    e.el.classList.remove('min');
    if (args && e.inst?.onOpen) safe(() => e.inst.onOpen(args), `${id}.onOpen`);
    focus(id);
    if (wasMin && wasFront && !isLocked()) resume(e);
  }

  function toggleMax(id) {
    const e = wins.get(id);
    if (e) e.el.classList.toggle('max');
  }

  function place(def, index) {
    const { w, h } = def.size;
    const off = index * 18;
    const x = def.pos ? def.pos.x : Math.max(16, Math.round((SCREEN_PX.w - w) / 2));
    const y = def.pos ? def.pos.y : Math.max(40, Math.round((SCREEN_PX.h - h) / 2) - 24);
    return { x: x + off, y: y + off };
  }

  /** Opens an app by id or alias (`open('about')`). Brings an existing window to the front. Returns the app id or null. */
  function open(idOrAlias, args) {
    const r = resolve(idOrAlias, args || null);
    if (!r) return null;
    const { def } = r;
    if (hooks.beforeOpen) hooks.beforeOpen();
    sound.pop();
    if (wins.has(def.id)) { restore(def.id, r.args); return def.id; }
    if (hooks.beforeCreate) hooks.beforeCreate(def);

    const { x, y } = place(def, wins.size);
    const el = document.createElement('section');
    const std = def.titlebar !== 'none';
    el.className = `win win-${def.id}${std ? ' win-std' : ''}${def.category === 'game' || def.chrome === 'game' ? ' win-game' : ''}`;
    el.style.cssText = `left:${x}px;top:${y}px;width:${def.size.w}px;height:${def.size.h}px;`;
    let body = el;
    if (std) {
      el.innerHTML = `<header class="tb${def.titlebar === 'dark' ? ' dark' : ''}" data-drag>${LIGHTS}<b class="tt c"></b></header><div class="wm-body"></div>`;
      el.querySelector('.tt').textContent = def.name;
      body = el.querySelector('.wm-body');
    }
    layer.appendChild(el);

    const entry = { id: def.id, def, el, body, inst: null, title: def.name, keys: new Set(), minimized: false, ro: null };
    wins.set(def.id, entry);
    if (hooks.change) hooks.change();
    try {
      entry.inst = def.mount(body, makeCtx(entry), r.args) || null;
    } catch (err) {
      console.error(`[wm] mount of "${def.id}" failed`, err);
    }
    if (entry.inst && entry.inst.onResize && typeof ResizeObserver !== 'undefined') {
      entry.ro = new ResizeObserver(() => safe(() => entry.inst.onResize(el.offsetWidth, el.offsetHeight), `${def.id}.onResize`));
      entry.ro.observe(el);
    }
    focus(def.id);
    bus.emit('window:open', def.id);
    return def.id;
  }

  function clearAll() {
    [...wins.values()].forEach((e) => {
      e.ro?.disconnect();
      e.inst?.destroy && safe(() => e.inst.destroy(), `${e.id}.destroy`);
      e.el.remove();
    });
    wins.clear();
    frontId = null;
    if (hooks.change) hooks.change();
    if (hooks.frontChange) hooks.frontChange(null);
  }

  /** keydown / keyup from the page → the active app's handlers (only while the desktop is live). */
  function handleKey(e) {
    if (isLocked() || !root.isConnected) return;
    const cur = wins.get(frontId);
    if (!cur || cur.minimized || !cur.keys.size) return;
    if (isTextTarget(e.target)) return;
    let consumed = false;
    cur.keys.forEach((h) => { try { if (h(e) === true) consumed = true; } catch (err) { console.error('[wm] key handler failed', err); } });
    if (consumed) e.preventDefault();
  }

  /** Pointer down anywhere on the desktop: focus the window under it and start a drag from its title bar. */
  function onPointerDown(e) {
    const winEl = e.target.closest('.win');
    if (winEl) { const en = entryOf(winEl); if (en) focus(en.id); }
    const bar = e.target.closest('[data-drag]');
    if (!bar || !winEl || e.target.closest('.lights, button, input, textarea, a, .ic, .nav, .seg, .search, .addr') || isCompact() || winEl.classList.contains('max')) return;
    const sx = e.clientX, sy = e.clientY, ox = winEl.offsetLeft, oy = winEl.offsetTop;
    const k = scale() || 1;
    bar.setPointerCapture(e.pointerId);
    const move = (ev) => {
      winEl.style.left = `${Math.max(-winEl.offsetWidth + 140, Math.min(root.offsetWidth - 140, ox + (ev.clientX - sx) / k))}px`;
      winEl.style.top = `${Math.max(32, Math.min(root.offsetHeight - 120, oy + (ev.clientY - sy) / k))}px`;
    };
    const up = () => {
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up);
      bar.removeEventListener('pointercancel', up);
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', up);
  }

  return {
    open,
    close,
    focus,
    minimize,
    restore,
    toggleMax,
    clearAll,
    handleKey,
    onPointerDown,
    has: (id) => wins.has(id),
    ids: () => [...wins.keys()],
    get: (id) => wins.get(id) || null,
    front: () => frontId,
    entryOf,
    /** App ids whose Dock icon should show the running dot. */
    runningDockIds: () => new Set([...wins.values()].map((w) => w.def.dockId)),
    /** Called when the desktop gets locked / the camera leaves the screen: every app pauses. */
    pauseAll() { wins.forEach(pause); },
    /** Called when the desktop becomes interactive again: the active app resumes. */
    resumeFront() { const e = wins.get(frontId); if (e) resume(e); },
  };
}
