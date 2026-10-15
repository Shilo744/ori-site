// Spotlight search + Control Center (the two overlays that float above the windows).
import * as sound from '../audio.js';
import { content as C } from '../content.js';
import { listApps, getApp } from './apps/registry.js';
import { esc } from './apps/shared.js';

/**
 * @param {object} o
 * @param {HTMLElement} o.root
 * @param {object} o.wm
 * @param {() => void} o.closeMenus   closes the menubar dropdowns
 * @param {(on: boolean) => void} [o.onVolume]
 */
export function createOverlays({ root, wm, closeMenus, onVolume }) {
  const q = (sel) => root.querySelector(sel);

  // ── Spotlight ──
  const spot = q('.spot');
  const spotIn = spot.querySelector('input');
  const spotRes = spot.querySelector('.spot-res');
  let spotSel = 0;
  let spotList = [];

  const spotIndex = () => {
    const icon = (id) => getApp(id)?.icon || '';
    return [
      { n: 'About Me', k: 'Note', icon: icon('notes'), go: () => wm.open('about') },
      { n: 'Experience', k: 'Note', icon: icon('notes'), go: () => wm.open('experience') },
      { n: 'Skills & Tools', k: 'Note', icon: icon('notes'), go: () => wm.open('skills') },
      ...C.projects.map((p) => ({ n: p.name, k: 'Project', icon: icon('safari'), go: () => wm.open('projects') })),
      { n: `Email ${C.name}`, k: 'Mail', icon: icon('mail'), go: () => wm.open('contact') },
      ...listApps({ hidden: false }).map((a) => ({ n: a.name, k: a.spotlightKind, icon: a.icon, go: () => wm.open(a.id) })),
    ];
  };

  function renderSpot() {
    const v = spotIn.value.trim().toLowerCase();
    spotList = (v ? spotIndex().filter((i) => i.n.toLowerCase().includes(v) || i.k.toLowerCase().includes(v)) : []).slice(0, 7);
    spotSel = Math.min(spotSel, Math.max(0, spotList.length - 1));
    spotRes.innerHTML = spotList.length
      ? `<div class="sr-h">Top Hit</div>${spotList.map((i, n) => `<div class="sr${n === spotSel ? ' on' : ''}" data-sr="${n}"><span class="sri">${i.icon}</span><b>${esc(i.n)}</b><em>${esc(i.k)}</em></div>`).join('')}`
      : (v ? '<div class="sr-none">No Results</div>' : '');
    spot.classList.toggle('has', !!v);
  }
  function openSpot() {
    closeMenus();
    spot.hidden = false;
    spotIn.value = '';
    spotSel = 0;
    renderSpot();
    setTimeout(() => spotIn.focus(), 30);
    sound.pop();
  }
  function closeSpot() { spot.hidden = true; spotIn.blur(); }

  spotIn.addEventListener('input', () => { spotSel = 0; renderSpot(); });
  spotIn.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeSpot(); e.stopPropagation(); }
    else if (e.key === 'ArrowDown') { spotSel = Math.min(spotList.length - 1, spotSel + 1); renderSpot(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { spotSel = Math.max(0, spotSel - 1); renderSpot(); e.preventDefault(); }
    else if (e.key === 'Enter' && spotList[spotSel]) { const g = spotList[spotSel].go; closeSpot(); g(); }
  });
  spotRes.addEventListener('click', (e) => {
    const r = e.target.closest('[data-sr]');
    if (r) { const g = spotList[+r.dataset.sr].go; closeSpot(); g(); }
  });
  window.addEventListener('keydown', (e) => {
    if (root.classList.contains('locked') || !root.isConnected) return;
    if (e.code === 'Space' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (spot.hidden) openSpot(); else closeSpot(); }
  });

  // ── Control Center ──
  const cc = q('.cc');
  const dimEl = q('.dimmer');
  cc.addEventListener('input', (e) => {
    const t = e.target;
    t.style.setProperty('--v', `${((t.value - t.min) / (t.max - t.min)) * 100}%`);
    if (t.dataset.cc === 'bright') { dimEl.hidden = false; dimEl.style.opacity = String(((100 - t.value) / 100) * 0.75); }
    if (t.dataset.cc === 'vol' && onVolume) onVolume(+t.value > 0);
  });

  return {
    spot,
    cc,
    openSpot,
    closeSpot,
    spotHidden: () => spot.hidden,
    toggleCC() { const was = cc.hidden; closeMenus(); cc.hidden = !was; },
    /** Click outside Spotlight closes it. */
    onClickAway(t) { if (!t.closest('.spot-box') && !spot.hidden) closeSpot(); },
    /** Click outside Control Center (and not on its menubar button) closes it. */
    onClickAwayCC(t) { if (!t.closest('.cc') && !t.closest('[data-act="cc"]') && !cc.hidden) cc.hidden = true; },
  };
}
