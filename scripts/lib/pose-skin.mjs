// Dev tool: poses a person (people/assemble.js) on the CPU with real three.js maths, so the poses and expressions can be reviewed in the
// software preview (scripts/mesh-preview.mjs) without a GPU. Mirrors what person.js does with a SkinnedMesh on the GPU.
import * as THREE from 'three';
import { applyPose } from '../../src/game3d/favors/people/pose-apply.js';

export function makeSkeleton(rig) {
  const objs = {};
  const rest = {};
  const list = rig.bones.map((b) => { const o = new THREE.Object3D(); o.name = b.name; objs[b.name] = o; return o; });
  const root = new THREE.Group();
  rig.bones.forEach((b, i) => {
    const parentPos = b.parent ? rig.bones.find((p) => p.name === b.parent).pos : [0, 0, 0];
    const local = [b.pos[0] - parentPos[0], b.pos[1] - parentPos[1], b.pos[2] - parentPos[2]];
    list[i].position.set(...local);
    rest[b.name] = local;
    (b.parent ? objs[b.parent] : root).add(list[i]);
  });
  root.updateMatrixWorld(true);
  const inv = list.map((o) => o.matrixWorld.clone().invert());
  return { root, objs, list, inv, rest };
}

/** Returns new meshes (same colours / indices) with positions and normals skinned to the pose. */
export function skinned(data, skel, pose, face) {
  applyPose(skel.objs, skel.rest, pose, face);
  skel.root.updateMatrixWorld(true);
  const M = skel.list.map((o, i) => new THREE.Matrix4().multiplyMatrices(o.matrixWorld, skel.inv[i]));
  const out = [];
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const acc = new THREE.Vector3();
  const accN = new THREE.Vector3();
  const nm = M.map((m) => new THREE.Matrix3().setFromMatrix4(m));
  for (const [name, m] of Object.entries(data.layers)) {
    const P = new Float32Array(m.positions.length);
    const N = new Float32Array(m.normals.length);
    for (let i = 0; i < m.vertexCount; i++) {
      acc.set(0, 0, 0); accN.set(0, 0, 0);
      for (let k = 0; k < 4; k++) {
        const w = m.skinWeight[i * 4 + k];
        if (w <= 0) continue;
        const b = m.skinIndex[i * 4 + k];
        v.set(m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]).applyMatrix4(M[b]);
        acc.addScaledVector(v, w);
        n.set(m.normals[i * 3], m.normals[i * 3 + 1], m.normals[i * 3 + 2]).applyMatrix3(nm[b]);
        accN.addScaledVector(n, w);
      }
      P[i * 3] = acc.x; P[i * 3 + 1] = acc.y; P[i * 3 + 2] = acc.z;
      accN.normalize();
      N[i * 3] = accN.x; N[i * 3 + 1] = accN.y; N[i * 3 + 2] = accN.z;
    }
    out.push({ ...m, positions: P, normals: N, layer: name });
  }
  // the mouth: built in the head frame, moved with the head bone
  if (data.mouth && face) {
    const mm = data.mouth({ w: face.w, smile: face.smile, open: face.open, round: face.round, asym: face.asym, teeth: face.teeth, tongue: face.tongue });
    const hm = skel.objs.head.matrixWorld;
    const P = new Float32Array(mm.positions.length);
    const N = new Float32Array(mm.normals.length);
    const nmh = new THREE.Matrix3().setFromMatrix4(hm);
    for (let i = 0; i < mm.vertexCount; i++) {
      v.set(mm.positions[i * 3], mm.positions[i * 3 + 1], mm.positions[i * 3 + 2]).applyMatrix4(hm); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
      n.set(mm.normals[i * 3], mm.normals[i * 3 + 1], mm.normals[i * 3 + 2]).applyMatrix3(nmh).normalize(); N[i * 3] = n.x; N[i * 3 + 1] = n.y; N[i * 3 + 2] = n.z;
    }
    out.push({ ...mm, positions: P, normals: N, layer: 'mouth' });
  }
  return out;
}
