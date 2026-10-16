// Furniture & props — everything is built from primitives. Units: centimetres, y-up.
// Design language: Apple Store / Apple Park — soft rounded rectangles, pale stone, light oak,
// brushed aluminium, felt and graphite. No hard 90° edges anywhere.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const rbox = (w, h, d, r = 0.6, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, r);
const lathe = (pts, seg = 56) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

function mesh(geo, mat, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(o.x || 0, o.y || 0, o.z || 0);
  m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0);
  m.castShadow = o.cast !== false;
  m.receiveShadow = o.receive !== false;
  return m;
}

/** Smooth shading across soft bevels while keeping genuinely sharp corners crisp. */
export const smooth = (geo, angle = 0.75) => toCreasedNormals(geo, angle);

/** Rounded rectangle outline centred on (cx, cy). */
export function roundedRectShape(w, h, r, cx = 0, cy = 0) {
  const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001);
  const x = cx - w / 2, y = cy - h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.absarc(x + w - rr, y + rr, rr, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - rr);
  s.absarc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2, false);
  s.lineTo(x + rr, y + h);
  s.absarc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + rr);
  s.absarc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5, false);
  return s;
}

/**
 * Horizontal slab with rounded plan corners and a soft bevelled edge, centred on the origin.
 * Material slots: 0 = top/bottom caps (UVs in cm), 1 = the edge.
 */
export function slabGeo(w, d, thick, r, bevel = 0.8) {
  const bv = Math.max(0.05, Math.min(bevel, thick / 2 - 0.01, r - 0.01));
  const depth = Math.max(0.02, thick - 2 * bv);
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w - 2 * bv, d - 2 * bv, Math.max(0.05, r - bv)), {
    depth, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: bv > 2.5 ? 8 : 4, curveSegments: 22,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -depth / 2, 0);
  return smooth(geo);
}

export function createMaterials(tex) {
  const std = (color, rough = 0.7, metal = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  return {
    wallBack: new THREE.MeshStandardMaterial({ map: tex.wallB, color: 0xf7f5f0, roughness: 0.96 }),
    wallLeft: new THREE.MeshStandardMaterial({ map: tex.wallL, color: 0xfbf9f5, roughness: 0.96 }),
    wallCove: std(0xe9e6df, 0.96),
    plaster: std(0xe6e3dd, 0.95),
    white: std(0xf7f7f9, 0.45),
    ceramic: std(0xf8f8f6, 0.26),
    sage: std(0xb2bfac, 0.32),
    clay: std(0xdcc9b6, 0.5),
    metal: std(0x232428, 0.45, 0.7),              // graphite
    silver: std(0xd2d4d9, 0.34, 1),               // brushed aluminium
    titanium: std(0xb9b5ad, 0.34, 1),
    oak: new THREE.MeshStandardMaterial({ map: tex.oak, roughness: 0.5 }),
    oakSolid: std(0xe2cfa9, 0.55),
    floor: new THREE.MeshStandardMaterial({ map: tex.floor, roughness: 0.4 }),
    seat: std(0x4a4c53, 0.92),
    fabricWarm: std(0xddd8ce, 0.97),
    fabricSage: std(0xb4c0ad, 0.97),
    felt: new THREE.MeshStandardMaterial({ map: tex.felt, roughness: 1 }),
    rug: new THREE.MeshStandardMaterial({ map: tex.rug, roughness: 1 }),
    rugSide: std(0xd9d2c3, 1),
    black: std(0x0e0e10, 0.5),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06 }),
    soil: std(0x2a2019, 1),
    coffee: std(0x3a2314, 0.3),
    paper: std(0xf6f6f4, 0.9),
    dried: std(0xcdb78f, 0.9),
    leafA: std(0x4f8a52, 0.55, 0, { side: THREE.DoubleSide }),
    leafB: std(0x5f9a5a, 0.55, 0, { side: THREE.DoubleSide }),
    leafC: std(0x3f7646, 0.55, 0, { side: THREE.DoubleSide }),
    trunk: std(0x6b5238, 0.85),
    fabricWhite: std(0xf1f1f3, 0.95),
    lamp: new THREE.MeshStandardMaterial({ color: 0xfff7e8, emissive: 0xffe9c4, emissiveIntensity: 1.2, roughness: 0.7 }),
    led: new THREE.MeshBasicMaterial({ color: 0xfff6e6, toneMapped: false }),
  };
}

