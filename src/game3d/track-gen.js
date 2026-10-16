// NEON DRIFT track generator + validation. PURE: no three, no DOM, no Math.random — a seed fully determines the track.
//
// Pipeline: seeded corner plan (straights + sweeps + kinks + 2 hairpins, total turning = 360°) → straight lengths solved so the
// loop closes exactly → control points → closed Catmull-Rom spline (chord-scaled Hermite) → resampled at a uniform arc length
// (DS metres) → tables for heading, curvature, banking, width, elevation → validation. A candidate that fails validation is
// dropped and the generator tries the next derived seed (a safe stadium layout is the last resort and is never needed in tests).
//
// Conventions (x, z = ground plane, y = up). Heading ψ: forward = (cos ψ, sin ψ); right = (−sin ψ, cos ψ). ψ grows when turning
// right. `lateral` is the signed distance to the centre line along `right` (positive = right of the centre line). Bank b > 0
// means the right edge is lower (a right-hand corner banks into the turn).
import { mulberry32, subSeed, hashNumbers, clamp, smoothstep, wrapIdx, wrapPi } from './rng.js';
import { DS, WALL_MARGIN } from './track-query.js';

const TAU = Math.PI * 2;
export const LIMITS = {
  minLength: 2500,
  maxLength: 4500,
  minRadius: 22, // m, tightest allowed centre-line radius
  maxGrade: 0.09, // |dy/ds|
  minStraight: 280, // the longest straight must be at least this long (the start/finish straight)
  minHairpins: 2,
  maxBank: 0.22, // rad
};

// ── 1. plan ────────────────────────────────────────────────────────────────

/** A random corner plan or null when this draw cannot close (the caller just draws again). */
function plan(rnd) {
  const n = 8 + Math.floor(rnd() * 4); // 8..11 corners
  let h1 = Math.floor(rnd() * n);
  let h2 = h1;
  for (let k = 0; k < 20; k++) {
    h2 = Math.floor(rnd() * n);
    const d = Math.abs(h2 - h1);
    if (Math.min(d, n - d) >= 2) break;
  }
  const dd = Math.abs(h2 - h1);
  if (Math.min(dd, n - dd) < 2) return null;
  const corners = [];
  for (let i = 0; i < n; i++) {
    if (i === h1 || i === h2) {
      corners.push({ kind: 'hairpin', sign: rnd() < 0.16 ? -1 : 1, angle: (150 + rnd() * 26) * (Math.PI / 180), R: 27 + rnd() * 11 });
    } else if (rnd() < 0.24) {
      corners.push({ kind: 'kink', sign: rnd() < 0.5 ? -1 : 1, angle: (9 + rnd() * 15) * (Math.PI / 180), R: 230 + rnd() * 240 });
    } else {
      corners.push({ kind: 'sweep', sign: rnd() < 0.3 ? -1 : 1, angle: (28 + rnd() * 62) * (Math.PI / 180), R: 105 + rnd() * 215 });
    }
  }
  // one sweep absorbs the remainder so the loop turns exactly 360° to the right
  const sweeps = [];
  corners.forEach((c, i) => { if (c.kind === 'sweep') sweeps.push(i); });
  if (!sweeps.length) return null;
  const b = sweeps[Math.floor(rnd() * sweeps.length)];
  const restSum = () => corners.reduce((acc, c, i) => acc + (i === b ? 0 : c.sign * c.angle), 0);
  // repair: flip turns until the balancing sweep lands in a sensible range
  for (let k = 0; k < 16; k++) {
    const need = TAU - restSum();
    if (need >= 0.55 && need <= 2.4) break;
    const flip = (want) => {
      const idx = [];
      corners.forEach((c, i) => { if (i !== b && c.kind !== 'hairpin' && c.sign === want) idx.push(i); });
      if (!idx.length) return false;
      corners[idx[Math.floor(rnd() * idx.length)]].sign = -want;
      return true;
    };
    if (need > 2.4) { if (!flip(-1)) for (const c of corners) if (c.kind !== 'hairpin') c.angle *= 1.12; }
    else flip(1);
  }
  const need = TAU - restSum();
  if (need < 0.45 || need > 2.6) return null;
  corners[b].sign = 1;
  corners[b].angle = need;
  const lens = corners.map(() => 70 + Math.pow(rnd(), 1.5) * 520);
  lens[Math.floor(rnd() * n)] = 450 + rnd() * 220; // there is always one long straight
  return { corners, lens, mirror: rnd() < 0.5 ? -1 : 1 };
}

