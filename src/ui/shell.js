// Markup of the macOS desktop (wallpaper, widgets, menubar, Dock, Control Center, Spotlight, boot overlay, cursor).
// The Dock is generated from the app registry; windows are added at runtime by the window manager.
import { content as C } from '../content.js';
import { listApps } from './apps/registry.js';
import { APPLE, I, ICON } from './apps/icons.js';
import { esc } from './apps/shared.js';

export const CURSORS = `
  <svg class="cu cu-arrow" viewBox="0 0 14 21" aria-hidden="true"><path d="M1.2 1.1v15.4l3.5-3.2 2.5 6 2.5-1.1-2.4-5.9h5L1.2 1.1z" fill="#000" stroke="#fff" stroke-width="1.15" stroke-linejoin="round"/></svg>
  <svg class="cu cu-hand" viewBox="0 0 20 22" aria-hidden="true"><path d="M7.4 1.2c-.9 0-1.6.7-1.6 1.6v8.2L4.6 9.8a1.7 1.7 0 0 0-2.5.1 1.6 1.6 0 0 0-.1 2.1l4 5.1c.8 1 1.9 1.6 3.2 1.6h4.1c1.8 0 3.2-1.4 3.2-3.2v-4.6c0-.8-.6-1.4-1.4-1.4-.3 0-.5.1-.7.2-.2-.5-.7-.8-1.3-.8-.4 0-.7.1-1 .4-.3-.4-.7-.6-1.2-.6-.2 0-.4 0-.6.1V2.8c0-.9-.7-1.6-1.6-1.6z" fill="#fff" stroke="#000" stroke-width="1" stroke-linejoin="round"/></svg>
  <svg class="cu cu-text" viewBox="0 0 9 19" aria-hidden="true"><g stroke="#fff" stroke-width="3.2" stroke-linecap="round"><path d="M1.7 1.7h5.6M1.7 17.3h5.6M4.5 1.7v15.6"/></g><g stroke="#000" stroke-width="1.3" stroke-linecap="round"><path d="M1.7 1.7h5.6M1.7 17.3h5.6M4.5 1.7v15.6"/></g></svg>`;

const WALLPAPER = `
      <svg viewBox="0 0 1280 832" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="wp-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#0d1646"/><stop offset=".42" stop-color="#3b2a96"/>
            <stop offset=".78" stop-color="#b6389a"/><stop offset="1" stop-color="#ff8f5e"/>
          </linearGradient>
          <linearGradient id="wp-a" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#4ad0ff" stop-opacity=".75"/><stop offset=".5" stop-color="#7a6bff" stop-opacity=".7"/><stop offset="1" stop-color="#ff7ad1" stop-opacity=".7"/>
          </linearGradient>
          <linearGradient id="wp-b" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#ffb36a" stop-opacity=".75"/><stop offset="1" stop-color="#ff5e9c" stop-opacity=".6"/>
          </linearGradient>
          <linearGradient id="wp-c" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#2e1c7a" stop-opacity=".9"/><stop offset="1" stop-color="#7a2a9a" stop-opacity=".7"/>
          </linearGradient>
          <radialGradient id="wp-g1"><stop offset="0" stop-color="#ffd1a0" stop-opacity=".55"/><stop offset="1" stop-color="#ffd1a0" stop-opacity="0"/></radialGradient>
          <radialGradient id="wp-g2"><stop offset="0" stop-color="#3ad0ff" stop-opacity=".32"/><stop offset="1" stop-color="#3ad0ff" stop-opacity="0"/></radialGradient>
        </defs>
        <rect width="1280" height="832" fill="url(#wp-bg)"/>
        <circle cx="1040" cy="170" r="300" fill="url(#wp-g1)"/>
        <circle cx="180" cy="120" r="340" fill="url(#wp-g2)"/>
        <path d="M-60 560 C 200 360 460 720 760 520 S 1180 280 1360 430 V900 H-60Z" fill="url(#wp-c)"/>
        <path d="M-60 600 C 220 440 520 780 820 590 S 1160 400 1360 520 V900 H-60Z" fill="url(#wp-a)"/>
        <path d="M-60 700 C 260 580 560 820 900 690 S 1180 600 1360 690 V900 H-60Z" fill="url(#wp-b)"/>
        <path d="M-60 770 C 300 700 620 840 960 760 S 1200 730 1360 770 V900 H-60Z" fill="#0c0a2a" opacity=".45"/>
      </svg>`;

const WIDGETS = `
      <div class="wg wg-cal"><div class="d" id="wg-day">THURSDAY</div><div class="n" id="wg-date">15</div><div class="ev"><i></i><span>Coffee &amp; code</span><em>10:30</em></div><div class="ev"><i class="b"></i><span>Portfolio review</span><em>16:00</em></div></div>
      <div class="wg wg-wx"><div class="c">${esc(C.location.split(',')[0])}</div><div class="t">27°</div><div class="s"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.6" fill="#ffd60a"/><g stroke="#ffd60a" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></g></svg>Sunny<br><em>H:29° L:21°</em></div></div>`;

