// "Ori, Can You...?" — the save slot (PURE). One versioned schema; a sanitiser that turns ANYTHING (a corrupted text, an old save, a hand-edited one) into a safe save or null;
// a storage that never throws and remembers what went wrong; and a short "save code" to copy and paste (export / import). Nothing here touches the DOM.
//   version 1 = the first format (no stamp) · version 2 = the same fields + `version` + `savedAt`. A save from a NEWER game is read for the fields this game knows.
import { WEEK, GOLDEN, UPGRADES, ECON } from './play-content.js';
import { REL } from './content.js';
import { MAX_LEVEL, xpToNext } from './boxer.js';
import { isFood } from './buffs.js';

export const SAVE_VERSION = 2;
export const SAVE_KEY = 'ori-favors-week-v1'; // (the key keeps its first name, so the first players' saves are still found)
export const CODE_PREFIX = 'ORI2';
export const CODE_ERRORS = {
  empty: 'Paste a save code first.',
  format: 'That does not look like a save code.',
  checksum: 'The code is damaged: copy it again.',
  data: 'The code could not be read.',
};

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v, lo, hi, dflt) => { const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN; return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; };
const int = (v, lo, hi, dflt) => Math.round(num(v, lo, hi, dflt));
const ID = /^[A-Za-z0-9][\w-]{0,31}$/; // (a game called '2048' has a best score too)
const RESERVED = new Set(['constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty']);
const okId = (k) => ID.test(k) && !RESERVED.has(k);
const ids = (v, max = 64) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && okId(x)))].slice(0, max) : []);
/** { name: finite number >= 0 } (other values are dropped) */
const counters = (v, max = 64) => {
  const out = {};
  if (isObj(v)) for (const k of Object.keys(v).slice(0, max)) if (okId(k) && typeof v[k] === 'number' && Number.isFinite(v[k])) out[k] = num(v[k], 0, 1e9, 0);
  return out;
};
const flags = (v, max = 32) => { const out = {}; if (isObj(v)) for (const k of Object.keys(v).slice(0, max)) if (okId(k) && v[k]) out[k] = true; return out; };
/** The daily wishes [experimental]: today's three (codes like 'hello:4'), the numbers they are measured from, which are done, the places gone into today, whether the bonus was paid. */
/** The days of hellos per person for the gifts: { moti: { n: 2, d: 5 } } (n days counted, d the last of them). */
const gdaysOf = (v) => { const out = {}; if (isObj(v)) for (const k of Object.keys(v).slice(0, 32)) if (okId(k) && isObj(v[k])) out[k] = { n: int(v[k].n, 0, 999, 0), d: int(v[k].d, 0, 1e6, 0) }; return out; };
const wishState = (w) => { const o = isObj(w) ? w : {}; return { day: int(o.day, 0, 1e6, 0), list: (Array.isArray(o.list) ? o.list : []).filter((s) => typeof s === 'string' && /^[a-z-]{2,16}:\d{1,5}$/.test(s)).slice(0, 3), base: counters(o.base, 16), done: flags(o.done, 8), places: flags(o.places, 24), bonus: o.bonus === true }; };

/** Anything -> a complete, clamped save (or null when it is not even an object). Unknown fields are dropped; missing ones get their starting values. */
export function sanitizeSave(raw) {
  if (!isObj(raw)) return null;
  const b = isObj(raw.boxer) ? raw.boxer : {};
  const level = int(b.level, 1, MAX_LEVEL, 1);
  const p = isObj(raw.progress) ? raw.progress : {};
  const e = isObj(raw.eco) ? raw.eco : {};
  const owned = {};
  for (const u of UPGRADES) { const lv = int(isObj(e.owned) ? e.owned[u.id] : 0, 0, u.levels.length, 0); if (lv > 0) owned[u.id] = lv; }
  const rel = isObj(raw.rel) ? raw.rel : {};
  return {
    version: SAVE_VERSION,
    savedAt: int(raw.savedAt, 0, 8.64e15, 0),
    day: int(raw.day, 1, WEEK.days + 1, 1),
    rel: Object.fromEntries(Object.keys(REL).map((k) => [k, num(rel[k], 0, 100, 60)])),
    golden: [...new Set((Array.isArray(raw.golden) ? raw.golden : []).map((i) => (Number.isInteger(i) ? i : -1)).filter((i) => i >= 0 && i < GOLDEN.length))],
    history: (Array.isArray(raw.history) ? raw.history : []).filter(isObj).slice(-60).map((h) => ({ day: int(h.day, 1, WEEK.days + 1, 1), earned: int(h.earned, 0, 1e7, 0), helped: int(h.helped, 0, 999, 0), score: int(h.score, 0, 1e7, 0) })),
    seed: int(raw.seed, 1, 1e9, 1),
    wins: counters(raw.wins, 32),
    love: num(raw.love, 0, 100, 0),
    boxer: { xp: int(b.xp, 0, xpToNext(level) - 1, 0), level, beaten: ids(b.beaten, 16), fights: int(b.fights, 0, 1e6, 0), wins: int(b.wins, 0, 1e6, 0), reveal: b.reveal === true },
    // (everything the game keeps on `progress`: numbers (counters, among them hi_<who> and driven), goalsDone, trophies (ids), seen (places gone into), evDone (the city events enjoyed today), tips, best (the arcade) and train (the speed bag's drill of the day: day + how many times))
    progress: { ...counters(p), hellos: int(p.hellos, 0, 1e6, 0), shiloHi: int(p.shiloHi, 0, 1e6, 0), arcade: int(p.arcade, 0, 1e6, 0), arcadeBest: int(p.arcadeBest, 0, 1e9, 0), goalsDone: ids(p.goalsDone), trophies: ids(p.trophies, 64), seen: flags(p.seen, 40), stamps: flags(p.stamps, 24), fed: isObj(p.fed) && isFood(p.fed.id) ? { id: p.fed.id, day: int(p.fed.day, 0, 1e6, 0) } : null, photoPlaces: flags(p.photoPlaces, 24), gifts: flags(p.gifts, 32), gdays: gdaysOf(p.gdays), cats: counters(p.cats, 8), leagueWon: flags(p.leagueWon, 16), evDone: flags(p.evDone, 16), tips: flags(p.tips), best: counters(p.best, 16), wish: wishState(p.wish), wishLog: (Array.isArray(p.wishLog) ? p.wishLog : []).map((v) => int(v, 0, 3, 0)).slice(-14), ...(isObj(p.train) ? { train: { day: int(p.train.day, 1, 1e6, 1), n: int(p.train.n, 0, 999, 0) } } : {}) },
    eco: { peaches: int(e.peaches, 0, 1e7, ECON.start), owned, lifetime: int(e.lifetime, 0, 1e9, 0), spent: int(e.spent, 0, 1e9, 0) },
  };
}