/** Straight lengths adjusted (weighted least squares, active set for the minimum lengths) so that the loop closes. Returns lengths or null. */
function closeLoop(p) {
  const n = p.corners.length;
  let h = 0;
  let dx = 0;
  let dz = 0;
  const hs = [];
  for (let i = 0; i < n; i++) {
    hs.push(h);
    const c = p.corners[i];
    const a = c.sign * c.angle;
    const s = c.sign;
    dx += s * c.R * (-Math.sin(h) - -Math.sin(h + a));
    dz += s * c.R * (Math.cos(h) - Math.cos(h + a));
    h += a;
  }
  const tx = hs.map((a) => Math.cos(a));
  const tz = hs.map((a) => Math.sin(a));
  const minLen = p.corners.map((c, i) => 36 + (p.corners[(i + n - 1) % n].kind === 'hairpin' ? 24 : 0) + (c.kind === 'hairpin' ? 24 : 0));
  const fixed = new Array(n).fill(false);
  const len = p.lens.slice();
  for (let iter = 0; iter < n; iter++) {
    let rx = -dx;
    let rz = -dz;
    let mxx = 0;
    let mxz = 0;
    let mzz = 0;
    for (let i = 0; i < n; i++) {
      if (fixed[i]) { rx -= len[i] * tx[i]; rz -= len[i] * tz[i]; continue; }
      rx -= p.lens[i] * tx[i];
      rz -= p.lens[i] * tz[i];
      const w = p.lens[i];
      mxx += w * tx[i] * tx[i];
      mxz += w * tx[i] * tz[i];
      mzz += w * tz[i] * tz[i];
    }
    const det = mxx * mzz - mxz * mxz;
    if (Math.abs(det) < 1e-3) return null;
    const lx = (mzz * rx - mxz * rz) / det;
    const lz = (-mxz * rx + mxx * rz) / det;
    let bad = false;
    for (let i = 0; i < n; i++) {
      if (fixed[i]) continue;
      len[i] = p.lens[i] + p.lens[i] * (tx[i] * lx + tz[i] * lz);
      if (len[i] < minLen[i]) { len[i] = minLen[i]; fixed[i] = true; bad = true; }
    }
    if (!bad) return len;
  }
  return null;
}

/** Control points (x, z pairs) along the planned path, starting near the middle of the longest straight. */
function controlPoints(p, lens) {
  const n = p.corners.length;
  const mir = p.mirror;
  const pts = [];
  const meta = []; // for each point: cumulative distance
  let x = 0;
  let z = 0;
  let h = 0;
  let dist = 0;
  let longest = 0;
  for (let i = 1; i < n; i++) if (lens[i] > lens[longest]) longest = i;
  let midDist = 0;
  const add = () => { pts.push(x, z); meta.push(dist); };
  for (let i = 0; i < n; i++) {
    const L = lens[i];
    const steps = Math.max(2, Math.ceil(L / 32));
    for (let k = 0; k < steps; k++) {
      add();
      x += Math.cos(h) * (L / steps);
      z += Math.sin(h) * (L / steps);
      dist += L / steps;
    }
    if (i === longest) midDist = dist - L / 2;
    const c = p.corners[i];
    const a = c.sign * c.angle;
    const arcLen = c.R * c.angle;
    const m = Math.max(2, Math.ceil(arcLen / Math.min(30, c.R * 0.55)));
    const s = c.sign;
    // centre of the arc
    const cx = x + s * c.R * -Math.sin(h);
    const cz = z + s * c.R * Math.cos(h);
    for (let k = 0; k < m; k++) {
      add();
      const hh = h + (a * (k + 1)) / m;
      x = cx - s * c.R * -Math.sin(hh);
      z = cz - s * c.R * Math.cos(hh);
      dist += arcLen / m;
    }
    h += a; // (the arc's end is the next straight's first point, added there)
  }
  // rotate so that the start is the point closest to the middle of the longest straight
  const count = meta.length;
  let best = 0;
  for (let i = 0; i < count; i++) if (Math.abs(meta[i] - midDist) < Math.abs(meta[best] - midDist)) best = i;
  const out = new Float64Array(count * 2);
  const x0 = pts[best * 2];
  const z0 = pts[best * 2 + 1];
  for (let i = 0; i < count; i++) {
    const j = (best + i) % count;
    out[i * 2] = pts[j * 2] - x0;
    out[i * 2 + 1] = (pts[j * 2 + 1] - z0) * mir;
  }
  return out;
}

