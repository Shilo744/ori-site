// "Ori, Can You...?" — touch devices (PURE) [experimental]: is this one, and which on-screen keys belong to which part of the game. A pad button is a KEY: it sends the same key the keyboard would
// (down when the finger lands, up when it leaves), so nothing in the game has a second code path and every card that can be played with keys can be played with a thumb. Hold a button and the key
// stays down (walk the camera round, slide a block along); tap it and it is a press.

/** The smallest control a thumb can hit (px). Every pad button and every card control is held to it by the touch audit. */
export const MIN_TARGET = 44;

/**
 * Is this a touch device? A coarse primary pointer says yes; `?touch=1` forces the pads on (tests, a kiosk, a laptop that wants to see them) and `?touch=0` forces them off.
 * @param {{ coarse?: boolean, search?: string }} o
 */
export function isTouchDevice({ coarse = false, search = '' } = {}) {
  const m = /[?&]touch=([01])(?![0-9])/.exec(search || '');
  if (m) return m[1] === '1';
  return !!coarse;
}

/** `code` = the key it sends; `icon` = a drawn arrow instead of a word; `aria` = what a screen reader says. */
const key = (id, code, label, aria = label) => ({ id, code, label, aria });
const arrow = (id, code, icon, aria) => ({ id, code, icon, label: '', aria });
const BACK = key('back', 'Escape', 'Back', 'Back (Escape)');

/**
 * The pads, by place. Every pad has a way out (Escape) so nobody is ever stuck behind a card on a phone.
 * walk = on the street / in a room (next to Run and Use); arcade-* = the office computer; coffee = the cafe job.
 */
export const PADS = {
  walk: [
    key('hi', 'KeyH', 'Hi', 'Say hello (H)'),
    key('map', 'KeyM', 'Map', 'Map (M)'),
    key('journal', 'Tab', 'Journal', 'Journal (Tab)'),
    key('photo', 'KeyV', 'Photo', 'Photo mode (V)'),
    arrow('camL', 'KeyQ', 'left', 'Turn the camera left (Q), hold'),
    arrow('camR', 'KeyE', 'right', 'Turn the camera right (E), hold'),
  ],
  'arcade-boot': [key('start', 'Space', 'Start', 'Start (Space)'), BACK],
  'arcade-menu': [arrow('up', 'ArrowUp', 'up', 'Up'), arrow('down', 'ArrowDown', 'down', 'Down'), key('play', 'Space', 'Play', 'Play (Space)'), BACK],
  'arcade-tetris': [arrow('left', 'ArrowLeft', 'left', 'Left, hold to slide'), arrow('right', 'ArrowRight', 'right', 'Right, hold to slide'), key('turn', 'ArrowUp', 'Turn', 'Turn the piece'), key('soft', 'ArrowDown', 'Drop', 'Drop faster, hold'), key('slam', 'Space', 'Slam', 'Slam it down (Space)'), BACK],
  'arcade-2048': [arrow('up', 'ArrowUp', 'up', 'Slide up'), arrow('left', 'ArrowLeft', 'left', 'Slide left'), arrow('right', 'ArrowRight', 'right', 'Slide right'), arrow('down', 'ArrowDown', 'down', 'Slide down'), BACK],
  'arcade-snake': [arrow('up', 'ArrowUp', 'up', 'Steer up'), arrow('left', 'ArrowLeft', 'left', 'Steer left'), arrow('right', 'ArrowRight', 'right', 'Steer right'), arrow('down', 'ArrowDown', 'down', 'Steer down'), BACK],
  'arcade-over': [key('next', 'Space', 'Menu', 'Back to the menu (Space)'), BACK],
  coffee: [key('espresso', 'KeyJ', 'Espresso', 'Espresso (J)'), key('latte', 'KeyK', 'Latte', 'Latte (K)'), key('tea', 'KeyL', 'Tea', 'Tea (L)'), BACK],
  'coffee-over': [key('done', 'Space', 'Done', 'Done (Space)'), BACK],
};

/** Which pad the office computer shows: by its mode ('boot' | 'menu' | 'tetris' | '2048' | 'snake') and whether the run is over. */
export const arcadePad = (mode, over = false) => (over && (mode === 'tetris' || mode === '2048' || mode === 'snake') ? 'arcade-over' : `arcade-${mode}`);
/** Which pad the cafe job shows. */
export const coffeePad = (over = false) => (over ? 'coffee-over' : 'coffee');

/** The `KeyboardEvent` init for a pad key (`key` is only filled in for the few the browser wants named). */
const NAMED = { Escape: 'Escape', Space: ' ', Tab: 'Tab', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight' };
export const keyInit = (code) => ({ code, key: NAMED[code] || code.replace(/^Key/, '').toLowerCase(), bubbles: true, cancelable: true });
