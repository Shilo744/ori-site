// "Ori, Can You...?" — the street furniture: lamps, palms, park trees, parked cars, scooters, benches, beach umbrellas and the bus
// shelter. Every kind is ONE InstancedMesh (two where a part takes the paint colour and the rest does not), so ~500 props cost ~14 draw calls.
import * as THREE from 'three';
import { mulberry32 } from '../rng.js';
import { GeoBuilder } from './gfx.js';
import { groundHeight } from './map.js';
import { carGeometry } from './props-cars.js';
import { scooterGeometry, treeGeometry, plantGeometry, cafeSetGeometry, TREE_BLOBS } from './props-sdf.js';
import { palmGeometry, treeCards } from './vegetation.js';

const CAR_COLORS = [0xe9e6df, 0x2d3139, 0xb23a3a, 0x3b6ea8, 0xd8b441, 0x6b8f71, 0xa9adb5, 0x7a4f8f];
const SCOOTER_COLORS = [0xff6a3d, 0x2fb8d8, 0xf2c14e, 0x7be0a0];
const UMBRELLA_COLORS = [0xe5625e, 0xf2c14e, 0x4a90e2, 0x43b581];

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const sc = new THREE.Vector3();
const pos = new THREE.Vector3();

function matrix(x, y, z, rot, s = 1, sy = s) {
  q.setFromAxisAngle(up, rot);
  return m4.compose(pos.set(x, y, z), q, sc.set(s, sy, s));
}

// ── geometries ──
function lampGeos() {
  const pole = new GeoBuilder();
  const mat = new THREE.Matrix4();
  const part = (geo, x, y, z, color, rz = 0, sx = 1, sy = 1, sz = 1) => { mat.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rz)), new THREE.Vector3(sx, sy, sz)); pole.geometry(geo, mat, color); geo.dispose(); };
  part(new THREE.CylinderGeometry(0.07, 0.1, 5.2, 8), 0, 2.6, 0, '#3a3e46'); // a tapering pole
  part(new THREE.CylinderGeometry(0.17, 0.22, 0.34, 10), 0, 0.17, 0, '#30343b'); // the foot
  part(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10), 0, 0.38, 0, '#4b5058');
  // the curved arm: a few short pieces bending over
  const arm = [[0, 5.15], [0.18, 5.45], [0.46, 5.62], [0.8, 5.66]];
  for (let i = 0; i < arm.length - 1; i++) {
    const [x0, y0] = arm[i]; const [x1, y1] = arm[i + 1];
    const l = Math.hypot(x1 - x0, y1 - y0);
    part(new THREE.CylinderGeometry(0.045, 0.05, l, 8), (x0 + x1) / 2, (y0 + y1) / 2, 0, '#3a3e46', -Math.atan2(x1 - x0, y1 - y0));
  }
  // the housing: a rounded lantern with a shade
  part(new THREE.CylinderGeometry(0.12, 0.3, 0.14, 12), 0.88, 5.66, 0, '#2f333a');
  const head = new GeoBuilder().setColor('#fff2cf');
  const glass = new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  mat.compose(new THREE.Vector3(0.88, 5.6, 0), new THREE.Quaternion(), new THREE.Vector3(1, 0.7, 1));
  head.geometry(glass, mat, '#fff2cf');
  glass.dispose();
  return { pole: pole.build(), head: head.build() };
}

function palmGeos() {
  const trunk = new GeoBuilder();
  const segs = 7;
  let px = 0;
  let py = 0;
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 7, 1, true);
  const mat = new THREE.Matrix4();
  const lean = 0.2;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const r0 = 0.3 - 0.13 * t0;
    const r1 = 0.3 - 0.13 * t1;
    const x1 = lean * t1 * t1 * 2.2;
    const y1 = t1 * 6.2;
    const len = Math.hypot(x1 - px, y1 - py);
    const ang = Math.atan2(x1 - px, y1 - py);
    const g = new THREE.CylinderGeometry(r1, r0, len, 7, 1, true);
    mat.compose(new THREE.Vector3((px + x1) / 2, (py + y1) / 2, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -ang), new THREE.Vector3(1, 1, 1));
    trunk.geometry(g, mat, i % 2 ? 0x8a6a4a : 0x7d5f42);
    g.dispose();
    px = x1;
    py = y1;
  }
  cyl.dispose();
  const crownX = px;
  const crownY = py;
  const crown = new GeoBuilder();
  const fronds = 10;
  for (let k = 0; k < fronds; k++) {
    const a = (k / fronds) * Math.PI * 2 + (k % 2) * 0.2;
    frond(crown, crownX, crownY, a, 2.7 + (k % 3) * 0.35, 0.45 + (k % 2) * 0.25);
  }
  return { trunk: trunk.build(), crown: crown.build(), top: [crownX, crownY] };
}