// ── 2. spline + uniform resample ───────────────────────────────────────────

/** Closed chord-scaled Catmull-Rom through the control points, then resampled every DS metres. */
function sampleSpline(ctrl) {
  const m = ctrl.length / 2;
  const px = (i) => ctrl[wrapIdx(i, m) * 2];
  const pz = (i) => ctrl[wrapIdx(i, m) * 2 + 1];
  const dense = [];
  for (let i = 0; i < m; i++) {
    const x0 = px(i);
    const z0 = pz(i);
    const x1 = px(i + 1);
    const z1 = pz(i + 1);
    const c = Math.hypot(x1 - x0, z1 - z0);
    let ax = x1 - px(i - 1);
    let az = z1 - pz(i - 1);
    let bx = px(i + 2) - x0;
    let bz = pz(i + 2) - z0;
    const la = Math.hypot(ax, az) || 1;
    const lb = Math.hypot(bx, bz) || 1;
    ax = (ax / la) * c; az = (az / la) * c;
    bx = (bx / lb) * c; bz = (bz / lb) * c;
    const steps = Math.max(2, Math.ceil(c / 1));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;
      dense.push(h00 * x0 + h10 * ax + h01 * x1 + h11 * bx, h00 * z0 + h10 * az + h01 * z1 + h11 * bz);
    }
  }
  const dn = dense.length / 2;
  const cum = new Float64Array(dn + 1);
  for (let i = 0; i < dn; i++) {
    const j = (i + 1) % dn;
    cum[i + 1] = cum[i] + Math.hypot(dense[j * 2] - dense[i * 2], dense[j * 2 + 1] - dense[i * 2 + 1]);
  }
  const length = cum[dn];
  const n = Math.round(length / DS);
  const ds = length / n;
  const x = new Float64Array(n);
  const z = new Float64Array(n);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const target = i * ds;
    while (k < dn - 1 && cum[k + 1] < target) k++;
    const j = (k + 1) % dn;
    const span = cum[k + 1] - cum[k] || 1;
    const t = (target - cum[k]) / span;
    x[i] = dense[k * 2] + (dense[j * 2] - dense[k * 2]) * t;
    z[i] = dense[k * 2 + 1] + (dense[j * 2 + 1] - dense[k * 2 + 1]) * t;
  }
  return { n, ds, length, x, z };
}

/** Circular moving average with half-width `w` samples. */
function smoothArray(a, w) {
  const n = a.length;
  const out = new Float64Array(n);
  let acc = 0;
  for (let i = -w; i <= w; i++) acc += a[wrapIdx(i, n)];
  for (let i = 0; i < n; i++) {
    out[i] = acc / (2 * w + 1);
    acc += a[wrapIdx(i + w + 1, n)] - a[wrapIdx(i - w, n)];
  }
  return out;
}

// ── 3. tables ──────────────────────────────────────────────────────────────

