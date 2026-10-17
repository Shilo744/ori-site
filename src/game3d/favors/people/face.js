// "Ori, Can You...?" — the facial parts that sit on the sculpted head (head.js): eyes (sclera + iris + pupil), eyelids, thick brows, moustache and
// goatee, the glasses, and the mouth, a ribbon that is rebuilt for every expression. All PURE: they fill MeshBuilders (geo.js) in the head frame
// and take `ids` (bone indices) so person.js can skin them; the preview script passes zeros. Colours are linear RGB.
import { sweepTube, surfacePatch, roundedRect, extrudeRing, fillOutline, uvSphere, sphereCap } from './geo.js';
import { linear } from './head.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scale3 = (c, s) => [c[0] * s, c[1] * s, c[2] * s];
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** A fast bilinear lookup of the skin's z over a window of the face (the mouth moves every frame). */
export function surfaceLUT(S, x0, x1, y0, y1, step = 0.002) {
  const nx = Math.ceil((x1 - x0) / step) + 1;
  const ny = Math.ceil((y1 - y0) / step) + 1;
  const z = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) z[j * nx + i] = S(x0 + i * step, y0 + j * step);
  return (x, y) => {
    const fx = Math.max(0, Math.min(nx - 1.001, (x - x0) / step));
    const fy = Math.max(0, Math.min(ny - 1.001, (y - y0) / step));
    const i = Math.floor(fx); const j = Math.floor(fy); const tx = fx - i; const ty = fy - j;
    const a = z[j * nx + i]; const b = z[j * nx + i + 1]; const c = z[(j + 1) * nx + i]; const d = z[(j + 1) * nx + i + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
}

// ── eyes ──
/** The painted eyeball: pupil, iris with a lighter ring and radial streaks, a dark limbal ring, a warm white that dims towards the back. */
export function eyeballColor(irisHex = '#4a2c1a') {
  const iris = linear(irisHex);
  const light = mix(iris, [0.55, 0.36, 0.18], 0.55);
  const sclera = linear('#f4efe8');
  const rim = linear('#cdb7ae');
  return (dx, dy, dz, th, ph) => {
    if (th < 0.25) return [0.006, 0.004, 0.004];
    if (th < 0.6) {
      const t = (th - 0.25) / 0.35;
      const streak = 0.5 + 0.5 * Math.sin(ph * 17 + th * 5);
      let c = mix(light, iris, sstep(0.0, 0.85, t) * 0.8 + 0.1 * streak);
      c = mix(c, [0.004, 0.003, 0.003], sstep(0.82, 1, t) * 0.9); // limbal ring
      c = mix(c, [0.003, 0.002, 0.002], sstep(0.35, 0.0, t) * 0.5); // dark rim round the pupil
      return c;
    }
    return mix(sclera, rim, sstep(0.9, 1.5, th));
  };
}

export function buildEyes(B, A, f, ids, irisHex) {
  const col = eyeballColor(irisHex);
  for (const [sx, bone] of [[1, ids.eyeL], [-1, ids.eyeR]]) {
    uvSphere(B, sx * A.eye.x, A.eye.y, A.eye.z, A.eye.r, col, { nu: 56, nv: 40, bone });
  }
}

/** The small bright reflections that stay put while the eye turns (separate, unlit): one big, one small per eye. */
export function buildEyeShine(B, A, ids) {
  const white = [1, 1, 1];
  for (const [sx, bone] of [[1, ids.head], [-1, ids.head]]) {
    const zf = A.eye.z + Math.sqrt(Math.max(0, A.eye.r * A.eye.r - 0.0075 ** 2 - 0.0085 ** 2)) + 0.0004;
    uvSphere(B, sx * A.eye.x + 0.0075, A.eye.y + 0.0085, zf, 0.0031, () => white, { nu: 10, nv: 8, bone, squash: [1, 1, 0.35] });
    uvSphere(B, sx * A.eye.x - 0.0075, A.eye.y - 0.0075, zf - 0.0005, 0.0016, () => white, { nu: 8, nv: 6, bone, squash: [1, 1, 0.35] });
  }
}

/**
 * Eyelids: spherical caps just outside the eyeball, rotating about the x axis through the eye's centre (bone pivots there). The upper cap's edge
 * sits ~20 degrees above the middle of the eye when relaxed; the lower cap's ~28 degrees below. `skin` = (x, y, z) -> colour.
 */
export function buildLids(B, A, f, ids, skin) {
  const r = A.eye.r * 1.085;
  for (const [sx, up, lo] of [[1, ids.lidUpL, ids.lidLoL], [-1, ids.lidUpR, ids.lidLoR]]) {
    const c = [sx * A.eye.x, A.eye.y, A.eye.z];
    const base = skin(c[0], c[1], c[2] + 0.02);
    const rim = scale3(base, 0.78);
    const crease = scale3(base, 0.9);
    sphereCap(B, c, r, [0, 1, 0], 1.2, (t) => (t > 0.93 ? rim : mix(crease, base, sstep(0.0, 0.5, t))), { rings: 10, around: 24, bone: up });
    sphereCap(B, c, r * 1.004, [0, -1, 0], 1.08, (t) => (t > 0.93 ? rim : base), { rings: 8, around: 24, bone: lo });
  }
}

// ── brows, moustache, goatee ──
/** Thick dark brows: a tapered tube per side on the brow ridge, weighted between an inner and an outer bone so they can arch and tilt. */
export function buildBrows(B, A, f, ids, hairHex = '#1a1210', style = {}) {
  const dark = linear(hairHex);
  const lift = style.lift ?? -0.002;
  const thick = style.thick ?? 1;
  for (const [sx, bIn, bOut] of [[1, ids.browInL, ids.browOutL], [-1, ids.browInR, ids.browOutR]]) {
    const pts = [];
    const N = 9;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1); // 0 = inner end, 1 = outer end
      const x = A.eye.x * 0.5 + u * (A.eye.x * 1.5 + 0.004);
      const y = A.brow.y + 0.005 - 0.006 * u + 0.0075 * Math.sin(u * Math.PI) + lift + 0.002 * (1 - u);
      pts.push([sx * x, y, A.surface(x, y) + 0.0035 * thick]);
    }
    sweepTube(B, pts, (t) => { const env = Math.sin(Math.min(1, t * 0.97 + 0.03) * Math.PI) ** 0.45; return [(0.0098 * (1 - 0.3 * t)) * env * thick + 0.001, 0.0062 * env * thick + 0.001]; }, {
      sides: 8, color: (t, ph) => scale3(dark, 0.85 + 0.35 * Math.max(0, Math.cos(ph))), up: [0, 0.35, 1],
      bones: (t) => [bIn, 1 - t, bOut, t],
    });
  }
}

