// The "macOS" shown on the MacBook screen. Plain DOM, rendered into the 3D scene by CSS3DRenderer.
import { content as C } from '../content.js';
import * as sound from '../audio.js';
import { SCREEN_PX } from '../screen-size.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ───────────────────────── icons ─────────────────────────
const APPLE_PATH = 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701';
const APPLE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${APPLE_PATH}"/></svg>`;

const s16 = (inner, w = 1.5) => `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const I = {
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

// Dock / app icons (64×64, squircle). Hand-drawn approximations — no Apple artwork.
const sq = (id, body, defs = '') => `<svg viewBox="0 0 64 64" aria-hidden="true"><defs>${defs}<clipPath id="c${id}"><rect width="64" height="64" rx="14.4"/></clipPath></defs><g clip-path="url(#c${id})">${body}</g></svg>`;
const lg = (id, a, b, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const ticks = [...Array(12)].map((_, i) => {
  const a = (i * 30 * Math.PI) / 180, r1 = i % 3 === 0 ? 19.5 : 21, r2 = 23;
  return `<path d="M${(32 + Math.sin(a) * r1).toFixed(2)} ${(32 - Math.cos(a) * r1).toFixed(2)}L${(32 + Math.sin(a) * r2).toFixed(2)} ${(32 - Math.cos(a) * r2).toFixed(2)}"/>`;
}).join('');

const ICON = {
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

const docIcon = (tint = '#5b8def') => `<svg viewBox="0 0 48 60" aria-hidden="true"><path d="M4 4a4 4 0 0 1 4-4h24l12 12v44a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="#fff" stroke="#c7c9d0" stroke-width="1.2"/><path d="M32 0v8a4 4 0 0 0 4 4h8z" fill="#e4e6ec"/><g stroke="${tint}" stroke-width="2.2" stroke-linecap="round"><path d="M11 24h26M11 31h26M11 38h18"/></g></svg>`;
const folderIcon = () => `<svg viewBox="0 0 64 54" aria-hidden="true"><defs>${lg('fB', '#7ec3ff', '#4a9bf0')}${lg('fF', '#9fd4ff', '#59a8f7')}</defs><path d="M0 8a6 6 0 0 1 6-6h14l6 6h32a6 6 0 0 1 6 6v32a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6z" fill="url(#fB)"/><rect y="14" width="64" height="40" rx="6" fill="url(#fF)"/></svg>`;

// ───────────────────────── app registry ─────────────────────────
const APPS = {
  finder:   { name: 'Finder',          w: 600, h: 380, x: 120, y: 66 },
  safari:   { name: 'Safari',          w: 780, h: 468, x: 90,  y: 42 },
  notes:    { name: 'Notes',           w: 690, h: 430, x: 130, y: 54 },
  mail:     { name: 'Mail',            w: 540, h: 430, x: 210, y: 48 },
  terminal: { name: 'Terminal',        w: 580, h: 350, x: 70,  y: 116 },
  settings: { name: 'System Settings', w: 640, h: 420, x: 160, y: 50 },
  welcome:  { name: 'Finder',          w: 480, h: 360, x: 240, y: 84 },
};
const ALIAS = {
  home: ['welcome'],
  about: ['notes', 'about'],
  experience: ['notes', 'experience'],
  skills: ['notes', 'skills'],
  projects: ['safari'],
  contact: ['mail'],
};
const DOCK = ['finder', 'safari', 'notes', 'mail', 'terminal', 'settings'];

const LIGHTS = `<div class="lights"><i class="r" data-act="close"></i><i class="y" data-act="min"></i><i class="g" data-act="max"></i></div>`;
const sbItem = (icon, label, on = false) => `<div class="sbi${on ? ' on' : ''}"><i>${I[icon]}</i><span>${esc(label)}</span></div>`;

