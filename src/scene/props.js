// Furniture & structural props — everything is built from primitives. Units: centimetres, y-up.
// Design language: Apple Store / Apple Park — soft rounded rectangles, pale stone, light oak,
// brushed aluminium, felt and graphite. No hard 90° edges anywhere.
// Devices and desk accessories live in props-devices.js. Static parts are merged per material (few draw calls).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mergeByMaterial } from './merge.js';

export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const rbox = (w, h, d, r = 0.6, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, r);
export const lathe = (pts, seg = 56) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

export function mesh(geo, mat, o = {}) {
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
  const phys = (color, rough, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, ...extra });
  const fabric = (color, sheen, rough = 0.95) => phys(color, rough, { sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(sheen) });
  const leaf = (color) => std(color, 0.5, 0, { side: THREE.DoubleSide, map: tex.leaf, bumpMap: tex.leaf, bumpScale: 0.25 });
  return {
    // room shell: subtle plaster / stone relief and roughness variation
    wallBack: new THREE.MeshStandardMaterial({ map: tex.wallB, color: 0xf7f5f0, roughness: 0.96, bumpMap: tex.wallB, bumpScale: 0.35 }),
    wallLeft: new THREE.MeshStandardMaterial({ map: tex.wallL, color: 0xfbf9f5, roughness: 0.96, bumpMap: tex.wallL, bumpScale: 0.35 }),
    wallCove: std(0xe9e6df, 0.96),
    plaster: std(0xe6e3dd, 0.95),
    // porcelain / glaze: clearcoat
    white: phys(0xf7f7f9, 0.45, { clearcoat: 0.25, clearcoatRoughness: 0.35 }),
    ceramic: phys(0xf8f8f6, 0.26, { clearcoat: 0.85, clearcoatRoughness: 0.1 }),
    sage: phys(0xb2bfac, 0.32, { clearcoat: 0.7, clearcoatRoughness: 0.12 }),
    clay: phys(0xdcc9b6, 0.55, { clearcoat: 0.15, clearcoatRoughness: 0.5 }),
    metal: std(0x232428, 0.45, 0.7), // graphite
    silver: std(0xd2d4d9, 0.34, 1), // brushed aluminium
    titanium: std(0xb9b5ad, 0.3, 1),
    oak: new THREE.MeshStandardMaterial({ map: tex.oak, roughness: 0.62, roughnessMap: tex.oak, bumpMap: tex.oak, bumpScale: 0.45 }),
    oakSolid: std(0xe2cfa9, 0.55, 0, { bumpMap: tex.noise, bumpScale: 0.05 }),
    floor: new THREE.MeshStandardMaterial({ map: tex.floor, roughness: 0.55, roughnessMap: tex.floor, bumpMap: tex.floor, bumpScale: 0.5 }),
    // fabrics: sheen
    seat: fabric(0x4a4c53, 0x9aa0b8),
    fabricWarm: fabric(0xddd8ce, 0xfff6e8),
    fabricSage: fabric(0xb4c0ad, 0xe2efd8),
    fabricWhite: std(0xf1f1f3, 0.95, 0, { map: tex.meshFabric, bumpMap: tex.meshFabric, bumpScale: 0.9 }),
    felt: phys(0xffffff, 1, { map: tex.felt, sheen: 1, sheenRoughness: 0.8, sheenColor: new THREE.Color(0xffffff) }),
    rug: new THREE.MeshStandardMaterial({ map: tex.rug, roughness: 1, bumpMap: tex.rug, bumpScale: 0.6 }),
    rugSide: std(0xd9d2c3, 1),
    black: std(0x0e0e10, 0.5),
    rubber: std(0x18181a, 0.85),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06 }),
    soil: std(0x2a2019, 1, 0, { bumpMap: tex.noise, bumpScale: 0.6 }),
    pebble: std(0xb9b2a6, 0.85, 0, { bumpMap: tex.noise, bumpScale: 0.3 }),
    coffee: phys(0x3a2314, 0.3, { clearcoat: 0.6, clearcoatRoughness: 0.2 }),
    paper: std(0xf6f6f4, 0.9),
    dried: std(0xcdb78f, 0.9),
    leafA: leaf(0x4f8a52),
    leafB: leaf(0x5f9a5a),
    leafC: leaf(0x3f7646),
    leafD: leaf(0x78ad62), // new growth
    leafE: leaf(0x2f6040), // old leaves
    succulent: std(0x8fb69a, 0.45, 0, { side: THREE.DoubleSide }),
    trunk: std(0x6b5238, 0.85, 0, { bumpMap: tex.noise, bumpScale: 0.5 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xfff7e8, emissive: 0xffe9c4, emissiveMap: tex.lampGlow, emissiveIntensity: 1.2, roughness: 0.7 }),
    led: new THREE.MeshBasicMaterial({ color: 0xfff6e6, toneMapped: false }),
    leather: std(0x2f3136, 0.55, 0, { bumpMap: tex.noise, bumpScale: 0.35 }),
    cable: std(0xf0f0f2, 0.6),
  };
}

