// "Ori, Can You...?" — a stylised head SCULPTED from smoothly blended ellipsoids (Pixar / Mii proportions, about 1.5x life size): cranium, jaw
// and chin, cheeks, brow ridge, nose with bridge / tip / wings / nostrils, lip pads, ears, a neck stub. It is a signed distance field turned
// into a smooth mesh (sdf.js), so it can be tuned with a handful of numbers (`face` in a person spec) — a wider jaw, a bigger nose — and the
// same code makes Ori and every passer-by. The eyes, brows, mouth, hair and glasses are separate parts (face.js, hair.js).
// Head frame: x right, y up, z forward; origin = the centre of the skull; one unit = one metre.
import { smin, smax, sdEllipsoid, sdCapsule, sdSphere, meshSDF, aoAt } from '../sdf.js';

/** Default proportions (a friendly average); a person spec overrides any of them. */
export const FACE_DEFAULTS = {
  width: 1, height: 1, jaw: 1, chinW: 1, chinLen: 1, cheek: 1, brow: 1, // overall shape
  nose: { len: 1, width: 1, tip: 1, bridge: 1 },
  lips: { upper: 1, lower: 1.1, width: 1 },
  eyeSep: 1, eyeSize: 1, eyeY: 0, ear: 1, earOut: 1,
  skin: '#c98f6b', blush: 0.35, lipColor: '#b8665a', stubble: 0, // colours
};

export function faceSpec(spec = {}) {
  return { ...FACE_DEFAULTS, ...spec, nose: { ...FACE_DEFAULTS.nose, ...(spec.nose || {}) }, lips: { ...FACE_DEFAULTS.lips, ...(spec.lips || {}) } };
}

/** The distance field of the whole head (negative inside). `f` = a faceSpec(); with `carve` the eye sockets, nostrils and ear bowls are cut. */
export function headField(f, { carve = true } = {}) {
  const w = f.width;
  const h = f.height;
  const nose = f.nose;
  const eyeX = 0.045 * f.eyeSep;
  const eyeY = 0.022 + f.eyeY;
  return (px, y, z) => {
    const x = Math.abs(px);
    // the skull and the face under it: a rounded egg, broad at the cheeks
    let d = sdEllipsoid(x, y, z, 0, 0.03, -0.012, 0.12 * w, 0.118 * h, 0.124);
    d = smin(d, sdEllipsoid(x, y, z, 0, -0.058 * h, 0.018, 0.114 * w * f.jaw, 0.088 * h, 0.106), 0.05);
    d = smin(d, sdEllipsoid(x, y, z, 0, -0.128 * h * f.chinLen, 0.07, 0.052 * f.chinW, 0.034, 0.042), 0.045); // the chin
    d = smin(d, sdEllipsoid(x, y, z, 0.07 * w, -0.03, 0.064, 0.046 * f.cheek, 0.042 * f.cheek, 0.044 * f.cheek), 0.055); // cheeks
    d = smin(d, sdCapsule(x, y, z, 0, 0.058, 0.112, 0.07, 0.062, 0.094, 0.0155 * f.brow), 0.03); // brow ridge
    // the nose: bridge, tip, wings
    d = smin(d, sdCapsule(x, y, z, 0, 0.034, 0.106, 0, -0.03, 0.134 + 0.008 * nose.bridge, 0.0125 * nose.width, 0.0205 * nose.width), 0.018);
    d = smin(d, sdSphere(x, y, z, 0, -0.04, 0.143 + 0.012 * (nose.len - 1), 0.021 * nose.tip), 0.014);
    d = smin(d, sdSphere(x, y, z, 0.021 * nose.width, -0.045, 0.126 + 0.01 * (nose.len - 1), 0.0148 * nose.width), 0.012);
    // lip pads (the mouth itself is a separate rig that sits on top)
    d = smin(d, sdEllipsoid(x, y, z, 0, -0.082, 0.108, 0.03 * f.lips.width, 0.0085 * f.lips.upper, 0.011), 0.01);
    d = smin(d, sdEllipsoid(x, y, z, 0, -0.1, 0.105, 0.028 * f.lips.width, 0.0105 * f.lips.lower, 0.0125), 0.01);
    // ears
    d = smin(d, sdEllipsoid(x, y, z, 0.114 * w * f.earOut, -0.004, -0.004, 0.0115 * f.ear, 0.033 * f.ear, 0.0225 * f.ear), 0.012);
    // a neck stub (the body brings the rest)
    d = smin(d, sdCapsule(x, y, z, 0, -0.1 * h, -0.034, 0, -0.26, -0.03, 0.05), 0.04);
    if (carve) {
      d = smax(d, -sdEllipsoid(x, y, z, eyeX, eyeY, 0.1, 0.0275 * f.eyeSize, 0.0215 * f.eyeSize, 0.021), 0.012); // the eye sockets
      d = smax(d, -sdEllipsoid(x, y, z, 0.1215 * w * f.earOut, 0, 0.002, 0.008, 0.017, 0.009), 0.006); // the ear bowls
      d = smax(d, -sdEllipsoid(x, y, z, 0, -0.066, 0.124, 0.006, 0.011, 0.008), 0.008); // the philtrum
    }
    return d;
  };
}

