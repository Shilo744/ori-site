// "Ori, Can You...?" — the DOM of the game around the favours: the peaches counter, the mission card (steps and meters), the afterburner bar,
// the little actions (verbs.js) drawn as a card in the middle of the street, the minimap, Uzi's Garage, the big countdown and the end-of-day card.
// The words come from texts.js / play-content.js; this file only lays them out. Every DOM write is skipped when the value did not change.
import './play.css';
import { TEXT } from './texts.js';
import { REL } from './content.js';
import { UPGRADES, WEEK, GOLDEN } from './play-content.js';
import { createVerb, VERB_INFO, autoplay } from './verbs.js';
import { createMap2d } from './map2d.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PEACH = '<svg class="pl-peach" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.2c-4.6-1.6-8 1.6-7.4 6.2.5 4 3.6 7 7.4 7s6.9-3 7.4-7c.6-4.6-2.8-7.8-7.4-6.2z" fill="#ff9f5b"/><path d="M12 6.2c.1-1.6 1.1-2.9 2.8-3.4-.1 1.6-.9 2.9-2.8 3.4z" fill="#58b35b"/><path d="M12 7.2c-1 2.4-1 6.4 0 10.4" stroke="#e36f3c" stroke-width="1" fill="none" opacity=".6"/></svg>';
const ICONS = {
  engine: '<svg viewBox="0 0 24 24"><path d="M3 11l2-4h9l2 3h4v6H3z"/><circle cx="8" cy="17" r="1.8"/><circle cx="17" cy="17" r="1.8"/></svg>',
  tyre: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>',
  flame: '<svg viewBox="0 0 24 24"><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 2 2 2-1-3 0-5 1-8z"/></svg>',
  shoe: '<svg viewBox="0 0 24 24"><path d="M3 16c0-3 2-4 4-4l3-5 3 3 7 2c1 .3 1 3 1 4v1H3z"/></svg>',
  box: '<svg viewBox="0 0 24 24"><path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M10.5 18h3"/></svg>',
};
const KEYS = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'act', Enter: 'act', KeyF: 'act', KeyE: 'act', Digit1: 'c1', Digit2: 'c2', Digit3: 'c3', Numpad1: 'c1', Numpad2: 'c2', Numpad3: 'c3' };
const ARROW_GLYPH = { left: '←', right: '→', up: '↑', down: '↓', act: '●' };
const stars = (q) => (q >= 0.85 ? 3 : q >= 0.6 ? 2 : 1);

