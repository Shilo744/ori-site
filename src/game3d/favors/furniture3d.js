// "Ori, Can You...?" — the little things that make a pavement look lived in: litter bins, bike racks with bikes leaning on them, A-frame menu boards, the cafe's big
// parasols and its string of warm bulbs (they come on at dusk), and the fountain's spray. Everything is placed along the walls of the buildings (never in the middle
// of a walk), deterministic from the map, drawn as a few instanced meshes.
import * as THREE from 'three';
import { mulberry32 } from '../rng.js';
import { GeoBuilder } from './gfx.js';
import { groundHeight, KERB } from './map.js';

const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const V = new THREE.Vector3();
const S = new THREE.Vector3();
const E = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);
function put(B, geo, x, y, z, color, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  M.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz));
  B.geometry(geo, M, color);
}

function binGeometry() {
  const B = new GeoBuilder();
  const cyl = new THREE.CylinderGeometry(0.26, 0.22, 0.85, 14);
  put(B, cyl, 0, 0.45, 0, '#4a6a5a');
  const lid = new THREE.CylinderGeometry(0.28, 0.28, 0.06, 14);
  put(B, lid, 0, 0.9, 0, '#2f3a36');
  const band = new THREE.CylinderGeometry(0.265, 0.265, 0.08, 14);
  put(B, band, 0, 0.5, 0, '#d6c25a');
  const hole = new THREE.CylinderGeometry(0.1, 0.1, 0.02, 10);
  put(B, hole, 0.1, 0.935, 0, '#111');
  [cyl, lid, band, hole].forEach((g) => g.dispose());
  return B.build();
}

/** A bike: two wheels (rings), a frame, bars, a saddle and a basket; rests leaning along z. The frame colour takes the instance colour. */
function bikeParts() {
  const frame = new GeoBuilder().setColor('#ffffff');
  const dark = new GeoBuilder().setColor('#222');
  const ring = new THREE.TorusGeometry(0.33, 0.022, 4, 12);
  for (const z of [-0.5, 0.5]) { put(dark, ring, 0, 0.34, z, '#25272c', { ry: Math.PI / 2 }); }
  const rod = (a, b, r = 0.016) => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const g = new THREE.CylinderGeometry(r, r, l, 5);
    M.compose(V.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), Q.setFromUnitVectors(UP, new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize()), S.set(1, 1, 1));
    frame.geometry(g, M, '#ffffff');
    g.dispose();
  };
  rod([0, 0.34, -0.5], [0, 0.62, -0.1]); rod([0, 0.62, -0.1], [0, 0.34, 0.5]); rod([0, 0.34, -0.5], [0, 0.66, -0.5 + 0.1]);
  rod([0, 0.62, -0.1], [0, 0.66, 0.38]); rod([0, 0.34, 0.5], [0, 0.78, 0.46]); rod([-0.22, 0.8, 0.46], [0.22, 0.8, 0.46], 0.014);
  dark.box(-0.05, 0.64, -0.2, 0.05, 0.69, 0.02); // the saddle
  dark.box(-0.15, 0.72, 0.52, 0.15, 0.95, 0.76); // a basket on the front
  ring.dispose();
  return { frame: frame.build(), dark: dark.build() };
}

function rackGeometry() {
  const B = new GeoBuilder().setColor('#6a6e75');
  for (let i = 0; i < 4; i++) { const z = (i - 1.5) * 0.5; B.box(-0.02, 0, z - 0.012, 0.02, 0.7, z + 0.012); B.box(-0.02, 0.7, z - 0.012, 0.02, 0.74, z + 0.24); B.box(-0.02, 0.0, z - 0.012, 0.02, 0.03, z + 0.24); }
  return B.build();
}

function boardGeometry() {
  const B = new GeoBuilder();
  B.setColor('#2c3a34');
  for (const s of [-1, 1]) {
    const m = new THREE.BoxGeometry(0.5, 0.78, 0.035);
    M.compose(V.set(0, 0.4, s * 0.17), Q.setFromEuler(E.set(-s * 0.24, 0, 0)), S.set(1, 1, 1));
    B.geometry(m, M, '#2c3a34');
    m.dispose();
  }
  B.setColor('#c79a62');
  // the frame of the face and a few chalk lines of "menu"
  for (const [y, w] of [[0.62, 0.3], [0.52, 0.34], [0.44, 0.22], [0.3, 0.32], [0.22, 0.26]]) B.box(-w / 2, y, 0.185, w / 2, y + 0.02, 0.19);
  B.setColor('#f2efe6');
  for (const [y, w] of [[0.62, 0.3], [0.52, 0.34], [0.44, 0.22], [0.3, 0.32], [0.22, 0.26]]) B.box(-w / 2, y, 0.19, w / 2, y + 0.016, 0.194);
  return B.build();
}

