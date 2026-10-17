// "Ori, Can You...?" — the ground: raised sidewalk slabs, asphalt with markings, the park lawn and fountain, the court, the boardwalk,
// the sand and the sea. Flat quads merged by material; the sea is one animated shader plane. Heights: road 0, sand 0, kerb 0.14.
import * as THREE from 'three';
import { GeoBuilder } from './gfx.js';
import { KERB, ROAD_X, ROAD_Z, ROAD_W, BOUNDS } from './map.js';
import { createSea } from './sea3d.js';

const FAR = 700; // the roads and the ground run on into the fog

export function buildGround(map, { lib }) {
  const group = new THREE.Group();
  group.name = 'ground';
  const mats = {
    base: lib.std('paving', { color: 0xb4aea3, wet: 'ground' }),
    slab: lib.std('paving', { color: 0xdcd6cb, wet: 'ground', normalScale: 0.8 }),
    road: lib.std('asphalt', { color: 0xb4b4bc, wet: 'ground', normalScale: 0.8, extra: { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 } }),
    mark: lib.plain({ color: 0xf3f1ea, roughness: 0.7, wet: 'ground', extra: { vertexColors: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 } }),
    kerb: lib.std('concrete', { color: 0xd8d3c8, wet: 'ground', vertexColors: false, extra: { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 } }),
    lawn: lib.std('lawn', { color: 0x8bc86a, wet: 'ground' }),
    path: lib.std('paving', { color: 0xe6e0d2, wet: 'ground' }),
    sand: lib.std('sand', { color: 0xf1dfb0, wet: 'ground' }),
    wood: lib.std('wood', { color: 0xffffff, wet: 'ground' }),
    court: lib.std('concrete', { color: 0xd2694c, wet: 'ground' }),
    water: new THREE.MeshStandardMaterial({ color: 0x5ec3d8, roughness: 0.1, metalness: 0.1 }),
    stone: lib.std('terrazzo', { color: 0xe8e2d6, wet: 'ground' }),
  };
  const add = (geo, mat, name, { shadow = true } = {}) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.receiveShadow = shadow; group.add(m); return m; };

  // the base under everything (and out into the fog)
  {
    const b = new GeoBuilder();
    b.floor(BOUNDS.x0 - 8, -FAR, FAR, FAR, -0.03, 4);
    add(b.build(), mats.base, 'base');
  }
  // sidewalk slabs: a raised box per block, textured in metres
  {
    const b = new GeoBuilder();
    const kb = new GeoBuilder(); // the kerb stones along the edge of every slab
    for (const s of map.slabs) {
      b.box(s.x0, -0.03, s.z0, s.x1, KERB, s.z1, { uvMeters: [4, 4], skip: { bottom: true } });
      const y = KERB + 0.004;
      const w = 0.24;
      kb.floor(s.x0, s.z0, s.x1, s.z0 + w, y, 2);
      kb.floor(s.x0, s.z1 - w, s.x1, s.z1, y, 2);
      kb.floor(s.x0, s.z0 + w, s.x0 + w, s.z1 - w, y, 2);
      kb.floor(s.x1 - w, s.z0 + w, s.x1, s.z1 - w, y, 2);
      // the face of the kerb (towards the road) is a slightly darker concrete band
      kb.box(s.x0 - 0.02, -0.03, s.z0 - 0.02, s.x0, KERB, s.z1 + 0.02, { uvMeters: [2, 2], skip: { bottom: true, top: true, right: true } });
      kb.box(s.x1, -0.03, s.z0 - 0.02, s.x1 + 0.02, KERB, s.z1 + 0.02, { uvMeters: [2, 2], skip: { bottom: true, top: true, left: true } });
      kb.box(s.x0 - 0.02, -0.03, s.z0 - 0.02, s.x1 + 0.02, KERB, s.z0, { uvMeters: [2, 2], skip: { bottom: true, top: true, front: true } });
      kb.box(s.x0 - 0.02, -0.03, s.z1, s.x1 + 0.02, KERB, s.z1 + 0.02, { uvMeters: [2, 2], skip: { bottom: true, top: true, back: true } });
    }
    add(b.build(), mats.slab, 'slabs');
    add(kb.build(), mats.kerb, 'kerbs', { shadow: false });
  }
  // asphalt + markings
  {
    const b = new GeoBuilder();
    const mk = new GeoBuilder();
    const x0 = -124;
    for (const z of ROAD_Z) b.floor(x0, z - ROAD_W / 2, FAR, z + ROAD_W / 2, 0.012, 8);
    for (const x of ROAD_X) b.floor(x - ROAD_W / 2, -FAR, x + ROAD_W / 2, FAR, 0.012, 8);
    add(b.build(), mats.road, 'roads');
    const dash = 3;
    const gap = 5;
    const inInter = (v, lines) => lines.some((l) => Math.abs(v - l) < ROAD_W / 2 + 3.5);
    for (const z of ROAD_Z) for (let x = x0 + 4; x < BOUNDS.x1 + 40; x += dash + gap) if (!inInter(x, ROAD_X) && !inInter(x + dash, ROAD_X)) mk.floor(x, z - 0.1, x + dash, z + 0.1, 0.02);
    for (const x of ROAD_X) for (let z = BOUNDS.z0 - 40; z < BOUNDS.z1 + 40; z += dash + gap) if (!inInter(z, ROAD_Z) && !inInter(z + dash, ROAD_Z)) mk.floor(x - 0.1, z, x + 0.1, z + dash, 0.02);
    // zebra crossings on the four arms of every junction + stop lines
    for (const cx of ROAD_X) {
      for (const cz of ROAD_Z) {
        const e = ROAD_W / 2 + 1.2;
        for (let k = -3; k <= 3; k++) {
          const o = k * 1.3;
          for (const s of [-1, 1]) {
            mk.floor(cx + o - 0.4, cz + s * e - 1.1, cx + o + 0.4, cz + s * e + 1.1, 0.021);
            mk.floor(cx + s * e - 1.1, cz + o - 0.4, cx + s * e + 1.1, cz + o + 0.4, 0.021);
          }
        }
      }
    }
    add(mk.build(), mats.mark, 'markings', { shadow: false });
  }
  // the park: lawn, two paved paths, the fountain basin
  {
    const p = map.zones.park;
    const cx = (p.x0 + p.x1) / 2;
    const cz = (p.z0 + p.z1) / 2;
    const lawn = new GeoBuilder();
    lawn.floor(p.x0 + 0.5, p.z0 + 0.5, p.x1 - 0.5, p.z1 - 0.5, KERB + 0.012, 6);
    add(lawn.build(), mats.lawn, 'lawn');
    const paths = new GeoBuilder();
    paths.floor(cx - 1.6, p.z0 + 0.5, cx + 1.6, p.z1 - 0.5, KERB + 0.024, 4);
    paths.floor(p.x0 + 0.5, cz - 1.6, p.x1 - 0.5, cz + 1.6, KERB + 0.024, 4);
    add(paths.build(), mats.path, 'paths');
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.5, 0.55, 40), mats.stone);
    basin.position.set(cx, KERB + 0.27, cz);
    basin.castShadow = true;
    basin.receiveShadow = true;
    const water = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.06, 40), mats.water);
    water.position.set(cx, KERB + 0.5, cz);
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.4, 12), mats.water);
    jet.position.set(cx, KERB + 1.1, cz);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 0.3, 20), mats.stone);
    bowl.position.set(cx, KERB + 0.95, cz);
    group.add(basin, water, jet, bowl);
  }
  // the court (hobby A): painted rectangle with lines and two hoops
  {
    const c = map.zones.court;
    const b = new GeoBuilder();
    b.floor(c.x0, c.z0, c.x1, c.z1, KERB + 0.012, 6);
    add(b.build(), mats.court, 'court');
    const ln = new GeoBuilder();
    const y = KERB + 0.022;
    const t = 0.12;
    ln.floor(c.x0 + 0.5, c.z0 + 0.5, c.x1 - 0.5, c.z0 + 0.5 + t, y);
    ln.floor(c.x0 + 0.5, c.z1 - 0.5 - t, c.x1 - 0.5, c.z1 - 0.5, y);
    ln.floor(c.x0 + 0.5, c.z0 + 0.5, c.x0 + 0.5 + t, c.z1 - 0.5, y);
    ln.floor(c.x1 - 0.5 - t, c.z0 + 0.5, c.x1 - 0.5, c.z1 - 0.5, y);
    const mx = (c.x0 + c.x1) / 2;
    ln.floor(mx - t / 2, c.z0 + 0.5, mx + t / 2, c.z1 - 0.5, y);
    add(ln.build(), mats.mark, 'court-lines', { shadow: false });
    const post = new GeoBuilder();
    post.setColor('#3b3f48');
    for (const [hx, dir] of [[c.x0 + 1.2, 1], [c.x1 - 1.2, -1]]) {
      const hz = (c.z0 + c.z1) / 2;
      post.box(hx - 0.06, KERB, hz - 0.06, hx + 0.06, KERB + 3.0, hz + 0.06);
      post.setColor('#f2f2f2').box(hx + dir * 0.05, KERB + 3.0, hz - 0.9, hx + dir * 0.12, KERB + 3.9, hz + 0.9);
      post.setColor('#e5622f').box(hx + dir * 0.12, KERB + 3.0, hz - 0.25, hx + dir * 0.7, KERB + 3.06, hz + 0.25);
      post.setColor('#3b3f48');
    }
    const pm = new THREE.Mesh(post.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
    pm.castShadow = true;
    group.add(pm);
  }
  // City Hall's plaza, the boardwalk, the sand
  {
    const ch = map.places.cityhall.rect;
    const b = new GeoBuilder();
    b.floor(ch.x0 - 9, ch.z0 - 2, ch.x0, ch.z1 + 2, KERB + 0.012, 2);
    add(b.build(), mats.stone, 'plaza');
    const w = new GeoBuilder();
    w.floor(-123, BOUNDS.z0, -111, BOUNDS.z1, KERB + 0.012, 4);
    add(w.build(), mats.wood, 'boardwalk');
    const s = new GeoBuilder();
    s.floor(BOUNDS.x0 - 8, -FAR, -124, FAR, 0.002, 6);
    add(s.build(), mats.sand, 'sand');
  }
  // the sea (sea3d.js)
  const sea = createSea();
  group.add(sea.mesh);

  return {
    group,
    /** Per frame: the waves and the water colours follow the time and the sky. */
    update(time, sky, overcast = 0) { sea.update(time, sky, overcast); },
    dispose() {
      for (const o of group.children) { if (o.geometry) o.geometry.dispose(); }
      for (const m of Object.values(mats)) m.dispose();
      sea.dispose();
    },
  };
}
