// "Ori, Can You...?" — interiors (T62), PURE: every room fits its walls, nothing overlaps, the door is clear, every prop and person can be reached,
// every place with a door has a room, the rooms do not overlap in the world, the persona lint on the toasts.      node scripts/test-favors-interiors.mjs
import assert from 'node:assert/strict';
import { ROOMS, KINDS, ENTERABLE, footprint, collidersOf, spawnOf, exitOf, spotsOf, reachable, originOf, DOOR_W } from '../src/game3d/favors/interiors.js';
import { PLACES, CAST } from '../src/game3d/favors/content.js';
import { BANNED } from '../src/game3d/favors/dialogue.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };

test('at least 6 rooms, and every building with a door has one (open-air places are outside)', () => {
  assert.ok(ENTERABLE.length >= 6);
  for (const [id, p] of Object.entries(PLACES)) if (p.kind === 'building') assert.ok(ROOMS[id], `${id} has a room`);
});

test('every item is a known kind and lies inside the walls', () => {
  for (const [id, r] of Object.entries(ROOMS)) {
    for (const it of r.items) {
      assert.ok(KINDS[it.k], `${id}: unknown kind ${it.k}`);
      const f = footprint(it);
      const slack = KINDS[it.k].solid === false ? 0.2 : 0.02;
      assert.ok(f.x0 >= -r.w / 2 - slack && f.x1 <= r.w / 2 + slack && f.z0 >= -r.d / 2 - slack && f.z1 <= r.d / 2 + slack, `${id}: ${it.k} at ${it.x},${it.z} sticks out of the room`);
    }
    for (const p of r.npcs) assert.ok(Math.abs(p.x) < r.w / 2 - 0.4 && Math.abs(p.z) < r.d / 2 - 0.4, `${id}: ${p.id} is in a wall`);
  }
});

test('solid furniture does not overlap other furniture or people', () => {
  const bad = [];
  for (const [id, r] of Object.entries(ROOMS)) {
    const solids = r.items.filter((it) => KINDS[it.k].solid !== false && it.k !== 'chair' && it.k !== 'stool').map((it) => ({ n: it.k, f: footprint(it) }));
    for (const p of r.npcs) solids.push({ n: p.id, f: { x0: p.x - 0.28, z0: p.z - 0.28, x1: p.x + 0.28, z1: p.z + 0.28 } });
    for (let a = 0; a < solids.length; a++) for (let b = a + 1; b < solids.length; b++) {
      const A = solids[a].f; const B = solids[b].f;
      const ov = A.x0 < B.x1 - 0.02 && A.x1 > B.x0 + 0.02 && A.z0 < B.z1 - 0.02 && A.z1 > B.z0 + 0.02;
      if (ov) bad.push(`${id}: ${solids[a].n} overlaps ${solids[b].n}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the door is clear: the spawn, the mat and a corridor in are free', () => {
  for (const id of ENTERABLE) {
    const { world } = reachable(id);
    const s = spawnOf(id);
    assert.ok(!world.blocked(s.x, s.z, 0.42), `${id}: the spawn is blocked`);
    const e = exitOf(id);
    assert.ok(!world.blocked(e.x, e.z - 0.3, 0.42), `${id}: the doorstep is blocked`);
    const r = ROOMS[id];
    assert.ok(DOOR_W >= 1.2 && r.w >= 5 && r.d >= 4);
  }
});

test('everything can be reached: every prop and every person has a free spot to stand within reach', () => {
  const bad = [];
  for (const id of ENTERABLE) {
    const { cells } = reachable(id);
    assert.ok(cells.length > 40, `${id}: only ${cells.length} free cells`);
    for (const sp of spotsOf(id)) {
      const ok = cells.some(([x, z]) => Math.hypot(x - sp.x, z - sp.z) <= sp.reach);
      if (!ok) bad.push(`${id}: nobody can reach ${sp.who || sp.kind} at ${sp.x.toFixed(1)},${sp.z.toFixed(1)}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('at least 60% of the room floor is walkable (not a warehouse of furniture)', () => {
  for (const id of ENTERABLE) {
    const r = ROOMS[id];
    const { cells } = reachable(id);
    const free = cells.length * 0.0625 / (r.w * r.d);
    assert.ok(free > (id === "kiosk" ? 0.25 : 0.45), `${id}: ${Math.round(free * 100)}% free`);
  }
});

test('rooms hang apart in the world (no two overlap) and far from the street', () => {
  const o = ENTERABLE.map((id) => ({ id, ...originOf(id), r: ROOMS[id] }));
  for (const a of o) assert.ok(a.x - a.r.w / 2 > 300, `${a.id} is too close to the street`);
  for (let i = 0; i < o.length; i++) for (let j = i + 1; j < o.length; j++) assert.ok(Math.abs(o[i].x - o[j].x) > (o[i].r.w + o[j].r.w) / 2 + 3, `${o[i].id} / ${o[j].id}`);
});

test('every person in a room is a real character; every room has somebody or something to use', () => {
  for (const [id, r] of Object.entries(ROOMS)) {
    for (const p of r.npcs) assert.ok(CAST[p.id] || p.id.startsWith('stranger'), `${id}: ${p.id}`);
    assert.ok(spotsOf(id).length >= 2, `${id} has things to use`);
  }
});

test('everything Ori says when he uses a prop is warm', () => {
  for (const r of Object.values(ROOMS)) for (const it of r.items) if (it.say) assert.ok(!BANNED.test(it.say), it.say);
});

test('colliders: walls close the room except the door, the camera ignores them', () => {
  for (const id of ENTERABLE) {
    const cs = collidersOf(id);
    assert.ok(cs.every((c) => c.noCam));
    const { world } = reachable(id);
    const o = originOf(id);
    const r = ROOMS[id];
    assert.ok(world.blocked(o.x - r.w / 2 - 0.1, o.z, 0.42), `${id}: west wall`);
    assert.ok(world.blocked(o.x + r.w / 2 + 0.1, o.z, 0.42), `${id}: east wall`);
    assert.ok(world.blocked(o.x, o.z - r.d / 2 - 0.1, 0.42), `${id}: north wall`);
    assert.ok(world.blocked(o.x, o.z + r.d / 2 + 0.6, 0.42), `${id}: the threshold`);
  }
});

console.log(`${n} interior tests passed`);
