// Window manager for the macOS desktop: creates windows for registered apps, owns focus / z-order / minimise / zoom /
// snap / geometry memory, builds the per-window `ctx` handed to apps and forwards keys + pause/resume to the active app.
// Pointer drag/resize lives in wm-interact.js, geometry helpers in wm-geom.js.
import './wm.css';
import * as sound from '../audio.js';
import { content } from '../content.js';
import { storage } from '../core/storage.js';
import { bus } from '../core/bus.js';
import { achievements } from '../core/achievements.js';
import { notify } from '../core/notify.js';
import { resolve } from './apps/registry.js';
import { LIGHTS } from './apps/shared.js';
import { desktopSize, zoomRect, snapRect, clampRect, loadGeom, saveGeom, rectOf, applyRect } from './wm-geom.js';
import { createInteract, HANDLES_HTML } from './wm-interact.js';

const isTextTarget = (t) => !!t && !!t.closest && !!t.closest('input, textarea, select, [contenteditable="true"]');
const GEO_MS = 280; // zoom / snap animation

/**
 * @param {object} o
 * @param {HTMLElement} o.root        the `.mac` element
 * @param {HTMLElement} o.layer       the `.wins` container
 * @param {() => boolean} o.isLocked  desktop locked (camera not on the screen / boot)
 * @param {() => boolean} o.isCompact flat mode
 * @param {() => number} o.scale      CSS3D scale of the screen (drag maths)
 * @param {object} o.hooks            { beforeOpen(), beforeCreate(def), change(), frontChange(def|null),
 *                                      mini(entry, on) → dock element|null, cursorLock(kind|null) }
 */
