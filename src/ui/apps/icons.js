// Shared SVG icon kit for the macOS desktop: toolbar glyphs (16px) and squircle app icons (64px).
// Hand-drawn approximations — no Apple artwork.
const APPLE_PATH = 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701';
export const APPLE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${APPLE_PATH}"/></svg>`;

const s16 = (inner, w = 1.5) => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
export const I = {
  chevL: s16('<path d="M10 3 5 8l5 5"/>', 1.8),
  chevR: s16('<path d="M6 3l5 5-5 5"/>', 1.8),
  sidebar: s16('<rect x="1.8" y="3" width="12.4" height="10" rx="2.2"/><path d="M6 3.2v9.6"/>'),
  share: s16('<path d="M8 9.6V2.4M5.2 4.8 8 2l2.8 2.8M4.6 6.8H4a1 1 0 0 0-1 1v4.7a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7.8a1 1 0 0 0-1-1h-.6"/>'),
  plus: s16('<path d="M8 3v10M3 8h10"/>', 1.6),
  tabs: s16('<rect x="2.6" y="4.8" width="8.6" height="8.6" rx="1.8"/><path d="M5 3h7.4A1.6 1.6 0 0 1 14 4.6V12"/>'),
  lock: s16('<rect x="3.4" y="7" width="9.2" height="6.6" rx="1.6" fill="currentColor" stroke="none"/><path d="M5.4 7V5.4a2.6 2.6 0 0 1 5.2 0V7"/>', 1.4),
  search: s16('<circle cx="7" cy="7" r="4.4"/><path d="m10.4 10.4 3.4 3.4"/>', 1.6),
  send: s16('<path d="M14 2 7.2 14l-1.6-5.2L1 7.4z"/><path d="m5.6 8.8 4-3.4"/>', 1.4),
  grid: s16('<rect x="2.4" y="2.4" width="4.6" height="4.6" rx="1"/><rect x="9" y="2.4" width="4.6" height="4.6" rx="1"/><rect x="2.4" y="9" width="4.6" height="4.6" rx="1"/><rect x="9" y="9" width="4.6" height="4.6" rx="1"/>', 1.3),
  list: s16('<path d="M2.6 4h10.8M2.6 8h10.8M2.6 12h10.8"/>', 1.6),
  folder: s16('<path d="M1.8 4.6a1.6 1.6 0 0 1 1.6-1.6h2.6l1.4 1.6h5.2a1.6 1.6 0 0 1 1.6 1.6v5.6a1.6 1.6 0 0 1-1.6 1.6H3.4a1.6 1.6 0 0 1-1.6-1.6z"/>', 1.4),
  doc: s16('<path d="M4 1.8h5l3.4 3.4v8.2a.9.9 0 0 1-.9.9H4a.9.9 0 0 1-.9-.9V2.7a.9.9 0 0 1 .9-.9z"/><path d="M9 1.8v3.6h3.4"/>', 1.3),
  clock: s16('<circle cx="8" cy="8" r="6"/><path d="M8 4.6V8l2.4 1.5"/>', 1.4),
  apps: s16('<path d="M8 2.2 13.4 13H2.6zM5.4 9h5.2"/>', 1.4),
  desktop: s16('<rect x="1.8" y="2.6" width="12.4" height="8.2" rx="1.4"/><path d="M5.6 13.6h4.8M8 10.8v2.8"/>', 1.4),
  download: s16('<circle cx="8" cy="8" r="6.2"/><path d="M8 4.6v5.6M5.6 8.2 8 10.6l2.4-2.4"/>', 1.4),
  cloud: s16('<path d="M4.6 12.4a3 3 0 0 1-.4-5.97 4 4 0 0 1 7.6.9 2.6 2.6 0 0 1-.4 5.07z"/>', 1.4),
  laptop: s16('<rect x="3" y="3" width="10" height="7" rx="1.2"/><path d="M1.4 12.6h13.2"/>', 1.4),
  airdrop: s16('<circle cx="8" cy="8.6" r="1.4" fill="currentColor"/><path d="M4.8 11.4a4.6 4.6 0 1 1 6.4 0"/><path d="M2.8 13.2a7.4 7.4 0 1 1 10.4 0"/>', 1.3),
};

