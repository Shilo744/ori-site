// "Ori, Can You...?" — the first-steps card and the "what now?" panel (the DOM side of guide.js) [experimental]. The card is NOT modal: it sits at the side while he walks, ticks its
// steps off as he does them and goes away by itself. The panel (? or the "?" button or a click on the goal chip) is a small dialog: the goal, where it is, the keys.
import './guide.css';
import { KEYS } from './guide.js';
import { modalFocus, trapTab } from './a11y.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * @param {{ root: HTMLElement, cardRoot?: HTMLElement | null, onTrack?: (() => void) | null, onSkip?: (() => void) | null }} o `cardRoot` = where the card lives (the HUD, so high contrast and calm reach it; default: root),
 *   `onTrack` = "show it on the map" was pressed, `onSkip` = the card's "Got it"
 */
export function createGuide({ root, cardRoot = null, onTrack = null, onSkip = null }) {
  const card = document.createElement('div');
  card.className = 'gd-tour fv-glass';
  card.hidden = true;
  card.setAttribute('role', 'region');
  card.setAttribute('aria-label', 'First steps');
  const panel = document.createElement('div');
  panel.className = 'fi-overlay gd';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'What now?');
  (cardRoot || root).append(card);
  root.append(panel);
  const focus = modalFocus(panel, '.gd-close');
  let open = false;
  let drawn = '';

  card.addEventListener('click', (e) => { if (e.target.closest('[data-act="skip"]') && onSkip) onSkip(); });
  panel.addEventListener('click', (e) => {
    if (e.target === panel || e.target.closest('[data-act="close"]')) { api.close(); return; }
    if (e.target.closest('[data-act="track"]')) { if (onTrack) onTrack(); api.close(); }
  });

  const api = {
    get isOpen() { return open; },
    get tourOn() { return !card.hidden; },
    /** Shows the card with these steps (from guide.tourSteps). */
    showTour(steps) { card.hidden = false; drawn = ''; api.updateTour(steps); },
    /** Ticks the steps off (it redraws only when something changed). */
    updateTour(steps) {
      if (card.hidden) return;
      const sig = steps.map((x) => (x.done ? 1 : 0)).join('');
      if (sig === drawn) return;
      drawn = sig;
      const ready = steps.every((x) => x.done);
      card.classList.toggle('ready', ready);
      card.innerHTML = `<div class="gd-head"><b>${ready ? 'You are ready!' : 'First steps'}</b><button type="button" class="gd-skip" data-act="skip">${ready ? 'Great' : 'Got it'}</button></div>` +
        `<ol class="gd-steps">${steps.map((x) => `<li class="${x.done ? 'done' : ''}"><i aria-hidden="true"></i><div><b>${esc(x.text)}</b> ${x.keys.map((k) => `<kbd>${esc(k)}</kbd>`).join('')}<small>${esc(x.extra)}</small></div><span class="gd-state">${x.done ? 'done' : ''}</span></li>`).join('')}</ol>`;
    },
    hideTour() { card.hidden = true; drawn = ''; },
    /** Opens the panel with `d` = guide.whatNow(...). */
    openNow(d) {
      open = true;
      panel.innerHTML = `<div class="fi-card fv-glass gd-card"><header><div class="g3d-kicker">${esc('WHAT NOW?')}</div><h2>${esc(d.title)}</h2>${d.progress ? `<div class="gd-prog">${esc(d.progress)}</div>` : ''}</header>` +
        `<p class="gd-hint">${esc(d.hint)}</p><p class="gd-where">${esc(d.where)}</p>` +
        (d.canTrack ? `<button type="button" class="fi-btn primary" data-act="track">${d.tracking ? 'The beam already leads there' : 'Show it on the map'}</button>` : '') +
        `<h3>Keys</h3><ul class="gd-keys">${KEYS.map(([k, v]) => `<li><kbd>${esc(k)}</kbd><span>${esc(v)}</span></li>`).join('')}</ul>` +
        `<footer><small>Press <kbd>?</kbd> or <kbd>Esc</kbd> to close</small><button type="button" class="fi-btn gd-close" data-act="close">Close</button></footer></div>`;
      panel.hidden = false;
      focus.enter();
    },
    close() { if (!open) return; focus.leave(); open = false; panel.hidden = true; panel.innerHTML = ''; },
    /** Keys while the panel is open (true when used). */
    key(e) {
      if (!open) return false;
      if (e.code === 'Escape' || (e.code === 'Slash' && e.shiftKey)) { api.close(); return true; }
      if (e.code === 'Tab') return trapTab(e, panel);
      if (e.code === 'Enter' || e.code === 'Space') return 'native';
      return true;
    },
    dispose() { card.remove(); panel.remove(); },
  };
  return api;
}
