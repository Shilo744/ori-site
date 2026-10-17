// "Ori, Can You...?" — the body of a character as smooth distance-field parts with skin weights: torso in a tee (+ sleeves + collar), arms,
// 3-finger-and-thumb hands, jeans (or shorts / a skirt), sneakers, the rope chain. Every part is meshed with surface nets (sdf.js), coloured
// with baked occlusion and weighted to the shared skeleton (rig.js). PURE: returns typed arrays grouped by material. Model space: y up, +z forward.
import { smin, smax, sdEllipsoid, sdCapsule, sdRoundBox, meshSDF, aoAt } from '../sdf.js';
import { MeshBuilder, sweepTube } from './geo.js';
import { chainWeights, blendWeights, rigid } from './rig.js';
import { linear } from './head.js';

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export const BODY_DEFAULTS = { build: 1, belly: 0, shoulders: 1, hands: 1.18, arms: 1.1 };
/** The body is modelled at 1.7 m and then shrunk by this much under a head that keeps its size (a cartoon's big head). */
export const BODY_SCALE = 0.86;
export const OUTFIT_DEFAULTS = { top: 'tee', sleeve: 1, bottom: 'jeans', shoes: 'sneakers', topColor: '#16171b', bottomColor: '#2c3140', shoeColor: '#f3f3f1', soleColor: '#d8d8d4', accent: '#4a90e2', skin: '#c98f6b' };

/** Meshes a field into a skinned mesh part. `colorFn(x,y,z,ao) -> rgb`, `weights(x,y,z) -> [b, w, ...]`. */
function part(field, { min, max, cell, colorFn, weights, reach = 0.03, aoMin = 0.45, smooth = 1 }) {
  const mesh = meshSDF(field, {
    min, max, cell, smooth,
    color: (x, y, z, nx, ny, nz) => { const ao = aoMin + (1 - aoMin) * aoAt(field, x, y, z, nx, ny, nz, reach); return colorFn(x, y, z, ao, [nx, ny, nz]); },
  });
  const n = mesh.vertexCount;
  mesh.skinIndex = new Uint16Array(n * 4);
  mesh.skinWeight = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const w = weights(mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]);
    let sum = 0;
    for (let k = 0; k < 4 && k * 2 < w.length; k++) { mesh.skinIndex[i * 4 + k] = w[k * 2]; mesh.skinWeight[i * 4 + k] = w[k * 2 + 1]; sum += w[k * 2 + 1]; }
    if (sum > 0) for (let k = 0; k < 4; k++) mesh.skinWeight[i * 4 + k] /= sum;
  }
  return mesh;
}

/** The z of the front of a field at (x, y): used to lay the chain on the chest. */
function frontZ(field, x, y, z0 = 0.3, z1 = -0.05) {
  let a = z0; let b = z1;
  for (let i = 0; i < 18; i++) { const m = (a + b) / 2; if (field(x, y, m) > 0) a = m; else b = m; }
  return (a + b) / 2;
}

/**
 * @param {object} rig makeRig() result
 * @param {object} spec { body, outfit, skin }
 * @returns {{ skin: object[], tee: object[], jeans: object[], shoes: object[], metal: object[] }} lists of meshes per material
 */
