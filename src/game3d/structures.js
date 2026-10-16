// NEON DRIFT — structures along the road: a covered tunnel (arched gallery with ceiling lights and glowing portals), a bridge
// (deck fascia, pillars to the ground, lit arch frames) and the pillars of the city viaduct. Built from road frames and the
// zones chosen in track-zones.js. Few draw calls: shell, lights, portals, deck, pillars, frames.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WALL_MARGIN, frameAt } from './track.js';
import { framePoint } from './road3d.js';

const TUNNEL_COLORS = { city: 0x24223a, desert: 0x9a6a46, coast: 0x7b8394 };
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

/** A closed-ish ring profile around the road: walls + an elliptical roof. Returns [lateral, height] pairs. */
function archRing(hs, wallH, rise, n = 16) {
  const pts = [[-hs, -0.5], [-hs, wallH]];
  for (let i = 1; i < n; i++) {
    const a = Math.PI - (i / n) * Math.PI;
    pts.push([hs * Math.cos(a), wallH + rise * Math.sin(a)]);
  }
  pts.push([hs, wallH], [hs, -0.5]);
  return pts;
}

/** An indexed mesh through `ringAt(k)` for sections k0..k1 (smooth normals, vertex colours from colorOf(k)). */
function ringMesh(f, k0, k1, ringAt, colorOf, material) {
  const rings = [];
  for (let k = k0; k <= k1; k++) rings.push(ringAt(k));
  const per = rings[0].length;
  const pos = [];
  const col = [];
  const idx = [];
  const c = new THREE.Color();
  const p = {};
  rings.forEach((ring, ri) => {
    const k = k0 + ri;
    c.set(colorOf(k));
    ring.forEach(([lat, h]) => {
      framePoint(f, k, lat, h, p);
      pos.push(p.x, p.y, p.z);
      col.push(c.r, c.g, c.b);
    });
    if (ri > 0) {
      for (let j = 0; j < per - 1; j++) {
        const a = (ri - 1) * per + j;
        const b = a + 1;
        const a2 = a + per;
        const b2 = b + per;
        idx.push(a, a2, b, b, a2, b2);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, material);
  m.frustumCulled = false;
  return m;
}

const sectionRange = (f, z) => {
  let k0 = 0;
  while (k0 < f.count && f.s[k0] < z.s0) k0++;
  let k1 = k0;
  while (k1 < f.count && f.s[k1] < z.s1) k1++;
  return [k0, k1];
};


/** Start/finish gantry: two pylons and a beam with a lit chequered underside. */
export function buildGantry(track) {
  const g = new THREE.Group();
  const fr = frameAt(track, 0, {});
  const hw = fr.width / 2 + 2;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, hw * 2 + 1.2), new THREE.MeshBasicMaterial({ color: 0xf5f2ff }));
  beam.position.set(0, 7.2, 0);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.28, hw * 2 + 1.25), new THREE.MeshBasicMaterial({ color: 0xff3ea5, fog: false }));
  glow.position.set(0, 6.55, 0);
  const pylonGeo = new THREE.BoxGeometry(0.9, 7.2, 0.9);
  const pylonMat = new THREE.MeshLambertMaterial({ color: 0x2d2a3a });
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(pylonGeo, pylonMat);
    p.position.set(0, 3.6, side * hw);
    g.add(p);
  }
  g.add(beam, glow);
  g.position.set(fr.x, fr.y, fr.z);
  g.rotation.y = -fr.heading;
  return g;
}

const place = (x, y, z, yaw, sx, sy, sz) => _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, yaw, 0)), _s.set(sx, sy, sz));

/**
 * @param {object} f frames from road3d.sampleFrames
 * @param {object} biome
 * @param {{kind: string, s0: number, s1: number}[]} zones
 * @param {number} floorY
 * @returns {{ group: THREE.Group, dispose: Function }}
 */
