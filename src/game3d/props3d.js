// NEON DRIFT — roadside and distant props, per biome: all InstancedMesh, split into ~180 m chunks along the track so the
// frustum culls them and a distance test hides the far ones. No allocation per frame.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from './rng.js';
import { closest, WALL_MARGIN } from './track.js';
import { SECTION } from './road3d.js';
import { windowTexture, signTexture, SIGN_COUNT } from './textures3d.js';

const CHUNK = 180;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _c = new THREE.Color();

/** Instances of one geometry/material grouped into chunks along the track. */
class Chunked {
  constructor(geometry, material, maxDist) {
    this.geometry = geometry;
    this.material = material;
    this.maxDist = maxDist;
    this.buckets = new Map();
    this.meshes = [];
  }

  add(s, matrix, color) {
    const key = Math.floor(s / CHUNK);
    let b = this.buckets.get(key);
    if (!b) this.buckets.set(key, (b = []));
    b.push({ m: matrix.clone(), c: color });
  }

  build(group) {
    for (const list of this.buckets.values()) {
      const mesh = new THREE.InstancedMesh(this.geometry, this.material, list.length);
      list.forEach((it, i) => {
        mesh.setMatrixAt(i, it.m);
        if (it.c !== undefined) mesh.setColorAt(i, _c.set(it.c));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.userData.maxDist = this.maxDist;
      group.add(mesh);
      this.meshes.push(mesh);
    }
    this.buckets.clear();
  }
}

/** Where the ground is at `beyond` metres outside the barrier of section k: on the embankment, or the floor further out. */
function groundY(f, k, beyond, floorY, slope) {
  if (!slope) return floorY;
  const depth = Math.max(1.2, f.y[k] - floorY + 0.6);
  const run = depth * 1.9 + 3;
  if (beyond >= run) return floorY;
  return f.y[k] - 0.3 + (floorY - 0.2 - (f.y[k] - 0.3)) * (beyond / run);
}

function colorGeo(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
const place = (x, y, z, rotY, sx, sy, sz) => _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, rotY, 0)), _s.set(sx, sy, sz));

// ── geometries ──────────────────────────────────────────────────────────────