// ── desk: a floating slab of light oak with a soft rounded plan, on four tapered, splayed legs ──
export function createDesk(m, topMat) {
  const g = new THREE.Group();
  g.add(mesh(slabGeo(180, 80, 4.0, 13, 1.5), topMat || m.oak, { y: 74.6 }));
  // inset lower slab: makes the top read as floating and thin
  g.add(mesh(slabGeo(166, 66, 2.4, 9, 0.7), m.silver, { y: 71.2 }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(mesh(new THREE.CylinderGeometry(2.1, 1.45, 71.5, 28), m.silver, {
      x: sx * 78.5, y: 35.2, z: sz * 31.5, rz: sx * 0.085, rx: -sz * 0.085,
    }));
    g.add(mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.6, 32), m.silver, { x: sx * 74.6, y: 70.0, z: sz * 29.5 }));
    // leg detail: a dark levelling foot with a rubber pad, and a brushed collar below the top plate
    const fx = sx * 78.5 + sx * 0.085 * -35, fz = sz * 31.5 + sz * 0.085 * 35;
    g.add(mesh(new THREE.CylinderGeometry(1.75, 1.95, 1.0, 22), m.black, { x: fx, y: 0.5, z: fz }));
    g.add(mesh(new THREE.CylinderGeometry(2.3, 2.1, 1.6, 24), m.silver, { x: sx * 75.9, y: 67.4, z: sz * 30 }));
  }
  // under-desk cable tray + a cable grommet in the top near the back edge
  g.add(mesh(rbox(120, 3.6, 12, 1.0, 3), m.metal, { y: 66.4, z: -20 }));
  g.add(mesh(box(116, 0.4, 0.4), m.rubber, { y: 66.0, z: -14.2, cast: false }));
  g.add(mesh(lathe([[2.6, 0], [3.5, 0.2], [3.7, 0.55], [3.0, 0.78], [2.6, 0.55]], 32), m.black, { x: -34, y: 76.62, z: -29, cast: false }));
  return mergeByMaterial(g);
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
  // five-star base: tapered aluminium arms, each ending in a swivel fork and a twin-less caster
  for (let i = 0; i < 5; i++) {
    const arm = new THREE.Group();
    arm.rotation.y = (i / 5) * Math.PI * 2;
    arm.add(mesh(new THREE.CapsuleGeometry(1.75, 25, 6, 14), m.silver, { x: 14, y: 6.6, rz: Math.PI / 2 - 0.12 }));
    arm.add(mesh(new THREE.CylinderGeometry(1.0, 1.0, 2.6, 14), m.black, { x: 26.6, y: 4.5 }));
    arm.add(mesh(rbox(3.6, 0.9, 2.4, 0.4, 2), m.black, { x: 26.6, y: 3.2 }));
    arm.add(mesh(new THREE.CylinderGeometry(2.0, 2.0, 1.5, 22), m.rubber, { x: 26.6, y: 2.0, rx: Math.PI / 2, rz: Math.PI / 2 }));
    g.add(arm);
  }
  g.add(mesh(new THREE.CylinderGeometry(3.2, 3.8, 3, 28), m.silver, { y: 7.3 })); // hub
  // gas lift: polished column inside a black sleeve with a bellows collar
  g.add(mesh(new THREE.CylinderGeometry(1.9, 1.9, 30, 24), m.silver, { y: 23 }));
  g.add(mesh(new THREE.CylinderGeometry(2.9, 3.0, 17, 24), m.black, { y: 17.5 }));
  g.add(mesh(new THREE.CylinderGeometry(3.7, 3.1, 5, 28), m.silver, { y: 37.5 }));
  g.add(mesh(rbox(22, 4.2, 22, 1.8, 4), m.silver, { y: 41.6 })); // tilt mechanism
  g.add(mesh(new THREE.CylinderGeometry(1.2, 1.2, 4.5, 14), m.black, { x: 12.5, y: 40.5, rz: Math.PI / 2 })); // lever
  // seat cushion + a lighter piping seam
  g.add(mesh(slabGeo(51, 48, 7.5, 15, 3.0), m.seat, { y: 46.5, z: 1 }));
  g.add(mesh(slabGeo(51.5, 48.5, 0.5, 15, 0.2), m.fabricSage, { y: 45.0, z: 1, cast: false }));
  // wrap-around back shell, leaning back slightly + its spine
  g.add(mesh(arcBandGeo(36, 4.6, 0.86, 36, 1.4), m.seat, { y: 70, z: 12, rx: -0.1 }));
  g.add(mesh(rbox(5.4, 22, 3.2, 1.2, 4), m.silver, { y: 57.5, z: -24.5, rx: -0.1 }));
  return mergeByMaterial(g);
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
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), x = p.getX(i);
    p.setZ(i, (y / len) * (y / len) * 6 - Math.abs(x) * 0.12);
    uv.setXY(i, 0.5 + x / (wid * 2.2), y / (len * 1.05)); // vein texture: midrib along the length
  }
  geo.computeVertexNormals();
  return geo;
}