// ── desk: a floating slab of light oak with a soft rounded plan, on four tapered, splayed legs ──
export function createDesk(m, topMat) {
  const g = new THREE.Group();
  g.add(mesh(slabGeo(180, 80, 4.0, 13, 1.5), topMat || m.oak, { y: 74.6 }));
  // inset lower slab: makes the top read as floating and thin
  g.add(mesh(slabGeo(166, 66, 2.4, 9, 0.7), m.silver, { y: 71.2 }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = mesh(new THREE.CylinderGeometry(2.1, 1.45, 71.5, 28), m.silver, {
      x: sx * 78.5, y: 35.2, z: sz * 31.5, rz: sx * 0.085, rx: -sz * 0.085,
    });
    g.add(leg);
    g.add(mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.6, 32), m.silver, { x: sx * 74.6, y: 70.0, z: sz * 29.5 }));
  }
  return g;
}

// ── chair (faces +Z): a sculpted wrap-around shell in graphite fabric on an aluminium star base ──
function arcBandGeo(R, thick, half, height, bevel = 1) {
  const N = 30, Ri = R - thick;
  const s = new THREE.Shape();
  for (let i = 0; i <= N; i++) {
    const a = -half + (2 * half * i) / N;
    const x = Math.sin(a) * R, y = Math.cos(a) * R;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  for (let i = N; i >= 0; i--) {
    const a = -half + (2 * half * i) / N;
    s.lineTo(Math.sin(a) * Ri, Math.cos(a) * Ri);
  }
  s.closePath();
  const depth = height - 2 * bevel;
  const geo = new THREE.ExtrudeGeometry(s, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 6, curveSegments: 8,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -depth / 2, 0);
  return smooth(geo);
}

export function createChair(m) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const arm = new THREE.Group();
    arm.rotation.y = (i / 5) * Math.PI * 2;
    arm.add(mesh(new THREE.CapsuleGeometry(1.75, 25, 6, 14), m.silver, { x: 14, y: 6.4, rz: Math.PI / 2 - 0.1 }));
    arm.add(mesh(new THREE.CylinderGeometry(0.9, 0.9, 3.4, 12), m.black, { x: 26.4, y: 4.4 }));
    arm.add(mesh(new THREE.SphereGeometry(2.3, 20, 14), m.black, { x: 26.4, y: 2.3 }));
    g.add(arm);
  }
  g.add(mesh(new THREE.CylinderGeometry(2.1, 2.1, 30, 24), m.silver, { y: 23 }));
  g.add(mesh(new THREE.CylinderGeometry(3.6, 3.1, 6, 28), m.silver, { y: 37 }));
  g.add(mesh(rbox(22, 4.2, 22, 1.8, 4), m.silver, { y: 41.6 }));
  // seat cushion
  g.add(mesh(slabGeo(51, 48, 7.5, 15, 3.0), m.seat, { y: 46.5, z: 1 }));
  // wrap-around back shell, leaning back slightly
  g.add(mesh(arcBandGeo(36, 4.6, 0.86, 36, 1.4), m.seat, { y: 70, z: 12, rx: -0.1 }));
  g.add(mesh(rbox(5.4, 22, 3.2, 1.2, 4), m.silver, { y: 57.5, z: -24.5, rx: -0.1 }));
  return g;
}

