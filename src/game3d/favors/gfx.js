// "Ori, Can You...?" — small helpers the procedural 3D shares: a geometry builder that appends boxes / quads / prisms into ONE buffer
// (so a whole neighbourhood is a handful of draw calls), canvas textures, and a dispose helper.
import * as THREE from 'three';

/** Appends simple shapes to one BufferGeometry. Every vertex has position, normal, uv and a colour (vertex colours tint the material). */
export class GeoBuilder {
  constructor() {
    this.p = [];
    this.n = [];
    this.uv = [];
    this.c = [];
    this.extra = []; // optional per-vertex float (used for lit windows / pivots)
    this.extra2 = []; // a second optional float (window size, wind weight)
    this.i = [];
    this.count = 0;
    this.color = [1, 1, 1];
    this.attr = 0;
    this.attr2 = 0;
  }

  setColor(hex) { this.color = new THREE.Color(hex).toArray(); return this; }

  vert(x, y, z, nx, ny, nz, u, v) {
    this.p.push(x, y, z);
    this.n.push(nx, ny, nz);
    this.uv.push(u, v);
    this.c.push(this.color[0], this.color[1], this.color[2]);
    this.extra.push(this.attr);
    this.extra2.push(this.attr2);
    return this.count++;
  }

  /** A quad from four corners (counter-clockwise seen from the front) with one normal. */
  quad(a, b, c, d, nx, ny, nz, uv = [0, 0, 1, 0, 1, 1, 0, 1]) {
    const i = this.vert(a[0], a[1], a[2], nx, ny, nz, uv[0], uv[1]);
    this.vert(b[0], b[1], b[2], nx, ny, nz, uv[2], uv[3]);
    this.vert(c[0], c[1], c[2], nx, ny, nz, uv[4], uv[5]);
    this.vert(d[0], d[1], d[2], nx, ny, nz, uv[6], uv[7]);
    this.i.push(i, i + 1, i + 2, i, i + 2, i + 3);
    return i;
  }

  /**
   * An axis-aligned box. `uvMeters`: texture coordinates in metres / tile size (so a repeating facade texture keeps its scale), else 0..1.
   * Faces can be left out with `skip` (e.g. { bottom: true }).
   */
  box(x0, y0, z0, x1, y1, z1, { uvMeters = null, skip = {} } = {}) {
    const W = x1 - x0;
    const H = y1 - y0;
    const D = z1 - z0;
    const uvf = (a, b) => (uvMeters ? [0, 0, a / uvMeters[0], 0, a / uvMeters[0], b / uvMeters[1], 0, b / uvMeters[1]] : undefined);
    if (!skip.front) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0, 0, 1, uvf(W, H));
    if (!skip.back) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0, 0, -1, uvf(W, H));
    if (!skip.right) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 1, 0, 0, uvf(D, H));
    if (!skip.left) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], -1, 0, 0, uvf(D, H));
    if (!skip.top) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 0, 1, 0, uvf(W, D));
    if (!skip.bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], 0, -1, 0, uvf(W, D));
    return this;
  }

  /** A horizontal quad (a floor patch) at height y. */
  floor(x0, z0, x1, z1, y, uvScale = null) {
    const uv = uvScale ? [x0 / uvScale, z1 / uvScale, x1 / uvScale, z1 / uvScale, x1 / uvScale, z0 / uvScale, x0 / uvScale, z0 / uvScale] : undefined;
    return this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], 0, 1, 0, uv);
  }

  /** Appends another BufferGeometry (indexed or not) under a matrix, with a flat colour. */
  geometry(geo, matrix, hex = null) {
    const g = geo.index ? geo : geo.toNonIndexed();
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const uv = g.attributes.uv;
    const m3 = new THREE.Matrix3().getNormalMatrix(matrix);
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    if (hex != null) this.setColor(hex);
    const base = this.count;
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k).applyMatrix4(matrix);
      n.fromBufferAttribute(nor, k).applyMatrix3(m3).normalize();
      this.vert(v.x, v.y, v.z, n.x, n.y, n.z, uv ? uv.getX(k) : 0, uv ? uv.getY(k) : 0);
    }
    if (g.index) for (let k = 0; k < g.index.count; k++) this.i.push(base + g.index.getX(k));
    else for (let k = 0; k < pos.count; k++) this.i.push(base + k);
    return this;
  }

  build({ extraName = null, extraName2 = null } = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    if (extraName) g.setAttribute(extraName, new THREE.Float32BufferAttribute(this.extra, 1));
    if (extraName2) g.setAttribute(extraName2, new THREE.Float32BufferAttribute(this.extra2, 1));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** A canvas texture made by a drawing callback; sRGB colour space, optional repeat + anisotropy. */
export function canvasTexture(w, h, draw, { repeat = false, aniso = 4, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/** Deterministic value noise on a canvas (stucco, asphalt, grass …). */
export function noiseFill(ctx, w, h, base, amount, rnd, grain = 1) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const n = Math.floor((w * h) / (grain * grain) / 3);
  for (let i = 0; i < n; i++) {
    const v = (rnd() - 0.5) * amount;
    ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    ctx.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * h), grain, grain);
  }
}

/** Releases the geometries, materials and textures under an object. */
export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      for (const k of ['map', 'alphaMap', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'envMap']) if (m[k]) m[k].dispose();
      m.dispose();
    }
    if (o.isInstancedMesh) o.dispose();
  });
}
