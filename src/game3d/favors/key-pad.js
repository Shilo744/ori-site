// "Ori, Can You...?" — the on-screen key pad (DOM) [experimental]: a row of big buttons that send KEYS (touch.js says which). A button sends the key down when the finger lands and up when it leaves, through
// the same window the keyboard uses, so the games and the cards need no second code path: hold "right" and a block slides, tap "Back" and the card closes. A pad only shows on a touch device (a coarse pointer,
// ?touch=1, or from the first finger that touches the game) and only while it has a set of keys to show.
import './touch.css';
import { PADS, isTouchDevice, keyInit } from './touch.js';

const ARROWS = { up: 'M12 5l7.5 10h-15z', down: 'M12 19l-7.5-10h15z', left: 'M5 12l10-7.5v15z', right: 'M19 12l-10 7.5v-15z' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const faceOf = (b) => (b.icon ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ARROWS[b.icon]}"/></svg>` : esc(b.label));
const defaultSend = (type, code) => window.dispatchEvent(new KeyboardEvent(type, keyInit(code)));

/**
 * @param {{ root: HTMLElement, className?: string, label?: string, send?: (type: 'keydown' | 'keyup', code: string) => void }} o
 */
export function createKeyPad({ root, className = '', label = 'Touch controls', send = defaultSend }) {
  const coarse = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  let enabled = isTouchDevice({ coarse, search: typeof location !== 'undefined' ? location.search : '' });
  let name = null;
  const el = document.createElement('div');
  el.className = `fv-kp${className ? ` ${className}` : ''}`;
  el.hidden = true;
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', label);
  root.append(el);
  const held = new Map(); // pointerId -> { code, btn }

  const refresh = () => { el.hidden = !(enabled && name); };
  const release = (id) => {
    const h = held.get(id);
    if (!h) return;
    held.delete(id);
    h.btn.classList.remove('down');
    send('keyup', h.code);
  };
  const releaseAll = () => { for (const id of [...held.keys()]) release(id); };

  el.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.fv-kb');
    if (!btn) return;
    e.preventDefault(); // (no focus change, no text selection, no compatibility mouse events)
    try { btn.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer */ }
    release(e.pointerId);
    held.set(e.pointerId, { code: btn.dataset.code, btn });
    btn.classList.add('down');
    send('keydown', btn.dataset.code);
  });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, (e) => release(e.pointerId));
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  // a screen reader or a keyboard "clicks" a button without a finger: a quick press
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('.fv-kb');
    if (!btn || e.detail !== 0) return;
    send('keydown', btn.dataset.code);
    send('keyup', btn.dataset.code);
  });

  // the first finger on the game turns the pads on (a laptop with a touch screen, a tablet with a mouse)
  const sawTouch = (e) => { if ((e.pointerType === 'touch' || e.pointerType === 'pen') && !enabled) { enabled = true; refresh(); } };
  document.addEventListener('pointerdown', sawTouch, true);

  return {
    el,
    /** Shows the keys of one place (a name from PADS), or none (null). Keys still held are let go first. */
    set(next) {
      const n = next && PADS[next] ? next : null;
      if (n === name) return;
      releaseAll();
      name = n;
      el.innerHTML = n ? PADS[n].map((b) => `<button type="button" class="fv-kb${b.icon ? ' ic' : ''}${b.code === 'Escape' ? ' back' : ''}" data-id="${b.id}" data-code="${b.code}" aria-label="${esc(b.aria)}">${faceOf(b)}</button>`).join('') : '';
      el.dataset.pad = n || '';
      refresh();
    },
    get name() { return name; },
    get visible() { return !el.hidden; },
    get enabled() { return enabled; },
    /** Dev / tests: pretend this is (or is not) a touch device. */
    force(v) { enabled = !!v; refresh(); },
    dispose() { releaseAll(); document.removeEventListener('pointerdown', sawTouch, true); el.remove(); },
  };
}
