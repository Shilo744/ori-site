// "Ori, Can You...?" — parked cars: three crisp shapes (a hatchback, a sedan, a delivery van), each an extruded SIDE PROFILE with a small bevel, so the silhouette
// is clean instead of a melted blob. Glass is a dark panel on the sides plus a windscreen and a rear window; the wheels sit in dark arches; lamps, grille, bumpers,
// plate and mirrors are small boxes. The paint takes the instance colour (white vertex colour); everything else keeps its own colour in the vertex colour.
import * as THREE from 'three';

const lin = (r, g, b) => [r, g, b].map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
const BEVEL = 0.05;

/** Side profiles, length along x (nose +x), y up. `lower` = the body from bumper to bumper, `cab` = the greenhouse (narrower, tumblehome), `wind`/`rear` = the cab's
 *  front and back slopes (windscreen and rear window go on them). Corners get rounded by a couple of Chaikin passes. */
const KINDS = {
  hatch: {
    hw: 0.8, cabHw: 0.66, wr: 0.36, wheels: [-1.25, 1.27], nose: 2.02, tail: -2.02, lampY: 0.62,
    lower: [[-2.0, 0.25], [-2.03, 0.72], [-1.85, 0.9], [1.15, 0.92], [1.75, 0.86], [2.02, 0.66], [2.02, 0.25]],
    cab: [[-1.95, 0.84], [-1.72, 1.4], [0.2, 1.43], [0.88, 0.86]],
    wind: [[0.88, 0.86], [0.2, 1.43]], rear: [[-1.95, 0.84], [-1.72, 1.4]], pillar: -0.5,
  },
  sedan: {
    hw: 0.82, cabHw: 0.66, wr: 0.37, wheels: [-1.45, 1.5], nose: 2.3, tail: -2.3, lampY: 0.64,
    lower: [[-2.3, 0.25], [-2.32, 0.7], [-2.05, 0.9], [1.2, 0.92], [1.95, 0.84], [2.3, 0.64], [2.3, 0.25]],
    cab: [[-1.4, 0.86], [-0.85, 1.4], [0.4, 1.42], [1.0, 0.86]],
    wind: [[1.0, 0.86], [0.4, 1.42]], rear: [[-1.4, 0.86], [-0.85, 1.4]], pillar: -0.25,
  },
  // Ori's own car: nothing like the neighbours' - a low, wide wedge in pearl white: a nose that dives, a glass bubble far back, flared haunches, big aero wheels with peach rims, one
  // thin light bar nose and tail, a floating rear wing and a pale under-glow. No grille, no badge but the peach.
  ori: {
    hw: 0.96, cabHw: 0.74, wr: 0.43, wheels: [-1.6, 1.62], nose: 2.55, tail: -2.55, lampY: 0.72, noseY: 0.44, glassCab: true, aero: true, wedge: true,
    lower: [[-2.55, 0.3], [-2.58, 0.82], [-2.3, 0.94], [-0.4, 0.88], [1.0, 0.7], [2.1, 0.52], [2.55, 0.42], [2.55, 0.3]],
    cab: [[-2.0, 0.84], [-1.35, 1.26], [-0.45, 1.32], [0.55, 0.98], [0.85, 0.74]],
    wind: [[0.85, 0.74], [-0.45, 1.32]], rear: [[-2.0, 0.84], [-1.35, 1.26]], pillar: null,
  },
  van: {
    hw: 0.85, cabHw: 0, wr: 0.4, wheels: [-1.45, 1.5], nose: 2.3, tail: -2.3, lampY: 0.9,
    lower: [[-2.3, 0.3], [-2.32, 1.78], [-2.1, 1.93], [0.8, 1.95], [1.4, 1.2], [2.0, 1.1], [2.3, 0.95], [2.3, 0.3]],
    cab: null,
    wind: [[1.4, 1.2], [0.8, 1.95]], rear: null, side: [[0.55, 1.28], [0.58, 1.82], [0.98, 1.82], [1.32, 1.28]],
  },
};

function mergeGeos(list) {
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const p = new Float32Array(n * 3); const nr = new Float32Array(n * 3); const c = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) { p.set(g.attributes.position.array, o * 3); nr.set(g.attributes.normal.array, o * 3); c.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(p, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nr, 3));
  out.setAttribute('color', new THREE.BufferAttribute(c, 3));
  out.computeBoundingSphere();
  return out;
}

const paint = (geo, color) => {
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set(color, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
};

/** Rounds a closed polygon's corners (Chaikin corner cutting). */
function round(pts, passes = 2) {
  let p = pts;
  for (let k = 0; k < passes; k++) {
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i]; const b = p[(i + 1) % p.length];
      out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    p = out;
  }
  return p;
}

