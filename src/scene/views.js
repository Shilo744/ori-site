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
  art:    { pos: P(70, 150, -60),   target: P(10, 146, -216),  fov: 38 },
  mug:    { pos: P(112, 104, -120),  target: P(84, 84, -156),   fov: 22 },
  homepod: { pos: P(122, 110, -150), target: P(86, 82, -196),   fov: 22 },
  clock:  { pos: P(150, 178, -70),  target: P(226, 190, -220), fov: 36 },
  floor:  { pos: P(120, 190, 200),  target: P(-10, 0, -20),    fov: 46 },
  shaft:  { pos: P(190, 130, 170),  target: P(-130, 60, -60),  fov: 52 },
};

/** Returns `{ pos, target, fov }` for a preset name, or null if the name is unknown. */
export function getView(name, world) {
  const c = world.mac.group.position;
  if (name === 'mac-close') {
    // the whole laptop, relative to wherever the MacBook stands
    return { pos: P(c.x + 36, c.y + 30, c.z + 56), target: P(c.x, c.y + 6, c.z - 2), fov: 28 };
  }
  if (name === 'mac-keys') {
    // low, tight angle across the keycaps (shows the 3D keys, the key-well gap and the trackpad edge)
    return { pos: P(c.x + 8, c.y + 12, c.z + 24), target: P(c.x - 2, c.y + 1, c.z + 2), fov: 24 };
  }
  if (name === 'mac-side') {
    // left side: MagSafe + USB-C recesses, rounded base edge
    return { pos: P(c.x - 40, c.y + 4, c.z + 14), target: P(c.x - 15, c.y + 0.5, c.z + 0.2), fov: 24 };
  }
  return PRESETS[name] || null;
}

export const VIEW_NAMES = ['overview', 'desk', 'window', 'shelf', 'bench', 'plant', 'mac-close', 'mac-keys', 'mac-side', 'iphone', 'ipad', 'mug', 'homepod', 'clock', 'floor', 'shaft', 'art'];