const MENUBAR = `
      <div class="mb-l">
        <button class="mbi logo" data-menu="apple" aria-label="Apple menu">${APPLE}</button>
        <button class="mbi app" data-menu="app" id="mb-app">Finder</button>
        <button class="mbi" data-menu="file">File</button><button class="mbi" data-menu="edit">Edit</button><button class="mbi" data-menu="view">View</button><button class="mbi" data-menu="go">Go</button><button class="mbi" data-menu="window">Window</button><button class="mbi" data-menu="help">Help</button>
      </div>
      <div class="mb-notch"></div>
      <div class="mb-r">
        <span class="mbi sm"><svg viewBox="0 0 28 14" width="25" height="13" aria-hidden="true"><rect x=".7" y=".7" width="23" height="12.6" rx="3.6" fill="none" stroke="currentColor" stroke-opacity=".6" stroke-width="1.3"/><rect x="2.5" y="2.5" width="16.5" height="9" rx="2" fill="currentColor"/><path d="M25.4 4.6v4.8c.9-.3 1.6-1.2 1.6-2.4s-.7-2.1-1.6-2.4z" fill="currentColor" opacity=".6"/></svg></span>
        <span class="mbi sm"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M1.8 8.6a15.6 15.6 0 0 1 20.4 0M5.2 12.3a10.6 10.6 0 0 1 13.6 0M8.6 16a5.6 5.6 0 0 1 6.8 0" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/><circle cx="12" cy="19.4" r="1.7" fill="currentColor"/></svg></span>
        <button class="mbi sm" data-act="spot" aria-label="Spotlight"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="10.2" cy="10.2" r="6.4" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="m15 15 6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>
        <button class="mbi sm" data-act="cc" aria-label="Control Center"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><rect x="2.6" y="4" width="18.8" height="6.2" rx="3.1" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="16.4" cy="7.1" r="1.9" fill="currentColor"/><rect x="2.6" y="13.8" width="18.8" height="6.2" rx="3.1" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="7.6" cy="16.9" r="1.9" fill="currentColor"/></svg></button>
        <span class="mbi clock" id="mb-clock"></span>
      </div>`;

const CONTROL_CENTER = `
      <div class="cc-grid">
        <div class="cc-box"><div class="cc-row"><i class="cc-ic on">${I.chevR}</i><div><b>Wi‑Fi</b><span>Home</span></div></div><div class="cc-row"><i class="cc-ic on">${I.share}</i><div><b>Bluetooth</b><span>On</span></div></div><div class="cc-row"><i class="cc-ic">${I.airdrop}</i><div><b>AirDrop</b><span>Contacts Only</span></div></div></div>
        <div class="cc-side"><div class="cc-tile"><i class="cc-ic">${I.clock}</i><b>Focus</b></div><div class="cc-tile"><i class="cc-ic on">${I.desktop}</i><b>Stage<br>Manager</b></div></div>
      </div>
      <div class="cc-sl"><b>Display</b><input type="range" min="25" max="100" value="100" data-cc="bright" style="--v:100%" /></div>
      <div class="cc-sl"><b>Sound</b><input type="range" min="0" max="100" value="70" data-cc="vol" style="--v:70%" /></div>`;

export function shellHTML() {
  const dockApps = listApps({ dock: true });
  return `
  <div class="scr">
    <div class="wall">${WALLPAPER}
    </div>

    <div class="widgets">${WIDGETS}
    </div>

    <div class="wins"></div>

    <header class="mb">${MENUBAR}
    </header>

    <div class="menus"></div>

    <nav class="dock" aria-label="Dock">
      ${dockApps.map((a) => `<button class="dk" data-open="${a.id}" data-app="${a.id}"><span class="dki">${a.icon}</span><em>${esc(a.name)}</em><u></u></button>`).join('')}
      <span class="dsep"></span>
      <button class="dk" data-trash><span class="dki">${ICON.trash}</span><em>Trash</em><u></u></button>
    </nav>

    <div class="cc" hidden>${CONTROL_CENTER}
    </div>

    <div class="spot" hidden>
      <div class="spot-box">
        <div class="spot-in"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="10.2" cy="10.2" r="6.4" fill="none" stroke="currentColor" stroke-width="2"/><path d="m15 15 6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><input placeholder="Spotlight Search" spellcheck="false" autocomplete="off" /></div>
        <div class="spot-res"></div>
      </div>
    </div>

    <div class="dimmer" hidden></div>
    <div class="boot"><div class="boot-in">${APPLE}<div class="bar"><i></i></div></div></div>
    <div class="glare"></div>
    <div class="cur" hidden>${CURSORS}</div>
  </div>`;
}