/** Squircle app icon wrapper. `id` must be unique per icon (it names the clip path and gradients). */
export const sq = (id, body, defs = '') => `<svg viewBox="0 0 64 64" aria-hidden="true"><defs>${defs}<clipPath id="c${id}"><rect width="64" height="64" rx="14.4"/></clipPath></defs><g clip-path="url(#c${id})">${body}</g></svg>`;
export const lg = (id, a, b, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const ticks = [...Array(12)].map((_, i) => {
  const a = (i * 30 * Math.PI) / 180, r1 = i % 3 === 0 ? 19.5 : 21, r2 = 23;
  return `<path d="M${(32 + Math.sin(a) * r1).toFixed(2)} ${(32 - Math.cos(a) * r1).toFixed(2)}L${(32 + Math.sin(a) * r2).toFixed(2)} ${(32 - Math.cos(a) * r2).toFixed(2)}"/>`;
}).join('');

export const ICON = {
  finder: sq('F',
    `<rect width="64" height="64" fill="url(#gF1)"/><path d="M33 0H64V64H29.5Q35.5 38 33 0Z" fill="url(#gF2)"/>
     <g fill="#0b1f4d"><rect x="16.5" y="15" width="4.4" height="11" rx="2.2"/><rect x="43" y="15" width="4.4" height="11" rx="2.2"/></g>
     <path d="M33.2 13c-1 8-.8 17 .8 24" fill="none" stroke="#0b1f4d" stroke-width="2.2" stroke-linecap="round"/>
     <path d="M15 42c8.4 10 25.6 10 34 0" fill="none" stroke="#0b1f4d" stroke-width="2.8" stroke-linecap="round"/>`,
    lg('gF1', '#d6efff', '#6db8ff') + lg('gF2', '#3d8fff', '#1253e0')),
  safari: sq('S',
    `<rect width="64" height="64" fill="url(#gS1)"/><circle cx="32" cy="32" r="24" fill="url(#gS2)"/>
     <g stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".9">${ticks}</g>
     <g transform="rotate(45 32 32)"><path d="M32 12.5 38 32H26z" fill="#ff453a"/><path d="M32 51.5 26 32h12z" fill="#fff"/></g>
     <circle cx="32" cy="32" r="2" fill="#0a64f0"/>`,
    lg('gS1', '#ffffff', '#d3e3f6') + lg('gS2', '#56c2ff', '#0a60ee', 1, 1)),
  notes: sq('N',
    `<rect width="64" height="64" fill="#fff"/><rect width="64" height="21" fill="url(#gN)"/>
     <g stroke="#dcdce1" stroke-width="1.6"><path d="M9 32h46M9 41h46M9 50h46"/></g>
     <path d="M0 21h64" stroke="rgba(0,0,0,.08)" stroke-width="1"/>`,
    lg('gN', '#ffe65c', '#ffc800')),
  mail: sq('M',
    `<rect width="64" height="64" fill="url(#gM)"/><rect x="10.5" y="17.5" width="43" height="30" rx="5" fill="#fff"/>
     <path d="M12.5 22l19.5 14.5L51.5 22" fill="none" stroke="#2b8cf8" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`,
    lg('gM', '#63cdfb', '#0a68f3')),
  terminal: sq('T',
    `<rect width="64" height="64" fill="url(#gT)"/><rect x="2.4" y="2.4" width="59.2" height="59.2" rx="12.2" fill="none" stroke="#8e8e93" stroke-width="1.3" opacity=".55"/>
     <path d="M14 23l11 9-11 9" fill="none" stroke="#fff" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 43h18" stroke="#fff" stroke-width="3.8" stroke-linecap="round"/>`,
    lg('gT', '#4c4c51', '#111113')),
  settings: sq('G',
    `<rect width="64" height="64" fill="url(#gG)"/>
     <circle cx="32" cy="32" r="17.4" fill="none" stroke="#f1f2f4" stroke-width="8" stroke-dasharray="7.8 7.8"/>
     <circle cx="32" cy="32" r="15" fill="#f1f2f4"/><circle cx="32" cy="32" r="7.6" fill="#80848d"/>`,
    lg('gG', '#c8cbd2', '#767a84')),
  trash: `<svg viewBox="0 0 64 64" aria-hidden="true"><defs>${lg('gB', 'rgba(255,255,255,.55)', 'rgba(210,214,224,.35)')}</defs>
     <path d="M15 16h34l-3.2 39.4a3 3 0 0 1-3 2.6H21.2a3 3 0 0 1-3-2.6z" fill="url(#gB)" stroke="rgba(255,255,255,.85)" stroke-width="1.6"/>
     <path d="M12 16h40" stroke="rgba(255,255,255,.95)" stroke-width="3.2" stroke-linecap="round"/>
     <path d="M25 24l1.2 26M32 24v26M39 24l-1.2 26" stroke="rgba(255,255,255,.55)" stroke-width="1.8" stroke-linecap="round"/></svg>`,
};

export const docIcon = (tint = '#5b8def') => `<svg viewBox="0 0 48 60" aria-hidden="true"><path d="M4 4a4 4 0 0 1 4-4h24l12 12v44a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="#fff" stroke="#c7c9d0" stroke-width="1.2"/><path d="M32 0v8a4 4 0 0 0 4 4h8z" fill="#e4e6ec"/><g stroke="${tint}" stroke-width="2.2" stroke-linecap="round"><path d="M11 24h26M11 31h26M11 38h18"/></g></svg>`;
export const folderIcon = () => `<svg viewBox="0 0 64 54" aria-hidden="true"><defs>${lg('fB', '#7ec3ff', '#4a9bf0')}${lg('fF', '#9fd4ff', '#59a8f7')}</defs><path d="M0 8a6 6 0 0 1 6-6h14l6 6h32a6 6 0 0 1 6 6v32a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6z" fill="url(#fB)"/><rect y="14" width="64" height="40" rx="6" fill="url(#fF)"/></svg>`;
