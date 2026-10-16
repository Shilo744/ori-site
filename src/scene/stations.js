// "Look around" (T40): the camera has three resting stations in the room — Window & bench (left), Desk (default), Plant & clock
// (right) — so every interactive thing can be reached. Pure data + maths here; main.js owns the camera and the buttons.
import * as THREE from 'three';

const P = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * `base` = camera position / target / fov at a 16:10 viewport; `extent` = how many cm must fit horizontally on narrower windows.
 * `things` = the interactive things you can reach from this station (ids from scene/interactables.js).
 */
export const STATIONS = [
  { id: 'window', label: 'Window & bench', things: ['window', 'cat', 'vacuum'], extent: 360, base: { pos: P(196, 128, 176), target: P(-134, 62, -50), fov: 52 } },
  { id: 'desk', label: 'Desk', things: ['lamp', 'homepod', 'mug', 'art', 'iphone', 'ipad'], desk: true },
  { id: 'plant', label: 'Plant & clock', things: ['plant', 'clock'], extent: 250, base: { pos: P(232, 150, 60), target: P(160, 136, -196), fov: 44 } },
];
export const STATION_IDS = STATIONS.map((s) => s.id);
export const DESK_INDEX = STATION_IDS.indexOf('desk');

const _v = new THREE.Vector3();
/** The camera view of a (non-desk) station for a viewport aspect ratio: pulled back on narrow windows, like the room overview. */
export function stationView(st, aspect, out = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 30 }) {
  const { pos, target, fov } = st.base;
  const baseDist = pos.distanceTo(target);
  const need = st.extent / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspect);
  const k = Math.max(1, need / baseDist);
  out.pos.copy(_v.copy(pos).sub(target).multiplyScalar(k).add(target));
  out.target.copy(target);
  out.fov = fov;
  return out;
}

/** Undiscovered things per direction from the station at `index`: { left, right } (counts over every station on that side). */
export function badges(index, foundIds) {
  const found = new Set(foundIds);
  const count = (from, to) => STATIONS.slice(from, to).reduce((n, s) => n + s.things.filter((t) => !found.has(t)).length, 0);
  return { left: count(0, index), right: count(index + 1, STATIONS.length) };
}

/** Where to look first for something undiscovered: the nearest station (by index distance) that still has one. */
export function nearestUndiscovered(index, foundIds) {
  const found = new Set(foundIds);
  let best = null;
  STATIONS.forEach((s, i) => {
    if (i === index || !s.things.some((t) => !found.has(t))) return;
    const d = Math.abs(i - index);
    if (!best || d < best.d) best = { index: i, d, dir: i < index ? -1 : 1 };
  });
  return best;
}