function buildTables(base, rnd) {
  const { n, ds, length, x, z } = base;
  const tx = new Float64Array(n);
  const tz = new Float64Array(n);
  const psi = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = wrapIdx(i - 1, n);
    const b = wrapIdx(i + 1, n);
    const dx = x[b] - x[a];
    const dz = z[b] - z[a];
    const l = Math.hypot(dx, dz) || 1;
    tx[i] = dx / l;
    tz[i] = dz / l;
    psi[i] = Math.atan2(tz[i], tx[i]);
  }
  const kappa = new Float64Array(n);
  for (let i = 0; i < n; i++) kappa[i] = wrapPi(psi[wrapIdx(i + 1, n)] - psi[wrapIdx(i - 1, n)]) / (2 * ds);
  const kappaS = smoothArray(kappa, 6);
  const kappaT = smoothArray(kappa, 2); // lightly smoothed, for the minimum-radius check

  // elevation: a few low harmonics, flat around the start line, grade-limited
  const y = new Float64Array(n);
  const harm = [];
  const amp = 5 + rnd() * 10;
  for (let k = 1; k <= 4; k++) harm.push({ k, a: (amp * (k === 1 ? 1 : 0.8 / k)) * (0.6 + rnd() * 0.8), ph: rnd() * TAU });
  for (let i = 0; i < n; i++) {
    const s = i * ds;
    let h = 0;
    for (const o of harm) h += o.a * Math.sin((TAU * o.k * s) / length + o.ph);
    const d = Math.min(s, length - s);
    y[i] = h * smoothstep(60, 320, d);
  }
  let maxG = 0;
  for (let i = 0; i < n; i++) maxG = Math.max(maxG, Math.abs(y[wrapIdx(i + 1, n)] - y[wrapIdx(i - 1, n)]) / (2 * ds));
  const scale = maxG > 0.065 ? 0.065 / maxG : 1;
  for (let i = 0; i < n; i++) y[i] *= scale;
  const grade = new Float64Array(n);
  for (let i = 0; i < n; i++) grade[i] = (y[wrapIdx(i + 1, n)] - y[wrapIdx(i - 1, n)]) / (2 * ds);

  // banking into the turns, width growing with the curvature
  const bank = new Float64Array(n);
  for (let i = 0; i < n; i++) bank[i] = clamp(kappaS[i] * 12, -LIMITS.maxBank, LIMITS.maxBank);
  const bankS = smoothArray(bank, 5);
  const width = new Float64Array(n);
  const wph = rnd() * TAU;
  for (let i = 0; i < n; i++) {
    width[i] = 15 + 6.5 * smoothstep(0.004, 0.02, Math.abs(kappaS[i])) + 1.1 * Math.sin((TAU * 3 * i * ds) / length + wph);
  }
  const widthS = smoothArray(width, 8);
  return { tx, tz, psi, kappa, kappaS, kappaT, y, grade, bank: bankS, width: widthS };
}

// ── 4. the track object ────────────────────────────────────────────────────

function finishTrack(base, tables, meta) {
  const track = {
    seed: meta.seed,
    attempts: meta.attempts,
    fallback: !!meta.fallback,
    n: base.n,
    ds: base.ds,
    length: base.length,
    x: base.x,
    z: base.z,
    y: tables.y,
    tx: tables.tx,
    tz: tables.tz,
    psi: tables.psi,
    kappa: tables.kappa,
    kappaS: tables.kappaS,
    kappaT: tables.kappaT,
    grade: tables.grade,
    bank: tables.bank,
    width: tables.width,
    cache: {},
  };
  track.stats = trackStats(track);
  track.start = { x: track.x[0], y: track.y[0], z: track.z[0], psi: track.psi[0] };
  return track;
}