// ── leaf-based plant (Apple Stores have trees) ──
function leafGeometry(len = 26, wid = 10) {
  const s = new THREE.Shape();
  const k = wid / 10;
  s.moveTo(0, 0);
  s.bezierCurveTo(9 * k, len * 0.08, 10 * k, len * 0.55, 3.5 * k, len * 0.88);
  s.quadraticCurveTo(0, len * 1.04, -3.5 * k, len * 0.88);
  s.bezierCurveTo(-10 * k, len * 0.55, -9 * k, len * 0.08, 0, 0);
  const geo = new THREE.ShapeGeometry(s, 10);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), x = p.getX(i);
    p.setZ(i, (y / len) * (y / len) * 6 - Math.abs(x) * 0.12);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createFiddlePlant(m) {
  const g = new THREE.Group();
  // round oak plinth + a belly-shaped ceramic pot
  g.add(mesh(lathe([[0, 0], [22.4, 0], [23.2, 0.7], [23.2, 3.0], [22.4, 3.7], [0, 3.7]], 64), m.oakSolid));
  const pot = lathe([
    [0, 0], [9.5, 0], [12.5, 0.9], [17.8, 9], [19.6, 18], [18.6, 27], [16.4, 33.5], [15.4, 35.2],
    [14.4, 35.2], [14.2, 34], [0, 33.6],
  ], 64);
  g.add(mesh(pot, m.ceramic, { y: 3.7 }));
  g.add(mesh(new THREE.CylinderGeometry(14.6, 14.6, 0.8, 40), m.soil, { y: 3.7 + 33.9, cast: false }));

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 36, 0),
    new THREE.Vector3(3, 72, -1),
    new THREE.Vector3(-1, 112, 2.5),
    new THREE.Vector3(4, 156, 0),
  ]);
  g.add(mesh(new THREE.TubeGeometry(curve, 28, 1.7, 10), m.trunk));

  const geo = leafGeometry(30, 15);
  const mats = [m.leafA, m.leafB, m.leafC];
  const N = 34;
  for (let i = 0; i < N; i++) {
    const t = 0.24 + (i / N) * 0.76;
    const holder = new THREE.Group();
    holder.position.copy(curve.getPoint(t));
    holder.rotation.y = i * 2.4 + Math.sin(i * 1.7) * 0.25;
    const leaf = mesh(geo, mats[i % 3], { rx: THREE.MathUtils.lerp(1.05, 0.35, t) + Math.sin(i * 2.3) * 0.12 });
    leaf.scale.setScalar(THREE.MathUtils.lerp(1.15, 0.7, t) * (0.9 + 0.2 * Math.abs(Math.sin(i * 3.1))));
    holder.add(leaf);
    g.add(holder);
  }
  return g;
}

// ── soft round rug (wool pile, sage border) ──
export function createRug(m, R = 100) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CircleGeometry(R, 96), m.rug);
  top.rotation.x = -Math.PI / 2;
  top.position.y = 1.1;
  top.receiveShadow = true;
  g.add(top);
  const edge = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1.1, 96, 1, true), m.rugSide);
  edge.position.y = 0.55;
  edge.receiveShadow = true;
  g.add(edge);
  return g;
}

// ── round oak side table with a slim graphite stem ──
export function createSideTable(m) {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0, 0], [14.4, 0], [15.2, 0.5], [15.2, 1.5], [14.4, 2.0], [0, 2.0]], 48), m.metal));
  g.add(mesh(new THREE.CylinderGeometry(1.5, 2.0, 46, 24), m.metal, { y: 24.5 }));
  g.add(mesh(lathe([[0, 0], [20.4, 0], [21.6, 0.7], [21.6, 2.4], [20.4, 3.1], [0, 3.1]], 64), m.oakSolid, { y: 46.9 }));
  return g;
}

// ── ceramic bud vase with dried stems ──
export function createVase(m) {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0, 0], [4.6, 0], [7.2, 3.5], [8.2, 9], [6.6, 15], [3.4, 19], [2.9, 22.5], [3.5, 23.2], [2.4, 23.2], [0, 21]], 40), m.clay));
  const stems = [[-0.5, 0.3, 0.12], [1.5, -0.6, -0.18], [-1.6, -0.9, 0.3], [0.9, 1.3, -0.34], [-0.2, -1.4, 0.05]];
  stems.forEach(([ox, oz, lean], i) => {
    const h = 34 + i * 6;
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ox, 20, oz),
      new THREE.Vector3(ox + lean * 10, 20 + h * 0.5, oz + lean * 4),
      new THREE.Vector3(ox + lean * 26, 20 + h, oz - lean * 8),
    ]);
    g.add(mesh(new THREE.TubeGeometry(c, 14, 0.28, 6), m.trunk));
    const tip = c.getPoint(1);
    const plume = mesh(new THREE.SphereGeometry(2.1, 14, 10), m.dried, { x: tip.x, y: tip.y + 1.4, z: tip.z });
    plume.scale.set(0.8, 2.4, 0.8);
    g.add(plume);
  });
  return g;
}

// ── tall floor lamp: weighted disc, thin aluminium stem, frosted globe ──
export function createFloorLamp(m) {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0, 0], [13.5, 0], [14.5, 0.6], [14.5, 1.6], [13.6, 2.2], [0, 2.2]], 48), m.metal));
  g.add(mesh(new THREE.CylinderGeometry(0.75, 0.75, 150, 14), m.silver, { y: 76 }));
  g.add(mesh(new THREE.SphereGeometry(14, 40, 28), m.lamp, { y: 163, cast: false }));
  g.add(mesh(new THREE.CylinderGeometry(3.4, 3.4, 1.6, 24), m.silver, { y: 149 }));
  return g;
}

