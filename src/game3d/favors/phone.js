// "Ori, Can You...?" — Ori's iPhone (DOM). Notification banners slide in with a buzz; Tab opens the phone: Tasks (sorted by deadline, with
// priority, giver, distance and the time left), a Map with pins, Messages with quick replies, and Focus (Do Not Disturb + the mentors).
// While it is open the day slows right down (the game asks `isOpen`), so reading it is a decision, not a pause.
import './phone.css';
import { CAST, PLACES, REPLIES, REL } from './content.js';
import { createMap2d } from './map2d.js';
import { FOCUS_MAX, FOCUS_COOLDOWN, MENTORS } from './quests.js';
import { walkDistance } from './map.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TAB_ICONS = {
  tasks: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.5h10M9 12h10M9 17.5h10"/><circle cx="5" cy="6.5" r="1.1"/><circle cx="5" cy="12" r="1.1"/><circle cx="5" cy="17.5" r="1.1"/></svg>',
  map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  messages: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16H10l-4.5 3.5V16A2.5 2.5 0 0 1 4.5 13.5z"/></svg>',
  focus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.2A8 8 0 0 1 9.8 4.5a8 8 0 1 0 9.7 9.7z"/></svg>',
};
const PHONE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.8" width="10" height="18.4" rx="2.6"/><path d="M10.5 18.2h3"/></svg>';
const hm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(Math.floor(min) % 60).padStart(2, '0')}`;
const left = (m) => (m < 1 ? 'now' : m < 60 ? `${Math.ceil(m)} min` : `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min`);
const initial = (name) => esc(name.replace(/^(The|A|Little)\s+/i, '').charAt(0).toUpperCase());

/**
 * @param {HTMLElement} hudRoot the .fv-hud element (the phone button and the banners go in it)
 * @param {HTMLElement} overlay the game overlay (the phone panel goes in it)
 * @param {{ map: object, q: object, sfx: object, getPlayer: () => {x:number,z:number,heading:number,near:string|null}, onPin: (uid: number|null) => void }} o
 */
export function createPhone(hudRoot, overlay, { map, q, sfx, getPlayer, onPin }) {
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
  panel.className = 'fv-phone';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Phone');
  panel.innerHTML = `
    <header class="fv-ph-top"><b data-k="clock">06:00</b><span>Ori</span><i class="fv-bat" aria-hidden="true"></i></header>
    <div class="fv-ph-body">
      <div class="fv-pane" data-pane="tasks"><h3>Tasks <small data-k="count"></small></h3><ul class="fv-tasks" data-k="tasks"></ul><p class="fv-empty" data-k="empty" hidden>Nothing to do. Suspicious.</p></div>
      <div class="fv-pane" data-pane="map" hidden><h3>Map</h3><canvas width="330" height="336" data-k="map"></canvas><p class="fv-hint">Tap a pin to follow it. The blue arrow is you.</p></div>
      <div class="fv-pane" data-pane="messages" hidden><h3 data-k="mtitle">Messages</h3><ul class="fv-threads" data-k="threads"></ul><div class="fv-thread" data-k="thread" hidden></div></div>
      <div class="fv-pane" data-pane="focus" hidden><h3>Focus</h3><div class="fv-focus" data-k="focus"></div></div>
    </div>
    <nav class="fv-ph-tabs" role="tablist">${['tasks', 'map', 'messages', 'focus'].map((t) => `<button type="button" role="tab" data-tab="${t}" aria-label="${t[0].toUpperCase()}${t.slice(1)}">${TAB_ICONS[t]}<span>${t[0].toUpperCase()}${t.slice(1)}</span><i class="fv-tabbadge" data-k="tb-${t}" hidden></i></button>`).join('')}</nav>`;
  overlay.append(panel);
  const k = (key) => panel.querySelector(`[data-k="${key}"]`);
  const el = { clock: k('clock'), count: k('count'), tasks: k('tasks'), empty: k('empty'), map: k('map'), threads: k('threads'), thread: k('thread'), mtitle: k('mtitle'), focus: k('focus'), badge: btn.querySelector('[data-k="badge"]') };
  const map2d = createMap2d(el.map, map);

  let open = false;
  let tab = 'tasks';
  let sel = null; // the task whose details are open
  let active = null; // the pinned task (its place is the beam)
  let thread = null; // the giver whose messages are open
  const history = []; // { uid, giver, dir: 'in' | 'out' | 'sys', text }
  let sig = '';
  let lastDraw = 0;

  const placeName = (id) => PLACES[id].name;
  const colorOf = (g) => CAST[g].color;
  const avatar = (g) => `<span class="fv-av" style="--c:${colorOf(g)}">${initial(CAST[g].name)}</span>`;
  const reply = (uid, kind) => {
    const list = REPLIES[kind];
    return list[uid % list.length];
  };

  function setTab(t) {
    tab = t;
    for (const p of panel.querySelectorAll('.fv-pane')) p.hidden = p.dataset.pane !== t;
    for (const b of panel.querySelectorAll('[data-tab]')) { b.classList.toggle('on', b.dataset.tab === t); b.setAttribute('aria-selected', String(b.dataset.tab === t)); }
    sig = '';
    api.refresh(true);
  }

  // ── Tasks ──
  function tasksHtml(list) {
    return list.map((t) => {
      const urgent = t.urgency > 0.7 || t.remaining < 30;
      const sel_ = sel === t.uid;
      const detail = !sel_ ? '' : `
        <div class="fv-detail">
          <p>${esc(t.body)}</p>
          <p class="fv-do">At <b>${esc(placeName(t.at))}</b> · ${esc(t.doText)}</p>
          <div class="fv-actions">
            <button type="button" data-act="pin" class="fv-chip primary">${active === t.uid ? 'Following' : 'Follow'}</button>
            ${t.state === 'new' ? `<button type="button" data-act="yes" class="fv-chip">${esc(reply(t.uid, 'yes'))}</button>` : ''}
            ${t.later ? '' : `<button type="button" data-act="later" class="fv-chip">${esc(reply(t.uid, 'later'))}</button>`}
            <button type="button" data-act="no" class="fv-chip quiet">${esc(reply(t.uid, 'no'))}</button>
            ${t.delegable ? `<button type="button" data-act="mentors" class="fv-chip" ${q.state.mentors.tokens ? '' : 'disabled'}>Ask the mentors</button>` : ''}
          </div>
        </div>`;
      return `<li class="fv-task${sel_ ? ' sel' : ''}${urgent ? ' hot' : ''}${active === t.uid ? ' pinned' : ''}" data-uid="${t.uid}" data-state="${t.state}">
        <div class="fv-row" role="button" tabindex="0">${avatar(t.giver)}
          <div class="fv-tt"><b>${esc(t.title)}</b><small>${esc(t.giverName)} · ${esc(placeName(t.at))} · ${t.metres} m</small></div>
          <div class="fv-tm"><em class="fv-left">${left(t.remaining)}</em><span class="fv-pri p${t.pri}" aria-label="priority ${t.pri}">${'!'.repeat(t.pri)}</span></div>
        </div>${detail}</li>`;
    }).join('');
  }

  // ── Messages ──
  function threadsHtml() {
    const givers = [...new Set(history.map((h) => h.giver))];
    if (!givers.length) return '<li class="fv-empty">No messages yet.</li>';
    return givers.reverse().map((g) => {
      const last = [...history].reverse().find((h) => h.giver === g);
      const unread = q.open().filter((t) => t.giver === g && t.state === 'new').length;
      return `<li class="fv-th" data-giver="${g}" role="button" tabindex="0">${avatar(g)}<div class="fv-tt"><b>${esc(CAST[g].name)}</b><small>${esc(last.text)}</small></div>${unread ? `<i class="fv-unread">${unread}</i>` : ''}</li>`;
    }).join('');
  }
  function threadHtml(g) {
    const msgs = history.filter((h) => h.giver === g).map((h) => `<div class="fv-bubble ${h.dir}">${h.dir === 'in' ? `<b>${esc(h.title)}</b>` : ''}${esc(h.text)}</div>`).join('');
    const openTasks = q.open().filter((t) => t.giver === g);
    const chips = openTasks.map((t) => `<div class="fv-quick" data-uid="${t.uid}"><small>${esc(t.title)}</small>
      ${t.state === 'new' ? `<button type="button" data-act="yes" class="fv-chip primary">${esc(reply(t.uid, 'yes'))}</button>` : ''}
      ${t.later ? '' : `<button type="button" data-act="later" class="fv-chip">${esc(reply(t.uid, 'later'))}</button>`}
      <button type="button" data-act="no" class="fv-chip quiet">${esc(reply(t.uid, 'no'))}</button></div>`).join('');
    return `<button type="button" class="fv-back" data-act="back">Messages</button><div class="fv-msgs">${msgs}</div>${chips}`;
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
      <div class="fv-card"><div class="fv-sw ${on ? 'on' : ''}" role="switch" aria-checked="${on}" tabindex="0" data-act="focus"><i></i></div>
        <div><b>Do Not Disturb</b><small>${on ? `On for ${left(used)} more. The tasks wait for you - and land together when it ends.` : cd ? `Resting for ${left(cd)}.` : `Quiet for up to an hour (${FOCUS_MAX} min). Then ${FOCUS_COOLDOWN / 60} h before you can again.`}</small></div></div>
      <div class="fv-card col"><b>The mentors</b><small>They take trivial favours off you: ${Math.round(MENTORS.success * 100)}% of the time they get it right, for 60% of the reward.</small>
        <div class="fv-tokens" aria-label="${tokens} mentor tokens">${Array.from({ length: MENTORS.tokens }, (_, i) => `<i class="${i < tokens ? 'on' : ''}"></i>`).join('')}</div>
        ${delegable.length ? delegable.slice(0, 4).map((t) => `<div class="fv-quick" data-uid="${t.uid}"><small>${esc(t.title)}</small><button type="button" data-act="mentors" class="fv-chip" ${tokens ? '' : 'disabled'}>Hand over</button></div>`).join('') : '<small>Nothing they can take right now.</small>'}
      </div>`;
  }

  // ── events ──
  panel.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { sfx.tap(); setTab(tabBtn.dataset.tab); return; }
    const actBtn = e.target.closest('[data-act]');
    const holder = e.target.closest('[data-uid]');
    if (actBtn) {
      const act = actBtn.dataset.act;
      const uid = holder ? Number(holder.dataset.uid) : null;
      if (act === 'back') { thread = null; sig = ''; api.refresh(true); return; }
      if (act === 'focus') { sfx.tap(); if (q.state.focus.on) q.setFocus(false); else q.setFocus(true); sig = ''; api.refresh(true); return; }
      if (uid == null) return;
      if (act === 'pin') { api.setActive(active === uid ? null : uid); sfx.tap(); }
      else if (act === 'yes' || act === 'later' || act === 'no') {
        const t = q.get(uid);
        if (t && q.reply(uid, act)) { history.push({ uid, giver: t.giver, dir: 'out', text: reply(uid, act) }); sfx[act === 'no' ? 'sad' : 'pop'](); if (act === 'no' && active === uid) api.setActive(null); if (act === 'no') sel = null; }
      } else if (act === 'mentors') { if (q.delegate(uid)) { const t = q.get(uid); history.push({ uid, giver: t.giver, dir: 'sys', text: 'The mentors are on it.' }); sfx.pop(); if (active === uid) api.setActive(null); sel = null; } }
      sig = '';
      api.refresh(true);
      return;
    }
    const row = e.target.closest('.fv-row');
    if (row) { const uid = Number(row.parentElement.dataset.uid); sel = sel === uid ? null : uid; sfx.tap(); sig = ''; api.refresh(true); return; }
    const th = e.target.closest('.fv-th');
    if (th) { thread = th.dataset.giver; sfx.tap(); sig = ''; api.refresh(true); }
  });
  panel.addEventListener('keydown', (e) => {
    if ((e.code === 'Enter' || e.code === 'Space') && (e.target.matches('.fv-row, .fv-th, .fv-sw'))) { e.preventDefault(); e.target.click(); }
  });
  el.map.addEventListener('click', (e) => {
    const r = el.map.getBoundingClientRect();
    const id = map2d.hit(((e.clientX - r.left) / r.width) * el.map.width, ((e.clientY - r.top) / r.height) * el.map.height);
    if (!id) return;
    const t = q.list(getPlayer().near || 'home').find((x) => x.at === id);
    if (t) { api.setActive(t.uid); sfx.tap(); sig = ''; api.refresh(true); }
  });
  notes.addEventListener('click', (e) => { const n = e.target.closest('.fv-note'); if (n) { sel = Number(n.dataset.uid); api.open('tasks'); n.remove(); } });
  btn.addEventListener('click', () => api.toggle());

  const api = {
    btn,
    panel,
    get isOpen() { return open; },
    get active() { return active; },
    get tab() { return tab; },
    open(t = tab) {
      open = true;
      panel.hidden = false;
      btn.classList.add('on');
      requestAnimationFrame(() => panel.classList.add('in'));
      setTab(t);
      const on = panel.querySelector('.fv-ph-tabs [data-tab].on');
      if (on) on.focus({ preventScroll: true }); // keyboard users land in the phone; Esc brings them back
    },
    close() {
      open = false;
      panel.classList.remove('in');
      btn.classList.remove('on');
      panel.hidden = true;
      thread = null;
      if (panel.contains(document.activeElement)) { const c = overlay.querySelector('canvas'); if (c) c.focus({ preventScroll: true }); }
    },
    toggle() { if (open) api.close(); else api.open(); },
    /** A new task arrived: a banner on the "lock screen" (and the message thread). */
    notify(t, { urgent = false } = {}) {
      history.push({ uid: t.uid, giver: t.giver, dir: 'in', title: t.title, text: t.body });
      const n = document.createElement('div');
      n.className = `fv-note fv-glass${urgent ? ' urgent' : ''}`;
      n.dataset.uid = String(t.uid);
      n.style.setProperty('--c', colorOf(t.giver));
      n.innerHTML = `${avatar(t.giver)}<div class="fv-nt"><b>${esc(t.giverName)}</b><span>${esc(t.title)}</span></div><time>now</time>`;
      notes.append(n);
      while (notes.children.length > 3) notes.firstChild.remove();
      setTimeout(() => { n.classList.add('out'); setTimeout(() => n.remove(), 320); }, urgent ? 7000 : 5200);
      sig = '';
      api.refresh(); // the badge counts at once
    },
    setActive(uid) { active = uid; onPin(uid); },
    /** Redraws what changed (the list only when something in it did); `force` rebuilds now. */
    refresh(force = false) {
      const p = getPlayer();
      const list = q.list(p.near || 'home').map((t) => { const d = map.places[t.at].door; return { ...t, metres: Math.round(walkDistance(map, p.x, p.z, d.x, d.z)) }; });
      const n = list.length;
      el.badge.hidden = n === 0;
      el.badge.textContent = String(n);
      btn.classList.toggle('hot', list.some((t) => (t.pri >= 3 && t.state === 'new') || t.urgency > 0.7 || t.remaining < 30));
      if (!open) return;
      el.clock.textContent = hm(q.state.min);
      const s = `${tab}|${sel}|${active}|${thread}|${list.map((t) => `${t.uid}${t.state}${t.later ? 'l' : ''}${Math.ceil(t.remaining / 2)}:${Math.round(t.metres / 10)}`).join(',')}|${q.state.focus.on}|${q.state.mentors.tokens}|${history.length}|${Math.floor(q.state.min / 10)}`;
      if (!force && s === sig) return;
      sig = s;
      if (tab === 'tasks') {
        el.count.textContent = n ? `${n} open` : '';
        el.empty.hidden = n > 0;
        el.tasks.innerHTML = tasksHtml(list);
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
    /** Per frame while open: the live map. */
    update(now) {
      if (!open) return;
      if (tab === 'map' && now - lastDraw > 0.1) {
        lastDraw = now;
        const p = getPlayer();
        const byPlace = {};
        for (const t of q.list(p.near || 'home')) (byPlace[t.at] ||= []).push(t);
        const act = active != null ? q.get(active) : null;
        const pins = Object.entries(byPlace).map(([id, ts]) => ({ id, color: colorOf(ts[0].giver), label: PLACES[id].sign.charAt(0), count: ts.length, active: !!act && act.at === id }));
        map2d.draw({ player: p, pins });
      }
      api.refresh();
    },
    /** Where a place's pin is on the map canvas (canvas pixels): for tests. */
    pinPoint(placeId) { const d = map.places[placeId].door; return map2d.toCanvas(d.x, d.z); },
    dispose() { btn.remove(); notes.remove(); panel.remove(); },
  };
  void REL;
  return api;
}
