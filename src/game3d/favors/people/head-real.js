// "Ori, Can You...?" — a head built from MEASURED PROFILES (used by a person whose spec has face.sculpt.real: Shilo). The tables below were measured from a clean
// reference of his bare head (front and side silhouettes of the sheet in .duo/gpt, traced by scripts/_sil.mjs), so the outline in front and side view is the real one:
// at every height y a rounded cross-section (a superellipse) whose half-width, front and back come from three small tables. The nose, lips, chin, ears and neck are then
// blended on with smooth unions at the measured landmark positions, exactly as in head.js. PURE.
// Head frame: x right, y up, z forward; the origin sits where head.js puts it (a little ahead of the ear); eye line y = 0.022.
import { smin, smax, sdEllipsoid, sdCapsule, sdSphere } from '../sdf.js';

// ── the profile tables: [y, value], y ascending ──
export const PROFILES = {
  // (measured from the low-poly turnaround shilo-lowpoly-1.png: u = 0.0009 m per pixel, eye line y = 0.022, mouth y = -0.0779, nose tip y = -0.0388, chin bottom y = -0.1427)
  hw: [[-0.1427, 0.003], [-0.1395, 0.02], [-0.1319, 0.0405], [-0.1274, 0.0495], [-0.1184, 0.0608], [-0.1094, 0.0743], [-0.0779, 0.0878], [-0.0374, 0.0967], [0, 0.0995], [0.022, 0.1], [0.0886, 0.1], [0.1246, 0.097], [0.1365, 0.0827], [0.1452, 0.074], [0.154, 0.064], [0.1627, 0.05], [0.1714, 0.034], [0.1757, 0.0165], [0.178, 0]],
  zf: [[-0.1427, 0.1145], [-0.1319, 0.128], [-0.1184, 0.1277], [-0.0779, 0.13], [-0.0374, 0.133], [0, 0.1305], [0.022, 0.128], [0.0434, 0.134], [0.0886, 0.1285], [0.1156, 0.1187], [0.1336, 0.105], [0.15, 0.08], [0.165, 0.05], [0.178, 0]],
  zb: [[-0.1427, 0.06], [-0.1327, -0.03], [-0.1113, -0.085], [-0.0899, -0.1115], [-0.0792, -0.1107], [-0.0684, -0.1098], [-0.0577, -0.1098], [-0.0477, -0.1115], [-0.0363, -0.1142], [-0.0256, -0.1187], [-0.0149, -0.124], [-0.0042, -0.1294], [0.0065, -0.1347], [0.0172, -0.1392], [0.0279, -0.1419], [0.0386, -0.1446], [0.0493, -0.1454], [0.06, -0.1454], [0.0707, -0.1446], [0.0814, -0.1428], [0.0921, -0.1401], [0.1028, -0.1365], [0.1135, -0.1321], [0.1242, -0.1258], [0.1349, -0.1187], [0.1456, -0.1098], [0.1563, -0.0991], [0.167, -0.083], [0.1777, -0.0554], [0.178, -0.045]],
};

/** A monotone cubic (Fritsch-Carlson) through [x, y] points: returns { f(x), df(x) }. */
export function pchip(pts) {
  const n = pts.length;
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  const h = []; const d = [];
  for (let i = 0; i < n - 1; i++) { h.push(xs[i + 1] - xs[i]); d.push((ys[i + 1] - ys[i]) / h[i]); }
  const m = new Array(n);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else { const w1 = 2 * h[i] + h[i - 1]; const w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  const seg = (x) => { let i = 0; let hi = n - 2; while (i < hi) { const k = (i + hi + 1) >> 1; if (xs[k] <= x) i = k; else hi = k - 1; } return i; };
  return {
    f(x) { const i = seg(x); const t = (x - xs[i]) / h[i]; const t2 = t * t; const t3 = t2 * t; return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1]; },
    df(x) { const i = seg(x); const t = (x - xs[i]) / h[i]; const t2 = t * t; return ((6 * t2 - 6 * t) * ys[i] + (3 * t2 - 4 * t + 1) * h[i] * m[i] + (-6 * t2 + 6 * t) * ys[i + 1] + (3 * t2 - 2 * t) * h[i] * m[i + 1]) / h[i]; },
  };
}

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const sst = sstep;

/**
 * A smooth egg as the three tables (a toy / vinyl-figure head): e = { hw: widest half width, top, chin: the heights where it ends, wide: the height of its widest part,
 * zc, hd: the centre and half depth of the skull, round: 0.4..1 how boxy (small = squarer) }. Returns { hw, zf, zb }.
 */
