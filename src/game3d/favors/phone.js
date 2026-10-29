// "Ori, Can You...?" — Ori's iPhone (DOM). It is NON-MODAL: the world keeps running and WASD keeps walking while it is open. A compact panel
// docks at the right edge; while Ori is on the move it shrinks to a peek (the top tasks and the count) and opens up again when he stops.
// Banners slide in with a buzz; Tab toggles it; 1-9 pick a task, F follows it, Y / L / N answer, [ ] switch the tabs. Tabs: Tasks (sorted
// by deadline), Map (pins), Messages (quick replies), Focus (Do Not Disturb + the mentors).
import './phone.css';
import { CAST, PLACES, REPLIES } from './content.js';
import { TEXT } from './texts.js';
import { createMap2d } from './map2d.js';
import { FOCUS_MAX, FOCUS_COOLDOWN, MENTORS } from './quests.js';
import { walkDistance } from './map.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TABS = ['tasks', 'map', 'messages', 'focus'];
const TAB_ICONS = {
  tasks: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.5h10M9 12h10M9 17.5h10"/><circle cx="5" cy="6.5" r="1.1"/><circle cx="5" cy="12" r="1.1"/><circle cx="5" cy="17.5" r="1.1"/></svg>',
  map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  messages: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16H10l-4.5 3.5V16A2.5 2.5 0 0 1 4.5 13.5z"/></svg>',
  focus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.2A8 8 0 0 1 9.8 4.5a8 8 0 1 0 9.7 9.7z"/></svg>',
};
const PHONE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.8" width="10" height="18.4" rx="2.6"/><path d="M10.5 18.2h3"/></svg>';
const hm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(Math.floor(min) % 60).padStart(2, '0')}`;
const left = (m) => { if (m < 1) return 'now'; const t = Math.ceil(m); return t < 60 ? `${t} min` : `${Math.floor(t / 60)} h ${String(t % 60).padStart(2, '0')} min`; };
const initial = (name) => esc(name.replace(/^(The|A|Little)\s+/i, '').charAt(0).toUpperCase());
const HOLD_FULL = 3; // seconds the panel stays open after a tap or a key, even if Ori is walking
const SETTLE = 0.6; // seconds standing still before a peek opens up

/**
 * @param {HTMLElement} hudRoot the .fv-hud element (the phone button and the banners go in it)
 * @param {HTMLElement} overlay the game overlay (the panel goes in it)
 * @param {{ map: object, q: object, sfx: object, getPlayer: () => {x:number,z:number,heading:number,near:string|null}, onPin: (uid: number|null) => void }} o
 */
export function createPhone(hudRoot, overlay, { map, q, sfx, getPlayer, onPin, placeOf = (t) => t.at }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'fv-btn fv-glass fv-phonebtn';
  btn.setAttribute('aria-label', 'Phone (Tab)');
  btn.innerHTML = `${PHONE_ICON}<span class="fv-badge" data-k="badge" hidden>0</span>`;
  hudRoot.querySelector('.fv-tr').prepend(btn);
  const notes = document.createElement('div');
  notes.className = 'fv-notes';
  notes.setAttribute('aria-live', 'polite');
  hudRoot.append(notes);

  const panel = document.createElement('section');
  panel.className = 'fv-phone full';
  panel.hidden = true;
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'Phone');
  panel.innerHTML = `
    <header class="fv-ph-top"><b data-k="clock">06:00</b><span data-k="sub">Ori</span><i class="fv-bat" aria-hidden="true"></i></header>
    <div class="fv-ph-body">
      <div class="fv-pane" data-pane="tasks"><h3>${TEXT.tasksTitle} <small data-k="count"></small></h3><ul class="fv-tasks" data-k="tasks"></ul><p class="fv-empty" data-k="empty" hidden>${TEXT.allCaught}</p><p class="fv-peekmore" data-k="more"></p></div>
      <div class="fv-pane" data-pane="map" hidden><h3>Map</h3><canvas width="330" height="336" data-k="map"></canvas><p class="fv-hint">${TEXT.mapHint}</p></div>
      <div class="fv-pane" data-pane="messages" hidden><h3 data-k="mtitle">Messages</h3><ul class="fv-threads" data-k="threads"></ul><div class="fv-thread" data-k="thread" hidden></div></div>
      <div class="fv-pane" data-pane="focus" hidden><h3>Focus</h3><div class="fv-focus" data-k="focus"></div></div>
    </div>
    <p class="fv-keyshint" aria-hidden="true">${TEXT.keysHint}</p>
    <nav class="fv-ph-tabs" role="tablist">${TABS.map((t) => `<button type="button" role="tab" data-tab="${t}" aria-label="${t[0].toUpperCase()}${t.slice(1)}" tabindex="-1">${TAB_ICONS[t]}<span>${t[0].toUpperCase()}${t.slice(1)}</span><i class="fv-tabbadge" data-k="tb-${t}" hidden></i></button>`).join('')}</nav>`;
  overlay.append(panel);
  const k = (key) => panel.querySelector(`[data-k="${key}"]`);
  const el = { clock: k('clock'), sub: k('sub'), count: k('count'), tasks: k('tasks'), empty: k('empty'), more: k('more'), map: k('map'), threads: k('threads'), thread: k('thread'), mtitle: k('mtitle'), focus: k('focus'), badge: btn.querySelector('[data-k="badge"]') };
  const map2d = createMap2d(el.map, map);

  let open = false;
  let mode = 'full'; // 'full' | 'peek'
  let tab = 'tasks';
  let sel = null; // the highlighted task (its details are open)
  let active = null; // the followed task (its place is the beam)
  let thread = null; // the giver whose messages are open
  let hold = 0; // seconds the panel stays full whatever Ori does
  let still = 0; // seconds Ori has been standing still
  const history = []; // { uid, giver, dir: 'in' | 'out' | 'sys', text }
  let sig = '';
  let lastDraw = 0;
  let order = []; // the uids of the rows, in order (1-9 pick from it)
  const fresh = new Set();

  const placeName = (id) => PLACES[id].name;
  const colorOf = (g) => CAST[g].color;
  const avatar = (g) => `<span class="fv-av" style="--c:${colorOf(g)}">${initial(CAST[g].name)}</span>`;
  const reply = (uid, kind) => REPLIES[kind][uid % REPLIES[kind].length];
  const canvas = () => overlay.querySelector('canvas');
  const refocus = () => { const c = canvas(); if (c && panel.contains(document.activeElement)) c.focus({ preventScroll: true }); };

  function setTab(t) {
    tab = t;
    for (const p of panel.querySelectorAll('.fv-pane')) p.hidden = p.dataset.pane !== t;
    for (const b of panel.querySelectorAll('[data-tab]')) { b.classList.toggle('on', b.dataset.tab === t); b.setAttribute('aria-selected', String(b.dataset.tab === t)); }
    sig = '';
    api.refresh(true);
  }

  // ── Tasks ──
  function tasksHtml(list) {
    return list.map((t, i) => {
      const urgent = t.urgency > 0.7 || t.remaining < 30;
      const sel_ = sel === t.uid;
      const detail = !sel_ ? '' : `
        <div class="fv-detail">
          <p>${esc(t.body)}</p>
          <p class="fv-do">At <b>${esc(placeName(placeOf(t)))}</b> · ${esc(t.doText)}</p>
          <div class="fv-actions">
            <button type="button" data-act="pin" class="fv-chip primary" tabindex="-1">${active === t.uid ? TEXT.following : TEXT.follow} <kbd>F</kbd></button>
            ${t.state === 'new' ? `<button type="button" data-act="yes" class="fv-chip" tabindex="-1">${esc(reply(t.uid, 'yes'))} <kbd>Y</kbd></button>` : ''}
            ${t.later ? '' : `<button type="button" data-act="later" class="fv-chip" tabindex="-1">${esc(reply(t.uid, 'later'))} <kbd>L</kbd></button>`}
            <button type="button" data-act="no" class="fv-chip soft" tabindex="-1">${esc(reply(t.uid, 'no'))} <kbd>N</kbd></button>
            ${t.delegable ? `<button type="button" data-act="mentors" class="fv-chip" tabindex="-1" ${q.state.mentors.tokens ? '' : 'disabled'}>${TEXT.askMentors} <kbd>M</kbd></button>` : ''}
          </div>
        </div>`;
      return `<li class="fv-task${sel_ ? ' sel' : ''}${urgent ? ' hot' : ''}${active === t.uid ? ' pinned' : ''}${fresh.has(t.uid) ? ' fresh' : ''}" data-uid="${t.uid}" data-state="${t.state}">
        <div class="fv-row" role="button">${i < 9 ? `<i class="fv-num">${i + 1}</i>` : ''}${avatar(t.giver)}
          <div class="fv-tt"><b>${esc(t.title)}</b><small>${esc(t.giverName)} · ${esc(placeName(placeOf(t)))} · ${t.metres} m</small></div>
          <div class="fv-tm"><em class="fv-left">${left(t.remaining)}</em><span class="fv-pri p${t.pri}" aria-label="priority ${t.pri}">${'!'.repeat(t.pri)}</span></div>
        </div>${detail}</li>`;
    }).join('');
  }

  // ── Messages ──
  function threadsHtml() {
    const givers = [...new Set(history.map((h) => h.giver))];
    if (!givers.length) return `<li class="fv-empty">${TEXT.noMessages}</li>`;
    return givers.reverse().map((g) => {
      const last = [...history].reverse().find((h) => h.giver === g);
      const unread = q.open().filter((t) => t.giver === g && t.state === 'new').length;
      return `<li class="fv-th" data-giver="${g}" role="button">${avatar(g)}<div class="fv-tt"><b>${esc(CAST[g].name)}</b><small>${esc(last.text)}</small></div>${unread ? `<i class="fv-unread">${unread}</i>` : ''}</li>`;
    }).join('');
  }
  function threadHtml(g) {
    const msgs = history.filter((h) => h.giver === g).map((h) => `<div class="fv-bubble ${h.dir}">${h.dir === 'in' ? `<b>${esc(h.title)}</b>` : ''}${esc(h.text)}</div>`).join('');
    const openTasks = q.open().filter((t) => t.giver === g);
    const chips = openTasks.map((t) => `<div class="fv-quick" data-uid="${t.uid}"><small>${esc(t.title)}</small>
      ${t.state === 'new' ? `<button type="button" data-act="yes" class="fv-chip primary" tabindex="-1">${esc(reply(t.uid, 'yes'))}</button>` : ''}
      ${t.later ? '' : `<button type="button" data-act="later" class="fv-chip" tabindex="-1">${esc(reply(t.uid, 'later'))}</button>`}
      <button type="button" data-act="no" class="fv-chip soft" tabindex="-1">${esc(reply(t.uid, 'no'))}</button></div>`).join('');
    return `<button type="button" class="fv-back" data-act="back" tabindex="-1">Messages</button><div class="fv-msgs">${msgs}</div>${chips}`;
  }

  // ── Focus ──
  function focusHtml() {
    const f = q.state.focus;
    const m = q.state.min;
    const on = f.on;
    const cd = !on && m < f.cooldownUntil ? Math.ceil(f.cooldownUntil - m) : 0;
    const used = on ? Math.round(FOCUS_MAX - (m - f.since)) : 0;
    const tokens = q.state.mentors.tokens;
    const delegable = q.open().filter((t) => t.delegable && t.state !== 'delegated');
    return `
      <div class="fv-card"><div class="fv-sw ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-act="focus"><i></i></div>
        <div><b>${TEXT.dndTitle}</b><small>${on ? TEXT.dndOn(left(used)) : cd ? TEXT.dndRest(left(cd)) : TEXT.dndIdle(FOCUS_MAX, FOCUS_COOLDOWN / 60)}</small></div></div>
      <div class="fv-card col"><b>The mentors</b><small>${TEXT.mentorsBlurb(Math.round(MENTORS.success * 100))}</small>
        <div class="fv-tokens" aria-label="${tokens} mentor tokens">${Array.from({ length: MENTORS.tokens }, (_, i) => `<i class="${i < tokens ? 'on' : ''}"></i>`).join('')}</div>
        ${delegable.length ? delegable.slice(0, 4).map((t) => `<div class="fv-quick" data-uid="${t.uid}"><small>${esc(t.title)}</small><button type="button" data-act="mentors" class="fv-chip" tabindex="-1" ${tokens ? '' : 'disabled'}>${TEXT.handOver}</button></div>`).join('') : `<small>${TEXT.nothingToHand}</small>`}
      </div>`;
  }

  // ── what a tap or a key does ──
  function act(a, uid) {
    if (a === 'back') { thread = null; return true; }
    if (a === 'focus') { sfx.tap(); if (q.state.focus.on) q.setFocus(false); else q.setFocus(true); return true; }
    if (uid == null) return false;
    const t = q.get(uid);
    if (!t) return false;
    if (a === 'pin') { api.setActive(active === uid ? null : uid); sfx.tap(); }
    else if (a === 'yes' || a === 'later' || a === 'no') {
      if (q.reply(uid, a)) {
        history.push({ uid, giver: t.giver, dir: 'out', text: reply(uid, a) });
        sfx[a === 'no' ? 'tap' : 'pop']();
        if (a === 'no') { if (active === uid) api.setActive(null); sel = null; }
      }
    } else if (a === 'mentors') {
      if (q.delegate(uid)) { history.push({ uid, giver: t.giver, dir: 'sys', text: TEXT.mentorsOnIt }); sfx.pop(); if (active === uid) api.setActive(null); sel = null; }
    }
    return true;
  }
  const poke = () => { hold = HOLD_FULL; mode = 'full'; sig = ''; };

  panel.addEventListener('click', (e) => {
    poke();
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { sfx.tap(); setTab(tabBtn.dataset.tab); refocus(); return; }
    const actBtn = e.target.closest('[data-act]');
    const holder = e.target.closest('[data-uid]');
    if (actBtn) {
      act(actBtn.dataset.act, holder ? Number(holder.dataset.uid) : null);
      sig = '';
      api.refresh(true);
      refocus();
      return;
    }
    const row = e.target.closest('.fv-row');
    if (row) { const uid = Number(row.parentElement.dataset.uid); sel = sel === uid ? null : uid; sfx.tap(); sig = ''; api.refresh(true); refocus(); return; }
    const th = e.target.closest('.fv-th');
    if (th) { thread = th.dataset.giver; sfx.tap(); sig = ''; api.refresh(true); }
    refocus();
  });
  el.map.addEventListener('click', (e) => {
    const r = el.map.getBoundingClientRect();
    const id = map2d.hit(((e.clientX - r.left) / r.width) * el.map.width, ((e.clientY - r.top) / r.height) * el.map.height);
    if (!id) return;
    const t = q.list(getPlayer().near || 'home').find((x) => placeOf(x) === id);
    if (t) { api.setActive(t.uid); sfx.tap(); sig = ''; api.refresh(true); }
    refocus();
  });
  notes.addEventListener('click', (e) => { const n = e.target.closest('.fv-note'); if (n) { sel = Number(n.dataset.uid); api.open('tasks'); n.remove(); } });
  btn.addEventListener('click', () => { api.toggle(); btn.blur(); refocus(); });

  const api = {
    btn,
    panel,
    get isOpen() { return open; },
    get mode() { return mode; },
    get active() { return active; },
    get tab() { return tab; },
    open(t = tab) {
      open = true;
      panel.hidden = false;
      btn.classList.add('on');
      poke();
      requestAnimationFrame(() => panel.classList.add('in'));
      setTab(t);
    },
    close() {
      open = false;
      panel.classList.remove('in');
      btn.classList.remove('on');
      panel.hidden = true;
      thread = null;
      refocus();
    },
    toggle() { if (open) api.close(); else api.open(); },
    /**
     * Keys that act on the phone while it is open and Ori keeps walking: 1-9 pick a task, Enter opens it, F follows, Y / L / N answer,
     * M hands it to the mentors, [ ] change the tab. Returns true when the key was used (so the game does not see it).
     */
    key(e) {
      if (!open || e.ctrlKey || e.metaKey || e.altKey) return false;
      const c = e.code;
      const digit = /^(Digit|Numpad)([1-9])$/.exec(c);
      if (c === 'BracketLeft' || c === 'BracketRight') { setTab(TABS[(TABS.indexOf(tab) + (c === 'BracketRight' ? 1 : TABS.length - 1)) % TABS.length]); poke(); sfx.tap(); return true; }
      if (digit) { const uid = order[Number(digit[2]) - 1]; if (uid == null) return true; sel = uid; setTab('tasks'); poke(); sfx.tap(); return true; }
      if (c === 'Enter') { sel = sel != null ? null : order[0] ?? null; poke(); api.refresh(true); sfx.tap(); return true; }
      const keys = { KeyF: 'pin', KeyY: 'yes', KeyL: 'later', KeyN: 'no', KeyM: 'mentors' };
      if (keys[c]) {
        const uid = sel ?? order[0] ?? null;
        if (uid == null) return true;
        if (sel == null) sel = uid;
        act(keys[c], uid);
        poke();
        api.refresh(true);
        return true;
      }
      return false;
    },
    /** A new task arrived: a banner on the "lock screen" (and the message thread). With the panel open the row itself lights up instead. */
    notify(t, { urgent = false } = {}) {
      history.push({ uid: t.uid, giver: t.giver, dir: 'in', title: t.title, text: t.body });
      if (open) {
        fresh.add(t.uid);
        setTimeout(() => { fresh.delete(t.uid); sig = ''; }, 3000);
      } else {
        const n = document.createElement('div');
        n.className = `fv-note fv-glass${urgent ? ' urgent' : ''}`;
        n.dataset.uid = String(t.uid);
        n.style.setProperty('--c', colorOf(t.giver));
        n.innerHTML = `${avatar(t.giver)}<div class="fv-nt"><b>${esc(t.giverName)}</b><span>${esc(t.title)}</span></div><time>now</time>`;
        notes.append(n);
        while (notes.children.length > 3) notes.firstChild.remove();
        setTimeout(() => { n.classList.add('out'); setTimeout(() => n.remove(), 320); }, urgent ? 7000 : 5200);
      }
      sig = '';
      api.refresh(); // the badge counts at once
    },
    setActive(uid) { active = uid; onPin(uid); },
    /** Redraws what changed (the list only when something in it did); `force` rebuilds now. */
    refresh(force = false) {
      const p = getPlayer();
      const list = q.list(p.near || 'home').map((t) => { const d = map.places[placeOf(t)].door; return { ...t, metres: Math.round(walkDistance(map, p.x, p.z, d.x, d.z)) }; });
      order = list.map((t) => t.uid);
      const n = list.length;
      el.badge.hidden = n === 0;
      el.badge.textContent = String(n);
      btn.classList.toggle('hot', list.some((t) => (t.pri >= 3 && t.state === 'new') || t.urgency > 0.7 || t.remaining < 30));
      if (!open) return;
      el.clock.textContent = hm(q.state.min);
      el.sub.textContent = n ? `${n} open` : TEXT.allCaught;
      panel.classList.toggle('peek', mode === 'peek');
      panel.classList.toggle('full', mode === 'full');
      const s = `${mode}|${tab}|${sel}|${active}|${thread}|${[...fresh].join('.')}|${list.map((t) => `${t.uid}${t.state}${t.later ? 'l' : ''}${Math.ceil(t.remaining / 2)}:${Math.round(t.metres / 10)}`).join(',')}|${q.state.focus.on}|${q.state.mentors.tokens}|${history.length}|${Math.floor(q.state.min / 10)}`;
      if (!force && s === sig) return;
      sig = s;
      if (tab === 'tasks') {
        el.count.textContent = n ? `${n} open` : '';
        el.empty.hidden = n > 0;
        el.tasks.innerHTML = tasksHtml(list);
        el.more.textContent = mode === 'peek' ? TEXT.peekMore(n) : '';
      } else if (tab === 'messages') {
        el.mtitle.textContent = thread ? CAST[thread].name : 'Messages';
        el.threads.hidden = !!thread;
        el.thread.hidden = !thread;
        if (thread) { el.thread.innerHTML = threadHtml(thread); el.thread.querySelector('.fv-msgs').scrollTop = 1e6; } else el.threads.innerHTML = threadsHtml();
      } else if (tab === 'focus') el.focus.innerHTML = focusHtml();
      const unread = q.open().filter((t) => t.state === 'new').length;
      const tb = k('tb-messages');
      tb.hidden = unread === 0;
      tb.textContent = String(unread);
    },
    /** Per frame: `speed` = how fast Ori moves (m/s). While he walks the panel is a peek; when he stops it opens up. */
    update(now, dt = 0, speed = 0) {
      if (!open) return;
      hold = Math.max(0, hold - dt);
      still = speed < 0.6 ? still + dt : 0;
      const want = hold > 0 || still > SETTLE || tab !== 'tasks' ? 'full' : 'peek';
      if (want !== mode) { mode = want; sig = ''; }
      if (tab === 'map' && now - lastDraw > 0.1) {
        lastDraw = now;
        const p = getPlayer();
        const byPlace = {};
        for (const t of q.list(p.near || 'home')) (byPlace[placeOf(t)] ||= []).push(t);
        const cur = active != null ? q.get(active) : null;
        const pins = Object.entries(byPlace).map(([id, ts]) => ({ id, color: colorOf(ts[0].giver), label: PLACES[id].sign.charAt(0), count: ts.length, active: !!cur && placeOf(cur) === id }));
        map2d.draw({ player: p, pins });
      }
      api.refresh();
    },
    /** Where a place's pin is on the map canvas (canvas pixels): for tests. */
    pinPoint(placeId) { const d = map.places[placeId].door; return map2d.toCanvas(d.x, d.z); },
    dispose() { btn.remove(); notes.remove(); panel.remove(); },
  };
  return api;
}