export function createWM({ root, layer, isLocked, isCompact, scale, hooks = {} }) {
  const wins = new Map(); // app id → { id, def, el, body, inst, title, keys:Set, minimized, ro, mode, restoreRect, mini }
  let z = 10;
  let frontId = null;

  const entryOf = (el) => (el ? [...wins.values()].find((w) => w.el === el) || null : null);
  const size = () => desktopSize(root);

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
      /** True only for the focused window while the desktop is live — what a render loop should follow. */
      isActive: () => frontId === entry.id && !isLocked() && !entry.minimized,
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

  /** Most recently used window that is not minimised (so closing / minimising the front window hands focus to a visible one). */
  function nextVisible(exceptId) {
    return [...wins.values()].filter((w) => w.id !== exceptId && !w.minimized).sort((a, b) => (+b.el.style.zIndex || 0) - (+a.el.style.zIndex || 0))[0] || null;
  }

  function close(id) {
    const e = wins.get(id);
    if (!e) return;
    e.ro?.disconnect();
    if (e.mini && hooks.mini) hooks.mini(e, false);
    e.inst?.destroy && safe(() => e.inst.destroy(), `${id}.destroy`);
    e.el.classList.add('closing');
    setTimeout(() => e.el.remove(), 170);
    wins.delete(id);
    if (frontId === id) frontId = null;
    if (hooks.change) hooks.change();
    const nxt = nextVisible(id);
    if (nxt) focus(nxt.id);
    else if (hooks.frontChange) hooks.frontChange(null);
    bus.emit('window:close', id);
  }

  // ── geometry: zoom / snap / remembered position ──
  function animateRect(e, rect) {
    e.el.classList.add('geo');
    applyRect(e.el, rect);
    clearTimeout(e.geoTimer);
    e.geoTimer = setTimeout(() => e.el.classList.remove('geo'), GEO_MS + 40);
  }

  /** Puts a window into a snap zone ('zoom' | 'left' | 'right'); `restore` is the rect to return to later. */
  function snap(id, zone, restore) {
    const e = wins.get(id);
    if (!e || isCompact()) return;
    if (e.mode === 'normal') e.restoreRect = restore || rectOf(e.el);
    e.mode = zone;
    e.el.classList.toggle('max', zone === 'zoom');
    e.el.dataset.mode = zone;
    animateRect(e, snapRect(zone, size()));
    if (e.restoreRect) saveGeom(id, e.restoreRect);
    focus(id);
  }
  function leaveMode(id) {
    const e = wins.get(id);
    if (!e) return;
    e.mode = 'normal';
    e.restoreRect = null;
    e.el.classList.remove('max');
    delete e.el.dataset.mode;
  }
  /** Green button / title-bar double-click: fill the desktop between menubar and Dock, or go back. */
  function zoom(id = frontId) {
    const e = wins.get(id);
    if (!e || isCompact()) return;
    if (e.mode === 'zoom') {
      const back = clampRect(e.restoreRect || rectOf(e.el), e.def, size());
      leaveMode(id);
      animateRect(e, back);
      saveGeom(id, back);
    } else if (e.mode !== 'normal') {
      leaveMode(id); // tiled → un-tile first
      animateRect(e, clampRect(e.restoreRect || rectOf(e.el), e.def, size()));
    } else snap(id, 'zoom');
  }
  const toggleMax = zoom; // original name used by the traffic-light handler

  function placeFor(def, index) {
    const saved = loadGeom(def.id);
    if (saved) return clampRect(saved, def, size());
    const { w, h } = def.size;
    const off = index * 18;
    const s = size();
    const x = def.pos ? def.pos.x : Math.max(16, Math.round((s.w - w) / 2));
    const y = def.pos ? def.pos.y : Math.max(40, Math.round((s.h - h) / 2) - 24);
    return clampRect({ x: x + off, y: y + off, w, h }, def, s);
  }

  // ── minimise → Dock (and back) ──
  const dockTarget = (e) => {
    const mini = e.mini;
    const rr = root.getBoundingClientRect(), k = scale() || 1;
    let cx, cy;
    if (mini) {
      const r = mini.getBoundingClientRect();
      cx = (r.left + r.width / 2 - rr.left) / k;
      cy = (r.top + r.height / 2 - rr.top) / k;
    } else { cx = size().w / 2; cy = size().h - 40; }
    return { dx: cx - (e.el.offsetLeft + e.el.offsetWidth / 2), dy: cy - (e.el.offsetTop + e.el.offsetHeight / 2) };
  };

  function minimize(id) {
    const e = wins.get(id);
    if (!e || e.minimized) return;
    e.minimized = true;
    if (hooks.mini) e.mini = hooks.mini(e, true);
    const { dx, dy } = dockTarget(e);
    e.el.style.setProperty('--mx', `${dx.toFixed(1)}px`);
    e.el.style.setProperty('--my', `${dy.toFixed(1)}px`);
    e.el.classList.remove('restoring');
    e.el.classList.add('min');
    pause(e);
    if (frontId === id) {
      const nxt = nextVisible(id);
      if (nxt) focus(nxt.id);
    }
    bus.emit('window:minimize', id);
  }

  /** Un-minimise + focus; resumes the app when it was already the front window (focus alone would not). */
  function restore(id, args) {
    const e = wins.get(id);
    if (!e) return;
    const wasMin = e.minimized;
    const wasFront = frontId === id;
    if (wasMin) {
      e.minimized = false;
      if (e.mini && hooks.mini) hooks.mini(e, false);
      e.mini = null;
      e.el.classList.add('restoring');
      e.el.classList.remove('min');
      clearTimeout(e.restTimer);
      e.restTimer = setTimeout(() => e.el.classList.remove('restoring'), 460);
    }
    if (args && e.inst?.onOpen) safe(() => e.inst.onOpen(args), `${id}.onOpen`);
    focus(id);
    if (wasMin && wasFront && !isLocked()) resume(e);
  }

  const interact = createInteract({
    root, layer, isCompact, scale, entryOf, focus, snap, leaveMode,
    cursorLock: (k) => hooks.cursorLock && hooks.cursorLock(k),
  });

  /** Opens an app by id or alias (`open('about')`). Brings an existing window to the front. Returns the app id or null. */
  function open(idOrAlias, args) {
    const r = resolve(idOrAlias, args || null);
    if (!r) return null;
    const { def } = r;
    if (hooks.beforeOpen) hooks.beforeOpen();
    sound.pop();
    if (typeof def.launch === 'function') { // a launcher (the 3D game): no window, the Dock icon bounces and the game takes over the page
      if (hooks.beforeCreate) hooks.beforeCreate(def);
      def.launch(r.args);
      return def.id;
    }
    if (wins.has(def.id)) { restore(def.id, r.args); return def.id; }
    if (hooks.beforeCreate) hooks.beforeCreate(def);

    const rect = placeFor(def, wins.size);
    const el = document.createElement('section');
    const std = def.titlebar !== 'none';
    el.className = `win win-${def.id}${std ? ' win-std' : ''}${def.category === 'game' || def.chrome === 'game' ? ' win-game' : ''}`;
    el.style.cssText = `left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px;`;
    let body = el;
    if (std) {
      el.innerHTML = `<header class="tb${def.titlebar === 'dark' ? ' dark' : ''}" data-drag>${LIGHTS}<b class="tt c"></b></header><div class="wm-body"></div>`;
      el.querySelector('.tt').textContent = def.name;
      body = el.querySelector('.wm-body');
    }
    layer.appendChild(el);

    const entry = { id: def.id, def, el, body, inst: null, title: def.name, keys: new Set(), minimized: false, ro: null, mode: 'normal', restoreRect: null, mini: null };
    wins.set(def.id, entry);
    if (hooks.change) hooks.change();
    try {
      entry.inst = def.mount(body, makeCtx(entry), r.args) || null;
    } catch (err) {
      console.error(`[wm] mount of "${def.id}" failed`, err);
    }
    // resize handles go in AFTER mount (apps own `el.innerHTML` for titlebar:'none' windows)
    el.insertAdjacentHTML('beforeend', HANDLES_HTML);
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
      if (e.mini && hooks.mini) hooks.mini(e, false);
      e.inst?.destroy && safe(() => e.inst.destroy(), `${e.id}.destroy`);
      e.el.remove();
    });
    wins.clear();
    frontId = null;
    interact.hidePreview();
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

  return {
    open,
    close,
    focus,
    minimize,
    restore,
    zoom,
    snap: (id, zone) => snap(id, zone),
    toggleMax,
    clearAll,
    handleKey,
    onPointerDown: interact.onPointerDown,
    has: (id) => wins.has(id),
    ids: () => [...wins.keys()],
    get: (id) => wins.get(id) || null,
    front: () => frontId,
    entryOf,
    rect: (id) => (wins.has(id) ? rectOf(wins.get(id).el) : null),
    /** App ids whose Dock icon should show the running dot. */
    runningDockIds: () => new Set([...wins.values()].map((w) => w.def.dockId)),
    /** Called when the desktop gets locked / the camera leaves the screen: every app pauses. */
    pauseAll() { wins.forEach(pause); },
    /** Called when the desktop becomes interactive again: the active app resumes. */
    resumeFront() { const e = wins.get(frontId); if (e) resume(e); },
    zoomRect: () => zoomRect(size()),
  };
}
