// Merges the static meshes of a prop into one mesh per material (fewer draw calls). Keeps the group's own transform;
// instanced meshes and anything animated should be left out (build those separately).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _inv = new THREE.Matrix4();

/** Every geometry must expose position / normal / uv, and be non-indexed, for mergeGeometries to accept them. */
function prepare(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
}

/**
 * @param {THREE.Group} group  a freshly built prop (its transform is kept as is)
 * @returns {THREE.Group}      same transform, children replaced by one merged mesh per material
 */
export function mergeByMaterial(group) {
  group.updateMatrixWorld(true);
  _inv.copy(group.matrixWorld).invert();
  const buckets = new Map(); // material → { list: geometries, cast, receive }
  const keep = [];
  group.traverse((o) => {
    if (o === group) return;
    if (o.isInstancedMesh || o.isSkinnedMesh || !o.isMesh || Array.isArray(o.material)) {
      if (o.isMesh) keep.push(o);
      return;
    }
    const geo = prepare(o.geometry);
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(_inv, o.matrixWorld));
    let b = buckets.get(o.material);
    if (!b) buckets.set(o.material, (b = { list: [], cast: false, receive: false }));
    b.list.push(geo);
    b.cast = b.cast || o.castShadow;
    b.receive = b.receive || o.receiveShadow;
  });
  const out = new THREE.Group();
  out.position.copy(group.position);
  out.rotation.copy(group.rotation);
  out.scale.copy(group.scale);
  out.name = group.name;
  buckets.forEach((b, mat) => {
    const merged = mergeGeometries(b.list, false);
    b.list.forEach((g) => g.dispose());
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    out.add(mesh);
  });
  // anything that could not be merged keeps its own (world-relative) place
  keep.forEach((o) => {
    const clone = o.clone();
    clone.applyMatrix4(new THREE.Matrix4().multiplyMatrices(_inv, o.matrixWorld));
    out.add(clone);
  });
  return out;
}
