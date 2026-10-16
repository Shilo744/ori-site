// "Ori, Can You...?" — draws the passers-by: ONE instanced mesh for the whole crowd. The body is a merged low-poly figure whose vertices
// carry a code (colour slot + limb); the vertex shader swings the legs and arms around the hip / shoulder and picks each instance's shirt,
// trousers, skin and hair colour, so 40 people with their own look and walk cost a single draw call.
import * as THREE from 'three';
import { GeoBuilder } from './gfx.js';
import { groundHeight } from './map.js';

const SHIRTS = [0xe5625e, 0x4a90e2, 0xf2c14e, 0x43b581, 0xf3efe7, 0xb07ad8, 0xff9a62, 0x2fb8d8];
const PANTS = [0x2c3140, 0x4a4f58, 0x7a6a55, 0x30425f, 0xd9d3c4];
const SKINS = [0xf1c9a5, 0xd9a07a, 0xb97c58, 0x8a5a3c, 0x634029];
const HAIRS = [0x1e1612, 0x3a2a1c, 0x6b4a2a, 0xb5883e, 0x8c8c90, 0x120d0a];
const LEG = 1; const ARM = 3; // limb codes: 1 left leg, 2 right leg, 3 left arm, 4 right arm (code = slot + 10 * limb)

function figure() {
  const B = new GeoBuilder();
  const m = new THREE.Matrix4();
  const put = (g, x, y, z, code, sx = 1, sy = 1, sz = 1) => { B.attr = code; B.geometry(g, m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)), 0xffffff); g.dispose(); };
  const legG = () => new THREE.CapsuleGeometry(0.058, 0.6, 3, 6);
  put(legG(), -0.085, 0.45, 0, 1 + 10 * 1);
  put(legG(), 0.085, 0.45, 0, 1 + 10 * 2);
  put(new THREE.BoxGeometry(0.11, 0.07, 0.24), -0.085, 0.04, 0.04, 4 + 10 * 1);
  put(new THREE.BoxGeometry(0.11, 0.07, 0.24), 0.085, 0.04, 0.04, 4 + 10 * 2);
  put(new THREE.CapsuleGeometry(0.15, 0.3, 3, 8), 0, 1.12, 0, 0, 1, 1, 0.72);
  const armG = () => new THREE.CapsuleGeometry(0.045, 0.46, 3, 6);
  put(armG(), -0.21, 1.12, 0, 0 + 10 * 3);
  put(armG(), 0.21, 1.12, 0, 0 + 10 * 4);
  put(new THREE.SphereGeometry(0.12, 10, 8), 0, 1.58, 0, 2, 0.92, 1.05, 0.95);
  put(new THREE.SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), 0, 1.6, -0.015, 3);
  return B.build({ extraName: 'aCode' });
}

export function createCrowd3d(map, crowd, { shadows = true } = {}) {
  const n = crowd.walkers.length;
  const geo = figure();
  const iShirt = new Float32Array(n * 3);
  const iPants = new Float32Array(n * 3);
  const iSkin = new Float32Array(n * 3);
  const iHair = new Float32Array(n * 3);
  const iFreq = new Float32Array(n);
  const iPhase = new Float32Array(n);
  const c = new THREE.Color();
  crowd.walkers.forEach((w, i) => {
    c.set(SHIRTS[w.look.shirt % SHIRTS.length]).toArray(iShirt, i * 3);
    c.set(PANTS[w.look.pants % PANTS.length]).toArray(iPants, i * 3);
    c.set(SKINS[w.look.skin % SKINS.length]).toArray(iSkin, i * 3);
    c.set(HAIRS[w.look.hair % HAIRS.length]).toArray(iHair, i * 3);
    iFreq[i] = w.speed * 5.2;
    iPhase[i] = (i * 1.7) % 6.28;
  });
  geo.setAttribute('iShirt', new THREE.InstancedBufferAttribute(iShirt, 3));
  geo.setAttribute('iPants', new THREE.InstancedBufferAttribute(iPants, 3));
  geo.setAttribute('iSkin', new THREE.InstancedBufferAttribute(iSkin, 3));
  geo.setAttribute('iHair', new THREE.InstancedBufferAttribute(iHair, 3));
  geo.setAttribute('iFreq', new THREE.InstancedBufferAttribute(iFreq, 1));
  geo.setAttribute('iPhase', new THREE.InstancedBufferAttribute(iPhase, 1));

  const uTime = { value: 0 };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
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
          return vec3(0.93);
        }
        vec3 swing(vec3 p, vec3 pivot, float a) {
          float cs = cos(a), sn = sin(a);
          vec3 d = p - pivot;
          return pivot + vec3(d.x, d.y * cs - d.z * sn, d.y * sn + d.z * cs);
        }`)
      .replace('#include <color_vertex>', `#include <color_vertex>
        float slot = mod(aCode, 10.0);
        float limb = floor(aCode / 10.0 + 0.5);
        vColor = npcColor(slot);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float s = sin(uTime * iFreq + iPhase) * 0.7;
        if (limb > 0.5 && limb < 1.5) transformed = swing(transformed, vec3(-0.085, 0.82, 0.0), s);
        else if (limb > 1.5 && limb < 2.5) transformed = swing(transformed, vec3(0.085, 0.82, 0.0), -s);
        else if (limb > 2.5 && limb < 3.5) transformed = swing(transformed, vec3(-0.21, 1.38, 0.0), -s * 0.9);
        else if (limb > 3.5) transformed = swing(transformed, vec3(0.21, 1.38, 0.0), s * 0.9);
        transformed.y += abs(sin(uTime * iFreq * 0.5 + iPhase)) * 0.025;`);
  };

  const im = new THREE.InstancedMesh(geo, mat, n);
  im.castShadow = shadows;
  im.frustumCulled = false;
  im.name = 'crowd';
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const sc = new THREE.Vector3();

  return {
    mesh: im,
    update(time) {
      uTime.value = time;
      crowd.walkers.forEach((w, i) => {
        q.setFromAxisAngle(up, w.heading);
        const s = w.look.height;
        m.compose(pos.set(w.x, groundHeight(map, w.x, w.z), w.z), q, sc.set(s, s, s));
        im.setMatrixAt(i, m);
      });
      im.instanceMatrix.needsUpdate = true;
    },
    dispose() { geo.dispose(); mat.dispose(); im.dispose(); },
  };
}

void LEG; void ARM;
