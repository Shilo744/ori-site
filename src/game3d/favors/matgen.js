// "Ori, Can You...?" — procedural material maps (PURE: typed arrays in, typed arrays out; no three, no DOM, deterministic from a seed).
// Every material is three maps made in code: ALBEDO (sRGB bytes), a tangent-space NORMAL map (made from a height field) and a ROUGHNESS map (green
// channel, like glTF). They tile, so a wall or a pavement can repeat them over the whole neighbourhood. materials.js uploads them to the GPU.
import { mulberry32 } from '../rng.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;
const quint = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** Tileable fractal value noise, 0..1, as an N*N array. `freq` lattice cells across the first octave. */
export function fbm(N, rnd, freq = 4, oct = 4, gain = 0.5) {
  const out = new Float32Array(N * N);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < oct; o++) {
    const f = Math.max(1, Math.round(freq * 2 ** o));
    const lat = new Float32Array(f * f);
    for (let i = 0; i < lat.length; i++) lat[i] = rnd();
    const s = f / N;
    for (let y = 0; y < N; y++) {
      const fy = y * s;
      const y0 = Math.floor(fy);
      const wy = quint(fy - y0);
      const ra = (y0 % f) * f;
      const rb = ((y0 + 1) % f) * f;
      for (let x = 0; x < N; x++) {
        const fx = x * s;
        const x0 = Math.floor(fx);
        const wx = quint(fx - x0);
        const xa = x0 % f;
        const xb = (x0 + 1) % f;
        const a = mix(lat[ra + xa], lat[ra + xb], wx);
        const b = mix(lat[rb + xa], lat[rb + xb], wx);
        out[y * N + x] += mix(a, b, wy) * amp;
      }
    }
    total += amp;
    amp *= gain;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** Tangent-space normal map (bytes, RGBA) from a height field; `strength` in height-units per pixel-gradient. */
export function normalFromHeight(h, N, strength = 2) {
  const out = new Uint8ClampedArray(N * N * 4);
  for (let y = 0; y < N; y++) {
    const ya = ((y + N - 1) % N) * N;
    const yb = ((y + 1) % N) * N;
    const yc = y * N;
    for (let x = 0; x < N; x++) {
      const xa = (x + N - 1) % N;
      const xb = (x + 1) % N;
      const dx = (h[yc + xb] - h[yc + xa]) * strength;
      const dy = (h[yb + x] - h[ya + x]) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (yc + x) * 4;
      out[i] = (-dx / l * 0.5 + 0.5) * 255;
      out[i + 1] = (-dy / l * 0.5 + 0.5) * 255;
      out[i + 2] = (1 / l * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  return out;
}

/** Packs three float channels (0..1) into RGBA bytes. */
function pack(N, fn) {
  const out = new Uint8ClampedArray(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4;
    const c = fn(x, y, y * N + x);
    out[i] = c[0] * 255; out[i + 1] = c[1] * 255; out[i + 2] = c[2] * 255; out[i + 3] = 255;
  }
  return out;
}
const roughBytes = (N, r) => pack(N, (x, y, i) => [0, r[i], 0]);
const wrap = (v, N) => ((v % N) + N) % N;

/** A random-walk crack drawn into a darkness mask and a height dip. */
function crack(mask, height, N, rnd, len = 80, w = 1, depth = 0.5) {
  let x = rnd() * N;
  let y = rnd() * N;
  let a = rnd() * 6.283;
  for (let i = 0; i < len; i++) {
    a += (rnd() - 0.5) * 0.7;
    x += Math.cos(a);
    y += Math.sin(a);
    for (let dy = -w; dy <= w; dy++) for (let dx = -w; dx <= w; dx++) {
      const k = wrap(Math.round(y) + dy, N) * N + wrap(Math.round(x) + dx, N);
      const f = 1 - Math.hypot(dx, dy) / (w + 1);
      if (f > 0) { mask[k] = Math.max(mask[k], f); height[k] -= depth * f * 0.12; }
    }
  }
}

/** Soft disc stamped into an array (add `amount`). */
function stamp(arr, N, cx, cy, r, amount) {
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const d = Math.hypot(dx, dy) / r;
    if (d >= 1) continue;
    arr[wrap(Math.round(cy) + dy, N) * N + wrap(Math.round(cx) + dx, N)] += amount * (1 - d * d);
  }
}

// ── the materials ──
const GENERATORS = {
  /** Off-white trowelled stucco with hairline cracks and rain streaks. One tile = 4 m. */
  stucco(N, rnd) {
    const big = fbm(N, rnd, 3, 3);
    const mid = fbm(N, rnd, 10, 3);
    const grain = fbm(N, rnd, Math.max(16, N / 4), 2, 0.6);
    const crackMask = new Float32Array(N * N);
    const h = new Float32Array(N * N);
    for (let i = 0; i < h.length; i++) h[i] = mid[i] * 0.3 + grain[i] * 0.7;
    for (let k = 0; k < 5; k++) crack(crackMask, h, N, rnd, N * 0.18, 0, 0.8);
    const streak = new Float32Array(N);
    for (let x = 0; x < N; x++) streak[x] = rnd() < 0.08 ? 0.5 + rnd() * 0.5 : 0;
    const rough = new Float32Array(N * N);
    const albedo = pack(N, (x, y, i) => {
      const s = streak[x] * Math.max(0, 1 - y / (N * 0.7)) ** 2 * 0.1;
      const v = 0.93 + (big[i] - 0.5) * 0.07 + (grain[i] - 0.5) * 0.06 - s - crackMask[i] * 0.2;
      rough[i] = 0.82 + grain[i] * 0.14;
      return [v, v * 0.995, v * 0.98];
    });
    return { albedo, normal: normalFromHeight(h, N, N / 260), rough: roughBytes(N, rough) };
  },

  /** Smoother painted plaster (trim, plinths, shop fascias). */
  plaster(N, rnd) {
    const mid = fbm(N, rnd, 6, 3);
    const grain = fbm(N, rnd, Math.max(16, N / 3), 2, 0.55);
    const h = new Float32Array(N * N);
    for (let i = 0; i < h.length; i++) h[i] = mid[i] * 0.35 + grain[i] * 0.65;
    const rough = new Float32Array(N * N);
    const albedo = pack(N, (x, y, i) => { const v = 0.95 + (mid[i] - 0.5) * 0.05 + (grain[i] - 0.5) * 0.03; rough[i] = 0.62 + grain[i] * 0.12; return [v, v, v]; });
    return { albedo, normal: normalFromHeight(h, N, N / 140), rough: roughBytes(N, rough) };
  },

  /** Sidewalk of 40 cm cement tiles (a few with a quarter-circle pattern), grout lines, chips and the odd chewing gum. One tile = 4 m. */
  paving(N, rnd) {
    const n = 10;
    const cell = N / n;
    const grain = fbm(N, rnd, Math.max(16, N / 4), 3, 0.6);
    const mid = fbm(N, rnd, 6, 3);
    const tileV = []; const tileP = [];
    for (let i = 0; i < n * n; i++) { tileV.push(0.82 + rnd() * 0.18); tileP.push(rnd() < 0.22 ? 1 : rnd() < 0.12 ? 2 : 0); }
    const gum = new Float32Array(N * N);
    for (let k = 0; k < 4; k++) stamp(gum, N, rnd() * N, rnd() * N, 2 + rnd() * 1.5, 1);
    const h = new Float32Array(N * N);
    const rough = new Float32Array(N * N);
    const albedo = pack(N, (x, y, i) => {
      const tx = Math.floor(x / cell);
      const ty = Math.floor(y / cell);
      const u = (x - tx * cell) / cell;
      const v = (y - ty * cell) / cell;
      const ti = ty * n + tx;
      const edge = Math.min(u, v, 1 - u, 1 - v) * cell; // pixels from the grout
      const grout = edge < 1.4 ? 1 : edge < 2.6 ? (2.6 - edge) / 1.2 : 0;
      let val = tileV[ti] * (0.94 + (grain[i] - 0.5) * 0.14 + (mid[i] - 0.5) * 0.08);
      let pat = 0;
      if (tileP[ti] === 1) { // four quarter circles from the corners
        const d = Math.min(Math.hypot(u, v), Math.hypot(1 - u, v), Math.hypot(u, 1 - v), Math.hypot(1 - u, 1 - v));
        pat = Math.abs(d - 0.5) < 0.05 ? 1 : 0;
      } else if (tileP[ti] === 2) pat = (Math.floor(u * 6) + Math.floor(v * 6)) % 2 === 0 ? 0 : 0.5; // checker
      val *= 1 - pat * 0.1;
      val = mix(val, 0.6, grout * 0.6);
      val -= gum[i] * 0.35;
      h[i] = (1 - grout) * 0.7 + grain[i] * 0.25 - pat * 0.05 - gum[i] * 0.1;
      rough[i] = mix(0.78 + grain[i] * 0.15, 0.95, grout);
      return [val * 0.96, val * 0.94, val * 0.9];
    });
    return { albedo, normal: normalFromHeight(h, N, N / 70), rough: roughBytes(N, rough) };
  },

  /** Worn asphalt: aggregate, tar patches, cracks and a polished lane. One tile = 8 m. */
  asphalt(N, rnd) {
    const grain = fbm(N, rnd, Math.max(32, N / 2), 2, 0.7);
    const mid = fbm(N, rnd, 8, 4);
    const crackMask = new Float32Array(N * N);
    const h = new Float32Array(N * N);
    for (let i = 0; i < h.length; i++) h[i] = grain[i] * 0.7 + mid[i] * 0.3;
    for (let k = 0; k < 4; k++) crack(crackMask, h, N, rnd, N * 0.3, 0, 1);
    const patches = [];
    for (let k = 0; k < 3; k++) patches.push([rnd() * N, rnd() * N, N * (0.06 + rnd() * 0.1), N * (0.04 + rnd() * 0.08)]);
    const rough = new Float32Array(N * N);
    const albedo = pack(N, (x, y, i) => {
      let v = 0.41 + (grain[i] - 0.5) * 0.2 + (mid[i] - 0.5) * 0.1;
      let r = 0.86 + grain[i] * 0.1;
      for (const p of patches) {
        const dx = Math.min(Math.abs(x - p[0]), N - Math.abs(x - p[0]));
        const dy = Math.min(Math.abs(y - p[1]), N - Math.abs(y - p[1]));
        if (Math.hypot(dx / p[2], dy / p[3]) + (mid[i] - 0.5) * 0.9 < 1) { v *= 0.74; r = 0.55; h[i] *= 0.45; }
      }
      v -= crackMask[i] * 0.2;
      const polish = Math.max(0, Math.sin((x / N) * 6.283 * 2 + mid[i] * 3)) * 0.5 * (mid[i] > 0.5 ? 1 : 0);
      r -= polish * 0.2;
      v += polish * 0.04;
      rough[i] = r;
      return [v, v, v * 1.03];
    });
    return { albedo, normal: normalFromHeight(h, N, N / 170), rough: roughBytes(N, rough) };
  },

  /** Cream terrazzo with coloured chips, polished. One tile = 2 m. */
  terrazzo(N, rnd) {
    const mid = fbm(N, rnd, 5, 3);
    const chip = new Float32Array(N * N);
    const hue = new Float32Array(N * N);
    const palette = [0.1, 0.35, 0.6, 0.85];
    const chips = Math.floor(N * N / 120);
    for (let k = 0; k < chips; k++) {
      const cx = rnd() * N; const cy = rnd() * N; const r = 1 + rnd() * rnd() * 5;
      const a = rnd() * 3.14; const ca = Math.cos(a); const sa = Math.sin(a); const el = 0.5 + rnd() * 0.5;
      const tint = palette[Math.floor(rnd() * palette.length)];
      for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        const u = dx * ca + dy * sa; const v = (-dx * sa + dy * ca) / el;
        if (Math.hypot(u, v) < r) { const j = wrap(Math.round(cy) + dy, N) * N + wrap(Math.round(cx) + dx, N); chip[j] = 1; hue[j] = tint; }
      }
    }
    const h = new Float32Array(N * N);
    const rough = new Float32Array(N * N);
    const cols = [[0.55, 0.3, 0.22], [0.45, 0.45, 0.47], [0.9, 0.86, 0.76], [0.28, 0.27, 0.3]];
    const albedo = pack(N, (x, y, i) => {
      const base = 0.86 + (mid[i] - 0.5) * 0.06;
      let c = [base, base * 0.97, base * 0.9];
      if (chip[i]) { const k = cols[Math.floor(hue[i] * 4)]; c = [k[0], k[1], k[2]]; }
      h[i] = chip[i] * 0.15 + mid[i] * 0.05;
      rough[i] = chip[i] ? 0.28 : 0.38;
      return c;
    });
    return { albedo, normal: normalFromHeight(h, N, N / 120), rough: roughBytes(N, rough) };
  },

  /** Board-formed concrete: formwork seams, pores and stains. One tile = 4 m. */
  concrete(N, rnd) {
    const mid = fbm(N, rnd, 4, 4);
    const grain = fbm(N, rnd, Math.max(16, N / 4), 2, 0.6);
    const pores = new Float32Array(N * N);
    for (let k = 0; k < N * 0.6; k++) stamp(pores, N, rnd() * N, rnd() * N, 0.8 + rnd() * 1.6, 1);
    const h = new Float32Array(N * N);
    const rough = new Float32Array(N * N);
    const albedo = pack(N, (x, y, i) => {
      const seamH = Math.abs(((y / N) * 4) % 1 - 0.5) > 0.495 ? 1 : 0;
      const seamV = Math.abs(((x / N) * 2) % 1 - 0.5) > 0.497 ? 1 : 0;
      const seam = Math.max(seamH, seamV);
      const v = 0.62 + (mid[i] - 0.5) * 0.2 + (grain[i] - 0.5) * 0.08 - pores[i] * 0.25 - seam * 0.18;
      h[i] = grain[i] * 0.5 + mid[i] * 0.3 - pores[i] * 0.4 - seam * 0.5;
      rough[i] = 0.88 + grain[i] * 0.08;
      return [v, v, v * 0.98];
    });
    return { albedo, normal: normalFromHeight(h, N, N / 50), rough: roughBytes(N, rough) };
  },

  /** Boardwalk / deck planks along x with grain, gaps and nail heads. One tile = 4 m (8 planks). */
  wood(N, rnd) {
    const rows = 8;
    const warp = fbm(N, rnd, 3, 3);
    const grain = fbm(N, rnd, 24, 2, 0.5);
    const tone = []; const shift = [];
    for (let i = 0; i < rows; i++) { tone.push(0.72 + rnd() * 0.28); shift.push(rnd()); }
    const h = new Float32Array(N * N);
    const rough = new Float32Array(N * N);
    const albedo = pack(N, (x, y, i) => {
      const row = Math.floor((y / N) * rows);
      const v = (y / N) * rows - row;
      const gap = Math.min(v, 1 - v) * (N / rows) < 1.6 ? 1 : 0;
      const ring = Math.sin(((y / N) * rows * 14 + warp[i] * 9 + shift[row] * 30) * 1) * 0.5 + 0.5;
      const fiber = grain[(i * 7) % (N * N)];
      const base = tone[row] * (0.9 + ring * 0.1 + (fiber - 0.5) * 0.12);
      const end = Math.abs(((x / N) * 2 + shift[row]) % 1 - 0.5) > 0.494 ? 1 : 0;
      const nail = (Math.abs(((x / N) * 2 + shift[row]) % 1 - 0.04) < 0.004 || Math.abs(((x / N) * 2 + shift[row]) % 1 - 0.96) < 0.004) && Math.abs(v - 0.5) < 0.12 ? 1 : 0;
      h[i] = (1 - gap) * 0.6 + ring * 0.2 - end * 0.4 - nail * 0.1;
      rough[i] = gap ? 0.95 : 0.55 + ring * 0.2;
      const f = gap || end ? 0.35 : 1;
      return [0.8 * base * f, 0.6 * base * f, 0.4 * base * f - nail * 0.15];
    });
    return { albedo, normal: normalFromHeight(h, N, N / 70), rough: roughBytes(N, rough) };
  },

  /** Corrugated steel (roller shutters, fences): vertical ribs, scratches, rust at the foot. One tile = 1 m x 1 m. */
  metal(N, rnd) {
    const mid = fbm(N, rnd, 6, 4);
    const h = new Float32Array(N * N);
    const rough = new Float32Array(N * N);
    const albedo = pack(N, (x, y, i) => {
      const rib = Math.sin((x / N) * 6.283 * 12);
      const scratch = rnd() < 0.002 ? 1 : 0;
      const rust = Math.max(0, mid[i] - 0.55) * 2 * (1 - y / N) ** 1.5;
      h[i] = rib * 0.5 + (mid[i] - 0.5) * 0.1;
      rough[i] = 0.38 + (1 - Math.abs(rib)) * 0.1 + mid[i] * 0.2 + rust * 0.4 + scratch * 0.3;
      const v = 0.62 + rib * 0.04 + (mid[i] - 0.5) * 0.12 + scratch * 0.15;
      return [v * (1 + rust * 0.5), v * (1 - rust * 0.15), v * (1 - rust * 0.5)];
    });
    return { albedo, normal: normalFromHeight(h, N, N / 48), rough: roughBytes(N, rough) };
  },

  /** Woven canvas for awnings and washing: a fine over/under weave. One tile = 0.5 m. */
  fabric(N, rnd) {
    const noise = fbm(N, rnd, 8, 3);
    const threads = N / 16;
    const h = new Float32Array(N * N);
    const rough = new Float32Array(N * N);
    const albedo = pack(N, (x, y, i) => {
      const a = Math.sin((x / N) * 6.283 * threads);
      const b = Math.sin((y / N) * 6.283 * threads);
      const w = (a * 0.5 + 0.5) * ((Math.floor((y / N) * threads * 2) % 2) ? 1 : 0.35) + (b * 0.5 + 0.5) * ((Math.floor((x / N) * threads * 2) % 2) ? 1 : 0.35);
      h[i] = w * 0.5;
      rough[i] = 0.82 + noise[i] * 0.1;
      const v = 0.9 + w * 0.05 - 0.04 + (noise[i] - 0.5) * 0.06;
      return [v, v, v];
    });
    return { albedo, normal: normalFromHeight(h, N, N / 14), rough: roughBytes(N, rough) };
  },

  /** Beach sand: soft ripples and grains. One tile = 6 m. */
  sand(N, rnd) {
    const warp = fbm(N, rnd, 4, 3);
    const grain = fbm(N, rnd, Math.max(32, N / 2), 2, 0.7);
    const h = new Float32Array(N * N);
    const rough = new Float32Array(N * N);
    const albedo = pack(N, (x, y, i) => {
      const rip = Math.sin(((x / N) * 3 + (y / N) * 5 + warp[i] * 3) * 6.283) * 0.5 + 0.5;
      h[i] = rip * 0.55 + grain[i] * 0.45;
      rough[i] = 0.95;
      const v = 0.93 + rip * 0.04 + (grain[i] - 0.5) * 0.1;
      return [v, v * 0.93, v * 0.78];
    });
    return { albedo, normal: normalFromHeight(h, N, N / 60), rough: roughBytes(N, rough) };
  },

  /** Lawn: clumps and blades. One tile = 6 m. */
  lawn(N, rnd) {
    const clump = fbm(N, rnd, 7, 3);
    const blade = fbm(N, rnd, Math.max(32, N / 2), 2, 0.8);
    const h = new Float32Array(N * N);
    const rough = new Float32Array(N * N);
    const albedo = pack(N, (x, y, i) => {
      const v = 0.78 + (clump[i] - 0.5) * 0.3 + (blade[i] - 0.5) * 0.22;
      h[i] = blade[i] * 0.7 + clump[i] * 0.3;
      rough[i] = 0.85 + blade[i] * 0.1;
      return [v * 0.9, v, v * 0.75];
    });
    return { albedo, normal: normalFromHeight(h, N, N / 36), rough: roughBytes(N, rough) };
  },


  /** Palm bark: ring scars across the trunk and fibres along it. Wraps once around the trunk (u) and one ring-spacing high (v). */
  bark(N, rnd) {
    const fib = fbm(N, rnd, 32, 3, 0.55);
    const mid = fbm(N, rnd, 6, 3);
    const h = new Float32Array(N * N);
    const rough = new Float32Array(N * N);
    const albedo = pack(N, (x, y, i) => {
      const ring = Math.abs(((y / N) * 2) % 1 - 0.5) * 2; // 0 in the middle of a scar band, 1 between them
      const scar = 1 - Math.min(1, ring * 5);
      const fibre = Math.abs(Math.sin((x / N) * 6.283 * 14 + mid[i] * 5)) * 0.5 + fib[i] * 0.5;
      h[i] = fibre * 0.5 - scar * 0.6 + mid[i] * 0.2;
      rough[i] = 0.9;
      const v = 0.55 + (fib[i] - 0.5) * 0.25 + (mid[i] - 0.5) * 0.15 - scar * 0.18;
      return [v * 0.95, v * 0.78, v * 0.6];
    });
    return { albedo, normal: normalFromHeight(h, N, N / 24), rough: roughBytes(N, rough) };
  },

  /** Mission roof tiles in terracotta, laid in rows. One tile = 2 m. */
  roofTile(N, rnd) {
    const noise = fbm(N, rnd, 8, 3);
    const cols = 8;
    const rows = 10;
    const tv = [];
    for (let i = 0; i < cols * rows; i++) tv.push(0.75 + rnd() * 0.25);
    const h = new Float32Array(N * N);
    const rough = new Float32Array(N * N);
    const albedo = pack(N, (x, y, i) => {
      const cx = (x / N) * cols;
      const ry = (y / N) * rows;
      const col = Math.floor(cx);
      const row = Math.floor(ry);
      const u = cx - col;
      const v = ry - row;
      const dome = Math.sin(u * 3.14159);
      const shade = 0.6 + 0.4 * (v * 0.7 + dome * 0.3);
      h[i] = dome * 0.8 + v * 0.4;
      rough[i] = 0.7 + noise[i] * 0.2;
      const t = tv[(row % rows) * cols + col] * shade * (0.9 + noise[i] * 0.2);
      return [0.78 * t, 0.36 * t, 0.24 * t];
    });
    return { albedo, normal: normalFromHeight(h, N, N / 90), rough: roughBytes(N, rough) };
  },
};

export const MATERIAL_NAMES = Object.keys(GENERATORS);

/** One material's three maps as RGBA byte arrays, N x N, deterministic from the name + seed. */
export function generateMaterial(name, N = 256, seed = 1) {
  const g = GENERATORS[name];
  if (!g) throw new Error(`unknown material ${name}`);
  let s = seed * 9973;
  for (let i = 0; i < name.length; i++) s = (s * 31 + name.charCodeAt(i)) >>> 0;
  return g(N, mulberry32(s));
}

/** Mean of a channel (0..255) over an RGBA byte array (for tests). */
export function channelMean(bytes, ch = 0) {
  let t = 0;
  for (let i = ch; i < bytes.length; i += 4) t += bytes[i];
  return t / (bytes.length / 4);
}
void clamp01;

/** Fills a thick line segment (in pixels) into an RGBA byte array with a colour. */
function line(px, N, x0, y0, x1, y1, w, c) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5) + 1;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const ww = typeof w === 'function' ? w(t) : w;
    const R = Math.ceil(ww);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      if (Math.hypot(dx, dy) > ww) continue;
      const xx = Math.round(x) + dx;
      const yy = Math.round(y) + dy;
      if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
      const i = (yy * N + xx) * 4;
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
    }
  }
}

