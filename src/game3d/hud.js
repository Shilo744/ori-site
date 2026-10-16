// NEON DRIFT — the in-game DOM overlay: the race HUD (speed + rev arc + gear, boost, lap, position, standings, lap time + delta,
// minimap, toasts, countdown, wrong-way warning), the pause menu and the message card. The canvas lives in the same overlay.
import './game3d.css';
import { fmtTime, fmtDelta } from './records.js';
import { createMinimap } from './minimap.js';

const SVG_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
const ARC_LEN = 251.3; // length of the rev arc path (240° of a circle of radius 60)

/**
 * @param {HTMLElement} root the overlay element; the canvas is already inside it
 * @param {object} cb { onPause, onResume, onRestart, onQuitToMenu, onQuit }
 */
export function createHud(root, { onPause, onResume, onRestart, onQuitToMenu, onQuit }) {
  const hud = document.createElement('div');
  hud.className = 'g3d-hud';
  hud.innerHTML = `
    <div class="g3d-tl" data-k="race">
      <div class="g3d-pos"><small>POS</small><b data-k="place">1</b><span data-k="cars">/6</span></div>
      <div class="g3d-lap"><small>LAP</small><b data-k="lap">1</b><span data-k="laps">/3</span></div>
      <ol class="g3d-board" data-k="board" aria-label="Standings"></ol>
    </div>
    <div class="g3d-tc">
      <div class="g3d-time" data-k="time">0:00.00</div>
      <div class="g3d-delta" data-k="delta"></div>
      <div class="g3d-best" data-k="bestbox" hidden><small>BEST</small> <b data-k="best">—</b></div>
    </div>
    <div class="g3d-tr">
      <canvas class="g3d-map" data-k="map" width="170" height="170" aria-hidden="true"></canvas>
      <button class="g3d-pausebtn" type="button" aria-label="Pause (Esc)">${SVG_PAUSE}</button>
    </div>
    <div class="g3d-gauge" aria-live="off">
      <svg viewBox="0 0 160 160" aria-hidden="true"><path class="g3d-arc-bg" d="M 29.3 120.7 A 60 60 0 1 1 130.7 120.7"/><path class="g3d-arc" data-k="arc" d="M 29.3 120.7 A 60 60 0 1 1 130.7 120.7" stroke-dasharray="${ARC_LEN}" stroke-dashoffset="${ARC_LEN}"/></svg>
      <div class="g3d-speed"><b data-k="speed">0</b><span>KM/H</span></div>
      <i class="g3d-gear" data-k="gear">1</i>
    </div>
    <div class="g3d-boost"><div class="g3d-boostbar"><i data-k="boost"></i></div><span data-k="boostlabel">BOOST</span></div>
    <div class="g3d-toasts" data-k="toasts" aria-live="polite"></div>
    <div class="g3d-cd" data-k="cd" aria-hidden="true"></div>
    <div class="g3d-warn" data-k="warn" role="alert" hidden>WRONG WAY</div>
    <div class="g3d-skip" data-k="skip" hidden>Press <kbd>Space</kbd> to skip</div>
    <div class="g3d-keys" data-k="keys"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> drive</span><span><kbd>Space</kbd> handbrake</span><span><kbd>Shift</kbd> boost</span><span><kbd>R</kbd> reset</span><span><kbd>C</kbd> camera</span><span><kbd>Esc</kbd> pause</span></div>
    <div class="g3d-flash" data-k="flash" aria-hidden="true"></div>`;
  const menu = document.createElement('div');
  menu.className = 'g3d-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', 'Paused');
  menu.innerHTML = `
    <div class="g3d-card">
      <div class="g3d-kicker">NEON DRIFT</div>
      <h2>Paused</h2>
      <button type="button" class="g3d-btn primary" data-a="resume">Resume</button>
      <button type="button" class="g3d-btn" data-a="restart">Restart</button>
      <button type="button" class="g3d-btn" data-a="menu">Quit to menu</button>
      <button type="button" class="g3d-btn quit" data-a="quit">Quit to desktop</button>
      <p class="g3d-small">Esc resumes · R puts the car back on the road</p>
    </div>`;
  const msg = document.createElement('div');
  msg.className = 'g3d-msg';
  msg.hidden = true;
  msg.setAttribute('role', 'alert');
  root.append(hud, menu, msg);

  const q = (k) => hud.querySelector(`[data-k="${k}"]`);
  const el = Object.fromEntries(['race', 'place', 'cars', 'lap', 'laps', 'board', 'time', 'delta', 'bestbox', 'best', 'map', 'arc', 'speed', 'gear', 'boost', 'boostlabel', 'toasts', 'cd', 'warn', 'skip', 'keys', 'flash'].map((k) => [k, q(k)]));
  const last = {};
  const set = (k, v, node = el[k]) => { if (last[k] !== v) { last[k] = v; node.textContent = v; } };
  const buttons = [...menu.querySelectorAll('.g3d-btn')];
  const act = { resume: onResume, restart: onRestart, menu: onQuitToMenu, quit: onQuit };
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (b && act[b.dataset.a]) act[b.dataset.a]();
  });
  hud.querySelector('.g3d-pausebtn').addEventListener('click', () => onPause());
  let keyTimer = setTimeout(() => el.keys.classList.add('off'), 9000);
  let minimap = null;
  let rowEls = [];

  const api = {
    root: hud,
    menu,
    /** Which parts show: { race: standings / lap / position, map }. */
    setMode({ race = true, map = true } = {}) {
      el.race.hidden = !race;
      el.map.hidden = !map;
    },
    /** Remembers the track for the minimap and the rows of the standings. */
    setTrack(track, rows) {
      minimap = createMinimap(el.map, track);
      el.board.innerHTML = rows.map((r, i) => `<li data-i="${i}"><i style="--c:${r.color}"></i><span>${r.name}</span><em></em></li>`).join('');
      rowEls = [...el.board.children]; // in entry order: the standings reorder the DOM, these stay put
      last.board = null;
    },
    /** Per-frame refresh; only touches the DOM when a value changed. */
    update(s) {
      set('speed', Math.round(s.speed * 3.6));
      set('gear', s.u < -0.5 ? 'R' : s.gear);
      const rev = Math.round(s.rev * 100) / 100;
      if (last.rev !== rev) { last.rev = rev; el.arc.style.strokeDashoffset = String(ARC_LEN * (1 - rev)); el.arc.classList.toggle('red', rev > 0.9); }
      const b = Math.round(s.boost);
      if (last.boost !== b) { last.boost = b; el.boost.style.transform = `scaleX(${b / 100})`; }
      if (last.boosting !== s.boosting) {
        last.boosting = s.boosting;
        hud.classList.toggle('boosting', !!s.boosting);
        set('boostlabel', s.boosting ? 'BOOSTING' : b >= 100 ? 'BOOST READY' : 'BOOST');
      }
      hud.classList.toggle('drifting', !!s.drifting);
      set('time', fmtTime(s.lapTime));
      if (s.race) {
        set('place', s.place); set('cars', `/${s.cars}`); set('lap', s.lap); set('laps', `/${s.laps}`);
      }
      // delta against the best lap, shown for a few seconds after each gate
      const showDelta = s.delta != null && s.deltaAge < 3.5;
      const d = showDelta ? fmtDelta(s.delta) : '';
      if (last.delta !== d) { last.delta = d; el.delta.textContent = d; el.delta.className = `g3d-delta${d ? (s.delta < 0 ? ' up' : ' down') : ''}`; }
      if (s.best !== last.bestRaw) { last.bestRaw = s.best; el.bestbox.hidden = !s.best; if (s.best) set('best', fmtTime(s.best)); }
      if (s.warn !== last.warnRaw) { last.warnRaw = s.warn; el.warn.hidden = !s.warn; el.warn.textContent = s.warn || ''; }
      if (minimap && s.mapDots) minimap.draw(s.mapDots, s.t);
    },
    /** The standings table: rows = [{ i (row index), gap, you }] already ordered. */
    setBoard(order) {
      const key = order.map((o) => `${o.i}:${o.gap}`).join('|');
      if (last.board === key) return;
      last.board = key;
      order.forEach((o, n) => {
        const li = rowEls[o.i];
        el.board.appendChild(li);
        li.classList.toggle('you', !!o.you);
        li.querySelector('em').textContent = o.gap;
        li.dataset.p = n + 1;
      });
    },
    /** A floating message: kind = 'drift' | 'boost' | 'best' | 'lap' | 'info' | 'warn'. */
    toast(text, kind = 'info', ms = 1800) {
      const t = document.createElement('div');
      t.className = `g3d-toast ${kind}`;
      t.textContent = text;
      el.toasts.appendChild(t);
      while (el.toasts.children.length > 3) el.toasts.firstChild.remove();
      setTimeout(() => t.classList.add('out'), ms);
      setTimeout(() => t.remove(), ms + 350);
    },
    /** Big centre text: 3, 2, 1, GO — or '' to clear. */
    countdown(text, go = false) {
      if (last.cd === text) return;
      last.cd = text;
      el.cd.textContent = text;
      el.cd.className = `g3d-cd${text ? ' on' : ''}${go ? ' go' : ''}`;
      if (text) { void el.cd.offsetWidth; el.cd.classList.add('pop'); }
    },
    skipHint(on) { el.skip.hidden = !on; },
    hideKeys() { clearTimeout(keyTimer); el.keys.classList.add('off'); },
    showKeys() { el.keys.classList.remove('off'); clearTimeout(keyTimer); keyTimer = setTimeout(() => el.keys.classList.add('off'), 9000); },
    show(on) { hud.hidden = !on; },
    showMenu() {
      menu.hidden = false;
      hud.classList.add('dim');
      buttons[0].focus({ preventScroll: true });
    },
    hideMenu() {
      menu.hidden = true;
      hud.classList.remove('dim');
    },
    get menuOpen() { return !menu.hidden; },
    /** Moves the focus through the menu buttons (arrow keys). */
    moveFocus(d) {
      const i = buttons.indexOf(document.activeElement);
      buttons[(i + d + buttons.length) % buttons.length].focus({ preventScroll: true });
    },
    message(title, body, actions) {
      msg.hidden = false;
      msg.innerHTML = '<div class="g3d-card"><h2></h2><p></p><div class="g3d-row"></div></div>';
      msg.querySelector('h2').textContent = title;
      msg.querySelector('p').textContent = body;
      const row = msg.querySelector('.g3d-row');
      for (const a of actions || []) {
        const bt = document.createElement('button');
        bt.type = 'button';
        bt.className = `g3d-btn${a.primary ? ' primary' : ''}`;
        bt.textContent = a.label;
        bt.addEventListener('click', a.run);
        row.append(bt);
      }
      row.querySelector('button')?.focus({ preventScroll: true });
    },
    clearMessage() { msg.hidden = true; msg.innerHTML = ''; },
    flash(kind) {
      el.flash.className = 'g3d-flash';
      void el.flash.offsetWidth; // restart the animation
      el.flash.classList.add('on', kind);
    },
    dispose() { clearTimeout(keyTimer); hud.remove(); menu.remove(); msg.remove(); },
  };
  return api;
}
