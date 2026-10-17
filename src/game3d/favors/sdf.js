// "Ori, Can You...?" — signed distance fields and a surface-nets mesher (PURE: numbers in, typed arrays out; no three, no DOM). The characters
// are built from SMOOTH organic forms — a head from smoothly blended ellipsoids, a mass of hair clumps, sleeves, hands — described as distance
// fields and turned into watertight meshes with smooth gradient normals. Units are metres; y is up.

// ── distance functions ──
export const length3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
/** Smooth minimum (the union of two shapes with a rounded blend of width k). */
export const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
/** Smooth maximum (the intersection / a smooth carve when used with a negated shape). */
export const smax = (a, b, k) => -smin(-a, -b, k);
export const sdSphere = (x, y, z, cx, cy, cz, r) => length3(x - cx, y - cy, z - cz) - r;
/** An ellipsoid (a good approximation of the true distance). */
export function sdEllipsoid(x, y, z, cx, cy, cz, rx, ry, rz) {
  const px = x - cx;
  const py = y - cy;
  const pz = z - cz;
  const k0 = length3(px / rx, py / ry, pz / rz);
  const k1 = length3(px / (rx * rx), py / (ry * ry), pz / (rz * rz));
  return k1 < 1e-12 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}
/** A capsule from a to b with radius r (r2 for a tapered end). */
export function sdCapsule(x, y, z, ax, ay, az, bx, by, bz, r, r2 = r) {
  const pax = x - ax;
  const pay = y - ay;
  const paz = z - az;
  const bax = bx - ax;
  const bay = by - ay;
  const baz = bz - az;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz || 1)));
  return length3(pax - bax * h, pay - bay * h, paz - baz * h) - (r + (r2 - r) * h);
}
/** A rounded box centred at c with half-extents h and corner radius r. */
export function sdRoundBox(x, y, z, cx, cy, cz, hx, hy, hz, r) {
  const qx = Math.abs(x - cx) - hx + r;
  const qy = Math.abs(y - cy) - hy + r;
  const qz = Math.abs(z - cz) - hz + r;
  return length3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}
/** Mirrors x so a field built for the right side gives both sides. */
export const mirrorX = (x) => Math.abs(x);

// ── the mesher ──
// Naive surface nets (after Mikola Lysenko): one vertex per cell the surface passes through, one quad per grid edge it crosses.
const CUBE_EDGES = [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [3, 7], [2, 6]];
const CORNER = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];

/**
 * @param {(x:number,y:number,z:number)=>number} field negative inside
 * @param {{ min: number[], max: number[], cell: number, color?: (x:number,y:number,z:number,nx:number,ny:number,nz:number)=>number[], smooth?: number }} o
 * @returns {{ positions: Float32Array, normals: Float32Array, colors: Float32Array|null, indices: Uint32Array, vertexCount: number, triangleCount: number, dims: number[] }}
 */