/** Short dark moustache along the upper lip, a soul patch under the lower lip and a chin goatee that fades into the skin. `skin` = (x, y, z) -> colour. */
export function buildFacialHair(B, A, f, ids, spec = {}, hairHex = '#1a1210', skin = () => [0.5, 0.3, 0.2]) {
  const dark = linear(hairHex);
  const bone = ids.head;
  const my = A.mouth.y;
  if (spec.moustache !== false) {
    const pts = [];
    const N = 13;
    for (let i = 0; i < N; i++) {
      const u = (i / (N - 1)) * 2 - 1; // -1..1
      const x = u * 0.0385;
      const y = my + 0.0108 + 0.0042 * u * u - 0.0025 * Math.abs(u) ** 1.5;
      pts.push([x, y, A.surface(x, y) + 0.0028]);
    }
    sweepTube(B, pts, (t) => { const e = Math.sin(t * Math.PI) ** 0.6; return [0.0045 * e + 0.0014, 0.0036 * e + 0.0012]; }, { sides: 7, color: (t, ph) => scale3(dark, 0.9 + 0.3 * Math.max(0, Math.cos(ph))), up: [0, 0.25, 1], bone });
  }
  if (spec.goatee !== false) {
    const gy = my - 0.05;
    const H = 0.0042;
    surfacePatch(B, {
      x0: -0.05, x1: 0.05, y0: gy - 0.035, y1: gy + 0.034, step: 0.0016, bone,
      surface: (x, y) => A.surface(x, y),
      thick: (x, y) => {
        // the goatee: a crescent on the chin that runs up into a soul patch under the lip
        const chin = 1 - Math.hypot(x / 0.021, (y - gy + 0.004) / 0.03);
        const soul = 1 - Math.hypot(x / 0.0085, (y - (my - 0.0275)) / 0.0105);
        const v = Math.max(chin * 1.1, soul * 1.3);
        return v > 0 ? Math.min(1, v * 1.6) * H : 0;
      },
      color: (x, y, t) => { const k = Math.min(1, t / H); const grain = 0.85 + 0.5 * (Math.sin(x * 1900 + y * 1300) * Math.sin(y * 1700 - x * 900) * 0.5 + 0.5); return mix(skin(x, y, A.surface(x, y)), scale3(dark, 1.5 * grain), sstep(0.15, 0.75, k)); },
    });
  }
}

