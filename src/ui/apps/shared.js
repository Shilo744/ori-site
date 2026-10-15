// Small helpers shared by the app modules.
import { I } from './icons.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Traffic-light buttons — the window manager wires up their `data-act` clicks. */
export const LIGHTS = '<div class="lights"><i class="r" data-act="close"></i><i class="y" data-act="min"></i><i class="g" data-act="max"></i></div>';

export const sbItem = (icon, label, on = false) => `<div class="sbi${on ? ' on' : ''}"><i>${I[icon]}</i><span>${esc(label)}</span></div>`;

/** Procedural project cover art for the Safari grid. */
export function cover(hue, i) {
  const a = `hsl(${hue} 78% 62%)`, b = `hsl(${(hue + 48) % 360} 72% 42%)`, c = `hsl(${(hue + 20) % 360} 90% 82%)`;
  return `<svg viewBox="0 0 320 170" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="cg${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="320" height="170" fill="url(#cg${i})"/>
    <circle cx="${240 - i * 10}" cy="50" r="62" fill="${c}" opacity=".35"/>
    <circle cx="70" cy="150" r="80" fill="#fff" opacity=".12"/>
    <rect x="34" y="40" width="${120 + i * 6}" height="12" rx="6" fill="#fff" opacity=".85"/>
    <rect x="34" y="62" width="90" height="8" rx="4" fill="#fff" opacity=".5"/>
    <rect x="34" y="104" width="64" height="26" rx="13" fill="#fff" opacity=".9"/>
  </svg>`;
}
