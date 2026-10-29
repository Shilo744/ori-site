// "Ori, Can You...?" — the DOM side of the game: clock, place label, stamina, pause menu, message card, touch controls. The canvas lives in
// the same overlay (host.js). Only touches the DOM when a value changed.
import '../game3d.css';
import './favors.css';
import { GAME } from './content.js';
import { TEXT } from './texts.js';

const SVG_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>';

/**
 * @param {HTMLElement} root the overlay
 * @param {{ onPause: () => void, onResume: () => void, onRestart: () => void, onQuit: () => void }} cb
 */
export function createFavorsHud(root, { onPause, onResume, onRestart, onQuit }) {
  const hud = document.createElement('div');
  hud.className = 'fv-hud';
  hud.innerHTML = `
    <div class="fv-clock fv-glass"><b data-k="time">06:00</b><span data-k="label">Morning</span><div class="fv-day"><i data-k="day"></i></div></div>
    <div class="fv-meters fv-glass"><div class="fv-meter love"><span>LOVE</span><div><i data-k="chaos"></i></div><b data-k="chaosn">0</b></div><div class="fv-meter boxer"><span>BOXER</span><div><i data-k="fav"></i></div><b data-k="score">Lv 1</b></div></div>
    <div class="fv-place fv-glass" data-k="place" aria-live="polite"><small data-k="kind"></small><span data-k="name"></span></div>
    <div class="fv-goal fv-glass" data-k="goal" aria-live="polite"><span data-k="goalt"></span><small data-k="goalm"></small></div>
    <div class="fv-arrow" data-k="arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3l8 16-8-4-8 4z"/></svg><span data-k="arrowl"></span></div>
    <div class="fv-tr"><button class="fv-btn fv-glass" type="button" data-k="pause" aria-label="Pause (Esc)">${SVG_PAUSE}</button></div>
    <div class="fv-stam" data-k="stam" aria-hidden="true"><i data-k="stamfill"></i></div>
    <div class="fv-keys fv-glass" data-k="keys"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move</span><span><kbd>Shift</kbd> sprint</span><span><kbd>H</kbd> say hi</span><span><kbd>Space</kbd> use</span><span><kbd>M</kbd> map</span><span><kbd>Tab</kbd> journal</span><span><kbd>Q</kbd><kbd>E</kbd> camera</span><span><kbd>Esc</kbd> pause</span></div>
    <div class="fv-toasts" data-k="toasts" aria-live="polite"></div>
    <div class="fv-touch" data-k="touch"><div class="fv-pad" data-k="pad"><i data-k="knob"></i></div><button type="button" class="fv-act sprint" data-k="sprint">Run</button><button type="button" class="fv-act do" data-k="do">Use</button></div>`;
  const menu = document.createElement('div');
  menu.className = 'g3d-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', 'Paused');
  menu.innerHTML = `
    <div class="g3d-card">
      <div class="g3d-kicker">${GAME.title}</div>
      <h2>Paused</h2>
      <button type="button" class="g3d-btn primary" data-a="resume">Resume</button>
      <button type="button" class="g3d-btn" data-a="restart">Start the day again</button>
      <button type="button" class="g3d-btn quit" data-a="quit">Back to the desktop</button>
      <p class="g3d-small">${TEXT.pausedHint}</p>
    </div>`;
  const msg = document.createElement('div');
  msg.className = 'g3d-msg';
  msg.hidden = true;
  msg.setAttribute('role', 'alert');
  root.append(hud, menu, msg);

  const q = (k) => hud.querySelector(`[data-k="${k}"]`);
  const el = Object.fromEntries(['time', 'label', 'day', 'place', 'kind', 'name', 'stam', 'stamfill', 'keys', 'toasts', 'touch', 'pad', 'knob', 'sprint', 'do', 'chaos', 'chaosn', 'fav', 'score', 'goal', 'goalt', 'goalm', 'arrow', 'arrowl'].map((k) => [k, q(k)]));
  const last = {};
  const setText = (k, v) => { if (last[k] !== v) { last[k] = v; el[k].textContent = v; } };
  const act = { resume: onResume, restart: onRestart, quit: onQuit };
  menu.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (b && act[b.dataset.a]) act[b.dataset.a](); });
  q('pause').addEventListener('click', () => onPause());
  const keyTimer = setTimeout(() => el.keys.classList.add('off'), 14000);
  let stamTimer = 0;
  let msgButtons = [];

  // touch controls: shown on coarse pointers; the joystick feeds input.stick, the buttons feed sprint / use
  let input = null;
  let onUse = () => {};
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  function bindTouch(inp, use) {
    input = inp;
    onUse = use;
    if (!coarse) return;
    el.touch.classList.add('on');
    el.keys.hidden = true;
    let id = null;
    const move = (e) => {
      const r = el.pad.getBoundingClientRect();
      let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      input.stick.x = dx;
      input.stick.y = -dy;
      el.knob.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`;
    };
    el.pad.addEventListener('pointerdown', (e) => { id = e.pointerId; el.pad.setPointerCapture(id); move(e); });
    el.pad.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; input.stick.x = 0; input.stick.y = 0; el.knob.style.transform = ''; };
    el.pad.addEventListener('pointerup', end);
    el.pad.addEventListener('pointercancel', end);
    el.sprint.addEventListener('pointerdown', (e) => { input.touch.sprint = true; el.sprint.classList.add('on'); el.sprint.setPointerCapture(e.pointerId); });
    const sEnd = () => { input.touch.sprint = false; el.sprint.classList.remove('on'); };
    el.sprint.addEventListener('pointerup', sEnd);
    el.sprint.addEventListener('pointercancel', sEnd);
    el.do.addEventListener('click', () => onUse());
  }

  const api = {
    root: hud,
    menu,
    bindTouch,
    /** s = { time: '07:42', label: 'Morning', day: 0..1, place: {name, kind}|null, stamina: 0..1, winded } */
    update(s) {
      setText('time', s.time);
      setText('label', s.label);
      const d = Math.round(s.day * 500) / 500;
      if (last.day !== d) { last.day = d; el.day.style.width = `${d * 100}%`; }
      const pn = s.place ? s.place.name : '';
      if (last.pn !== pn) {
        last.pn = pn;
        if (pn) { el.kind.textContent = s.place.kind; el.name.textContent = pn; }
        el.place.classList.toggle('on', !!pn);
      }
      const st = Math.round(s.stamina * 200) / 200;
      if (last.st !== st) {
        last.st = st;
        el.stamfill.style.transform = `scaleX(${st})`;
        el.stam.classList.toggle('low', st < 0.25 || s.winded);
        el.stam.classList.toggle('on', st < 0.995);
        clearTimeout(stamTimer);
      }
    },
    /** The meters: chaos 0..100, the score and how far it is to the next rank (0..1). */
    meters({ chaos, score, rankProgress }) {
      const c = Math.round(chaos);
      if (last.chaos !== c) { last.chaos = c; el.chaos.style.transform = `scaleX(${c / 100})`; el.chaosn.textContent = String(c); }
      if (last.score !== score) { last.score = score; el.score.textContent = String(score); }
      const r = Math.round(rankProgress * 100) / 100;
      if (last.rp !== r) { last.rp = r; el.fav.style.transform = `scaleX(${r})`; }
    },
    /** The task Ori is following (null = none): the chip under the clock. */
    goal(g) {
      const key = g ? `${g.title}|${g.meta}` : '';
      if (last.goal === key) return;
      last.goal = key;
      el.goal.classList.toggle('on', !!g);
      if (g) { el.goalt.textContent = g.title; el.goalm.textContent = g.meta; }
    },
    /** The arrow at the edge of the screen pointing at the followed place when it is off-screen: { x, y (0..1 of the viewport), angle, label } or null. */
    arrow(a) {
      el.arrow.classList.toggle('on', !!a);
      if (!a) return;
      el.arrow.style.left = `${a.x * 100}%`;
      el.arrow.style.top = `${a.y * 100}%`;
      el.arrow.firstElementChild.style.transform = `rotate(${a.angle}rad)`;
      if (last.al !== a.label) { last.al = a.label; el.arrowl.textContent = a.label; }
    },
    /** A big floating word in the middle ('+84', 'Missed'). */
    float(text, soft = false) {
      for (const old of hud.querySelectorAll('.fv-float')) old.remove(); // one at a time
      const f = document.createElement('div');
      f.className = `fv-float${soft ? ' soft' : ''}`;
      f.textContent = text;
      hud.append(f);
      setTimeout(() => f.remove(), 1500);
    },
    shake() { hud.classList.remove('shake'); void hud.offsetWidth; hud.classList.add('shake'); },
    /** The end-of-day card: { score, rank, lines, helped, missed, rel } and what the buttons do. */
    showReport(r, { onAgain, onQuit }) {
      const card = document.createElement('div');
      card.className = 'g3d-menu fv-report';
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-label', 'The day is over');
      const rows = Object.entries(r.rel).map(([k, v]) => `<li><span>${k}</span><div><i style="width:${Math.round(v)}%"></i></div></li>`).join('');
      card.innerHTML = `<div class="g3d-card"><div class="g3d-kicker">${GAME.title}</div><h2>${TEXT.dayOver}</h2><p class="fv-rank">${r.rank}</p><p class="fv-score">${r.score} favours</p><ul class="fv-lines">${r.lines.map((l) => `<li>${l}</li>`).join('')}</ul><ul class="fv-rels">${rows}</ul><button type="button" class="g3d-btn primary" data-a="again">${TEXT.anotherDay}</button><button type="button" class="g3d-btn quit" data-a="quit">${TEXT.backToDesktop}</button></div>`;
      card.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'again') { card.remove(); onAgain(); } else onQuit(); });
      root.append(card);
      card.querySelector('.g3d-btn.primary').focus({ preventScroll: true });
      return card;
    },
    toast(text, ms = 2200) {
      const t = document.createElement('div');
      t.className = 'fv-toast fv-glass';
      t.textContent = text;
      el.toasts.appendChild(t);
      while (el.toasts.children.length > 2) el.toasts.firstChild.remove(); // never a pile of them
      setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms);
    },
    showPause(on) {
      menu.hidden = !on;
      hud.classList.toggle('paused', on);
      if (on) menu.querySelector('.g3d-btn.primary').focus({ preventScroll: true });
    },
    /** A card with buttons (the host uses it for graphics problems): [{ label, primary?, run }]. */
    message(title, body, buttons = []) {
      msg.hidden = false;
      msg.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'g3d-card';
      card.innerHTML = `<div class="g3d-kicker">${GAME.title}</div><h2></h2><p></p>`;
      card.querySelector('h2').textContent = title;
      card.querySelector('p').textContent = body;
      msgButtons = buttons.map((b) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `g3d-btn${b.primary ? ' primary' : ''}`;
        btn.textContent = b.label;
        btn.addEventListener('click', b.run);
        card.append(btn);
        return btn;
      });
      msg.append(card);
      if (msgButtons[0]) msgButtons[0].focus({ preventScroll: true });
    },
    clearMessage() { msg.hidden = true; msg.innerHTML = ''; msgButtons = []; },
    dispose() { clearTimeout(keyTimer); clearTimeout(stamTimer); hud.remove(); menu.remove(); msg.remove(); },
  };
  return api;
}
