// "Ori, Can You...?" — small pure geometry helpers for the character parts (no three, no DOM): a vertex builder with optional skin weights,
// swept tubes (brows, moustache, chain, lips, glasses arms), patches that hug the face, rounded-rect rings (the glasses), lathed spheres.
// Meshes are plain `{ positions, normals, colors, indices, skinIndex?, skinWeight? }` typed arrays so node can test and preview them.

export class MeshBuilder {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.idx = []; this.skin = []; this.weighted = false; }
  /** @param {number[]|null} bones [b0, w0, b1, w1, ...] (up to 4 pairs) */
  vertex(x, y, z, nx, ny, nz, c, bones = null) {
    const i = this.pos.length / 3;
    this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.col.push(c[0], c[1], c[2]);
    if (bones) this.weighted = true;
    this.skin.push(bones);
    return i;
  }
  tri(a, b, c) { this.idx.push(a, b, c); }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
  get count() { return this.pos.length / 3; }
  /** Appends another (finished) mesh, optionally moved / coloured / given one bone. */
  add(m, { offset = [0, 0, 0], color = null, bone = null, scale = 1 } = {}) {
    const base = this.count;
    for (let i = 0; i < m.positions.length / 3; i++) {
      const c = color || [m.colors[i * 3], m.colors[i * 3 + 1], m.colors[i * 3 + 2]];
      const b = bone !== null ? [bone, 1] : m.skinIndex ? weightsOf(m, i) : null;
      this.vertex(m.positions[i * 3] * scale + offset[0], m.positions[i * 3 + 1] * scale + offset[1], m.positions[i * 3 + 2] * scale + offset[2], m.normals[i * 3], m.normals[i * 3 + 1], m.normals[i * 3 + 2], c, b);
    }
    for (let i = 0; i < m.indices.length; i++) this.idx.push(m.indices[i] + base);
  }
  finish() {
    const n = this.count;
    const out = { positions: new Float32Array(this.pos), normals: new Float32Array(this.nor), colors: new Float32Array(this.col), indices: new Uint32Array(this.idx), vertexCount: n, triangleCount: this.idx.length / 3 };
    if (this.weighted) {
      out.skinIndex = new Uint16Array(n * 4);
      out.skinWeight = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const b = this.skin[i] || [0, 1];
        let sum = 0;
        for (let k = 0; k < 4 && k * 2 < b.length; k++) { out.skinIndex[i * 4 + k] = b[k * 2]; out.skinWeight[i * 4 + k] = b[k * 2 + 1]; sum += b[k * 2 + 1]; }
        if (sum > 0) for (let k = 0; k < 4; k++) out.skinWeight[i * 4 + k] /= sum;
      }
    }
    return out;
  }
}

function weightsOf(m, i) {
  const b = [];
  for (let k = 0; k < 4; k++) if (m.skinWeight[i * 4 + k] > 0) b.push(m.skinIndex[i * 4 + k], m.skinWeight[i * 4 + k]);
  return b;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/**
 * A tube swept along `pts` with an elliptical section: rw = half-width (along the binormal), rh = half-height (along `up`, projected).
 * radius(t) -> [rw, rh] or a number (a round tube); t runs 0..1 along the path. Flat colour or color(t, phi).
 */
export function sweepTube(B, pts, radius, { sides = 6, color = [0.5, 0.5, 0.5], up = [0, 0, 1], closed = false, caps = true, bone = null, bones = null } = {}) {
  const n = pts.length;
  const rings = [];
  for (let i = 0; i < n; i++) {
    const a = pts[closed ? (i + n - 1) % n : Math.max(0, i - 1)];
    const b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const T = norm(sub(b, a));
    let N = sub(up, [T[0] * dot(up, T), T[1] * dot(up, T), T[2] * dot(up, T)]);
    if (Math.hypot(...N) < 1e-4) N = sub([0, 1, 0], [T[0] * T[1], T[1] * T[1], T[2] * T[1]]);
    N = norm(N);
    const Bn = norm(cross(T, N));
    rings.push({ T, N, Bn });
  }
  const first = B.count;
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (closed ? n : n - 1) : 0;
    const r = radius(t);
    const rw = Array.isArray(r) ? r[0] : r;
    const rh = Array.isArray(r) ? r[1] : r;
    const { N, Bn } = rings[i];
    const bw = bones ? bones(t, pts[i]) : bone !== null ? [bone, 1] : null;
    for (let s = 0; s < sides; s++) {
      const ph = (s / sides) * Math.PI * 2;
      const c = Math.cos(ph);
      const sn = Math.sin(ph);
      const nx = N[0] * c / Math.max(rh, 1e-6) + Bn[0] * sn / Math.max(rw, 1e-6);
      const ny = N[1] * c / Math.max(rh, 1e-6) + Bn[1] * sn / Math.max(rw, 1e-6);
      const nz = N[2] * c / Math.max(rh, 1e-6) + Bn[2] * sn / Math.max(rw, 1e-6);
      const l = Math.hypot(nx, ny, nz) || 1;
      const col = typeof color === 'function' ? color(t, ph) : color;
      B.vertex(pts[i][0] + N[0] * rh * c + Bn[0] * rw * sn, pts[i][1] + N[1] * rh * c + Bn[1] * rw * sn, pts[i][2] + N[2] * rh * c + Bn[2] * rw * sn, nx / l, ny / l, nz / l, col, bw);
    }
  }
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const i2 = (i + 1) % n;
    for (let s = 0; s < sides; s++) {
      const s2 = (s + 1) % sides;
      B.quad(first + i * sides + s, first + i * sides + s2, first + i2 * sides + s2, first + i2 * sides + s);
    }
  }
  if (caps && !closed && n > 1) { // round the ends: a single point pushed out along the tangent
    for (const end of [0, n - 1]) {
      const r = radius(end === 0 ? 0 : 1);
      const rw = Array.isArray(r) ? r[0] : r;
      const T = rings[end].T;
      const sgn = end === 0 ? -1 : 1;
      const col = typeof color === 'function' ? color(end === 0 ? 0 : 1, 0) : color;
      const bw = bones ? bones(end === 0 ? 0 : 1, pts[end]) : bone !== null ? [bone, 1] : null;
      const tip = B.vertex(pts[end][0] + T[0] * rw * sgn * 0.8, pts[end][1] + T[1] * rw * sgn * 0.8, pts[end][2] + T[2] * rw * sgn * 0.8, T[0] * sgn, T[1] * sgn, T[2] * sgn, col, bw);
      for (let s = 0; s < sides; s++) {
        const a = first + end * sides + s;
        const b = first + end * sides + ((s + 1) % sides);
        if (end === 0) B.tri(tip, b, a); else B.tri(tip, a, b);
      }
    }
  }
}

