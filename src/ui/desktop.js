// The "macOS" shown on the MacBook screen. Plain DOM, rendered into the 3D scene by CSS3DRenderer.
// This file wires the pieces together: shell markup, window manager (wm.js), menubar, overlays and power.
// The apps themselves live in ./apps/ and register through apps/registry.js.
import * as sound from '../audio.js';
import { SCREEN_PX } from '../screen-size.js';
import { listApps, listAliases } from './apps/registry.js';
import './apps/index.js';
import { shellHTML } from './shell.js';
import { createWM } from './wm.js';
import { createMenubar } from './menubar.js';
import { createOverlays } from './overlays.js';

export function createDesktop(opts = {}) {
  const root = document.createElement('div');
  root.className = 'mac locked';
  root.innerHTML = shellHTML();

  const q = (sel) => root.querySelector(sel);
  const mbApp = q('#mb-app');
  const dock = q('.dock');
  const boot = q('.boot');

  const scale = () => (root.offsetWidth ? root.getBoundingClientRect().width / root.offsetWidth : 1);
  const isCompact = () => root.classList.contains('compact');
  const isLocked = () => root.classList.contains('locked');

  // ── clock + widgets ──
  function tick() {
    const d = new Date();
    const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
    const mo = d.toLocaleDateString('en-US', { month: 'short' });
    let h = d.getHours();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    q('#mb-clock').textContent = `${wd} ${mo} ${d.getDate()}  ${h}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`;
    q('#wg-day').textContent = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    q('#wg-date').textContent = d.getDate();
  }
  tick();
  setInterval(tick, 15000);

  // ── Dock ──
  const bounce = (btn) => {
    if (!btn) return;
    btn.classList.remove('bounce');
    void btn.offsetWidth;
    btn.classList.add('bounce');
  };
  const setDock = () => {
    const running = wm.runningDockIds();
    root.querySelectorAll('.dk[data-app]').forEach((b) => b.classList.toggle('on', running.has(b.dataset.app)));
  };

  // ── window manager, menubar, overlays ──
  const wm = createWM({
    root,
    layer: q('.wins'),
    isLocked,
    isCompact,
    scale,
    hooks: {
      beforeOpen: () => menubar.close(),
      beforeCreate: (def) => bounce(root.querySelector(`.dk[data-app="${def.dockId}"]`)),
      change: setDock,
      frontChange: (def) => { mbApp.textContent = def ? def.name : 'Finder'; },
    },
  });
  const power = { restart: () => restart(), shutdown: () => shutdown() };
  const menubar = createMenubar({ root, menuLayer: q('.menus'), appLabel: mbApp, cc: q('.cc'), wm, scale, power });
  const overlays = createOverlays({ root, wm, closeMenus: () => menubar.close(), onVolume: opts.onVolume });

  // ── power ──
  function restart() {
    menubar.close();
    wm.clearAll();
    boot.dataset.wake = '';
    api.boot().then(() => wm.open('welcome'));
  }
  function shutdown() {
    menubar.close();
    wm.clearAll();
    boot.classList.remove('run', 'done');
    boot.classList.add('shut');
    boot.dataset.wake = '1';
  }

  // ── events ──
  root.addEventListener('click', (e) => {
    const t = e.target;
    if (boot.dataset.wake) { restart(); return; }
    overlays.onClickAway(t);
    if (menubar.handleClick(e)) return;
    overlays.onClickAwayCC(t);
    if (menubar.isOpen() && !t.closest('.menu')) menubar.close();

    const act = t.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'spot') { overlays.openSpot(); return; }
      if (a === 'cc') { overlays.toggleCC(); sound.click(); return; }
      const entry = wm.entryOf(act.closest('.win'));
      if (!entry) return;
      sound.click();
      if (a === 'close') wm.close(entry.id);
      if (a === 'min') wm.minimize(entry.id);
      if (a === 'max') wm.toggleMax(entry.id);
      return;
    }
    const dk = t.closest('.dk');
    if (dk) {
      if (dk.dataset.trash) { sound.pop(); bounce(dk); return; }
      wm.open(dk.dataset.open);
      return;
    }
    const op = t.closest('[data-open]');
    if (op) wm.open(op.dataset.open);
  });

  root.addEventListener('dblclick', (e) => {
    const d = e.target.closest('[data-dopen]');
    if (d) wm.open(d.dataset.dopen);
  });
  root.addEventListener('mouseover', (e) => menubar.handleHover(e));
  root.addEventListener('pointerdown', (e) => wm.onPointerDown(e));
  root.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) sound.key();
  });
  // keys for the active app (games, shortcuts) — see ctx.onKey in wm.js
  window.addEventListener('keydown', (e) => wm.handleKey(e));
  window.addEventListener('keyup', (e) => wm.handleKey(e));

  // ── dock magnification (gaussian, like the real thing) ──
  let rest = null;
  dock.addEventListener('pointerenter', () => {
    rest = [...dock.querySelectorAll('.dk')].map((b) => {
      const r = b.getBoundingClientRect();
      return { b, cx: r.left + r.width / 2 };
    });
  });
  dock.addEventListener('pointermove', (e) => {
    if (!rest) return;
    const k = scale() || 1;
    rest.forEach(({ b, cx }) => {
      const d = (e.clientX - cx) / k;
      const s = 1 + 0.62 * Math.exp(-(d * d) / (2 * 50 * 50));
      b.style.setProperty('--s', s.toFixed(3));
    });
  });
  dock.addEventListener('pointerleave', () => {
    rest = null;
    dock.querySelectorAll('.dk').forEach((b) => b.style.removeProperty('--s'));
  });

  // ── cursor (drawn inside the screen so it has the right size & perspective) ──
  const cur = q('.cur');
  cur.dataset.k = 'arrow';
  function probeCursor(cx, cy) {
    const el = document.elementFromPoint(cx, cy);
    let kind = 'arrow';
    if (el && root.contains(el)) {
      if (el.closest('input, textarea')) kind = 'text';
      else if (el.closest('a[href]')) kind = 'hand';
    }
    if (cur.dataset.k !== kind) cur.dataset.k = kind;
  }

  const api = {
    root,
    wm,
    /** Opens an app (or alias such as `about`). Returns the app id, or null for an unknown id. */
    open: (id, args) => wm.open(id, args),
    listApps: () => listApps().map((a) => a.id),
    listAliases,
    setLocked(v) {
      root.classList.toggle('locked', v);
      if (v) { menubar.close(); overlays.closeSpot(); wm.pauseAll(); }
      else wm.resumeFront();
    },
    setCompact(v) { root.classList.toggle('compact', v); },
    boot() {
      boot.classList.remove('done', 'shut', 'run');
      void boot.offsetWidth;
      boot.classList.add('run');
      return new Promise((res) => {
        setTimeout(() => { boot.classList.add('done'); res(); }, opts.fast ? 200 : 2700);
      });
    },
    reset() { wm.clearAll(); },
    moveCursor(x, y) {
      if (isLocked() || isCompact()) { cur.hidden = true; return; }
      const inside = x >= 0 && y >= 0 && x <= SCREEN_PX.w && y <= SCREEN_PX.h;
      cur.hidden = !inside;
      if (inside) cur.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    },
    hideCursor() { cur.hidden = true; },
    probeCursor,
    /** Closes menus / Spotlight / Control Center. Returns true if something was open. */
    closeOverlays() {
      const had = !overlays.spotHidden() || menubar.isOpen() || !overlays.cc.hidden;
      overlays.closeSpot();
      menubar.close();
      return !!had;
    },
  };
  return api;
}