function cover(hue, i) {
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

const NOTES = {
  about: () => ({
    title: 'About Me',
    html: `<h1>About Me</h1>
      ${C.about.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}
      <h2>Quick facts</h2>
      <ul>${C.about.facts.map(([k, v]) => `<li><b>${esc(k)}:</b> ${esc(v)}</li>`).join('')}</ul>`,
    preview: C.about.paragraphs[0],
  }),
  experience: () => ({
    title: 'Experience',
    html: `<h1>Experience</h1>
      ${C.experience.map((e) => `<div class="xp"><div class="xp-h"><b>${esc(e.role)}</b><span>${esc(e.period)}</span></div><div class="xp-c">${esc(e.company)}</div><p>${esc(e.summary)}</p></div>`).join('')}`,
    preview: `${C.experience[0].role} · ${C.experience[0].company}`,
  }),
  skills: () => ({
    title: 'Skills & Tools',
    html: `<h1>Skills &amp; Tools</h1><p>The things I reach for every day.</p>
      <div class="chips">${C.about.skills.map((s) => `<span>${esc(s)}</span>`).join('')}</div>`,
    preview: C.about.skills.slice(0, 4).join(', '),
  }),
};
const NOTE_ORDER = ['about', 'experience', 'skills'];

const TPL = {
  finder: () => `
    <aside class="sb">${LIGHTS}<div class="dragzone" data-drag></div>
      <div class="sb-sec">Favorites</div>
      ${sbItem('airdrop', 'AirDrop')}${sbItem('clock', 'Recents')}${sbItem('apps', 'Applications')}${sbItem('desktop', 'Desktop')}${sbItem('doc', 'Documents')}${sbItem('download', 'Downloads')}
      <div class="sb-sec">iCloud</div>${sbItem('cloud', 'iCloud Drive')}
      <div class="sb-sec">Locations</div>${sbItem('laptop', `${C.name.split(' ')[0]}’s MacBook`)}
    </aside>
    <div class="pane">
      <header class="tb" data-drag>
        <span class="nav"><i>${I.chevL}</i><i class="dim">${I.chevR}</i></span>
        <b class="tt"><i>${I.folder}</i>${esc(C.name)}</b>
        <span class="sp"></span>
        <span class="seg"><i class="on">${I.grid}</i><i>${I.list}</i></span>
        <span class="search"><i>${I.search}</i><em>Search</em></span>
      </header>
      <div class="fgrid">
        <div class="fitem" data-dopen="about"><div class="fic">${docIcon('#5b8def')}</div><span>About Me.txt</span></div>
        <div class="fitem" data-dopen="experience"><div class="fic">${docIcon('#34c759')}</div><span>Experience.pdf</span></div>
        <div class="fitem" data-dopen="projects"><div class="fic folder">${folderIcon()}</div><span>Projects</span></div>
        <div class="fitem" data-dopen="contact"><div class="fic">${docIcon('#ff9f0a')}</div><span>Contact.vcf</span></div>
      </div>
      <footer class="fstat">4 items, 128 GB available</footer>
    </div>`,

  safari: () => `
    <header class="tb stb" data-drag>
      ${LIGHTS}
      <i class="ic">${I.sidebar}</i>
      <span class="nav"><i>${I.chevL}</i><i class="dim">${I.chevR}</i></span>
      <span class="sp"></span>
      <div class="addr"><i>${I.lock}</i><span>oriasher.com</span></div>
      <span class="sp"></span>
      <i class="ic">${I.share}</i><i class="ic">${I.plus}</i><i class="ic">${I.tabs}</i>
    </header>
    <div class="web">
      <div class="web-hero">
        <div class="eyebrow">Selected work · ${C.year}</div>
        <h1>Things I’ve made.</h1>
        <p>${esc(C.tagline)}</p>
      </div>
      <div class="web-grid">
        ${C.projects.map((p, i) => `
          <a class="card" href="${esc(p.url)}" target="_blank" rel="noopener">
            <div class="cover">${cover(p.hue, i)}</div>
            <div class="meta">
              <div class="row"><b>${esc(p.name)}</b><span>${esc(p.year)}</span></div>
              <p>${esc(p.blurb)}</p>
              <div class="chips">${p.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
            </div>
          </a>`).join('')}
      </div>
    </div>`,

  notes: () => `
    <aside class="sb nl">${LIGHTS}<div class="dragzone" data-drag></div>
      <div class="nl-head"><b>Notes</b><span>${NOTE_ORDER.length} notes</span></div>
      <div class="nl-sec">Today</div>
      ${NOTE_ORDER.map((id) => { const n = NOTES[id](); return `<button class="nli" data-note="${id}"><b>${esc(n.title)}</b><span><em>${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</em> ${esc(n.preview.slice(0, 44))}…</span></button>`; }).join('')}
    </aside>
    <div class="pane">
      <header class="tb" data-drag>
        <span class="sp"></span>
        <i class="ic">${I.folder}</i><i class="ic">${I.share}</i><span class="search"><i>${I.search}</i><em>Search</em></span>
      </header>
      <article class="note"></article>
    </div>`,

  mail: () => `
    <header class="tb" data-drag>${LIGHTS}<b class="tt c">New Message</b><i class="ic send" data-send title="Send">${I.send}</i></header>
    <form class="compose">
      <label class="rw"><span>To:</span><input value="${esc(C.name)} &lt;${esc(C.contact.email)}&gt;" readonly /></label>
      <label class="rw"><span>Cc:</span><input /></label>
      <label class="rw"><span>Subject:</span><input name="subject" /></label>
      <label class="rw"><span>From:</span><input name="from" type="email" placeholder="your@email.com" /></label>
      <textarea name="msg" placeholder="Write your message…"></textarea>
    </form>`,

  settings: () => `
    <aside class="sb">${LIGHTS}<div class="dragzone" data-drag></div>
      <div class="sb-search"><i>${I.search}</i><em>Search</em></div>
      ${[['#0a84ff', 'Wi‑Fi'], ['#0a84ff', 'Bluetooth'], ['#34c759', 'Network'], ['#ff3b30', 'Notifications'], ['#ff2d55', 'Sound'], ['#5e5ce6', 'Focus'], ['#8e8e93', 'General', true], ['#0a84ff', 'Appearance'], ['#5856d6', 'Accessibility']]
        .map(([c, l, on]) => `<div class="sbi${on ? ' on' : ''}"><i class="sqi" style="background:${c}"></i><span>${l}</span></div>`).join('')}
    </aside>
    <div class="pane gray">
      <header class="tb" data-drag><span class="nav"><i>${I.chevL}</i><i class="dim">${I.chevR}</i></span><b class="tt c">About</b></header>
      <div class="set">
        <div class="set-hero">
          <svg viewBox="0 0 120 80" aria-hidden="true"><defs>${lg('lb', '#e9ebef', '#c3c7cf')}${lg('ls', '#5b3fd6', '#e8658b', 1, 1)}</defs><rect x="14" y="4" width="92" height="62" rx="6" fill="url(#lb)"/><rect x="18.5" y="8.5" width="83" height="53" rx="2.5" fill="url(#ls)"/><path d="M4 70h112l-6 5H10z" fill="url(#lb)"/></svg>
          <h2>MacBook Air</h2><p>13-inch, ${C.year}</p>
        </div>
        <div class="grp">
          ${[['Name', `${C.name}’s MacBook`], ['Role', C.title], ['Location', C.location], ['Email', C.contact.email], ['Portfolio', String(C.year)]]
            .map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}
        </div>
      </div>
    </div>`,

  welcome: () => `
    <div class="welcome" data-drag>
      ${LIGHTS}
      <div class="wl-av">${esc(C.initials)}</div>
      <h1>${esc(C.name)}</h1>
      <p class="role">${esc(C.title)}</p>
      <p class="tagline">${esc(C.tagline)}</p>
      <div class="wl-btns">
        <button class="btn def" data-open="projects">View Projects</button>
        <button class="btn" data-open="about">About</button>
        <button class="btn" data-open="experience">Experience</button>
        <button class="btn" data-open="contact">Contact</button>
      </div>
    </div>`,

  terminal: () => `
    <header class="tb dark" data-drag>${LIGHTS}<b class="tt c">${esc(C.name.split(' ')[0].toLowerCase())} — -zsh — 80×24</b></header>
    <div class="term"><div class="out"></div><label class="in"><span>${esc(C.name.split(' ')[0].toLowerCase())}@macbook ~ %</span><input spellcheck="false" autocomplete="off" autocapitalize="off" /></label></div>`,
};

// ───────────────────────── cursors ─────────────────────────
const CURSORS = `
  <svg class="cu cu-arrow" viewBox="0 0 14 21" aria-hidden="true"><path d="M1.2 1.1v15.4l3.5-3.2 2.5 6 2.5-1.1-2.4-5.9h5L1.2 1.1z" fill="#000" stroke="#fff" stroke-width="1.15" stroke-linejoin="round"/></svg>
  <svg class="cu cu-hand" viewBox="0 0 20 22" aria-hidden="true"><path d="M7.4 1.2c-.9 0-1.6.7-1.6 1.6v8.2L4.6 9.8a1.7 1.7 0 0 0-2.5.1 1.6 1.6 0 0 0-.1 2.1l4 5.1c.8 1 1.9 1.6 3.2 1.6h4.1c1.8 0 3.2-1.4 3.2-3.2v-4.6c0-.8-.6-1.4-1.4-1.4-.3 0-.5.1-.7.2-.2-.5-.7-.8-1.3-.8-.4 0-.7.1-1 .4-.3-.4-.7-.6-1.2-.6-.2 0-.4 0-.6.1V2.8c0-.9-.7-1.6-1.6-1.6z" fill="#fff" stroke="#000" stroke-width="1" stroke-linejoin="round"/></svg>
  <svg class="cu cu-text" viewBox="0 0 9 19" aria-hidden="true"><g stroke="#fff" stroke-width="3.2" stroke-linecap="round"><path d="M1.7 1.7h5.6M1.7 17.3h5.6M4.5 1.7v15.6"/></g><g stroke="#000" stroke-width="1.3" stroke-linecap="round"><path d="M1.7 1.7h5.6M1.7 17.3h5.6M4.5 1.7v15.6"/></g></svg>`;

// ───────────────────────── desktop ─────────────────────────
export function createDesktop(opts = {}) {
  const root = document.createElement('div');
  root.className = 'mac locked';
  root.innerHTML = `
  <div class="scr">
    <div class="wall">
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
      </svg>
    </div>

    <div class="widgets">
      <div class="wg wg-cal"><div class="d" id="wg-day">THURSDAY</div><div class="n" id="wg-date">15</div><div class="ev"><i></i><span>Coffee &amp; code</span><em>10:30</em></div><div class="ev"><i class="b"></i><span>Portfolio review</span><em>16:00</em></div></div>
      <div class="wg wg-wx"><div class="c">${esc(C.location.split(',')[0])}</div><div class="t">27°</div><div class="s"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.6" fill="#ffd60a"/><g stroke="#ffd60a" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></g></svg>Sunny<br><em>H:29° L:21°</em></div></div>
    </div>

    <div class="wins"></div>

    <header class="mb">
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
      </div>
    </header>

    <div class="menus"></div>

    <nav class="dock" aria-label="Dock">
      ${DOCK.map((id) => `<button class="dk" data-open="${id}" data-app="${id}"><span class="dki">${ICON[id]}</span><em>${esc(APPS[id].name)}</em><u></u></button>`).join('')}
      <span class="dsep"></span>
      <button class="dk" data-trash><span class="dki">${ICON.trash}</span><em>Trash</em><u></u></button>
    </nav>

    <div class="cc" hidden>
      <div class="cc-grid">
        <div class="cc-box"><div class="cc-row"><i class="cc-ic on">${I.chevR}</i><div><b>Wi‑Fi</b><span>Home</span></div></div><div class="cc-row"><i class="cc-ic on">${I.share}</i><div><b>Bluetooth</b><span>On</span></div></div><div class="cc-row"><i class="cc-ic">${I.airdrop}</i><div><b>AirDrop</b><span>Contacts Only</span></div></div></div>
        <div class="cc-side"><div class="cc-tile"><i class="cc-ic">${I.clock}</i><b>Focus</b></div><div class="cc-tile"><i class="cc-ic on">${I.desktop}</i><b>Stage<br>Manager</b></div></div>
      </div>
      <div class="cc-sl"><b>Display</b><input type="range" min="25" max="100" value="100" data-cc="bright" style="--v:100%" /></div>
      <div class="cc-sl"><b>Sound</b><input type="range" min="0" max="100" value="70" data-cc="vol" style="--v:70%" /></div>
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

  const q = (sel) => root.querySelector(sel);
  const wins = q('.wins');
  const menuLayer = q('.menus');
  const mbApp = q('#mb-app');
  const dock = q('.dock');
  const state = new Map(); // app → { el }
  let z = 10;

  const scale = () => (root.offsetWidth ? root.getBoundingClientRect().width / root.offsetWidth : 1);
  const isCompact = () => root.classList.contains('compact');
  const sid = (el) => [...state.entries()].find(([, v]) => v.el === el)?.[0];

  // ── clock + widgets ──
  function tick() {
    const d = new Date();
    const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
    const mo = d.toLocaleDateString('en-US', { month: 'short' });
    let h = d.getHours();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    q('#mb-clock').textContent = `${wd} ${mo} ${d.getDate()}  ${h}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`;
    q('#wg-day').textContent = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    q('#wg-date').textContent = d.getDate();
  }
  tick();
  setInterval(tick, 15000);

  // ── window management ──
  function setDock() {
    root.querySelectorAll('.dk[data-app]').forEach((b) => {
      const on = state.has(b.dataset.app) || (b.dataset.app === 'finder' && state.has('welcome'));
      b.classList.toggle('on', on);
    });
  }

  function focus(app) {
    const s = state.get(app);
    if (!s) return;
    s.el.style.zIndex = ++z;
    state.forEach((v) => v.el.classList.remove('active'));
    s.el.classList.add('active');
    mbApp.textContent = APPS[app].name;
  }

  function close(app) {
    const s = state.get(app);
    if (!s) return;
    s.el.classList.add('closing');
    setTimeout(() => s.el.remove(), 170);
    state.delete(app);
    setDock();
    const last = [...state.keys()].pop();
    if (last) focus(last);
    else mbApp.textContent = 'Finder';
  }

  function selectNote(el, id) {
    el.querySelectorAll('.nli').forEach((b) => b.classList.toggle('on', b.dataset.note === id));
    const n = NOTES[id]();
    el.querySelector('.note').innerHTML = `${n.html}<div class="note-date">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>`;
  }

  function bounce(btn) {
    if (!btn) return;
    btn.classList.remove('bounce');
    void btn.offsetWidth;
    btn.classList.add('bounce');
  }

  function open(id) {
    let app = id, note = null;
    if (ALIAS[id]) [app, note] = ALIAS[id];
    const def = APPS[app];
    if (!def) return;
    closeAllMenus();
    sound.pop();
    const existing = state.get(app);
    if (existing) {
      existing.el.classList.remove('min');
      if (note && app === 'notes') selectNote(existing.el, note);
      focus(app);
      return;
    }
    bounce(root.querySelector(`.dk[data-app="${app === 'welcome' ? 'finder' : app}"]`));
    const off = state.size * 18;
    const el = document.createElement('section');
    el.className = `win win-${app}`;
    el.style.cssText = `left:${def.x + off}px;top:${def.y + off}px;width:${def.w}px;height:${def.h}px;`;
    el.innerHTML = TPL[app]();
    wins.appendChild(el);
    state.set(app, { el });
    setDock();
    if (app === 'notes') selectNote(el, note || 'about');
    if (app === 'terminal') initTerminal(el);
    focus(app);
  }

  // ── menus ──
  const frontApp = () => [...state.entries()].find(([, v]) => v.el.classList.contains('active'))?.[0];
  const quitFront = () => { const a = frontApp(); if (a) close(a); };
  const minimizeFront = () => { const a = frontApp(); if (a) state.get(a).el.classList.add('min'); };

  function menuItems(key) {
    const name = mbApp.textContent;
    const std = {
      file: [{ l: 'New Window', k: '⌘N', dis: true }, { l: 'New Tab', k: '⌘T', dis: true }, { sep: 1 }, { l: 'Close Window', k: '⌘W', a: quitFront }],
      edit: [{ l: 'Undo', k: '⌘Z', dis: true }, { l: 'Redo', k: '⇧⌘Z', dis: true }, { sep: 1 }, { l: 'Cut', k: '⌘X', dis: true }, { l: 'Copy', k: '⌘C', dis: true }, { l: 'Paste', k: '⌘V', dis: true }, { l: 'Select All', k: '⌘A', dis: true }],
      view: [{ l: 'as Icons', k: '⌘1', dis: true }, { l: 'as List', k: '⌘2', dis: true }, { sep: 1 }, { l: 'Enter Full Screen', k: '⌃⌘F', dis: true }],
      go: [{ l: 'Back', k: '⌘[', dis: true }, { l: 'Forward', k: '⌘]', dis: true }, { sep: 1 }, { l: 'Home', k: '⇧⌘H', a: () => open('finder') }, { l: 'Applications', k: '⇧⌘A', dis: true }],
      window: [{ l: 'Minimize', k: '⌘M', a: minimizeFront }, { l: 'Zoom', dis: true }, ...(state.size ? [{ sep: 1 }] : []),
        ...[...state.keys()].map((a) => ({ l: a === 'welcome' ? 'Welcome' : APPS[a].name, a: () => { state.get(a).el.classList.remove('min'); focus(a); } }))],
      help: [{ l: `${name} Help`, a: () => open('welcome') }],
    };
    if (key === 'apple') return [
      { l: 'About This Mac', a: () => open('settings') }, { sep: 1 },
      { l: 'System Settings…', a: () => open('settings') }, { l: 'App Store…', dis: true }, { sep: 1 },
      { l: 'Recent Items', dis: true, arrow: true }, { sep: 1 },
      { l: 'Force Quit…', k: '⌥⌘⎋', dis: true }, { sep: 1 },
      { l: 'Sleep', dis: true }, { l: 'Restart…', a: () => restart() }, { l: 'Shut Down…', a: () => shutdown() }, { sep: 1 },
      { l: 'Lock Screen', k: '⌃⌘Q', dis: true }, { l: `Log Out ${C.name}…`, k: '⇧⌘Q', dis: true },
    ];
    if (key === 'app') return [
      { l: `About ${name}`, dis: true }, { sep: 1 },
      { l: 'Settings…', k: '⌘,', a: () => open('settings') }, { sep: 1 },
      { l: `Hide ${name}`, k: '⌘H', dis: true }, { l: 'Hide Others', k: '⌥⌘H', dis: true }, { sep: 1 },
      { l: `Quit ${name}`, k: '⌘Q', a: quitFront },
    ];
    return std[key] || [];
  }

  let menuOpen = null;
  let menuActions = [];
  function showMenu(key, anchor) {
    const items = menuItems(key);
    const rr = root.getBoundingClientRect(), r = anchor.getBoundingClientRect(), k = scale() || 1;
    menuActions = items.map((i) => i.a || null);
    menuLayer.innerHTML = `<div class="menu" style="left:${(r.left - rr.left) / k - 4}px">${items.map((it, i) => (it.sep
      ? '<hr />'
      : `<div class="mi${it.dis ? ' dis' : ''}" data-mi="${i}"><span>${esc(it.l)}</span>${it.arrow ? '<kbd>›</kbd>' : it.k ? `<kbd>${esc(it.k)}</kbd>` : ''}</div>`)).join('')}</div>`;
    root.querySelectorAll('.mbi').forEach((b) => b.classList.toggle('open', b === anchor));
    menuOpen = key;
  }
  function closeAllMenus() {
    menuLayer.innerHTML = '';
    root.querySelectorAll('.mbi.open').forEach((b) => b.classList.remove('open'));
    menuOpen = null;
    q('.cc').hidden = true;
  }

  // ── spotlight ──
  const spot = q('.spot');
  const spotIn = spot.querySelector('input');
  const spotRes = spot.querySelector('.spot-res');
  let spotSel = 0;
  let spotList = [];
  const spotIndex = () => [
    { n: 'About Me', k: 'Note', ic: 'notes', go: () => open('about') },
    { n: 'Experience', k: 'Note', ic: 'notes', go: () => open('experience') },
    { n: 'Skills & Tools', k: 'Note', ic: 'notes', go: () => open('skills') },
    ...C.projects.map((p) => ({ n: p.name, k: 'Project', ic: 'safari', go: () => open('projects') })),
    { n: `Email ${C.name}`, k: 'Mail', ic: 'mail', go: () => open('contact') },
    ...['finder', 'safari', 'notes', 'mail', 'terminal', 'settings'].map((a) => ({ n: APPS[a].name, k: 'Application', ic: a, go: () => open(a) })),
  ];
  function renderSpot() {
    const v = spotIn.value.trim().toLowerCase();
    spotList = (v ? spotIndex().filter((i) => i.n.toLowerCase().includes(v) || i.k.toLowerCase().includes(v)) : []).slice(0, 7);
    spotSel = Math.min(spotSel, Math.max(0, spotList.length - 1));
    spotRes.innerHTML = spotList.length
      ? `<div class="sr-h">Top Hit</div>${spotList.map((i, n) => `<div class="sr${n === spotSel ? ' on' : ''}" data-sr="${n}"><span class="sri">${ICON[i.ic]}</span><b>${esc(i.n)}</b><em>${esc(i.k)}</em></div>`).join('')}`
      : (v ? '<div class="sr-none">No Results</div>' : '');
    spot.classList.toggle('has', !!v);
  }
  function openSpot() {
    closeAllMenus();
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

  // ── control center ──
  const dimEl = q('.dimmer');
  q('.cc').addEventListener('input', (e) => {
    const t = e.target;
    t.style.setProperty('--v', `${((t.value - t.min) / (t.max - t.min)) * 100}%`);
    if (t.dataset.cc === 'bright') { dimEl.hidden = false; dimEl.style.opacity = String(((100 - t.value) / 100) * 0.75); }
    if (t.dataset.cc === 'vol' && opts.onVolume) opts.onVolume(+t.value > 0);
  });

  // ── power ──
  function clearWindows() {
    [...state.keys()].forEach((a) => state.get(a).el.remove());
    state.clear();
    setDock();
    mbApp.textContent = 'Finder';
  }
  function restart() {
    closeAllMenus();
    clearWindows();
    q('.boot').dataset.wake = '';
    api.boot().then(() => open('welcome'));
  }
  function shutdown() {
    closeAllMenus();
    clearWindows();
    const b = q('.boot');
    b.classList.remove('run', 'done');
    b.classList.add('shut');
    b.dataset.wake = '1';
  }

  // ── events ──
  root.addEventListener('click', (e) => {
    const t = e.target;
    const boot = q('.boot');
    if (boot.dataset.wake) { restart(); return; }
    if (!t.closest('.spot-box') && !spot.hidden) closeSpot();

    const menuBtn = t.closest('[data-menu]');
    if (menuBtn) {
      if (menuOpen === menuBtn.dataset.menu) closeAllMenus();
      else { q('.cc').hidden = true; showMenu(menuBtn.dataset.menu, menuBtn); }
      sound.click();
      return;
    }
    const mi = t.closest('.mi:not(.dis)');
    if (mi) { const a = menuActions[+mi.dataset.mi]; closeAllMenus(); sound.click(); if (a) a(); return; }
    if (!t.closest('.cc') && !t.closest('[data-act="cc"]') && !q('.cc').hidden) q('.cc').hidden = true;
    if (menuOpen && !t.closest('.menu')) closeAllMenus();

    const act = t.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'spot') { openSpot(); return; }
      if (a === 'cc') { const c = q('.cc'); const was = c.hidden; closeAllMenus(); c.hidden = !was; sound.click(); return; }
      const winEl = act.closest('.win');
      const app = sid(winEl);
      if (!app) return;
      sound.click();
      if (a === 'close') close(app);
      if (a === 'min') winEl.classList.add('min');
      if (a === 'max') winEl.classList.toggle('max');
      return;
    }
    const send = t.closest('[data-send]');
    if (send) {
      const d = new FormData(send.closest('.win').querySelector('form'));
      sound.pop();
      const subject = encodeURIComponent(d.get('subject') || 'Hello from your portfolio');
      const body = encodeURIComponent(`${d.get('msg') || ''}\n\n${d.get('from') ? `— ${d.get('from')}` : ''}`);
      window.location.href = `mailto:${C.contact.email}?subject=${subject}&body=${body}`;
      return;
    }
    const noteBtn = t.closest('[data-note]');
    if (noteBtn) { sound.click(); selectNote(noteBtn.closest('.win'), noteBtn.dataset.note); return; }
    const dk = t.closest('.dk');
    if (dk) {
      if (dk.dataset.trash) { sound.pop(); bounce(dk); return; }
      open(dk.dataset.open);
      return;
    }
    const op = t.closest('[data-open]');
    if (op) { open(op.dataset.open); return; }
    const fi = t.closest('.fitem');
    if (fi) {
      sound.click();
      root.querySelectorAll('.fitem.sel').forEach((n) => n.classList.remove('sel'));
      fi.classList.add('sel');
    }
  });

  root.addEventListener('dblclick', (e) => {
    const d = e.target.closest('[data-dopen]');
    if (d) open(d.dataset.dopen);
  });

  root.addEventListener('mouseover', (e) => {
    const b = e.target.closest('[data-menu]');
    if (b && menuOpen && menuOpen !== b.dataset.menu) showMenu(b.dataset.menu, b);
  });

  // focus + drag
  root.addEventListener('pointerdown', (e) => {
    const winEl = e.target.closest('.win');
    if (winEl) { const app = sid(winEl); if (app) focus(app); }
    const bar = e.target.closest('[data-drag]');
    if (!bar || !winEl || e.target.closest('.lights, button, input, textarea, a, .ic, .nav, .seg, .search, .addr') || isCompact() || winEl.classList.contains('max')) return;
    const sx = e.clientX, sy = e.clientY, ox = winEl.offsetLeft, oy = winEl.offsetTop;
    const k = scale() || 1;
    bar.setPointerCapture(e.pointerId);
    const move = (ev) => {
      winEl.style.left = `${Math.max(-winEl.offsetWidth + 140, Math.min(root.offsetWidth - 140, ox + (ev.clientX - sx) / k))}px`;
      winEl.style.top = `${Math.max(32, Math.min(root.offsetHeight - 120, oy + (ev.clientY - sy) / k))}px`;
    };
    const up = () => {
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up);
      bar.removeEventListener('pointercancel', up);
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', up);
  });

  root.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) sound.key();
  });

  // ── dock magnification (gaussian, like the real thing) ──
  let rest = null;
  dock.addEventListener('pointerenter', () => {
    rest = [...dock.querySelectorAll('.dk')].map((b) => {
      const r = b.getBoundingClientRect();
      return { b, cx: r.left + r.width / 2 };
    });
  });
  dock.addEventListener('pointermove', (e) => {
    if (!rest) return;
    const k = scale() || 1;
    rest.forEach(({ b, cx }) => {
      const d = (e.clientX - cx) / k;
      const s = 1 + 0.62 * Math.exp(-(d * d) / (2 * 50 * 50));
      b.style.setProperty('--s', s.toFixed(3));
    });
  });
  dock.addEventListener('pointerleave', () => {
    rest = null;
    dock.querySelectorAll('.dk').forEach((b) => b.style.removeProperty('--s'));
  });

  // ── terminal ──
  function initTerminal(el) {
    const out = el.querySelector('.out');
    const input = el.querySelector('input');
    const first = C.name.split(' ')[0].toLowerCase();
    const history = [];
    let hi = 0;
    const print = (lines, cls = '') => {
      [].concat(lines).forEach((l) => {
        const d = document.createElement('div');
        if (cls) d.className = cls;
        d.innerHTML = l === '' ? '&nbsp;' : l;
        out.appendChild(d);
      });
      out.scrollTop = out.scrollHeight;
    };
    const commands = {
      help: () => ['Available commands:', '  <b>about</b>       who I am', '  <b>skills</b>      what I work with', '  <b>projects</b>    selected work', '  <b>experience</b>  where I\'ve worked', '  <b>contact</b>     get in touch', '  <b>open</b> &lt;app&gt;  open an app', '  <b>clear</b>       clear the screen'],
      about: () => C.about.paragraphs.map(esc),
      whoami: () => [`${esc(C.name)} — ${esc(C.title)}, based in ${esc(C.location)}.`],
      skills: () => [C.about.skills.map(esc).join(' · ')],
      projects: () => C.projects.map((p) => `• <b>${esc(p.name)}</b> (${esc(p.year)}) — ${esc(p.blurb)}`),
      experience: () => C.experience.map((e) => `• <b>${esc(e.role)}</b> @ ${esc(e.company)} <span class="dim">${esc(e.period)}</span>`),
      contact: () => [`email: <b>${esc(C.contact.email)}</b>`, ...C.contact.links.map((l) => `${esc(l.label.toLowerCase())}: ${esc(l.url)}`)],
      date: () => [new Date().toString()],
      clear: () => { out.innerHTML = ''; return []; },
      open: (a) => (APPS[a] || ALIAS[a] ? (open(a), [`opening ${a}…`]) : [`unknown app: ${esc(a || '')}  (try: ${Object.keys(APPS).filter((k) => k !== 'welcome').join(', ')})`]),
      sudo: () => ['Permission granted. Ori has been notified 🎉  Say hi: ' + esc(C.contact.email)],
    };
    print([`<span class="dim">Last login: ${new Date().toDateString()} on ttys001</span>`, `Welcome! Type <b>help</b> to see what you can do.`, '']);
    el.addEventListener('click', () => input.focus());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const raw = input.value.trim();
        print(`<span class="dim">${esc(first)}@macbook ~ %</span> ${esc(raw)}`);
        input.value = '';
        if (raw) { history.push(raw); hi = history.length; }
        const [cmd, ...args] = raw.split(/\s+/);
        if (!cmd) return;
        const fn = commands[cmd.toLowerCase()];
        print(fn ? fn(args.join(' ').toLowerCase()) : [`zsh: command not found: ${esc(cmd)}`], fn ? '' : 'err');
      } else if (e.key === 'ArrowUp') {
        if (hi > 0) { hi--; input.value = history[hi]; }
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        if (hi < history.length) { hi++; input.value = history[hi] || ''; }
        e.preventDefault();
      }
    });
    setTimeout(() => input.focus(), 50);
  }

  // ── cursor (drawn inside the screen so it has the right size & perspective) ──
  const cur = q('.cur');
  cur.dataset.k = 'arrow';
  function probeCursor(cx, cy) {
    const el = document.elementFromPoint(cx, cy);
    let kind = 'arrow';
    if (el && root.contains(el)) {
      if (el.closest('input, textarea')) kind = 'text';
      else if (el.closest('a[href]')) kind = 'hand';
    }
    if (cur.dataset.k !== kind) cur.dataset.k = kind;
  }

  const api = {
    root,
    open,
    setLocked(v) {
      root.classList.toggle('locked', v);
      if (v) { closeAllMenus(); closeSpot(); }
    },
    setCompact(v) { root.classList.toggle('compact', v); },
    boot() {
      const el = q('.boot');
      el.classList.remove('done', 'shut', 'run');
      void el.offsetWidth;
      el.classList.add('run');
      return new Promise((res) => {
        setTimeout(() => { el.classList.add('done'); res(); }, 2700);
      });
    },
    reset() { clearWindows(); },
    moveCursor(x, y) {
      if (root.classList.contains('locked') || root.classList.contains('compact')) { cur.hidden = true; return; }
      const inside = x >= 0 && y >= 0 && x <= SCREEN_PX.w && y <= SCREEN_PX.h;
      cur.hidden = !inside;
      if (inside) cur.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    },
    hideCursor() { cur.hidden = true; },
    probeCursor,
    /** Closes menus / Spotlight / Control Center. Returns true if something was open. */
    closeOverlays() {
      const had = !spot.hidden || menuOpen || !q('.cc').hidden;
      closeSpot();
      closeAllMenus();
      return !!had;
    },
  };
  return api;
}