/** One drooping palm leaf: a folded strip that rises, then falls. */
function frond(B, cx, cy, ang, len, rise) {
  const steps = 5;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  let prev = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const out = len * t;
    const y = cy + rise * Math.sin(Math.PI * Math.min(1, t * 0.9)) * 1.2 - t * t * len * 0.42;
    const w = 0.34 * (1 - t) * (0.5 + Math.sin(Math.PI * Math.min(1, t * 1.15)));
    const x = cx + ca * out;
    const z = sa * out;
    const sx = -sa * w;
    const sz = ca * w;
    const cur = { l: [x + sx, y + w * 0.35, z + sz], c: [x, y - 0.03, z], r: [x - sx, y + w * 0.35, z - sz] };
    if (prev) {
      const shade = 0.55 + 0.45 * t;
      B.setColor(new THREE.Color().setRGB(0.12 + 0.12 * shade, 0.36 + 0.22 * shade, 0.12 + 0.05 * shade));
      B.quad(prev.l, prev.c, cur.c, cur.l, 0, 1, 0);
      B.quad(prev.c, prev.r, cur.r, cur.c, 0, 1, 0);
    }
    prev = cur;
  }
}

function treeGeo() {
  const B = new GeoBuilder();
  const mat = new THREE.Matrix4();
  const trunk = new THREE.CylinderGeometry(0.14, 0.22, 2.4, 7);
  B.geometry(trunk, mat.makeTranslation(0, 1.2, 0), 0x6d5440);
  trunk.dispose();
  const blob = new THREE.IcosahedronGeometry(1, 1);
  for (const [x, y, z, r, c] of [[0, 3.4, 0, 1.7, 0x4f9a52], [0.9, 2.9, 0.4, 1.2, 0x5aa85a], [-0.8, 3.0, -0.5, 1.3, 0x46904c], [0.1, 4.3, 0.2, 1.1, 0x62b062]]) {
    B.geometry(blob, mat.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(r, r * 0.82, r)), c);
  }
  blob.dispose();
  return B.build();
}

function carGeos() {
  const body = new GeoBuilder().setColor('#ffffff');
  body.box(-2.1, 0.32, -0.88, 2.1, 0.95, 0.88); // lower body
  body.box(-1.2, 0.95, -0.8, 1.05, 1.45, 0.8); // cabin
  body.box(-1.9, 0.95, -0.84, -1.2, 1.08, 0.84); // boot lid
  const dark = new GeoBuilder().setColor('#1c1f26');
  for (const x of [-1.3, 1.3]) for (const z of [-0.8, 0.8]) dark.box(x - 0.34, 0.0, z - 0.1, x + 0.34, 0.68, z + 0.1);
  dark.setColor('#27313d');
  dark.box(-1.1, 0.98, -0.82, 0.95, 1.4, 0.82, { skip: {} }); // glass (a little proud of the cabin)
  dark.setColor('#ffdf9a').box(2.06, 0.55, -0.7, 2.14, 0.7, -0.42).box(2.06, 0.55, 0.42, 2.14, 0.7, 0.7);
  dark.setColor('#d33a3a').box(-2.14, 0.55, -0.7, -2.06, 0.7, -0.42).box(-2.14, 0.55, 0.42, -2.06, 0.7, 0.7);
  return { body: body.build(), dark: dark.build() };
}

