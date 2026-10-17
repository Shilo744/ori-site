// "Ori, Can You...?" — palms and the leafy edge of the trees. A palm is a curved trunk with scar rings (one bark texture) and a crown of arching fronds, each
// a ribbon with an alpha cut-out of leaflets (so the silhouette against the sky is feathery, not a green blob). A tree's smooth canopy (props-sdf.js) gets a
// scatter of leaf-cluster cards around its surface. Both come out as plain BufferGeometries with uv, vertex colour and a wind weight (aSway), ready to instance.
import * as THREE from 'three';
import { mulberry32 } from '../rng.js';
import { GeoBuilder } from './gfx.js';

/** A curved, tapering trunk: a ring of `radial` points at every height, uv wraps once around and every 0.55 m up. Returns { geometry, top: [x, y] }. */
function trunk(seed, { height = 6.2, lean = 0.2, r0 = 0.3, r1 = 0.15, segs = 8, radial = 7 } = {}) {
  const rnd = mulberry32(seed);
  const pos = []; const nor = []; const uv = []; const col = []; const idx = []; const sway = [];
  const bend = lean + (rnd() - 0.5) * 0.15;
  const ringAt = (t) => {
    const y = t * height;
    const x = bend * t * t * 2.2;
    const z = Math.sin(t * 2.2 + seed) * 0.06 * t;
    return { x, y, z, r: r0 + (r1 - r0) * t + (t < 0.08 ? (0.08 - t) * 0.9 : 0) };
  };
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = ringAt(t);
    for (let k = 0; k <= radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      const nx = Math.cos(a); const nz = Math.sin(a);
      pos.push(c.x + nx * c.r, c.y, c.z + nz * c.r);
      nor.push(nx, 0.1, nz);
      uv.push(k / radial, (c.y / 0.55));
      const v = 0.92 + 0.12 * Math.sin(c.y * 9 + k);
      col.push(v, v, v);
      sway.push(t * 0.15);
    }
  }
  for (let i = 0; i < segs; i++) for (let k = 0; k < radial; k++) {
    const a = i * (radial + 1) + k;
    const b = a + radial + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  const top = ringAt(1);
  return { geometry: g, top: [top.x, top.y, top.z] };
}

/** One arching frond: a three-wide ribbon (a fold down the middle) along an arc; uv.x across, uv.y along the leaf. */
function frond(B, cx, cy, cz, ang, len, rise, droop, width, shade) {
  const segs = 5;
  const ca = Math.cos(ang); const sa = Math.sin(ang);
  const side = [-sa, 0, ca];
  const color = (t) => { const k = shade * (0.78 + 0.22 * (1 - t * 0.5)); return [0.5 * k + 0.38, 0.62 * k + 0.4, 0.4 * k + 0.2]; };
  let prev = null;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const out = len * t;
    const y = cy + rise * Math.sin(Math.PI * Math.min(1, t * 0.62)) * 1.15 - droop * t * t * len;
    const x = cx + ca * out; const z = cz + sa * out;
    const w = width * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.95)));
    const fold = 0.1 * w;
    const cur = [[x - side[0] * w, y + fold, z - side[2] * w], [x, y - fold * 0.2, z], [x + side[0] * w, y + fold, z + side[2] * w]];
    if (prev) {
      const c0 = color((i - 1) / segs);
      const c1 = color(t);
      const sw0 = (i - 1) / segs; const sw1 = t;
      const add = (a, b, cc, d, ua, ub) => {
        const i0 = B.count;
        const vs = [[a, ua, 0, c0, sw0], [b, ub, 0, c0, sw0], [cc, ub, 1, c1, sw1], [d, ua, 1, c1, sw1]];
        vs.forEach(([p, u, , cl, sw], k) => { B.color = cl; B.attr2 = sw; B.vert(p[0], p[1], p[2], 0, 1, 0, u, k < 2 ? (i - 1) / segs : t); });
        B.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
      };
      add(prev[0], prev[1], cur[1], cur[0], 0, 0.5);
      add(prev[1], prev[2], cur[2], cur[1], 0.5, 1);
    }
    prev = cur;
  }
  B.attr2 = 0;
}

