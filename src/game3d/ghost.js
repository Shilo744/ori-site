// NEON DRIFT — ghost laps: the best lap is recorded at 30 Hz in a compact form, stored as a string and replayed as a
// translucent car. PURE (no three, no DOM): the same code runs in the node tests.
import { clamp } from './rng.js';

export const GHOST_HZ = 30;
const TAU = Math.PI * 2;
const VERSION = 1;

/** Collects samples of one lap. Call `push(t, x, z, psi, steer)` as often as you like: it keeps one sample per 1/30 s. */
export function createRecorder() {
  let t0 = 0;
  const x = [];
  const z = [];
  const psi = [];
  const steer = [];
  let next = 0;
  return {
    /** Start a new lap at race time t. */
    begin(t) { t0 = t; x.length = z.length = psi.length = steer.length = 0; next = 0; },
    push(t, px, pz, ppsi, psteer) {
      const lt = t - t0;
      if (lt < next - 1e-9) return;
      next += 1 / GHOST_HZ;
      x.push(px); z.push(pz); psi.push(ppsi); steer.push(psteer);
    },
    get length() { return x.length; },
    /** Freezes the lap: { time, x, z, psi, steer } as typed arrays. */
    finish(lapTime) {
      return {
        time: lapTime,
        x: Float32Array.from(x), z: Float32Array.from(z),
        psi: Uint16Array.from(psi, (a) => Math.round((((a % TAU) + TAU) % TAU) / TAU * 65535)),
        steer: Int8Array.from(steer, (s) => Math.round(clamp(s, -1, 1) * 127)),
      };
    },
  };
}

/** A string for localStorage (base64 of a small binary block). */
export function encodeGhost(g) {
  const n = g.x.length;
  const buf = new ArrayBuffer(12 + n * 11);
  const dv = new DataView(buf);
  dv.setUint8(0, VERSION);
  dv.setUint32(4, n, true);
  dv.setFloat32(8, g.time, true);
  let o = 12;
  for (let i = 0; i < n; i++) { dv.setFloat32(o, g.x[i], true); o += 4; }
  for (let i = 0; i < n; i++) { dv.setFloat32(o, g.z[i], true); o += 4; }
  for (let i = 0; i < n; i++) { dv.setUint16(o, g.psi[i], true); o += 2; }
  for (let i = 0; i < n; i++) { dv.setInt8(o, g.steer[i]); o += 1; }
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x2000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x2000));
  return btoa(bin);
}

/** The inverse of encodeGhost; returns null for anything that is not a valid ghost string. */
export function decodeGhost(str) {
  try {
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const dv = new DataView(bytes.buffer);
    if (dv.getUint8(0) !== VERSION) return null;
    const n = dv.getUint32(4, true);
    if (n < 2 || 12 + n * 11 !== bytes.length) return null;
    const g = { time: dv.getFloat32(8, true), x: new Float32Array(n), z: new Float32Array(n), psi: new Uint16Array(n), steer: new Int8Array(n) };
    let o = 12;
    for (let i = 0; i < n; i++) { g.x[i] = dv.getFloat32(o, true); o += 4; }
    for (let i = 0; i < n; i++) { g.z[i] = dv.getFloat32(o, true); o += 4; }
    for (let i = 0; i < n; i++) { g.psi[i] = dv.getUint16(o, true); o += 2; }
    for (let i = 0; i < n; i++) { g.steer[i] = dv.getInt8(o); o += 1; }
    return g;
  } catch {
    return null;
  }
}

/** Replays a ghost: `poseAt(t, out)` interpolates between the 30 Hz samples (clamped to the ends). */
export function createPlayback(g) {
  const n = g.x.length;
  return {
    time: g.time,
    length: n,
    poseAt(t, out = {}) {
      const f = clamp(t * GHOST_HZ, 0, n - 1);
      const i = Math.min(n - 2, Math.floor(f));
      const u = f - i;
      out.x = g.x[i] + (g.x[i + 1] - g.x[i]) * u;
      out.z = g.z[i] + (g.z[i + 1] - g.z[i]) * u;
      const a0 = (g.psi[i] / 65535) * TAU;
      let d = (g.psi[i + 1] / 65535) * TAU - a0;
      if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
      let a = a0 + d * u;
      if (a > Math.PI) a -= TAU;
      out.psi = a;
      out.steer = (g.steer[i] * (1 - u) + g.steer[i + 1] * u) / 127;
      return out;
    },
  };
}
