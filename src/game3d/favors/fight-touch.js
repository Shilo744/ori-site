// "Ori, Can You...?" — the touch buttons of the ring (DOM). A phone or a tablet has no keyboard: a stick on the left to walk, and on the right JAB, CROSS, GUARD (hold),
// DASH and, once Peach Fury is open, FURY. They are only on screen on a touch device (a coarse pointer, or from the first finger that touches the game) and only
// while a fight or the speed bag is on. They do exactly what the keys do: fight3d.js hands them the same pulses.
import { TEXT } from './texts.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * @param {{ root: HTMLElement, onJab: () => void, onCross: () => void, onDash: () => void, onFury: () => void, onGuard: (on: boolean) => void, onStick: (x: number, y: number) => void }} o
 */
export function createFightTouch({ root, onJab, onCross, onDash, onFury, onGuard, onStick }) {
  const coarse = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  let enabled = coarse; // a touch device
  let on = false; // a fight (or the speed bag) is on
  const el = document.createElement('div');
  el.className = 'fi-touch';
  el.hidden = true;
  el.innerHTML = `
    <div class="fi-stick" data-k="stick"><i data-k="knob"></i></div>
    <div class="fi-tbtns">
      <button type="button" class="fi-tb guard" data-k="guard">${TEXT.touchGuard}</button>
      <button type="button" class="fi-tb dash" data-k="dash">${TEXT.touchDash}</button>
      <button type="button" class="fi-tb jab" data-k="jab">${TEXT.touchJab}</button>
      <button type="button" class="fi-tb cross" data-k="cross">${TEXT.touchCross}</button>
      <button type="button" class="fi-tb fury" data-k="fury" hidden>${TEXT.touchFury}</button>
    </div>`;
  root.append(el);
  const q = (k) => el.querySelector(`[data-k="${k}"]`);
  const stick = q('stick'); const knob = q('knob');
  const btn = { guard: q('guard'), dash: q('dash'), jab: q('jab'), cross: q('cross'), fury: q('fury') };

  const refresh = () => { el.hidden = !(enabled && on); };

  // a button: pulses on the finger going down; the guard is held for as long as the finger stays
  const bind = (b, down, up) => {
    const release = () => { if (b.classList.contains('down')) { b.classList.remove('down'); if (up) up(); } };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer */ } b.classList.add('down'); down(); });
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('lostpointercapture', release);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  bind(btn.jab, onJab);
  bind(btn.cross, onCross);
  bind(btn.dash, onDash);
  bind(btn.fury, onFury);
  bind(btn.guard, () => onGuard(true), () => onGuard(false));

  // the stick: the finger's offset from the middle of the pad, up = into the screen
  let id = null;
  const move = (e) => {
    const r = stick.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    const dead = l < 0.14;
    knob.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`;
    onStick(dead ? 0 : clamp(dx, -1, 1), dead ? 0 : clamp(-dy, -1, 1));
  };
  const endStick = (e) => { if (e && e.pointerId !== id) return; id = null; knob.style.transform = ''; onStick(0, 0); };
  stick.addEventListener('pointerdown', (e) => { e.preventDefault(); id = e.pointerId; try { stick.setPointerCapture(id); } catch { /* a synthetic pointer */ } move(e); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);
  stick.addEventListener('lostpointercapture', endStick);
  stick.addEventListener('contextmenu', (e) => e.preventDefault());

  // the first finger on the game turns the buttons on (a laptop with a touch screen, a tablet with a mouse)
  const sawTouch = (e) => { if ((e.pointerType === 'touch' || e.pointerType === 'pen') && !enabled) { enabled = true; refresh(); } };
  root.addEventListener('pointerdown', sawTouch, true);

  const letGo = () => { for (const b of Object.values(btn)) b.classList.remove('down'); onGuard(false); endStick(null); };

  return {
    el,
    /** The buttons for a fight (mode 'bout') or for the speed bag ('bag': only the two hands). `fury` = Peach Fury is open. */
    show({ mode = 'bout', fury = false } = {}) {
      on = true;
      el.classList.toggle('bag', mode === 'bag');
      btn.fury.hidden = !fury || mode === 'bag';
      refresh();
    },
    hide() { if (on) letGo(); on = false; refresh(); },
    /** Is it on screen right now? */
    get visible() { return !el.hidden; },
    get enabled() { return enabled; },
    /** Dev / tests: pretend this is (or is not) a touch device. */
    force(v) { enabled = !!v; refresh(); },
    dispose() { root.removeEventListener('pointerdown', sawTouch, true); el.remove(); },
  };
}