function parasolGeometry() {
  const tint = new GeoBuilder();
  const n = 8; const R = 1.85;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2; const a1 = ((i + 1) / n) * Math.PI * 2;
    tint.setColor(i % 2 ? '#fbf6ea' : '#d0693f');
    const top = [0, 3.0, 0];
    const p0 = [Math.cos(a0) * R, 2.45, Math.sin(a0) * R]; const p1 = [Math.cos(a1) * R, 2.45, Math.sin(a1) * R];
    const am = (a0 + a1) / 2;
    tint.quad(top, p0, p1, p1, Math.cos(am) * 0.5, 0.85, Math.sin(am) * 0.5);
    tint.quad(p0, [Math.cos(am) * R * 1.03, 2.27, Math.sin(am) * R * 1.03], p1, p1, Math.cos(am), 0.2, Math.sin(am));
  }
  tint.setColor('#cfd3d8').box(-0.03, 0, -0.03, 0.03, 2.9, 0.03);
  return tint.build();
}

export function buildFurniture(map, { lib, shadows = true, tier = 'high' } = {}) {
  const rnd = mulberry32(map.seed * 19 + 7);
  const group = new THREE.Group();
  group.name = 'furniture';
  const disposables = [];
  const mats = [];
  const vc = (rough = 0.7, extra = {}) => { const m = lib.plain({ roughness: rough, ...extra }); mats.push(m); return m; };
  const mk = (geo, mat, list, name, { tint = null, cast = shadows } = {}) => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    const c = new THREE.Color();
    list.forEach((it, i) => {
      M.compose(V.set(it.x, it.y ?? groundHeight(map, it.x, it.z), it.z), Q.setFromAxisAngle(UP, it.ry || 0), S.set(it.s || 1, it.s || 1, it.s || 1));
      im.setMatrixAt(i, M);
      if (tint) im.setColorAt(i, c.set(it.c));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = cast; im.receiveShadow = true; im.name = name;
    im.computeBoundingSphere();
    group.add(im);
    disposables.push(geo);
    return im;
  };

  // along the walls of the buildings: bins at corners, bike racks and boards at the shops
  const bins = []; const racks = []; const bikes = []; const boards = [];
  const BIKE_COLORS = ['#e5625e', '#2f9fd0', '#f2c14e', '#43b581', '#ff8a3d', '#8e6cd6'];
  for (const lot of map.lots) {
    if (lot.id === 'kiosk') continue;
    const r = lot.rect;
    // the street side: the wall runs along (tx, tz); the street is in the direction (nx, nz)
    const n = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] }[lot.side];
    const t = [-n[1], n[0]];
    const len = n[0] === 0 ? r.x1 - r.x0 : r.z1 - r.z0;
    const cx = n[0] === 0 ? (r.x0 + r.x1) / 2 : (n[0] > 0 ? r.x1 : r.x0);
    const cz = n[1] === 0 ? (r.z0 + r.z1) / 2 : (n[1] > 0 ? r.z1 : r.z0);
    const at = (s, out) => [cx + t[0] * s + n[0] * out, cz + t[1] * s + n[1] * out];
    const place = lot.named ? map.places[lot.id] : null;
    if (rnd() < 0.55) { const s = len * (0.5 + (rnd() < 0.5 ? -1 : 1) * (0.28 + rnd() * 0.12)); const [x, z] = at(s, 0.4); bins.push({ x, z, ry: rnd() * 6 }); }
    if (rnd() < 0.5 && len > 10) {
      const s = len * (0.5 + (rnd() < 0.5 ? -1 : 1) * 0.3);
      const [x, z] = at(s, 0.55);
      const ry = Math.atan2(t[0], t[1]);
      racks.push({ x, z, ry });
      const k = 1 + Math.floor(rnd() * 3);
      for (let i = 0; i < k; i++) { const [bx, bz] = at(s + (i - (k - 1) / 2) * 0.55 * 1.0, 0.6); bikes.push({ x: bx, z: bz, ry: ry + Math.PI / 2 + (rnd() - 0.5) * 0.25, c: BIKE_COLORS[Math.floor(rnd() * BIKE_COLORS.length)], s: 1 }); }
    }
    if (place && (lot.id === 'cafe' || lot.id === 'studio' || lot.id === 'sidegig' || lot.id === 'startup' || lot.id === 'perach')) {
      const [x, z] = at(len / 2 + 2.6, 1.0);
      boards.push({ x, z, ry: Math.atan2(n[0], n[1]) });
    }
  }
  mk(binGeometry(), vc(0.6), bins, 'bins', { cast: false });
  mk(rackGeometry(), vc(0.5, { metalness: 0.5 }), racks, 'bike-racks', { cast: false });
  const bp = bikeParts();
  mk(bp.frame, vc(0.4, { metalness: 0.3 }), bikes, 'bike-frames', { tint: true, cast: false });
  mk(bp.dark, vc(0.6), bikes, 'bike-parts', { cast: false });
  mk(boardGeometry(), vc(0.8), boards, 'menu-boards', { cast: false });

  // the cafe terrace: parasols over the tables and a string of warm bulbs
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: new THREE.Color(0xffc870), emissiveIntensity: 0.0, roughness: 0.4 });
  mats.push(bulbMat);
  {
    const cafe = map.places.cafe;
    const d = cafe.door;
    const tx = -d.nz; const tz = d.nx;
    const sets = [-1.4, 1.4, 4.2].map((s) => ({ x: d.x + d.nx * 2.7 + tx * s * 1.7, z: d.z + d.nz * 2.7 + tz * s * 1.7 }));
    const parasols = sets.slice(0, 2).map((p, i) => ({ x: p.x, z: p.z + (i ? 0.0 : 0.0), ry: i * 0.4, s: 1 }));
    mk(parasolGeometry(), vc(0.8, { extra: { side: THREE.DoubleSide } }), parasols, 'cafe-parasols');
    // string lights: bulbs along two sagging cords from the awning edge out to the street lamp row
    const bulbs = [];
    const cordPts = [];
    const w = cafe.rect;
    const along = d.nx !== 0 ? [w.z0 + 1.2, w.z1 - 1.2] : [w.x0 + 1.2, w.x1 - 1.2];
    for (const row of [0, 1]) {
      const out = 2.4 + row * 1.4;
      const N = 18;
      let prev = null;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const s = along[0] + (along[1] - along[0]) * u;
        const sag = -Math.sin(((u * 3) % 1) * Math.PI) * 0.3; // three swags between the posts
        const x = d.nx !== 0 ? d.fx + d.nx * out : s;
        const z = d.nx !== 0 ? s : d.fz + d.nz * out;
        const y = 3.5 - row * 0.15 + sag;
        bulbs.push({ x, y: y - 0.05, z, s: 1 });
        if (prev) cordPts.push(prev[0], prev[1] + 0.05, prev[2], x, y + 0.05, z);
        prev = [x, y, z];
      }
    }
    const bulbGeo = new THREE.SphereGeometry(0.055, 8, 6);
    const bm = new THREE.InstancedMesh(bulbGeo, bulbMat, bulbs.length);
    bulbs.forEach((b, i) => { M.compose(V.set(b.x, b.y, b.z), Q.identity(), S.set(1, 1, 1)); bm.setMatrixAt(i, M); });
    bm.name = 'string-lights'; bm.castShadow = false;
    group.add(bm);
    disposables.push(bulbGeo);
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cordPts, 3));
    const cm = new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x22242a }));
    cm.name = 'string-cords';
    group.add(cm);
    disposables.push(cg);
    mats.push(cm.material);
  }

  void tier; void KERB;
  return {
    group,
    stats: { bins: bins.length, racks: racks.length, bikes: bikes.length, boards: boards.length },
    /** lamps: 0..1 street light level: the bulbs glow when it gets dark. */
    setLight({ lamps }) { bulbMat.emissiveIntensity = 0.15 + lamps * 3.2; },
    dispose() { disposables.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); }); },
  };
}
