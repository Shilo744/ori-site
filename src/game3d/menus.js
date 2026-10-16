// NEON DRIFT — the main menu (mode, track, rivals, garage) and the results screen. Plain DOM, one delegated click handler each.
// All text that is not a constant is escaped. The 3D preview behind the menu is the controller's job (game.js).
import { BIOMES, BIOME_IDS, LOOKS } from './biomes.js';
import { CAR_TYPES } from './physics.js';
import { PAINTS, PAINT_NAMES } from './car-parts.js';
import { DIFFICULTY, DIFFICULTY_IDS } from './race-runner.js';
import { fmtTime, MEDALS } from './records.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const MEDAL_COLORS = { bronze: ['#e0925a', '#8a4a22'], silver: ['#e8ecf6', '#8c94aa'], gold: ['#ffe27a', '#d89a12'] };

/** A small medal: ribbon + disc (none = an empty ring). */
export function medalSvg(level, size = 22) {
  const name = MEDALS[level];
  if (!name || name === 'none') return `<svg class="g3d-medal none" viewBox="0 0 24 24" width="${size}" height="${size}" aria-label="No medal"><circle cx="12" cy="14" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.4 2.4"/></svg>`;
  const [a, b] = MEDAL_COLORS[name];
  return `<svg class="g3d-medal ${name}" viewBox="0 0 24 24" width="${size}" height="${size}" role="img" aria-label="${name} medal"><defs><linearGradient id="gm-${name}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><path d="M7 2h4l2 7H9zM13 2h4l-2 7h-4z" fill="#5a6ce0"/><circle cx="12" cy="15" r="6.5" fill="url(#gm-${name})" stroke="rgba(0,0,0,.35)" stroke-width=".8"/><path d="M12 11.2l1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.2-2.3 1.2.5-2.5-1.8-1.7 2.5-.3z" fill="rgba(255,255,255,.85)"/></svg>`;
}

const STAT_MAX = { speed: 100, grip: 14.5, accel: 1.15 };
function carStats(id) {
  const c = CAR_TYPES[id];
  return [['Speed', c.vRef / STAT_MAX.speed], ['Grip', (c.aLat0 * c.grip) / STAT_MAX.grip], ['Pickup', c.accel / STAT_MAX.accel]];
}

/**
 * @param {HTMLElement} root the overlay
 * @param {object} o { prefs, trackInfo(biomeId) → { bestLap, medal, wins }, onChange(prefs), onStart(), onQuit() }
 */
