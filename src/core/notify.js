// Notification API. The banner UI arrives with T16 and registers itself through `setSink`; until then notifications
// are queued (and kept in `recent()` for the Notification Center) so nothing is lost.
//   notify({ title: 'Achievement unlocked', body: 'Hungry', icon: '<svg…>', onClick: () => open('arcade') })
import { bus } from './bus.js';

const MAX_KEPT = 50;
const kept = []; // newest first
let sink = null;
let pending = [];
let seq = 0;
let dnd = false; // Do Not Disturb: kept in recent(), but no banner

export function notify(n) {
  const note = {
    id: ++seq,
    title: String(n?.title ?? ''),
    body: String(n?.body ?? ''),
    icon: n?.icon || '',
    app: n?.app || '',
    onClick: typeof n?.onClick === 'function' ? n.onClick : null,
    at: Date.now(),
    silent: dnd,
  };
  kept.unshift(note);
  if (kept.length > MAX_KEPT) kept.pop();
  if (dnd) { /* no banner */ } else if (sink) sink(note);
  else { pending.push(note); if (pending.length > MAX_KEPT) pending.shift(); }
  bus.emit('notify', note);
  return note.id;
}

/** Do Not Disturb (System Settings → Notifications, Control Center → Focus). */
export function setDoNotDisturb(on) { dnd = !!on; bus.emit('notify:dnd', dnd); }
export const isDoNotDisturb = () => dnd;

/** UI hook: receives every new notification, and first everything that was queued before it was installed. */
export function setSink(fn) {
  sink = fn;
  if (sink) {
    const queued = pending;
    pending = [];
    queued.forEach((n) => sink(n));
  }
}

/** Notifications that have not been shown yet (no UI installed). */
export const queued = () => pending.slice();
/** Most recent notifications, newest first. */
export const recent = () => kept.slice();
export function clear() {
  kept.length = 0;
  pending = [];
  bus.emit('notify:clear');
}

export const notifications = { notify, setSink, queued, recent, clear, setDoNotDisturb, isDoNotDisturb };
