// The chosen wallpaper (T11): one setting shared by the macOS desktop, the Settings picker and the 3D wall art in the room.
//   wallpaper.id / .set('dunes') / .cycle() / .onChange(fn)        persisted in `wallpaper`
//   wallpaper.attach(el)      paints into a <canvas> inside `el` and keeps it current (Dynamic follows the clock)
//   wallpaper.thumb('aurora') a small canvas for pickers
import { storage } from './storage.js';
import { bus } from './bus.js';
import { WALLPAPERS, WALLPAPER_IDS, DEFAULT_WALLPAPER, drawWallpaper } from './wallpapers.js';

const W = 1280, H = 832; // the screen's 960 × 624 design size at 1.33 ×
let id = storage.get('wallpaper', DEFAULT_WALLPAPER);
if (!WALLPAPER_IDS.includes(id)) id = DEFAULT_WALLPAPER;
let hoursOf = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
const canvases = new Set();
let lastDynamic = -99;

function paint(c) {
  const g = c.getContext('2d');
  drawWallpaper(g, c.width, c.height, id, hoursOf());
}
function repaint() {
  canvases.forEach(paint);
  lastDynamic = hoursOf();
  bus.emit('wallpaper:paint', { id, hours: lastDynamic });
}

// Dynamic changes slowly: repaint when the hour moved by ~12 minutes
setInterval(() => {
  if (id !== 'dynamic' || !canvases.size) return;
  const h = hoursOf();
  if (Math.abs(h - lastDynamic) > 0.2 || Math.abs(h - lastDynamic) > 23.8) repaint();
}, 20000);
bus.on('daylight:change', () => { if (id === 'dynamic') repaint(); });

export const wallpaper = {
  list: WALLPAPERS,
  get id() { return id; },
  get hours() { return hoursOf(); },
  /** Where the Dynamic wallpaper gets its hour from (main.js points it at the daylight system). */
  setHoursSource(fn) { hoursOf = fn; if (id === 'dynamic') repaint(); },
  set(next) {
    if (!WALLPAPER_IDS.includes(next) || next === id) return false;
    id = next;
    storage.set('wallpaper', id);
    repaint();
    bus.emit('wallpaper:change', { id });
    return true;
  },
  cycle() {
    this.set(WALLPAPER_IDS[(WALLPAPER_IDS.indexOf(id) + 1) % WALLPAPER_IDS.length]);
    return id;
  },
  onChange(fn) { return bus.on('wallpaper:change', fn); },
  /** Paint into a canvas (created inside `el`). Returns the canvas. */
  attach(el) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    c.setAttribute('aria-hidden', 'true');
    el.prepend(c);
    canvases.add(c);
    paint(c);
    lastDynamic = hoursOf();
    return c;
  },
  /** A small canvas with wallpaper `wid` (for the picker). */
  thumb(wid, w = 168, h = 109) {
    const c = document.createElement('canvas');
    c.width = w * 2;
    c.height = h * 2;
    drawWallpaper(c.getContext('2d'), c.width, c.height, wid, hoursOf());
    return c;
  },
};