// ── pill-shaped upholstered bench on a recessed plinth ──
export function createBench(m, { length = 130, width = 42 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(slabGeo(length - 16, width - 14, 8, (width - 14) / 2, 1.2), m.black, { y: 4 }));
  g.add(mesh(slabGeo(length, width, 30, width / 2, 8), m.fabricWarm, { y: 23 }));
  // a single soft cushion near one end
  g.add(mesh(smooth(rbox(30, 12, 28, 5.5, 6)), m.fabricSage, { x: -length / 2 + 26, y: 43.2, z: 0, ry: 0.35, rz: 0.04 }));
  return g;
}

// ── floating oak shelf with a few quiet objects ──
export function createShelf(m, { length = 112, depth = 20 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(slabGeo(length, depth, 3.6, depth / 2, 1.1), m.oakSolid, { y: 0 }));
  const top = 1.8;
  // two books and a bowl
  const b1 = mesh(rbox(26, 3.2, 18, 0.5, 3), m.white, { x: -32, y: top + 1.6, z: 0, ry: 0.06 });
  const b2 = mesh(rbox(23, 2.6, 16, 0.5, 3), m.seat, { x: -32, y: top + 3.2 + 1.3, z: 0.4, ry: -0.1 });
  g.add(b1, b2);
  g.add(mesh(lathe([[0, 0], [4.5, 0], [8.5, 3.4], [9.6, 5.8], [8.8, 5.8], [7.6, 3.8], [0, 1.0]], 40), m.ceramic, { x: 4, y: top }));
  g.add(mesh(lathe([[0, 0], [3.4, 0], [5.2, 2.5], [5.4, 7], [3.4, 11], [2.6, 14], [3.0, 14.8], [2.0, 14.8], [0, 12]], 36), m.sage, { x: 30, y: top, z: 1 }));
  const stem = new THREE.CatmullRomCurve3([
    new THREE.Vector3(30, top + 13, 1), new THREE.Vector3(32, top + 24, 0.5), new THREE.Vector3(37, top + 33, 0),
  ]);
  g.add(mesh(new THREE.TubeGeometry(stem, 10, 0.3, 6), m.trunk));
  const tip = mesh(new THREE.SphereGeometry(1.9, 12, 10), m.dried, { x: 37, y: top + 34.2, z: 0 });
  tip.scale.set(0.8, 2.2, 0.8);
  g.add(tip);
  return g;
}

// ── wall art: white rounded frame holding the macOS wallpaper ──
export function createFrame(m, { w, h, tex }) {
  const g = new THREE.Group();
  const depth = 2.0, bv = 0.5;
  const frame = new THREE.ExtrudeGeometry(roundedRectShape(w - 2 * bv, h - 2 * bv, 6), {
    depth, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 3, curveSegments: 18,
  });
  frame.translate(0, 0, -depth / 2);
  g.add(mesh(smooth(frame), m.white));
  const artGeo = new THREE.ShapeGeometry(roundedRectShape(w - 5, h - 5, 3.2), 18);
  const pos = artGeo.attributes.position, uv = artGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + (w - 5) / 2) / (w - 5), (pos.getY(i) + (h - 5) / 2) / (h - 5));
  const art = new THREE.Mesh(
    artGeo,
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 })
  );
  art.position.z = depth / 2 + bv + 0.02;
  art.receiveShadow = true;
  g.add(art);
  return g;
}

// ── felt acoustic panel (rounded rectangle) ──
export function createPanel(m, { w, h, r = 28, depth = 2.4 }) {
  const bv = 0.7;
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w - 2 * bv, h - 2 * bv, r - bv), {
    depth: depth - 2 * bv, bevelEnabled: true, bevelThickness: bv, bevelSize: bv, bevelSegments: 4, curveSegments: 24,
  });
  geo.translate(0, 0, -(depth - 2 * bv) / 2);
  return mesh(smooth(geo), m.felt);
}

// ── desk accessories ──
export function createMug(m) {
  const g = new THREE.Group();
  const prof = [[0, 0], [3.6, 0], [4.2, 0.4], [4.4, 9], [4.1, 9.5], [3.7, 9.5], [3.9, 8.9], [3.7, 1.2], [0, 1.2]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  g.add(mesh(new THREE.LatheGeometry(prof, 36), m.ceramic));
  g.add(mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.2, 28), m.coffee, { y: 7.8, cast: false }));
  g.add(mesh(new THREE.TorusGeometry(2.7, 0.62, 10, 24, Math.PI), m.ceramic, { x: 4.2, y: 4.8, rz: -Math.PI / 2 }));
  return g;
}

