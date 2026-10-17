// "Ori, Can You...?" — the small plants on the facades, as instanced meshes: window boxes, pots, bougainvillea that hangs down over a balcony, and a café
// chair. Each kind is two meshes: the LEAVES (fixed greens, a little wind) and the BLOOMS (tinted per instance: magenta, red, white). The instances arrive
// grouped by chunk of the neighbourhood so the ones behind the camera are not drawn.
import * as THREE from 'three';
import { GeoBuilder } from '../gfx.js';
import { mulberry32 } from '../../rng.js';

const GREENS = ['#2f6f3a', '#3c8546', '#4a9a52', '#2a6034', '#56a85c'];

/** A lumpy leaf mass: an icosphere with its vertices pushed around so it does not look like a ball. */
function lump(B, x, y, z, r, color, rnd, sway = 0, squash = 0.8) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = 1 + (Math.sin(v.x * 7.1 + v.y * 5.3) * Math.cos(v.z * 6.7 + v.x * 3.1)) * 0.18; // (the same lump for every vertex at the same spot: no cracks)
    nor.setXYZ(i, v.x, v.y / squash, v.z); // smooth shading: the normal of the sphere it came from
    pos.setXYZ(i, v.x * k, v.y * k * squash, v.z * k);
  }
  B.attr2 = sway;
  B.geometry(g, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(r, r, r)), color);
  B.attr2 = 0;
  g.dispose();
}

function blooms(B, list, color = '#ffffff') {
  const g = new THREE.OctahedronGeometry(1, 0);
  B.setColor(color);
  for (const [x, y, z, r, sway] of list) { B.attr2 = sway || 0; B.geometry(g, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(r, r * 0.8, r))); }
  B.attr2 = 0;
  g.dispose();
}

/** The geometries (leaves + blooms) of every kind. */
export function foliageGeometries(seed = 9) {
  const rnd = mulberry32(seed);
  const out = {};
  const green = () => GREENS[Math.floor(rnd() * GREENS.length)];
  // a window box / balcony planter: a low mound of leaves with flowers on top (width ~1 along x)
  {
    const L = new GeoBuilder(); const Bm = new GeoBuilder();
    for (let i = 0; i < 3; i++) lump(L, -0.3 + i * 0.3, 0.14 + rnd() * 0.06, (rnd() - 0.5) * 0.12, 0.26 + rnd() * 0.06, green(), rnd, 0.6);
    const fl = [];
    for (let i = 0; i < 7; i++) fl.push([-0.42 + rnd() * 0.84, 0.22 + rnd() * 0.16, (rnd() - 0.5) * 0.16, 0.05 + rnd() * 0.03, 0.8]);
    blooms(Bm, fl);
    out.box = { leaf: L.build({ extraName2: 'aSway' }), bloom: Bm.build({ extraName2: 'aSway' }) };
  }
  // a pot plant (a terracotta pot with a leafy top), height ~0.7
  {
    const L = new GeoBuilder(); const Bm = new GeoBuilder();
    const pot = new THREE.CylinderGeometry(0.17, 0.12, 0.26, 10);
    L.geometry(pot, new THREE.Matrix4().makeTranslation(0, 0.13, 0), '#b5603e');
    pot.dispose();
    for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.28 + rnd(); lump(L, Math.cos(a) * 0.1, 0.4 + rnd() * 0.1, Math.sin(a) * 0.1, 0.16 + rnd() * 0.05, green(), rnd, 0.9); }
    const fl = [];
    for (let i = 0; i < 6; i++) { const a = rnd() * 6.28; fl.push([Math.cos(a) * 0.17, 0.46 + rnd() * 0.18, Math.sin(a) * 0.17, 0.05, 1]); }
    blooms(Bm, fl);
    out.pot = { leaf: L.build({ extraName2: 'aSway' }), bloom: Bm.build({ extraName2: 'aSway' }) };
  }
  // bougainvillea hanging down over a rail: a cascade of leaf clumps with flowers all along it (hangs from y = 0 downwards, ~1.1 m)
  {
    const L = new GeoBuilder(); const Bm = new GeoBuilder();
    const fl = [];
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const x = (rnd() - 0.5) * 0.9 * (1 - t * 0.5);
      lump(L, x, -t * 1.0, 0.05 + rnd() * 0.08, 0.2 + rnd() * 0.08 - t * 0.04, green(), rnd, 0.3 + t * 0.7, 0.95);
      for (let k = 0; k < 2; k++) fl.push([x + (rnd() - 0.5) * 0.4, -t * 1.0 + (rnd() - 0.5) * 0.25, 0.14 + rnd() * 0.1, 0.055 + rnd() * 0.03, 0.4 + t * 0.6]);
    }
    blooms(Bm, fl);
    out.vine = { leaf: L.build({ extraName2: 'aSway' }), bloom: Bm.build({ extraName2: 'aSway' }) };
  }
  // a café chair (wood), ~0.85 high
  {
    const L = new GeoBuilder().setColor('#c79a62');
    L.box(-0.2, 0.43, -0.2, 0.2, 0.47, 0.2).box(-0.2, 0.47, -0.22, 0.2, 0.85, -0.18);
    L.setColor('#8a6a45');
    for (const x of [-0.18, 0.18]) for (const z of [-0.18, 0.18]) L.box(x - 0.02, 0, z - 0.02, x + 0.02, 0.43, z + 0.02);
    out.chair = { leaf: L.build({ extraName2: 'aSway' }), bloom: null };
  }
  return out;
}

/**
 * Builds the instanced meshes for a chunk's instances: [{ kind, x, y, z, rot, s, c }]. Returns the meshes (added to `group` by the caller).
 */
export function buildFoliage(list, geos, mats, { shadows = false } = {}) {
  const meshes = [];
  const byKind = {};
  for (const i of list) (byKind[i.kind] ||= []).push(i);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  for (const [kind, items] of Object.entries(byKind)) {
    const g = geos[kind];
    if (!g) continue;
    const mk = (geo, mat, tint) => {
      const im = new THREE.InstancedMesh(geo, mat, items.length);
      items.forEach((it, i) => {
        q.setFromAxisAngle(up, it.rot);
        m4.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(it.s, it.s, it.s));
        im.setMatrixAt(i, m4);
        if (tint) { col.set(it.c); im.setColorAt(i, col); }
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = shadows;
      im.receiveShadow = true;
      im.name = `foliage-${kind}${tint ? '-bloom' : ''}`;
      im.computeBoundingSphere();
      meshes.push(im);
    };
    mk(g.leaf, kind === 'chair' ? mats.wood : mats.leaf, false);
    if (g.bloom) mk(g.bloom, mats.bloom, true);
  }
  return meshes;
}
