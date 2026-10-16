// Robot-vacuum route (T13): a closed loop on the floor in front of the desk that keeps clear of every piece of furniture.
// Pure data + maths (no THREE), so scripts/test-life.mjs can check the clearance in node.

export const VACUUM_R = 17;

/** Furniture footprints on the floor (cm, x/z). `rect` = [x0, z0, x1, z1], `circle` = [cx, cz, r]. Mirrors scene/index.js. */
export const OBSTACLES = [
  { name: 'desk', rect: [-97, -228, 117, -124] },
  { name: 'chair', circle: [40, -104, 50] },
  { name: 'plant', circle: [160, -186, 36] },
  { name: 'side table', circle: [148, -118, 29] },
  { name: 'floor lamp', circle: [-118, -198, 22] },
  { name: 'bench', rect: [-252, -110, -208, 30] },
  { name: 'sneakers', rect: [-234, 32, -196, 68] },
];
/** Walls: the vacuum centre stays inside this box. */
export const FLOOR_BOX = { x0: -262, x1: 262, z0: -208, z1: 208 };

/** Route (x, z) — a lazy loop over the rug and the open floor in front of the chair. */
export const ROUTE = [
  [-150, 52], [-62, 74], [40, 58], [128, 24], [118, -22], [72, -12], [-8, -22], [-70, -66], [-122, -22],
];

/** Signed free distance from (x, z) to the nearest obstacle edge or wall (negative = inside something). */
export function clearance(x, z) {
  let best = Infinity;
  for (const o of OBSTACLES) {
    let d;
    if (o.circle) d = Math.hypot(x - o.circle[0], z - o.circle[1]) - o.circle[2];
    else {
      const [x0, z0, x1, z1] = o.rect;
      const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1);
      d = dx || dz ? Math.hypot(dx, dz) : -Math.min(x - x0, x1 - x, z - z0, z1 - z);
    }
    best = Math.min(best, d);
  }
  best = Math.min(best, x - FLOOR_BOX.x0, FLOOR_BOX.x1 - x, z - FLOOR_BOX.z0, FLOOR_BOX.z1 - z);
  return best;
}
