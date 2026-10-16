// Achievements: definitions (registered by whoever owns the feature) + persisted unlock/progress state.
// The Trophies UI and the full catalogue arrive with T16; the API is final:
//   define([{ id: 'hungry', name: 'Hungry', desc: 'Score 25 in Snake', icon: '<svg…>', rarity: 'common', goal: 1 }])
//   unlock('hungry')          → true the first time (emits `achievement:unlock`, queues a notification)
//   progress('marathon', 31)  → raises the counter (never lowers it); reaching `goal` unlocks
//   increment('opened-apps')  → +1 shortcut for counters;  list() → every definition merged with its state
import { storage } from './storage.js';
import { bus } from './bus.js';
import { notify } from './notify.js';

const KEY = 'achievements';
const defs = new Map(); // id -> definition
let state = storage.get(KEY, {}) || {}; // id -> { progress, at? }

const save = () => storage.set(KEY, state);

export function define(list) {
  [].concat(list).forEach((d) => {
    if (!d || !d.id) return;
    defs.set(d.id, { rarity: 'common', goal: 1, icon: '', secret: false, desc: '', ...d, name: d.name || d.id });
  });
}

const view = (d) => {
  const s = state[d.id] || {};
  return { ...d, progress: Math.min(s.progress || 0, d.goal), unlocked: !!s.at, at: s.at || 0 };
};

export function isUnlocked(id) {
  return !!state[id]?.at;
}

export function unlock(id) {
  if (isUnlocked(id)) return false;
  const d = defs.get(id) || { id, name: id, goal: 1, icon: '', rarity: 'common', desc: '' };
  state[id] = { progress: d.goal, at: Date.now() };
  save();
  const info = view(d);
  bus.emit('achievement:unlock', info);
  announce(d);
  return true;
}

// Common achievements unlock silently (they are counted and listed, no banner); the rare ones announce themselves, and a few
// unlocking within a second are merged into ONE banner ("3 achievements unlocked").
const batch = [];
let batchTimer = 0;
function announce(d) {
  if (d.rarity === 'common') {
    notify({ title: 'Achievement unlocked', body: d.name, icon: d.icon, app: 'trophies', level: 'quiet' });
    return;
  }
  batch.push(d);
  clearTimeout(batchTimer);
  batchTimer = setTimeout(flush, 900);
}
function flush() {
  const list = batch.splice(0);
  if (!list.length) return;
  if (list.length === 1) notify({ title: 'Achievement unlocked', body: list[0].name, icon: list[0].icon, app: 'trophies' });
  else notify({ title: `${list.length} achievements unlocked`, body: list.map((x) => x.name).join(' · '), icon: list[0].icon, app: 'trophies' });
}

export function progress(id, n) {
  const d = defs.get(id);
  const goal = d ? d.goal : 1;
  const cur = state[id]?.progress || 0;
  if (n > cur && !isUnlocked(id)) {
    state[id] = { ...state[id], progress: Math.min(n, goal) };
    save();
    bus.emit('achievement:progress', view(d || { id, name: id, goal, icon: '', rarity: 'common', desc: '' }));
  }
  if (n >= goal) unlock(id);
}

export function increment(id, by = 1) {
  progress(id, (state[id]?.progress || 0) + by);
}

export function list() {
  return [...defs.values()].map(view);
}

export function counts() {
  const all = list();
  return { unlocked: all.filter((a) => a.unlocked).length, total: all.length };
}

/** Wipes every unlock/progress (Settings → General → Reset progress). */
export function reset() {
  state = {};
  storage.remove(KEY);
  bus.emit('achievement:reset');
}

export const achievements = { define, unlock, progress, increment, isUnlocked, list, counts, reset };