export function meshSDF(field, { min, max, cell, color = null, smooth = 0 }) {
  const nx = Math.ceil((max[0] - min[0]) / cell) + 1;
  const ny = Math.ceil((max[1] - min[1]) / cell) + 1;
  const nz = Math.ceil((max[2] - min[2]) / cell) + 1;
  const val = new Float32Array(nx * ny * nz);
  const at = (i, j, k) => i + nx * (j + ny * k);
  // sample the field block by block: far from the surface a whole block gets its centre's value (the surface cannot be in it), which skips
  // most of the empty space round a character. The guard is generous (the blended fields are not exact distances).
  const BS = 6;
  const reach = BS * cell * 0.87 * 1.7;
  for (let bk = 0; bk < nz; bk += BS) {
    for (let bj = 0; bj < ny; bj += BS) {
      for (let bi = 0; bi < nx; bi += BS) {
        const i1 = Math.min(nx, bi + BS); const j1 = Math.min(ny, bj + BS); const k1 = Math.min(nz, bk + BS);
        const c = field(min[0] + (bi + (i1 - bi) / 2) * cell, min[1] + (bj + (j1 - bj) / 2) * cell, min[2] + (bk + (k1 - bk) / 2) * cell);
        if (Math.abs(c) > reach) { for (let k = bk; k < k1; k++) for (let j = bj; j < j1; j++) for (let i = bi; i < i1; i++) val[at(i, j, k)] = c; continue; }
        for (let k = bk; k < k1; k++) for (let j = bj; j < j1; j++) for (let i = bi; i < i1; i++) val[at(i, j, k)] = field(min[0] + i * cell, min[1] + j * cell, min[2] + k * cell);
      }
    }
  }

  const vertIndex = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cellAt = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos = [];
  const idx = [];
  const corner = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) { const v = val[at(i + CORNER[c][0], j + CORNER[c][1], k + CORNER[c][2])]; corner[c] = v; if (v < 0) mask |= 1 << c; }
        if (mask === 0 || mask === 255) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let n = 0;
        for (const [a, b] of CUBE_EDGES) {
          const va = corner[a];
          const vb = corner[b];
          if ((va < 0) === (vb < 0)) continue;
          const t = va / (va - vb);
          sx += CORNER[a][0] + t * (CORNER[b][0] - CORNER[a][0]);
          sy += CORNER[a][1] + t * (CORNER[b][1] - CORNER[a][1]);
          sz += CORNER[a][2] + t * (CORNER[b][2] - CORNER[a][2]);
          n++;
        }
        vertIndex[cellAt(i, j, k)] = pos.length / 3;
        pos.push(min[0] + (i + sx / n) * cell, min[1] + (j + sy / n) * cell, min[2] + (k + sz / n) * cell);
      }
    }
  }
  // quads: for each grid edge along x / y / z that changes sign, join the four cells around it
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c); };
  for (let k = 1; k < nz - 1; k++) {
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const v0 = val[at(i, j, k)] < 0;
        // x edge: (i,j,k) -> (i+1,j,k)
        if (i < nx - 1 && v0 !== (val[at(i + 1, j, k)] < 0)) quad(vertIndex[cellAt(i, j - 1, k - 1)], vertIndex[cellAt(i, j, k - 1)], vertIndex[cellAt(i, j, k)], vertIndex[cellAt(i, j - 1, k)], v0);
        // y edge
        if (v0 !== (val[at(i, j + 1, k)] < 0)) quad(vertIndex[cellAt(i - 1, j, k - 1)], vertIndex[cellAt(i - 1, j, k)], vertIndex[cellAt(i, j, k)], vertIndex[cellAt(i, j, k - 1)], v0);
        // z edge
        if (v0 !== (val[at(i, j, k + 1)] < 0)) quad(vertIndex[cellAt(i - 1, j - 1, k)], vertIndex[cellAt(i, j - 1, k)], vertIndex[cellAt(i, j, k)], vertIndex[cellAt(i - 1, j, k)], v0);
      }
    }
  }

  const positions = new Float32Array(pos);
  const vc = positions.length / 3;
  // optional relaxation: pulls every vertex towards the mean of its neighbours (softens the grid look), then back onto the surface
  if (smooth > 0 && vc) relax(positions, new Uint32Array(idx), smooth, field, cell);
  const normals = new Float32Array(positions.length);
  const e = cell * 0.5;
  for (let v = 0; v < vc; v++) {
    const x = positions[v * 3];
    const y = positions[v * 3 + 1];
    const z = positions[v * 3 + 2];
    let gx = field(x + e, y, z) - field(x - e, y, z);
    let gy = field(x, y + e, z) - field(x, y - e, z);
    let gz = field(x, y, z + e) - field(x, y, z - e);
    const l = length3(gx, gy, gz) || 1;
    gx /= l; gy /= l; gz /= l;
    normals[v * 3] = gx; normals[v * 3 + 1] = gy; normals[v * 3 + 2] = gz;
  }
  let colors = null;
  if (color) {
    colors = new Float32Array(positions.length);
    for (let v = 0; v < vc; v++) {
      const c = color(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2], normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]);
      colors[v * 3] = c[0]; colors[v * 3 + 1] = c[1]; colors[v * 3 + 2] = c[2];
    }
  }
  return { positions, normals, colors, indices: new Uint32Array(idx), vertexCount: vc, triangleCount: idx.length / 3, dims: [nx, ny, nz] };
}

