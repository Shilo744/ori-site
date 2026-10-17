// The surface-nets mesher and the distance functions behind the characters (pure).      node scripts/test-favors-sdf.mjs
import assert from 'node:assert/strict';
import { meshSDF, meshStats, smin, smax, sdSphere, sdEllipsoid, sdCapsule, sdRoundBox, length3 } from '../src/game3d/favors/sdf.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ''} ${a} !≈ ${b} (±${eps})`);

const sphere = (r) => (x, y, z) => sdSphere(x, y, z, 0, 0, 0, r);
const box = (m) => ({ min: [-m, -m, -m], max: [m, m, m] });

test('distance functions: sphere, ellipsoid, capsule and rounded box have the right sign and size', () => {
  near(sdSphere(2, 0, 0, 0, 0, 0, 1), 1, 1e-9);
  assert.ok(sdSphere(0.5, 0, 0, 0, 0, 0, 1) < 0);
  near(sdEllipsoid(2, 0, 0, 0, 0, 0, 1, 2, 3), 1, 0.05, 'ellipsoid distance on its x axis');
  assert.ok(sdEllipsoid(0, 1.9, 0, 0, 0, 0, 1, 2, 3) < 0 && sdEllipsoid(0, 2.1, 0, 0, 0, 0, 1, 2, 3) > 0);
  near(sdCapsule(0.5, 1, 0, 0, 0, 0, 0, 2, 0, 0.1), 0.4, 1e-9);
  near(sdCapsule(0, 3, 0, 0, 0, 0, 0, 2, 0, 0.1), 0.9, 1e-9);
  near(sdRoundBox(2, 0, 0, 0, 0, 0, 1, 1, 1, 0.2), 1, 1e-9);
  assert.ok(sdRoundBox(0.5, 0.5, 0.5, 0, 0, 0, 1, 1, 1, 0.2) < 0);
});
test('smin blends: never above the plain minimum, equal far from the blend, smooth in between; smax is the mirror', () => {
  assert.ok(smin(1, 1, 0.5) < 1);
  near(smin(0, 3, 0.5), 0, 1e-9);
  near(smin(3, 0, 0.5), 0, 1e-9);
  for (let a = -1; a <= 1; a += 0.25) for (let b = -1; b <= 1; b += 0.25) { assert.ok(smin(a, b, 0.4) <= Math.min(a, b) + 1e-12); assert.ok(smax(a, b, 0.4) >= Math.max(a, b) - 1e-12); near(smin(a, b, 0.4), smin(b, a, 0.4), 1e-12); }
});
test('a sphere becomes a closed, manifold mesh whose area, size and normals are right', () => {
  const m = meshSDF(sphere(1), { ...box(1.3), cell: 0.1 });
  assert.ok(m.vertexCount > 500 && m.triangleCount > 1000);
  const st = meshStats(m);
  assert.equal(st.open, 0, 'no open edges');
  assert.equal(st.nonManifold, 0, 'no edge shared by three faces');
  near(st.area, 4 * Math.PI, 4 * Math.PI * 0.04, 'surface area');
  for (let v = 0; v < m.vertexCount; v++) {
    const x = m.positions[v * 3]; const y = m.positions[v * 3 + 1]; const z = m.positions[v * 3 + 2];
    near(length3(x, y, z), 1, 0.06, 'vertex radius');
    const nx = m.normals[v * 3]; const ny = m.normals[v * 3 + 1]; const nz = m.normals[v * 3 + 2];
    near(length3(nx, ny, nz), 1, 1e-4, 'unit normal');
    assert.ok(nx * x + ny * y + nz * z > 0.9, 'normal points outwards');
  }
});
test('the triangles wind outwards (the face normal agrees with the gradient normal)', () => {
  for (const [name, f, o] of [['sphere', sphere(1), box(1.3)], ['ellipsoid', (x, y, z) => sdEllipsoid(x, y, z, 0, 0, 0, 0.6, 1, 0.8), { min: [-1, -1.3, -1], max: [1, 1.3, 1] }], ['capsule', (x, y, z) => sdCapsule(x, y, z, 0, -0.5, 0, 0, 0.5, 0, 0.3), { min: [-0.6, -1, -0.6], max: [0.6, 1, 0.6] }]]) {
    const m = meshSDF(f, { ...o, cell: 0.08 });
    let bad = 0;
    for (let t = 0; t < m.indices.length; t += 3) {
      const [a, b, c] = [m.indices[t], m.indices[t + 1], m.indices[t + 2]];
      const p = m.positions;
      const ux = p[b * 3] - p[a * 3]; const uy = p[b * 3 + 1] - p[a * 3 + 1]; const uz = p[b * 3 + 2] - p[a * 3 + 2];
      const vx = p[c * 3] - p[a * 3]; const vy = p[c * 3 + 1] - p[a * 3 + 1]; const vz = p[c * 3 + 2] - p[a * 3 + 2];
      const fx = uy * vz - uz * vy; const fy = uz * vx - ux * vz; const fz = ux * vy - uy * vx;
      const gx = m.normals[a * 3] + m.normals[b * 3] + m.normals[c * 3]; const gy = m.normals[a * 3 + 1] + m.normals[b * 3 + 1] + m.normals[c * 3 + 1]; const gz = m.normals[a * 3 + 2] + m.normals[b * 3 + 2] + m.normals[c * 3 + 2];
      if (fx * gx + fy * gy + fz * gz <= 0) bad++;
    }
    assert.ok(bad / (m.indices.length / 3) < 0.01, `${name}: ${bad} of ${m.indices.length / 3} triangles face inwards`);
  }
});
test('a finer grid gives a finer mesh (about 4x the triangles for half the cell) and the same shape', () => {
  const a = meshSDF(sphere(1), { ...box(1.3), cell: 0.1 });
  const b = meshSDF(sphere(1), { ...box(1.3), cell: 0.05 });
  const r = b.triangleCount / a.triangleCount;
  assert.ok(r > 3.2 && r < 4.8, `ratio ${r}`);
  near(meshStats(b).area, 4 * Math.PI, 4 * Math.PI * 0.02);
});
test('two blobs blended with smin are ONE closed surface, apart they are two; relaxing keeps it closed and near the surface', () => {
  const two = (d) => (x, y, z) => smin(sdSphere(x, y, z, -d, 0, 0, 0.5), sdSphere(x, y, z, d, 0, 0, 0.5), 0.3);
  const near_ = meshSDF(two(0.4), { min: [-1.3, -1, -1], max: [1.3, 1, 1], cell: 0.06 });
  const far = meshSDF(two(1.0), { min: [-1.8, -1, -1], max: [1.8, 1, 1], cell: 0.06 });
  assert.equal(meshStats(near_).open, 0);
  assert.equal(meshStats(far).open, 0);
  const comps = (m) => { const p = Array.from({ length: m.vertexCount }, (_, i) => i); const find = (x) => (p[x] === x ? x : (p[x] = find(p[x]))); for (let t = 0; t < m.indices.length; t += 3) { p[find(m.indices[t])] = find(m.indices[t + 1]); p[find(m.indices[t + 1])] = find(m.indices[t + 2]); } return new Set(p.map((_, i) => find(i))).size; };
  assert.equal(comps(near_), 1);
  assert.equal(comps(far), 2);
  const rel = meshSDF(two(0.4), { min: [-1.3, -1, -1], max: [1.3, 1, 1], cell: 0.06, smooth: 2 });
  assert.equal(meshStats(rel).open, 0);
  for (let v = 0; v < rel.vertexCount; v += 7) near(two(0.4)(rel.positions[v * 3], rel.positions[v * 3 + 1], rel.positions[v * 3 + 2]), 0, 0.03, 'relaxed vertex distance to the surface');
});
test('vertex colours come from the callback (position + normal) and have one RGB per vertex', () => {
  const m = meshSDF(sphere(1), { ...box(1.3), cell: 0.12, color: (x, y, z, nx, ny, nz) => [0.5 + 0.5 * ny, 0.2, 0.3] });
  assert.equal(m.colors.length, m.positions.length);
  for (let v = 0; v < m.vertexCount; v += 11) near(m.colors[v * 3], 0.5 + 0.5 * m.normals[v * 3 + 1], 1e-6);
});
test('an empty field gives an empty mesh and a full one too (no crash)', () => {
  assert.equal(meshSDF(() => 1, { ...box(1), cell: 0.2 }).triangleCount, 0);
  assert.equal(meshSDF(() => -1, { ...box(1), cell: 0.2 }).triangleCount, 0);
});
test('speed: a head-sized field at 5 mm meshes in well under a second', () => {
  const f = (x, y, z) => smin(sdEllipsoid(x, y, z, 0, 0.04, 0, 0.115, 0.135, 0.125), sdEllipsoid(x, y, z, 0, -0.085, 0.02, 0.095, 0.115, 0.1), 0.05);
  const t0 = performance.now();
  const m = meshSDF(f, { min: [-0.16, -0.24, -0.17], max: [0.16, 0.2, 0.17], cell: 0.005 });
  const ms = performance.now() - t0;
  assert.ok(ms < 900, `${ms.toFixed(0)} ms`);
  assert.ok(m.triangleCount > 8000 && m.triangleCount < 40000, `${m.triangleCount} triangles`);
  assert.equal(meshStats(m).open, 0);
});

console.log(`${n} sdf tests passed`);
