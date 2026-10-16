// NEON DRIFT — where the special road sections go: tunnels and bridges. PURE (no three, no DOM, deterministic per seed).
// A tunnel needs a long, nearly straight stretch; a bridge a gently curving one. Neither may touch the start line,
// and they never overlap or follow each other too closely.
import { mulberry32 } from './rng.js';
import { wrapS } from './track-query.js';

const KEEP_CLEAR = 220; // m around the start/finish line that stay open road
const GAP = 160; // minimum distance between two special sections

/** Largest |smoothed curvature| between s0 and s1. */
function maxCurvature(track, s0, s1) {
  let k = 0;
  const a = Math.floor(s0 / track.ds);
  const b = Math.ceil(s1 / track.ds);
  for (let i = a; i <= b; i++) k = Math.max(k, Math.abs(track.kappaS[i % track.n]));
  return k;
}

function candidates(track, len, maxK, rnd) {
  const out = [];
  for (let s = KEEP_CLEAR; s + len < track.length - KEEP_CLEAR; s += 20) {
    const k = maxCurvature(track, s, s + len);
    if (k <= maxK) out.push({ s0: s, s1: s + len, k, r: rnd() });
  }
  return out;
}

/**
 * @param {object} track from generateTrack
 * @param {number} seed
 * @param {{ tunnels?: number, bridges?: number }} want
 * @returns {{ kind: 'tunnel' | 'bridge', s0: number, s1: number }[]} sorted by s0
 */
export function pickZones(track, seed, want = { tunnels: 1, bridges: 1 }) {
  const rnd = mulberry32(seed * 131 + 7);
  const zones = [];
  const free = (z) => zones.every((o) => z.s0 > o.s1 + GAP || z.s1 < o.s0 - GAP);
  const take = (kind, len, maxK, n) => {
    for (let i = 0; i < n; i++) {
      // the straightest windows first, random among the best few so that every seed differs
      const list = candidates(track, len, maxK, rnd).filter(free).sort((a, b) => a.k - b.k).slice(0, 14);
      if (!list.length) return;
      const pick = list[Math.floor(rnd() * list.length)];
      zones.push({ kind, s0: pick.s0, s1: pick.s1 });
    }
  };
  take('tunnel', 200, 0.004, want.tunnels ?? 1);
  take('bridge', 170, 0.006, want.bridges ?? 1);
  zones.sort((a, b) => a.s0 - b.s0);
  return zones;
}

/** 0..1 how deep inside a zone of `kind` the arc length `s` is (smooth at the ends, `fade` metres), 0 outside. */
export function zoneDepth(track, zones, kind, s, fade = 14) {
  for (const z of zones) {
    if (z.kind !== kind) continue;
    const d = Math.min(wrapS(track, s) - z.s0, z.s1 - wrapS(track, s));
    if (d > 0) return Math.min(1, d / fade);
  }
  return 0;
}

export const inZone = (zones, kind, s) => zones.some((z) => z.kind === kind && s >= z.s0 && s <= z.s1);