/** One line for a toast: "Day 3 - boxer Lv 4 - 220 peaches". */
export const describeSave = (s) => `Day ${s.day} · boxer Lv ${s.boxer.level} · ${s.eco.peaches} peaches`;

// ── the save code: ORI2-<base64url of the JSON>-<8 hex checksum>. The checksum catches a code that was cut or mistyped; it is not a lock (anyone can edit their own save). ──
const fnv1a = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
const toB64 = (bytes) => { let s = ''; for (const x of bytes) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const fromB64 = (t) => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4)), (c) => c.charCodeAt(0));

export function encodeSave(save) {
  const clean = sanitizeSave(save) || sanitizeSave({});
  const body = toB64(new TextEncoder().encode(JSON.stringify(clean)));
  return `${CODE_PREFIX}-${body}-${fnv1a(body)}`;
}

/** { ok: true, save } or { ok: false, error: 'empty' | 'format' | 'checksum' | 'data' } (CODE_ERRORS says it in words). */
export function decodeSave(text) {
  const t = String(text == null ? '' : text).replace(/[\s"'`]+/g, ''); // (pasted with spaces, line breaks, quotes)
  if (!t) return { ok: false, error: 'empty' };
  const m = new RegExp(`^${CODE_PREFIX}-([A-Za-z0-9_-]+)-([0-9a-fA-F]{8})$`).exec(t);
  if (!m) return { ok: false, error: 'format' };
  if (fnv1a(m[1]) !== m[2].toLowerCase()) return { ok: false, error: 'checksum' };
  let obj;
  try { obj = JSON.parse(new TextDecoder().decode(fromB64(m[1]))); } catch { return { ok: false, error: 'data' }; }
  const save = sanitizeSave(obj);
  return save ? { ok: true, save } : { ok: false, error: 'data' };
}

// ── the storage ──
const isFull = (e) => /quota|full|exceed/i.test(`${e && e.name} ${e && e.message}`);

/**
 * A storage that never throws (private windows, blocked or full storage, tests without a window). `problem` says what went wrong last:
 * null | 'blocked' | 'full' | 'corrupt' (a save that could not be read is kept under "<key>-bad" instead of being thrown away).
 * @param {{ getItem(k: string): string | null, setItem(k: string, v: string): void, removeItem?(k: string): void } | null} [store]
 */
export function safeStorage(store, key = SAVE_KEY) {
  let problem = null;
  const get = () => { try { return store || (typeof localStorage !== 'undefined' ? localStorage : null); } catch { return null; } };
  return {
    get problem() { return problem; },
    /** The save (sanitised) or null. */
    read() {
      const s = get();
      if (!s) return null;
      let text;
      try { text = s.getItem(key); } catch { problem = 'blocked'; return null; }
      if (!text) return null;
      let parsed = null;
      try { parsed = JSON.parse(text); } catch { /* corrupt */ }
      const save = sanitizeSave(parsed);
      if (!save) {
        problem = 'corrupt';
        try { s.setItem(`${key}-bad`, String(text).slice(0, 100000)); s.removeItem(key); } catch { /* nothing more to do */ }
        return null;
      }
      return save;
    },
    /** True when it was saved. */
    write(v) {
      const s = get();
      if (!s) return false;
      try { s.setItem(key, JSON.stringify({ ...v, version: SAVE_VERSION, savedAt: Date.now() })); problem = null; return true; } catch (e) { problem = isFull(e) ? 'full' : 'blocked'; return false; }
    },
    clear() { try { const s = get(); if (s) s.removeItem(key); } catch { /* nothing to do */ } },
  };
}
