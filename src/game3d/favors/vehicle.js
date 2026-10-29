// "Ori, Can You...?" — how a car drives (PURE, fixed timestep, deterministic): a simple bicycle model with arcade tuning. Forward = (sin θ, cos θ) like the
// walking controller, so the same camera rig and the same collision world work for both. The body is three circles (nose, middle, tail) pushed out of walls.
import { wrapPi } from '../rng.js';

export const STEP = 1 / 120;
export const TOP_SPEED = 17; // m/s (about 60 km/h: this is a neighbourhood) - a car can be quicker: { top, accel } in createVehicle
export const REVERSE_SPEED = 5;
const ACCEL = 8.5; // m/s²
const BRAKE = 15;
const COAST = 2.2; // drag when no pedal is pressed
const WHEELBASE = 2.9;
const MAX_STEER = 0.52; // rad at standstill
const R = 0.98; // collision circle radius
const OFFS = [1.35, 0, -1.35]; // circle centres along the car

export function createVehicle(world, { x = 0, z = 0, heading = 0, top = TOP_SPEED, accel = ACCEL, reverse = REVERSE_SPEED, maxSteer = MAX_STEER, grip = 1 } = {}) {
  const s = { x, z, heading, speed: 0, boost: 0, steer: 0, vx: 0, vz: 0, yawRate: 0, blocked: false, hit: 0, steps: 0 };
  let acc = 0;
  let gripNow = grip; // the road can be wet: the game lowers it for a while (setGrip)

  function step(inp) {
    const th = Math.max(-1, Math.min(1, inp.throttle || 0));
    const st = Math.max(-1, Math.min(1, inp.steer || 0));
    const hand = !!inp.brake;
    s.boost += ((inp.boost && th > 0.05 ? 1 : 0) - s.boost) * Math.min(1, 7 * STEP); // the afterburner: 0..1, eased
    const accelNow = accel * (1 + 2.4 * s.boost);
    const topNow = top * (1 + 0.6 * s.boost);
    // pedals: W pushes forward, S brakes while rolling forward and then reverses
    if (th > 0.05) s.speed += s.speed < 0 ? BRAKE * th * STEP : accelNow * (1 - s.speed / (topNow * 1.08)) * th * STEP;
    else if (th < -0.05) s.speed -= (s.speed > 0.4 ? BRAKE : accel * 0.9 * (1 - -s.speed / (reverse * 1.1))) * -th * STEP;
    else {
      const d = COAST * STEP;
      s.speed = Math.abs(s.speed) <= d ? 0 : s.speed - Math.sign(s.speed) * d;
    }
    if (hand) { const d = BRAKE * 0.9 * STEP; s.speed = Math.abs(s.speed) <= d ? 0 : s.speed - Math.sign(s.speed) * d; }
    s.speed = Math.max(-reverse, Math.min(topNow, s.speed));
    if (s.speed > topNow) s.speed = topNow;
    // steering: eases towards the wish, and gets less sharp at speed
    const lim = maxSteer / (1 + Math.abs(s.speed) * 0.11 * (TOP_SPEED / top) ** 0.5 / gripNow);
    s.steer += (st * lim - s.steer) * Math.min(1, 14 * STEP);
    const yaw = (s.speed / WHEELBASE) * Math.tan(s.steer);
    s.yawRate = yaw;
    s.heading = wrapPi(s.heading - yaw * STEP); // (steer > 0 = to the right = a smaller heading)
    const fx = Math.sin(s.heading);
    const fz = Math.cos(s.heading);
    s.vx = fx * s.speed;
    s.vz = fz * s.speed;
    s.x += s.vx * STEP;
    s.z += s.vz * STEP;
    s.blocked = false;
    if (world) {
      for (let k = 0; k < OFFS.length; k++) {
        const o = OFFS[k];
        const r = world.push(s.x + fx * o, s.z + fz * o, R);
        if (r.hit) {
          s.blocked = true;
          s.x += r.x - (s.x + fx * o);
          s.z += r.z - (s.z + fz * o);
          const into = s.vx * r.nx + s.vz * r.nz; // > 0 would be leaving the wall
          const along = s.speed;
          if (into < 0) s.hit = Math.max(s.hit, -into);
          // a bump takes most of the speed away (a soft arcade bump, never a stop dead on the spot)
          const hitK = Math.min(1, Math.abs(into) / Math.max(1, Math.abs(along)));
          s.speed *= 1 - 0.55 * hitK;
        }
      }
    }
    s.steps++;
  }

  return {
    state: s,
    STEP,
    update(dt, inp) {
      acc += Math.min(dt, 0.1);
      let n = 0;
      while (acc >= STEP) { acc -= STEP; step(inp); n++; }
      s.hit *= 0.96; // the bump strength fades (the sound / shake use it)
      return n;
    },
    step,
    setGrip(g) { gripNow = g; },
    place(px, pz, heading) { s.x = px; s.z = pz; s.heading = heading; s.speed = 0; s.steer = 0; s.vx = 0; s.vz = 0; acc = 0; },
  };
}