export function createMainMenu(root, { prefs, trackInfo, onChange, onStart, onQuit }) {
  const el = document.createElement('div');
  el.className = 'g3d-main';
  el.hidden = true;
  root.appendChild(el);
  let p = { ...prefs };

  function render() {
    const modeRace = p.mode === 'race';
    el.innerHTML = `
      <div class="g3d-mm-panel" role="form" aria-label="Neon Drift menu">
        <div class="g3d-logo"><span>NEON</span><span>DRIFT</span></div>
        <div class="g3d-seg" role="radiogroup" aria-label="Mode">
          <button type="button" role="radio" aria-checked="${modeRace}" class="${modeRace ? 'on' : ''}" data-act="mode:race">Race</button>
          <button type="button" role="radio" aria-checked="${!modeRace}" class="${modeRace ? '' : 'on'}" data-act="mode:trial">Time Trial</button>
        </div>
        <h3>Track</h3>
        <div class="g3d-tracks" role="radiogroup" aria-label="Track">
          ${BIOME_IDS.map((id) => {
            const b = BIOMES[id];
            const look = LOOKS[b.look];
            const info = trackInfo(id);
            return `<button type="button" role="radio" aria-checked="${p.biome === id}" class="g3d-track${p.biome === id ? ' on' : ''}" data-act="biome:${id}">
              <span class="sw" style="background:linear-gradient(135deg,${hex(look.top)},${hex(look.mid)} 45%,${hex(look.horizon)})"></span>
              <b>${esc(b.name)}</b><small>${esc(look.name)}${info.length ? ` · ${info.length}` : ''}</small>
              <span class="bt">${medalSvg(info.medal)}<em>${info.bestLap ? fmtTime(info.bestLap) : '—'}</em></span></button>`;
          }).join('')}
        </div>
        <div class="g3d-opt" ${modeRace ? '' : 'hidden'}>
          <h3>Rivals</h3>
          <div class="g3d-seg" role="radiogroup" aria-label="Difficulty">
            ${DIFFICULTY_IDS.map((d) => `<button type="button" role="radio" aria-checked="${p.difficulty === d}" class="${p.difficulty === d ? 'on' : ''}" data-act="diff:${d}">${esc(DIFFICULTY[d].name)}</button>`).join('')}
          </div>
        </div>
        <h3>Garage</h3>
        <div class="g3d-cars" role="radiogroup" aria-label="Car">
          ${Object.keys(CAR_TYPES).map((id) => `<button type="button" role="radio" aria-checked="${p.car === id}" class="g3d-car${p.car === id ? ' on' : ''}" data-act="car:${id}">
            <b>${esc(CAR_TYPES[id].name)}</b>
            ${carStats(id).map(([n, v]) => `<span class="st"><small>${n}</small><i><u style="width:${Math.round(Math.min(1, v) * 100)}%"></u></i></span>`).join('')}</button>`).join('')}
        </div>
        <div class="g3d-paints" role="radiogroup" aria-label="Paint">
          ${PAINTS.map((c, i) => `<button type="button" role="radio" aria-checked="${p.paint === i}" class="${p.paint === i ? 'on' : ''}" data-act="paint:${i}" style="--c:${hex(c)}" aria-label="${esc(PAINT_NAMES[i])}"></button>`).join('')}
        </div>
        <button type="button" class="g3d-btn primary big" data-act="start">${modeRace ? 'Start race' : 'Start time trial'}</button>
        <p class="g3d-small"><kbd>←</kbd><kbd>→</kbd> choose · <kbd>Enter</kbd> start · <kbd>Esc</kbd> back to the desktop</p>
      </div>`;
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const [a, v] = b.dataset.act.split(':');
    if (a === 'start') { onStart(); return; }
    if (a === 'quit') { onQuit(); return; }
    const next = { ...p };
    if (a === 'mode') next.mode = v;
    else if (a === 'biome') next.biome = v;
    else if (a === 'diff') next.difficulty = v;
    else if (a === 'car') next.car = v;
    else if (a === 'paint') next.paint = +v;
    if (JSON.stringify(next) === JSON.stringify(p)) return;
    p = next;
    const focusKey = b.dataset.act;
    render();
    el.querySelector(`[data-act="${focusKey}"]`)?.focus({ preventScroll: true });
    onChange({ ...p });
  });

  // arrows: ← → select within a group, ↑ ↓ move between groups. Returns true when the key was used.
  function key(e) {
    const b = document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-act]');
    if (!b || !el.contains(b)) { const f = el.querySelector('[data-act="start"]'); if (f && e.key.startsWith('Arrow')) { f.focus({ preventScroll: true }); return true; } return false; }
    const group = b.parentElement;
    const sibs = [...group.querySelectorAll('[data-act]')];
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const i = sibs.indexOf(b);
      const n = sibs[(i + (e.key === 'ArrowRight' ? 1 : -1) + sibs.length) % sibs.length];
      if (n && n !== b && group.getAttribute('role') === 'radiogroup') { n.click(); return true; }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const all = [...el.querySelectorAll('[role="radiogroup"], [data-act="start"]')].filter((x) => !x.closest('[hidden]'));
      const gi = all.findIndex((g) => g === group || g === b);
      const target = all[(gi + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length];
      const f = target.matches('[data-act]') ? target : target.querySelector('.on') || target.querySelector('[data-act]');
      if (f) { f.focus({ preventScroll: true }); return true; }
    }
    return false;
  }
  el.addEventListener('keydown', (e) => { if (key(e)) { e.preventDefault(); e.stopPropagation(); } });

  return {
    el,
    get prefs() { return { ...p }; },
    key,
    setPrefs(next) { p = { ...p, ...next }; if (!el.hidden) render(); },
    show() { render(); el.hidden = false; requestAnimationFrame(() => el.classList.add('in')); (el.querySelector('[data-act="start"]'))?.focus({ preventScroll: true }); },
    refresh() { if (!el.hidden) { const a = document.activeElement?.dataset?.act; render(); if (a) el.querySelector(`[data-act="${a}"]`)?.focus({ preventScroll: true }); } },
    hide() { el.classList.remove('in'); el.hidden = true; },
    dispose() { el.remove(); },
  };
}

/**
 * The results card. `r` = { title, kicker, rows: [{ place, name, time, best, you, color, projected }], banner, medal, lines: [string],
 * actions: [{ id, label, primary }] }; `onAction(id)`.
 */
export function createResults(root, onAction) {
  const el = document.createElement('div');
  el.className = 'g3d-results';
  el.hidden = true;
  root.appendChild(el);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-do]');
    if (b) onAction(b.dataset.do);
  });
  return {
    el,
    show(r) {
      el.innerHTML = `
        <div class="g3d-rc" role="dialog" aria-label="Results">
          <div class="g3d-kicker">${esc(r.kicker)}</div>
          <h2>${esc(r.title)}</h2>
          ${r.banner ? `<div class="g3d-banner">${esc(r.banner)}</div>` : ''}
          ${r.rows && r.rows.length ? `<table class="g3d-table"><thead><tr><th></th><th>Driver</th><th>${r.timeHead || 'Time'}</th><th>Best lap</th></tr></thead><tbody>
            ${r.rows.map((x) => `<tr class="${x.you ? 'you' : ''}"><td>${esc(x.place)}</td><td><i style="--c:${x.color}"></i>${esc(x.name)}</td><td>${x.projected ? '~' : ''}${esc(x.time)}</td><td>${esc(x.best)}</td></tr>`).join('')}
          </tbody></table>` : ''}
          <div class="g3d-rmed">${r.medal !== undefined ? `${medalSvg(r.medal, 34)}<span>${(r.lines || []).map((l) => `<b>${esc(l[0])}</b> ${esc(l[1])}`).join('<br>')}</span>` : ''}</div>
          <div class="g3d-actions">${r.actions.map((a) => `<button type="button" class="g3d-btn${a.primary ? ' primary' : ''}" data-do="${a.id}">${esc(a.label)}</button>`).join('')}</div>
        </div>`;
      el.hidden = false;
      requestAnimationFrame(() => el.classList.add('in'));
      el.querySelector('.primary')?.focus({ preventScroll: true });
    },
    hide() { el.classList.remove('in'); el.hidden = true; },
    get open() { return !el.hidden; },
    focusMove(d) {
      const bs = [...el.querySelectorAll('button')];
      const i = bs.indexOf(document.activeElement);
      bs[(i + d + bs.length) % bs.length]?.focus({ preventScroll: true });
    },
    dispose() { el.remove(); },
  };
}
