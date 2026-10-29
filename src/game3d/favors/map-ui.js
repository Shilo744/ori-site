// "Ori, Can You...?" — the big map (M): the whole neighbourhood with every place named, the stars of the game (the ring, the office computer, the garage, the cafe) as badges with
// what they offer, Ori's arrow and the goal of the moment. Click a place (on the map or in the list) to follow it: the beam and the arrow lead there. M or Esc closes it.
// Opening it stops the walking (the day itself goes on).
import './map.css';
import { createMap2d, paintBadge } from './map2d.js';
import { LANDMARKS, PLACE_LINES, CAR, CUP } from './places-guide.js';
import { PLACES } from './content.js';
import { modalFocus, trapTab } from './a11y.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * @param {{ root: HTMLElement, map: object, getView: () => { player: object, goal: object|null, tracked: string|null, landmarks: object[], labels: object[], time: number }, onTrack: (placeId: string|null) => void }} o
 */
export function createMapUi({ root, map, getView, onTrack }) {
  const el = document.createElement('div');
  el.className = 'fi-overlay mp';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Map');
  const star = (id, l) => `<li data-p="${id}" role="button" tabindex="0"><canvas class="mp-badge" data-icon="${l.icon}" data-color="${l.color}"></canvas><div><b>${esc(l.name)}</b><small>${esc(l.what)}</small></div><em></em></li>`;
  const stars = LANDMARKS.map((l) => star(l.place, l)).join('') + star('car', CAR) + star('cup', CUP).replace('<li ', '<li class="cup" '); // (the races: a row of their own, a click leads to the start line)
  const starIds = new Set(LANDMARKS.map((l) => l.place));
  const others = Object.keys(PLACES).filter((id) => !starIds.has(id)).map((id) => `<li data-p="${id}" role="button" tabindex="0"><i class="mp-dot" style="--c:${PLACES[id].tone}"></i><div><b>${esc(PLACES[id].name)}</b><small>${esc(PLACE_LINES[id] || '')}</small></div><em></em></li>`).join('');
  const card = `<div class="fi-card fv-glass mp-card"><header><div class="g3d-kicker">THE NEIGHBOURHOOD</div><h2>Map</h2></header>
    <div class="mp-body"><canvas class="mp-canvas" width="540" height="560" role="img" aria-label="Map of the neighbourhood"></canvas>
      <div class="mp-side"><h3>Where things happen</h3><ul class="mp-list">${stars}</ul><h3>Other places</h3><ul class="mp-list mp-others">${others}</ul></div></div>
    <footer><small>Click a place to follow it: the beam and the arrow lead you there.</small><button type="button" class="fi-btn" data-close="1">Close <kbd>M</kbd></button></footer></div>`;
  root.append(el);
  let canvas = null;
  let map2d = null;
  let isOpen = false;
  let timer = 0;
  let lastTracked = undefined;
  let lastStamps = undefined;
  const focus = modalFocus(el, '.mp-list li');

  function paint() {
    if (!map2d) return;
    const v = getView();
    map2d.draw({ player: v.player, pins: [], points: [], goal: v.goal, landmarks: v.landmarks, labels: v.labels, time: v.time });
    const stampKey = v.stamps ? Object.keys(v.stamps).sort().join() : '';
    if (v.tracked !== lastTracked || stampKey !== lastStamps) {
      lastTracked = v.tracked;
      lastStamps = stampKey;
      for (const li of el.querySelectorAll('.mp-list li')) { const on = li.dataset.p === v.tracked; const st = !!(v.stamps && v.stamps[li.dataset.p]); li.classList.toggle('follow', on); li.classList.toggle('stamped', st); li.querySelector('em').textContent = st ? 'Stamped' : ''; if (on) li.setAttribute('aria-current', 'true'); else li.removeAttribute('aria-current'); /* (the followed place is outlined in orange: no writing, a card must not grow) */ }
    }
  }
  function pick(id) { if (!id) return; const v = getView(); const next = v.tracked === id ? null : id; onTrack(next); lastTracked = undefined; lastStamps = undefined; paint(); }
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]') || e.target === el) { api.close(); return; }
    const li = e.target.closest('.mp-list li');
    if (li) { pick(li.dataset.p); return; }
    if (e.target === canvas) { const r = canvas.getBoundingClientRect(); pick(map2d.hit(((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height)); }
  });

  const api = {
    get isOpen() { return isOpen; },
    open() {
      isOpen = true;
      el.innerHTML = card;
      for (const c of el.querySelectorAll('.mp-badge')) paintBadge(c, c.dataset.icon, c.dataset.color);
      canvas = el.querySelector('.mp-canvas');
      map2d = createMap2d(canvas, map);
      el.hidden = false; lastTracked = undefined; lastStamps = undefined; paint(); clearInterval(timer); timer = setInterval(() => { if (isOpen) paint(); }, 120);
      focus.enter();
    },
    close() { focus.leave(); isOpen = false; el.hidden = true; el.innerHTML = ''; canvas = null; map2d = null; clearInterval(timer); },
    toggle() { if (isOpen) api.close(); else api.open(); },
    key(e) {
      if (!isOpen) return false;
      if (e.code === 'KeyM' || e.code === 'Escape') { api.close(); return true; }
      if (e.code === 'Tab') return trapTab(e, el);
      const row = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.mp-list li') : null;
      if ((e.code === 'Enter' || e.code === 'Space') && row && el.contains(row)) { pick(row.dataset.p); return true; } // (a row is a button for the keyboard too)
      if (e.code === 'Enter' || e.code === 'Space') return 'native'; // (the Close button)
      return true;
    },
    dispose() { clearInterval(timer); el.remove(); },
  };
  return api;
}
