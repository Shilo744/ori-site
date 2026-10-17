// "Ori, Can You...?" on the desktop: a Dock icon (2nd slot, right after Finder) that opens the 3D game in its own full-screen overlay.
// It is a LAUNCHER, not a window: the registry runs `launch()` instead of mounting a window (see wm.js), the Dock icon bounces like any
// other, and quitting the game puts you back on the desktop exactly as you left it.
import { registerApp } from './registry.js';
import { launchGame3D } from '../../game3d/host.js';

/** The app icon: an iPhone with the stack of tasks on its screen and a red "99+" badge — on a warm gradient squircle. */
export const FAVORS_ICON = `<svg viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <linearGradient id="fvg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb25b"/><stop offset="0.55" stop-color="#ff6e7f"/><stop offset="1" stop-color="#8a5bff"/></linearGradient>
    <linearGradient id="fvs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2f45"/><stop offset="1" stop-color="#171a2b"/></linearGradient>
  </defs>
  <rect width="64" height="64" rx="14.5" fill="url(#fvg)"/>
  <rect x="21" y="10" width="22" height="44" rx="5" fill="#f4f5f9"/>
  <rect x="23" y="13" width="18" height="38" rx="3" fill="url(#fvs)"/>
  <rect x="29" y="14.2" width="6" height="1.8" rx="0.9" fill="#0a0c18"/>
  <g fill="#ffffff"><rect x="24.6" y="20" width="14.8" height="5.2" rx="1.6" opacity=".92"/><rect x="24.6" y="27" width="14.8" height="5.2" rx="1.6" opacity=".7"/><rect x="24.6" y="34" width="14.8" height="5.2" rx="1.6" opacity=".5"/></g>
  <g fill="#ffb25b"><circle cx="27.4" cy="22.6" r="1.4"/><circle cx="27.4" cy="29.6" r="1.4" fill="#7fe3d6"/><circle cx="27.4" cy="36.6" r="1.4" fill="#c9a3ff"/></g>
  <circle cx="46" cy="15" r="9.4" fill="#ff3b30" stroke="#fff" stroke-width="2"/>
  <text x="46" y="18.6" text-anchor="middle" font-family="Inter, -apple-system, system-ui, sans-serif" font-size="10" font-weight="800" fill="#fff">99+</text>
</svg>`;

registerApp({
  id: 'favors',
  name: 'Ori, Can You...?',
  menuTitle: 'Ori, Can You...?',
  icon: FAVORS_ICON,
  dock: true,
  hidden: true, // not in the plain app lists (Spotlight and the terminal have their own entries)
  spotlightKind: 'Game',
  aliases: [{ name: 'ori' }],
  launch: () => launchGame3D('favors'),
  mount() { return {}; }, // never used: a launcher has no window
});
