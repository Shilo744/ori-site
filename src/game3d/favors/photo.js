// "Ori's Life" — photo mode (PURE) [experimental]: V puts the HUD away and Space takes a photo: a little polaroid of what the camera sees, with where and when written under it, saved as a PNG on the player's
// machine (a download, only because a key was pressed). Walk about, turn the camera (Q / E, the mouse) and find the shot; Esc or V comes back. Nothing here draws or touches the page: it only says how big, what is
// written where, and what the file is called, so the numbers can be tested.

export const KEY = 'KeyV';
/** The picture is never wider than this (pixels): a big window does not make a huge file. */
export const MAX_W = 1600;
/** And never smaller than this (a tiny canvas still gives a picture that can be looked at). */
export const MIN_W = 320;
export const HINT = 'Space: take the photo · V or Esc: back';

/** The size the picture is taken at: the canvas's own, scaled down to MAX_W when wider (same shape). */
export function sizeFor(w, h) {
  const W = Math.max(1, Math.floor(Number(w) || 1));
  const H = Math.max(1, Math.floor(Number(h) || 1));
  const k = W > MAX_W ? MAX_W / W : W < MIN_W ? MIN_W / W : 1;
  return { w: Math.round(W * k), h: Math.round(H * k), scale: k };
}

/**
 * The polaroid around a picture of w x h: a thin border round it and a wide one under it for the words.
 * @returns {{ width: number, height: number, x: number, y: number, picW: number, picH: number, textX: number, tagX: number, titleY: number, subY: number, tagY: number, fontTitle: number, fontSub: number, fontTag: number }}
 */
export function polaroid(w, h) {
  const b = Math.round(w * 0.026);
  const foot = Math.round(Math.max(h * 0.16, 64));
  const fontTitle = Math.round(Math.max(18, foot * 0.3));
  const fontSub = Math.round(fontTitle * 0.72);
  return {
    width: w + 2 * b, height: h + b + foot, x: b, y: b, picW: w, picH: h,
    textX: b + Math.round(w * 0.01), tagX: w + b - Math.round(w * 0.01), titleY: b + h + Math.round(foot * 0.42), subY: b + h + Math.round(foot * 0.72), tagY: b + h + Math.round(foot * 0.72),
    fontTitle, fontSub, fontTag: Math.round(fontSub * 0.85),
  };
}

/** The words under the photo: where, and when. `place` null = nowhere in particular. */
export function captionOf({ place = null, day = 1, label = '' } = {}) {
  return { title: place || 'Out and about', sub: `Day ${day}${label ? ` · ${label}` : ''}`, tag: "Ori's Life" };
}

/** The file's name: ori-day3-1540.png (the clock without its colon; anything odd becomes 0000). */
export function photoName({ day = 1, label = '' } = {}) {
  const t = /^(\d{1,2}):(\d{2})/.exec(String(label));
  const hhmm = t ? `${t[1].padStart(2, '0')}${t[2]}` : '0000';
  return `ori-day${Math.max(1, Math.floor(Number(day) || 1))}-${hhmm}.png`;
}

/** A place key for the "photographer" count: a room, a named place, or the street. Anything that is not a plain id is the street. */
export const placeKey = (id) => (typeof id === 'string' && /^[a-z]{2,16}$/.test(id) ? id : 'street');

/** The keys photo mode lets through to the game (walking about and turning the camera); everything else waits until he comes back. */
export const ALLOWED = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyE', 'Equal', 'Minus', 'Space', 'Enter', 'KeyF', 'Escape', 'KeyP']);