function scooterGeos() {
  const body = new GeoBuilder().setColor('#ffffff');
  body.box(-0.15, 0.3, -0.2, 0.55, 0.52, 0.2); // deck + seat block
  body.box(-0.7, 0.2, -0.16, -0.1, 0.34, 0.16);
  const dark = new GeoBuilder().setColor('#1d1f24');
  dark.box(-0.78, 0.0, -0.09, -0.52, 0.34, 0.09).box(0.46, 0.0, -0.09, 0.72, 0.34, 0.09);
  dark.box(0.5, 0.34, -0.5, 0.58, 1.05, 0.5).box(0.5, 0.95, -0.55, 0.62, 1.05, 0.55);
  dark.setColor('#3a3f48').box(-0.1, 0.52, -0.16, 0.4, 0.62, 0.16);
  return { body: body.build(), dark: dark.build() };
}

function benchGeo() {
  const B = new GeoBuilder().setColor('#c79a62');
  B.box(-0.9, 0.42, -0.24, 0.9, 0.48, 0.24).box(-0.9, 0.72, -0.28, 0.9, 0.78, -0.2).box(-0.9, 0.55, -0.28, 0.9, 0.61, -0.2);
  B.setColor('#3f444d');
  B.box(-0.8, 0, -0.2, -0.7, 0.42, 0.2).box(0.7, 0, -0.2, 0.8, 0.42, 0.2).box(-0.8, 0.42, -0.3, -0.7, 0.9, -0.2).box(0.7, 0.42, -0.3, 0.8, 0.9, -0.2);
  return B.build();
}

function umbrellaGeos() {
  const pole = new GeoBuilder().setColor('#e9e6df').box(-0.03, 0, -0.03, 0.03, 2.3, 0.03);
  const top = new THREE.ConeGeometry(1.35, 0.5, 10);
  const cap = new GeoBuilder().setColor('#ffffff').geometry(top, new THREE.Matrix4().makeTranslation(0, 2.4, 0));
  top.dispose();
  return { pole: pole.build(), cap: cap.build() };
}