export function buildBody(rig, spec = {}, { quality = 1, crowd = false } = {}) {
  const bd = { ...BODY_DEFAULTS, ...(spec.body || {}) };
  const of = { ...OUTFIT_DEFAULTS, ...(spec.outfit || {}) };
  const id = rig.ids;
  const skinC = linear(of.skin || spec.face?.skin || '#c98f6b');
  const skinDark = mix3(skinC, [0, 0, 0], 0.3);
  const teeC = linear(of.topColor);
  const jeansC = linear(of.bottomColor);
  const shoeC = linear(of.shoeColor);
  const soleC = linear(of.soleColor);
  const accentC = linear(of.accent);
  const cellT = crowd ? 0.034 : 0.0085 / quality;
  const cellL = crowd ? 0.026 : 0.0065 / quality;
  const out = { skin: [], tee: [], jeans: [], shoes: [], metal: [], parts: [] };
  const bw = bd.build;
  const sh = bd.shoulders;
  const belly = bd.belly;

  // ── torso in a tee ──
  const torso = (x, y, z) => {
    const ax = Math.abs(x);
    let d = sdEllipsoid(ax, y, z, 0, 0.935, 0, 0.172 * bw, 0.125, 0.118 * bw);
    d = smin(d, sdEllipsoid(ax, y, z, 0, 1.03, 0.004 + belly * 0.012, 0.15 * bw, 0.13, 0.108 * bw + belly * 0.026), 0.08);
    d = smin(d, sdEllipsoid(ax, y, z, 0, 1.2, 0.008, 0.172 * bw * sh, 0.14, 0.116 * bw), 0.08);
    d = smin(d, sdCapsule(ax, y, z, 0, 1.3, -0.004, 0.172 * sh, 1.295, -0.004, 0.062), 0.06);
    d = smin(d, sdEllipsoid(ax, y, z, 0, 1.335, -0.03, 0.095, 0.05, 0.07), 0.05);
    d = smax(d, 0.9 - y, 0.016); // the hem
    if (of.top !== 'none') d = smax(d, -sdEllipsoid(ax, y, z, 0, 1.372, -0.03, 0.058, 0.07, 0.058), 0.012); // the neck hole
    return d;
  };
  const torsoW = (x, y, z) => {
    if (y < 0.93) return [id.hips, 1];
    if (y < 1.07) { const w = sstep(0.93, 1.07, y); return [id.hips, 1 - w, id.spine, w]; }
    if (y < 1.2) { const w = sstep(1.07, 1.2, y); return [id.spine, 1 - w, id.chest, w]; }
    return [id.chest, 1];
  };
  if (of.top !== 'none') {
    out.tee.push(part(torso, {
      min: [-0.27, 0.88, -0.17], max: [0.27, 1.42, 0.18], cell: cellT, weights: torsoW, reach: 0.04,
      colorFn: (x, y, z, ao, n) => { const k = 0.88 + 0.12 * Math.sin(y * 70 + x * 9) * (n[2] > 0.4 ? 1 : 0.3); return [teeC[0] * ao * k, teeC[1] * ao * k, teeC[2] * ao * k]; },
    }));
  } else {
    out.skin.push(part(torso, { min: [-0.27, 0.82, -0.17], max: [0.27, 1.42, 0.18], cell: cellT, weights: torsoW, colorFn: (x, y, z, ao) => [skinC[0] * ao, skinC[1] * ao, skinC[2] * ao] }));
  }

  // ── arms: sleeve, skin, hand (per side) ──
  for (const [S, k] of [['L', 1], ['R', -1]]) {
    const A0 = [k * 0.205, 1.285, 0]; const A1 = [k * 0.262, 1.025, 0]; const A2 = [k * 0.305, 0.795, 0];
    const armW = chainWeights([A0, A1, A2], [id['upperArm' + S], id['lowerArm' + S]], 0.045);
    const armWHand = (x, y, z) => (y < 0.83 ? [id['lowerArm' + S], 1 - sstep(0.83, 0.79, y), id['hand' + S], sstep(0.83, 0.79, y)] : armW(x, y, z));
    const toChest = (x, y) => sstep(1.3, 1.34, y) * (Math.abs(x) < 0.23 ? 1 : 0);
    const armSkin = (x, y, z) => {
      const m = k * x;
      let d = sdCapsule(m, y, z, 0.205, 1.285, 0, 0.262, 1.025, 0, 0.0465 * bd.arms, 0.041 * bd.arms);
      d = smin(d, sdCapsule(m, y, z, 0.262, 1.025, 0, 0.305, 0.8, 0, 0.041 * bd.arms, 0.0345 * bd.arms), 0.03);
      return d;
    };
    out.skin.push(part(armSkin, { min: [-0.36, 0.76, -0.07], max: [0.36, 1.34, 0.07], cell: cellL, weights: blendWeights(armWHand, (x, y, z) => [id['upperArm' + S], 0.6, id['chest'], 0.4], toChest), colorFn: (x, y, z, ao) => [skinC[0] * ao, skinC[1] * ao, skinC[2] * ao] }));
    // the sleeve (tee material)
    const sleeveLen = of.sleeve === 0 ? 0 : of.sleeve === 2 ? 1 : 0.35;
    if (of.top !== 'none' && sleeveLen > 0) {
      const endT = sleeveLen;
      const e1 = [0.205 + (0.305 - 0.205) * endT * 0.5, 1.285 - (1.285 - 0.8) * endT, 0];
      const sleeve = (x, y, z) => {
        const m = k * x;
        let d = sdCapsule(m, y, z, 0.205, 1.285, 0, e1[0], e1[1], 0, 0.068 * bd.arms, 0.062 * bd.arms);
        if (endT > 0.6) d = smin(d, sdCapsule(m, y, z, 0.262, 1.025, 0, 0.305, 0.84, 0, 0.056, 0.05), 0.03);
        return d;
      };
      out.tee.push(part(sleeve, {
        min: [-0.36, 0.78, -0.09], max: [0.36, 1.37, 0.09], cell: cellL, weights: blendWeights(armW, (x, y, z) => [id['upperArm' + S], 0.6, id['chest'], 0.4], toChest), reach: 0.03,
        colorFn: (x, y, z, ao) => [teeC[0] * ao, teeC[1] * ao, teeC[2] * ao],
      }));
    }
    if (crowd) { // a mitten is enough for somebody across the street
      const mitten = (x, y, z) => sdEllipsoid(k * x, y, z, 0.305, 0.745, 0.012, 0.034, 0.075, 0.04);
      out.parts.push(part(mitten, { min: [-0.4, 0.64, -0.06], max: [0.4, 0.84, 0.07], cell: cellL, weights: rigid(id['hand' + S]), colorFn: (x, y, z, ao) => [skinC[0] * ao, skinC[1] * ao, skinC[2] * ao] }));
    } else out.parts.push(buildHand(rig, S, k, { skinC, skinDark, bd, quality }));
  }

  // ── legs: jeans (or shorts / a skirt) over skin, sneakers ──
  const longLegs = of.bottom === 'jeans';
  const cutY = of.bottom === 'jeans' ? 0.095 : of.bottom === 'shorts' ? 0.6 : 0.5;
  const legPts = (k) => [[k * 0.098, 0.87, 0], [k * 0.104, 0.485, 0.005], [k * 0.105, 0.095, -0.005]];
  const legW = (S, k) => {
    const chain = chainWeights(legPts(k), [id['upLeg' + S], id['lowLeg' + S]], 0.055);
    return (x, y, z) => {
      const w = chain(x, y, z);
      const m = sstep(0.8, 0.9, y); // up at the hip the leg gives way to the pelvis
      if (m <= 0) return w;
      const out = [id.hips, m];
      for (let i = 0; i < w.length; i += 2) out.push(w[i], w[i + 1] * (1 - m));
      return out;
    };
  };
  const jeans = (x, y, z) => {
    const ax = Math.abs(x);
    let d = sdEllipsoid(ax, y, z, 0, 0.93, 0, 0.162 * bw, 0.12, 0.108 * bw);
    const thigh = sdCapsule(ax, y, z, 0.098 * bw, 0.87, 0, 0.104 * bw, 0.485, 0.005, 0.094 * bw, 0.077 * bw);
    const shin = sdCapsule(ax, y, z, 0.104 * bw, 0.485, 0.005, 0.105 * bw, 0.13, -0.005, 0.077 * bw, 0.069 * bw);
    d = smin(d, thigh, 0.06);
    d = smin(d, shin, 0.04);
    d = smin(d, sdCapsule(ax, y, z, 0.105 * bw, 0.17, -0.005, 0.105 * bw, 0.1, -0.005, 0.071 * bw, 0.079 * bw), 0.03); // the cuff
    if (of.bottom === 'skirt') d = smin(d, sdEllipsoid(ax, y, z, 0, 0.62, 0, 0.27 * bw, 0.3, 0.2 * bw), 0.08);
    d = smax(d, cutY - y, 0.012);
    return d;
  };
  out.jeans.push(part(jeans, {
    min: [-0.3, cutY - 0.01, -0.22], max: [0.3, 0.98, 0.22], cell: cellT * 0.9, reach: 0.04,
    weights: (x, y, z) => { const S = x >= 0 ? 'L' : 'R'; const k = x >= 0 ? 1 : -1; return legW(S, k)(x, y, z); },
    colorFn: (x, y, z, ao, n) => { const k = 0.9 + 0.1 * Math.sin(y * 55 + z * 20) * (Math.abs(n[0]) > 0.3 ? 1 : 0.4); return [jeansC[0] * ao * k, jeansC[1] * ao * k, jeansC[2] * ao * k]; },
  }));
  if (!longLegs) { // bare legs below shorts / skirt
    for (const [S, k] of [['L', 1], ['R', -1]]) {
      const lp = legPts(k);
      const legSkin = (x, y, z) => { const m = k * x; let d = sdCapsule(m, y, z, 0.104, 0.55, 0.004, 0.105, 0.13, -0.004, 0.066 * bw, 0.052 * bw); d = smax(d, y - 0.65, 0.01); return d; };
      out.skin.push(part(legSkin, { min: [-0.2, 0.08, -0.1], max: [0.2, 0.68, 0.1], cell: cellL, weights: legW(S, k), colorFn: (x, y, z, ao) => [skinC[0] * ao, skinC[1] * ao, skinC[2] * ao] }));
      void lp;
    }
  }
  for (const [S, k] of [['L', 1], ['R', -1]]) {
    const sf = 1.14;
    const shoe0 = (x, y, z) => {
      const m = k * x - 0.105;
      const yy = y - 0.095;
      let d = sdRoundBox(m, yy, z, 0, -0.065, 0.04, 0.05, 0.021, 0.132, 0.017);
      d = smin(d, sdEllipsoid(m, yy, z, 0, -0.03, 0.026, 0.052, 0.048, 0.118), 0.03);
      d = smin(d, sdEllipsoid(m, yy, z, 0, -0.04, 0.105, 0.047, 0.04, 0.07), 0.03);
      d = smin(d, sdCapsule(m, yy, z, 0, 0.0, -0.005, 0, 0.035, -0.005, 0.058), 0.02);
      return d;
    };
    const shoe = (x, y, z) => { const m = (k * x - 0.105) / sf; const yy = (y - 0.095) / sf; return shoe0(k * (0.105 + m), 0.095 + yy, z / sf) * sf; };
    out.shoes.push(part(shoe, {
      min: [-0.2, 0.0, -0.14], max: [0.2, 0.17, 0.2], cell: cellL * 0.85, weights: rigid(id['foot' + S]), reach: 0.025,
      colorFn: (x, y, z, ao, n) => {
        const sole = y < 0.052;
        const stripe = Math.abs(y - 0.105) < 0.007 && Math.abs(n[0]) > 0.5;
        const toe = z > 0.115 && y < 0.08;
        let c = sole ? soleC : stripe ? accentC : toe ? mix3(shoeC, soleC, 0.5) : shoeC;
        const shade = sole ? 0.95 : 1;
        return [c[0] * ao * shade, c[1] * ao * shade, c[2] * ao * shade];
      },
    }));
  }

  // ── collar + the rope chain ──
  if (of.top !== 'none' && !crowd) {
    const B = new MeshBuilder();
    const ring = [];
    const topY = (x, z) => { let lo = 1.2; let hi = 1.5; for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (torso(x, m, z) < 0) lo = m; else hi = m; } return (lo + hi) / 2; };
    for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; const x = Math.sin(a) * 0.066; const z = -0.03 + Math.cos(a) * 0.064; ring.push([x, topY(x, z) + 0.002, z]); }
    sweepTube(B, ring, () => [0.0115, 0.0105], { sides: 6, color: [teeC[0] * 1.35 + 0.004, teeC[1] * 1.35 + 0.004, teeC[2] * 1.4 + 0.005], closed: true, up: [0, 1, 0], bone: id.chest });
    out.tee.push(B.finish());
  }
  return out;
}

