// "Ori, Can You...?" — input: keyboard, gamepad, mouse-drag camera and the on-screen joystick for touch, merged into one reading per
// frame. While the game is open the keys never reach the room (same rule as NEON DRIFT). Keys are read by `code` (layout independent).
const MOVE = { fwd: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'] };
const GAME_KEYS = new Set([...Object.values(MOVE).flat(), 'ShiftLeft', 'ShiftRight', 'Space', 'KeyE', 'KeyF', 'Enter', 'KeyQ', 'KeyZ', 'KeyX', 'KeyR', 'KeyC', 'KeyP', 'Escape', 'Tab', 'KeyM', 'KeyN', 'Equal', 'Minus']);
const dead = (v, d = 0.18) => (Math.abs(v) < d ? 0 : (v - Math.sign(v) * d) / (1 - d));

/**
 * @param {{ onPause?: () => void, onReset?: () => void, onCamera?: () => void, onKey?: (e: KeyboardEvent) => boolean | 'native' | void, onAction?: (name: string) => void }} hooks
 * @param {HTMLElement} [surface] the canvas (mouse drag orbits, the wheel zooms)
 */
export function createInput(hooks = {}, surface = null) {
  const down = new Set();
  const stick = { x: 0, y: 0 }; // touch joystick, -1..1 (y up = forward)
  const touch = { sprint: false };
  let dragDX = 0;
  let dragDY = 0;
  let wheel = 0;
  let padPrev = { a: false, start: false, y: false };

  const onDown = (e) => {
    if (e.ctrlKey || e.metaKey) { e.stopImmediatePropagation(); return; }
    const claimed = hooks.onKey && hooks.onKey(e);
    if (claimed === true) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (claimed === 'native') { e.stopImmediatePropagation(); return; }
    if (!GAME_KEYS.has(e.code)) { e.stopImmediatePropagation(); return; }
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    down.add(e.code);
    if (e.code === 'Escape' || e.code === 'KeyP') hooks.onPause?.();
    else if (e.code === 'KeyR') hooks.onReset?.();
    else if (e.code === 'KeyC') hooks.onCamera?.();
    else if (e.code === 'Space' || e.code === 'KeyF' || e.code === 'Enter') hooks.onAction?.('interact');
    else if (e.code === 'Tab') hooks.onAction?.('phone');
  };
  const onUp = (e) => { if (down.delete(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); } };
  const clear = () => { down.clear(); stick.x = 0; stick.y = 0; touch.sprint = false; };
  window.addEventListener('keydown', onDown, true);
  window.addEventListener('keyup', onUp, true);
  window.addEventListener('blur', clear);

  // mouse: drag the canvas to orbit the camera, wheel to zoom
  let drag = null;
  const pd = (e) => { if (e.pointerType === 'touch') return; drag = { x: e.clientX, y: e.clientY }; surface.setPointerCapture?.(e.pointerId); };
  const pm = (e) => { if (!drag) return; dragDX += e.clientX - drag.x; dragDY += e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; };
  const pu = (e) => { drag = null; surface.releasePointerCapture?.(e.pointerId); };
  const wh = (e) => { wheel += e.deltaY; e.preventDefault(); };
  if (surface) {
    surface.addEventListener('pointerdown', pd);
    surface.addEventListener('pointermove', pm);
    surface.addEventListener('pointerup', pu);
    surface.addEventListener('pointercancel', pu);
    surface.addEventListener('wheel', wh, { passive: false });
  }
  const any = (list) => list.some((k) => down.has(k));

  return {
    stick,
    touch,
    /** Fills `out`: fwd / strafe (-1..1), sprint, orbit (rad/s), pitch (rad/s), zoom (factor, 1 = none). */
    read(out, dt = 1 / 60) {
      let fwd = (any(MOVE.fwd) ? 1 : 0) - (any(MOVE.back) ? 1 : 0);
      let strafe = (any(MOVE.right) ? 1 : 0) - (any(MOVE.left) ? 1 : 0);
      let orbit = (down.has('KeyE') ? 1 : 0) - (down.has('KeyQ') ? 1 : 0);
      let pitch = 0;
      let sprint = any(['ShiftLeft', 'ShiftRight']) || touch.sprint;
      fwd += stick.y;
      strafe += stick.x;
      // gamepad
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = pads && [...pads].find((p) => p && p.connected);
      if (pad) {
        fwd += -dead(pad.axes[1] || 0);
        strafe += dead(pad.axes[0] || 0);
        orbit += dead(pad.axes[2] || 0) * 2.2;
        pitch += dead(pad.axes[3] || 0) * 1.2;
        sprint = sprint || !!(pad.buttons[7] && pad.buttons[7].pressed) || !!(pad.buttons[1] && pad.buttons[1].pressed) || !!(pad.buttons[5] && pad.buttons[5].pressed);
        const a = !!(pad.buttons[0] && pad.buttons[0].pressed);
        const y = !!(pad.buttons[3] && pad.buttons[3].pressed);
        const st = !!(pad.buttons[9] && pad.buttons[9].pressed);
        if (a && !padPrev.a) hooks.onAction?.('interact');
        if (y && !padPrev.y) hooks.onAction?.('phone');
        if (st && !padPrev.start) hooks.onPause?.();
        padPrev = { a, y, start: st };
      }
      const len = Math.hypot(fwd, strafe);
      if (len > 1) { fwd /= len; strafe /= len; }
      out.fwd = fwd;
      out.strafe = strafe;
      out.sprint = sprint;
      out.orbit = orbit + (dragDX / Math.max(dt, 1 / 240)) * 0.0045;
      out.pitch = pitch + (dragDY / Math.max(dt, 1 / 240)) * 0.0035;
      out.zoom = wheel ? Math.exp(wheel * 0.0012) : 1;
      dragDX = 0;
      dragDY = 0;
      wheel = 0;
      return out;
    },
    clear,
    dispose() {
      window.removeEventListener('keydown', onDown, true);
      window.removeEventListener('keyup', onUp, true);
      window.removeEventListener('blur', clear);
      if (surface) {
        surface.removeEventListener('pointerdown', pd);
        surface.removeEventListener('pointermove', pm);
        surface.removeEventListener('pointerup', pu);
        surface.removeEventListener('pointercancel', pu);
        surface.removeEventListener('wheel', wh);
      }
    },
  };
}