/** A palm: { trunk, crown } geometries (crown = alpha-cut fronds + a few coconuts). seed varies the lean and the fronds. */
export function palmGeometry(seed = 1) {
  const rnd = mulberry32(seed * 131 + 7);
  const t = trunk(seed, { lean: 0.16 + rnd() * 0.18 });
  const [tx, ty, tz] = t.top;
  const B = new GeoBuilder();
  const n = 12;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rnd() * 0.3;
    const high = k % 3 === 0;
    frond(B, tx, ty - 0.05, tz, a, 2.5 + rnd() * 0.9, (high ? 0.95 : 0.5) + rnd() * 0.3, high ? 0.11 : 0.2 + rnd() * 0.07, 0.62, 0.7 + rnd() * 0.4);
  }
  const crown = B.build({ extraName2: 'aSway' });
  // coconuts: a few brown spheres under the crown (a separate little geometry merged into the trunk)
  const nuts = new THREE.IcosahedronGeometry(0.13, 0);
  const pos = nuts.attributes.position;
  const geo = t.geometry;
  const merged = mergeTrunkWithNuts(geo, nuts, tx, ty, tz, rnd);
  void pos;
  return { trunk: merged, crown };
}

function mergeTrunkWithNuts(trunkGeo, nutGeo, tx, ty, tz, rnd) {
  const parts = [trunkGeo.toNonIndexed()];
  for (let i = 0; i < 3; i++) {
    const a = rnd() * 6.28;
    const g = nutGeo.clone().toNonIndexed();
    g.translate(tx + Math.cos(a) * 0.2, ty - 0.2 - rnd() * 0.12, tz + Math.sin(a) * 0.2);
    const n = g.attributes.position.count;
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    const c = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { c[k * 3] = 0.34; c[k * 3 + 1] = 0.24; c[k * 3 + 2] = 0.12; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(new Float32Array(n).fill(0.1), 1));
    parts.push(g);
  }
  let total = 0;
  for (const p of parts) total += p.attributes.position.count;
  const out = new THREE.BufferGeometry();
  const mk = (name, size) => { const arr = new Float32Array(total * size); let o = 0; for (const p of parts) { arr.set(p.attributes[name].array, o); o += p.attributes[name].array.length; } out.setAttribute(name, new THREE.BufferAttribute(arr, size)); };
  mk('position', 3); mk('normal', 3); mk('uv', 2); mk('color', 3); mk('aSway', 1);
  out.computeBoundingSphere();
  return out;
}

/**
 * Leaf-cluster cards around the crown of a tree (blobs = [[x, y, z, r], ...] as the SDF tree is made from): each card lies on the surface of a blob,
 * facing outwards, so the smooth canopy gets a leafy, broken outline. Returns a geometry with uv, vertex colour (sun-lit tops, shaded undersides) and aSway.
 */
export function treeCards(blobs, seed = 3, count = 150, size = 1.15) {
  const rnd = mulberry32(seed);
  const B = new GeoBuilder();
  const totalR = blobs.reduce((a, b) => a + b[3], 0);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    let pick = rnd() * totalR;
    let b = blobs[0];
    for (const c of blobs) { pick -= c[3]; if (pick <= 0) { b = c; break; } }
    // a direction on the sphere, biased upwards a little
    const a = rnd() * 6.283;
    const e = Math.asin(rnd() * 1.7 - 0.7);
    v.set(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
    const r = b[3] * (0.96 + rnd() * 0.12);
    const cx = b[0] + v.x * r; const cy = b[1] + v.y * r; const cz = b[2] + v.z * r;
    // tangent frame
    const up = Math.abs(v.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const t1 = new THREE.Vector3().crossVectors(up, v).normalize();
    const t2 = new THREE.Vector3().crossVectors(v, t1);
    const rot = rnd() * 6.283;
    const s = size * (0.7 + rnd() * 0.6) * 0.5;
    const ax = t1.clone().multiplyScalar(Math.cos(rot) * s).addScaledVector(t2, Math.sin(rot) * s);
    const ay = t2.clone().multiplyScalar(Math.cos(rot) * s).addScaledVector(t1, -Math.sin(rot) * s);
    const sun = 0.55 + 0.45 * Math.max(0, v.y);
    const tone = 0.72 + rnd() * 0.4;
    B.color = [0.5 * sun * tone + 0.12, 0.74 * sun * tone + 0.14, 0.42 * sun * tone + 0.05];
    B.attr2 = 0.4 + rnd() * 0.5;
    const p = (sx, sy) => [cx + ax.x * sx + ay.x * sy, cy + ax.y * sx + ay.y * sy, cz + ax.z * sx + ay.z * sy];
    B.quad(p(-1, -1), p(1, -1), p(1, 1), p(-1, 1), v.x, v.y, v.z);
  }
  B.attr2 = 0;
  return B.build({ extraName2: 'aSway' });
}
