// "Ori, Can You...?" — the DOM of the ring: the choice of opponent (the ladder), the health and breath bars, the combo counter, the big words (FIGHT!, KO!,
// PERFECT!), the hit flash and the card after a fight (XP, level, new moves, peaches). The words come from fight-content.js / texts.js; this only lays them out.
import './fight.css';
import { MOVE_LIST, xpToNext, MAX_LEVEL } from './boxer.js';
import { TEXT } from './texts.js';
import { createFloatPool, floatLook } from './fight-floats.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PEACH = '<svg class="fi-peach" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.2c-4.6-1.6-8 1.6-7.4 6.2.5 4 3.6 7 7.4 7s6.9-3 7.4-7c.6-4.6-2.8-7.8-7.4-6.2z" fill="#ff9f5b"/><path d="M12 6.2c.1-1.6 1.1-2.9 2.8-3.4-.1 1.6-.9 2.9-2.8 3.4z" fill="#58b35b"/></svg>';

export function createFightUi({ root }) {
  const mk = (cls, html = '', tag = 'div') => { const e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; };
  const hud = mk('fi-hud');
  hud.hidden = true;
  hud.innerHTML = `
    <div class="fi-side fi-me fv-glass"><div class="fi-name"><b data-k="mename">Ori</b><span data-k="melv">Lv 1</span></div><div class="fi-bar hp"><i data-k="mehp"></i><u data-k="mehpn"></u></div><div class="fi-bar st"><i data-k="mest"></i></div><div class="fi-bar fury" data-k="mefuryw" hidden><i data-k="mefury"></i><small>F</small></div></div>
    <div class="fi-mid fv-glass"><b data-k="clock">1:15</b><span data-k="round">ROUND 1</span></div>
    <div class="fi-side fi-foe fv-glass"><div class="fi-name"><b data-k="foename">Moti</b><span data-k="foetitle">The Neighbour</span></div><div class="fi-bar hp"><i data-k="foehp"></i><u data-k="foehpn"></u></div></div>
    <div class="fi-combo" data-k="combo"></div>
    <div class="fi-keys fv-glass"><span><kbd>A</kbd><kbd>D</kbd><kbd>W</kbd><kbd>S</kbd> move</span><span><kbd>J</kbd> jab</span><span><kbd>K</kbd> cross</span><span><kbd>L</kbd> hold: guard</span><span><kbd>Space</kbd> dash</span></div>
    <div class="fi-flash" data-k="flash"></div>`;
  const big = mk('fi-big');
  const sub = mk('fi-sub');
  const card = mk('fi-overlay');
  card.hidden = true;
  const menu = mk('fi-overlay');
  menu.hidden = true;
  // the numbers that float up over a fighter who is hit: a fixed set of elements, painted from the pool (fight-floats.js), never created during a fight
  const nums = mk('fi-nums');
  const pool = createFloatPool(10);
  const numEls = pool.slots.map(() => { const e = mk('fi-num'); e.hidden = true; nums.append(e); return e; });
  // the speed bag: time, score, the lane the beats glide along, and the two hands
  const bag = mk('fi-bag');
  bag.hidden = true;
  bag.innerHTML = `
    <div class="fi-bag-top fv-glass"><small>${TEXT.bagCaption}</small><b data-k="btime">0:20</b></div>
    <div class="fi-bag-score fv-glass"><div><small>${TEXT.bagScore}</small><b data-k="bscore">0</b></div><div><small>${TEXT.bagCombo}</small><b data-k="bcombo">0</b><em data-k="bmult">x1</em></div></div>
    <div class="fi-bag-low"><div class="fi-lane fv-glass"><i class="fi-target" data-k="target"></i><span data-k="dots"></span></div><div class="fi-hands"><kbd data-k="keyJ"><b>J</b><small>${TEXT.touchJab}</small></kbd><kbd data-k="keyK"><b>K</b><small>${TEXT.touchCross}</small></kbd></div></div>`;
  const bk = (key) => bag.querySelector(`[data-k="${key}"]`);
  const bel = Object.fromEntries(['btime', 'bscore', 'bcombo', 'bmult', 'target', 'dots', 'keyJ', 'keyK'].map((n) => [n, bk(n)]));
  const dots = Array.from({ length: 9 }, () => { const d = mk('fi-dot', '', 'i'); d.hidden = true; bel.dots.append(d); return d; });
  const blast = {};
  const btext = (key, v) => { if (blast[key] !== v) { blast[key] = v; bel[key].textContent = v; } };
  root.append(hud, nums, bag, big, sub, menu, card);
  const k = (key) => hud.querySelector(`[data-k="${key}"]`);
  const el = Object.fromEntries(['mename', 'melv', 'mehp', 'mehpn', 'mest', 'mefuryw', 'mefury', 'clock', 'round', 'foename', 'foetitle', 'foehp', 'foehpn', 'combo', 'flash'].map((n) => [n, k(n)]));
  const last = {};
  const text = (key, v) => { if (last[key] !== v) { last[key] = v; el[key].textContent = v; } };
  const scale = (key, v) => { const r = Math.round(v * 200) / 200; if (last[key] !== r) { last[key] = r; el[key].style.transform = `scaleX(${r})`; } };
  let bigT = 0;
  let subT = 0;
  let flashT = 0;

  function bigWord(t, kind = '', ms = 1000) {
    big.textContent = t;
    big.className = `fi-big ${kind}`;
    void big.offsetWidth;
    big.classList.add('on');
    clearTimeout(bigT);
    bigT = setTimeout(() => big.classList.remove('on'), ms);
  }
  function subWord(t, ms = 2200) {
    sub.textContent = t;
    sub.classList.add('on');
    clearTimeout(subT);
    subT = setTimeout(() => sub.classList.remove('on'), ms);
  }
  function flash(kind) {
    el.flash.className = `fi-flash ${kind}`;
    void el.flash.offsetWidth;
    el.flash.classList.add('on');
    clearTimeout(flashT);
    flashT = setTimeout(() => el.flash.classList.remove('on'), 220);
  }

  // ── the numbers over a fighter who is hit ──
  /** Puts a number (from floatFor / floatWord) over the world point (x, y, z). */
  function floatAt(f, x, y, z) {
    const sl = pool.spawn(f, x, y, z);
    const e = numEls[sl.i];
    e.textContent = sl.text;
    e.className = `fi-num ${sl.kind}${sl.text.length > 3 ? ' word' : ''}`;
    e.hidden = false;
    return sl;
  }
  /** Per frame: ages the numbers and places each on the screen. `project(x, y, z)` gives { x, y } in pixels of the overlay, or null when it is behind the camera. */
  let freezeNums = false; // dev / tests: hold the numbers still (to photograph them)
  function updateFloats(dt, project) {
    if (!freezeNums) pool.update(dt);
    for (const sl of pool.slots) {
      const e = numEls[sl.i];
      if (!sl.live) { if (!e.hidden) e.hidden = true; continue; }
      const L = floatLook(sl);
      const p = project(sl.x, sl.y + L.rise, sl.z);
      if (!p) { e.style.opacity = '0'; continue; }
      e.style.opacity = L.alpha.toFixed(2);
      e.style.transform = `translate(${(p.x + sl.dx).toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%) scale(${L.scale.toFixed(3)})`;
    }
  }
  function clearFloats() { pool.clear(); for (const e of numEls) e.hidden = true; }

  // ── the speed bag ──
  const LANE_HEAD = 14; // % of the lane where the beat has to be hit
  const LANE_SPAN = 2.2; // seconds of beats shown ahead
  let targetT = 0;
  /** Per frame: the numbers, the lane (the beats glide in from the right) and the hand that is next. `v` = run.view() (training.js). */
  function updateBag(v) {
    const t = Math.max(0, Math.ceil(v.left));
    btext('btime', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
    btext('bscore', String(v.score));
    btext('bcombo', String(v.combo));
    btext('bmult', `x${(Math.round(v.mult * 100) / 100).toString()}`);
    for (let i = 0; i < dots.length; i++) {
      const u = v.upcoming[i];
      const d = dots[i];
      if (!u || u.hit) { if (!d.hidden) d.hidden = true; continue; }
      d.hidden = false;
      d.classList.toggle('accent', u.accent);
      d.style.left = `${(LANE_HEAD + (Math.max(u.dt, -0.3) / LANE_SPAN) * (100 - LANE_HEAD)).toFixed(2)}%`;
      d.style.opacity = u.dt < 0 ? String(Math.max(0, 1 + u.dt / 0.3).toFixed(2)) : '1';
    }
    bel.keyJ.classList.toggle('next', v.nextHand === 'J');
    bel.keyK.classList.toggle('next', v.nextHand === 'K');
  }
  /** The ring at the head of the lane flashes in the colour of the grade. */
  function bagFlash(grade) {
    bel.target.className = `fi-target ${grade}`;
    void bel.target.offsetWidth;
    bel.target.classList.add('on');
    clearTimeout(targetT);
    targetT = setTimeout(() => bel.target.classList.remove('on'), 260);
  }
  function showBag() { bag.hidden = false; root.classList.add('fi-ring-on'); for (const key of Object.keys(blast)) delete blast[key]; bel.target.className = 'fi-target'; }
  function hideBag() { bag.hidden = true; for (const d of dots) d.hidden = true; }

  // ── the card to pick the next fight ──
  let menuState = null;
  function showMenu({ rows, level, xp, xpNeed, love, onPick, onClose, onTrain = null }) {
    const body = rows.map((r, i) => {
      const cls = `fi-row${r.open ? '' : ' locked'}${r.beaten ? ' beaten' : ''}${r.next ? ' next' : ''}${r.hidden ? ' secret' : ''}`;
      const tag = r.beaten ? '<em class="ok">Beaten</em>' : r.open ? (r.next ? '<em class="go">Next</em>' : '<em class="go">Rematch</em>') : `<em class="lock">${esc(r.why)}</em>`;
      return `<li class="${cls}" data-i="${i}" ${r.open ? 'role="button" tabindex="0"' : ''}><i class="fi-av" style="--c:${r.color}">${esc(r.initial)}</i><div><b>${esc(r.name)}</b><small>${esc(r.title)}</small></div>${tag}<kbd>${i + 1}</kbd></li>`;
    }).join('');
    const moves = MOVE_LIST.filter((m) => m.lv <= level).map((m) => `<span title="${esc(m.how)}">${esc(m.name)}</span>`).join('');
    menu.innerHTML = `<div class="fi-card fv-glass"><div class="g3d-kicker">THE RING</div><h2>Pick your fight</h2>
      <div class="fi-me-card"><b>Ori · Lv ${level}</b><div class="fi-xp"><i style="width:${Math.round((level >= MAX_LEVEL ? 1 : xp / xpNeed) * 100)}%"></i></div><small>Love of the neighbourhood: ${Math.round(love)}</small></div>
      <div class="fi-moves">${moves}</div>
      <ul class="fi-list">${body}</ul>
      ${onTrain ? `<button type="button" class="fi-train" data-train="1"><i class="fi-bagic" aria-hidden="true"></i><div><b>${TEXT.bagName}</b><small>${TEXT.bagMenuSub}</small></div><kbd>B</kbd></button>` : ''}
      <footer><small>1-${rows.length} pick${onTrain ? ' · B speed bag' : ''} · Esc closes</small><button type="button" class="fi-btn" data-close="1">Not now</button></footer></div>`;
    menu.hidden = false;
    menuState = { rows, onPick, onClose, onTrain };
  }
  menu.addEventListener('click', (e) => {
    if (!menuState) return;
    if (e.target.closest('[data-close]') || e.target === menu) { closeMenu(true); return; }
    if (e.target.closest('[data-train]')) { train(); return; }
    const li = e.target.closest('.fi-row');
    if (li && !li.classList.contains('locked')) pickRow(Number(li.dataset.i));
  });
  function train() { const s = menuState; if (!s || !s.onTrain) return false; closeMenu(false); s.onTrain(); return true; }
  function pickRow(i) { const s = menuState; const r = s && s.rows[i]; if (!r || !r.open) return false; closeMenu(false); s.onPick(r); return true; }
  function closeMenu(cancel) { const s = menuState; menuState = null; menu.hidden = true; menu.innerHTML = ''; if (cancel && s && s.onClose) s.onClose(); }

  // ── the card after the fight ──
  let cardState = null;
  /** r = { won, how, title, line, xp: { from, to, gained, levelFrom, level }, peaches, love, moves: [..], rematch, next } */
  function showResult(r, { onLeave, onAgain, onRetry = null }) {
    const lvUp = r.levelFrom !== r.level;
    const pct = (lv, xp) => (lv >= MAX_LEVEL ? 100 : Math.round((xp / xpToNext(lv)) * 100));
    card.innerHTML = `<div class="fi-card fv-glass ${r.won ? 'win' : 'lose'}"><div class="g3d-kicker">${esc(r.how)}</div><h2>${esc(r.title)}</h2><p class="fi-quote">${esc(r.line)}</p>
      ${r.xpGain ? `<div class="fi-reward"><div class="fi-xpbar"><span>Lv ${r.level}</span><div><i class="from" style="width:${pct(r.levelFrom, r.xpFrom)}%"></i><i class="to" style="width:${lvUp ? 100 : pct(r.level, r.xp)}%"></i></div></div><b>+${r.xpGain} XP</b></div>` : ''}
      <ul class="fi-gains">${r.peaches ? `<li>${PEACH} +${r.peaches} peaches</li>` : ''}${r.love ? `<li><i class="fi-heart"></i> +${r.love} love</li>` : ''}</ul>
      ${lvUp ? `<div class="fi-levelup"><b>LEVEL UP! Lv ${r.level}</b>${r.moves.length ? `<ul>${r.moves.map((m) => `<li><b>New move: ${esc(m.name)}</b> <small>${esc(m.how)}</small></li>`).join('')}</ul>` : ''}</div>` : ''}
      <div class="fi-btns"><button type="button" class="fi-btn primary" data-a="again">${esc(r.next || (r.won ? 'Back to the ladder' : 'Try again'))}</button>${r.retry && onRetry ? `<button type="button" class="fi-btn" data-a="retry">${esc(r.retry)}</button>` : ''}<button type="button" class="fi-btn" data-a="leave">Leave the ring</button></div></div>`;
    card.hidden = false;
    cardState = { onLeave, onAgain, onRetry };
    const b = card.querySelector('.primary');
    if (b) b.focus({ preventScroll: true });
  }
  card.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b || !cardState) return;
    const s = cardState;
    cardState = null; card.hidden = true; card.innerHTML = '';
    if (b.dataset.a === 'again') s.onAgain(); else if (b.dataset.a === 'retry' && s.onRetry) s.onRetry(); else s.onLeave();
  });

  return {
    hud,
    show(bout, names) {
      hud.hidden = false; root.classList.add('fi-ring-on');
      text('mename', names.me); text('melv', `Lv ${names.level}`); text('foename', names.foe); text('foetitle', names.title);
      el.mefuryw.hidden = !names.fury;
      for (const key of ['mehp', 'mest', 'mefury', 'foehp']) delete last[key];
      void bout;
    },
    hide() { hud.hidden = true; root.classList.remove('fi-ring-on'); big.classList.remove('on'); sub.classList.remove('on'); hideBag(); clearFloats(); },
    /** Per frame: the bars from the bout. */
    update(b) {
      const P = b.P; const O = b.O;
      scale('mehp', Math.max(0, P.hp / P.maxHp)); scale('foehp', Math.max(0, O.hp / O.maxHp)); scale('mest', Math.max(0, P.st / P.maxSt)); scale('mefury', P.meter / 100);
      text('mehpn', `${Math.ceil(Math.max(0, P.hp))}`); text('foehpn', `${Math.ceil(Math.max(0, O.hp))}`);
      el.mest.parentElement.classList.toggle('low', P.st < 20 || P.tired > 0);
      el.mefuryw.classList.toggle('ready', P.meter >= 100);
      const t = Math.max(0, Math.ceil(b.timeLeft));
      text('clock', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
      const c = P.combo;
      const label = c >= 2 ? `${c} HITS` : '';
      if (last.combo !== label) { last.combo = label; el.combo.textContent = label; el.combo.classList.toggle('on', !!label); if (label) { el.combo.classList.remove('pop'); void el.combo.offsetWidth; el.combo.classList.add('pop'); } }
    },
    setRound(t) { text('round', t); },
    bigWord, subWord, flash,
    floatAt, updateFloats, clearFloats, get floatsLive() { return pool.live; }, floatSlots: pool.size, freezeFloats(on) { freezeNums = !!on; },
    showBag, updateBag, hideBag, bagFlash, get bagOpen() { return !bag.hidden; },
    /** The keyboard hints give way to the touch buttons. */
    setTouch(on) { hud.classList.toggle('touch', !!on); bag.classList.toggle('touch', !!on); },
    showMenu, closeMenu, get menuOpen() { return !!menuState; },
    showResult, get cardOpen() { return !!cardState; },
    hideCard() { cardState = null; card.hidden = true; card.innerHTML = ''; },
    /** Keys for the menu (1-9, Esc) and the result card (Enter / Space). */
    key(e) {
      if (menuState) {
        if (e.code === 'Escape') { closeMenu(true); return true; }
        if (e.code === 'KeyB') { train(); return true; }
        const m = /^(Digit|Numpad)([1-9])$/.exec(e.code);
        if (m) { pickRow(Number(m[2]) - 1); return true; }
        return true;
      }
      if (cardState) {
        if (e.code === 'Enter' || e.code === 'Space') { const s = cardState; cardState = null; card.hidden = true; card.innerHTML = ''; s.onAgain(); return true; }
        if (e.code === 'Escape') { const s = cardState; cardState = null; card.hidden = true; card.innerHTML = ''; s.onLeave(); return true; }
        return true;
      }
      return false;
    },
    dispose() { clearTimeout(bigT); clearTimeout(subT); clearTimeout(flashT); clearTimeout(targetT); pool.clear(); for (const e of [hud, nums, bag, big, sub, menu, card]) e.remove(); },
  };
}

void TEXT;
