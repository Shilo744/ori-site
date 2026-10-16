// NEON DRIFT — procedural car geometry: three body types (hatch / GT / hyper) built from extruded side profiles that are
// tapered in plan view, plus wing, skirts, diffuser, mirrors, wheels with rims and brake discs. Parts are merged per material,
// so a whole car is a handful of draw calls. Axes: x forward, y up (origin at axle height), z right.
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const PAINTS = [0xff2d6f, 0x19c8ff, 0xffd23f, 0x7a5cff, 0xeceef6, 0x18e08a];
export const PAINT_NAMES = ['Hot pink', 'Cyan', 'Solar yellow', 'Violet', 'Pearl', 'Mint'];

export const CAR_SPECS = {
  hatch: {
    name: 'Hatch', L: 3.95, W: 1.76, axle: 1.24, track: 0.84, wheelR: 0.33, wheelW: 0.24,
    body: [[-1.95, -0.14], [1.9, -0.14], [1.98, 0.06], [1.93, 0.3], [1.35, 0.5], [0.75, 0.6], [-1.6, 0.62], [-1.96, 0.5], [-2.0, 0.2]],
    cabin: [[-1.85, 0.6], [-1.5, 1.12], [0.15, 1.2], [0.95, 0.6]],
    cabinW: 0.84, wing: 'lip', skirts: 0.06,
  },
  gt: {
    name: 'GT', L: 4.55, W: 1.86, axle: 1.4, track: 0.88, wheelR: 0.35, wheelW: 0.28,
    body: [[-2.28, -0.16], [2.25, -0.16], [2.34, 0.05], [2.28, 0.3], [1.55, 0.46], [0.75, 0.58], [-1.55, 0.58], [-2.15, 0.52], [-2.3, 0.28]],
    cabin: [[-1.25, 0.54], [-0.62, 0.98], [0.4, 1.02], [1.05, 0.55]],
    cabinW: 0.8, wing: 'stand', skirts: 0.09,
  },
  hyper: {
    name: 'Hyper', L: 4.72, W: 2.0, axle: 1.46, track: 0.96, wheelR: 0.36, wheelW: 0.32,
    body: [[-2.35, -0.14], [2.3, -0.14], [2.42, 0.0], [2.36, 0.2], [1.7, 0.34], [0.9, 0.44], [-1.2, 0.5], [-2.2, 0.46], [-2.38, 0.26]],
    cabin: [[-0.95, 0.46], [-0.3, 0.82], [0.5, 0.84], [1.1, 0.44]],
    cabinW: 0.74, wing: 'big', skirts: 0.12,
  },
};
export const CAR_TYPE_IDS = Object.keys(CAR_SPECS);

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Smooth outline: a centripetal spline through the corner points (the first and last stay put), closed by a straight base. */
function smoothOutline(points, n) {
  const path = [...points.slice(1), points[0]].map(([x, y]) => new THREE.Vector3(x, y, 0));
  const curve = new THREE.CatmullRomCurve3(path, false, 'centripetal');
  return curve.getPoints(n).map((p) => [p.x, p.y]);
}

function extrude(points, depth, bevel) {
  const shape = new THREE.Shape();
  smoothOutline(points, 56).forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 1 });
  g.translate(0, 0, -depth / 2);
  return g;
}

function nonIndexed(g) { return g.index ? g.toNonIndexed() : g; }
/** A geometry with only position + normal + uv, so that parts of any origin can be merged. */
function plain(g) {
  const out = nonIndexed(g);
  for (const k of Object.keys(out.attributes)) if (!['position', 'normal', 'uv'].includes(k)) out.deleteAttribute(k);
  if (!out.attributes.uv) out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
  return out;
}
function tint(g, hex) {
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const box = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return plain(g); };

/** Tapers an extruded body in plan view (narrower nose and tail) and recomputes the normals. */
function taper(g, L, noseK, tailK, tumble, yRange) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    let k = 1;
    if (x > 0) k = 1 - (1 - noseK) * smooth(0.18 * L, 0.5 * L, x);
    else k = 1 - (1 - tailK) * smooth(0.22 * L, 0.5 * L, -x);
    if (tumble && yRange) k *= 1 - tumble * Math.min(1, Math.max(0, (y - yRange[0]) / (yRange[1] - yRange[0])));
    p.setZ(i, p.getZ(i) * k);
  }
  return toCreasedNormals(g, 0.95); // smooth over gentle edges, keep the sharp ones
}

/**
 * Geometry for one car type, grouped by material:
 * { paint, glass, trim, metal, tail, head, wheels: { tire, rim } , sizes }
 */
