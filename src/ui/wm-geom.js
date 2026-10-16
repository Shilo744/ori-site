// Window geometry helpers: desktop bounds, zoom / snap rectangles, clamping and per-app remembered geometry.
// All numbers are in the 960×624 logical space of the macOS screen.
import { SCREEN_PX } from '../screen-size.js';
import { storage } from '../core/storage.js';

export const MENUBAR_H = 32; // windows never go above this line
export const DOCK_ZONE = 82; // zoomed / tiled windows stop above the Dock
export const SNAP_EDGE = 6; // pointer this close to the left/right/top edge → snap preview
export const KEEP_VISIBLE = 140; // px of a window that must stay on screen horizontally

export const desktopSize = (root) => ({ w: (root && root.offsetWidth) || SCREEN_PX.w, h: (root && root.offsetHeight) || SCREEN_PX.h });

export const zoomRect = ({ w, h }) => ({ x: 0, y: MENUBAR_H, w, h: h - MENUBAR_H - DOCK_ZONE });

export function snapRect(zone, size) {
  const z = zoomRect(size);
  if (zone === 'zoom') return z;
  const half = Math.floor(size.w / 2);
  return zone === 'left' ? { x: 0, y: z.y, w: half, h: z.h } : { x: half, y: z.y, w: size.w - half, h: z.h };
}

/** Keeps a window usable: respects min size, stays below the menubar, keeps part of it on screen. */
export function clampRect(r, def, size) {
  const minW = (def && def.size && def.size.minW) || 240;
  const minH = (def && def.size && def.size.minH) || 160;
  const w = Math.round(Math.max(minW, Math.min(r.w, size.w)));
  const h = Math.round(Math.max(minH, Math.min(r.h, size.h - MENUBAR_H)));
  const x = Math.round(Math.max(-w + KEEP_VISIBLE, Math.min(r.x, size.w - KEEP_VISIBLE)));
  const y = Math.round(Math.max(MENUBAR_H, Math.min(r.y, size.h - 60)));
  return { x, y, w, h };
}

const KEY = 'wm:geom';
export const loadGeom = (id) => {
  const all = storage.get(KEY, {}) || {};
  const g = all[id];
  return g && ['x', 'y', 'w', 'h'].every((k) => Number.isFinite(g[k])) ? g : null;
};
export const saveGeom = (id, r) => {
  const all = storage.get(KEY, {}) || {};
  all[id] = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) };
  storage.set(KEY, all);
};
export const forgetGeom = () => storage.remove(KEY);

export const rectOf = (el) => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
export const applyRect = (el, r) => {
  el.style.left = `${r.x}px`;
  el.style.top = `${r.y}px`;
  el.style.width = `${r.w}px`;
  el.style.height = `${r.h}px`;
};