/** Where the facial parts attach (head frame). Read by face.js / hair.js. `surface(x, y)` = the z of the (uncarved) skin at x, y. */
export function anchorsOf(f) {
  const base = headField(f, { carve: false });
  const surface = (x, y) => {
    let z0 = 0.26;
    let z1 = -0.02;
    for (let i = 0; i < 18; i++) { const zm = (z0 + z1) / 2; if (base(x, y, zm) > 0) z0 = zm; else z1 = zm; }
    return (z0 + z1) / 2;
  };
  const eyeX = 0.045 * f.eyeSep;
  const eyeY = 0.022 + f.eyeY;
  return {
    surface,
    base,
    eye: { x: eyeX, y: eyeY, z: surface(eyeX, eyeY) - 0.0165, r: 0.0215 * f.eyeSize, surfaceZ: surface(eyeX, eyeY) },
    brow: { x: eyeX, y: eyeY + 0.04, z: surface(eyeX, eyeY + 0.04) },
    mouth: { y: -0.091, w: 0.03 * f.lips.width, z: surface(0, -0.091) },
    nose: { tipY: -0.04, tipZ: 0.143 + 0.012 * (f.nose.len - 1) + 0.021 * f.nose.tip },
    ear: { x: 0.114 * f.width * f.earOut, y: -0.004, z: -0.004 },
    chin: { y: -0.128 * f.height * f.chinLen - 0.032, z: 0.07 },
    top: 0.03 + 0.122 * f.height,
  };
}

const lin = (hex) => { const c = [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]; return c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); };
export const hexNum = (s) => (typeof s === 'number' ? s : parseInt(String(s).replace('#', ''), 16));
export const linear = (s) => lin(hexNum(s));
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth01 = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Skin colour by position: base tone, a flush on the cheeks and nose, redder lips and ears, shadowed sockets, a hint of stubble. (Linear RGB.) */
export function skinColor(f) {
  const base = lin(hexNum(f.skin));
  const flush = mix3(base, lin(0xd9786a), 0.7);
  const lips = lin(hexNum(f.lipColor));
  const dark = mix3(base, [0, 0, 0], 0.4);
  const warm = mix3(base, lin(0xcc6a58), 0.45);
  const shade = mix3(base, lin(0x3a2a24), 0.55);
  return (x, y, z) => {
    const ax = Math.abs(x);
    let c = base;
    c = mix3(c, flush, f.blush * smooth01(0.055, 0.0, Math.hypot(ax - 0.068, y + 0.03, (z - 0.085) * 0.6) - 0.02)); // cheeks
    c = mix3(c, warm, 0.5 * smooth01(0.03, 0.0, Math.hypot(x, y + 0.045, z - 0.16))); // nose tip
    c = mix3(c, lips, smooth01(0.0, 0.012, 0.016 - Math.abs(y + 0.091)) * smooth01(0.045, 0.02, ax) * smooth01(0.085, 0.1, z));
    c = mix3(c, warm, 0.55 * smooth01(0.012, 0.004, Math.hypot(ax - 0.12, y, z) - 0.03) * smooth01(0.1, 0.11, ax)); // ears
    c = mix3(c, dark, 0.3 * smooth01(0.036, 0.02, Math.hypot(ax - 0.045, y - 0.012, z - 0.1))); // under the eyes
    c = mix3(c, [0.02, 0.008, 0.006], 0.85 * smooth01(0.0085, 0.004, Math.hypot(ax - 0.0125, (y + 0.058) * 1.5, (z - 0.158) * 0.8))); // nostrils
    if (f.stubble > 0) { // a shadow of beard along the jaw, the chin and over the lip
      const jaw = smooth01(0.0, 0.02, -y - 0.045 + (z < 0.06 ? 0 : 0)) * smooth01(0.08, 0.04, Math.max(0, 0.05 - z) + 0) * (z > -0.02 ? 1 : 0);
      c = mix3(c, shade, f.stubble * 0.5 * jaw * smooth01(0.1, 0.07, ax));
    }
    return c;
  };
}

/** The head mesh (typed arrays). `spec` overrides FACE_DEFAULTS; `cell` is the voxel size in metres (0.004 = fine, 0.007 = coarse). */
export function buildHead(spec = {}, { cell = 0.0055, ao = true } = {}) {
  const f = faceSpec(spec);
  const field = headField(f);
  const color = skinColor(f);
  const m = meshSDF(field, {
    min: [-0.17, -0.31, -0.16], max: [0.17, 0.2, 0.185], cell, smooth: 1,
    color: (x, y, z, nx, ny, nz) => { const c = color(x, y, z); const o = ao ? 0.62 + 0.38 * aoAt(field, x, y, z, nx, ny, nz, 0.03) : 1; return [c[0] * o, c[1] * o, c[2] * o]; },
  });
  return { mesh: m, anchors: anchorsOf(f), face: f };
}
