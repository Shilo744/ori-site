// Spotlight search + Control Center (the two overlays that float above the windows).
import * as sound from '../audio.js';
import { content as C } from '../content.js';
import { listApps, getApp } from './apps/registry.js';
import { esc } from './apps/shared.js';
import { system } from '../core/system.js';
import { theme } from '../core/theme.js';
import { bus } from '../core/bus.js';
import { launchGame3D } from '../game3d/host.js';
import { FAVORS_ICON } from './apps/favors.js';

// (temporary Spotlight icon, T45 replaces it with the real NEON DRIFT app icon)
const DRIFT_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="gdi" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#19e3ff"/><stop offset="1" stop-color="#ff3ea5"/></linearGradient></defs><rect width="24" height="24" rx="5.500" fill="#12082a"/><path d="M4 15.500l1.500-3.600c.3-.7.9-1.100 1.600-1.100h9.800c.7 0 1.300.4 1.600 1.100L20 15.500v2.300h-2.200v-1.100H6.200v1.100H4z" fill="url(#gdi)"/><circle cx="7.600" cy="15.600" r="1.300" fill="#12082a"/><circle cx="16.400" cy="15.600" r="1.300" fill="#12082a"/></svg>';

/**
 * @param {object} o
 * @param {HTMLElement} o.root
 * @param {object} o.wm
 * @param {() => void} o.closeMenus   closes the menubar dropdowns
 */
export function createOverlays({ root, wm, closeMenus }) {
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
      { n: 'Play: Ori, Can You...?', k: 'Game', icon: FAVORS_ICON, go: () => wm.open('favors') },
      { n: 'Play NEON DRIFT', k: 'Game', icon: DRIFT_ICON, go: () => launchGame3D('drift') },
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
    else if (e.key === 'Enter' && spotList[spotSel]) { const g = spotList[spotSel].go; closeSpot(); bus.emit('spotlight:use'); g(); }
  });
  spotRes.addEventListener('click', (e) => {
    const r = e.target.closest('[data-sr]');
    if (r) { const g = spotList[+r.dataset.sr].go; closeSpot(); bus.emit('spotlight:use'); g(); }
  });
  window.addEventListener('keydown', (e) => {
    if (root.classList.contains('locked') || !root.isConnected) return;
    if (e.code === 'Space' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (spot.hidden) openSpot(); else closeSpot(); }
  });

  // ── Control Center ──
  // every control mirrors the shared system preferences, so Control Center and System Settings never disagree
  const cc = q('.cc');
  const bright = cc.querySelector('[data-cc="bright"]');
  const vol = cc.querySelector('[data-cc="vol"]');
  const SUB = { wifi: ['Home', 'Off'], bluetooth: ['On', 'Off'], airdrop: ['Contacts Only', 'Off'] };
  const setSlider = (el, v) => { el.value = String(v); el.style.setProperty('--v', `${((v - el.min) / (el.max - el.min)) * 100}%`); };
  function renderCC() {
    cc.querySelectorAll('[data-sys]').forEach((b) => {
      const k = b.dataset.sys, on = !!system.get(k);
      b.querySelector('.cc-ic').classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
      const sub = b.querySelector('[data-sub]');
      if (sub && SUB[k]) sub.textContent = SUB[k][on ? 0 : 1];
    });
    const th = cc.querySelector('[data-cc-theme]');
    th.querySelector('.cc-ic').classList.toggle('on', theme.isDark());
    th.setAttribute('aria-pressed', String(theme.isDark()));
    setSlider(bright, system.get('brightness'));
    setSlider(vol, system.get('muted') ? 0 : system.get('volume'));
  }
  cc.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sys]');
    if (b) { system.toggle(b.dataset.sys); sound.pop(); return; }
    if (e.target.closest('[data-cc-theme]')) { theme.setAppearance(theme.isDark() ? 'light' : 'dark'); sound.pop(); }
  });
  cc.addEventListener('input', (e) => {
    const t = e.target;
    t.style.setProperty('--v', `${((t.value - t.min) / (t.max - t.min)) * 100}%`);
    if (t.dataset.cc === 'bright') system.set('brightness', +t.value);
    if (t.dataset.cc === 'vol') { system.set('volume', +t.value); system.set('muted', +t.value === 0); }
  });
  system.on(renderCC);
  bus.on('theme:change', renderCC);
  renderCC();

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
