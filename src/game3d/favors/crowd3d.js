// "Ori, Can You...?" — draws the passers-by. They are the same sculpted people as Ori (people/*), just meshed coarsely: a handful of ARCHETYPES (one
// per hairstyle) each become one instanced mesh whose vertices carry a code (colour slot + which limb), so the vertex shader swings the legs and arms
// and picks each instance's shirt, trousers, skin and hair colour: 40 different neighbours cost ~6 draw calls and no per-person work on the CPU.
import * as THREE from 'three';
import { buildPersonData } from './people/assemble.js';
import { randomSpec } from './people/specs.js';
import { BODY_SCALE } from './people/body.js';
import { groundHeight } from './map.js';

const SHIRTS = [0xe5625e, 0x4a90e2, 0xf2c14e, 0x43b581, 0xf3efe7, 0xb07ad8, 0xff9a62, 0x2fb8d8];
const PANTS = [0x2c3140, 0x4a4f58, 0x7a6a55, 0x30425f, 0xd9d3c4];
const SKINS = [0xf1c9a5, 0xd9a07a, 0xb97c58, 0x8a5a3c, 0x634029];
const HAIRS = [0x1e1612, 0x3a2a1c, 0x6b4a2a, 0xb5883e, 0x8c8c90, 0x120d0a];
const STYLES = ['short', 'curly', 'long', 'bun', 'wavy', 'bald'];
const SLOT = { tee: 0, jeans: 1, skin: 2, hair: 3, shoes: 4 };
const S = BODY_SCALE;