// ── glasses ──
/** Black rectangular frames (rounded-rect rings with real thickness), two lenses, a bridge and temples that run back over the ears. */
export function buildGlasses(Bframe, Blens, A, f, ids, spec = {}) {
  const frameCol = linear(spec.frame || '#0d0e11');
  const lensCol = [0.55, 0.65, 0.7];
  const lw = spec.w ?? 0.083;
  const lh = spec.h ?? 0.054;
  const fw = spec.frameW ?? 0.0085;
  const dz = 0.0125;
  const outer = roundedRect(lw + fw * 2, lh + fw * 2, spec.r ?? 0.011, 6);
  const inner = roundedRect(lw, lh, Math.max(0.002, (spec.r ?? 0.011) - fw * 0.5), 6);
  const lensZ = (cx) => A.surface(cx, A.eye.y) + dz;
  const bone = ids.head;
  const yaw = 0.14;
  for (const sx of [1, -1]) {
    const cx = sx * (A.eye.x + 0.0035);
    const cy = A.eye.y + 0.002;
    const cz = lensZ(cx);
    const ca = Math.cos(yaw * sx);
    const sa = Math.sin(yaw * sx);
    const place = (x, y, z) => [cx + x * ca + z * sa, cy + y, cz - x * sa + z * ca]; // the lens plane turned a little round the head
    extrudeRing(Bframe, outer, inner, 0.0062, frameCol, { bone, place });
    fillOutline(Blens, inner, 0, 1, lensCol, { bone, place });
    fillOutline(Blens, inner, -0.0004, -1, lensCol, { bone, place });
    // the temple: from the top outer corner back along the side of the head, then a little hook down behind the ear
    const sideX = (y, z) => { let a = 0.26; let b = 0.04; for (let i = 0; i < 16; i++) { const m = (a + b) / 2; if (A.base(m, y, z) > 0) a = m; else b = m; } return (a + b) / 2; };
    const arm = [place(sx * (lw / 2 + fw * 0.4), lh * 0.32, 0)];
    const ey = arm[0][1];
    for (const z of [0.05, 0.02, -0.01, -0.035, -0.05]) arm.push([sx * (sideX(ey, z) + 0.0055), ey - (z < -0.04 ? 0.014 : z < -0.02 ? 0.004 : 0), z]);
    sweepTube(Bframe, arm, () => [0.0032, 0.0034], { sides: 6, color: frameCol, up: [0, 1, 0], bone });
  }
  // the bridge
  sweepTube(Bframe, [[-0.0085, A.eye.y + 0.0105, lensZ(0) + 0.003], [0, A.eye.y + 0.0155, lensZ(0) + 0.0015], [0.0085, A.eye.y + 0.0105, lensZ(0) + 0.003]], () => [0.0042, 0.0033], { sides: 6, color: frameCol, up: [0, 0, 1], bone });
}

// ── hoop earring ──
export function buildHoop(B, A, f, ids, hex = '#d9dde3', side = 1) {
  const col = linear(hex);
  const R = 0.019;
  const cx = side * (A.ear.x + 0.004);
  const cy = A.ear.y - 0.034 * f.ear - R + 0.007; // the top of the ring passes through the lobe
  const pts = [];
  const N = 22;
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; pts.push([cx, cy + Math.cos(a) * R, A.ear.z - 0.003 + Math.sin(a) * R]); }
  sweepTube(B, pts, () => 0.0033, { sides: 6, color: col, closed: true, up: [1, 0, 0], bone: ids.head });
}

// ── the mouth ──
export const MOUTH_REST = { w: 1, smile: 0.2, open: 0, round: 0, asym: 0, teeth: 0, tongue: 0, press: 0 };

/**
 * One frame of the mouth: lips as two tubes that meet in the corners, a dark inside, upper teeth, a tongue. `m` = { w, smile, open, round, asym,
 * teeth, tongue }: width scale, corner lift (0..1.4), jaw opening (0..1), pucker (0..1), one corner higher (-1..1), how much of the teeth / tongue show.
 * `S(x, y)` = the skin's z (a surfaceLUT). The mesh lies ON the face, so opening shows a dark decal with teeth — no hole in the head.
 */
