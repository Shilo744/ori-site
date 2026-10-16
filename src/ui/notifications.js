// Notification banners (T16). Implements the core/notify.js sink:
//   • while the camera is on the screen: macOS-style banners top-right INSIDE the screen (slide in / out, stack of up to 3,
//     auto-dismiss after ~5 s, hover pauses, click runs the action, × dismisses, sound)
//   • while you are looking at the room: a small black `.tag` toast at the top-right of the page (the screen is tiny then)
// Do Not Disturb never reaches the sink (core/notify.js), so banners are suppressed while it is on; the Notification
// Center still lists everything.
import './notifications.css';
import { notifications } from '../core/notify.js';
import { esc } from './apps/shared.js';
import { getApp } from './apps/registry.js';
import { bus } from '../core/bus.js';

const TROPHY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a2 2 0 0 0 2 4M16 6h3a2 2 0 0 1-2 4M12 13v4M8.500 20h7M10 17h4"/></svg>';
const BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/></svg>';
const MAX_BANNERS = 3;

/** App name + icon for a notification (`app: 'trophies'` is the achievements entry in the Arcade). */
export const TROPHY_ICON = TROPHY;
export function appMeta(id) {
  if (id === 'trophies') return { name: 'Achievements', icon: getApp('arcade')?.icon || TROPHY, trophy: true };
  const app = id && getApp(id);
  return app ? { name: app.name, icon: app.icon } : { name: 'System', icon: BELL, generic: true };
}

/** What a click on a notification does when it has no `onClick` of its own. */
export function defaultAction(note, open) {
  if (note.onClick) return () => note.onClick(note);
  if (note.app === 'trophies') return () => open('arcade', { tab: 'trophies' });
  if (note.app && getApp(note.app)) return () => open(note.app);
  return null;
}

/**
 * @param {object} o
 * @param {HTMLElement} o.stack      `.nb-stack` inside the screen
 * @param {HTMLElement} o.toasts     `#toasts` on the page (outside the CSS3D screen)
 * @param {() => boolean} o.isScreenLive   true while the camera is on the screen (or flat mode)
 * @param {(id: string, args?: object) => void} o.open   opens an app (from a click on a banner / toast)
 * @param {{ pop: Function }} o.sound
 */
export function createNotificationUI({ stack, toasts, isScreenLive, open, sound }) {
  const api = { duration: 4000 };
  const live = new Set();

  function makeItem(note, kind) {
    const meta = appMeta(note.app);
    const el = document.createElement('div');
    el.className = kind === 'banner' ? 'nb' : 'nt';
    el.setAttribute('role', 'status');
    const icon = note.icon || (meta.trophy ? TROPHY : meta.icon); // trusted SVG strings from code, never user input
    el.innerHTML = kind === 'banner'
      ? `<i class="nb-ic${meta.trophy ? ' trophy' : ''}">${icon}</i><div class="nb-tx"><div class="nb-top"><b>${esc(meta.name)}</b><span>now</span></div><strong>${esc(note.title)}</strong><p>${esc(note.body)}</p></div><button class="nb-x" type="button" aria-label="Dismiss"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.500 2.500l7 7M9.500 2.500l-7 7" stroke="currentColor" stroke-width="1.600" stroke-linecap="round"/></svg></button>`
      : `<i class="nt-ic">${icon}</i><span><b>${esc(note.title)}</b> · ${esc(note.body)}</span>`;
    return el;
  }

  function show(note, kind, host) {
    const el = makeItem(note, kind);
    const action = defaultAction(note, open);
    if (action) el.classList.add('act');
    const item = { el, timer: 0, left: api.duration, t0: 0, gone: false };
    const arm = () => { item.t0 = performance.now(); item.timer = setTimeout(() => dismiss(item), item.left); };
    const disarm = () => { clearTimeout(item.timer); item.left = Math.max(1200, item.left - (performance.now() - item.t0)); };
    el.addEventListener('pointerenter', () => { if (!item.gone) disarm(); });
    el.addEventListener('pointerleave', () => { if (!item.gone) { item.left = Math.min(item.left, 900); arm(); } }); // leaving the banner sends it away quickly
    el.addEventListener('click', (e) => {
      if (e.target.closest('.nb-x')) { dismiss(item); return; }
      if (action) { sound.pop(); action(); }
      dismiss(item);
    });
    host.appendChild(el);
    live.add(item);
    item.host = host;
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    arm();
    // keep the stack short: the oldest banner leaves when a fourth arrives
    const mine = [...live].filter((x) => x.host === host);
    if (mine.length > (kind === 'banner' ? MAX_BANNERS : 1)) dismiss(mine[0]);
    report();
    return item;
  }

  function dismiss(item) {
    if (item.gone) return;
    item.gone = true;
    clearTimeout(item.timer);
    item.el.classList.remove('in');
    item.el.classList.add('out');
    live.delete(item);
    report();
    setTimeout(() => item.el.remove(), 380);
  }

  /** Tells the limiter how many banners / toasts are on screen (it lets only one at a time through). */
  function report() { notifications.setVisible(live.size); }

  function sink(note) {
    if (isScreenLive()) { show(note, 'banner', stack); sound.pop(); } else show(note, 'toast', toasts);
  }
  notifications.setSink(sink);
  bus.on('nc:open', () => api.dismissAll()); // opening Notification Center sweeps the banners away (like macOS)

  Object.defineProperty(api, 'quiet', {
    /** Hide the banner stack and the toasts without stopping them (browser tests run with `?quiet=1`). */
    get: () => stack.classList.contains('quiet'),
    set: (v) => { stack.classList.toggle('quiet', !!v); toasts.classList.toggle('quiet', !!v); },
  });
  api.count = () => [...live].filter((x) => !x.gone).length; // test hooks
  api.dismissAll = () => { [...live].forEach(dismiss); };
  return api;
}
