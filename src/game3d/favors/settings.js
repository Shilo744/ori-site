// "Ori, Can You...?" — the player's comfort settings (PURE): what the pause menu changes and the game remembers. The sound level and "reduce motion" belong to the room's
// System Settings (the game reads them through the host's hooks and writes them back through the same hooks, so there is one truth); what is only about THIS game is kept
// here: a high-contrast HUD (which reaches every card), the sound captions (words for the sounds that tell you something; off by default), the key hints (auto = shown for the first seconds, on = always, off = never) and the resolution (auto = the frame-rate keeper may lower it, full = never). Nothing here can throw: a blocked storage just means "not remembered".
const KEY = 'ori-favors-settings-v1';
export const HINTS = ['auto', 'on', 'off'];
export const RESOLUTIONS = ['auto', 'full'];
export const DEFAULTS = Object.freeze({ contrast: false, hints: 'auto', resolution: 'auto', captions: false });

/** Anything (a corrupted save, an old version, a string) -> a valid settings object. Unknown keys are dropped. */
export function normalize(raw) {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return { contrast: o.contrast === true, hints: HINTS.includes(o.hints) ? o.hints : DEFAULTS.hints, resolution: RESOLUTIONS.includes(o.resolution) ? o.resolution : DEFAULTS.resolution, captions: o.captions === true };
}

/** A localStorage that never throws (or null when there is none). */
export function localStore() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

/**
 * @param {{ storage?: { getItem(k: string): string | null, setItem(k: string, v: string): void } | null }} [o]
 */
export function createSettings({ storage = localStore() } = {}) {
  let s = { ...DEFAULTS };
  try { const t = storage && storage.getItem(KEY); if (t) s = normalize(JSON.parse(t)); } catch { /* corrupted or blocked: the defaults */ }
  const listeners = new Set();
  return {
    get() { return { ...s }; },
    /** Changes some keys (invalid values fall back to the defaults); saves and tells the listeners only when something really changed. Returns the new settings. */
    set(patch) {
      const next = normalize({ ...s, ...(patch && typeof patch === 'object' ? patch : {}) });
      if (next.contrast === s.contrast && next.hints === s.hints && next.resolution === s.resolution && next.captions === s.captions) return { ...s };
      s = next;
      try { if (storage) storage.setItem(KEY, JSON.stringify(s)); } catch { /* not remembered, still applied */ }
      for (const fn of [...listeners]) { try { fn({ ...s }); } catch { /* a listener must not break the others */ } }
      return { ...s };
    },
    reset() { return this.set(DEFAULTS); },
    /** Calls fn(settings) after each change; returns the unsubscribe function. */
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
