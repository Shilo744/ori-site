// "Ori, Can You...?" — the Sababa Cup board (DOM) [experimental]: the card in Uzi's workshop where the next car race is picked: the driver level and its bar, the seven rivals (a star for each one beaten, "Race!" for the next, what is missing for the locked ones), 1-7 or a click picks, Esc or Close goes back.
// The numbers and the rules are in league.js (pure); starting the race is the game's job (`onPick`).
import './league.css';
import { board, eventBoard, openRow, levelOf } from './league.js';
import { modalFocus } from './a11y.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** @param {{ root: HTMLElement, sfx?: object }} o */
export function createLeague({ root, sfx = null }) {
  const el = document.createElement('div');
  el.className = 'fi-overlay lg';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'The Sababa Cup');
  root.append(el);
  const focus = modalFocus(el, '.lg-row.next', true);
  let cb = null;
  let rows = [];

  function draw(xp, won, ring, waiting) {
    const lv = levelOf(xp);
    rows = eventBoard(xp, won);
    const row = (r) => {
      const tag = r.state === 'won' ? '<em class="ok">&#9733; Rematch</em>' : r.state === 'next' ? `<em class="go">${r.ring ? 'Fight!' : 'Race!'}</em>` : `<em class="lock">${esc(r.why)}</em>`;
      const open = r.state !== 'locked';
      return `<li class="lg-row ${r.state}" data-i="${r.n - 1}" ${open ? 'role="button" tabindex="0"' : 'aria-disabled="true"'}><i class="lg-av" style="--c:${r.color}">${esc(r.name.slice(0, 1))}</i><div><b>${esc(r.name)}</b><small>${esc(r.title)}</small><small class="lg-pay">${r.event ? esc(r.pay) : `Win: ${r.win.prize} peaches · ${r.win.xp} XP${r.beaten ? " (rematch)" : ""}`}</small></div>${tag}<kbd>${r.n}</kbd></li>`;
    };
    const list = '';
    const cups = rows.filter((r) => r.event && !r.ring).map(row).join('');
    el.innerHTML = `<div class="fi-card fv-glass lg-card"><header><div class="g3d-kicker">UZI'S WORKSHOP · THE SABABA CUP</div><h2>Pick a cup</h2></header>
      <div class="lg-me"><b>Driver level ${lv.level}</b><div class="lg-xp" aria-hidden="true"><i style="width:${lv.pct}%"></i></div><small>${lv.to == null ? 'Top level: the Beast is no secret to you.' : `${lv.xp - lv.from} / ${lv.to - lv.from} XP to level ${lv.level + 1}. Winning pays peaches and XP; a faster driver drives a slightly faster car.`}</small></div>
      ${waiting ? `<div class="lg-wait"><span>${esc(waiting)} is waiting at the start.</span><button type="button" class="lg-drop" data-drop="1">Drop it</button></div>` : ''}
      <h3 class="lg-h">Out of town: the whole field at once, with obstacles on the road</h3><ul class="lg-list">${cups}</ul>
      <footer><small>1-4 pick (or click) · R or Esc closes · the cars wait for GO</small><button type="button" class="lg-close" data-close="1">Back</button></footer></div>`;
  }
  function pick(i) {
    const r = rows.find((x) => x.n - 1 === i);
    if (!r) return;
    if (r.state === 'locked') { if (sfx) sfx.soft(); return; }
    if (cb && cb.onPick) cb.onPick(r);
  }
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-drop]')) { const c = cb; api.close(); if (c && c.onDrop) c.onDrop(); return; }
    if (e.target.closest('[data-close]') || e.target === el) { api.close(); return; }
    const li = e.target.closest('.lg-row');
    if (li) pick(Number(li.dataset.i));
  });

  const api = {
    get isOpen() { return !el.hidden; },
    /** @param {{ xp: number, won: Record<string, boolean>, onPick: (row: object) => void, onClose?: () => void }} o */
    open(o) { cb = o; draw(o.xp || 0, o.won || {}, !!o.ring, o.waiting || null); el.hidden = false; focus.enter(); if (sfx) sfx.tap(); },
    close() { if (el.hidden) return; focus.leave(); el.hidden = true; el.innerHTML = ''; const c = cb; cb = null; if (c && c.onClose) c.onClose(); },
    /** Keys while it is open (the card owns the keyboard). */
    key(e) {
      if (el.hidden) return false;
      if (e.code === 'Escape' || e.code === 'KeyR') { api.close(); return true; }
      const d = /^Digit([1-9])$/.exec(e.code);
      if (d) { pick(Number(d[1]) - 1); return true; }
      if ((e.code === 'Enter' || e.code === 'Space') && document.activeElement && document.activeElement.closest && document.activeElement.closest('.lg-row')) { pick(Number(document.activeElement.closest('.lg-row').dataset.i)); return true; }
      if (e.code === 'Tab') return 'native';
      return true;
    },
    dispose() { el.remove(); },
  };
  return api;
}