function trackStats(t) {
  const { n, ds } = t;
  let kmax = 0;
  let maxGrade = 0;
  let maxBank = 0;
  let minW = Infinity;
  let maxW = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    kmax = Math.max(kmax, Math.abs(t.kappaT[i]));
    maxGrade = Math.max(maxGrade, Math.abs(t.grade[i]));
    maxBank = Math.max(maxBank, Math.abs(t.bank[i]));
    minW = Math.min(minW, t.width[i]);
    maxW = Math.max(maxW, t.width[i]);
    minY = Math.min(minY, t.y[i]);
    maxY = Math.max(maxY, t.y[i]);
  }
  // longest straight (smoothed curvature below 1/650 m^-1) as a circular run
  const straightMask = new Uint8Array(n);
  for (let i = 0; i < n; i++) straightMask[i] = Math.abs(t.kappaS[i]) < 0.0015 ? 1 : 0;
  let longest = 0;
  let longestStart = 0;
  let run = 0;
  let runStart = 0;
  for (let i = 0; i < n * 2; i++) {
    if (straightMask[i % n]) {
      if (run === 0) runStart = i;
      run++;
      if (run > longest && run <= n) { longest = run; longestStart = runStart; }
    } else run = 0;
  }
  // hairpins: 160 m windows that turn more than 132°
  const win = Math.round(160 / ds);
  const cumPsi = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cumPsi[i + 1] = cumPsi[i] + wrapPi(t.psi[(i + 1) % n] - t.psi[i]);
  const marked = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    let d = 0;
    for (let k = 0; k < win; k++) d += wrapPi(t.psi[(i + k + 1) % n] - t.psi[(i + k) % n]);
    marked[i] = Math.abs(d) >= 2.3 ? 1 : 0;
  }
  let hairpins = 0;
  const first = marked.indexOf(0);
  if (first < 0) hairpins = 1;
  else {
    for (let j = 1; j <= n; j++) {
      const i = (first + j) % n;
      const prev = (first + j - 1) % n;
      if (marked[i] && !marked[prev]) hairpins++;
    }
  }
  return {
    length: t.length,
    minRadius: kmax > 0 ? 1 / kmax : Infinity,
    maxGrade,
    maxBank,
    minWidth: minW,
    maxWidth: maxW,
    minY,
    maxY,
    longestStraight: longest * ds,
    longestStraightStart: (longestStart % n) * ds,
    hairpins,
    totalTurn: cumPsi[n],
  };
}

/** Checks everything the game relies on. Returns { ok, errors, stats } — errors are human readable. */
export function validateTrack(t) {
  const errors = [];
  const st = t.stats;
  if (!(t.length >= LIMITS.minLength && t.length <= LIMITS.maxLength)) errors.push(`length ${t.length.toFixed(0)} m outside ${LIMITS.minLength}-${LIMITS.maxLength}`);
  if (st.minRadius < LIMITS.minRadius) errors.push(`min radius ${st.minRadius.toFixed(1)} m < ${LIMITS.minRadius}`);
  if (st.maxGrade > LIMITS.maxGrade) errors.push(`grade ${st.maxGrade.toFixed(3)} > ${LIMITS.maxGrade}`);
  if (st.longestStraight < LIMITS.minStraight) errors.push(`longest straight ${st.longestStraight.toFixed(0)} m < ${LIMITS.minStraight}`);
  if (st.hairpins < LIMITS.minHairpins) errors.push(`only ${st.hairpins} hairpin(s)`);
  if (Math.abs(Math.abs(st.totalTurn) - TAU) > 0.05) errors.push(`total turning ${st.totalTurn.toFixed(2)} rad is not one lap`);
  // the loop must not come back onto itself: every two stretches that are far apart along the road must also be far apart
  // in space (their walls may not touch)
  const n = t.n;
  const minArc = 48;
  const stride = 2;
  outer: for (let i = 0; i < n; i += stride) {
    for (let j = i + stride; j < n; j += stride) {
      const arc = Math.min((j - i) * t.ds, t.length - (j - i) * t.ds);
      if (arc < minArc) continue;
      const need = (t.width[i] + t.width[j]) / 2 + 2 * WALL_MARGIN + 4;
      const dx = t.x[i] - t.x[j];
      const dz = t.z[i] - t.z[j];
      if (dx * dx + dz * dz < need * need) {
        errors.push(`self-overlap near s=${(i * t.ds).toFixed(0)} / ${(j * t.ds).toFixed(0)} m (gap ${Math.hypot(dx, dz).toFixed(1)} < ${need.toFixed(1)})`);
        break outer;
      }
    }
  }
  // closure: the last sample must lead smoothly into the first
  const gap = Math.hypot(t.x[0] - t.x[n - 1], t.z[0] - t.z[n - 1]);
  if (Math.abs(gap - t.ds) > t.ds * 0.25) errors.push(`closure gap ${gap.toFixed(2)} m`);
  return { ok: errors.length === 0, errors, stats: st };
}

