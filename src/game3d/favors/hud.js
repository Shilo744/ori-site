// "Ori, Can You...?" — the DOM side of the game: clock, place label, stamina, pause menu, message card, touch controls. The canvas lives in
// the same overlay (host.js). Only touches the DOM when a value changed.
import '../game3d.css';
import './favors.css';
import { GAME } from './content.js';
import { TEXT } from './texts.js';
import { HINTS, RESOLUTIONS } from './settings.js';
import { modalFocus } from './a11y.js';
import './a11y-ui.css';
import { createCaptioner } from './captions.js';
import { createKeyPad } from './key-pad.js';
import { isTouchDevice } from './touch.js';

const SVG_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>';

/**
 * @param {HTMLElement} root the overlay
 * @param {{ onPause: () => void, onResume: () => void, onRestart: () => void, onQuit: () => void, settings?: ReturnType<import('./settings.js').createSettings> | null,
 *   sys?: { volume(): number, setVolume(v: number): void, reduceMotion(): boolean, setReduceMotion(b: boolean): void } | null,
 *   onExport?: (() => string) | null, onImport?: ((text: string) => { ok: boolean, message?: string }) | null }} cb
 *   `settings` = this game's own comfort settings, `sys` = the room's System Settings (sound level, reduce motion), `onExport` / `onImport` = the save code
 */
