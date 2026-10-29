// "Ori, Can You...?" — the chase camera (PURE: numbers in, numbers out). It sits behind Ori on an orbit, eases its yaw towards where he is
// walking, pulls in when a wall would be in the way, and kicks the field of view a little when he sprints. Yaw uses the controller's
// convention: the camera looks along (sin yaw, cos yaw).
import { wrapPi } from '../rng.js';

const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export function createCameraRig(world, { yaw = Math.PI, pitch = 0.42, dist = 7.6 } = {}) {
  const c = { yaw, pitch, dist, cur: dist, x: 0, y: 3, z: 0, lx: 0, ly: 1.4, lz: 0, fov: 58, fovT: 58, init: false, hitT: 1, bobT: 0, by: 0 };

  return {
    state: c,
    /**
     * @param {number} dt seconds
     * @param {{x:number,z:number,vx:number,vz:number,speed:number,sprinting:boolean,heading?:number,drive?:boolean}} t Ori (drive: he is in a car, heading = where its nose points)
     * @param {{orbit?:number, pitch?:number, zoom?:number}} [inp] manual camera: radians per second / zoom factor
     */
    update(dt, t, inp = {}) {
      const orbit = inp.orbit || 0;
      c.yaw = wrapPi(c.yaw + orbit * dt);
      c.pitch = Math.min(0.9, Math.max(0.12, c.pitch + (inp.pitch || 0) * dt));
      if (inp.zoom && inp.zoom !== 1) c.dist = Math.min(13, Math.max(4.5, c.dist * inp.zoom));
      if (t.drive) {
        // a car: the camera stays behind where the NOSE points - also while he reverses (it does not flip) and after a turn-around that left it in front of
        // the car (it comes round behind it, never faster than 2.8 rad/s so it does not whip)
        if (t.speed > 1 && !orbit) {
          const d = wrapPi(t.heading - c.yaw);
          const rate = Math.min(3, 1.2 + t.speed * 0.08);
          c.yaw = wrapPi(c.yaw + Math.max(-2.8 * dt, Math.min(2.8 * dt, d * rate * dt)));
        }
      } else if (t.speed > 1.2 && !orbit) {
        // behind him: when he walks, the camera slowly swings round to look the way he goes (not while he walks straight at it)
        const want = Math.atan2(t.vx, t.vz);
        const d = wrapPi(want - c.yaw);
        const side = Math.abs(Math.sin(d)); // 0 = straight ahead or straight back, 1 = sideways
        const back = Math.cos(d) < -0.35 ? 0 : 1; // walking towards the camera: leave it
        c.yaw = wrapPi(c.yaw + d * Math.min(1, dt * (0.6 + 1.6 * side) * back));
      }
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      const lead = Math.min(1.8, t.speed * 0.22);
      const lx = t.x + (t.vx / (t.speed || 1)) * lead * (t.speed > 0.5 ? 1 : 0);
      const lz = t.z + (t.vz / (t.speed || 1)) * lead * (t.speed > 0.5 ? 1 : 0);
      const ly = 1.5;
      const horiz = Math.cos(c.pitch) * c.dist;
      const ux = t.x - fx * horiz; // where the camera would like to be
      const uz = t.z - fz * horiz;
      // a wall between Ori and the camera: sit just in front of it (snaps in at once, eases back out)
      let k = world ? world.segment(t.x, t.z, ux, uz, 0.5) : 1;
      if (k < 1) k = Math.max(0.18, k - 0.04);
      c.hitT = !c.init || k < c.hitT ? k : damp(c.hitT, k, 2.5, dt);
      const px = t.x + (ux - t.x) * c.hitT;
      const pz = t.z + (uz - t.z) * c.hitT;
      const py = 1.5 + Math.sin(c.pitch) * c.dist * Math.max(0.35, c.hitT);
      if (!c.init) { c.x = px; c.y = py; c.z = pz; c.lx = lx; c.ly = ly; c.lz = lz; c.init = true; } else {
        c.x = damp(c.x, px, 16, dt);
        c.z = damp(c.z, pz, 16, dt);
        c.y = damp(c.y, py, 8, dt);
        c.lx = damp(c.lx, lx, 9, dt);
        c.ly = damp(c.ly, ly, 9, dt);
        c.lz = damp(c.lz, lz, 9, dt);
      }
      // a very small bob in step with his stride (none when standing still)
      c.bobT += dt * (t.speed * 1.35 + 0.01);
      c.by = damp(c.by, Math.sin(c.bobT * 2) * 0.022 * Math.min(1, t.speed / 4.4), 14, dt);
      c.fovT = 58 + (c.fovAdd || 0) + (t.sprinting ? 7 : 0) + Math.min(3, t.speed * 0.25);
      c.fov = damp(c.fov, c.fovT, 4, dt);
      return c;
    },
    /** Snaps to the ideal spot (used after a teleport or on the first frame). */
    reset() { c.init = false; c.hitT = 1; },
  };
}
