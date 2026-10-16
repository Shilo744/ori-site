// Notification API. The banner UI arrives with T16 and registers itself through `setSink`; until then notifications
// are queued (and kept in `recent()` for the Notification Center) so nothing is lost.
//   notify({ title: 'Achievement unlocked', body: 'Hungry', icon: '<svg…>', onClick: () => open('arcade') })
import { bus } from './bus.js';
import { createLimiter } from './notify-limiter.js';

const MAX_KEPT = 50;
const kept = []; // newest first
let sink = null;
let pending = [];
let seq = 0;
let dnd = false; // Do Not Disturb: kept in recent(), but no banner
const limiter = createLimiter('quiet'); // one banner at a time, spaced out, capped per visit (T50)
let clock = () => performance.now(); // tests can inject a fake one

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
    level: n?.level || 'normal', // 'quiet' = never a banner (common achievements), 'urgent' = ignores the spacing rule
    shown: false, // did it pop up as a banner / toast? (false = it only landed in the Notification Center)
  };
  kept.unshift(note);
  if (kept.length > MAX_KEPT) kept.pop();
  if (dnd) { /* no banner */ } else if (sink) present(note);
  else { pending.push(note); if (pending.length > MAX_KEPT) pending.shift(); }
  bus.emit('notify', note);
  return note.id;
}

/** The limiter decides whether a notification may pop up now; if not it stays in the list only. */
function present(note) {
  note.shown = limiter.decide(note, clock());
  if (note.shown) sink(note);
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
    queued.forEach((n) => present(n));
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

/** The visitor arrived at the screen (first entry, back from the room, woke the laptop): a new visit starts for the limiter. */
export const entered = () => limiter.entered(clock());
/** The banner UI reports how many banners are on screen right now. */
export const setVisible = (n) => limiter.setVisible(n);
/** 'quiet' (default) | 'normal' | 'off' (Settings → Notifications → Banner style); 'all' is for tests. */
export function setBannerStyle(style) { limiter.setStyle(style); bus.emit('notify:style', limiter.style); }
export const bannerStyle = () => limiter.style;
/** Tests: shrink every wait of the limiter / inject a clock (ms). */
export const setTimeScale = (k) => limiter.setScale(k);
export const setClock = (fn) => { clock = fn || (() => performance.now()); limiter.resetHistory(); };

export const notifications = { notify, setSink, queued, recent, clear, setDoNotDisturb, isDoNotDisturb, entered, setVisible, setBannerStyle, bannerStyle, setTimeScale, setClock };
