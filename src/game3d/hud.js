// NEON DRIFT — DOM overlay: HUD (speed, gear, boost, timer), pause menu and the message card. The canvas lives in the same
// overlay element. (T43 grows this into the full race HUD; this is the T41 driving HUD.)
import './game3d.css';

const SVG_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';

export function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}

/** @param {HTMLElement} root the overlay element; the canvas is already inside it */
export function createHud(root, { onPause, onResume, onRestart, onQuit }) {
  const hud = document.createElement('div');
  hud.className = 'g3d-hud';
  hud.innerHTML = `
    <div class="g3d-top">
      <div class="g3d-brand"><i></i>NEON DRIFT</div>
      <div class="g3d-time" data-k="time">0:00.00</div>
      <button class="g3d-pausebtn" type="button" aria-label="Pause (Esc)">${SVG_PAUSE}</button>
    </div>
    <div class="g3d-speed" aria-live="off"><b data-k="speed">0</b><span>KM/H</span><i class="g3d-gear" data-k="gear">1</i></div>
    <div class="g3d-boost"><div class="g3d-boostbar"><i data-k="boost"></i></div><span data-k="boostlabel">BOOST</span></div>
    <div class="g3d-keys" data-k="keys"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> drive</span><span><kbd>Space</kbd> handbrake</span><span><kbd>Shift</kbd> boost</span><span><kbd>R</kbd> reset</span><span><kbd>Esc</kbd> pause</span></div>
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
      <button type="button" class="g3d-btn quit" data-a="quit">Quit to desktop</button>
      <p class="g3d-small">Esc resumes · R resets the car to the road</p>
    </div>`;
  const msg = document.createElement('div');
  msg.className = 'g3d-msg';
  msg.hidden = true;
  msg.setAttribute('role', 'alert');
  root.append(hud, menu, msg);

  const q = (k) => hud.querySelector(`[data-k="${k}"]`);
  const el = { time: q('time'), speed: q('speed'), gear: q('gear'), boost: q('boost'), boostlabel: q('boostlabel'), keys: q('keys'), flash: q('flash') };
  const last = { time: '', speed: -1, gear: -1, boost: -1, boosting: -1 };
  const buttons = [...menu.querySelectorAll('.g3d-btn')];
  const act = { resume: onResume, restart: onRestart, quit: onQuit };
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (b) act[b.dataset.a]?.();
  });
  hud.querySelector('.g3d-pausebtn').addEventListener('click', () => onPause());
  // the key hints fade after a while
  const keyTimer = setTimeout(() => el.keys.classList.add('off'), 9000);

  return {
    root: hud,
    menu,
    /** Per-frame refresh; only touches the DOM when a value changed. */
    update(s) {
      const sp = Math.round(s.speed * 3.6);
      if (sp !== last.speed) { last.speed = sp; el.speed.textContent = sp; }
      const g = s.u < -0.5 ? 'R' : s.gear;
      if (g !== last.gear) { last.gear = g; el.gear.textContent = g; }
      const t = formatTime(s.time);
      if (t !== last.time) { last.time = t; el.time.textContent = t; }
      const b = Math.round(s.boost);
      if (b !== last.boost) { last.boost = b; el.boost.style.transform = `scaleX(${b / 100})`; }
      if (s.boosting !== last.boosting) {
        last.boosting = s.boosting;
        hud.classList.toggle('boosting', !!s.boosting);
        el.boostlabel.textContent = s.boosting ? 'BOOSTING' : b >= 100 ? 'BOOST READY' : 'BOOST';
      }
      hud.classList.toggle('drifting', !!s.drifting);
    },
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
      msg.innerHTML = `<div class="g3d-card"><h2></h2><p></p><div class="g3d-row"></div></div>`;
      msg.querySelector('h2').textContent = title;
      msg.querySelector('p').textContent = body;
      const row = msg.querySelector('.g3d-row');
      for (const a of actions || []) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'g3d-btn' + (a.primary ? ' primary' : '');
        b.textContent = a.label;
        b.addEventListener('click', a.run);
        row.append(b);
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
}