/** A profile polygon pushed out into a slab `half` wide each side of the centre line (z), with a rounded edge. */
function slab(points, half, bevel = 0) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const depth = Math.max(0.001, half * 2 - bevel * 2);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return g.index ? g.toNonIndexed() : g;
}

/** A quad lying on the middle of a slope between two profile points (so it stays on the surface after the corners are rounded), flat across the width. */
function slope([a, b], halfW, push) {
  const p0 = [a[0] + (b[0] - a[0]) * 0.18, a[1] + (b[1] - a[1]) * 0.18];
  const p1 = [a[0] + (b[0] - a[0]) * 0.82, a[1] + (b[1] - a[1]) * 0.82];
  const dx = p1[0] - p0[0]; const dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy);
  let nx = dy / len; let ny = -dx / len;
  if (nx * (a[0] + b[0]) < 0 || (Math.abs(nx) < 1e-6 && ny < 0)) { nx = -nx; ny = -ny; } // outward: away from the middle of the car along x
  const o = [nx * push, ny * push];
  const P = [[p0[0] + o[0], p0[1] + o[1], -halfW], [p1[0] + o[0], p1[1] + o[1], -halfW], [p1[0] + o[0], p1[1] + o[1], halfW], [p0[0] + o[0], p0[1] + o[1], halfW]];
  const pos = new Float32Array(36); const nrm = new Float32Array(36); // both windings: the glass shows from whichever side the triangles end up facing
  [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2].forEach((k, i) => { pos.set(P[k], i * 3); nrm.set([nx, ny, 0], i * 3); });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return g;
}

/** Ori's peach: a little badge (a body with a dip at the top and a leaf), in the XY plane facing +z, about `size` m wide. */
function peachBadge(size) {
  const body = new THREE.Shape();
  body.moveTo(0, 0.3);
  body.bezierCurveTo(-0.15, 0.45, -0.55, 0.32, -0.55, -0.02);
  body.bezierCurveTo(-0.55, -0.4, -0.25, -0.62, 0, -0.62);
  body.bezierCurveTo(0.25, -0.62, 0.55, -0.4, 0.55, -0.02);
  body.bezierCurveTo(0.55, 0.32, 0.15, 0.45, 0, 0.3);
  const leaf = new THREE.Shape();
  leaf.moveTo(0.03, 0.33);
  leaf.quadraticCurveTo(0.0, 0.7, 0.36, 0.76);
  leaf.quadraticCurveTo(0.38, 0.4, 0.03, 0.33);
  const mk = (sh, c) => { const g = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false, curveSegments: 10 }).toNonIndexed(); g.scale(size, size, 1); g.translate(0, 0, -0.02); return paint(g, c); };
  return [mk(body, lin(0.04, 0.04, 0.05)), mk(leaf, lin(0.04, 0.04, 0.05))]; // black, like a chrome-black car badge
}

