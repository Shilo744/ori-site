// Notification Center (T16): click the clock in the menubar → recent notifications (with Clear) + Today widgets
// (calendar, weather, world clock). Same panel in 3D and flat mode.
import { notifications } from '../core/notify.js';
import { bus } from '../core/bus.js';
import { content as C } from '../content.js';
import { esc } from './apps/shared.js';
import { appMeta, defaultAction, TROPHY_ICON } from './notifications.js';

const ZONES = [['Tel Aviv', 'Asia/Jerusalem'], ['London', 'Europe/London'], ['New York', 'America/New_York'], ['Tokyo', 'Asia/Tokyo']];
const ago = (ts) => {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 45) return 'now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

function calendarHTML(d = new Date()) {
  const y = d.getFullYear(), m = d.getMonth(), today = d.getDate();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const prev = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const n = i - first + 1;
    if (n < 1) cells.push(`<i class="o">${prev + n}</i>`);
    else if (n > days) cells.push(`<i class="o">${n - days}</i>`);
    else cells.push(`<i${n === today ? ' class="t"' : ''}>${n}</i>`);
  }
  const rows = days + first > 35 ? 42 : 35;
  return `<div class="nc-cal"><b>${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b><div class="nc-cal-h">${'SMTWTFS'.split('').map((c) => `<i>${c}</i>`).join('')}</div><div class="nc-cal-g">${cells.slice(0, rows).join('')}</div></div>`;
}

function worldClockHTML() {
  const now = new Date();
  const dayKey = (tz) => now.toLocaleDateString('en-CA', { timeZone: tz });
  const home = now.toLocaleDateString('en-CA');
  return `<div class="nc-wc">${ZONES.slice(0, 4).map(([name, tz]) => {
    const t = now.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
    const dk = dayKey(tz);
    const rel = dk === home ? 'Today' : dk > home ? 'Tomorrow' : 'Yesterday';
    return `<div><b>${esc(t)}</b><span>${esc(name)}</span><em>${rel}</em></div>`;
  }).join('')}</div>`;
}

const weatherHTML = () => `<div class="nc-wx"><div class="c">${esc(C.location.split(',')[0])}</div><div class="t">27°</div><div class="s">Sunny<br><em>H:29° L:21°</em></div></div>`;

/**
 * @param {object} o
 * @param {HTMLElement} o.root   the desktop root
 * @param {(id: string, args?: object) => void} o.open
 * @param {() => void} o.closeOthers   closes menus / Control Center / Spotlight before opening
 */
export function createNotificationCenter({ root, open, closeOthers }) {
  const el = root.querySelector('.nc');
  let isOpen = false;
  let timer = 0;

  function render() {
    const all = notifications.recent();
    const list = all.slice(0, 5);
    el.innerHTML = `
      <div class="nc-h"><b>Notifications</b>${list.length ? '<button type="button" class="nc-clear" data-nc-clear>Clear</button>' : ''}</div>
      <div class="nc-list">${list.length ? list.map((n) => {
        const meta = appMeta(n.app);
        return `<div class="nc-n${defaultAction(n, open) ? ' act' : ''}" data-nid="${n.id}"><i class="nc-ic${meta.trophy ? ' trophy' : ''}">${n.icon || (meta.trophy ? TROPHY_ICON : meta.icon)}</i><div><div class="nc-top"><b>${esc(meta.name)}</b><span>${esc(ago(n.at))}</span></div><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p></div></div>`;
      }).join('') + (all.length > list.length ? `<div class="nc-more">+ ${all.length - list.length} older</div>` : '') : '<div class="nc-empty">No new notifications</div>'}</div>
      <div class="nc-h"><b>Today</b></div>
      <div class="nc-widgets"><div class="nc-w">${calendarHTML()}</div><div class="nc-w">${weatherHTML()}</div><div class="nc-w wide">${worldClockHTML()}</div></div>`;
  }

  function show() {
    if (isOpen) return;
    closeOthers();
    bus.emit('nc:open');
    isOpen = true;
    render();
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('in'));
    timer = setInterval(() => { if (isOpen) render(); }, 20000);
  }
  function hide() {
    if (!isOpen) return;
    isOpen = false;
    clearInterval(timer);
    el.classList.remove('in');
    el.hidden = true;
  }

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-nc-clear]')) { notifications.clear(); return; }
    const row = e.target.closest('[data-nid]');
    if (!row) return;
    const note = notifications.recent().find((n) => String(n.id) === row.dataset.nid);
    const act = note && defaultAction(note, open);
    if (act) { hide(); act(); }
  });
  bus.on('notify', () => { if (isOpen) render(); });
  bus.on('notify:clear', () => { if (isOpen) render(); });

  return {
    el,
    isOpen: () => isOpen,
    toggle() { if (isOpen) hide(); else show(); },
    close: hide,
    /** Click outside the panel (and not on the clock) closes it. */
    onClickAway(t) { if (isOpen && !t.closest('.nc') && !t.closest('[data-act="nc"]')) hide(); },
  };
}