export function createFiddlePlant(m) {
  const g = new THREE.Group();
  // round oak plinth + a belly-shaped glazed pot
  g.add(mesh(lathe([[0, 0], [22.4, 0], [23.2, 0.7], [23.2, 3.0], [22.4, 3.7], [0, 3.7]], 64), m.oakSolid));
  g.add(mesh(lathe([
    [0, 0], [9.5, 0], [12.5, 0.9], [17.8, 9], [19.6, 18], [18.6, 27], [16.4, 33.5], [15.4, 35.2],
    [14.4, 35.2], [14.2, 34], [0, 33.6],
  ], 64), m.ceramic, { y: 3.7 }));
  g.add(mesh(new THREE.CylinderGeometry(14.6, 14.6, 0.9, 40), m.soil, { y: 3.7 + 33.8, cast: false }));

  // main trunk + two side stems that carry their own leaves
  const stems = [
    { pts: [[0, 36, 0], [3, 72, -1], [-1, 112, 2.5], [4, 156, 0]], r: 1.7, from: 0.22, count: 36, scale: 1 },
    { pts: [[0.5, 60, 0], [10, 84, 3], [18, 108, 5]], r: 0.9, from: 0.3, count: 12, scale: 0.8 },
    { pts: [[-0.5, 78, 0], [-11, 100, -2], [-17, 124, -4]], r: 0.85, from: 0.3, count: 10, scale: 0.78 },
  ];
  const geoBig = leafGeometry(31, 15), geoMid = leafGeometry(25, 12), geoSmall = leafGeometry(17, 8.5);
  const leafMats = [m.leafA, m.leafB, m.leafC, m.leafD, m.leafE];
  let li = 0;
  stems.forEach((st, si) => {
    const curve = new THREE.CatmullRomCurve3(st.pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    g.add(mesh(new THREE.TubeGeometry(curve, 28, st.r, 8), m.trunk));
    for (let i = 0; i < st.count; i++) {
      const t = st.from + (i / st.count) * (1 - st.from);
      const holder = new THREE.Group();
      holder.position.copy(curve.getPoint(t));
      holder.rotation.y = li * 2.4 + si * 1.3 + Math.sin(li * 1.7) * 0.3;
      const young = t > 0.82;
      const geo = young ? geoSmall : (li % 3 === 0 ? geoMid : geoBig);
      const matl = young ? m.leafD : leafMats[(li * 7 + si) % 5];
      const droop = THREE.MathUtils.lerp(1.15, 0.3, t) + Math.sin(li * 2.3) * 0.16;
      const leaf = mesh(geo, matl, { rx: droop, rz: Math.sin(li * 5.1) * 0.12 });
      leaf.scale.setScalar(THREE.MathUtils.lerp(1.15, 0.72, t) * st.scale * (0.86 + 0.28 * Math.abs(Math.sin(li * 3.1))));
      holder.add(leaf);
      g.add(holder);
      li++;
    }
  });
  const merged = mergeByMaterial(g);
  // river pebbles on the soil (instanced: one draw call)
  const pebbles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), m.pebble, 46);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  for (let i = 0; i < 46; i++) {
    const a = (i * 2.399) % (Math.PI * 2), rr = 5 + 9.2 * Math.sqrt(((i * 37) % 46) / 46);
    const s = 0.7 + ((i * 53) % 17) / 17 * 0.9;
    e.set(i * 0.7, i * 1.3, i * 0.2);
    q.setFromEuler(e);
    sc.set(s * 1.15, s * 0.62, s);
    ps.set(Math.cos(a) * rr, 3.7 + 34.1 + 0.15, Math.sin(a) * rr);
    pebbles.setMatrixAt(i, mtx.compose(ps, q, sc));
  }
  pebbles.receiveShadow = true;
  merged.add(pebbles);
  return merged;
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
  g.add(mesh(new THREE.CylinderGeometry(3.4, 2.6, 1.4, 24), m.silver, { y: 47.0 }));
  g.add(mesh(lathe([[0, 0], [20.4, 0], [21.6, 0.7], [21.6, 2.4], [20.4, 3.1], [0, 3.1]], 64), m.oakSolid, { y: 47.6 }));
  return mergeByMaterial(g);
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
  return mergeByMaterial(g);
}