export function buildMouth(B, A, m, S, lipHex = '#b8665a', ids = {}) {
  const bone = ids.jaw ?? ids.head ?? 0;
  const lip = linear(lipHex);
  const lipDark = scale3(lip, 0.55);
  const lipLight = mix(lip, [0.9, 0.5, 0.45], 0.25);
  const my = A.mouth.y;
  const hw = (A.mouth.w * 1.05) * (1 + 0.28 * m.smile) * m.w * (1 - 0.5 * m.round);
  const lift = 0.0125 * m.smile;
  const open = m.open * 0.036;
  const N = 15;
  const curveY = (u) => { // the line the closed lips follow: corners raised by the smile (more on the asym side)
    const side = u > 0 ? 1 : -1;
    const corner = lift * (1 + 0.55 * m.asym * side);
    return my + corner * Math.abs(u) ** 1.7 - 0.0015 * (1 - u * u) * m.smile;
  };
  const up = [];
  const lo = [];
  for (let i = 0; i < N; i++) {
    const u = (i / (N - 1)) * 2 - 1;
    const x = u * hw;
    const bow = 0.0022 * Math.exp(-u * u * 18) * (1 - m.round); // the cupid's bow
    const yU = curveY(u) + 0.0035 * (1 - u * u) * (m.round * 0.8 + 0.2) + bow;
    const yL = curveY(u) - open * (1 - u * u) ** 0.7 - 0.002 * (1 - u * u) - m.round * 0.004 * (1 - u * u);
    up.push([x, yU]);
    lo.push([x, yL]);
  }
  const zl = (x, y, e) => S(x, y) + e;
  const lipR = (u, full) => (0.0058 * full) * (0.35 + 0.65 * Math.sqrt(Math.max(0, 1 - u * u))) + 0.0007;
  // inside, teeth, tongue
  const colsN = N;
  const faceN = (x, y) => { const e = 0.0015; const dx = (S(x + e, y) - S(x - e, y)) / (2 * e); const dy = (S(x, y + e) - S(x, y - e)) / (2 * e); const l = Math.hypot(dx, dy, 1); return [-dx / l, -dy / l, 1 / l]; };
  if (open > 0.0025) {
    const strip = (topF, botF, color, zoff) => {
      const rowsT = []; const rowsB = [];
      for (let i = 0; i < colsN; i++) {
        const u = (i / (colsN - 1)) * 2 - 1;
        const [x, yt] = topF(i, u); const [, yb] = botF(i, u);
        const n1 = faceN(x, yt); const n2 = faceN(x, yb);
        rowsT.push(B.vertex(x, yt, zl(x, yt, zoff), n1[0], n1[1], n1[2], typeof color === 'function' ? color(u, 0) : color, [bone, 1]));
        rowsB.push(B.vertex(x, yb, zl(x, yb, zoff), n2[0], n2[1], n2[2], typeof color === 'function' ? color(u, 1) : color, [bone, 1]));
      }
      for (let i = 0; i < colsN - 1; i++) B.quad(rowsT[i], rowsB[i], rowsB[i + 1], rowsT[i + 1]);
    };
    strip((i) => up[i], (i) => lo[i], (u, k) => (k ? [0.04, 0.006, 0.01] : [0.08, 0.012, 0.016]), 0.0016);
    if (m.tongue > 0.01) {
      const tl = (i, u) => [lo[i][0] * 0.78, lo[i][1] + (up[i][1] - lo[i][1]) * (0.18 + 0.32 * m.tongue) * (1 - u * u) ** 0.5];
      strip(tl, (i) => [lo[i][0] * 0.78, lo[i][1] + 0.0006], (u, k) => (k ? [0.5, 0.1, 0.1] : [0.74, 0.22, 0.2]), 0.0022);
    }
    if (m.teeth > 0.01) {
      const th = 0.0105 * m.teeth;
      strip((i) => [up[i][0] * 0.97, up[i][1] - 0.0012], (i, u) => [up[i][0] * 0.97, up[i][1] - 0.0012 - Math.min(th, (up[i][1] - lo[i][1]) * 0.85) * (1 - 0.35 * u * u)], (u, k) => (k ? [0.78, 0.74, 0.68] : [0.9, 0.88, 0.82]), 0.0026);
    }
  }
  // lips: upper then lower tube, tapering to a point at the corners
  const toPts = (arr, e) => arr.map(([x, y]) => [x, y, zl(x, y, e)]);
  sweepTube(B, toPts(up.map(([x, y], i) => [x, y + lipR((i / (N - 1)) * 2 - 1, 1) * 0.55]), 0.0026), (t) => { const u = t * 2 - 1; const r = lipR(u, 0.95); return [r * 1.15, r]; }, { sides: 7, color: (t, ph) => (Math.cos(ph) < -0.2 ? lipDark : mix(lip, lipLight, Math.max(0, Math.cos(ph)))), up: [0, 0.3, 1], bone });
  sweepTube(B, toPts(lo.map(([x, y], i) => [x, y - lipR((i / (N - 1)) * 2 - 1, 1.25) * 0.55]), 0.0026), (t) => { const u = t * 2 - 1; const r = lipR(u, 1.3); return [r * 1.1, r]; }, { sides: 7, color: (t, ph) => (Math.cos(ph) > 0.35 ? lipDark : mix(lip, lipLight, Math.max(0, -Math.cos(ph)) * 0.8)), up: [0, 0.3, 1], bone });
}
