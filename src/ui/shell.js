// Markup of the macOS desktop (wallpaper, widgets, menubar, Dock, Control Center, Spotlight, boot overlay).
// The Dock is generated from the app registry; windows are added at runtime by the window manager.
import { content as C } from '../content.js';
import { listApps } from './apps/registry.js';
import { APPLE, I, ICON } from './apps/icons.js';
import { esc } from './apps/shared.js';
import { favorsWidgetHTML } from './favors-widget.js';

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
        <span class="mbi sm wifi"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M1.8 8.6a15.6 15.6 0 0 1 20.4 0M5.2 12.3a10.6 10.6 0 0 1 13.6 0M8.6 16a5.6 5.6 0 0 1 6.8 0" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/><circle cx="12" cy="19.4" r="1.7" fill="currentColor"/></svg></span>
        <button class="mbi sm" data-act="spot" aria-label="Spotlight"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="10.2" cy="10.2" r="6.4" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="m15 15 6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>
        <button class="mbi sm" data-act="cc" aria-label="Control Center"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><rect x="2.6" y="4" width="18.8" height="6.2" rx="3.1" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="16.4" cy="7.1" r="1.9" fill="currentColor"/><rect x="2.6" y="13.8" width="18.8" height="6.2" rx="3.1" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="7.6" cy="16.9" r="1.9" fill="currentColor"/></svg></button>
        <button class="mbi clock" id="mb-clock" data-act="nc" aria-label="Notification Center"></button>
      </div>`;

const CC_ICON = {
  wifi: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1.8 8.6a15.6 15.6 0 0 1 20.4 0M5.2 12.3a10.6 10.6 0 0 1 13.6 0M8.6 16a5.6 5.6 0 0 1 6.8 0" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/><circle cx="12" cy="19.4" r="1.7" fill="currentColor"/></svg>',
  bluetooth: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7.5l10 9-5 4.5V3l5 4.5-10 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.6A8.4 8.4 0 0 1 9.4 4 8.6 8.6 0 1 0 20 14.6z" fill="currentColor"/></svg>',
  half: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/></svg>',
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.4" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/></g></svg>',
};
export { CC_ICON };

const CONTROL_CENTER = `
      <div class="cc-grid">
        <div class="cc-box">
          <button class="cc-row" data-sys="wifi"><i class="cc-ic">${CC_ICON.wifi}</i><div><b>Wi‑Fi</b><span data-sub="wifi">Home</span></div></button>
          <button class="cc-row" data-sys="bluetooth"><i class="cc-ic">${CC_ICON.bluetooth}</i><div><b>Bluetooth</b><span data-sub="bluetooth">On</span></div></button>
          <button class="cc-row" data-sys="airdrop"><i class="cc-ic">${I.airdrop}</i><div><b>AirDrop</b><span data-sub="airdrop">Off</span></div></button>
        </div>
        <div class="cc-side">
          <button class="cc-tile" data-sys="dnd"><i class="cc-ic">${CC_ICON.moon}</i><b>Do Not<br>Disturb</b></button>
          <button class="cc-tile" data-cc-theme><i class="cc-ic">${CC_ICON.half}</i><b>Dark<br>Mode</b></button>
          <button class="cc-tile" data-sys="nightShift"><i class="cc-ic">${CC_ICON.sun}</i><b>Night<br>Shift</b></button>
        </div>
      </div>
      <div class="cc-sl"><b>Display</b><input type="range" min="25" max="100" value="100" data-cc="bright" style="--v:100%" aria-label="Display brightness" /></div>
      <div class="cc-sl"><b>Sound</b><input type="range" min="0" max="100" value="70" data-cc="vol" style="--v:70%" aria-label="Sound volume" /></div>`;

export function shellHTML() {
  const dockApps = listApps({ dock: true });
  return `
  <div class="scr">
    <div class="wall"></div>

    <div class="widgets">${WIDGETS}
    </div>
    ${favorsWidgetHTML()}

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

    <div class="nc" hidden role="dialog" aria-label="Notification Center"></div>
    <div class="nb-stack" aria-live="polite"></div>

    <div class="spot" hidden>
      <div class="spot-box">
        <div class="spot-in"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="10.2" cy="10.2" r="6.4" fill="none" stroke="currentColor" stroke-width="2"/><path d="m15 15 6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><input placeholder="Spotlight Search" spellcheck="false" autocomplete="off" /></div>
        <div class="spot-res"></div>
      </div>
    </div>

    <div class="shift"></div>
    <div class="dimmer" hidden></div>
    <div class="boot"><div class="boot-in">${APPLE}<div class="bar"><i></i></div></div></div>
    <div class="glare"></div>
  </div>`;
}
