// "Ori, Can You...?" — what the missions put into the street (three.js): a passenger waving at the kerb, the lost cat, the parrot that bolts, the
// rival courier's car, the rings of the race, and the golden peaches hidden around the neighbourhood. Everything is small, built from a few
// primitives (a handful of meshes), made when a mission needs it and removed when it is over. `sync(targets, t)` keeps the street in step with
// `mission.targets()`.
import * as THREE from 'three';
import { createPerson } from './people/person.js';
import { randomSpec } from './people/specs.js';
import { RACE, GOLDEN } from './play-content.js';

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...o });
const cache = {};
const shared = (key, make) => cache[key] || (cache[key] = make());

function catMesh() {
  const g = new THREE.Group();
  const fur = shared('fur', () => mat(0xe8a24a));
  const white = shared('white', () => mat(0xfaf4e8));
  const body = new THREE.Mesh(shared('sph', () => new THREE.SphereGeometry(1, 12, 10)), fur); body.scale.set(0.22, 0.17, 0.34); body.position.y = 0.2;
  const head = new THREE.Mesh(shared('sph', () => new THREE.SphereGeometry(1, 12, 10)), fur); head.scale.setScalar(0.14); head.position.set(0, 0.34, 0.28);
  const ear = shared('ear', () => new THREE.ConeGeometry(0.05, 0.1, 4));
  const e1 = new THREE.Mesh(ear, fur); e1.position.set(0.07, 0.47, 0.28);
  const e2 = new THREE.Mesh(ear, fur); e2.position.set(-0.07, 0.47, 0.28);
  const chest = new THREE.Mesh(shared('sph', () => new THREE.SphereGeometry(1, 12, 10)), white); chest.scale.set(0.12, 0.12, 0.08); chest.position.set(0, 0.26, 0.4);
  const tail = new THREE.Mesh(shared('tail', () => new THREE.CylinderGeometry(0.025, 0.04, 0.4, 6)), fur); tail.position.set(0, 0.3, -0.36); tail.rotation.x = -0.9;
  g.add(body, head, e1, e2, chest, tail);
  g.userData.tail = tail;
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return g;
}
function parrotMesh() {
  const g = new THREE.Group();
  const green = shared('pg', () => mat(0x3fbf5f));
  const red = shared('pr', () => mat(0xe94f3d));
  const yellow = shared('py', () => mat(0xffc93c));
  const sph = shared('sph', () => new THREE.SphereGeometry(1, 12, 10));
  const body = new THREE.Mesh(sph, green); body.scale.set(0.16, 0.16, 0.26); body.position.y = 0.6;
  const head = new THREE.Mesh(sph, red); head.scale.setScalar(0.1); head.position.set(0, 0.76, 0.2);
  const beak = new THREE.Mesh(shared('beak', () => new THREE.ConeGeometry(0.04, 0.12, 5)), yellow); beak.position.set(0, 0.74, 0.32); beak.rotation.x = Math.PI / 2;
  const tail = new THREE.Mesh(shared('ptail', () => new THREE.BoxGeometry(0.1, 0.02, 0.4)), red); tail.position.set(0, 0.55, -0.32); tail.rotation.x = 0.3;
  const wingGeo = shared('wing', () => new THREE.BoxGeometry(0.34, 0.02, 0.22));
  const wl = new THREE.Mesh(wingGeo, green); wl.position.set(0.2, 0.63, 0);
  const wr = new THREE.Mesh(wingGeo, green); wr.position.set(-0.2, 0.63, 0);
  g.add(body, head, beak, tail, wl, wr);
  g.userData.wl = wl; g.userData.wr = wr;
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return g;
}
function hatMesh() {
  const g = new THREE.Group();
  const straw = shared('straw', () => mat(0xe9c97a));
  const brim = new THREE.Mesh(shared('brim', () => new THREE.CylinderGeometry(0.34, 0.34, 0.03, 18)), straw); brim.position.y = 0.2;
  const crown = new THREE.Mesh(shared('crown', () => new THREE.CylinderGeometry(0.17, 0.2, 0.17, 14)), mat(0xd8b45e)); crown.position.y = 0.3;
  const band = new THREE.Mesh(shared('band', () => new THREE.CylinderGeometry(0.205, 0.205, 0.04, 14)), mat(0xc2453a)); band.position.y = 0.26;
  g.add(brim, crown, band);
  return g;
}
function homeworkMesh() {
  const g = new THREE.Group();
  const paper = shared('paper', () => new THREE.MeshStandardMaterial({ color: 0xfffdf4, roughness: 0.9, side: THREE.DoubleSide }));
  for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(shared('pg3', () => new THREE.PlaneGeometry(0.28, 0.38)), paper); p.position.set((i - 1) * 0.12, 0.25 + i * 0.05, i * 0.05); p.rotation.set(-1.3 + i * 0.2, i * 0.6, 0); g.add(p); }
  return g;
}
function ringMesh(r) {
  const g = new THREE.Group();
  const col = 0x2fe0ff;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.8, 0.28, 8, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, fog: false }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.4;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r * 0.78, 14, 28, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  pillar.position.y = 7;
  g.add(ring, pillar);
  g.userData.disposables = [ring.geometry, ring.material, pillar.geometry, pillar.material];
  return g;
}
function goldenMesh() {
  const g = new THREE.Group();
  const gold = shared('gold', () => new THREE.MeshStandardMaterial({ color: 0xffc23a, emissive: 0xff9d00, emissiveIntensity: 1.4, roughness: 0.35, metalness: 0.4 }));
  const peach = new THREE.Mesh(shared('gp', () => new THREE.SphereGeometry(0.42, 18, 14)), gold); peach.position.y = 1.1;
  const leaf = new THREE.Mesh(shared('gl', () => new THREE.ConeGeometry(0.14, 0.34, 5)), shared('leaf', () => new THREE.MeshStandardMaterial({ color: 0x7ddc6a, emissive: 0x2c8f2a, emissiveIntensity: 0.6 }))); leaf.position.set(0.1, 1.58, 0); leaf.rotation.z = -0.9;
  const halo = new THREE.Mesh(shared('gh', () => new THREE.RingGeometry(0.55, 0.7, 28)), shared('gm', () => new THREE.MeshBasicMaterial({ color: 0xffd35b, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  halo.position.y = 1.1;
  g.add(peach, leaf, halo);
  g.userData.peach = peach; g.userData.halo = halo; g.userData.leaf = leaf;
  return g;
}

export function createMissionWorld({ scene, makeCar, tier = 'high', shadows = true, groundAt = () => 0 }) {
  const live = new Map(); // key -> { kind, obj, person?, car? }
  const goldens = [];
  const group = new THREE.Group();
  group.name = 'mission-world';
  scene.add(group);

  const gold = new THREE.Group();
  gold.name = 'golden-peaches';
  group.add(gold);
  GOLDEN.forEach(([x, z], i) => { const m = goldenMesh(); m.position.set(x, groundAt(x, z), z); m.userData.i = i; gold.add(m); goldens.push(m); });

  function make(t, i) {
    let obj; let person = null; let car = null;
    if (t.kind === 'passenger') {
      person = createPerson(randomSpec(900 + (t.seed || i)), { shadows, tier, quality: 0.5 });
      obj = person.group;
      person.play('wave');
    } else if (t.kind === 'cat') { obj = catMesh(); obj.scale.setScalar(1.6); } else if (t.kind === 'parrot') { obj = parrotMesh(); obj.scale.setScalar(1.8); }
    else if (t.kind === 'hat') obj = hatMesh();
    else if (t.kind === 'homework') obj = homeworkMesh();
    else if (t.kind === 'itay') { person = createPerson(randomSpec(4242), { shadows, tier, quality: 0.5 }); obj = person.group; obj.scale.setScalar(0.82); }
    else if (t.kind === 'rival') { car = makeCar('hatch', 0xe94f3d); obj = car.group; }
    else if (t.kind === 'checkpoint') obj = ringMesh(t.r || RACE.radius);
    else return null;
    group.add(obj);
    return { kind: t.kind, obj, person, car };
  }

  const removeEntry = (e) => {
    group.remove(e.obj);
    if (e.person) e.person.dispose();
    if (e.car) e.car.dispose();
    if (e.obj.userData.disposables) e.obj.userData.disposables.forEach((d) => d.dispose && d.dispose());
  };

  return {
    group,
    /** targets: mission.targets(); t: seconds. `player` { x, z }: the lost things only show when Ori is near. */
    sync(targets, t, dt, player) {
      const seen = new Set();
      targets.forEach((tg, i) => {
        const key = `${tg.kind}:${i}`;
        seen.add(key);
        let e = live.get(key);
        if (!e) { e = make(tg, i); if (!e) return; live.set(key, e); }
        const o = e.obj;
        const y = groundAt(tg.x, tg.z);
        if (tg.kind === 'cat' || tg.kind === 'itay' || tg.kind === 'homework') {
          const near = tg.d < 15;
          o.visible = near && !tg.found;
          o.position.set(tg.x, y, tg.z);
          if (player) o.rotation.y = Math.atan2(player.x - tg.x, player.z - tg.z);
          if (e.person) e.person.update(dt, { speed: 0 });
          if (tg.kind === 'cat') o.userData.tail.rotation.z = Math.sin(t * 5) * 0.5;
          if (tg.kind === 'homework') o.children.forEach((p, k) => { p.rotation.z = Math.sin(t * 6 + k) * 0.5; p.position.y = 0.25 + k * 0.05 + Math.abs(Math.sin(t * 4 + k)) * 0.08; });
        } else if (tg.kind === 'parrot') {
          const fly = tg.moving ? 1 : 0;
          o.position.set(tg.x, y + (tg.moving ? 0.7 + Math.sin(t * 9) * 0.1 : 0), tg.z);
          o.rotation.y = tg.heading;
          const flap = Math.sin(t * (tg.burst ? 34 : tg.moving ? 22 : 3)) * (0.25 + fly * 0.9);
          o.userData.wl.rotation.z = flap; o.userData.wr.rotation.z = -flap;
          o.userData.wl.position.x = 0.2; o.userData.wr.position.x = -0.2;
        } else if (tg.kind === 'hat') {
          o.position.set(tg.x, y + 0.02 + (tg.moving ? Math.abs(Math.sin(t * 8)) * 0.12 : 0), tg.z);
          o.rotation.y = t * (tg.moving ? 9 : 0.5);
        } else if (tg.kind === 'passenger') {
          o.position.set(tg.x, y, tg.z);
          if (player) o.rotation.y = Math.atan2(player.x - tg.x, player.z - tg.z);
          e.person.update(dt, { speed: 0 });
        } else if (tg.kind === 'rival') {
          o.position.set(tg.x, 0, tg.z);
          o.rotation.y = tg.heading - Math.PI / 2;
        } else if (tg.kind === 'checkpoint') {
          o.position.set(tg.x, y, tg.z);
          const s = 1 + Math.sin(t * 4) * 0.04;
          o.scale.set(s, 1, s);
        }
      });
      for (const [key, e] of live) if (!seen.has(key)) { removeEntry(e); live.delete(key); }
    },
    /** The golden peaches: those not found yet spin and bob; `found` is a Set (or array) of indices; `near` gets the closest unfound one's distance. */
    goldens(found, t, player) {
      let nearest = Infinity; let which = -1;
      for (const m of goldens) {
        const i = m.userData.i;
        const got = found.includes ? found.includes(i) : found.has(i);
        m.visible = !got;
        if (got) continue;
        m.userData.peach.position.y = 1.1 + Math.sin(t * 2 + i) * 0.14;
        m.userData.leaf.position.y = m.userData.peach.position.y + 0.48;
        m.rotation.y = t * 1.4 + i;
        m.userData.halo.rotation.z = t * 1.2; m.userData.halo.position.y = m.userData.peach.position.y;
        m.userData.halo.lookAt(player ? player.x : 0, 1.5, player ? player.z : 0);
        const d = Math.hypot(m.position.x - player.x, m.position.z - player.z);
        if (d < nearest) { nearest = d; which = i; }
      }
      return { dist: nearest, index: which };
    },
    clear() { for (const e of live.values()) removeEntry(e); live.clear(); },
    dispose() {
      this.clear();
      scene.remove(group);
      for (const k of Object.keys(cache)) { if (cache[k] && cache[k].dispose) cache[k].dispose(); delete cache[k]; } // (the shared little geometries and materials)
    },
  };
}
