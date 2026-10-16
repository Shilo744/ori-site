// "Ori, Can You...?" — how Ori moves (PURE, fixed timestep, deterministic: the same inputs always give the same walk).
// Third-person on foot: acceleration, turning, a sprint that burns stamina (coffee refills it), collisions that slide along walls.
// Heading convention: facing = (sin θ, cos θ) in (x, z) — so a three.js model that faces +z rotates by θ about y.
import { hashNumbers, wrapPi } from '../rng.js';
import { PLAYER_R } from './map.js';

export const STEP = 1 / 120;
export const WALK_SPEED = 4.4; // m/s
export const SPRINT_SPEED = 8.2;
const ACCEL = 14; // 1/s: how quickly the velocity follows the wish
const BRAKE = 18;
const TURN = 13; // rad/s
const DRAIN = 0.2; // stamina per second of sprinting
const REGEN = 0.1;
const REST = 0.25; // after running dry Ori must recover this much before sprinting again

export function createController(world, { x = 0, z = 0, heading = 0 } = {}) {
  const s = { x, z, vx: 0, vz: 0, heading, speed: 0, stamina: 1, sprinting: false, winded: false, buff: 0, blocked: false, steps: 0 };
  let acc = 0;

  function step(inp) {
    const mag = Math.min(1, Math.hypot(inp.mx || 0, inp.mz || 0));
    const wantSprint = !!inp.sprint && mag > 0.1 && (s.buff > 0 || (!s.winded && s.stamina > 0));
    const top = (wantSprint ? SPRINT_SPEED * (s.buff > 0 ? 1.18 : 1) : WALK_SPEED) * mag;
    const dirx = mag > 1e-6 ? inp.mx / Math.hypot(inp.mx, inp.mz) : 0;
    const dirz = mag > 1e-6 ? inp.mz / Math.hypot(inp.mx, inp.mz) : 0;
    const k = (mag > 0.01 ? ACCEL : BRAKE) * STEP;
    s.vx += (dirx * top - s.vx) * Math.min(1, k);
    s.vz += (dirz * top - s.vz) * Math.min(1, k);
    s.speed = Math.hypot(s.vx, s.vz);
    if (mag > 0.05 && s.speed > 0.2) {
      const want = Math.atan2(s.vx, s.vz);
      const d = wrapPi(want - s.heading);
      const maxTurn = TURN * STEP;
      s.heading = wrapPi(s.heading + Math.max(-maxTurn, Math.min(maxTurn, d)));
    }
    // stamina: sprinting burns it, walking and standing refill it; a buff (coffee) sprints for free
    s.sprinting = wantSprint && s.speed > WALK_SPEED * 1.15;
    if (s.sprinting && s.buff <= 0) s.stamina = Math.max(0, s.stamina - DRAIN * STEP);
    else if (!s.sprinting) s.stamina = Math.min(1, s.stamina + REGEN * STEP * (mag < 0.05 ? 1.6 : 1));
    if (s.stamina <= 0) s.winded = true;
    else if (s.winded && s.stamina >= REST) s.winded = false;
    if (s.buff > 0) s.buff = Math.max(0, s.buff - STEP);

    s.x += s.vx * STEP;
    s.z += s.vz * STEP;
    s.blocked = false;
    if (world) {
      const r = world.push(s.x, s.z, PLAYER_R);
      if (r.hit) {
        s.blocked = true;
        s.x = r.x;
        s.z = r.z;
        const vn = s.vx * r.nx + s.vz * r.nz;
        if (vn < 0) { s.vx -= vn * r.nx; s.vz -= vn * r.nz; } // slide: drop the part of the velocity that points into the wall
      }
    }
    s.steps++;
  }

  return {
    state: s,
    STEP,
    /** Advances by dt seconds (any size) in fixed steps; returns how many steps ran. `inp` = { mx, mz (world direction, ≤ 1), sprint }. */
    update(dt, inp) {
      acc += Math.min(dt, 0.1);
      let n = 0;
      while (acc >= STEP) { acc -= STEP; step(inp); n++; }
      return n;
    },
    step,
    teleport(px, pz, heading = s.heading) { s.x = px; s.z = pz; s.vx = 0; s.vz = 0; s.speed = 0; s.heading = heading; acc = 0; },
    /** Coffee: refills the stamina and gives free sprinting for a few seconds. */
    coffee(seconds = 8) { s.stamina = 1; s.winded = false; s.buff = Math.max(s.buff, seconds); },
    hash() { return hashNumbers([s.x, s.z, s.vx, s.vz, s.heading, s.stamina, s.buff, s.steps]); },
  };
}

/** The world-space move direction for keys: `fwd` (W = 1), `strafe` (D = 1) relative to a camera yaw (same convention as the heading). */
export function moveDir(yaw, fwd, strafe) {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  return { mx: fx * fwd - fz * strafe, mz: fz * fwd + fx * strafe };
}