/** Laplacian relaxation that keeps the vertices on the surface (a few Newton steps along the field's gradient after each pass). */
function relax(p, tri, passes, field, cell) {
  const n = p.length / 3;
  const sum = new Float32Array(p.length);
  const cnt = new Uint16Array(n);
  for (let it = 0; it < passes; it++) {
    sum.fill(0); cnt.fill(0);
    for (let t = 0; t < tri.length; t += 3) {
      for (let a = 0; a < 3; a++) {
        const i = tri[t + a];
        const j = tri[t + ((a + 1) % 3)];
        for (let c = 0; c < 3; c++) { sum[i * 3 + c] += p[j * 3 + c]; }
        cnt[i]++;
      }
    }
    for (let v = 0; v < n; v++) if (cnt[v]) for (let c = 0; c < 3; c++) p[v * 3 + c] += (sum[v * 3 + c] / cnt[v] - p[v * 3 + c]) * 0.5;
    const e = cell * 0.5;
    for (let v = 0; v < n; v++) { // back onto the surface
      const x = p[v * 3]; const y = p[v * 3 + 1]; const z = p[v * 3 + 2];
      const d = field(x, y, z);
      const gx = field(x + e, y, z) - field(x - e, y, z);
      const gy = field(x, y + e, z) - field(x, y - e, z);
      const gz = field(x, y, z + e) - field(x, y, z - e);
      const l = length3(gx, gy, gz) || 1;
      p[v * 3] -= (gx / l) * d; p[v * 3 + 1] -= (gy / l) * d; p[v * 3 + 2] -= (gz / l) * d;
    }
  }
}

/** The area of a mesh (for tests) and a closed-ness check: every edge is used by exactly two triangles. */
export function meshStats(m) {
  const p = m.positions;
  const t = m.indices;
  let area = 0;
  const edges = new Map();
  for (let i = 0; i < t.length; i += 3) {
    const a = t[i]; const b = t[i + 1]; const c = t[i + 2];
    const ux = p[b * 3] - p[a * 3]; const uy = p[b * 3 + 1] - p[a * 3 + 1]; const uz = p[b * 3 + 2] - p[a * 3 + 2];
    const vx = p[c * 3] - p[a * 3]; const vy = p[c * 3 + 1] - p[a * 3 + 1]; const vz = p[c * 3 + 2] - p[a * 3 + 2];
    area += 0.5 * length3(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    for (const [x, y] of [[a, b], [b, c], [c, a]]) { const k = x < y ? `${x}_${y}` : `${y}_${x}`; edges.set(k, (edges.get(k) || 0) + 1); }
  }
  let open = 0;
  let nonManifold = 0;
  for (const c of edges.values()) { if (c === 1) open++; else if (c > 2) nonManifold++; }
  return { area, edges: edges.size, open, nonManifold };
}

/** Ambient occlusion baked from the field (1 = open, 0 = a deep crevice): four taps along the normal, as the surface would see them. */
export function aoAt(field, x, y, z, nx, ny, nz, reach = 0.03) {
  let occ = 0;
  let w = 1;
  let wsum = 0;
  for (let i = 1; i <= 4; i++) {
    const h = (reach * i) / 4;
    const d = field(x + nx * h, y + ny * h, z + nz * h);
    occ += w * Math.max(0, h - d) / h;
    wsum += w;
    w *= 0.7;
  }
  return Math.max(0, Math.min(1, 1 - (occ / wsum) * 1.1));
}