export function eggProfile(e) {
  const N = 44;
  const hwT = []; const zfT = []; const zbT = [];
  const tw = (e.wide - e.chin) / (e.top - e.chin);
  const a = Math.log(0.5) / Math.log(tw);
  for (let i = 0; i <= N; i++) {
    const t = i / N; const y = e.chin + t * (e.top - e.chin);
    const s = Math.max(0, Math.sin(Math.PI * Math.min(1, t) ** a)) ** (e.round ?? 0.55);
    const fy = (e.chinPoint ?? 0) * Math.max(0, 1 - t * 4); // (a little chin that sticks out forwards)
    hwT.push([y, Math.max(0.003, e.hw * s)]); zfT.push([y, e.zc + Math.max(0.003, e.hd * s) + fy]); zbT.push([y, e.zc - Math.max(0.003, e.hd * s)]);
  }
  return { hw: hwT, zf: zfT, zb: zbT };
}

/** The loft: a conservative estimate of the signed distance to the skull-and-face solid. */
function makeLoft(f, prof) {
  const smooth = (tab, passes) => { let v = tab.map((p) => p[1]); for (let k = 0; k < passes; k++) { const w = v.slice(); for (let i = 2; i < v.length - 2; i++) w[i] = (v[i - 1] + 2 * v[i] + v[i + 1]) / 4; v = w; } return tab.map((p, i) => [p[0], v[i]]); }; // (the measured tables are noisy at the pixel level: a soft average keeps the shape and drops the terraces)
  const hw = pchip(smooth(prof.hw, 6)); const zf = pchip(smooth(prof.zf, 8)); const zb = pchip(smooth(prof.zb, 6));
  const Y0 = prof.hw[0][0]; const Y1 = prof.hw[prof.hw.length - 1][0];
  const W = f.width; const J = f.jaw; const C = f.cheek; const CH = f.chinW;
  const widthAt = (y) => W * (1 + (J - 1) * sstep(-0.02, -0.1, y) + (C - 1) * 0.35 * (sstep(-0.08, -0.03, y) - sstep(0.02, 0.07, y)) + (CH - 1) * sstep(-0.12, -0.14, y));
  return (x, y, z) => {
    const yc = Math.max(Y0 + 1e-4, Math.min(Y1 - 1e-4, y));
    const H = Math.max(1e-4, hw.f(yc) * widthAt(yc));
    const F = zf.f(yc); const B = zb.f(yc);
    const zc = (F + B) / 2; const hd = Math.max(1e-4, (F - B) / 2);
    const p = 2.1 + 0.95 * Math.exp(-(((yc + 0.01) / 0.065) ** 2)) + 0.3 * sstep(-0.09, -0.12, yc); // (flatter across the face at eye level than over the skull)
    const u = Math.abs(x) / H; const v = Math.abs(z - zc) / hd;
    const q = (u ** p + v ** p) ** (1 / p);
    let d = (q - 1) * Math.min(H, hd) * (q > 1 ? 0.9 : 1);
    if (q > 1) d = Math.max(d, 0.85 * Math.hypot(Math.max(Math.abs(x) - H, 0), Math.max(Math.abs(z - zc) - hd, 0))); // (far away the section is tiny near the caps, so measure to its box instead)
    if (y > Y1) d = Math.hypot(Math.max(d, 0), y - Y1); // (beyond the ends: the true distance to the closing cap, not just the height)
    else if (y < Y0) d = Math.hypot(Math.max(d, 0), Y0 - y);
    return d;
  };
}

/** The almond of the eye as an approximate signed distance: negative inside the opening. dx = outward from the eye centre, dy = up. */
export function makeLens(FZ) {
  return (dx, dy) => {
    const t = dx / FZ.half;
    const tu = (t + 0.2) / (t < -0.2 ? 0.8 : 1.2); const hu = tu * tu >= 1 ? 0 : FZ.up * (1 - tu * tu) ** 0.85;
    const tl = (t - 0.15) / (t < 0.15 ? 1.15 : 0.85); const hl = tl * tl >= 1 ? 0 : FZ.lo * (1 - tl * tl) ** 0.9;
    const yy = dy - FZ.tilt * Math.max(-1, Math.min(1, t));
    return Math.max(yy - hu, -hl - yy);
  };
}

