// Namespaced persistent storage (`ori2:` prefix). JSON in/out, never throws, and keeps working in memory when
// localStorage is unavailable (private window, blocked site data, previews). `mem` is a write-through cache, so a
// value that could not be persisted (quota) is still served for the rest of the session.
const NS = 'ori2:';
const mem = new Map(); // key (no namespace) -> raw JSON string

function backend() {
  try {
    const ls = window.localStorage;
    const probe = `${NS}__probe`;
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}
const ls = backend();

function readRaw(key) {
  if (mem.has(key)) return mem.get(key);
  if (!ls) return null;
  try {
    const raw = ls.getItem(NS + key);
    if (raw != null) mem.set(key, raw);
    return raw;
  } catch {
    return null;
  }
}

export function get(key, fallback = null) {
  try {
    const raw = readRaw(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Returns false when the value could not be persisted (it then lives in memory only). */
export function set(key, value) {
  let raw;
  try { raw = JSON.stringify(value); } catch { return false; }
  if (raw === undefined) return false;
  mem.set(key, raw);
  if (!ls) return false;
  try {
    ls.setItem(NS + key, raw);
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  mem.delete(key);
  try { if (ls) ls.removeItem(NS + key); } catch { /* ignore */ }
}

/** Keys (without the namespace) that start with `prefix`. */
export function keys(prefix = '') {
  const found = new Set();
  mem.forEach((_, k) => { if (k.startsWith(prefix)) found.add(k); });
  try {
    if (ls) {
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k && k.startsWith(NS) && k.slice(NS.length).startsWith(prefix) && !k.endsWith('__probe')) found.add(k.slice(NS.length));
      }
    }
  } catch { /* ignore */ }
  return [...found];
}

/** Removes every key under `prefix` ('' = everything this site stored). */
export function clear(prefix = '') {
  keys(prefix).forEach(remove);
}

/** A view of the store where every key is prefixed — `storage.scope('game:snake').get('best')`. */
export function scope(prefix) {
  const p = `${prefix}:`;
  return {
    get: (k, d) => get(p + k, d),
    set: (k, v) => set(p + k, v),
    remove: (k) => remove(p + k),
    keys: (sub = '') => keys(p + sub).map((k) => k.slice(p.length)),
    clear: () => clear(p),
  };
}

export const storage = { get, set, remove, keys, clear, scope, persistent: !!ls };
