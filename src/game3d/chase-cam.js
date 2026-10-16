// NEON DRIFT — chase camera: a spring behind the car that leans towards the direction of travel while you slide, pulls back and
// widens its field of view with speed and kicks the FOV on boost. Allocation-free per frame.
import * as THREE from 'three';
import { clamp } from './rng.js';

const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createChaseCam() {
  const st = { yaw: 0, fov: 62, pos: new THREE.Vector3(), look: new THREE.Vector3(), ready: false, mode: 0, boostK: 0 };
  const want = new THREE.Vector3();
  const lookWant = new THREE.Vector3();

  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {object} p interpolated pose { x, y, z, psi, speed, vx, vz, boosting, hit }
   * @param {number} dt seconds
   * @param {number} vTop speed that counts as "flat out" (m/s)
   */
  function update(camera, p, dt, vTop = 80) {
    const sp = clamp(p.speed / vTop, 0, 1.25);
    const course = p.speed > 6 ? Math.atan2(p.vz, p.vx) : p.psi;
    const targetYaw = p.psi + wrapPi(course - p.psi) * 0.5;
    if (!st.ready) { st.yaw = p.psi; st.ready = true; st.fov = 62; }
    st.yaw += wrapPi(targetYaw - st.yaw) * (1 - Math.exp(-dt * 6));
    st.boostK += ((p.boosting ? 1 : 0) - st.boostK) * (1 - Math.exp(-dt * 5));
    const cy = Math.cos(st.yaw);
    const sy = Math.sin(st.yaw);
    const dist = st.mode === 1 ? 12 + sp * 4 : 6.9 + sp * 2.6 + st.boostK * 1.2;
    const height = st.mode === 1 ? 5.2 : 2.35 + sp * 0.55;
    want.set(p.x - cy * dist, p.y + height, p.z - sy * dist);
    if (st.pos.lengthSq() === 0) st.pos.copy(want);
    const kxz = 1 - Math.exp(-dt * 14);
    const ky = 1 - Math.exp(-dt * 7);
    st.pos.x += (want.x - st.pos.x) * kxz;
    st.pos.z += (want.z - st.pos.z) * kxz;
    st.pos.y += (want.y - st.pos.y) * ky;
    const lead = 5 + sp * 7;
    lookWant.set(p.x + cy * lead, p.y + 1.15, p.z + sy * lead);
    if (st.look.lengthSq() === 0) st.look.copy(lookWant);
    const kl = 1 - Math.exp(-dt * 10);
    st.look.x += (lookWant.x - st.look.x) * kl;
    st.look.y += (lookWant.y - st.look.y) * kl;
    st.look.z += (lookWant.z - st.look.z) * kl;
    camera.position.copy(st.pos);
    camera.lookAt(st.look);
    const fovT = 60 + 22 * Math.pow(sp, 1.4) + st.boostK * 9;
    st.fov += (fovT - st.fov) * (1 - Math.exp(-dt * 4));
    if (Math.abs(camera.fov - st.fov) > 0.01) { camera.fov = st.fov; camera.updateProjectionMatrix(); }
  }

  /** Snap to the car without easing (restart / reset). */
  function reset() { st.ready = false; st.pos.set(0, 0, 0); st.look.set(0, 0, 0); st.boostK = 0; }
  return { update, reset, state: st };
}
