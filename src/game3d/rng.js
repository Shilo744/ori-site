// Tiny deterministic helpers shared by the pure NEON DRIFT modules (no DOM, no three, no Math.random).

/** mulberry32: a 32-bit seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rnd() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mixes a seed with an attempt number into a new, well-spread 32-bit seed. */
export function subSeed(seed, n) {
  let h = (seed >>> 0) ^ Math.imul(n + 1, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

const _f64 = new Float64Array(1);
const _u32 = new Uint32Array(_f64.buffer);

/** FNV-1a over the exact bit patterns of numbers: a cheap state fingerprint for determinism tests. */
export function hashNumbers(list, h = 0x811c9dc5) {
  for (let i = 0; i < list.length; i++) {
    _f64[0] = list[i];
    for (let k = 0; k < 2; k++) {
      h ^= _u32[k];
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h >>> 0;
}

export const wrapIdx = (i, n) => ((i % n) + n) % n;
/** Wraps an angle into [−π, π). */
export const wrapPi = (a) => {
  a = (a + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
};
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
