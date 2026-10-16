// NEON DRIFT — keyboard input (T44 adds gamepad + touch). Captures the keys while the game is open so the room never sees
// them, and reports one `CarInput` per frame. Keys are read by `code` (layout independent).
const MAP = {
  throttle: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  handbrake: ['Space'],
  boost: ['ShiftLeft', 'ShiftRight'],
};
const GAME_KEYS = new Set([...Object.values(MAP).flat(), 'KeyR', 'KeyC', 'KeyP', 'Escape']);

/**
 * @param {{ onPause?: () => void, onReset?: () => void, onCamera?: () => void, onKey?: (e: KeyboardEvent) => boolean | 'native' | void }} hooks
 */
export function createKeyboard(hooks = {}) {
  const down = new Set();
  const onDown = (e) => {
    if (e.ctrlKey || e.metaKey) { e.stopImmediatePropagation(); return; } // browser shortcuts still work, the room (Spotlight…) never sees them
    // the pause menu may claim the key first: true = consumed, 'native' = the browser acts (Tab / Enter on a button) but the room never sees it
    const claimed = hooks.onKey && hooks.onKey(e);
    if (claimed === true) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (claimed === 'native') { e.stopImmediatePropagation(); return; }
    if (!GAME_KEYS.has(e.code)) { e.stopImmediatePropagation(); return; } // nothing leaks to the room
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    down.add(e.code);
    if (e.code === 'Escape' || e.code === 'KeyP') hooks.onPause?.();
    else if (e.code === 'KeyR') hooks.onReset?.();
    else if (e.code === 'KeyC') hooks.onCamera?.();
  };
  const onUp = (e) => {
    if (down.delete(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); }
  };
  const clear = () => down.clear();
  window.addEventListener('keydown', onDown, true);
  window.addEventListener('keyup', onUp, true);
  window.addEventListener('blur', clear);
  const any = (list) => list.some((k) => down.has(k));
  return {
    /** Fills `out` with the current CarInput. */
    read(out) {
      out.throttle = any(MAP.throttle) ? 1 : 0;
      out.brake = any(MAP.brake) ? 1 : 0;
      out.steer = (any(MAP.right) ? 1 : 0) - (any(MAP.left) ? 1 : 0);
      out.handbrake = any(MAP.handbrake);
      out.boost = any(MAP.boost);
      return out;
    },
    clear,
    dispose() {
      window.removeEventListener('keydown', onDown, true);
      window.removeEventListener('keyup', onUp, true);
      window.removeEventListener('blur', clear);
    },
  };
}