function cactusGeo() {
  const g = (r0, r1, h, x, y, z, rz) => { const c = new THREE.CylinderGeometry(r0, r1, h, 7); c.rotateZ(rz); c.translate(x, y, z); return c; };
  return mergeGeometries([
    g(0.5, 0.55, 5.2, 0, 2.6, 0, 0), g(0.28, 0.3, 1.6, 0.95, 2.2, 0, Math.PI / 2), g(0.28, 0.3, 2.2, 1.7, 3.2, 0, 0),
    g(0.26, 0.28, 1.3, -0.85, 3.0, 0, Math.PI / 2), g(0.26, 0.28, 1.8, -1.45, 3.8, 0, 0),
  ].map((x) => colorGeo(x, 0xffffff)));
}
function pineGeo() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.28, 0.4, 2.2, 6); trunk.translate(0, 1.1, 0);
  parts.push(colorGeo(trunk, 0x5a4030));
  [[3.0, 4.2, 2.0], [2.4, 3.6, 4.2], [1.7, 3.0, 6.2], [1.0, 2.4, 8.0]].forEach(([r, h, y]) => {
    const c = new THREE.ConeGeometry(r, h, 8); c.translate(0, y + h / 2 - 0.4, 0);
    parts.push(colorGeo(c, 0x3f6a4a));
  });
  return mergeGeometries(parts);
}
function rockGeo() {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  // the same offset for the same corner (hash of its position), so the faces stay joined
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i); const y = p.getY(i); const z = p.getZ(i);
    const h = Math.sin(Math.round(x * 91) * 12.9898 + Math.round(y * 91) * 78.233 + Math.round(z * 91) * 37.719) * 43758.5453;
    const j = 0.82 + 0.3 * (h - Math.floor(h));
    p.setXYZ(i, x * j, y * j * 0.78, z * j);
  }
  g.computeVertexNormals();
  return colorGeo(g, 0xffffff);
}
function mesaGeo() {
  const g = new THREE.CylinderGeometry(0.72, 1, 1, 8, 1);
  g.translate(0, 0.5, 0);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { // darker foot, banded rock, lit cap
    const y = p.getY(i);
    c.setRGB(0.55 + 0.45 * y, 0.45 + 0.4 * y, 0.4 + 0.3 * y);
    if (y > 0.98) c.multiplyScalar(1.15);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function lampGeo() {
  const pole = new THREE.CylinderGeometry(0.12, 0.17, 9, 6); pole.translate(0, 4.5, 0);
  const arm = new THREE.BoxGeometry(3.4, 0.14, 0.14); arm.translate(1.7, 9.0, 0);
  return mergeGeometries([colorGeo(pole, 0x2a2840), colorGeo(arm, 0x2a2840)]);
}
function poleGeo() {
  const pole = new THREE.CylinderGeometry(0.14, 0.18, 8.5, 6); pole.translate(0, 4.25, 0);
  const bar = new THREE.BoxGeometry(0.2, 0.2, 2.4); bar.translate(0, 8.0, 0);
  const bar2 = new THREE.BoxGeometry(0.2, 0.2, 1.8); bar2.translate(0, 7.1, 0);
  return mergeGeometries([colorGeo(pole, 0x4a3426), colorGeo(bar, 0x4a3426), colorGeo(bar2, 0x4a3426)]);
}

// ── tower material: lit windows from a tiny texture, per-instance variation from the instance position ──
function towerMaterial(biome, look, aniso) {
  const tex = windowTexture(aniso);
  const w = biome.horizon.windows;
  const mat = new THREE.ShaderMaterial({
    fog: true,
    // (UniformsUtils.merge would CLONE the texture: a copy nobody disposes — so the fog uniforms are cloned alone)
    uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), {
      uWin: { value: tex }, uBase: { value: new THREE.Color(0x181430) },
      uWinA: { value: new THREE.Color(w[0] ?? 0xffc87a) }, uWinB: { value: new THREE.Color(w[1] ?? 0x8ff0ff) }, uWinC: { value: new THREE.Color(w[2] ?? 0xff7ad0) },
      uSky: { value: new THREE.Color(look.hemi.sky) },
    }),
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying float vSeed; varying float vTop; varying float vSide;
      #include <fog_pars_vertex>
      void main() {
        vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        float wd = abs(normal.x) > 0.5 ? sc.z : sc.x;
        vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        vUv = vec2(uv.x * wd, uv.y * sc.y) / 30.0 + vec2(vSeed * 9.0, vSeed * 5.0); // 8 x 8 windows per 30 m: ~3.7 m each
        vTop = abs(normal.y) > 0.5 ? 1.0 : 0.0;
        vSide = abs(normal.x) > 0.5 ? 1.0 : 0.0;
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uWin; uniform vec3 uBase, uWinA, uWinB, uWinC, uSky;
      varying vec2 vUv; varying float vSeed; varying float vTop; varying float vSide;
      #include <fog_pars_fragment>
      void main() {
        float lit = texture2D(uWin, vUv).r * (1.0 - vTop);
        vec3 wc = vSeed < 0.34 ? uWinA : (vSeed < 0.67 ? uWinB : uWinC);
        vec3 col = uBase * (0.5 + 0.9 * vSeed) * (0.75 + 0.25 * vSide) + uSky * 0.04 * (vTop + 0.3);
        col += wc * lit * (0.9 + 1.1 * vSeed);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  mat.userData.tex = tex;
  return mat;
}

/**
 * Builds the props of a biome. Returns { group, update(camera), dispose(), counts }.
 * `f` = frames from road3d.sampleFrames, `floorY` = height of the ground plane.
 */
export function buildProps(track, f, biome, look, floorY, aniso) {
  const group = new THREE.Group();
  const rnd = mulberry32(biome.seed * 97 + 13);
  const own = [];
  const mine = (o) => { own.push(o); return o; };
  const chunks = [];
  const slope = biome.embank === 'slope';
  const cl = {};
  const sections = f.count;

  /** A random spot beside the road: returns false when it would land on a road (the track comes back near itself). */
  const spot = (beyondMin, beyondMax) => {
    const k = 1 + Math.floor(rnd() * (sections - 1));
    const side = rnd() < 0.5 ? -1 : 1;
    const beyond = beyondMin + rnd() * (beyondMax - beyondMin);
    const lat = side * (f.width[k] / 2 + WALL_MARGIN + 0.72 + beyond);
    const x = f.x[k] + f.rx[k] * lat;
    const z = f.z[k] + f.rz[k] * lat;
    closest(track, x, z, -1, cl);
    if (cl.dist < cl.width / 2 + WALL_MARGIN + 6) return null;
    return { k, side, x, z, y: groundY(f, k, beyond, floorY, slope), s: f.s[k], beyond };
  };

  const standard = (extra) => mine(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true, ...extra }));

  if (biome.props.towers) {
    const mat = mine(towerMaterial(biome, look, aniso));
    own.push(mat.userData.tex);
    const geo = mine(new THREE.BoxGeometry(1, 1, 1));
    geo.translate(0, 0.5, 0);
    const ch = new Chunked(geo, mat, 2600);
    let n = 0;
    for (let tries = 0; n < biome.props.towers && tries < biome.props.towers * 6; tries++) {
      const p = spot(70, 700);
      if (!p) continue;
      const w = 14 + rnd() * 34;
      const d = 14 + rnd() * 34;
      const h = 40 + Math.pow(rnd(), 1.7) * 230;
      ch.add(p.s, place(p.x, floorY - 2, p.z, rnd() * Math.PI, w, h + (p.y - floorY) * 0, d));
      n++;
    }
    ch.build(group);
    chunks.push(ch);
  }

  if (biome.props.lamps) {
    const geo = mine(lampGeo());
    const mat = standard({ flatShading: false });
    const head = mine(new THREE.BoxGeometry(0.9, 0.18, 0.5));
    head.translate(3.2, 8.92, 0);
    const headMat = mine(new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.86, 0.6).multiplyScalar(4), toneMapped: false }));
    const lamps = new Chunked(geo, mat, 1100);
    const heads = new Chunked(head, headMat, 1100);
    for (let s = 20, i = 0; s < track.length - 10; s += 46, i++) {
      const k = Math.min(sections, Math.round(s / SECTION));
      const side = i % 2 ? -1 : 1;
      const lat = side * (f.width[k] / 2 + WALL_MARGIN + 0.45);
      const x = f.x[k] + f.rx[k] * lat;
      const z = f.z[k] + f.rz[k] * lat;
      // the arm (local +x) points from the pole towards the centre line
      const yaw = -Math.atan2(-side * f.rz[k], -side * f.rx[k]);
      place(x, f.y[k] - Math.sin(f.bank[k]) * lat, z, yaw, 1, 1, 1);
      lamps.add(s, _m);
      heads.add(s, _m);
    }
    lamps.build(group);
    heads.build(group);
    chunks.push(lamps, heads);
  }

  if (biome.props.signs) {
    const tex = mine(signTexture(aniso));
    const mat = mine(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide }));
    mat.color.setScalar(2.2);
    const post = mine(new THREE.CylinderGeometry(0.18, 0.22, 11, 6));
    post.translate(0, 5.5, 0);
    const postMat = standard({ flatShading: false });
    colorGeo(post, 0x2a2840);
    const posts = new Chunked(post, postMat, 1400);
    const cell = 1 / 4;
    const signGeos = [];
    for (let n = 0, tries = 0; n < 44 && tries < 300; tries++) {
      const p = spot(5, 22);
      if (!p) continue;
      const sign = new THREE.PlaneGeometry(9, 4.5);
      const ci = Math.floor(rnd() * SIGN_COUNT);
      const uv = sign.attributes.uv;
      const cx = (ci % 4) * cell;
      const cy = 1 - (Math.floor(ci / 4) + 1) * 0.5;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, cx + uv.getX(i) * cell, cy + uv.getY(i) * 0.5);
      sign.translate(0, 10.5, 0);
      sign.rotateY(Math.atan2(-p.side * f.rx[p.k], -p.side * f.rz[p.k])); // faces the road
      sign.translate(p.x, p.y, p.z);
      signGeos.push(sign);
      posts.add(p.s, place(p.x, p.y, p.z, 0, 1, 1, 1));
      n++;
    }
    if (signGeos.length) {
      const merged = mine(mergeGeometries(signGeos));
      merged.computeBoundingSphere();
      signGeos.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(merged, mat);
      mesh.userData.maxDist = 1600;
      group.add(mesh);
      chunks.push({ meshes: [mesh] });
    }
    posts.build(group);
    chunks.push(posts);
  }

  if (biome.props.cacti) {
    const geo = mine(cactusGeo());
    const mat = standard();
    const ch = new Chunked(geo, mat, 1300);
    for (let n = 0, tries = 0; n < biome.props.cacti && tries < biome.props.cacti * 6; tries++) {
      const p = spot(2, 260);
      if (!p) continue;
      const sc = 0.7 + rnd() * 1.1;
      ch.add(p.s, place(p.x, p.y - 0.1, p.z, rnd() * 6.28, sc, sc * (0.8 + rnd() * 0.5), sc), 0x4f8a4a + Math.floor(rnd() * 0x101010));
      n++;
    }
    ch.build(group);
    chunks.push(ch);
  }

  if (biome.props.rocks) {
    const geo = mine(rockGeo());
    const mat = standard();
    const ch = new Chunked(geo, mat, 1500);
    const tint = biome.id === 'desert' ? [0xb06a3a, 0xc27c46, 0x9a5a34] : [0x6c7684, 0x7e8898, 0x58626e];
    for (let n = 0, tries = 0; n < biome.props.rocks && tries < biome.props.rocks * 6; tries++) {
      const p = spot(1, 320);
      if (!p) continue;
      const sc = 1.2 + Math.pow(rnd(), 2) * 7;
      ch.add(p.s, place(p.x, p.y + sc * 0.2, p.z, rnd() * 6.28, sc * (0.9 + rnd() * 0.6), sc * (0.7 + rnd() * 0.7), sc * (0.9 + rnd() * 0.6)), tint[Math.floor(rnd() * tint.length)]);
      n++;
    }
    ch.build(group);
    chunks.push(ch);
  }

  if (biome.props.mesas) {
    const geo = mine(mesaGeo());
    const mat = standard();
    const ch = new Chunked(geo, mat, 2400);
    for (let n = 0, tries = 0; n < biome.props.mesas && tries < 400; tries++) {
      const p = spot(330, 1000);
      if (!p) continue;
      const w = 50 + rnd() * 80;
      const h = 60 + rnd() * 110;
      ch.add(p.s, place(p.x, floorY - 4, p.z, rnd() * 6.28, w, h, w * (0.7 + rnd() * 0.6)), 0xc0603a + Math.floor(rnd() * 0x181010));
      n++;
    }
    ch.build(group);
    chunks.push(ch);
  }

  if (biome.props.poles) {
    const geo = mine(poleGeo());
    const mat = standard({ flatShading: false });
    const ch = new Chunked(geo, mat, 1200);
    for (let s = 40, i = 0; s < track.length - 10; s += 90, i++) {
      const k = Math.min(sections, Math.round(s / SECTION));
      const lat = (i % 3 ? 1 : -1) * (f.width[k] / 2 + WALL_MARGIN + 3.5);
      ch.add(s, place(f.x[k] + f.rx[k] * lat, groundY(f, k, 2.8, floorY, true), f.z[k] + f.rz[k] * lat, Math.atan2(-f.rz[k], f.rx[k]), 1, 1, 1));
    }
    ch.build(group);
    chunks.push(ch);
  }

  if (biome.props.pines) {
    const geo = mine(pineGeo());
    const mat = standard();
    const ch = new Chunked(geo, mat, 1500);
    for (let n = 0, tries = 0; n < biome.props.pines && tries < biome.props.pines * 6; tries++) {
      const p = spot(1.5, 220);
      if (!p) continue;
      const sc = 0.8 + rnd() * 1.5;
      ch.add(p.s, place(p.x, p.y - 0.2, p.z, rnd() * 6.28, sc, sc * (0.9 + rnd() * 0.5), sc), 0xffffff);
      n++;
    }
    ch.build(group);
    chunks.push(ch);
  }

  const meshes = chunks.flatMap((c) => c.meshes);
  return {
    group,
    counts: { chunks: meshes.length },
    /** Hides chunks that are beyond their view distance (the frustum test is done by three.js). */
    update(camera) {
      const cp = camera.position;
      for (const m of meshes) {
        const sph = m.isInstancedMesh ? m.boundingSphere : m.geometry.boundingSphere;
        const d = cp.distanceTo(sph.center) - sph.radius;
        m.visible = d < m.userData.maxDist;
      }
    },
    dispose() {
      own.forEach((o) => o.dispose());
      group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    },
  };
}