// ── tall floor lamp: weighted disc, thin aluminium stem, frosted glowing globe ──
export function createFloorLamp(m) {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0, 0], [13.5, 0], [14.5, 0.6], [14.5, 1.6], [13.6, 2.2], [3.2, 2.5], [1.2, 3.0], [0, 3.0]], 48), m.metal));
  g.add(mesh(lathe([[13.2, 0.01], [14.2, 0.01], [14.3, 0.6], [13.3, 0.5]], 48), m.rubber)); // rubber foot ring
  g.add(mesh(new THREE.CylinderGeometry(0.75, 0.75, 148, 14), m.silver, { y: 77 }));
  g.add(mesh(new THREE.CylinderGeometry(2.6, 2.6, 2.4, 24), m.silver, { y: 4.2 })); // collar above the base
  g.add(mesh(new THREE.CylinderGeometry(3.4, 3.4, 1.6, 24), m.silver, { y: 149 })); // socket ring
  g.add(mesh(new THREE.CylinderGeometry(2.1, 3.0, 2.2, 24), m.silver, { y: 150.6 })); // socket cup
  const globe = mesh(new THREE.SphereGeometry(14, 48, 32), m.lamp, { y: 164, cast: false });
  globe.name = 'lampGlobe';
  const merged = mergeByMaterial(g);
  merged.add(globe);
  return merged;
}

/** n points evenly spaced (by arc length) round a rounded rectangle of half-sizes (hw, hd) and corner radius r. */
function roundedRectRing(hw, hd, r, n) {
  const dense = [];
  const corners = [[hw - r, hd - r, 0], [-(hw - r), hd - r, Math.PI / 2], [-(hw - r), -(hd - r), Math.PI], [hw - r, -(hd - r), Math.PI * 1.5]];
  corners.forEach(([cx, cz, a0]) => { for (let i = 0; i <= 12; i++) { const a = a0 + (i / 12) * (Math.PI / 2); dense.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } });
  dense.push(dense[0]);
  const len = [0];
  for (let i = 1; i < dense.length; i++) len.push(len[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = len[len.length - 1], out = [];
  let k = 1;
  for (let i = 0; i < n; i++) {
    const s = (i / n) * total;
    while (len[k] < s) k++;
    const f = (s - len[k - 1]) / (len[k] - len[k - 1] || 1);
    out.push([dense[k - 1][0] + (dense[k][0] - dense[k - 1][0]) * f, dense[k - 1][1] + (dense[k][1] - dense[k - 1][1]) * f]);
  }
  return out;
}

// ── pill-shaped upholstered bench on a recessed plinth ──
export function createBench(m, { length = 130, width = 42 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(slabGeo(length - 16, width - 14, 8, (width - 14) / 2, 1.2), m.black, { y: 4 }));
  g.add(mesh(slabGeo(length, width, 30, width / 2, 8), m.fabricWarm, { y: 23 }));
  // a single soft cushion near one end, with a stitched seam round its waist and two corner tufts
  const cx = -length / 2 + 26;
  g.add(mesh(smooth(rbox(30, 12, 28, 5.5, 6)), m.fabricSage, { x: cx, y: 43.2, z: 0, ry: 0.35, rz: 0.04 }));
  for (const [dx, dz] of [[-9.5, -8.5], [9.5, 8.5]]) {
    const c = Math.cos(0.35), s = Math.sin(0.35);
    g.add(mesh(new THREE.SphereGeometry(0.7, 10, 8), m.fabricWarm, { x: cx + dx * c + dz * s, y: 49.0, z: dz * c - dx * s, cast: false }));
  }
  const merged = mergeByMaterial(g);
  // stitching: a ring of thread beads round the cushion's waist (one instanced draw call)
  const N = 96;
  const stitches = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 6, 4), new THREE.MeshStandardMaterial({ color: 0xf3eee2, roughness: 0.8 }), N);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.35, 0.04, 'YXZ'));
  const mtx = new THREE.Matrix4(), sc = new THREE.Vector3(1.5, 0.45, 1.5), pp = new THREE.Vector3();
  roundedRectRing(15.1, 14.1, 5.5, N).forEach(([x, z], i) => {
    pp.set(x, 0, z).applyQuaternion(q);
    pp.x += cx;
    pp.y += 43.2;
    stitches.setMatrixAt(i, mtx.compose(pp, q, sc));
  });
  merged.add(stitches);
  return merged;
}

