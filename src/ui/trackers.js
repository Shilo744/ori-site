// Progress trackers for the site-wide achievements (T16): listen to the shared bus and move the counters.
// Persisted sets live under `trk:*` and are wiped together with the achievements ("Reset progress").
import { achievements } from '../core/achievements.js';
import { bus } from '../core/bus.js';
import { storage } from '../core/storage.js';
import { listApps } from './apps/registry.js';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
const baseGame = (id) => String(id).split(':')[0];

/** A persisted set of strings; `add` returns the new size. */
const makeSet = (key) => {
  const load = () => new Set(storage.get(key, []) || []);
  return {
    add(v) { const s = load(); s.add(v); storage.set(key, [...s]); return s.size; },
    size: () => load().size,
    clear: () => storage.remove(key),
  };
};

/**
 * @param {object} o
 * @param {() => number} o.hours   the room's hour (0-24)
 * @param {() => number} o.night   0..1 darkness
 * @param {() => string[]} o.gameIds
 */
export function startTrackers({ hours, night, gameIds }) {
  const apps = makeSet('trk:apps'), games = makeSet('trk:games'), bests = makeSet('trk:bests'), accents = makeSet('trk:accents');
  const modes = makeSet('trk:modes'), notes = makeSet('trk:notes'), days = makeSet('trk:days');
  const appIds = () => listApps({ hidden: false, category: 'app' }).map((a) => a.id);
  let wallpapers = storage.get('trk:wp', 0);
  let openWins = 0;

  // opened every app / have 5 windows open
  bus.on('window:open', (id) => {
    openWins++;
    if (openWins >= 5) achievements.unlock('multitasker');
    if (appIds().includes(id)) achievements.progress('app-hopper', apps.add(id));
  });
  bus.on('window:close', () => { openWins = Math.max(0, openWins - 1); });

  // games
  bus.on('game:play', ({ id }) => {
    const base = baseGame(id);
    if (gameIds().includes(base)) achievements.progress('game-night', games.add(base));
  });
  bus.on('game:score', ({ id, score }) => { if (score > 0) achievements.progress('high-roller', bests.add(baseGame(id))); });

  // look & feel
  bus.on('wallpaper:change', () => { wallpapers++; storage.set('trk:wp', wallpapers); achievements.progress('wallpaper-changer', wallpapers); });
  bus.on('theme:change', ({ dark, accent }) => {
    if (dark) achievements.unlock('dark-side');
    achievements.progress('accent-artist', accents.add(accent));
  });
  bus.on('daylight:change', ({ mode }) => achievements.progress('time-traveller', modes.add(mode)));
  bus.on('system:change', ({ key, value }) => { if (key === 'dnd' && value) achievements.unlock('quiet-please'); });
  bus.on('spotlight:use', () => achievements.unlock('spotlight-pro'));
  bus.on('note:view', (id) => achievements.progress('bookworm', notes.add(id)));
  bus.on('terminal:sudo', () => achievements.unlock('sudo'));

  // entering the screen: first steps, time-of-day badges
  bus.on('screen:enter', () => {
    achievements.unlock('first-steps');
    if (night() > 0.6) achievements.unlock('night-owl');
    const h = hours();
    if (h >= 5 && h < 8.5) achievements.unlock('early-bird');
  });

  // Konami code anywhere (not while typing)
  let kpos = 0;
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.closest && e.target.closest('input, textarea')) return;
    kpos = e.code === KONAMI[kpos] ? kpos + 1 : e.code === KONAMI[0] ? 1 : 0;
    if (kpos === KONAMI.length) { kpos = 0; achievements.unlock('konami'); bus.emit('konami'); }
  });

  // "Regular": a second visit on a different calendar day
  const today = new Date().toISOString().slice(0, 10);
  if (days.add(today) >= 2) achievements.unlock('regular');

  // Completionist: everything else is unlocked
  const completion = () => {
    const others = achievements.list().filter((a) => a.id !== 'completionist');
    if (others.length && others.every((a) => a.unlocked)) achievements.unlock('completionist');
  };
  bus.on('achievement:unlock', () => setTimeout(completion, 0));

  // wipe the trackers with the achievements
  bus.on('achievement:reset', () => {
    [apps, games, bests, accents, modes, notes].forEach((s) => s.clear());
    wallpapers = 0;
    storage.remove('trk:wp');
  });
}
