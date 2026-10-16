// Small lived-in details around the bench (T37): a folded wool blanket on the seat (the cat sleeps on it) and a pair of
// white sneakers on the floor next to it. Units: centimetres, y-up, every group stands on y = 0. Merged per material.
import * as THREE from 'three';
import { rbox, mesh, slabGeo, smooth } from './props.js';
import { mergeByMaterial } from './merge.js';

const wool = (color, sheen) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.96, sheen: 1, sheenRoughness: 0.55, sheenColor: new THREE.Color(sheen) });

/** Three folded layers of dusty blue wool with cream / terracotta stripes at the ends (≈ 40 × 7.4 × 30 cm). */
export function createBlanket() {
  const base = wool(0x8fa4b6, 0xe6f0ff);
  const cream = wool(0xebe0cb, 0xffffff);
  const rust = wool(0xc77a56, 0xffd9c0);
  const g = new THREE.Group();
  const layers = [
    { w: 41, d: 31, y: 0, ry: 0.0, ox: 0, oz: 0 },
    { w: 40, d: 30, y: 2.5, ry: 0.04, ox: 0.6, oz: -0.4 },
    { w: 38.6, d: 29, y: 5.0, ry: -0.035, ox: -0.5, oz: 0.5 },
  ];
  const T = 2.7; // thickness of one fold
  for (const L of layers) {
    const layer = new THREE.Group();
    layer.position.set(L.ox, L.y, L.oz);
    layer.rotation.y = L.ry;
    layer.add(mesh(smooth(rbox(L.w, T, L.d, 1.15, 3)), base, { y: T / 2 }));
    // woven stripes across both short ends: they wrap over the top and show on the long fold edge
    for (const sx of [-1, 1]) {
      layer.add(mesh(rbox(1.7, T + 0.18, L.d + 0.22, 0.4, 1), cream, { x: sx * (L.w / 2 - 4.4), y: T / 2, cast: false }));
      layer.add(mesh(rbox(0.8, T + 0.18, L.d + 0.22, 0.3, 1), rust, { x: sx * (L.w / 2 - 6.6), y: T / 2, cast: false }));
    }
    g.add(layer);
  }
  const merged = mergeByMaterial(g);
  merged.name = 'blanket';
  return merged;
}

/** A pair of white low-top sneakers with a cream sole, toes pointing +x. */
export function createSneakers(m) {
  const upper = new THREE.MeshPhysicalMaterial({ color: 0xf5f3ee, roughness: 0.6, clearcoat: 0.08, clearcoatRoughness: 0.5 });
  const sole = new THREE.MeshStandardMaterial({ color: 0xe6dfcf, roughness: 0.78 });
  const ell = (rx, ry, rz, x, y, z, mat, rz2 = 0) => {
    const geo = new THREE.SphereGeometry(1, 18, 12);
    const e = mesh(geo, mat, { x, y, z, rz: rz2 });
    e.scale.set(rx, ry, rz);
    return e;
  };
  const one = () => {
    const s = new THREE.Group();
    s.add(mesh(slabGeo(27, 10.4, 2.4, 5.2, 0.9), sole, { y: 1.2 }));
    s.add(ell(10.5, 4.4, 4.7, -1.2, 5.6, 0, upper)); // main body
    s.add(ell(8, 3.2, 4.4, 6.4, 4.5, 0, upper, -0.12)); // toe box
    s.add(ell(4.0, 5.2, 4.5, -9.4, 6.6, 0, upper)); // heel counter
    s.add(ell(2.6, 1.7, 3.2, -8.4, 9.6, 0, m.black)); // dark inside of the opening
    s.add(mesh(rbox(5.4, 0.7, 3.6, 0.3, 1), upper, { x: -2.8, y: 8.7, z: 0, rz: 0.55 })); // tongue
    for (let i = 0; i < 3; i++) s.add(mesh(rbox(0.6, 0.55, 5.2, 0.2, 1), upper, { x: -0.6 + i * 2.4, y: 8.1 - i * 0.55, rz: 0.4, z: 0, cast: false })); // laces
    s.add(mesh(rbox(1.2, 1.2, 9.6, 0.5, 1), sole, { x: -13.2, y: 3.2, z: 0 })); // heel tab
    return s;
  };
  const g = new THREE.Group();
  const a = one(), b = one();
  a.position.set(0, 0, -7);
  a.rotation.y = 0.2;
  b.position.set(3, 0, 7);
  b.rotation.y = -0.05;
  g.add(a, b);
  const merged = mergeByMaterial(g);
  merged.name = 'sneakers';
  return merged;
}