/** The rope chain: a silver U from the back of the neck to the chest, striped like a twisted rope. Returns a mesh weighted to the chest. */
export function buildChain(rig, hex = '#d5dae0') {
  const col = linear(hex);
  const B = new MeshBuilder();
  const torso = (x, y, z) => { // the chest front, for the z of the chain
    const ax = Math.abs(x);
    let d = sdEllipsoid(ax, y, z, 0, 1.2, 0.008, 0.172, 0.14, 0.116);
    d = smin(d, sdEllipsoid(ax, y, z, 0, 1.335, -0.03, 0.095, 0.05, 0.07), 0.05);
    d = smin(d, sdCapsule(ax, y, z, 0, 1.3, -0.004, 0.172, 1.295, -0.004, 0.062), 0.06);
    return d;
  };
  const pts = [];
  const N = 36;
  for (let i = 0; i < N; i++) {
    const u = (i / (N - 1)) * 2 - 1; // -1..1 round the neck
    const x = u * 0.085 * (1 + 0.5 * (1 - Math.abs(u)) * 0.0);
    const y = 1.345 - 0.115 * (1 - u * u) ** 1.0 + 0.012 * Math.abs(u);
    const zf = frontZ(torso, x, y);
    const zb = Math.min(zf, -0.02);
    pts.push([x * 1.15, y, Math.abs(u) > 0.9 ? Math.max(-0.05, zb) : zf + 0.0065]);
  }
  sweepTube(B, pts, () => 0.0052, { sides: 6, color: (t, ph) => { const s = 0.55 + 0.45 * Math.sin(t * 150 + ph * 1.0); return [col[0] * s, col[1] * s, col[2] * s]; }, up: [0, 0, 1], bone: rig.ids.chest });
  return B.finish();
}

