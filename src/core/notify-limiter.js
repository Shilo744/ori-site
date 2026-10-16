// The banner rate limiter (T50). PURE: no DOM, no clock of its own (every call is told the time), so it is tested in node.
// Rules for the default "Quiet" style: nothing in the first 6 s after you enter the screen, one banner at a time, at least 25 s
// between banners, at most 3 banners per visit. Everything the limiter holds back still reaches the Notification Center.
export const STYLES = {
  quiet: { name: 'Quiet', minGap: 25000, maxPerEntry: 3, quietFor: 6000 },
  normal: { name: 'Normal', minGap: 7000, maxPerEntry: 8, quietFor: 3000 },
  off: { name: 'Off', minGap: Infinity, maxPerEntry: 0, quietFor: 0 },
  all: { name: 'All (tests)', minGap: 0, maxPerEntry: Infinity, quietFor: 0 }, // not offered in the UI
};
export const STYLE_IDS = ['quiet', 'normal', 'off'];

/**
 * @param {string} [style] 'quiet' (default) | 'normal' | 'off'
 */
export function createLimiter(style = 'quiet') {
  let cfg = STYLES[style] || STYLES.quiet;
  let enteredAt = -Infinity; // when the visitor last entered / woke the screen
  let lastBanner = -Infinity;
  let shown = 0; // banners shown since entering
  let visible = 0; // banners on screen right now (the UI keeps this up to date)
  let held = 0; // notifications held back since entering
  let scale = 1; // 1 = real time; the tests (?fast=1) shrink every wait
  return {
    get style() { return Object.keys(STYLES).find((k) => STYLES[k] === cfg); },
    setStyle(s) { cfg = STYLES[s] || STYLES.quiet; },
    /** The visitor arrived at the screen (first entry, coming back from the room, waking from sleep): a new visit starts. */
    entered(t) { enteredAt = t; shown = 0; held = 0; },
    /** The UI tells how many banners are on screen. */
    setVisible(n) { visible = n; },
    setScale(k) { scale = k > 0 ? k : 1; },
    /** Forget the history (the clock was swapped: old timestamps mean nothing on the new time base). */
    resetHistory() { enteredAt = -Infinity; lastBanner = -Infinity; shown = 0; held = 0; },
    /**
     * Should this notification pop up as a banner at time `t`? If yes the limiter counts it. `note.level` can be 'quiet' (never a
     * banner: common achievements) or 'urgent' (skips the gap rule, still respects Off and the one-at-a-time rule).
     */
    decide(note, t) {
      const level = (note && note.level) || 'normal';
      if (cfg.maxPerEntry === 0 || level === 'quiet') { held++; return false; }
      if (visible > 0 && cfg !== STYLES.all) { held++; return false; }
      if (t - enteredAt < cfg.quietFor * scale) { held++; return false; }
      if (shown >= cfg.maxPerEntry) { held++; return false; }
      if (level !== 'urgent' && t - lastBanner < cfg.minGap * scale) { held++; return false; }
      lastBanner = t;
      shown++;
      return true;
    },
    get shown() { return shown; },
    get held() { return held; },
  };
}