export function buildCarParts(typeId) {
  const s = CAR_SPECS[typeId] || CAR_SPECS.gt;
  const paint = [];
  const glass = [];
  const trim = [];

  const shell = taper(plain(extrude(s.body, s.W - 0.12, 0.07)), s.L, 0.76, 0.86);
  paint.push(shell);
  const cab = extrude(s.cabin, s.W * s.cabinW, 0.06);
  glass.push(taper(plain(cab), s.L, 0.9, 0.9, 0.2, [s.cabin[0][1], s.cabin[1][1]]));

  // roof panel in body colour
  const roofY = Math.max(s.cabin[1][1], s.cabin[2][1]);
  const roof = box(s.cabin[2][0] - s.cabin[1][0] + 0.05, 0.035, s.W * s.cabinW * 0.8, (s.cabin[1][0] + s.cabin[2][0]) / 2, roofY + 0.045, 0);
  paint.push(roof);

  // skirts, splitter, diffuser
  for (const z of [-1, 1]) trim.push(box(s.L * 0.5, 0.1, 0.06 + s.skirts * 0.2, 0.1, -0.12, z * (s.W / 2 - 0.02)));
  trim.push(box(0.5, 0.05, s.W * 0.9, s.L / 2 - 0.1, -0.15, 0));
  const dif = [];
  for (let i = -3; i <= 3; i++) dif.push(box(0.5, 0.2, 0.04, -s.L / 2 + 0.22, -0.06, i * 0.22));
  trim.push(mergeGeometries(dif));
  trim.push(box(0.2, 0.2, s.W * 0.72, -s.L / 2 + 0.06, 0.02, 0));

  // wheel arches: a dark lip around the upper half of every wheel, on both flanks
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const arch = new THREE.TorusGeometry(s.wheelR + 0.07, 0.04, 6, 18, Math.PI);
      arch.translate(sx * s.axle, 0, sz * (s.W / 2 - 0.1));
      trim.push(plain(arch));
    }
  }
  // mirrors + door cut
  for (const z of [-1, 1]) {
    const m = box(0.22, 0.1, 0.12, s.cabin[3][0] - 0.2, s.cabin[3][1] + 0.12, z * (s.W * s.cabinW / 2 + 0.1));
    paint.push(m);
  }
  // side intakes (dark) behind the doors
  for (const z of [-1, 1]) trim.push(box(0.5, 0.14, 0.05, -s.L * 0.2, 0.3, z * (s.W / 2 - 0.05)));
  // hood vent
  trim.push(box(0.5, 0.02, s.W * 0.3, s.L * 0.22, s.body[5][1] + 0.01, 0));

  // wing
  if (s.wing === 'stand') {
    paint.push(box(0.7, 0.05, s.W - 0.1, -s.L / 2 + 0.2, 0.98, 0));
    for (const z of [-0.5, 0.5]) trim.push(box(0.12, 0.38, 0.07, -s.L / 2 + 0.28, 0.78, z));
    for (const z of [-1, 1]) trim.push(box(0.5, 0.2, 0.03, -s.L / 2 + 0.2, 1.0, z * (s.W / 2 - 0.06)));
  } else if (s.wing === 'big') {
    paint.push(box(0.8, 0.05, s.W - 0.04, -s.L / 2 + 0.1, 1.05, 0));
    paint.push(box(0.36, 0.04, s.W - 0.2, -s.L / 2 + 0.55, 0.96, 0));
    for (const z of [-1, 1]) {
      trim.push(box(0.9, 0.34, 0.04, -s.L / 2 + 0.2, 0.96, z * (s.W / 2 - 0.02)));
      trim.push(box(0.14, 0.4, 0.07, -s.L / 2 + 0.3, 0.75, z * 0.45));
    }
  } else {
    paint.push(box(0.34, 0.04, s.W * 0.78, -s.L / 2 + 0.05, s.cabin[0][1] + 0.1, 0)); // hatch lip
  }

  // lights: a tail bar across the rear, headlight slits at the nose
  const tail = [box(0.05, 0.1, s.W * 0.72, -s.L / 2 - 0.04, s.body[7][1] - 0.1, 0)];
  for (const z of [-1, 1]) tail.push(box(0.05, 0.12, 0.34, -s.L / 2 - 0.02, s.body[7][1] - 0.12, z * (s.W / 2 - 0.2)));
  const head = [];
  for (const z of [-1, 1]) head.push(box(0.5, 0.08, 0.4, s.L / 2 - 0.12, s.body[3][1] - 0.04, z * (s.W / 2 - 0.34)));

  // wheels: tyre (lathe with rounded shoulders) + rim (spokes, hub, ring, brake disc and caliper, vertex coloured)
  const R = s.wheelR;
  const Wd = s.wheelW;
  const prof = [[R * 0.62, -Wd / 2], [R * 0.86, -Wd / 2 - 0.005], [R * 0.99, -Wd / 2 + 0.05], [R, -0.02], [R, 0.02], [R * 0.99, Wd / 2 - 0.05], [R * 0.86, Wd / 2 + 0.005], [R * 0.62, Wd / 2]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const tire = new THREE.LatheGeometry(prof, 22);
  tire.rotateX(Math.PI / 2); // axis -> z
  const rim = [];
  const ring = new THREE.TorusGeometry(R * 0.66, 0.018, 6, 24); ring.translate(0, 0, Wd / 2 - 0.02);
  rim.push(tint(plain(ring), 0xd8dcea));
  const hub = new THREE.CylinderGeometry(R * 0.16, R * 0.16, 0.05, 10); hub.rotateX(Math.PI / 2); hub.translate(0, 0, Wd / 2 - 0.02);
  rim.push(tint(plain(hub), 0xaab0c4));
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.BoxGeometry(R * 0.5, 0.05, 0.03);
    sp.translate(R * 0.28, 0, Wd / 2 - 0.02);
    sp.rotateZ((i / 5) * Math.PI * 2);
    rim.push(tint(plain(sp), 0xd0d4e4));
  }
  const disc = new THREE.CylinderGeometry(R * 0.55, R * 0.55, 0.03, 20); disc.rotateX(Math.PI / 2); disc.translate(0, 0, Wd / 2 - 0.1);
  rim.push(tint(plain(disc), 0x6a6e7c));
  const cal = new THREE.BoxGeometry(R * 0.3, R * 0.5, 0.06); cal.translate(R * 0.4, 0.02, Wd / 2 - 0.07);
  rim.push(tint(plain(cal), 0xe03a3a));

  const merge = (list) => {
    const g = mergeGeometries(list.map((x) => (x.attributes.uv ? x : plain(x))));
    g.computeBoundingSphere();
    return g;
  };
  return {
    spec: s,
    paint: merge(paint),
    glass: merge(glass),
    trim: merge(trim),
    tail: merge(tail),
    head: merge(head),
    wheels: { tire: plain(tire), rim: mergeGeometries(rim) },
  };
}
