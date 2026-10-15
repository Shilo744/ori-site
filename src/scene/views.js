// Named camera presets for the room (used by window.__ori.setView, the screenshot harness and later the camera tour).
// Coordinates are in scene cm; `overview` and `screen` are computed by main.js because they depend on the viewport.
import * as THREE from 'three';

const P = (x, y, z) => new THREE.Vector3(x, y, z);

const PRESETS = {
  desk:   { pos: P(96, 138, -52),   target: P(8, 86, -176),    fov: 30 },
  window: { pos: P(150, 150, 20),   target: P(-270, 160, -54), fov: 52 },
  shelf:  { pos: P(-110, 158, -90), target: P(-200, 136, -210), fov: 30 },
  bench:  { pos: P(-86, 92, 56),    target: P(-230, 22, -40),  fov: 34 },
  plant:  { pos: P(285, 118, 4),    target: P(160, 94, -186),  fov: 44 },
  iphone: { pos: P(-2, 100, -112),  target: P(-14, 77, -152),  fov: 24 },
  ipad:   { pos: P(-16, 118, -108), target: P(-44, 77, -178),  fov: 26 },
};

/** Returns `{ pos, target, fov }` for a preset name, or null if the name is unknown. */
export function getView(name, world) {
  if (name === 'mac-close') {
    // keyboard + lid hinge close-up, relative to wherever the MacBook stands
    const c = world.mac.group.position;
    return { pos: P(c.x + 36, c.y + 30, c.z + 56), target: P(c.x, c.y + 6, c.z - 2), fov: 28 };
  }
  return PRESETS[name] || null;
}

export const VIEW_NAMES = ['overview', 'desk', 'window', 'shelf', 'bench', 'plant', 'mac-close', 'iphone', 'ipad'];