/** The heights of the almond margins at t = dx / half (upper and lower, relative to the corner line). */
export function lensMargins(FZ) {
  return (t) => {
    const tu = (t + 0.2) / (t < -0.2 ? 0.8 : 1.2); const hu = tu * tu >= 1 ? 0 : FZ.up * (1 - tu * tu) ** 0.85;
    const tl = (t - 0.15) / (t < 0.15 ? 1.15 : 0.85); const hl = tl * tl >= 1 ? 0 : FZ.lo * (1 - tl * tl) ** 0.9;
    return { hu, hl, yc: FZ.tilt * Math.max(-1, Math.min(1, t)) };
  };
}

/** The distance field of the whole head (negative inside); `f` = a faceSpec(); with `carve` the eye sockets, nostrils and ear bowls are cut. */
export function headFieldReal(f, { carve = true } = {}) {
  const S = f.sculpt || {};
  const egg = S.egg ? eggProfile(S.egg) : null;
  const prof = egg || { hw: (S.profile && S.profile.hw) || PROFILES.hw, zf: (S.profile && S.profile.zf) || PROFILES.zf, zb: (S.profile && S.profile.zb) || PROFILES.zb };
  const loft = makeLoft(f, prof);
  const dz = S.egg ? (S.egg.zc + S.egg.hd * Math.max(0, Math.sin(Math.PI * Math.min(1, ((-0.04 - S.egg.chin) / (S.egg.top - S.egg.chin))) ** (Math.log(0.5) / Math.log((S.egg.wide - S.egg.chin) / (S.egg.top - S.egg.chin))))) ** (S.egg.round ?? 0.55)) - 0.133 : 0; // (the nose and the lips stand on the front of the skull, wherever it is)
  const nose = f.nose;
  const lips = f.lips;
  const eyeX = 0.045 * f.eyeSep;
  const eyeY = 0.022 + f.eyeY;
  // the eye: an almond opening in the skin (a fissure: upper and lower margins meeting at the corners) with the eyeball's cavity behind it, so the lids are the skin itself
  const FZ = S.fissure || { half: 0.0285, up: 0.0185, lo: 0.0175, tilt: 0.002 };
  const eyeR = 0.0215 * f.eyeSize;
  let eyeZ = null;
  const lens = makeLens(FZ);
  return (px, y, z) => {
    const x = Math.abs(px);
    let d = loft(x, y, z);
    if (!S.egg) d = smax(d, ((-0.084 - 0.5 * Math.min(Math.max(z + 0.03, 0), 0.145)) - y) / 1.118, 0.014); // the jaw line: under it the face is cut away from the angle below the ear to the chin, and the neck is set back
    // the nose, measured: root (0, 0.0235, 0.1346), a straight dorsum to a rounded tip at z 0.1686, wings 0.053 apart
    const dzn = dz + (S.noseOut || 0); // (the nose stands out from the face this much more)
    const tipC = 0.1501 + dzn + 0.012 * (nose.len - 1);
    d = smin(d, sdCapsule(x, y, z, 0, 0.0235, (0.139 + dz), 0, -0.0388, tipC, 0.0125 * nose.width, 0.0172 * nose.width), 0.018);
    d = smin(d, sdSphere(x, y, z, 0, -0.0388, tipC, 0.0172 * nose.tip), 0.012);
    d = smin(d, sdSphere(x, y, z, 0.0143 * nose.width, -0.0445, 0.1385 + dzn, 0.0125 * nose.width), 0.012); // the wings of the nostrils
    d = smin(d, sdEllipsoid(x, y, z, 0.01 * nose.width, -0.048, 0.135 + dzn, 0.0165, 0.0085, 0.0145), 0.012); // the underside, the columella
    // lips (the mouth rig sits on top of these pads), centred on the measured mouth line y = -0.0777
    d = smin(d, sdEllipsoid(x, y, z, 0, -0.0705, 0.131 + dz, 0.034 * lips.width, 0.0075 * lips.upper, 0.0085), 0.009);
    d = smin(d, sdEllipsoid(x, y, z, 0, -0.0855, 0.1295 + dz, 0.031 * lips.width, 0.0092 * lips.lower, 0.0095), 0.009);
    // ears, measured: 0.087 tall, 0.057 deep, outer edge 0.129 out, 0.05 behind the origin
    d = smin(d, sdEllipsoid(x, y, z, 0.113 * f.earOut, 0.0041, -0.05, 0.0165 * f.ear, 0.0435 * f.ear, 0.0285 * f.ear), 0.012);
    // the neck, measured: 0.082 half-width, as deep as it is wide
    const nk = S.neck || 1;
    d = smin(d, sdCapsule(x, y, z, 0, -0.09, -0.04, 0, -0.28, -0.046, 0.07 * nk, 0.078 * nk), 0.035);
    if (carve) {
      if (!S.noFissure) {
      if (eyeZ === null) { const base = headFieldReal(f, { carve: false }); let z0 = 0.26; let z1 = -0.02; for (let i = 0; i < 18; i++) { const zm = (z0 + z1) / 2; if (base(eyeX, eyeY, zm) > 0) z0 = zm; else z1 = zm; } eyeZ = (z0 + z1) / 2 - eyeR * 1.05; }
      const dx = x - eyeX; const dy = y - eyeY;
      const opening = Math.max(lens(dx, dy) * 0.8, eyeZ - 0.004 - z); // the almond, cut forward from just in front of the eyeball's middle
      d = smax(d, -opening, 0.0035); // the eye (a pit under the almond; the eyeball sits in it)
      }
      d = smax(d, -sdEllipsoid(x, y, z, 0.1285 * f.earOut, 0.0, -0.045, 0.008, 0.017, 0.009), 0.006); // the ear bowls
      d = smax(d, -sdEllipsoid(x, y, z, 0, -0.056, 0.137 + dz, 0.0055, 0.0105, 0.0075), 0.008); // the philtrum
      d = smax(d, -sdEllipsoid(x, y, z, 0, -0.0985, 0.131 + dz, 0.015, 0.0045, 0.0085), 0.006); // the groove under the lower lip
    }
    return d;
  };
}