export function createPlayUi({ root, hud, sfx, map }) {
  const hudRoot = hud.root;
  const mk = (cls, html = '', tag = 'div') => { const e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; };

  // ── the peaches, the mission card, the afterburner, the big word ──
  const peach = mk('pl-peaches fv-glass', `${PEACH}<b data-k="n">0</b><span data-k="d"></span>`);
  const card = mk('pl-mission fv-glass');
  card.hidden = true;
  const boost = mk('pl-boost', '<span>AFTERBURNER</span><div><i></i></div>');
  const big = mk('pl-big');
  const mini = mk('pl-mini fv-glass', '<canvas width="176" height="182" role="img" aria-label="Minimap (M opens the big map)"></canvas><span class="pl-mini-key" aria-hidden="true"><kbd>M</kbd> big map</span>');
  const race = mk('pl-race fv-glass'); // the race panel: the lap, the place and the time (field races out of town)
  race.hidden = true;
  hudRoot.append(peach, card, boost, big, mini, race);
  const map2d = createMap2d(mini.querySelector('canvas'), map);
  const k = (el, key) => el.querySelector(`[data-k="${key}"]`);
  const last = {};
  const setHtml = (el, key, html) => { if (last[key] !== html) { last[key] = html; el.innerHTML = html; } };

  let peachTimer = 0;
  function setPeaches(n, gained = 0) {
    if (last.pn !== n) { last.pn = n; k(peach, 'n').textContent = String(n); }
    if (gained) {
      const d = k(peach, 'd');
      d.textContent = `+${gained}`;
      d.classList.remove('on'); void d.offsetWidth; d.classList.add('on');
      clearTimeout(peachTimer);
      peachTimer = setTimeout(() => d.classList.remove('on'), 2200);
    }
  }
  function setBoost(v, on) {
    boost.classList.toggle('on', !!on);
    if (on) { const w = Math.round(Math.max(0, Math.min(1, v)) * 100); if (last.bw !== w) { last.bw = w; boost.querySelector('i').style.transform = `scaleX(${w / 100})`; } boost.classList.toggle('low', v < 0.2); }
  }
  /** The mission card: view = { label, sub, meters: [{ k, label, v, warn, face, hot }], steps: [{ label, done }], timer? } or null. */
  function setMission(view) {
    card.hidden = !view;
    if (!view) { last.m = ''; return; }
    const meters = view.meters.map((m) => `<div class="pl-m${m.warn ? ' warn' : ''}${m.hot ? ' hot' : ''}" data-m="${esc(m.k)}"><span>${esc(m.label)}</span><div><i style="transform:scaleX(${Math.max(0, Math.min(1, m.v)).toFixed(3)})"></i>${m.mine != null ? `<u style="left:${(m.mine * 100).toFixed(1)}%"></u>` : ''}</div>${m.face ? `<em class="face ${m.face}"></em>` : ''}</div>`).join('');
    const steps = view.steps.length ? `<ul>${view.steps.map((s) => `<li class="${s.done ? 'done' : ''}">${esc(s.label)}</li>`).join('')}</ul>` : '';
    const html = `<b>${esc(view.label)}</b><small>${esc(view.sub || '')}</small>${meters}${steps}`;
    setHtml(card, 'm', html);
  }
  /** The race panel: r = { lap, laps, rank, field, clock, count, final } or null. The count is the countdown before GO. */
  function setRace(r) {
    race.hidden = !r;
    if (!r) { last.r = ''; return; }
    const mm = Math.floor(r.clock / 60); const ss = (r.clock % 60).toFixed(1).padStart(4, '0');
    const html = r.count
      ? `<div class="pr-get"><small>GET READY</small><b>${r.count}</b></div>`
      : `<div><small>LAP</small><b>${r.lap}<span>/${r.laps}</span></b></div><div><small>PLACE</small><b>${r.rank}<span>/${r.field}</span></b></div><div><small>TIME</small><b class="pr-t">${mm}:${ss}</b></div>${r.final ? '<em>FINAL LAP</em>' : ''}`;
    setHtml(race, 'r', html);
  }
  function bigWord(text, ms = 900) {
    big.textContent = text;
    big.classList.remove('on'); void big.offsetWidth; big.classList.add('on');
    clearTimeout(bigWord.t);
    bigWord.t = setTimeout(() => big.classList.remove('on'), ms);
  }
  /** The minimap: where Ori is, the beam's place and the extra points (golden peaches nearby are not shown on purpose). */
  let miniAt = 0;
  /** The minimap is put away on a track out of town (it shows the city). */
  function setMinimapVisible(v) { mini.hidden = !v; }
  function setMinimap(now, { player, pins = [], points = [], landmarks = [], goal = null }) {
    if (now - miniAt < 0.12) return;
    miniAt = now;
    map2d.draw({ player, pins, points, landmarks, goal, time: now });
  }

  // ── the little actions ──
  let verb = null; // { v, el, kind, cb, done, flash, info, render }
  let auto = null; // tests / autoplay: a scripted player for the little actions ({ react })
  const verbEl = mk('pl-verb');
  verbEl.hidden = true;
  root.append(verbEl);

  const R = {
    carry: {
      build: () => '<div class="vb-track"><i class="vb-zone"></i><b class="vb-mark"></b></div><div class="vb-prog"><i></i></div>',
      upd(e, w) { const t = e.querySelector('.vb-track'); const z = e.querySelector('.vb-zone'); const m = e.querySelector('.vb-mark'); z.style.width = `${(w.zone / 1.3) * 100}%`; m.style.left = `${50 + (w.pos / 1.3) * 50}%`; t.classList.toggle('danger', w.danger); e.querySelector('.vb-prog i').style.transform = `scaleX(${w.progress})`; },
    },
    fix: {
      build: () => '<div class="vb-bar"><i class="vb-win"></i><b class="vb-fill"></b></div><div class="vb-pips"></div>',
      upd(e, w) { const win = e.querySelector('.vb-win'); win.style.left = `${w.window[0] * 100}%`; win.style.width = `${(w.window[1] - w.window[0]) * 100}%`; e.querySelector('.vb-fill').style.width = `${w.bar * 100}%`; e.querySelector('.vb-bar').classList.toggle('hot', w.hot); e.querySelector('.vb-bar').classList.toggle('holding', w.holding); setHtml(e.querySelector('.vb-pips'), 'fixp', Array.from({ length: w.stages }, (_, i) => `<i class="${i < w.stage ? 'on' : ''}"></i>`).join('')); },
    },
    queue: {
      build: () => '<div class="vb-nums"><div><small>NOW SERVING</small><b data-n="serving">0</b></div><div><small>YOUR NUMBER</small><b data-n="mine">0</b></div></div><div class="vb-annoy"><span>Patience</span><div><i></i></div></div><p class="vb-joke" hidden>"Number 412?" - "No, that was a different 412."</p><button type="button" class="vb-btn" data-act="act">Sigh politely <kbd>Space</kbd></button>',
      upd(e, w) { e.querySelector('[data-n="serving"]').textContent = w.serving; e.querySelector('[data-n="mine"]').textContent = w.mine; e.querySelector('.vb-annoy i').style.transform = `scaleX(${w.annoy})`; e.querySelector('.vb-annoy').classList.toggle('warn', w.annoy > 0.6); e.querySelector('.vb-joke').hidden = !w.joke; e.querySelector('.vb-nums').classList.toggle('stall', w.stalled); },
    },
    chat: {
      build: () => '<p class="vb-prompt"></p><div class="vb-time"><i></i></div><div class="vb-opts"></div><small class="vb-round"></small>',
      upd(e, w) { setHtml(e.querySelector('.vb-opts'), 'chatopts', w.options.map((o, i) => `<button type="button" class="vb-btn opt" data-act="c${i + 1}"><kbd>${i + 1}</kbd> ${esc(o)}</button>`).join('')); const pr = e.querySelector('.vb-prompt'); if (pr.textContent !== w.prompt) pr.textContent = w.prompt; e.querySelector('.vb-time i').style.transform = `scaleX(${w.timeLeft})`; e.querySelector('.vb-round').textContent = `${w.round} of ${w.rounds}`; },
    },
    shop: {
      build: () => '<p class="vb-want"></p><div class="vb-grid"></div>',
      upd(e, w) { e.querySelector('.vb-want').innerHTML = `Looking for: <b>${esc(w.want.join(', '))}</b> ${w.got.length ? `<em>(${w.got.length}/${w.want.length})</em>` : ''}`; setHtml(e.querySelector('.vb-grid'), 'shopg', w.items.map((it, i) => `<button type="button" class="vb-item${i === w.cursor ? ' cur' : ''}${w.got.includes(it) ? ' got' : ''}${w.wrong.includes(i) ? ' bad' : ''}" data-i="${i}">${esc(it)}</button>`).join('')); },
    },
    assemble: {
      build: () => '<div class="vb-steps"></div><div class="vb-time"><i></i></div>',
      upd(e, w) { setHtml(e.querySelector('.vb-steps'), 'asm', w.steps.map((s, i) => `<span class="${i < w.idx ? 'done' : i === w.idx ? 'now' : ''}${w.shake && i === w.idx ? ' shake' : ''}">${ARROW_GLYPH[s]}</span>`).join('')); e.querySelector('.vb-time i').style.transform = `scaleX(${w.timeLeft})`; },
    },
    handle: {
      build: () => '<div class="vb-bar stamp"><i class="vb-win"></i><b class="vb-mark2"></b></div><div class="vb-pips"></div><button type="button" class="vb-btn" data-act="act">Stamp <kbd>Space</kbd></button>',
      upd(e, w) { const win = e.querySelector('.vb-win'); win.style.left = `${w.zone[0] * 100}%`; win.style.width = `${(w.zone[1] - w.zone[0]) * 100}%`; e.querySelector('.vb-mark2').style.left = `${w.marker * 100}%`; e.querySelector('.vb-bar').classList.toggle('cool', w.cooling); setHtml(e.querySelector('.vb-pips'), 'hnd', Array.from({ length: w.need }, (_, i) => `<i class="${i < w.hits ? 'on' : ''}"></i>`).join('')); },
    },
  };
  R.escort = R.handle;

  verbEl.addEventListener('click', (e) => {
    if (!verb || verb.done) return;
    const b = e.target.closest('[data-act],[data-i]');
    if (!b) { if (e.target.closest('[data-back]')) cancelVerb(); return; }
    if (b.dataset.i != null && verb.kind === 'shop') { verb.v.core.s.cursor = Number(b.dataset.i); verb.v.press('act'); return; }
    if (b.dataset.act) { verb.v.press(b.dataset.act); setTimeout(() => verb && verb.v.release(b.dataset.act), 90); }
  });
  // a mouse press on "Space" style buttons for the hold-and-release verb
  verbEl.addEventListener('pointerdown', (e) => { if (verb && verb.kind === 'fix' && e.target.closest('.vb-bar,[data-hold]')) verb.v.press('act'); });
  verbEl.addEventListener('pointerup', (e) => { if (verb && verb.kind === 'fix') verb.v.release('act'); void e; });

  function openVerb(req, cb, { title = '', who = '' } = {}) {
    if (verb) return false;
    const v = createVerb(req.kind, { seed: req.seed || 1, tone: req.tone || 'trivial', params: req.params || {} });
    const info = VERB_INFO[req.kind] || { title: '', hint: '' };
    const r = R[req.kind] || R.handle;
    verb = { v, kind: req.kind, cb, done: false, flash: 0, r, req };
    verbEl.hidden = false;
    verbEl.innerHTML = `<div class="pl-vcard fv-glass"><header><small>${esc(who ? TEXT.verbAsk(who) : '')}</small><b>${esc(title)}</b></header><h3>${esc(info.title)}</h3><p class="vb-hint">${esc(info.hint)}</p><div class="vb-body">${r.build()}</div><div class="vb-result" hidden></div><footer><button type="button" class="vb-back" data-back="1">${esc(TEXT.verbHint)}</button></footer></div>`;
    for (const key in last) if (/^(chatopts|shopg|asm|hnd|fixp)$/.test(key)) delete last[key];
    verbEl.classList.add('on');
    sfx.tap();
    return true;
  }
  function finishVerb(q) {
    if (!verb) return;
    const res = verbEl.querySelector('.vb-result');
    const s = stars(q);
    res.hidden = false;
    res.innerHTML = `<span class="st">${'<i class="on"></i>'.repeat(s)}${'<i></i>'.repeat(3 - s)}</span><b>${esc(s === 3 ? TEXT.verbCheers[Math.floor(q * 100) % TEXT.verbCheers.length] : s === 2 ? TEXT.verbGood : TEXT.verbWarm)}</b>`;
    verb.done = true;
    verb.flash = 1.05;
    verb.q = q;
    (q >= 0.6 ? sfx.ding : sfx.pop)();
  }
  function cancelVerb() {
    if (!verb) return;
    const cb = verb.cb;
    closeVerb();
    cb && cb.cancel && cb.cancel();
    hud.toast(TEXT.verbBack, 1400);
  }
  function closeVerb() { verb = null; verbEl.hidden = true; verbEl.classList.remove('on'); verbEl.innerHTML = ''; }

  const onUp = (e) => { if (!verb || verb.done) return; const a = KEYS[e.code]; if (a) { verb.v.release(a); e.preventDefault(); } };
  window.addEventListener('keyup', onUp, true);

  // ── Uzi's Garage ──
  let shop = null; // { eco, onBuy }
  const shopEl = mk('pl-shop');
  shopEl.hidden = true;
  root.append(shopEl);
  function renderShop() {
    const eco = shop.eco;
    const rows = UPGRADES.map((u, i) => {
      const nx = eco.next(u.id);
      const lvl = eco.level(u.id);
      const pips = u.levels.map((_, j) => `<i class="${j < lvl ? 'on' : ''}"></i>`).join('');
      const can = nx && eco.peaches >= nx.cost;
      const btn = nx ? `<button type="button" class="pl-buy${can ? '' : ' poor'}" data-buy="${u.id}"><kbd>${i + 1}</kbd> ${PEACH}${esc(TEXT.buy(nx.cost).replace('Buy · ', ''))}</button>` : `<span class="pl-max">${esc(TEXT.maxed)}</span>`;
      return `<li><span class="pl-ic">${ICONS[u.icon] || ''}</span><div class="pl-ut"><b>${esc(u.name)}</b><small>${esc(nx ? nx.desc : u.blurb)}</small><div class="pl-pips">${pips}</div>${nx && !can ? `<em>${esc(TEXT.needMore(nx.cost - eco.peaches))}</em>` : ''}</div>${btn}</li>`;
    }).join('');
    shopEl.innerHTML = `<div class="pl-scard fv-glass"><header><b>${esc(TEXT.garageTitle)}</b><span class="pl-wallet">${PEACH}<b>${eco.peaches}</b></span></header><p>${esc(TEXT.garageBlurb)}</p><ul>${rows}</ul><footer><small>${esc(TEXT.garageKeys)}</small><button type="button" class="pl-close" data-close="1">Done</button></footer></div>`;
  }
  function openShop(eco, onBuy) { shop = { eco, onBuy }; shopEl.hidden = false; renderShop(); sfx.tap(); hud.toast(TEXT.garageOpen, 1200); }
  function closeShop() { if (!shop) return; const s = shop; shop = null; shopEl.hidden = true; shopEl.innerHTML = ''; s.onClose && s.onClose(); sfx.tap(); }
  function buy(id) {
    if (!shop) return false;
    const r = shop.eco.buy(id);
    if (r.ok) { const u = UPGRADES.find((x) => x.id === id); hud.toast(TEXT.bought(u.name), 2200); sfx.ding(); shop.onBuy && shop.onBuy(id, r); } else sfx.soft();
    renderShop();
    return r.ok;
  }
  shopEl.addEventListener('click', (e) => { const b = e.target.closest('[data-buy]'); if (b) { buy(b.dataset.buy); return; } if (e.target.closest('[data-close]') || e.target === shopEl) closeShop(); });

  // ── the end of a day / the week ──
  let dayEl = null;
  function showDay(sum, { eco, party, onNext, onGarage, onQuit, onAgain }) {
    hideDay();
    dayEl = mk('g3d-menu fv-report pl-day');
    dayEl.setAttribute('role', 'dialog');
    dayEl.setAttribute('aria-label', 'The day is over');
    const by = Object.entries(sum.by).map(([kind, n]) => `<li><span>${esc({ favour: 'Favours', tip: 'Tips', golden: 'Golden peaches', race: 'The race', set: 'Set piece' }[kind] || kind)}</span><b>+${n}</b></li>`).join('');
    const hearts = Object.keys(REL).map((key) => { const d = sum.delta[key] || 0; return `<li><span>${esc(REL[key])}</span><div><i style="width:${Math.round(sum.rel[key])}%"></i></div><em class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '+' : ''}${Math.round(d)}</em></li>`; }).join('');
    let body;
    if (party) {
      const guests = party.guests.map((g) => `<li class="${g.came ? 'came' : ''}"><b>${esc(g.name)}</b><small>${esc(g.came ? g.line : 'Next year!')}</small></li>`).join('');
      body = `<div class="g3d-card pl-dcard"><div class="g3d-kicker">${esc(TEXT.weekOver)}</div><h2>${esc(party.line)}</h2><p class="fv-score">${esc(TEXT.partyCame(party.came, party.of))}</p><ul class="pl-guests">${guests}</ul><p class="fv-score">${PEACH} ${eco.peaches} peaches · ${sum.golden} of ${sum.goldenTotal} golden peaches</p><button type="button" class="g3d-btn primary" data-a="again">${esc(TEXT.weekAgain)}</button><button type="button" class="g3d-btn quit" data-a="quit">${esc(TEXT.backToDesktop)}</button></div>`;
    } else {
      const next = WEEK.ramp[Math.min(WEEK.days, sum.day)];
      body = `<div class="g3d-card pl-dcard"><div class="g3d-kicker">${esc(TEXT.dayOver)}</div><h2>${esc(sum.rank)}</h2><p class="fv-score">${esc(TEXT.dayCard(sum.dayName, sum.day, WEEK.days))} · best streak ${sum.bestStreak}</p><ul class="fv-lines">${(sum.lines || []).map((l) => `<li>${esc(l)}</li>`).join('')}</ul><div class="pl-earn"><div class="pl-big-n">${PEACH}<b>+${sum.earned}</b></div><ul>${by}</ul></div><h4>${esc(TEXT.heartsTitle)}</h4><ul class="fv-rels pl-hearts">${hearts}</ul>${sum.afford ? `<p class="pl-tip">${esc(TEXT.afford(sum.afford.name, sum.afford.cost))}</p>` : ''}${next ? `<p class="fv-score">${esc(TEXT.tomorrow(next.theme))}</p>` : ''}<button type="button" class="g3d-btn" data-a="garage">${esc(TEXT.garageFromCard)}</button><button type="button" class="g3d-btn primary" data-a="next">${esc(sum.last ? TEXT.weekOver : TEXT.nextDay)}</button><button type="button" class="g3d-btn quit" data-a="quit">${esc(TEXT.backToDesktop)}</button><small class="pl-saved">${esc(TEXT.saved)}</small></div>`;
    }
    dayEl.innerHTML = body;
    dayEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      const a = b.dataset.a;
      if (a === 'garage') { onGarage && onGarage(); return; }
      if (a === 'next') { hideDay(); onNext && onNext(); } else if (a === 'again') { hideDay(); onAgain && onAgain(); } else onQuit && onQuit();
    });
    root.append(dayEl);
    const pb = dayEl.querySelector('.g3d-btn.primary');
    if (pb) pb.focus({ preventScroll: true });
    return dayEl;
  }
  function hideDay() { if (dayEl) { dayEl.remove(); dayEl = null; } }

  return {
    setPeaches, setBoost, setMission, setRace, bigWord, setMinimap, setMinimapVisible,
    openVerb, cancelVerb, get verbOpen() { return !!verb; },
    openShop, closeShop, buy, get shopOpen() { return !!shop; }, set onShopClose(fn) { if (shop) shop.onClose = fn; },
    showDay, hideDay, get dayOpen() { return !!dayEl; },
    /** A keydown while a card is up: true when it was used. */
    key(e) {
      if (shop) {
        if (e.code === 'Escape' || e.code === 'KeyG') { closeShop(); return true; }
        const m = /^(Digit|Numpad)([1-9])$/.exec(e.code);
        if (m) { const u = UPGRADES[Number(m[2]) - 1]; if (u) buy(u.id); return true; }
        return true;
      }
      if (verb) {
        if (e.code === 'Escape') { cancelVerb(); return true; }
        if (verb.done) return true;
        const a = KEYS[e.code];
        if (a && !e.repeat) { verb.v.press(a); return true; }
        return true; // everything else waits: the little action has the keyboard
      }
      return false;
    },
    update(dt) {
      if (!verb) return;
      if (verb.done) { verb.flash -= dt; if (verb.flash <= 0) { const { cb, q } = verb; closeVerb(); cb && cb.done && cb.done(q); } return; }
      if (auto) autoplay(verb.v, dt, auto);
      verb.v.update(dt, {});
      verb.r.upd(verbEl.querySelector('.vb-body'), verb.v.view());
      if (verb.v.done) finishVerb(verb.v.quality);
    },
    /** Dev / tests: a scripted player for the little actions (null = off; react = seconds between its actions). */
    setAuto(o) { auto = o; },
    /** Dev / tests: the verb in hand (to script a perfect player). */
    get verb() { return verb ? verb.v : null; },
    dispose() { window.removeEventListener('keyup', onUp, true); clearTimeout(peachTimer); for (const e of [peach, card, boost, big, mini, verbEl, shopEl, dayEl]) if (e) e.remove(); },
  };
}

void GOLDEN;