/**
 * A thin shell that hugs a surface: over the box x0..x1, y0..y1 lay a grid of `step`; `thick(x, y)` (metres, 0 = nothing) lifts the shell off
 * `surface(x, y)` (the skin's z). Used for the goatee, the soul patch and anything that should look painted-on with a little depth.
 */
export function surfacePatch(B, { x0, x1, y0, y1, step = 0.002, thick, surface, color, bone = null }) {
  const nx = Math.ceil((x1 - x0) / step) + 1;
  const ny = Math.ceil((y1 - y0) / step) + 1;
  const idx = new Int32Array(nx * ny).fill(-1);
  const th = new Float32Array(nx * ny);
  const zz = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = x0 + i * step; const y = y0 + j * step; th[j * nx + i] = thick(x, y); zz[j * nx + i] = surface(x, y); }
  const at = (i, j) => zz[j * nx + i] + th[j * nx + i];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      let near = th[k] > 0;
      if (!near) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a; const jj = j + b; if (ii >= 0 && jj >= 0 && ii < nx && jj < ny && th[jj * nx + ii] > 0) near = true; }
      if (!near) continue;
      const x = x0 + i * step;
      const y = y0 + j * step;
      const dzdx = (at(Math.min(nx - 1, i + 1), j) - at(Math.max(0, i - 1), j)) / (step * (Math.min(nx - 1, i + 1) - Math.max(0, i - 1) || 1));
      const dzdy = (at(i, Math.min(ny - 1, j + 1)) - at(i, Math.max(0, j - 1))) / (step * (Math.min(ny - 1, j + 1) - Math.max(0, j - 1) || 1));
      const l = Math.hypot(dzdx, dzdy, 1);
      idx[k] = B.vertex(x, y, zz[k] + th[k], -dzdx / l, -dzdy / l, 1 / l, color(x, y, th[k]), bone !== null ? [bone, 1] : null);
    }
  }
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = idx[j * nx + i]; const b = idx[j * nx + i + 1]; const c = idx[(j + 1) * nx + i + 1]; const d = idx[(j + 1) * nx + i];
      if (a < 0 || b < 0 || c < 0 || d < 0) continue;
      if (th[j * nx + i] + th[j * nx + i + 1] + th[(j + 1) * nx + i + 1] + th[(j + 1) * nx + i] <= 0) continue;
      B.quad(a, b, c, d);
    }
  }
}