/** Where the facial parts attach: same shape as head.js anchorsOf(). `surface(x, y)` = the z of the (uncarved) skin at x, y. */
export function anchorsReal(f) {
  const base = headFieldReal(f, { carve: false });
  const surface = (x, y) => {
    let z0 = 0.26;
    let z1 = -0.02;
    for (let i = 0; i < 18; i++) { const zm = (z0 + z1) / 2; if (base(x, y, zm) > 0) z0 = zm; else z1 = zm; }
    return (z0 + z1) / 2;
  };
  const eyeX = 0.045 * f.eyeSep;
  const eyeY = 0.022 + f.eyeY;
  const r = 0.0215 * f.eyeSize;
  const sz = surface(eyeX, eyeY);
  const S = f.sculpt || {};
  return {
    surface,
    base,
    eye: { x: eyeX, y: eyeY, z: sz - (S.eyeDepth ?? (r * 1.05)), r, surfaceZ: sz },
    brow: { x: eyeX, y: eyeY + 0.026, z: surface(eyeX, eyeY + 0.026) },
    mouth: { y: -0.0777, w: 0.03 * f.lips.width, z: surface(0, -0.0777) },
    nose: { tipY: -0.0388, tipZ: 0.1673 },
    ear: { x: 0.1185 * f.earOut, y: 0.0041, z: -0.05 },
    chin: { y: -0.1427, z: 0.12 },
    top: 0.178,
  };
}

/**
 * How much beard grows at a point of the head (0..1, head frame): the cheeks below a line from the sideburn to the corner of the mouth, the sides of the mouth, a
 * moustache over the upper lip (the lips themselves stay clean), the chin and under the lower lip, and the neck under the jaw, thinning out downwards.
 */
export function beardDensity(x, y, z) {
  const ax = Math.abs(x);
  if (z < -0.04 && y > -0.06) return 0; // (nothing behind the ear)
  const edge = -0.012 - 0.04 * sst(0.1, 0.04, ax);
  const cheek = sst(0.0, -0.026, y - edge) * sst(0.11, 0.094, ax) * (0.62 + 0.38 * sst(-0.03, -0.1, y));
  const lipZone = sst(0.045, 0.034, ax) * sst(-0.058, -0.0615, y) * sst(-0.0945, -0.0905, y); // (the lips)
  const mous = sst(0.05, 0.036, ax) * sst(-0.04, -0.047, y) * sst(-0.063, -0.059, y);
  const mouthSide = sst(0.036, 0.042, ax) * sst(0.07, 0.058, ax) * sst(-0.056, -0.063, y) * sst(-0.1, -0.092, y);
  const chin = sst(-0.091, -0.097, y) * sst(0.075, 0.05, ax) * sst(-0.02, 0.04, z);
  const neck = sst(-0.14, -0.165, y) * sst(-0.2, -0.178, y) * sst(0.07, 0.045, ax) * sst(-0.02, 0.04, z) * 0.45;
  let m = Math.max(cheek, mous, mouthSide, chin, neck * 0.85);
  m *= 1 - lipZone;
  return Math.max(0, Math.min(1, m));
}