/** Builds every prop of the map. */
export function buildProps(map, { shadows = true, tier = 'high', lib } = {}) {
  const rnd = mulberry32(map.seed + 91);
  const group = new THREE.Group();
  group.name = 'props';
  const byType = {};
  for (const p of map.props) (byType[p.type] ||= []).push(p);
  const geos = [];
  const mats = [];
  const meshes = [];
  const gy = (p) => groundHeight(map, p.x, p.z);

  // one InstancedMesh per kind AND per chunk of the neighbourhood (so the ones behind the camera or out of the shadow box are never drawn)
  const instanced = (geo, material, list, place, { tint = null, name, cast = shadows } = {}) => {
    if (!list || !list.length) return null;
    const cells = new Map();
    for (const p of list) { const k = Math.floor(p.x / 72) + ',' + Math.floor(p.z / 72); (cells.get(k) || cells.set(k, []).get(k)).push(p); }
    let first = null;
    for (const [key, items] of cells) {
      const im = new THREE.InstancedMesh(geo, material, items.length);
      im.name = name + ':' + key;
      items.forEach((p, i) => {
        im.setMatrixAt(i, place(p));
        if (tint) im.setColorAt(i, new THREE.Color(tint(p, i)));
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = cast;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      group.add(im);
      meshes.push(im);
      first = first || im;
    }
    geos.push(geo);
    mats.push(material);
    return first;
  };
  const vc = (color = 0xffffff, rough = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, color, roughness: rough, metalness: 0, ...extra });

  const lg = lampGeos();
  instanced(lg.pole, vc(), byType.lamp, (p) => matrix(p.x, gy(p), p.z, 0), { name: 'lamp-poles' });
  const lampHeadMat = vc(0xffffff, 0.5, { emissive: new THREE.Color(0xffe2a0), emissiveIntensity: 0 });
  instanced(lg.head, lampHeadMat, byType.lamp, (p) => matrix(p.x, gy(p), p.z, 0), { name: 'lamp-heads', cast: false });

  // a warm pool of light under every street lamp (additive, only visible when the lamps are on)
  const poolTex = (() => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const g2 = c.getContext('2d');
    const gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.28)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = gr;
    g2.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  const poolGeo = new THREE.PlaneGeometry(7.5, 7.5);
  poolGeo.rotateX(-Math.PI / 2);
  const pools = instanced(poolGeo, poolMat, byType.lamp, (p) => matrix(p.x + 0.8, gy(p) + 0.04, p.z, 0), { name: 'lamp-pools', cast: false });
  void pools;
  mats.push(poolTex);

  // palms: two shapes, a bark trunk with scar rings and a crown of alpha-cut fronds (they sway)
  const palmScale = (p) => 0.85 + ((Math.sin(p.x * 12.9 + p.z * 78.2) * 43758.5) % 1 + 1) % 1 * 0.5;
  const barkMat = lib.std('bark', { vertexColors: true, normalScale: 1, wind: { amp: 0.06, speed: 1.1 } });
  const frondMat = lib.std('frond', { vertexColors: true, normalScale: 0, roughness: 0.8, wind: { amp: 0.28, speed: 1.9 }, extra: { side: THREE.DoubleSide, alphaTest: 0.5 } });
  const palmShapes = [palmGeometry(3), palmGeometry(11)];
  palmShapes.forEach((ps, k) => {
    const list = (byType.palm || []).filter((p) => (p.v + (p.x > 0 ? 1 : 0)) % 2 === k);
    instanced(ps.trunk, barkMat, list, (p) => matrix(p.x, gy(p), p.z, p.rot, palmScale(p)), { name: `palm-trunks${k}` });
    instanced(ps.crown, frondMat, list, (p) => matrix(p.x, gy(p), p.z, p.rot, palmScale(p)), { name: `palm-crowns${k}` });
  });
  mats.push(barkMat, frondMat);

  // trees: the smooth canopy plus leaf cards around it
  const tg = tier === 'low' ? treeGeo() : treeGeometry({ cell: tier === 'high' ? 0.26 : 0.36 });
  const canopyMat = lib.plain({ roughness: 0.75, wind: { amp: 0.04, speed: 1.3 }, leaf: true });
  const treePlace = (p) => matrix(p.x, gy(p), p.z, p.rot, 1 + (p.v % 3) * 0.12);
  instanced(tg, canopyMat, byType.tree, treePlace, { name: 'trees' });
  if (tier !== 'low') {
    const cardsMat = lib.std('leaves', { vertexColors: true, normalScale: 0, roughness: 0.75, wind: { amp: 0.09, speed: 1.6 }, extra: { side: THREE.DoubleSide, alphaTest: 0.5 } });
    instanced(treeCards(TREE_BLOBS, 5, tier === 'high' ? 260 : 120, 1.3), cardsMat, byType.tree, treePlace, { name: 'tree-cards' });
    mats.push(cardsMat, canopyMat);
  }

  // cars: three body shapes, a glossy clear-coated paint that mirrors the sky, wheels and lamps as a second mesh
  const CAR_KIND = ['hatch', 'sedan', 'hatch', 'van', 'sedan'];
  const carBody = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.12, envMapIntensity: 2.2 });
  lib.applyWet(carBody);
  mats.push(carBody);
  const carDetails = vc(0xffffff, 0.5, { metalness: 0.1 });
  for (const kind of ['hatch', 'sedan', 'van']) {
    const list = (byType.car || []).filter((p) => CAR_KIND[p.v % CAR_KIND.length] === kind);
    if (!list.length) continue;
    const cg = tier === 'low' ? carGeos() : (() => { const c = carGeometry({ cell: tier === 'high' ? 0.2 : 0.28, kind }); return { body: c.body, dark: c.details }; })();
    instanced(cg.body, carBody, list, (p) => matrix(p.x, 0, p.z, p.rot), { tint: (p) => CAR_COLORS[p.v % CAR_COLORS.length], name: `car-bodies-${kind}` });
    instanced(cg.dark, carDetails, list, (p) => matrix(p.x, 0, p.z, p.rot), { name: `car-details-${kind}`, cast: false });
  }

  const sg = tier === 'low' ? scooterGeos() : (() => { const c = scooterGeometry({ cell: tier === 'high' ? 0.04 : 0.06 }); return { body: c.body, dark: c.details }; })();
  instanced(sg.body, vc(0xffffff, 0.45), byType.scooter, (p) => matrix(p.x, gy(p), p.z, p.rot, 1.2), { tint: (p) => SCOOTER_COLORS[p.v % SCOOTER_COLORS.length], name: 'scooter-bodies' });
  instanced(sg.dark, vc(0xffffff, 0.6), byType.scooter, (p) => matrix(p.x, gy(p), p.z, p.rot, 1.2), { name: 'scooter-details' });

  instanced(benchGeo(), vc(), byType.bench, (p) => matrix(p.x, gy(p), p.z, p.rot), { name: 'benches' });

  // (the beach parasols are made by beach3d.js)

  // dressing at the doors: a bougainvillea pot either side of every building door, and a few cafe tables out in front of the cafe
  if (tier !== 'low') {
    const plants = [];
    const sets = [];
    for (const pl of Object.values(map.places)) {
      if (pl.kind !== 'building') continue;
      const d = pl.door;
      const tx = -d.nz; const tz = d.nx; // along the facade
      for (const s of [-1, 1]) plants.push({ x: d.x + d.nx * 1.0 + tx * s * 1.9, z: d.z + d.nz * 1.0 + tz * s * 1.9, rot: (pl.id.length * 1.7 + s) % 6.28, v: s });
      if (pl.id === 'cafe') for (const s of [-1.4, 1.4, 4.2]) sets.push({ x: d.x + d.nx * 2.7 + tx * s * 1.7, z: d.z + d.nz * 2.7 + tz * s * 1.7, rot: Math.atan2(d.nx, d.nz) + Math.PI / 2 });
    }
    instanced(plantGeometry({ cell: tier === 'high' ? 0.05 : 0.07 }), vc(0xffffff, 0.8), plants, (p) => matrix(p.x, groundHeight(map, p.x, p.z), p.z, p.rot, 1.0 + 0.1 * p.v), { name: 'door-plants', cast: false });
    instanced(cafeSetGeometry({ cell: tier === 'high' ? 0.045 : 0.06 }), vc(0xffffff, 0.6), sets, (p) => matrix(p.x, groundHeight(map, p.x, p.z), p.z, p.rot, 1.35), { name: 'cafe-sets', cast: false });
  }

  // the bus shelter (one of a kind)
  {
    const r = map.places.busstop.rect;
    const B = new GeoBuilder().setColor('#4a4f58');
    const y = groundHeight(map, r.x0, r.z0);
    B.box(r.x0, y, r.z0, r.x0 + 0.1, y + 2.5, r.z0 + 0.1).box(r.x1 - 0.1, y, r.z0, r.x1, y + 2.5, r.z0 + 0.1);
    B.box(r.x0 - 0.2, y + 2.5, r.z0 - 0.25, r.x1 + 0.2, y + 2.62, r.z1 + 0.25);
    B.setColor('#c79a62').box(r.x0 + 0.4, y + 0.42, r.z0 + 0.12, r.x1 - 0.4, y + 0.5, r.z0 + 0.6);
    B.setColor('#4a90e2').box(r.x1 + 0.2, y + 0.0, r.z0 + 0.4, r.x1 + 0.3, y + 3.0, r.z0 + 0.5);
    const shelter = new THREE.Mesh(B.build(), vc());
    shelter.castShadow = shadows;
    group.add(shelter);
    geos.push(shelter.geometry);
    mats.push(shelter.material);
    const glass = new THREE.Mesh(new GeoBuilder().setColor('#bfe6f2').box(r.x0 + 0.1, y + 0.5, r.z0 + 0.02, r.x1 - 0.1, y + 2.5, r.z0 + 0.06).build(), new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.35, roughness: 0.1 }));
    group.add(glass);
    geos.push(glass.geometry);
    mats.push(glass.material);
  }
  void rnd;

  return {
    group,
    /** lamps: 0..1 street light level. */
    setLight({ lamps }) { lampHeadMat.emissiveIntensity = lamps * 2.2; poolMat.opacity = lamps * 0.42; },
    stats: { meshes: meshes.length, instances: map.props.length },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); meshes.forEach((m) => m.dispose()); },
  };
}