/** Points of a rounded rectangle (w x h, corner radius r) in the xy plane, counter-clockwise, `seg` points per corner. */
export function roundedRect(w, h, r, seg = 5) {
  const pts = [];
  const hw = w / 2;
  const hh = h / 2;
  r = Math.min(r, hw, hh);
  const corners = [[hw - r, hh - r, 0], [-hw + r, hh - r, Math.PI / 2], [-hw + r, -hh + r, Math.PI], [hw - r, -hh + r, Math.PI * 1.5]];
  for (const [cx, cy, a0] of corners) for (let s = 0; s <= seg; s++) { const a = a0 + (s / seg) * (Math.PI / 2); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return pts;
}

/** A flat ring between two same-length outlines, extruded `depth` along z (centred), with bevel-ish normals. Used for the lens frames. */
export function extrudeRing(B, outer, inner, depth, color, { bone = null, place = (x, y, z) => [x, y, z] } = {}) {
  const n = outer.length;
  const bw = bone !== null ? [bone, 1] : null;
  const hz = depth / 2;
  const P = (p, z) => place(p[0], p[1], z);
  const ring = (pts, z, nz, outward) => pts.map((p, i) => {
    const a = pts[(i + n - 1) % n]; const b = pts[(i + 1) % n];
    let tx = b[0] - a[0]; let ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const nx = ty * outward; const ny = -tx * outward;
    const q = P(p, z);
    return B.vertex(q[0], q[1], q[2], nx * (nz === 0 ? 1 : 0.35), ny * (nz === 0 ? 1 : 0.35), nz === 0 ? 0 : nz, color, bw);
  });
  const oF = ring(outer, hz, 0, 1); const oB = ring(outer, -hz, 0, 1);
  const iF = ring(inner, hz, 0, -1); const iB = ring(inner, -hz, 0, -1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    B.quad(oB[i], oB[j], oF[j], oF[i]); // outer wall
    B.quad(iF[i], iF[j], iB[j], iB[i]); // inner wall
  }
  // front and back faces (own vertices so their normals are flat)
  const face = (z, nz) => {
    const o = outer.map((p) => { const q = P(p, z); return B.vertex(q[0], q[1], q[2], 0, 0, nz, color, bw); });
    const k = inner.map((p) => { const q = P(p, z); return B.vertex(q[0], q[1], q[2], 0, 0, nz, color, bw); });
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (nz > 0) B.quad(o[i], o[j], k[j], k[i]); else B.quad(o[j], o[i], k[i], k[j]); }
  };
  face(hz, 1);
  face(-hz, -1);
}

/** A filled convex-ish outline (fan from its centre), at z with normal nz — the lens. */
export function fillOutline(B, pts, z, nz, color, { bone = null, place = (x, y, zz) => [x, y, zz] } = {}) {
  const bw = bone !== null ? [bone, 1] : null;
  let cx = 0; let cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  cx /= pts.length; cy /= pts.length;
  const c0 = place(cx, cy, z);
  const c = B.vertex(c0[0], c0[1], c0[2], 0, 0, nz, color, bw);
  const ring = pts.map((p) => { const q = place(p[0], p[1], z); return B.vertex(q[0], q[1], q[2], 0, 0, nz, color, bw); });
  for (let i = 0; i < ring.length; i++) { const j = (i + 1) % ring.length; if (nz > 0) B.tri(c, ring[i], ring[j]); else B.tri(c, ring[j], ring[i]); }
}

/** A UV sphere (lat/long) with a colour function of the unit direction; the pole points along +z. */
export function uvSphere(B, cx, cy, cz, r, color, { nu = 32, nv = 22, bone = null, squash = [1, 1, 1] } = {}) {
  const first = B.count;
  const bw = bone !== null ? [bone, 1] : null;
  for (let j = 0; j <= nv; j++) {
    const th = (j / nv) * Math.PI; // 0 at the +z pole
    for (let i = 0; i <= nu; i++) {
      const ph = (i / nu) * Math.PI * 2;
      const dx = Math.sin(th) * Math.cos(ph);
      const dy = Math.sin(th) * Math.sin(ph);
      const dz = Math.cos(th);
      B.vertex(cx + dx * r * squash[0], cy + dy * r * squash[1], cz + dz * r * squash[2], dx / squash[0], dy / squash[1], dz / squash[2], color(dx, dy, dz, th, ph), bw);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = first + j * (nu + 1) + i; B.quad(a, a + nu + 1, a + nu + 2, a + 1); }
}

/** A cap of a sphere around `axis` (a unit vector) out to half-angle `beta` (radians), radius r, centred at c — the eyelids. */
export function sphereCap(B, c, r, axis, beta, color, { rings = 8, around = 20, bone = null, rim = 0 } = {}) {
  const bw = bone !== null ? [bone, 1] : null;
  // an orthonormal frame around the axis
  const ref = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(ref, axis));
  const v = cross(axis, u);
  const first = B.count;
  for (let j = 0; j <= rings; j++) {
    const th = (j / rings) * beta;
    for (let i = 0; i < around; i++) {
      const ph = (i / around) * Math.PI * 2;
      const s = Math.sin(th);
      const d = [axis[0] * Math.cos(th) + (u[0] * Math.cos(ph) + v[0] * Math.sin(ph)) * s, axis[1] * Math.cos(th) + (u[1] * Math.cos(ph) + v[1] * Math.sin(ph)) * s, axis[2] * Math.cos(th) + (u[2] * Math.cos(ph) + v[2] * Math.sin(ph)) * s];
      const rr = j === rings && rim ? r + rim : r;
      B.vertex(c[0] + d[0] * rr, c[1] + d[1] * rr, c[2] + d[2] * rr, d[0], d[1], d[2], typeof color === 'function' ? color(j / rings, ph) : color, bw);
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < around; i++) { const i2 = (i + 1) % around; B.quad(first + j * around + i, first + j * around + i2, first + (j + 1) * around + i2, first + (j + 1) * around + i); }
}