/** The colour of the skin by position for a real head (linear RGB). `H` = { lin, hexNum } from head.js. */
export function skinColorReal(f, H) {
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const base = H.lin(H.hexNum(f.skin));
  const flush = mix(base, H.lin(0xd9786a), 0.7);
  const warm = mix(base, H.lin(0xcc6a58), 0.5);
  const violet = mix(base, H.lin(0x6a4868), 0.55);
  const lipsC = H.lin(H.hexNum(f.lipColor));
  const beardT = H.lin(H.hexNum(f.beardTone || '#6e4a38'));
  const eyeX = 0.045 * f.eyeSep;
  const ex = 0.1185 * f.earOut;
  const FZ = (f.sculpt && f.sculpt.fissure) || { half: 0.0235, up: 0.0075, lo: 0.0105, tilt: 0.0025 };
  const lensF = makeLens(FZ);
  return (x, y, z) => {
    const ax = Math.abs(x);
    let c = base;
    const cheek = Math.max(0, 1 - Math.hypot((ax - 0.062) / 0.05, (y + 0.03) / 0.04, (z - 0.09) / 0.05));
    c = mix(c, flush, Math.min(1, f.blush * 1.6 * cheek * cheek * (3 - 2 * cheek)));
    const tip = Math.max(0, 1 - Math.hypot(x / 0.03, (y + 0.0346) / 0.026, (z - 0.15) / 0.03));
    c = mix(c, warm, 0.34 * tip);
    const alae = Math.max(0, 1 - Math.hypot((ax - 0.022) / 0.016, (y + 0.043) / 0.014, (z - 0.128) / 0.02));
    c = mix(c, warm, 0.25 * alae);
    const under = Math.max(0, 1 - Math.hypot((ax - eyeX) / 0.034, (y + 0.0) / 0.014, (z - 0.115) / 0.04));
    c = mix(c, violet, 0.32 * under * under * (3 - 2 * under));
    const lip = sst(0.0, 0.008, 0.0125 - Math.abs(y + 0.0777)) * sst(0.04, 0.02, ax) * sst(0.115, 0.125, z);
    c = mix(c, lipsC, lip * 0.5);
    c = mix(c, warm, 0.5 * sst(0.014, 0.004, Math.hypot(ax - ex, (y - 0.004) * 0.7, (z + 0.05) * 0.9) - 0.026) * sst(0.1, 0.112, ax)); // the ears
    if (!(f.sculpt && f.sculpt.noNostrils)) c = mix(c, [0.02, 0.008, 0.006], 0.85 * sst(0.0085, 0.004, Math.hypot(ax - 0.0125, (y + 0.0455) * 1.5, (z - 0.138) * 0.8))); // the nostrils
    if (!(f.sculpt && f.sculpt.noFissure)) { // the lids: a dark lash line along the upper margin, a pink rim below, a crease above, shadow under the eye
      const dx = ax - eyeX; const dy = y - 0.022 - f.eyeY; const ld = lensF(dx, dy) * 0.8;
      const t = dx / FZ.half; const upper = dy - FZ.tilt * Math.max(-1, Math.min(1, t)) > 0;
      if (ld > -0.002 && ld < 0.05 && Math.abs(dx) < FZ.half * 1.4) {
        const ring = sst(0.0058, 0.0, ld);
        if (upper) { c = mix(c, [0.05, 0.03, 0.026], 0.95 * ring ** 0.9); const cr = Math.exp(-(((ld - 0.0065) / 0.0028) ** 2)); c = [c[0] * (1 - 0.16 * cr), c[1] * (1 - 0.2 * cr), c[2] * (1 - 0.18 * cr)]; }
        else { c = mix(c, [0.6, 0.27, 0.25], 0.55 * ring); const bag = Math.exp(-(((ld - 0.008) / 0.0045) ** 2)); c = mix(c, violet, 0.3 * bag); }
      }
    }
    if (f.stubble > 0) c = mix(c, beardT, Math.min(0.85, f.stubble * 0.95 * beardDensity(x, y, z)));
    const n = 0.025 * Math.sin(x * 61 + 1.3) * Math.sin(y * 77 + z * 53) + 0.015 * Math.sin(x * 143 + y * 97 - z * 71);
    return [c[0] * (1 + n), c[1] * (1 + n * 0.9), c[2] * (1 + n * 0.8)];
  };
}
