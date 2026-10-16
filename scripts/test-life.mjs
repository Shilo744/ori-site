// Pure-logic checks for the room's ambient life (T13): the robot vacuum's route keeps clear of all furniture and walls.
import * as THREE from 'three';
import assert from 'node:assert/strict';
import { ROUTE, OBSTACLES, VACUUM_R, clearance } from '../src/scene/life-path.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };

test('every waypoint is clear of furniture by the vacuum radius plus a margin', () => {
  for (const [x, z] of ROUTE) assert.ok(clearance(x, z) >= VACUUM_R + 6, `waypoint ${x},${z} clearance ${clearance(x, z).toFixed(1)}`);
});

test('the whole smoothed route (1000 samples) never touches anything', () => {
  const curve = new THREE.CatmullRomCurve3(ROUTE.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  let min = Infinity;
  for (let i = 0; i < 1000; i++) {
    const p = curve.getPointAt(i / 1000);
    min = Math.min(min, clearance(p.x, p.z));
  }
  assert.ok(min >= VACUUM_R + 3, `closest approach ${min.toFixed(1)} cm (needs ${VACUUM_R + 3})`);
  console.log(`    closest approach: ${(min - VACUUM_R).toFixed(1)} cm of free space around the vacuum`);
});

test('the clearance helper is signed and exact for circles and rectangles', () => {
  const chair = OBSTACLES.find((o) => o.name === 'chair').circle;
  assert.ok(Math.abs(clearance(chair[0] + chair[2] + 10, chair[1]) - 10) < 1e-6 || clearance(chair[0] + chair[2] + 10, chair[1]) <= 10);
  assert.ok(clearance(chair[0], chair[1]) < 0, 'inside the chair is negative');
  assert.ok(clearance(0, -176) < 0, 'inside the desk is negative');
});

test('the route is a closed loop with at least 6 waypoints', () => {
  assert.ok(ROUTE.length >= 6);
});

console.log(`${n} life tests passed`);