export function createFavorsHud(root, { onPause, onResume, onRestart, onQuit, settings = null, sys = null, onExport = null, onImport = null, onHelp = null, onTips = null, onStory = null }) {
  const hud = document.createElement('div');
  hud.className = 'fv-hud';
  hud.innerHTML = `
    <div class="fv-clock fv-glass"><b data-k="time">06:00</b><span data-k="label">Morning</span><div class="fv-day"><i data-k="day"></i></div></div>
    <div class="fv-meters fv-glass"><div class="fv-meter love"><span>LOVE</span><div><i data-k="chaos"></i></div><b data-k="chaosn">0</b></div><div class="fv-meter boxer"><span>BOXER</span><div><i data-k="fav"></i></div><b data-k="score">Lv 1</b></div></div>
    <div class="fv-place fv-glass" data-k="place" aria-live="polite"><small data-k="kind"></small><span data-k="name"></span></div>
    <div class="fv-goal fv-glass" data-k="goal" aria-live="polite"><span data-k="goalt"></span><small data-k="goalm"></small></div>
    <div class="fv-story fv-glass" data-k="story" role="button" tabindex="0" aria-live="polite" aria-label="Story"><b>Story</b><span data-k="storyt"></span></div>
    <div class="fv-arrow" data-k="arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3l8 16-8-4-8 4z"/></svg><span data-k="arrowl"></span></div>
    <div class="fv-tr"><button class="fv-btn fv-glass" type="button" data-k="help" aria-label="What now? (?)"><span aria-hidden="true">?</span></button><button class="fv-btn fv-glass" type="button" data-k="pause" aria-label="Pause (Esc)">${SVG_PAUSE}</button></div>
    <div class="fv-stam" data-k="stam" aria-hidden="true"><i data-k="stamfill"></i></div>
    <div class="fv-keys fv-glass" data-k="keys"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move</span><span><kbd>Shift</kbd> sprint</span><span><kbd>H</kbd> say hi</span><span><kbd>Space</kbd> use</span><span><kbd>M</kbd> map</span><span><kbd>R</kbd> races</span><span><kbd>Tab</kbd> journal</span><span><kbd>V</kbd> photo</span><span><kbd>?</kbd> help</span><span><kbd>Q</kbd><kbd>E</kbd> camera</span><span><kbd>Esc</kbd> pause</span></div>
    <div class="fv-toasts" data-k="toasts" aria-live="polite"></div>
    <div class="fv-cap" data-k="cap" aria-hidden="true"></div>
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
      <div class="fv-set" role="group" aria-label="Settings">
        <label class="fv-vol"><span>Sound</span><input type="range" min="0" max="100" step="5" data-s="volume" aria-label="Sound volume"><b data-s="volv">70</b></label>
        <button type="button" class="g3d-btn fv-opt" role="switch" aria-checked="false" data-s="motion"><span>Reduce motion</span><i></i></button>
        <button type="button" class="g3d-btn fv-opt" role="switch" aria-checked="false" data-s="contrast"><span>High-contrast HUD</span><i></i></button>
        <button type="button" class="g3d-btn fv-opt" role="switch" aria-checked="false" data-s="captions"><span>Sound captions</span><i></i></button>
        <button type="button" class="g3d-btn fv-opt" data-s="hints"><span>Key hints</span><b data-s="hintv">Automatic</b></button>
        <button type="button" class="g3d-btn fv-opt" data-s="resolution"><span>Resolution</span><b data-s="resv">Automatic</b></button>
      </div>
      <div class="fv-code" role="group" aria-label="Save code">
        <div class="fv-codebtns"><button type="button" class="g3d-btn fv-mini" data-s="export">Copy my save code</button><button type="button" class="g3d-btn fv-mini" data-s="import">Load a save code</button></div>
        <button type="button" class="g3d-btn fv-mini" data-s="tips">Show the first steps again</button>
        <div class="fv-codebox" hidden><textarea rows="3" spellcheck="false" autocomplete="off" aria-label="Save code" data-s="code" placeholder="Paste your save code here"></textarea><button type="button" class="g3d-btn primary" data-s="load">Load this save</button><p class="g3d-small" role="status" aria-live="polite" data-s="codemsg"></p></div>
      </div>
      <p class="g3d-small">${TEXT.pausedHint}</p>
    </div>`;
  const menuFocus = modalFocus(menu, '.g3d-btn.primary');
  const msg = document.createElement('div');
  msg.className = 'g3d-msg';
  msg.hidden = true;
  msg.setAttribute('role', 'alert');
  root.append(hud, menu, msg);

  const q = (k) => hud.querySelector(`[data-k="${k}"]`);
  const el = Object.fromEntries(['time', 'label', 'day', 'place', 'kind', 'name', 'stam', 'stamfill', 'keys', 'toasts', 'cap', 'touch', 'pad', 'knob', 'sprint', 'do', 'chaos', 'chaosn', 'fav', 'score', 'goal', 'goalt', 'goalm', 'arrow', 'arrowl'].map((k) => [k, q(k)]));
  const last = {};
  const setText = (k, v) => { if (last[k] !== v) { last[k] = v; el[k].textContent = v; } };
  const act = { resume: onResume, restart: onRestart, quit: onQuit };
  menu.addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (b && act[b.dataset.a]) act[b.dataset.a](); });
  q('pause').addEventListener('click', () => onPause());
  q('help').addEventListener('click', () => { if (onHelp) onHelp(); });
  q('goal').addEventListener('click', () => { if (onHelp) onHelp(); }); // (the goal chip is a button too, for the mouse)
  q('story').addEventListener('click', () => { if (onStory) onStory(); });
  let keyTimer = 0;

  // ── settings (the pause menu). The sound level and reduce-motion belong to the room's System Settings (`sys`: one truth), the rest to this game (`settings`). Both apply at once. ──
  const sw = (k) => menu.querySelector(`[data-s="${k}"]`);
  const HINT_NAME = { auto: 'Automatic', on: 'Always', off: 'Hidden' };
  const RES_NAME = { auto: 'Automatic', full: 'Full' };
  const setSwitch = (b, on) => { b.setAttribute('aria-checked', String(on)); b.classList.toggle('on', on); };
  function applyHints(mode) { // auto = shown for the first seconds, on = always, off = never
    clearTimeout(keyTimer);
    el.keys.classList.remove('off');
    el.keys.classList.toggle('gone', mode === 'off');
    if (mode === 'auto') keyTimer = setTimeout(() => el.keys.classList.add('off'), 14000);
  }
  function syncSettings() { // the menu shows what is really set
    if (sys) {
      const v = Math.round(sys.volume() * 100);
      sw('volume').value = String(v);
      sw('volv').textContent = v ? String(v) : 'off';
      setSwitch(sw('motion'), !!sys.reduceMotion());
    }
    if (settings) {
      const s = settings.get();
      setSwitch(sw('contrast'), s.contrast);
      setSwitch(sw('captions'), s.captions);
      sw('hintv').textContent = HINT_NAME[s.hints];
      sw('resv').textContent = RES_NAME[s.resolution];
    }
    hud.classList.toggle('calm', !!(sys && sys.reduceMotion()));
  }
  if (!sys) { sw('volume').closest('.fv-vol').hidden = true; sw('motion').hidden = true; }
  if (!settings) { sw('contrast').hidden = true; sw('captions').hidden = true; sw('hints').hidden = true; sw('resolution').hidden = true; }
  menu.addEventListener('input', (e) => { if (sys && e.target.dataset.s === 'volume') { sys.setVolume(+e.target.value / 100); syncSettings(); } });
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('.fv-opt');
    if (!b) return;
    const k = b.dataset.s;
    if (k === 'motion' && sys) sys.setReduceMotion(!sys.reduceMotion());
    else if (k === 'contrast' && settings) settings.set({ contrast: !settings.get().contrast });
    else if (k === 'captions' && settings) settings.set({ captions: !settings.get().captions });
    else if (k === 'hints' && settings) settings.set({ hints: HINTS[(HINTS.indexOf(settings.get().hints) + 1) % HINTS.length] });
    else if (k === 'resolution' && settings) settings.set({ resolution: RESOLUTIONS[(RESOLUTIONS.indexOf(settings.get().resolution) + 1) % RESOLUTIONS.length] });
    syncSettings();
  });
  // ── the save code: the box shows the code to copy, or takes a pasted one to load ──
  const box = menu.querySelector('.fv-codebox');
  const area = sw('code');
  const say = (text, bad = false) => { const p = sw('codemsg'); p.textContent = text; p.classList.toggle('bad', bad); };
  const closeBox = () => { box.hidden = true; area.value = ''; say(''); };
  const copyText = async (t) => { try { await navigator.clipboard.writeText(t); return true; } catch { return false; } };
  if (!onExport || !onImport) { sw('export').hidden = true; sw('import').hidden = true; }
  if (!onTips) sw('tips').hidden = true;
  if ((!onExport || !onImport) && !onTips) menu.querySelector('.fv-code').hidden = true;
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-s]');
    const k = b && b.dataset.s;
    if (k === 'export' && onExport) {
      const code = onExport();
      box.hidden = false; sw('load').hidden = true; area.value = code; say('Copying...');
      area.focus({ preventScroll: true }); area.select();
      copyText(code).then((ok) => say(ok ? 'Copied! Keep this code somewhere safe.' : 'Press Ctrl+C to copy it.'));
    } else if (k === 'import' && onImport) {
      box.hidden = false; sw('load').hidden = false; area.value = ''; say('');
      area.focus({ preventScroll: true });
    } else if (k === 'tips' && onTips) {
      onTips();
    } else if (k === 'load' && onImport) {
      const r = onImport(area.value);
      if (!r.ok) say(r.message || 'That did not work.', true); // (on success the game starts from the save and the menu closes)
    }
  });
  const offSettings = settings ? settings.on((s) => { hud.classList.toggle('hc', s.contrast); root.classList.toggle('fv-hc', s.contrast); if (!s.captions) el.cap.replaceChildren(); applyHints(s.hints); }) : () => {};
  hud.classList.toggle('hc', !!(settings && settings.get().contrast));
  root.classList.toggle('fv-hc', !!(settings && settings.get().contrast));
  applyHints(settings ? settings.get().hints : 'auto');
  syncSettings();
  let stamTimer = 0;
  let msgButtons = [];

  // touch controls: shown on coarse pointers; the joystick feeds input.stick, the buttons feed sprint / use
  let input = null;
  let onUse = () => {};
  const coarse = isTouchDevice({ coarse: !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches), search: location.search }); // (a coarse pointer, or ?touch=1)
  let walkPad = null; // hello, map, journal and the camera, over the stick and Run / Use
  function bindTouch(inp, use) {
    input = inp;
    onUse = use;
    if (!coarse) return;
    el.touch.classList.add('on');
    el.keys.hidden = true;
    hud.classList.add('touch');
    root.classList.add('fv-tui'); // (the whole overlay: every card gets thumb-sized controls, see touch.css)
    walkPad = createKeyPad({ root: el.touch, className: 'walk', label: 'Touch controls' });
    walkPad.force(true);
    walkPad.set('walk');
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

  // ── sound captions [experimental]: a short line of words for the sounds that tell you something; only while the setting is on ──
  const captioner = createCaptioner();
  function caption(text) {
    if (!settings || !settings.get().captions) return;
    if (!captioner.say(text, performance.now() / 1000)) return;
    const line = document.createElement('div');
    line.className = 'fv-cap-line';
    line.textContent = text;
    el.cap.append(line);
    while (el.cap.children.length > captioner.max) el.cap.firstElementChild.remove();
    setTimeout(() => line.remove(), captioner.life * 1000);
  }
  const api = {
    root: hud,
    caption,
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
    /** The line of the story under the goal chip ('' = no story now). */
    story(text) {
      if (last.story === text) return;
      last.story = text;
      q('storyt').textContent = text;
      q('story').classList.toggle('on', !!text);
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
      if (on) { syncSettings(); closeBox(); menuFocus.enter(); } else menuFocus.leave();
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
    dispose() { clearTimeout(keyTimer); clearTimeout(stamTimer); offSettings(); if (walkPad) walkPad.dispose(); hud.remove(); menu.remove(); msg.remove(); },
  };
  return api;
}