export function buildStructures(f, biome, zones, floorY) {
  const group = new THREE.Group();
  const own = [];
  const mine = (o) => { own.push(o); return o; };
  const neonL = new THREE.Color(biome.road.neonL);
  const neonR = new THREE.Color(biome.road.neonR);
  const concrete = mine(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide }));
  const tunnelBase = new THREE.Color(TUNNEL_COLORS[biome.id] || 0x30304a);
  const embank = new THREE.Color(biome.embankColor);

  for (const z of zones) {
    const [k0, k1] = sectionRange(f, z);
    if (z.kind === 'tunnel') {
      const hsOf = (k) => f.width[k] / 2 + WALL_MARGIN + 1.0;
      const shell = ringMesh(f, k0, k1, (k) => archRing(hsOf(k), 4.3, 2.3), (k) => {
        const c = tunnelBase.clone();
        if (Math.floor(k / 3) % 2) c.multiplyScalar(0.8);
        if (k - k0 < 2 || k1 - k < 2) c.multiplyScalar(1.6); // the portal rims
        return c.getHex();
      }, concrete);
      shell.name = 'tunnel';
      group.add(shell);
      if (biome.id !== 'city') { // out in the country the gallery is buried in a rocky hill
        const rock = new THREE.Color(biome.embankColor);
        const hash = (k, j) => { const h = Math.sin(k * 12.9898 + j * 78.233) * 43758.5453; return h - Math.floor(h); };
        const mound = ringMesh(f, k0 - 3, k1 + 3, (k) => {
          const hs = hsOf(Math.min(Math.max(k, 0), f.count)) + 1;
          const taper = Math.min(1, Math.min(k - (k0 - 3), k1 + 3 - k) / 5); // slopes down at both ends
          const j = (i) => 1 + 0.18 * (hash(k, i) - 0.5) + 0.1 * Math.sin(k * 0.21 + i);
          return [[-hs - 16, -3], [-hs - 11, 4 * taper * j(1)], [-hs - 4, 10 * taper * j(2)], [0, (13 + 3 * hash(k >> 2, 9)) * taper * j(3)], [hs + 4, 10 * taper * j(4)], [hs + 11, 4 * taper * j(5)], [hs + 16, -3]];
        }, (k) => rock.clone().multiplyScalar(0.8 + 0.4 * hash(k >> 1, 3)).getHex(), concrete);
        mound.name = 'tunnel-hill';
        group.add(mound);
      }
      // ceiling lights: two rows of glowing bars every 10 m
      const bars = [];
      const lightGeo = mine(new THREE.BoxGeometry(5, 0.07, 0.45));
      const mat = mine(new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.88, 0.7).multiplyScalar(biome.id === 'city' ? 2.2 : 1.8), toneMapped: false }));
      for (let k = k0 + 2; k < k1 - 1; k += 3) {
        for (const side of [-1, 1]) {
          const hs = hsOf(k);
          const lat = side * hs * 0.42;
          const roof = 4.3 + 2.3 * Math.sqrt(Math.max(0, 1 - (lat / hs) ** 2)) - 0.12;
          const p = framePoint(f, k, lat, roof, {});
          bars.push(place(p.x, p.y, p.z, -f.heading[k], 1, 1, 1).clone());
        }
      }
      const im = new THREE.InstancedMesh(lightGeo, mat, bars.length);
      bars.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.frustumCulled = false;
      group.add(im);
      // portal rings: a thick glowing arch at each end
      const tubes = [];
      for (const [k, col] of [[k0 + 1, neonL], [k1 - 1, neonR]]) {
        const hs = hsOf(k) + 0.15;
        const ring = archRing(hs, 4.3, 2.3, 24).slice(1, -1);
        const pts = ring.map(([lat, h]) => { const q = framePoint(f, k, lat, h, {}); return new THREE.Vector3(q.x, q.y, q.z); });
        const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.22, 6, false);
        tube.userData.col = col;
        tubes.push(tube);
      }
      tubes.forEach((t, i) => {
        const m = new THREE.Mesh(mine(t), mine(new THREE.MeshBasicMaterial({ color: t.userData.col.clone().multiplyScalar(1.6), toneMapped: false })));
        m.name = i ? 'portal-exit' : 'portal-entry';
        m.frustumCulled = false;
        group.add(m);
      });
    } else if (z.kind === 'bridge') {
      // deck fascia + underside
      const edge = (k) => f.width[k] / 2 + WALL_MARGIN + 0.8;
      const deck = ringMesh(f, k0, k1, (k) => [[-edge(k), 0.0], [-edge(k), -2.4], [edge(k), -2.4], [edge(k), 0.0]], (k) => (Math.floor(k / 4) % 2 ? 0x34314e : 0x3c3858), concrete);
      deck.name = 'bridge-deck';
      group.add(deck);
      // pillars every 24 m
      const pillars = [];
      const pillarGeo = mine(new THREE.BoxGeometry(1, 1, 1));
      pillarGeo.translate(0, -0.5, 0);
      for (let s = z.s0 + 12; s < z.s1; s += 24) {
        const k = Math.min(f.count, Math.round(s / (f.s[1] || 4)));
        pillars.push(place(f.x[k], f.y[k] - 2.3, f.z[k], -f.heading[k], 3.2, Math.max(2, f.y[k] - 2.3 - floorY + 1), 5.2).clone());
      }
      const pm = new THREE.InstancedMesh(pillarGeo, mine(new THREE.MeshStandardMaterial({ color: embank.clone().multiplyScalar(biome.id === 'city' ? 1 : 0.8), roughness: 0.9 })), pillars.length);
      pillars.forEach((m, i) => pm.setMatrixAt(i, m));
      pm.instanceMatrix.needsUpdate = true;
      pm.frustumCulled = false;
      group.add(pm);
      // lit arch frames every 42 m
      const posts = [];
      const strips = [];
      const post = new THREE.BoxGeometry(0.55, 8, 0.55);
      for (let s = z.s0 + 20; s < z.s1 - 10; s += 42) {
        const k = Math.min(f.count, Math.round(s / (f.s[1] || 4)));
        const e = edge(k) - 0.3;
        const beam = new THREE.BoxGeometry(0.6, 0.6, e * 2 + 0.6);
        const strip = new THREE.BoxGeometry(0.2, 0.12, e * 2 - 0.4);
        for (const side of [-1, 1]) {
          const p = framePoint(f, k, side * e, 4, {});
          const g = post.clone();
          g.rotateY(-f.heading[k]);
          g.translate(p.x, p.y, p.z);
          posts.push(g);
        }
        const c = framePoint(f, k, 0, 8.2, {});
        const bg = beam.clone();
        bg.rotateY(-f.heading[k]);
        bg.translate(c.x, c.y, c.z);
        posts.push(bg);
        const sg = strip.clone();
        sg.rotateY(-f.heading[k]);
        sg.translate(c.x, c.y - 0.4, c.z);
        strips.push(sg);
      }
      if (posts.length) {
        const frame = new THREE.Mesh(mine(mergeGeometries(posts.map((g) => { const x = g.index ? g.toNonIndexed() : g; x.deleteAttribute('uv'); return x; }))), mine(new THREE.MeshStandardMaterial({ color: 0x2a2840, roughness: 0.6, metalness: 0.3 })));
        frame.frustumCulled = false;
        group.add(frame);
        const glow = new THREE.Mesh(mine(mergeGeometries(strips.map((g) => { const x = g.index ? g.toNonIndexed() : g; x.deleteAttribute('uv'); return x; }))), mine(new THREE.MeshBasicMaterial({ color: neonL.clone().lerp(neonR, 0.5).multiplyScalar(3), toneMapped: false })));
        glow.frustumCulled = false;
        group.add(glow);
      }
    }
  }

  // the city viaduct stands on pillars along the whole track
  if (biome.embank === 'viaduct') {
    const geo = mine(new THREE.BoxGeometry(1, 1, 1));
    geo.translate(0, -0.5, 0);
    const list = [];
    const gap = 36;
    for (let s = 6; s < f.s[f.count]; s += gap) {
      const k = Math.min(f.count, Math.round(s / (f.s[1] || 4)));
      if (zones.some((z) => z.kind === 'bridge' && f.s[k] > z.s0 - 8 && f.s[k] < z.s1 + 8)) continue;
      list.push(place(f.x[k], f.y[k] - 2.4, f.z[k], -f.heading[k], 2.8, Math.max(2, f.y[k] - 2.4 - floorY + 1), 4.4).clone());
    }
    const im = new THREE.InstancedMesh(geo, mine(new THREE.MeshStandardMaterial({ color: embank, roughness: 0.9 })), list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = false;
    group.add(im);
  }

  return {
    group,
    dispose() {
      own.forEach((o) => o.dispose());
      group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.isInstancedMesh) o.dispose(); });
    },
  };
}
