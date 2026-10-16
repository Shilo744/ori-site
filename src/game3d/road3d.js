// NEON DRIFT — the road as meshes: the banked ribbon with its procedural-marking shader, jersey barriers with neon strips,
// and the ground under the road (sloped embankments or a viaduct). Built from "frames" sampled along the pure track tables.
import * as THREE from 'three';
import { frameAt, surfaceNormal, WALL_MARGIN } from './track.js';

export const SECTION = 4; // metres between cross-sections

/** Samples the track every SECTION metres: position, right vector, bank, width, surface normal, arc length. */
export function sampleFrames(track) {
  const count = Math.ceil(track.length / SECTION);
  const f = {
    count,
    n: count + 1,
    s: new Float32Array(count + 1),
    x: new Float32Array(count + 1), y: new Float32Array(count + 1), z: new Float32Array(count + 1),
    rx: new Float32Array(count + 1), rz: new Float32Array(count + 1),
    tx: new Float32Array(count + 1), tz: new Float32Array(count + 1),
    nx: new Float32Array(count + 1), ny: new Float32Array(count + 1), nz: new Float32Array(count + 1),
    bank: new Float32Array(count + 1), width: new Float32Array(count + 1), heading: new Float32Array(count + 1),
  };
  const fr = {};
  const nm = {};
  for (let k = 0; k <= count; k++) {
    const s = (k / count) * track.length;
    frameAt(track, s % track.length, fr);
    surfaceNormal(fr, nm);
    f.s[k] = s;
    f.x[k] = fr.x; f.y[k] = fr.y; f.z[k] = fr.z;
    f.rx[k] = fr.rx; f.rz[k] = fr.rz; f.tx[k] = fr.tx; f.tz[k] = fr.tz;
    f.nx[k] = nm.nx; f.ny[k] = nm.ny; f.nz[k] = nm.nz;
    f.bank[k] = fr.bank; f.width[k] = fr.width; f.heading[k] = fr.heading;
  }
  return f;
}

/** World point at lateral offset `lat` (+ right) and height `h` above the surface of section k. */
export function framePoint(f, k, lat, h, out) {
  const cb = Math.cos(f.bank[k]);
  const sb = Math.sin(f.bank[k]);
  out.x = f.x[k] + f.rx[k] * lat * cb + f.nx[k] * h;
  out.y = f.y[k] - sb * lat + f.ny[k] * h;
  out.z = f.z[k] + f.rz[k] * lat * cb + f.nz[k] * h;
  return out;
}

// ── the ribbon ──────────────────────────────────────────────────────────────

const ROAD_VERT_HEAD = /* glsl */ `
attribute vec3 aRoad;
varying vec3 vRoad;
`;
const ROAD_FRAG_HEAD = /* glsl */ `
varying vec3 vRoad;
uniform vec3 uAsphalt, uRunoff, uKerbA, uKerbB, uLine, uNeonL, uNeonR;
uniform float uWet;
float roadOn;
float roadLum;
`;
const ROAD_FRAG_COLOR = /* glsl */ `
{
  float lat = vRoad.x;
  float hw = vRoad.y;
  float along = vRoad.z;
  float a = abs(lat);
  float px = max(fwidth(lat), 0.02);
  roadLum = clamp(dot(diffuseColor.rgb, vec3(0.3333)) / 0.2, 0.0, 2.0);
  roadOn = 1.0 - smoothstep(hw - px, hw + px, a);
  float kerbZone = smoothstep(hw - px, hw + px, a) * (1.0 - smoothstep(hw + 2.4 - px, hw + 2.4 + px, a));
  vec3 asphalt = uAsphalt * (0.55 + 0.9 * roadLum);
  vec3 outside = uRunoff * (0.6 + 0.8 * roadLum);
  vec3 col = mix(outside, asphalt, roadOn);
  float stripe = step(0.5, fract(along / 5.0));
  col = mix(col, mix(uKerbA, uKerbB, stripe), kerbZone);
  float edgeLine = smoothstep(hw - 0.95 - px, hw - 0.95 + px, a) - smoothstep(hw - 0.62 - px, hw - 0.62 + px, a);
  float dash = step(fract(along / 12.0), 0.34) * (1.0 - smoothstep(0.14 - px, 0.14 + px, a));
  col = mix(col, uLine * (0.8 + 0.3 * roadLum), clamp(edgeLine + dash, 0.0, 1.0) * 0.94);
  // start / finish chequer
  if (along < 4.0 && a < hw - 1.0) {
    float chk = mod(floor(lat * 0.5) + floor(along * 0.5), 2.0);
    col = mix(col, vec3(chk * 0.9 + 0.04), 0.96);
  }
  diffuseColor.rgb = col;
}
`;
const ROAD_FRAG_ROUGH = /* glsl */ `
roughnessFactor = mix(roughnessFactor, 0.24 + 0.2 * (1.0 - clamp(roadLum, 0.0, 1.0)), uWet * roadOn);
`;
const ROAD_FRAG_EMISSIVE = /* glsl */ `
{
  float lat = vRoad.x;
  float hw = vRoad.y;
  float px = max(fwidth(lat), 0.02);
  float edge = hw + 2.4;
  float strip = 1.0 - smoothstep(0.1, 0.1 + px + 0.1, abs(abs(lat) - edge + 0.1));
  vec3 neon = lat < 0.0 ? uNeonL : uNeonR;
  totalEmissiveRadiance += neon * strip * 2.0;
}
`;