/** A parked car of the given kind ('hatch' | 'sedan' | 'van'). Returns { body, details }: the paint (tinted per car) and the glass, wheels, lights and trim. */
export function carGeometry({ kind = 'hatch' } = {}) {
  const K = KINDS[kind] || KINDS.hatch;
  const hw = K.hw;
  const white = lin(0.97, 0.97, 0.97);
  const glass = lin(0.07, 0.11, 0.17);
  const trim = lin(0.08, 0.08, 0.09);
  const tyre = lin(0.04, 0.04, 0.045);
  const rim = K.wedge ? lin(0.2, 0.21, 0.23) : lin(0.72, 0.74, 0.78); // (Ori's wheels are graphite)
  const bodyParts = [paint(slab(round(K.lower, 2), hw, 0.09), white)];
  const parts = [];
  const box = (x0, y0, z0, x1, y1, z1, c, into = parts) => {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)).toNonIndexed(); // (abs: the mirrored side passes its bounds the other way round)
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    into.push(paint(g, c));
  };
  if (K.cab) {
    // the greenhouse: a narrower rounded cab on the body; its glass is the same shape pulled in, with a body-coloured pillar between the doors
    const cab = round(K.cab, 2);
    if (K.glassCab) parts.push(paint(slab(cab, K.cabHw, 0.07), lin(0.05, 0.08, 0.12))); // the whole cabin is glass
    else bodyParts.push(paint(slab(cab, K.cabHw, 0.07), white));
    const cx = cab.reduce((t, p) => t + p[0], 0) / cab.length; const cy = cab.reduce((t, p) => t + p[1], 0) / cab.length;
    const win = cab.map(([x, y]) => [cx + (x - cx) * 0.9, 0.95 + (y - 0.95) * 0.86 + (cy - 0.95) * 0.0]);
    if (!K.glassCab) parts.push(paint(slab(win, K.cabHw + 0.012), glass));
    if (K.pillar != null) box(K.pillar - 0.035, 0.9, -(K.cabHw + 0.02), K.pillar + 0.035, 1.38, K.cabHw + 0.02, white, bodyParts);
    if (!K.glassCab) { parts.push(paint(slope(K.wind, K.cabHw - 0.1, 0.085), glass)); parts.push(paint(slope(K.rear, K.cabHw - 0.1, 0.085), glass)); }
  } else {
    parts.push(paint(slab(K.side, hw + 0.012), glass));
    parts.push(paint(slope(K.wind, hw - 0.12, 0.105), glass));
  }
  // wheels in dark arches
  for (const x of K.wheels) for (const s of [-1, 1]) {
    const arch = new THREE.CylinderGeometry(K.wr + 0.08, K.wr + 0.08, 0.03, 18).rotateX(Math.PI / 2).toNonIndexed();
    arch.translate(x, K.wr + 0.02, s * (hw + 0.004));
    parts.push(paint(arch, trim));
    const t = new THREE.CylinderGeometry(K.wr, K.wr, 0.3, 16).rotateX(Math.PI / 2).toNonIndexed();
    t.translate(x, K.wr, s * (hw - 0.04));
    parts.push(paint(t, tyre));
    const r = new THREE.CylinderGeometry(K.wr * (K.aero ? 0.82 : 0.62), K.wr * (K.aero ? 0.82 : 0.62), 0.05, K.aero ? 20 : 12).rotateX(Math.PI / 2).toNonIndexed();
    r.translate(x, K.wr, s * (hw + 0.1));
    parts.push(paint(r, rim));
  }
  // bumpers, grille, lamps, plate
  box(K.nose - 0.14, 0.27, -hw, K.nose + 0.05, 0.45, hw, trim);
  box(K.tail - 0.05, 0.27, -hw, K.tail + 0.14, 0.45, hw, trim);
  if (!K.aero) box(K.nose - 0.06, 0.5, -0.42, K.nose + 0.04, 0.64, 0.42, trim);
  if (!K.aero) for (const s of [-1, 1]) {
    box(K.nose - 0.08, K.lampY, s * 0.46, K.nose + 0.04, K.lampY + 0.13, s * 0.74, lin(1, 0.94, 0.72));
    box(K.tail - 0.04, K.lampY, s * 0.5, K.tail + 0.08, K.lampY + 0.14, s * 0.76, lin(0.85, 0.12, 0.12));
  }
  if (K.wedge) {
    for (const x of K.wheels) for (const sd of [-1, 1]) box(x - 0.62, 0.62, sd > 0 ? hw - 0.16 : -hw - 0.1, x + 0.62, 0.98, sd > 0 ? hw + 0.1 : -hw + 0.16, white, bodyParts); // the flared haunches over the wheels
    box(K.tail - 0.55, 1.12, -hw + 0.12, K.tail + 0.25, 1.17, hw - 0.12, trim); // the rear wing (it floats on two posts)
    for (const sd of [-1, 1]) box(K.tail - 0.25, 0.9, sd * (hw - 0.45) - 0.03, K.tail - 0.1, 1.12, sd * (hw - 0.45) + 0.03, trim);
    for (const sd of [-1, 1]) box(-1.9, 0.2, sd * (hw - 0.02) - 0.02, 1.9, 0.26, sd * (hw - 0.02) + 0.02, lin(0.45, 0.95, 1)); // under-glow strips
  }
  if (K.aero) { // one thin light bar across the nose and one across the tail instead of separate lamps and a plate
    box(K.nose - 0.05, K.noseY ?? K.lampY, -hw + 0.12, K.nose + 0.04, (K.noseY ?? K.lampY) + 0.045, hw - 0.12, lin(1, 0.97, 0.88));
    box(K.tail - 0.04, K.lampY + 0.02, -hw + 0.1, K.tail + 0.05, K.lampY + 0.065, hw - 0.1, lin(0.95, 0.1, 0.1));
  } else box(K.tail - 0.06, 0.5, -0.23, K.tail + 0.05, 0.62, 0.23, lin(0.95, 0.9, 0.62));
  if (K.aero) { // Ori's car wears a black peach badge on both doors and on the tail
    const place = (x, y, z, ry) => { for (const g of peachBadge(0.34)) { g.rotateY(ry); g.translate(x, y, z); parts.push(g); } };
    place(-0.1, 0.62, hw + 0.004, 0);
    place(-0.1, 0.62, -hw - 0.004, Math.PI);
    place(K.tail - 0.145, 0.5, 0, -Math.PI / 2);
  }
  return { body: mergeGeos(bodyParts), details: mergeGeos(parts), kind };
}
