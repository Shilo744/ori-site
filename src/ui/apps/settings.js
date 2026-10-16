// System Settings — real panes (T11): Wi‑Fi, Bluetooth, Notifications, Sound, Display, General, Appearance (light / dark /
// auto + accent), Wallpaper, Accessibility and Keyboard. Every control is bound to the shared state (core/system.js,
// theme.js, wallpaper.js), so Control Center, the menubar, the audio engine and the 3D wall art follow it live.
import './settings.css';
import { registerApp } from './registry.js';
import { ICON, I, lg } from './icons.js';
import { esc, LIGHTS } from './shared.js';
import * as sound from '../../audio.js';
import { storage } from '../../core/storage.js';
import { bus } from '../../core/bus.js';
import { system } from '../../core/system.js';
import { theme, ACCENTS } from '../../core/theme.js';
import { wallpaper } from '../../core/wallpaper.js';
import { notifications } from '../../core/notify.js';
import { achievements } from '../../core/achievements.js';
import { scores } from '../games/scores.js';

const g = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const GLYPH = {
  wifi: g('<path d="M1.8 8.6a15.6 15.6 0 0 1 20.4 0M5.2 12.3a10.6 10.6 0 0 1 13.6 0M8.6 16a5.6 5.6 0 0 1 6.8 0" fill="none" stroke="#fff" stroke-width="2.1" stroke-linecap="round"/><circle cx="12" cy="19.4" r="1.7" fill="#fff"/>'),
  bluetooth: g('<path d="M7 7.5l10 9-5 4.5V3l5 4.5-10 9" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  bell: g('<path d="M12 3.2a5.6 5.6 0 0 0-5.6 5.6v3.4L4.6 16h14.8l-1.8-3.8V8.8A5.6 5.6 0 0 0 12 3.2zM9.8 18.2a2.3 2.3 0 0 0 4.4 0z" fill="#fff"/>'),
  speaker: g('<path d="M3.5 9.5v5h3.8l4.7 3.8V5.7L7.300 9.500z" fill="#fff"/><path d="M15.200 9a4.200 4.200 0 0 1 0 6M17.700 6.500a7.800 7.800 0 0 1 0 11" fill="none" stroke="#fff" stroke-width="1.900" stroke-linecap="round"/>'),
  sun: g('<circle cx="12" cy="12" r="4.4" fill="#fff"/><g stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/></g>'),
  gear: g('<circle cx="12" cy="12" r="3.200" fill="none" stroke="#fff" stroke-width="2"/><path d="M12 2.600l1.600 2.300 2.700-.7.600 2.700 2.600 1-.9 2.700 1.700 2.200-2.200 1.600.1 2.800-2.700.5-1.200 2.500-2.500-1.200-2.500 1.200-1.200-2.500-2.700-.5.100-2.800L3.400 13l1.700-2.200-.9-2.700 2.600-1 .6-2.700 2.700.7z" fill="none" stroke="#fff" stroke-width="1.500" stroke-linejoin="round"/>'),
  half: g('<circle cx="12" cy="12" r="8.500" fill="none" stroke="#fff" stroke-width="2"/><path d="M12 3.500a8.500 8.500 0 0 1 0 17z" fill="#fff"/>'),
  image: g('<rect x="3.500" y="4.500" width="17" height="15" rx="2.500" fill="none" stroke="#fff" stroke-width="2"/><circle cx="9" cy="10" r="1.800" fill="#fff"/><path d="M4 17l5-4.500 3.500 3L15 13.500l5 4.500" fill="none" stroke="#fff" stroke-width="1.800" stroke-linejoin="round"/>'),
  access: g('<circle cx="12" cy="5.200" r="2" fill="#fff"/><path d="M5 9.200l7 1.200 7-1.200M12 10.400v4.200M12 14.600l-3 5.400M12 14.600l3 5.400" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  keyboard: g('<rect x="2.500" y="6.500" width="19" height="11" rx="2.500" fill="none" stroke="#fff" stroke-width="2"/><path d="M6.500 10.500h.1M10 10.500h.1M13.500 10.500h.1M17 10.500h.1M7.500 14h9" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'),
};

const PANES = [
  { id: 'wifi', name: 'Wi‑Fi', color: '#0a84ff', glyph: 'wifi' },
  { id: 'bluetooth', name: 'Bluetooth', color: '#0a84ff', glyph: 'bluetooth' },
  { id: 'notifications', name: 'Notifications', color: '#ff3b30', glyph: 'bell' },
  { id: 'sound', name: 'Sound', color: '#ff2d55', glyph: 'speaker' },
  { id: 'display', name: 'Displays', color: '#0a84ff', glyph: 'sun' },
  { id: 'general', name: 'General', color: '#8e8e93', glyph: 'gear' },
  { id: 'appearance', name: 'Appearance', color: '#1c1c1e', glyph: 'half' },
  { id: 'wallpaper', name: 'Wallpaper', color: '#32ade6', glyph: 'image' },
  { id: 'accessibility', name: 'Accessibility', color: '#5856d6', glyph: 'access' },
  { id: 'keyboard', name: 'Keyboard', color: '#8e8e93', glyph: 'keyboard' },
];
const PANE_IDS = PANES.map((p) => p.id);

const SHORTCUTS = [
  ['Spotlight', '⌘ Space  /  Ctrl Space'],
  ['Time of day (in the room)', 'T'],
  ['Back to the room', 'Esc'],
  ['Close window', '⌘ W'],
  ['Minimise window', '⌘ M'],
  ['Zoom window', '⌃ ⌘ F'],
  ['System Settings', '⌘ ,'],
  ['Games: move', 'Arrow keys  /  W A S D'],
  ['Games: pause', 'P  /  Esc'],
  ['Games: confirm / restart', 'Enter  /  Space'],
  ['Tetris: rotate · hold · hard drop', '↑ Z X  ·  C  ·  Space'],
  ['Tetris: music on / off', 'M'],
];

const sw = (key, on, label) => `<button class="st-sw${on ? ' on' : ''}" role="switch" aria-checked="${on}" aria-label="${esc(label)}" data-tog="${key}"><i></i></button>`;
const row = (title, ctl = '', sub = '') => `<div class="st-row"><div class="st-tx"><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>${ctl}</div>`;
const grp = (...rows) => `<div class="grp">${rows.join('')}</div>`;
const note = (t) => `<p class="st-note">${esc(t)}</p>`;
const slider = (key, v, min, max, label, extra = '') => `<input class="st-sl" type="range" min="${min}" max="${max}" value="${v}" data-sld="${key}" aria-label="${esc(label)}" style="--v:${((v - min) / (max - min)) * 100}%" ${extra}>`;
const bars = (n) => `<span class="st-bars b${n}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;

const apPreview = (kind) => `<span class="st-ap ${kind}"><i class="a"></i><i class="b"></i><i class="c"></i></span>`;

const BUILD = {
  wifi: () => {
    const on = system.get('wifi');
    return grp(row('Wi‑Fi', sw('wifi', on, 'Wi‑Fi'), on ? 'Connected to “Home”' : 'Off'))
      + (on ? `<h3 class="st-h">Known networks</h3>${grp(
        row('Home', bars(4), 'Connected'),
        row('Studio 5G', bars(3)),
        row('Café Guest', bars(2)),
      )}${note('Other networks are not available in this portfolio.')}` : note('Turn Wi‑Fi on to see nearby networks.'));
  },
  bluetooth: () => {
    const on = system.get('bluetooth');
    return grp(row('Bluetooth', sw('bluetooth', on, 'Bluetooth'), on ? 'Discoverable as “MacBook”' : 'Off'))
      + (on ? `<h3 class="st-h">Devices</h3>${grp(
        row('AirPods Pro', '<span class="st-badge">82%</span>', 'Connected'),
        row('Magic Mouse', '<span class="st-badge">64%</span>', 'Connected'),
        row('Magic Keyboard', '<span class="st-badge off">Not connected</span>'),
      )}` : note('Turn Bluetooth on to connect accessories.'));
  },
  notifications: () => {
    const n = notifications.recent().length;
    return grp(row('Do Not Disturb', sw('dnd', system.get('dnd'), 'Do Not Disturb'), 'Silences banners; they still land in the list'))
      + `<h3 class="st-h">Recent</h3>${grp(row(n ? `${n} notification${n === 1 ? '' : 's'}` : 'No notifications', n ? '<button class="st-btn" data-act-clear>Clear all</button>' : '', n ? notifications.recent()[0].title : 'Achievements and updates show up here.'))}`;
  },
  sound: () => {
    const muted = system.get('muted'), vol = system.get('volume');
    return grp(
      row('Output volume', `<div class="st-ctl wide">${slider('volume', muted ? 0 : vol, 0, 100, 'Output volume')}<em data-val="volume">${muted ? 0 : vol}%</em></div>`),
      row('Mute', sw('muted', muted, 'Mute'), 'Same as the speaker button at the top left'),
    ) + note('Everything on this site that makes sound — the room, games, the HomePod — goes through this volume.');
  },
  display: () => {
    const b = system.get('brightness');
    return grp(
      row('Brightness', `<div class="st-ctl wide">${slider('brightness', b, 25, 100, 'Brightness')}<em data-val="brightness">${b}%</em></div>`),
      row('Night Shift', sw('nightShift', system.get('nightShift'), 'Night Shift'), 'Warms the screen colours'),
    );
  },
  general: (C) => `
    <div class="set-hero">
      <svg viewBox="0 0 120 80" aria-hidden="true"><defs>${lg('lb', '#e9ebef', '#c3c7cf')}${lg('ls', '#5b3fd6', '#e8658b', 1, 1)}</defs><rect x="14" y="4" width="92" height="62" rx="6" fill="url(#lb)"/><rect x="18.5" y="8.5" width="83" height="53" rx="2.5" fill="url(#ls)"/><path d="M4 70h112l-6 5H10z" fill="url(#lb)"/></svg>
      <h2>MacBook Air</h2><p>13-inch, ${C.year}</p>
    </div>
    ${grp(...[['Name', `${C.name}’s MacBook`], ['Role', C.title], ['Location', C.location], ['Email', C.contact.email], ['Portfolio', String(C.year)]]
      .map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`))}
    <h3 class="st-h">Progress</h3>
    ${grp(row('Reset progress', '<button class="st-btn danger" data-reset type="button">Reset…</button>', 'Clears achievements, high scores and what you have found in the room'))}`,
  appearance: () => {
    const cur = theme.appearance;
    return `<h3 class="st-h first">Appearance</h3>
      <div class="st-aps">${[['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']].map(([id, label]) => `<button class="st-apb${cur === id ? ' on' : ''}" data-ap="${id}" aria-pressed="${cur === id}">${apPreview(id)}<span>${label}</span></button>`).join('')}</div>
      ${note('Auto switches to Dark after sunset in the room and back to Light at sunrise.')}
      <h3 class="st-h">Accent colour</h3>
      ${grp(`<div class="st-accents">${ACCENTS.map((a) => `<button class="st-dot${theme.accent === a.id ? ' on' : ''}" data-accent="${a.id}" style="--c:${a.color}" aria-label="${a.name}" aria-pressed="${theme.accent === a.id}" title="${a.name}"><i></i></button>`).join('')}</div>`)}
      ${note(`Accent: ${(ACCENTS.find((a) => a.id === theme.accent) || ACCENTS[0]).name}. Used for selections, buttons and toggles.`)}`;
  },
  wallpaper: () => {
    const cur = wallpaper.id;
    return `<div class="st-wp-cur"><span class="st-wp-prev" data-wp-prev></span><div><b>${esc(wallpaper.list.find((w) => w.id === cur).name)}</b><span>${cur === 'dynamic' ? 'Changes with the time of day' : 'Also hangs framed on the wall of the room'}</span></div></div>
      <div class="st-wps">${wallpaper.list.map((w) => `<button class="st-wp${cur === w.id ? ' on' : ''}" data-wp="${w.id}" aria-pressed="${cur === w.id}"><span class="st-wpt" data-wpt="${w.id}"></span><em>${esc(w.name)}</em></button>`).join('')}</div>`;
  },
  accessibility: () => grp(
    row('Reduce motion', sw('reduceMotion', system.get('reduceMotion'), 'Reduce motion'), 'Turns off camera parallax, idle sway and window animations'),
  ) + note('This also follows the “reduce motion” setting of your operating system.'),
  keyboard: () => `<h3 class="st-h first">Keyboard shortcuts</h3>${grp(...SHORTCUTS.map(([k, v]) => `<div class="st-row"><div class="st-tx"><b>${esc(k)}</b></div><kbd class="st-kbd">${esc(v)}</kbd></div>`))}`,
};

const TITLES = Object.fromEntries(PANES.map((p) => [p.id, p.name]));

const template = () => `
    <aside class="sb">${LIGHTS}<div class="dragzone" data-drag></div>
      <div class="sb-search"><i>${I.search}</i><em>Search</em></div>
      ${PANES.map((p) => `<button class="sbi" data-pane="${p.id}"><i class="sqi" style="background:${p.color}">${GLYPH[p.glyph]}</i><span>${p.name}</span></button>`).join('')}
    </aside>
    <div class="pane gray">
      <header class="tb" data-drag><span class="nav"><i>${I.chevL}</i><i class="dim">${I.chevR}</i></span><b class="tt c" data-title>General</b></header>
      <div class="set" data-body></div>
    </div>`;

registerApp({
  id: 'settings',
  name: 'System Settings',
  icon: ICON.settings,
  size: { w: 700, h: 470, minW: 560, minH: 360 },
  pos: { x: 130, y: 44 },
  dock: true,
  titlebar: 'none',
  mount(el, ctx, args) {
    el.innerHTML = template();
    const body = el.querySelector('[data-body]');
    const title = el.querySelector('[data-title]');
    let pane = (args && PANE_IDS.includes(args.pane) && args.pane) || storage.get('settings:pane', 'general');
    if (!PANE_IDS.includes(pane)) pane = 'general';
    let dragging = false;

    function render() {
      const keepScroll = body.scrollTop;
      body.innerHTML = BUILD[pane](ctx.content);
      title.textContent = TITLES[pane];
      el.querySelectorAll('[data-pane]').forEach((b) => b.classList.toggle('on', b.dataset.pane === pane));
      // wallpaper previews are canvases (drawn by the same code as the desktop and the wall art)
      body.querySelectorAll('[data-wpt]').forEach((s) => s.appendChild(wallpaper.thumb(s.dataset.wpt)));
      const big = body.querySelector('[data-wp-prev]');
      if (big) big.appendChild(wallpaper.thumb(wallpaper.id, 168, 109));
      body.scrollTop = keepScroll;
    }

    const open = (id) => { if (!PANE_IDS.includes(id)) return; pane = id; storage.set('settings:pane', id); render(); };
    el.addEventListener('click', (e) => {
      const p = e.target.closest('[data-pane]');
      if (p) { sound.pop(); open(p.dataset.pane); return; }
      const t = e.target.closest('[data-tog]');
      if (t) { system.toggle(t.dataset.tog); sound.pop(); return; }
      const ap = e.target.closest('[data-ap]');
      if (ap) { theme.setAppearance(ap.dataset.ap); sound.pop(); return; }
      const ac = e.target.closest('[data-accent]');
      if (ac) { theme.setAccent(ac.dataset.accent); sound.pop(); return; }
      const wp = e.target.closest('[data-wp]');
      if (wp) { wallpaper.set(wp.dataset.wp); sound.pop(); return; }
      if (e.target.closest('[data-act-clear]')) { notifications.clear(); render(); }
      const rs = e.target.closest('[data-reset]');
      if (rs) {
        if (!rs.classList.contains('armed')) { // two-step: the button asks once
          rs.classList.add('armed');
          rs.textContent = 'Click again to confirm';
          sound.blip(330, 0.06, 'triangle', 0.05);
          setTimeout(() => { if (rs.isConnected) { rs.classList.remove('armed'); rs.textContent = 'Reset…'; } }, 3500);
          return;
        }
        achievements.reset();
        scores.reset();
        storage.remove('onboarded');
        bus.emit('progress:reset');
        sound.pop();
        rs.classList.remove('armed');
        rs.textContent = 'Progress reset';
        rs.disabled = true;
      }
    });
    el.addEventListener('pointerdown', (e) => { if (e.target.closest('.st-sl')) dragging = true; });
    window.addEventListener('pointerup', () => { dragging = false; });
    el.addEventListener('input', (e) => {
      const s = e.target.closest('[data-sld]');
      if (!s) return;
      const v = +s.value;
      s.style.setProperty('--v', `${((v - s.min) / (s.max - s.min)) * 100}%`);
      const out = el.querySelector(`[data-val="${s.dataset.sld}"]`);
      if (out) out.textContent = `${v}%`;
      if (s.dataset.sld === 'volume') { system.set('volume', v); system.set('muted', v === 0); }
      else system.set(s.dataset.sld, v);
    });

    // keep the open pane in step with changes made elsewhere (Control Center, the speaker button, the wall art…)
    const offs = [
      bus.on('system:change', () => { if (!dragging) render(); }),
      bus.on('theme:change', render),
      bus.on('wallpaper:change', render),
      bus.on('notify:clear', render),
    ];
    render();
    return {
      destroy() { offs.forEach((off) => off()); },
      /** `open('settings', { pane: 'wallpaper' })` while the window is already open. */
      onOpen(a) { if (a && a.pane) open(a.pane); },
    };
  },
});