/** The road ribbon: one mesh, one material (MeshStandardMaterial extended with the road markings). */
export function buildRoadMesh(track, f, biome, asphaltMap) {
  const cols = 6;
  const nv = f.n * cols;
  const pos = new Float32Array(nv * 3);
  const nor = new Float32Array(nv * 3);
  const uv = new Float32Array(nv * 2);
  const road = new Float32Array(nv * 3);
  const idx = new Uint32Array(f.count * (cols - 1) * 6);
  const p = {};
  let ii = 0;
  for (let k = 0; k <= f.count; k++) {
    const hw = f.width[k] / 2;
    const offs = [-(hw + WALL_MARGIN), -(hw + 2.4), -hw, hw, hw + 2.4, hw + WALL_MARGIN];
    for (let c = 0; c < cols; c++) {
      const v = k * cols + c;
      framePoint(f, k, offs[c], 0, p);
      pos[v * 3] = p.x; pos[v * 3 + 1] = p.y; pos[v * 3 + 2] = p.z;
      nor[v * 3] = f.nx[k]; nor[v * 3 + 1] = f.ny[k]; nor[v * 3 + 2] = f.nz[k];
      uv[v * 2] = offs[c] / 8;
      uv[v * 2 + 1] = f.s[k] / 8;
      road[v * 3] = offs[c]; road[v * 3 + 1] = hw; road[v * 3 + 2] = f.s[k];
    }
    if (k < f.count) {
      for (let c = 0; c < cols - 1; c++) {
        const a = k * cols + c;
        const b = a + 1;
        const a2 = a + cols;
        const b2 = b + cols;
        idx[ii++] = a; idx[ii++] = b; idx[ii++] = b2;
        idx[ii++] = a; idx[ii++] = b2; idx[ii++] = a2;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aRoad', new THREE.BufferAttribute(road, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  const r = biome.road;
  const mat = new THREE.MeshStandardMaterial({ map: asphaltMap, roughness: 0.82, metalness: 0, envMapIntensity: 1 });
  const uniforms = {
    uAsphalt: { value: new THREE.Color(r.asphalt) },
    uRunoff: { value: new THREE.Color(r.runoff) },
    uKerbA: { value: new THREE.Color(r.kerbA) },
    uKerbB: { value: new THREE.Color(r.kerbB) },
    uLine: { value: new THREE.Color(r.line) },
    uNeonL: { value: new THREE.Color(r.neonL) },
    uNeonR: { value: new THREE.Color(r.neonR) },
    uWet: { value: r.wet },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${ROAD_VERT_HEAD}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoad = aRoad;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${ROAD_FRAG_HEAD}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${ROAD_FRAG_COLOR}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${ROAD_FRAG_ROUGH}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${ROAD_FRAG_EMISSIVE}`);
  };
  mat.customProgramCacheKey = () => 'neon-drift-road';
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'road';
  mesh.frustumCulled = false;
  mesh.userData.uniforms = uniforms;
  return mesh;
}

// ── sweeps: a 2D profile extruded along one side of the road ───────────────

/**
 * Extrudes `profile` (pairs of [outwardOffset, height], from the inner base towards the outside) along the road edge at
 * `edge(k)` metres from the centre line, on `side` (-1 left, +1 right). Flat-shaded per profile segment, with a vertex colour
 * per quad from `colorOf(k, seg)`; sections where `skip(k)` is true are left out.
 * @returns {{ pos: number[], nor: number[], col: number[], idx: number[] }}
 */
export function sweep(f, side, edge, profile, colorOf, skip) {
  const pos = [];
  const nor = [];
  const col = [];
  const idx = [];
  const a = {};
  const b = {};
  const c = new THREE.Color();
  for (let k = 1; k <= f.count; k++) {
    if (skip && skip(k)) continue;
    for (let j = 0; j < profile.length - 1; j++) {
      const [o0, h0] = profile[j];
      const [o1, h1] = profile[j + 1];
      const base = pos.length / 3;
      // segment normal in the (outward, up) plane, rotated into the banked frame
      let dn = o1 - o0;
      let dh = h1 - h0;
      const l = Math.hypot(dn, dh) || 1;
      dn /= l; dh /= l;
      const no = -dh; // the profile runs outward/upwards: its normal is (−dh, dn) in the (outward, up) plane
      const nh = dn;
      const e0 = edge(k - 1);
      const e1 = edge(k);
      for (const [kk, e] of [[k - 1, e0], [k, e1]]) {
        for (const [o, h] of [[o0, h0], [o1, h1]]) {
          framePoint(f, kk, side * (e + o), h, a);
          pos.push(a.x, a.y, a.z);
        }
      }
      // normals use the section of the far end (flat per quad)
      const cb = Math.cos(f.bank[k]);
      const sb = Math.sin(f.bank[k]);
      const outX = side * f.rx[k] * cb;
      const outY = -side * sb;
      const outZ = side * f.rz[k] * cb;
      const nx = outX * no + f.nx[k] * nh;
      const ny = outY * no + f.ny[k] * nh;
      const nz = outZ * no + f.nz[k] * nh;
      for (let m = 0; m < 4; m++) nor.push(nx, ny, nz);
      c.set(colorOf(k, j));
      for (let m = 0; m < 4; m++) col.push(c.r, c.g, c.b);
      // vertex order: (k-1,p0) (k-1,p1) (k,p0) (k,p1)
      if (side > 0) idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
      else idx.push(base, base + 3, base + 1, base, base + 2, base + 3);
    }
  }
  return { pos, nor, col, idx };
}

/** Merges sweep results into one BufferGeometry. */
export function toGeometry(parts) {
  const pos = [];
  const nor = [];
  const col = [];
  const idx = [];
  for (const s of parts) {
    const off = pos.length / 3;
    for (let i = 0; i < s.pos.length; i++) pos.push(s.pos[i]);
    for (let i = 0; i < s.nor.length; i++) nor.push(s.nor[i]);
    for (let i = 0; i < s.col.length; i++) col.push(s.col[i]);
    for (let i = 0; i < s.idx.length; i++) idx.push(s.idx[i] + off);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

const JERSEY = [[0, -0.35], [0, 0.1], [0.16, 0.5], [0.3, 1.1], [0.72, 1.1], [0.72, -0.35]];
const NEON_STRIP = [[-0.02, 0.62], [-0.02, 0.86]];

/**
 * Barriers on both sides (jersey profile) + a glowing strip on their inner face.
 * `skip(k)` leaves out sections (tunnels / bridges have their own walls).
 */
export function buildBarriers(track, f, biome, skip) {
  const wallA = new THREE.Color(biome.wall.a);
  const wallB = new THREE.Color(biome.wall.b);
  const edge = (k) => f.width[Math.min(k, f.count)] / 2 + WALL_MARGIN;
  const colorOf = (k, j) => ((Math.floor(k / 3) & 1 ? wallA : wallB).getHex() + (j === 3 ? 0x080808 : 0));
  const parts = [];
  for (const side of [-1, 1]) parts.push(sweep(f, side, edge, JERSEY, colorOf, skip));
  const body = new THREE.Mesh(toGeometry(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.05, side: THREE.DoubleSide }));
  body.name = 'barriers';
  body.frustumCulled = false;
  const nl = new THREE.Color(biome.road.neonL);
  const nr = new THREE.Color(biome.road.neonR);
  const strips = [];
  for (const side of [-1, 1]) {
    // the strip sits on the INNER face: profile offsets run outward, so it is placed at a slightly negative offset
    const s = sweep(f, side, edge, NEON_STRIP, () => (side < 0 ? nl : nr).getHex(), skip);
    strips.push(s);
  }
  const neonMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  neonMat.color.setScalar(1.9); // HDR: the bloom picks the strip up
  const neon = new THREE.Mesh(toGeometry(strips), neonMat);
  neon.name = 'barrier-neon';
  neon.frustumCulled = false;
  return { body, neon };
}

/**
 * Ground under the road. 'slope': an embankment from the barrier foot down to the floor (colour from the biome);
 * 'viaduct': a vertical concrete beam under each edge. Returns { mesh, depthAt(k) } (depth = road height above the floor).
 */
export function buildSupport(track, f, biome, floorY, skip) {
  const kind = biome.embank;
  const edge = (k) => f.width[Math.min(k, f.count)] / 2 + WALL_MARGIN + 0.72;
  const depth = (k) => Math.max(1.2, f.y[Math.min(k, f.count)] - floorY + 0.6);
  const top = new THREE.Color(biome.embankColor);
  const parts = [];
  for (const side of [-1, 1]) {
    let prof;
    if (kind === 'slope') prof = [[0, -0.3], [8, -6]]; // refined per section below
    else prof = [[0, -0.35], [0, -2.4]];
    if (kind === 'viaduct') {
      parts.push(sweep(f, side, edge, prof, (k) => (Math.floor(k / 8) & 1 ? 0x2a2640 : 0x322e4c), skip));
    } else {
      // embankment: a ramp whose length follows the height of the road above the ground
      const s = { pos: [], nor: [], col: [], idx: [] };
      const a = {};
      const c = new THREE.Color();
      for (let k = 1; k <= f.count; k++) {
        if (skip && skip(k)) continue;
        const base = s.pos.length / 3;
        for (const kk of [k - 1, k]) {
          const d = depth(kk);
          const e = edge(kk);
          framePoint(f, kk, side * e, -0.3, a); s.pos.push(a.x, a.y, a.z);
          const run = d * 1.9 + 3;
          framePoint(f, kk, side * (e + run), 0, a); s.pos.push(a.x, floorY - 0.2, a.z);
        }
        // vertex order: (k-1,top) (k-1,bottom) (k,top) (k,bottom)
        const sx = side * f.rx[k];
        const sz = side * f.rz[k];
        const slope = 1 / 1.9; // drops 1 m per 1.9 m run: the normal leans outwards by that much
        const nl = Math.hypot(1, slope);
        for (let m = 0; m < 4; m++) s.nor.push((sx * slope) / nl, 1 / nl, (sz * slope) / nl);
        c.copy(top).multiplyScalar(0.85 + 0.3 * ((Math.floor(k / 5) * 37) % 11) / 11);
        for (let m = 0; m < 4; m++) s.col.push(c.r, c.g, c.b);
        if (side > 0) s.idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
        else s.idx.push(base, base + 3, base + 1, base, base + 2, base + 3);
      }
      parts.push(s);
    }
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: kind === 'slope' ? 0.95 : 0.8, metalness: 0, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(toGeometry(parts), mat);
  mesh.name = 'support';
  mesh.frustumCulled = false;
  return { mesh, depthAt: depth };
}