const white = '#ffffff';
/** One archetype: the person data with every colour white (so the vertex colour is just the baked occlusion) and a code per vertex. */
function archetype(style) {
  const spec = randomSpec(11 + STYLES.indexOf(style) * 7, { hair: style, gender: style === 'long' || style === 'bun' ? 'f' : 'm', age: 'adult' });
  spec.face = { ...spec.face, skin: white, blush: 0, stubble: 0, lipColor: white };
  spec.outfit = { ...spec.outfit, topColor: white, bottomColor: white, shoeColor: white, soleColor: white, accent: white, skin: white, sleeve: 1, bottom: 'jeans' };
  spec.hair = { ...spec.hair, color: white, highlight: white };
  spec.glasses = null; spec.facialHair = null; spec.hoop = null; spec.chain = null;
  spec.body = { ...spec.body, build: 1, belly: 0, shoulders: 1 };
  const data = buildPersonData(spec, { crowd: true });
  const names = data.rig.bones.map((b) => b.name);
  const limbOf = (bone) => { const n = names[bone]; if (/^(upperArm|lowerArm|hand|finger|thumb)L/.test(n)) return 3; if (/^(upperArm|lowerArm|hand|finger|thumb)R/.test(n)) return 4; if (/^(upLeg|lowLeg|foot|toe)L/.test(n)) return 1; if (/^(upLeg|lowLeg|foot|toe)R/.test(n)) return 2; return 0; };
  const A = data.anchors;
  const H = data.headPos;
  const eyes = [[A.eye.x, A.eye.y, A.eye.z], [-A.eye.x, A.eye.y, A.eye.z]].map((e) => [H[0] + e[0], H[1] + e[1], H[2] + e[2]]);
  const pos = []; const nor = []; const col = []; const code = []; const idx = [];
  let base = 0;
  for (const [layer, m] of Object.entries(data.layers)) {
    for (let i = 0; i < m.vertexCount; i++) {
      pos.push(m.positions[i * 3] , m.positions[i * 3 + 1], m.positions[i * 3 + 2]);
      nor.push(m.normals[i * 3], m.normals[i * 3 + 1], m.normals[i * 3 + 2]);
      const ao = Math.min(1, (m.colors[i * 3] + m.colors[i * 3 + 1] + m.colors[i * 3 + 2]) / 3 * 1.0);
      col.push(ao, ao, ao);
      // the dominant bone gives the limb
      let best = 0; let bw = 0;
      for (let k = 0; k < 4; k++) if (m.skinWeight[i * 4 + k] > bw) { bw = m.skinWeight[i * 4 + k]; best = m.skinIndex[i * 4 + k]; }
      let slot = SLOT[layer];
      if (layer === 'skin') for (const e of eyes) if (Math.hypot(m.positions[i * 3] - e[0], m.positions[i * 3 + 1] - e[1], (m.positions[i * 3 + 2] - e[2]) * 0.5) < 0.026) slot = 4; // eyes
      code.push(slot + 10 * limbOf(best));
    }
    for (let i = 0; i < m.indices.length; i++) idx.push(m.indices[i] + base);
    base += m.vertexCount;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aCode', new THREE.Float32BufferAttribute(code, 1));
  g.setIndex(new THREE.Uint32BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

export function createCrowd3d(map, crowd, { shadows = true } = {}) {
  const n = crowd.walkers.length;
  // which archetype each walker is
  const style = crowd.walkers.map((w, i) => (w.look.hair * 5 + w.look.shirt * 3 + i * 7) % STYLES.length);
  const groups = STYLES.map((name, si) => ({ name, si, walkers: [] }));
  style.forEach((si, i) => groups[si].walkers.push(i));
  const uTime = { value: 0 };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aCode; attribute vec3 iShirt, iPants, iSkin, iHair; attribute float iFreq, iPhase;
        uniform float uTime;
        vec3 npcColor(float slot) {
          if (slot < 0.5) return iShirt;
          if (slot < 1.5) return iPants;
          if (slot < 2.5) return iSkin;
          if (slot < 3.5) return iHair;
          return vec3(0.06, 0.055, 0.06);
        }
        vec3 swing(vec3 p, vec3 pivot, float a) {
          float cs = cos(a), sn = sin(a);
          vec3 d = p - pivot;
          return pivot + vec3(d.x, d.y * cs - d.z * sn, d.y * sn + d.z * cs);
        }`)
      .replace('#include <color_vertex>', `#include <color_vertex>
        float slot = mod(aCode, 10.0);
        float limb = floor(aCode / 10.0 + 0.5);
        vColor = npcColor(slot) * color.rgb;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float s = sin(uTime * iFreq + iPhase) * 0.7;
        if (limb > 0.5 && limb < 1.5) transformed = swing(transformed, vec3(${(0.098 * S).toFixed(3)}, ${(0.87 * S).toFixed(3)}, 0.0), s);
        else if (limb > 1.5 && limb < 2.5) transformed = swing(transformed, vec3(${(-0.098 * S).toFixed(3)}, ${(0.87 * S).toFixed(3)}, 0.0), -s);
        else if (limb > 2.5 && limb < 3.5) transformed = swing(transformed, vec3(${(0.205 * S).toFixed(3)}, ${(1.285 * S).toFixed(3)}, 0.0), -s * 0.9);
        else if (limb > 3.5) transformed = swing(transformed, vec3(${(-0.205 * S).toFixed(3)}, ${(1.285 * S).toFixed(3)}, 0.0), s * 0.9);
        transformed.y += abs(sin(uTime * iFreq * 0.5 + iPhase)) * 0.025;`);
  };
  mat.customProgramCacheKey = () => 'ori-crowd';

  const meshes = [];
  const c = new THREE.Color();
  for (const gr of groups) {
    if (!gr.walkers.length) continue;
    const geo = archetype(gr.name);
    const m = gr.walkers.length;
    const iShirt = new Float32Array(m * 3); const iPants = new Float32Array(m * 3); const iSkin = new Float32Array(m * 3); const iHair = new Float32Array(m * 3);
    const iFreq = new Float32Array(m); const iPhase = new Float32Array(m);
    gr.walkers.forEach((wi, j) => {
      const w = crowd.walkers[wi];
      c.set(SHIRTS[w.look.shirt % SHIRTS.length]).toArray(iShirt, j * 3);
      c.set(PANTS[w.look.pants % PANTS.length]).toArray(iPants, j * 3);
      c.set(SKINS[w.look.skin % SKINS.length]).toArray(iSkin, j * 3);
      c.set(HAIRS[w.look.hair % HAIRS.length]).toArray(iHair, j * 3);
      iFreq[j] = w.speed * 5.2;
      iPhase[j] = (wi * 1.7) % 6.28;
    });
    geo.setAttribute('iShirt', new THREE.InstancedBufferAttribute(iShirt, 3));
    geo.setAttribute('iPants', new THREE.InstancedBufferAttribute(iPants, 3));
    geo.setAttribute('iSkin', new THREE.InstancedBufferAttribute(iSkin, 3));
    geo.setAttribute('iHair', new THREE.InstancedBufferAttribute(iHair, 3));
    geo.setAttribute('iFreq', new THREE.InstancedBufferAttribute(iFreq, 1));
    geo.setAttribute('iPhase', new THREE.InstancedBufferAttribute(iPhase, 1));
    const im = new THREE.InstancedMesh(geo, mat, m);
    im.castShadow = shadows;
    im.frustumCulled = false;
    im.name = `crowd-${gr.name}`;
    meshes.push({ im, walkers: gr.walkers });
  }
  const root = new THREE.Group();
  root.name = 'crowd';
  meshes.forEach((e) => root.add(e.im));
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const sc = new THREE.Vector3();

  return {
    mesh: root,
    update(time) {
      uTime.value = time;
      for (const e of meshes) {
        e.walkers.forEach((wi, j) => {
          const w = crowd.walkers[wi];
          q.setFromAxisAngle(up, w.heading);
          const sz = w.look.height;
          mtx.compose(pos.set(w.x, groundHeight(map, w.x, w.z), w.z), q, sc.set(sz, sz, sz));
          e.im.setMatrixAt(j, mtx);
        });
        e.im.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() { meshes.forEach((e) => { e.im.geometry.dispose(); e.im.dispose(); }); mat.dispose(); },
  };
}