/**
 * Alpha cut-out cards (RGBA bytes, N x N): 'frond' = a palm leaf with a rib and drooping leaflets, the rib running up the middle (v along the leaf);
 * 'leaves' = a cluster of leaves on short stems (for the edge of a tree crown). The albedo has alpha; the normal map is flat up.
 */
export function generateCard(name, N = 256, seed = 1) {
  const rnd = mulberry32(seed * 7919 + name.length);
  const px = new Uint8ClampedArray(N * N * 4);
  if (name === 'frond') {
    const cx = N / 2;
    // leaflets: from the rib outwards and down towards the tip, longest in the middle of the leaf
    for (let y = 6; y < N - 6; y += 3) {
      const t = y / N;
      const len = N * 0.47 * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)) ** 0.7;
      for (const side of [-1, 1]) {
        const v = 0.45 + rnd() * 0.3;
        const col = [30 + 60 * v, 95 + 90 * v, 30 + 30 * v];
        const droop = 8 + len * 0.28;
        line(px, N, cx, y, cx + side * len, y + droop, (u) => 1.3 * (1 - u * 0.7), col);
      }
    }
    line(px, N, cx, 0, cx, N, 2.4, [105, 125, 55]);
  } else {
    for (let k = 0; k < 17; k++) {
      const a = rnd() * 6.283;
      const r = N * (0.12 + rnd() * 0.3);
      const x = N / 2 + Math.cos(a) * r;
      const y = N / 2 + Math.sin(a) * r;
      const rot = a + (rnd() - 0.5) * 1.1;
      const len = N * (0.1 + rnd() * 0.07);
      const v = 0.35 + rnd() * 0.65;
      const col = [28 + 70 * v, 92 + 100 * v, 28 + 34 * v];
      for (let t = 0; t < 1; t += 0.5 / len) {
        const w = Math.sin(t * Math.PI) * len * 0.34;
        const px0 = x + Math.cos(rot) * len * t;
        const py0 = y + Math.sin(rot) * len * t;
        line(px, N, px0 - Math.sin(rot) * w, py0 + Math.cos(rot) * w, px0 + Math.sin(rot) * w, py0 - Math.cos(rot) * w, 0.8, [col[0] * (0.85 + 0.3 * t), col[1] * (0.85 + 0.3 * t), col[2]]);
      }
      line(px, N, x, y, x + Math.cos(rot) * len, y + Math.sin(rot) * len, 0.7, [col[0] + 40, col[1] + 40, col[2] + 20]);
    }
  }
  const rough = new Uint8ClampedArray(N * N * 4);
  const normal = new Uint8ClampedArray(N * N * 4);
  for (let i = 0; i < N * N; i++) { rough[i * 4 + 1] = 190; rough[i * 4 + 3] = 255; normal[i * 4] = 128; normal[i * 4 + 1] = 128; normal[i * 4 + 2] = 255; normal[i * 4 + 3] = 255; }
  return { albedo: px, normal, rough };
}
