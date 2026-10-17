// "Ori, Can You...?" — draws the passers-by. They are the same sculpted people as Ori (people/*), just meshed coarsely: a handful of ARCHETYPES (one
// per hairstyle) each become one instanced mesh whose vertices carry a code (colour slot + which limb), so the vertex shader swings the legs and arms
// and picks each instance's shirt, trousers, skin and hair colour: 40 different neighbours cost ~6 draw calls and no per-person work on the CPU.
import * as THREE from 'three';
import { getCrowdArchetype } from './people/loader.js';
import { CROWD_STYLES } from './people/crowd-figure.js';
import { BODY_SCALE } from './people/body.js';
import { groundHeight } from './map.js';

const SHIRTS = [0xe5625e, 0x4a90e2, 0xf2c14e, 0x43b581, 0xf3efe7, 0xb07ad8, 0xff9a62, 0x2fb8d8];
const PANTS = [0x2c3140, 0x4a4f58, 0x7a6a55, 0x30425f, 0xd9d3c4];
const SKINS = [0xf1c9a5, 0xd9a07a, 0xb97c58, 0x8a5a3c, 0x634029];
const HAIRS = [0x1e1612, 0x3a2a1c, 0x6b4a2a, 0xb5883e, 0x8c8c90, 0x120d0a];
const STYLES = CROWD_STYLES;
const RANGE = 95; // metres
const ATTRS = ['iShirt', 'iPants', 'iSkin', 'iHair', 'iFreq', 'iPhase'];
const fwd = new THREE.Vector3();
const S = BODY_SCALE;

/** One archetype as a three.js geometry (the typed arrays were made by people/crowd-figure.js, in the worker when it could). */
function archetype(style) {
  const m = getCrowdArchetype(style);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.position.slice(), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normal.slice(), 3));
  g.setAttribute('color', new THREE.BufferAttribute(m.color.slice(), 3));
  g.setAttribute('aCode', new THREE.BufferAttribute(m.code.slice(), 1));
  g.setIndex(new THREE.BufferAttribute(m.index.slice(), 1));
  g.computeBoundingSphere();
  return g;
}

/**
 * extras: people who just stand somewhere (on a balcony, at a window): [{ x, y, z, heading, look: { hair, shirt, pants, skin, height } }]. They are drawn with the walkers.
 */
export function createCrowd3d(map, crowd, { shadows = true, extras = [] } = {}) {
  const folk = [...crowd.walkers, ...extras.map((e) => ({ x: e.x, y: e.y, z: e.z, heading: e.heading, look: e.look, speed: 0, still: true }))];
  // which archetype each walker is
  const style = folk.map((w, i) => (w.look.hair * 5 + w.look.shirt * 3 + i * 7) % STYLES.length);
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
      const w = folk[wi];
      c.set(SHIRTS[w.look.shirt % SHIRTS.length]).toArray(iShirt, j * 3);
      c.set(PANTS[w.look.pants % PANTS.length]).toArray(iPants, j * 3);
      c.set(SKINS[w.look.skin % SKINS.length]).toArray(iSkin, j * 3);
      c.set(HAIRS[w.look.hair % HAIRS.length]).toArray(iHair, j * 3);
      iFreq[j] = w.speed * 5.2;
      iPhase[j] = w.still ? 0 : (wi * 1.7) % 6.28;
    });
    const base = { iShirt: iShirt.slice(), iPants: iPants.slice(), iSkin: iSkin.slice(), iHair: iHair.slice(), iFreq: iFreq.slice(), iPhase: iPhase.slice() };
    const dyn = {};
    for (const [k, arr, size] of [['iShirt', iShirt, 3], ['iPants', iPants, 3], ['iSkin', iSkin, 3], ['iHair', iHair, 3], ['iFreq', iFreq, 1], ['iPhase', iPhase, 1]]) {
      dyn[k] = new THREE.InstancedBufferAttribute(arr, size);
      dyn[k].setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(k, dyn[k]);
    }
    const im = new THREE.InstancedMesh(geo, mat, m);
    im.castShadow = shadows;
    im.frustumCulled = false;
    im.name = `crowd-${gr.name}`;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    meshes.push({ im, walkers: gr.walkers, base, dyn });
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
    /** Draws only the people the camera can see (within `RANGE` metres and not behind it): the others cost nothing, in the main pass or in the shadow pass. */
    update(time, camera = null) {
      uTime.value = time;
      let fx = 0; let fz = 0; let cx = 0; let cz = 0;
      if (camera) { camera.getWorldDirection(fwd); fx = fwd.x; fz = fwd.z; cx = camera.position.x; cz = camera.position.z; }
      for (const e of meshes) {
        let n = 0;
        e.walkers.forEach((wi, j) => {
          const w = folk[wi];
          if (camera) {
            const dx = w.x - cx; const dz = w.z - cz;
            const d = Math.hypot(dx, dz);
            if (d > RANGE || (d > 14 && dx * fx + dz * fz < -0.25 * d)) return; // too far, or behind the camera
          }
          q.setFromAxisAngle(up, w.heading);
          const sz = w.look.height;
          mtx.compose(pos.set(w.x, w.y != null ? w.y : groundHeight(map, w.x, w.z), w.z), q, sc.set(sz, sz, sz));
          e.im.setMatrixAt(n, mtx);
          for (const k of ATTRS) {
            const size = k === 'iFreq' || k === 'iPhase' ? 1 : 3;
            const src = e.base[k]; const dst = e.dyn[k].array;
            for (let c = 0; c < size; c++) dst[n * size + c] = src[j * size + c];
          }
          n++;
        });
        e.im.count = n;
        e.im.visible = n > 0;
        e.im.instanceMatrix.needsUpdate = true;
        for (const k of ATTRS) e.dyn[k].needsUpdate = true;
      }
    },
    dispose() { meshes.forEach((e) => { e.im.geometry.dispose(); e.im.dispose(); }); mat.dispose(); },
  };
}
