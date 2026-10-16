// NEON DRIFT — the two scripted cameras: the 3 s flyover over the grid before the lights, and the slow orbit around your car in
// the garage / menu. Both write into a { pos, look, fov } pose that the controller applies to the camera. Allocation-free.
import * as THREE from 'three';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const _a = new THREE.Vector3();
const _m = new THREE.Vector3();
const _b = new THREE.Vector3();

export const FLYOVER_SECONDS = 3.4;

/**
 * The crane shot: from high above the road ahead of the grid, down and in over the pack, to exactly where the chase camera starts.
 * @param {number} p progress 0..1 (before easing)
 * @param {object} c { grid: Vector3 (middle of the grid), fwd: Vector3 (road direction), right: Vector3, car: Vector3 (the player), carFwd: Vector3 }
 */
export function flyoverPose(p, c, out) {
  const e = ease(Math.min(1, Math.max(0, p)));
  // start: high and ahead of the grid, looking back at it
  _a.copy(c.grid).addScaledVector(c.fwd, 150).addScaledVector(c.right, 38).setY(c.grid.y + 46);
  // middle: low beside the pack
  _m.copy(c.car).addScaledVector(c.right, 15).addScaledVector(c.fwd, 18).setY(c.car.y + 5.5);
  // end: where the chase camera sits at 14 m/s
  _b.copy(c.car).addScaledVector(c.carFwd, -7.3).setY(c.car.y + 2.43);
  // quadratic Bézier through the three
  const u = 1 - e;
  out.pos.set(0, 0, 0).addScaledVector(_a, u * u).addScaledVector(_m, 2 * u * e).addScaledVector(_b, e * e);
  out.look.copy(c.grid).lerp(c.car, Math.min(1, e * 1.6)).setY(c.car.y + 0.9 + (1 - e) * 4);
  // the end look-at of the chase camera: 6 m ahead of the car, 1.15 m up
  out.look.lerp(_b.copy(c.car).addScaledVector(c.carFwd, 6).setY(c.car.y + 1.15), e * e);
  out.fov = 46 + 15 * e;
  return out;
}

/** A slow orbit around `car` (the garage): `time` in seconds, optional extra `yaw` from the user dragging. */
export function orbitPose(time, car, out, { dist = 7.2, height = 1.7, speed = 0.22, yaw = 0, shift = 0 } = {}) {
  const a = time * speed + yaw + 0.8;
  out.pos.set(car.x + Math.cos(a) * dist, car.y + height + Math.sin(time * 0.31) * 0.25, car.z + Math.sin(a) * dist);
  out.look.set(car.x, car.y + 0.55, car.z);
  if (shift) { // look a little to the side so the car sits off-centre, clear of the menu panel
    _a.subVectors(out.look, out.pos).setY(0).normalize();
    out.look.x -= -_a.z * shift;
    out.look.z -= _a.x * shift;
  }
  out.fov = 40;
  return out;
}

export const makePose = () => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 60 });