// Apple Magic Mouse: 5.71 × 11.35 × 2.16 cm, white glass top that tapers toward the front (−Z).
export function createMouse() {
  const g = new THREE.Group();
  const L = 11.35, Wd = 5.71, Ht = 2.16;
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf6f6f4, roughness: 0.22, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.12 });
  const alu = new THREE.MeshStandardMaterial({ color: 0xd4d6da, metalness: 1, roughness: 0.38 });

  const sole = new THREE.Mesh(
    new THREE.ExtrudeGeometry(roundedRectShape(Wd - 0.5, L - 0.5, 2.3), { depth: 0.18, bevelEnabled: false, curveSegments: 20 }),
    alu
  );
  sole.rotation.x = -Math.PI / 2;
  sole.castShadow = true;
  g.add(sole);

  const bev = 0.55;
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(Wd - 2 * bev, L - 2 * bev, 2.2), {
    depth: Ht - 0.18 - 2 * bev + 0.0001,
    bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 8, curveSegments: 28,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y + 0.18, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getZ(i) + L / 2) / L, 0, 1);
    pos.setY(i, 0.18 + (pos.getY(i) - 0.18) * (0.42 + 0.58 * Math.pow(t, 0.8)));
  }
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, white);
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  return g;
}

// iPhone Pro: 7.15 × 14.67 × 0.83 cm, titanium frame, lock screen showing 9:41.
export function createIPhone(m, screenTex) {
  const g = new THREE.Group();
  const W = 7.15, L = 14.67, H = 0.83;
  g.add(mesh(rbox(W, H, L, 0.98, 5), m.titanium, { y: H / 2 }));
  const scr = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.04, L - 0.04),
    new THREE.MeshBasicMaterial({ map: screenTex, transparent: true, alphaTest: 0.5, toneMapped: false })
  );
  scr.rotation.x = -Math.PI / 2;
  scr.position.y = H + 0.012;
  g.add(scr);
  return g;
}

// iPad Air on a slim aluminium stand (landscape), leaning back ~12°.
export function createIPad(m, screenTex) {
  const g = new THREE.Group();
  const W = 24.76, Hh = 17.85, D = 0.6;
  const tilt = new THREE.Group();
  tilt.position.set(0, 0.4, 3.2);
  tilt.rotation.x = -0.22;
  tilt.add(mesh(rbox(W, Hh, D, 0.7, 4), m.silver, { y: Hh / 2 }));
  const scr = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.04, Hh - 0.04),
    new THREE.MeshBasicMaterial({ map: screenTex, transparent: true, alphaTest: 0.5, toneMapped: false })
  );
  scr.position.set(0, Hh / 2, D / 2 + 0.012);
  tilt.add(scr);
  g.add(tilt);
  // stand: a foot plate and a back strut
  g.add(mesh(rbox(14, 0.6, 9, 0.28, 3), m.silver, { y: 0.3, z: 2.4 }));
  g.add(mesh(rbox(10, 11, 0.7, 0.3, 3), m.silver, { y: 6.2, z: -1.6, rx: 0.5 }));
  return g;
}

// AirPods Pro case: 6.06 × 5.3 × 2.15 cm
export function createAirPods(m) {
  const g = new THREE.Group();
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf7f7f7, roughness: 0.25, metalness: 0, clearcoat: 0.7 });
  g.add(mesh(rbox(6.06, 1.3, 5.3, 0.9, 5), white, { y: 0.65 }));
  g.add(mesh(rbox(6.0, 0.88, 5.24, 0.85, 5), white, { y: 1.74 }));
  g.add(mesh(box(5.5, 0.04, 0.04), m.black, { y: 1.3, z: 2.6, cast: false }));
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 12), m.led, { y: 1.1, z: 2.66, rx: Math.PI / 2, cast: false }));
  return g;
}

// HomePod mini: 9.7 cm wide, 8.4 cm tall, mesh fabric, touch surface on top.
export function createHomePod(m) {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(4.85, 40, 28), m.fabricWhite, { y: 4.2 });
  body.scale.y = 0.87;
  g.add(body);
  g.add(mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.25, 36), m.white, { y: 8.35 }));
  g.add(mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.05, 36), m.led, { y: 8.5, cast: false }));
  return g;
}