// ── the hand: palm, three fingers, a thumb ──
function buildHand(rig, S, k, { skinC, skinDark, bd, quality }) {
  const id = rig.ids;
  const wx = 0.305;
  const wy = 0.795;
  const h = bd.hands;
  const local = (x, y, z) => [k * x - wx, y - wy, z]; // u outward, v up (negative down the fingers), w forward
  const palm = (u, v, w) => sdEllipsoid(u, v, w, 0.001, -0.05, 0.0, 0.021 * h, 0.05 * h, 0.031 * h);
  const fingerZ = [0.0205, 0.0, -0.0205];
  const fingers = (u, v, w) => {
    let d = 1;
    for (let i = 0; i < 3; i++) {
      const len = i === 1 ? 1.08 : 1.0;
      d = smin(d, sdCapsule(u, v, w, 0, -0.088, fingerZ[i] * h, 0, -0.132 * len, fingerZ[i] * h, 0.0125 * h, 0.0118 * h), 0.004);
      d = smin(d, sdCapsule(u, v, w, 0, -0.13 * len, fingerZ[i] * h, 0, -0.168 * len, fingerZ[i] * h, 0.0118 * h, 0.0098 * h), 0.004);
    }
    return d;
  };
  const thumb = (u, v, w) => {
    let d = sdCapsule(u, v, w, -0.004, -0.04, 0.03 * h, -0.004, -0.075, 0.052 * h, 0.0158 * h, 0.0148 * h);
    d = smin(d, sdCapsule(u, v, w, -0.004, -0.075, 0.052 * h, -0.004, -0.108, 0.062 * h, 0.0148 * h, 0.0128 * h), 0.004);
    return d;
  };
  const wrist = (u, v, w) => sdCapsule(u, v, w, 0, 0.02, 0, 0, -0.03, 0, 0.0345 * h, 0.03 * h);
  const hand = (x, y, z) => { const [u, v, w] = local(x, y, z); return smin(smin(smin(palm(u, v, w), fingers(u, v, w), 0.012), thumb(u, v, w), 0.012), wrist(u, v, w), 0.02); };
  const weights = (x, y, z) => {
    const [u, v, w] = local(x, y, z);
    const dT = thumb(u, v, w) - 0.002;
    const dF = Math.min(fingers(u, v, w), palm(u, v, w) + 0.012);
    if (dT < dF && v < -0.025) { // thumb: base at v = -0.04, tip joint at -0.075
      const m = sstep(-0.045, -0.075, v);
      const m2 = sstep(-0.07, -0.082, v);
      return [id['hand' + S], 1 - m, id['thumb' + S], m * (1 - m2), id['thumbTip' + S], m2];
    }
    if (v > -0.086) return [id['hand' + S], 1];
    if (v > -0.098) { const m = sstep(-0.086, -0.098, v); return [id['hand' + S], 1 - m, id['finger' + S], m]; }
    if (v > -0.128) return [id['finger' + S], 1];
    if (v > -0.14) { const m = sstep(-0.128, -0.14, v); return [id['finger' + S], 1 - m, id['fingerTip' + S], m]; }
    return [id['fingerTip' + S], 1];
  };
  return part(hand, {
    min: [k * wx - 0.075, wy - 0.2, -0.075], max: [k * wx + 0.075, wy + 0.06, 0.09], cell: 0.0042 / quality, weights, reach: 0.014, aoMin: 0.6,
    colorFn: (x, y, z, ao, n) => { const [u, v, w] = local(x, y, z); const tip = sstep(-0.15, -0.17, v) * 0.15; const c = mix3(skinC, [0.85, 0.5, 0.42], tip); return [c[0] * ao, c[1] * ao, c[2] * ao]; },
  });
}