/** One candidate for a derived seed: { reason } when it was rejected early, else { base, tables }. */
function attempt(seed) {
  const rnd = mulberry32(seed);
  const p = plan(rnd);
  if (!p) return { reason: 'plan' };
  const lens = closeLoop(p);
  if (!lens) return { reason: 'close' };
  const total = lens.reduce((a, b) => a + b, 0) + p.corners.reduce((a, c) => a + c.R * c.angle, 0);
  if (total < LIMITS.minLength - 80 || total > LIMITS.maxLength + 80) return { reason: 'length' };
  const ctrl = controlPoints(p, lens);
  const base = sampleSpline(ctrl);
  const tables = buildTables(base, rnd);
  return { base, tables };
}

/** Why a derived seed was (not) accepted: 'plan' | 'close' | 'length' | a validation message | 'ok' (tuning/test helper). */
export function diagnoseAttempt(seed) {
  const c = attempt(seed);
  if (c.reason) return c.reason;
  const v = validateTrack(finishTrack(c.base, c.tables, { seed, attempts: 1 }));
  return v.ok ? 'ok' : v.errors[0].split(/[ (]/).slice(0, 2).join(' ');
}

/** A rounded stadium: the last resort (valid by construction), flagged `fallback`. */
function fallbackTrack(seed) {
  const R = 60;
  const straight = 620;
  const p = {
    corners: [
      { kind: 'hairpin', sign: 1, angle: Math.PI, R },
      { kind: 'sweep', sign: 1, angle: Math.PI / 2, R: 180 },
      { kind: 'sweep', sign: -1, angle: Math.PI / 4, R: 200 },
      { kind: 'sweep', sign: 1, angle: Math.PI / 4, R: 200 },
      { kind: 'hairpin', sign: 1, angle: Math.PI, R },
    ],
    lens: [straight, 260, 120, 300, straight],
    mirror: 1,
  };
  // not closed by construction → close it numerically; if that fails use a plain stadium of two hairpins
  let lens = closeLoop(p);
  if (!lens) {
    p.corners = [
      { kind: 'hairpin', sign: 1, angle: Math.PI, R },
      { kind: 'hairpin', sign: 1, angle: Math.PI, R },
    ];
    p.lens = [straight, straight];
    lens = p.lens;
  }
  const rnd = mulberry32(seed);
  const ctrl = controlPoints(p, lens);
  const base = sampleSpline(ctrl);
  return { base, tables: buildTables(base, rnd) };
}

/**
 * Generates the track for `seed`. Deterministic. `opts.maxAttempts` bounds the retry loop (default 600).
 * The result has `attempts` (how many candidates were tried) and `fallback` (true only if every one failed).
 */
export function generateTrack(seed, opts = {}) {
  const maxAttempts = opts.maxAttempts || 600;
  for (let a = 0; a < maxAttempts; a++) {
    const cand = attempt(subSeed(seed, a));
    if (cand.reason) continue;
    const track = finishTrack(cand.base, cand.tables, { seed, attempts: a + 1 });
    const v = validateTrack(track);
    if (v.ok) return track;
  }
  const fb = fallbackTrack(seed);
  return finishTrack(fb.base, fb.tables, { seed, attempts: maxAttempts, fallback: true });
}

/** Fingerprint of a track (determinism tests). */
export function trackHash(t) {
  let h = hashNumbers([t.n, t.length]);
  for (const arr of [t.x, t.z, t.y, t.bank, t.width]) h = hashNumbers(arr, h);
  return h;
}