// ── floating oak shelf: books, a ceramic bowl, a stone cairn, a candle and a vase with dried stems ──
export function createShelf(m, { length = 112, depth = 20 } = {}) {
  const g = new THREE.Group();
  g.add(mesh(slabGeo(length, depth, 3.6, depth / 2, 1.1), m.oakSolid, { y: 0 }));
  const top = 1.8;
  const bookMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
  const spines = [0x6d7f9a, 0xc97b63, 0xe8dfcb, 0x3e5a4a, 0x2b2d33].map(bookMat);
  // a stack of three books lying down (colour on the spines, pale page edges)
  const book = (w, h, d, mat, x, y, z, ry) => {
    const b = new THREE.Group();
    b.position.set(x, y, z);
    b.rotation.y = ry;
    b.add(mesh(rbox(w, h, d, 0.35, 2), mat, { y: h / 2 }));
    b.add(mesh(rbox(w - 0.5, h - 0.7, d - 0.4, 0.18, 2), m.paper, { x: 0.35, y: h / 2, cast: false }));
    g.add(b);
  };
  book(26, 3.0, 18, spines[0], -33, top, 0, 0.06);
  book(23, 2.5, 16, spines[1], -32.4, top + 3.0, 0.4, -0.1);
  book(20, 2.0, 15, spines[2], -33.2, top + 5.5, -0.2, 0.14);
  // two upright books leaning on the stack
  book(2.6, 19, 14, spines[3], -17.4, top, 0.5, 0.0);
  book(2.2, 17.4, 13.4, spines[4], -14.8, top, 0.3, 0.05);
  g.add(mesh(lathe([[0, 0], [4.0, 0], [7.6, 3.0], [8.6, 5.2], [7.9, 5.2], [6.8, 3.4], [0, 0.9]], 40), m.ceramic, { x: 3.5, y: top, z: -1.5 }));
  // cairn: three smooth balanced stones
  [[2.4, 1.5, 0], [3.5, 1.9, 1.5], [2.8, 1.5, 3.4]].forEach(([r, h, y], i) => {
    const s = mesh(new THREE.SphereGeometry(1, 20, 14), m.pebble, { x: 18.5 + i * 0.15, y: top + y + h * 0.5, z: -3 + (i === 1 ? 0.4 : 0) });
    s.scale.set(r * 1.25, h, r * 1.1);
    g.add(s);
  });
  // candle in a small ceramic cup (the flame is its own object, ready for flicker / night glow)
  g.add(mesh(lathe([[0, 0], [2.4, 0], [3.2, 0.4], [3.4, 4.4], [3.1, 4.6], [2.8, 4.2], [0, 3.6]], 28), m.ceramic, { x: -9.8, y: top, z: 5.6 }));
  g.add(mesh(new THREE.CylinderGeometry(2.4, 2.4, 3.0, 24), m.paper, { x: -9.8, y: top + 2.1, z: 5.6 }));
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6), m.black, { x: -9.8, y: top + 3.9, z: 5.6, cast: false }));
  g.add(mesh(lathe([[0, 0], [3.6, 0], [5.4, 2.5], [5.6, 7], [3.6, 11], [2.7, 14], [3.0, 14.8], [2.0, 14.8], [0, 12]], 36), m.sage, { x: 33, y: top, z: 1 }));
  const stem = new THREE.CatmullRomCurve3([
    new THREE.Vector3(33, top + 13, 1), new THREE.Vector3(35, top + 24, 0.5), new THREE.Vector3(40, top + 33, 0),
  ]);
  g.add(mesh(new THREE.TubeGeometry(stem, 10, 0.3, 6), m.trunk));
  const tip = mesh(new THREE.SphereGeometry(1.9, 12, 10), m.dried, { x: 40, y: top + 34.2, z: 0 });
  tip.scale.set(0.8, 2.2, 0.8);
  g.add(tip);
  const merged = mergeByMaterial(g);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffc66a, toneMapped: false }));
  flame.scale.set(0.7, 1.7, 0.7);
  flame.position.set(-9.8, top + 5.0, 5.6);
  flame.name = 'candleFlame';
  merged.add(flame);
  return merged;
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
