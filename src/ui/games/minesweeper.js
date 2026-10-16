// MINESWEEPER — Beginner 9×9/10, Intermediate 16×16/40, Expert 30×16/99. First click is always safe and opens an area,
// flood-fill reveals ripple outwards, chording, flags (right-click / F / long-press / flag mode), explosion + win effects,
// best times per level. Rules live in minesweeper-logic.js (unit-tested in node).
import { registerApp } from '../apps/registry.js';
import { sq, lg } from '../apps/icons.js';
import { achievements } from '../../core/achievements.js';
import * as sound from '../../audio.js';
import { createRuntime, fitCanvas, pointerPos, createInput, createHud, createOverlay, createParticles, createFit } from './kit.js';
import { scores } from './scores.js';
import { registerGameInfo } from './catalog.js';
import * as M from './minesweeper-logic.js';

const W = 760, H = 440, PAD = 14; // fixed playfield; smaller boards get bigger cells, the whole thing scales to the window
const NUM_COLORS = [null, '#4aa8ff', '#4ddf8a', '#ff5c7a', '#b36bff', '#ffb52e', '#35f2d0', '#f4f6ff', '#8fa0c8'];
const LONG_PRESS = 430;

const ICON = sq('MS',
  `<rect width="64" height="64" fill="url(#gMS)"/>
   <rect x="9" y="11" width="21" height="21" rx="5" fill="#3b43b8" stroke="rgba(255,255,255,.35)"/>
   <rect x="34" y="11" width="21" height="21" rx="5" fill="#0c0e2e" stroke="rgba(140,150,255,.35)"/><text x="44.5" y="27" font-family="Inter,Arial,sans-serif" font-weight="800" font-size="15" text-anchor="middle" fill="#4aa8ff">1</text>
   <rect x="9" y="36" width="21" height="21" rx="5" fill="#0c0e2e" stroke="rgba(140,150,255,.35)"/><text x="19.5" y="52" font-family="Inter,Arial,sans-serif" font-weight="800" font-size="15" text-anchor="middle" fill="#ff5c7a">3</text>
   <rect x="34" y="36" width="21" height="21" rx="5" fill="#3b43b8" stroke="rgba(255,255,255,.35)"/>
   <path d="M44 41v12" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><path d="M44.5 41l8 3.6-8 3.6z" fill="#ff3da6"/>`,
  lg('gMS', '#1d1e52', '#070818'));

achievements.define([
  { id: 'sweeper', name: 'Sweeper', desc: 'Win Beginner in under 60 seconds', rarity: 'common', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10M7 14h10l-2 6H9zM9 14v6M15 14v6"/></svg>' },
  { id: 'defuser', name: 'Defuser', desc: 'Clear the Expert field', rarity: 'epic', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="13" r="6"/><path d="M15 9l3-3M17 4l3 1M18.500 7l1 3M11 10v3h3"/></svg>' },
]);

const scoreId = (diff) => (diff === 'beginner' ? 'minesweeper' : `minesweeper:${diff}`);

function drawCover(g, w, h) {
  const bg = g.createRadialGradient(w * 0.5, h * 0.45, 10, w * 0.5, h * 0.5, w * 0.75);
  bg.addColorStop(0, '#1e2058');
  bg.addColorStop(1, '#070817');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const cols = 7, rows = 4, s = Math.min(w / 9.2, h / 5.6), gap = s * 0.1;
  const ox = (w - (cols * s + (cols - 1) * gap)) / 2, oy = (h - (rows * s + (rows - 1) * gap)) / 2;
  const pattern = ['#...2.#', '..112..', '.#1.1#.', '#2..2.#'];
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  pattern.forEach((row, r) => [...row].forEach((ch, c) => {
    const x = ox + c * (s + gap), y = oy + r * (s + gap);
    const hidden = ch === '#';
    const gr = g.createLinearGradient(x, y, x, y + s);
    if (hidden) { gr.addColorStop(0, '#4a52c8'); gr.addColorStop(1, '#2a2f85'); } else { gr.addColorStop(0, '#12143a'); gr.addColorStop(1, '#0b0c26'); }
    g.fillStyle = gr;
    g.beginPath();
    g.roundRect(x, y, s, s, s * 0.2);
    g.fill();
    if (/\d/.test(ch)) {
      g.save();
      g.shadowColor = NUM_COLORS[+ch];
      g.shadowBlur = 8;
      g.fillStyle = NUM_COLORS[+ch];
      g.font = `800 ${Math.round(s * 0.62)}px "JetBrains Mono", monospace`;
      g.fillText(ch, x + s / 2, y + s / 2 + 1);
      g.restore();
    }
  }));
  // a flag on the first hidden tile, a glowing mine on the last
  const fx = ox + 0 * (s + gap), fy = oy + 0 * (s + gap);
  g.fillStyle = '#fff';
  g.fillRect(fx + s * 0.46, fy + s * 0.2, s * 0.07, s * 0.6);
  g.fillStyle = '#ff3da6';
  g.beginPath();
  g.moveTo(fx + s * 0.5, fy + s * 0.2);
  g.lineTo(fx + s * 0.82, fy + s * 0.36);
  g.lineTo(fx + s * 0.5, fy + s * 0.52);
  g.fill();
  const mx = ox + 6 * (s + gap) + s / 2, my = oy + 3 * (s + gap) + s / 2;
  g.save();
  g.shadowColor = '#ff4d5e';
  g.shadowBlur = 22;
  g.fillStyle = '#ff4d5e';
  g.beginPath();
  g.arc(mx, my, s * 0.22, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ff4d5e';
  g.lineWidth = s * 0.07;
  for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; g.beginPath(); g.moveTo(mx + Math.cos(a) * s * 0.26, my + Math.sin(a) * s * 0.26); g.lineTo(mx + Math.cos(a) * s * 0.4, my + Math.sin(a) * s * 0.4); g.stroke(); }
  g.restore();
}

registerGameInfo({
  id: 'minesweeper',
  name: 'Minesweeper',
  tagline: 'Flag the mines. Trust the numbers.',
  accent: '#ff4d6d',
  controls: 'Click · right-click / F to flag · click a number to chord',
  lowerIsBetter: true,
  format: M.formatTime,
  baseLabel: 'Beginner',
  variants: [{ id: 'minesweeper:intermediate', label: 'Intermediate' }, { id: 'minesweeper:expert', label: 'Expert' }],
  drawCover,
});

// ── pre-rendered tiles for one cell size (the board is 480 cells at most, so per-frame work is drawImage only) ──
function buildSprites(C) {
  const S = Math.round(C * 2);
  const make = (draw) => {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.scale(2, 2);
    draw(g);
    return c;
  };
  const r = C * 0.2, i = Math.max(1, C * 0.045);
  const tile = (top, bot, edge, glow) => make((g) => {
    const gr = g.createLinearGradient(0, 0, 0, C);
    gr.addColorStop(0, top);
    gr.addColorStop(1, bot);
    g.fillStyle = gr;
    g.beginPath();
    g.roundRect(i, i, C - 2 * i, C - 2 * i, r);
    g.fill();
    g.strokeStyle = edge;
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.beginPath();
    g.roundRect(i + 1.5, i + 1.5, C - 2 * i - 3, Math.max(2, C * 0.14), r * 0.6);
    g.fill();
    if (glow) { g.strokeStyle = glow; g.lineWidth = 1.6; g.beginPath(); g.roundRect(i, i, C - 2 * i, C - 2 * i, r); g.stroke(); }
  });
  const sprites = {
    hidden: tile('#4a52c8', '#2b3088', 'rgba(170,180,255,0.4)'),
    hover: tile('#6670ee', '#3a41a8', 'rgba(210,216,255,0.6)', 'rgba(53,242,255,0.8)'),
    pressed: tile('#2a2f85', '#222768', 'rgba(140,150,255,0.3)'),
    open: make((g) => {
      g.fillStyle = 'rgba(8,10,34,0.92)';
      g.beginPath();
      g.roundRect(i, i, C - 2 * i, C - 2 * i, r);
      g.fill();
      g.strokeStyle = 'rgba(140,150,255,0.13)';
      g.stroke();
    }),
    boom: make((g) => {
      const gr = g.createRadialGradient(C / 2, C / 2, 1, C / 2, C / 2, C * 0.7);
      gr.addColorStop(0, '#ff6a5a');
      gr.addColorStop(1, '#8f1030');
      g.fillStyle = gr;
      g.beginPath();
      g.roundRect(i, i, C - 2 * i, C - 2 * i, r);
      g.fill();
    }),
    flag: make((g) => {
      g.fillStyle = '#e8ecff';
      g.fillRect(C * 0.46, C * 0.2, C * 0.08, C * 0.58);
      g.fillRect(C * 0.3, C * 0.74, C * 0.4, C * 0.07);
      g.save();
      g.shadowColor = '#ff3da6';
      g.shadowBlur = 6;
      g.fillStyle = '#ff3da6';
      g.beginPath();
      g.moveTo(C * 0.5, C * 0.2);
      g.lineTo(C * 0.8, C * 0.34);
      g.lineTo(C * 0.5, C * 0.48);
      g.closePath();
      g.fill();
      g.restore();
    }),
    mine: make((g) => {
      const cx = C / 2, cy = C / 2, rr = C * 0.2;
      g.strokeStyle = '#ff9aa8';
      g.lineWidth = Math.max(1.2, C * 0.06);
      g.lineCap = 'round';
      for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; g.beginPath(); g.moveTo(cx + Math.cos(a) * rr * 1.1, cy + Math.sin(a) * rr * 1.1); g.lineTo(cx + Math.cos(a) * rr * 1.75, cy + Math.sin(a) * rr * 1.75); g.stroke(); }
      g.save();
      g.shadowColor = '#ff4d5e';
      g.shadowBlur = 8;
      g.fillStyle = '#ff4d5e';
      g.beginPath();
      g.arc(cx, cy, rr, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.beginPath();
      g.arc(cx - rr * 0.35, cy - rr * 0.35, rr * 0.28, 0, Math.PI * 2);
      g.fill();
    }),
    wrong: make((g) => {
      g.strokeStyle = '#ff4d5e';
      g.lineWidth = Math.max(2, C * 0.09);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(C * 0.22, C * 0.22); g.lineTo(C * 0.78, C * 0.78);
      g.moveTo(C * 0.78, C * 0.22); g.lineTo(C * 0.22, C * 0.78);
      g.stroke();
    }),
  };
  sprites.num = NUM_COLORS.map((col, n) => (n ? make((g) => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `800 ${Math.round(C * 0.62)}px "JetBrains Mono", ui-monospace, monospace`;
    g.shadowColor = col;
    g.shadowBlur = 7;
    g.fillStyle = col;
    g.fillText(String(n), C / 2, C / 2 + C * 0.04);
  }) : null));
  return sprites;
}

const FACE = {
  smile: '<circle cx="12" cy="12" r="9" fill="#ffd84a"/><circle cx="9" cy="10" r="1.3" fill="#1a1300"/><circle cx="15" cy="10" r="1.3" fill="#1a1300"/><path d="M8 14.2c1 1.6 2.4 2.4 4 2.4s3-.8 4-2.400" fill="none" stroke="#1a1300" stroke-width="1.5" stroke-linecap="round"/>',
  worry: '<circle cx="12" cy="12" r="9" fill="#ffd84a"/><circle cx="9" cy="10" r="1.3" fill="#1a1300"/><circle cx="15" cy="10" r="1.3" fill="#1a1300"/><ellipse cx="12" cy="16" rx="2" ry="2.3" fill="#1a1300"/>',
  dead: '<circle cx="12" cy="12" r="9" fill="#ffd84a"/><path d="M7.600 8.400l3 3M10.600 8.400l-3 3M13.400 8.400l3 3M16.400 8.400l-3 3" stroke="#1a1300" stroke-width="1.5" stroke-linecap="round"/><path d="M8.200 17c1-1.400 2.300-2 3.800-2s2.800.6 3.800 2" fill="none" stroke="#1a1300" stroke-width="1.5" stroke-linecap="round"/>',
  cool: '<circle cx="12" cy="12" r="9" fill="#ffd84a"/><path d="M5.500 9.200h13v2.200c0 1.200-.9 2-2 2h-2c-1 0-1.600-.7-1.800-1.500h-1.400c-.2.800-.8 1.500-1.800 1.500h-2c-1.100 0-2-.8-2-2z" fill="#1a1300"/><path d="M8 15.600c1 1.200 2.400 1.800 4 1.800s3-.6 4-1.800" fill="none" stroke="#1a1300" stroke-width="1.5" stroke-linecap="round"/>',
};
const faceSvg = (k) => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style="display:block">${FACE[k]}</svg>`;

registerApp({
  id: 'minesweeper',
  name: 'Minesweeper',
  icon: ICON,
  category: 'game',
  titlebar: 'dark',
  size: { w: 700, h: 560, minW: 380, minH: 440 },
  pos: { x: 150, y: 34 },
  mount(el, ctx) {
    // ── DOM ──
    el.classList.add('gk', 'gk-mines');
    const hud = createHud(el, [
      { id: 'mines', label: 'Mines', value: '010', accent: 'pink' },
      { id: 'time', label: 'Time', value: '000' },
      { id: 'best', label: 'Best', value: '—', accent: 'amber' },
    ]);
    const faceBtn = hud.addButton('face', '', () => newGame());
    faceBtn.setAttribute('aria-label', 'New game');
    const levelBtn = hud.addButton('level', 'Level', () => cycleLevel());
    const flagBtn = hud.addButton('flag', 'Flag', () => toggleFlagMode());
    const field = document.createElement('div');
    field.className = 'gk-field';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'Minesweeper board');
    field.appendChild(canvas);
    el.appendChild(field);
    const { g } = fitCanvas(canvas, W, H);
    const fit = createFit(el, field, W, H);
    const overlay = createOverlay(field, { onPrimary: () => primary(), onSecondary: () => changeLevel() });
    const input = createInput(ctx, {
      target: field, swipe: 0,
      keys: {
        left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
        reveal: ['Space', 'KeyZ'], flag: ['KeyF', 'KeyX'], fresh: ['KeyN', 'KeyR'], level: ['KeyL'], pause: ['KeyP', 'Escape'], confirm: ['Enter'],
      },
    });
    const particles = createParticles(260);

    // ── state ──
    let diff = ctx.storage.get('minesweeper:level', 'beginner');
    if (!M.DIFFICULTIES[diff]) diff = 'beginner';
    let board = M.boardFor(diff);
    let phase = 'ready'; // ready | playing | paused | exploding | won | lost
    let started = false; // the timer starts with the first reveal
    let time = 0;
    let lay = layout(board);
    let sprites = buildSprites(lay.C);
    let appear = new Float64Array(board.n); // when each opened cell becomes visible (ripple); 0 = already
    let mineAt = new Float64Array(board.n); // when each mine is revealed after an explosion
    let exploded = -1;
    let hover = -1, cursor = 0, kbd = false;
    let pressed = -1;
    let flagMode = false;
    let shake = 0;
    let face = '';
    let endTimer = 0;
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
    const now = () => performance.now() / 1000;
    const best = () => scores.best(scoreId(diff));

    function layout(b) {
      const C = Math.floor(Math.min((W - 2 * PAD) / b.cols, (H - 2 * PAD) / b.rows));
      return { C, ox: Math.round((W - b.cols * C) / 2), oy: Math.round((H - b.rows * C) / 2) };
    }
    const cellAt = (x, y) => {
      const cx = Math.floor((x - lay.ox) / lay.C), cy = Math.floor((y - lay.oy) / lay.C);
      return cx >= 0 && cy >= 0 && cx < board.cols && cy < board.rows ? cy * board.cols + cx : -1;
    };
    const centerOf = (i) => [lay.ox + (i % board.cols) * lay.C + lay.C / 2, lay.oy + Math.floor(i / board.cols) * lay.C + lay.C / 2];

    // ── HUD / screens ──
    const pad3 = (v) => (v < 0 ? `-${String(-v).padStart(2, '0')}` : String(v).padStart(3, '0'));
    function setFace(k) { if (face === k) return; face = k; faceBtn.querySelector('b').innerHTML = faceSvg(k); }
    function hudRefresh() {
      hud.set('mines', pad3(M.minesLeft(board)));
      hud.set('time', String(Math.min(999, Math.floor(time))).padStart(3, '0'));
      const b = best();
      hud.set('best', b == null ? '—' : M.formatTime(b));
      levelBtn.querySelector('b').textContent = M.DIFFICULTIES[diff].name;
      flagBtn.querySelector('b').textContent = flagMode ? 'ON' : 'OFF';
      flagBtn.classList.toggle('gk-on', flagMode);
    }
    const levelStat = () => ({ label: 'Level', value: M.DIFFICULTIES[diff].name, accent: 'violet' });
    function showReady() {
      overlay.show({ kicker: 'Arcade', title: 'Minesweeper', stats: [levelStat(), { label: 'Best', value: b2s(best()), accent: 'amber' }], hint: 'Click to reveal · right-click or F to flag · click a number to chord', primary: 'Play', secondary: 'Change level' });
    }
    const b2s = (v) => (v == null ? '—' : M.formatTime(v));
    function showPaused() {
      overlay.show({ kicker: 'Paused', title: 'Timer stopped', stats: [{ label: 'Time', value: M.formatTime(time), accent: 'cyan' }, { label: 'Mines left', value: M.minesLeft(board), accent: 'pink' }], hint: 'Space or P to resume', primary: 'Resume', secondary: 'New game' });
    }
    function showWon(isBest) {
      overlay.show({
        kicker: 'Cleared', title: 'Field swept',
        stats: [{ label: 'Time', value: M.formatTime(time), accent: 'cyan' }, levelStat(), { label: 'Best', value: b2s(best()), accent: 'amber' }],
        banner: isBest ? 'New best time!' : '', hint: 'Press Enter to play again', primary: 'Play again', secondary: 'Change level',
      });
    }
    function showLost() {
      const pct = Math.round((board.opened / (board.n - board.minesTotal)) * 100);
      overlay.show({ kicker: 'Boom', title: 'You hit a mine', stats: [{ label: 'Cleared', value: `${pct}%`, accent: 'lime' }, { label: 'Time', value: M.formatTime(time), accent: 'cyan' }, levelStat()], hint: 'Press Enter to try again', primary: 'Try again', secondary: 'Change level' });
    }

    // ── flow ──
    function resetBoard() {
      board = M.boardFor(diff);
      lay = layout(board);
      sprites = buildSprites(lay.C);
      appear = new Float64Array(board.n);
      mineAt = new Float64Array(board.n);
      exploded = -1; started = false; time = 0; pressed = -1; shake = 0;
      cursor = Math.floor(board.n / 2);
      particles.clear();
      timers.forEach(clearTimeout);
      timers.clear();
      setFace('smile');
      hudRefresh();
    }
    function newGame() {
      resetBoard();
      phase = 'playing';
      overlay.hide();
      sound.blip(440, 0.05, 'triangle', 0.05);
    }
    function setLevel(d) {
      diff = d;
      ctx.storage.set('minesweeper:level', d);
      resetBoard();
    }
    function cycleLevel() {
      const ids = M.DIFFICULTY_IDS;
      setLevel(ids[(ids.indexOf(diff) + 1) % ids.length]);
      phase = 'ready';
      showReady();
      sound.click();
    }
    const changeLevel = () => { cycleLevel(); };
    function primary() {
      if (phase === 'paused') resume();
      else if (phase === 'ready' || phase === 'won' || phase === 'lost') newGame();
    }
    function pause() {
      if (phase !== 'playing') return false;
      phase = 'paused';
      pressed = -1;
      showPaused();
      sound.blip(330, 0.07, 'triangle', 0.06);
      return true;
    }
    function resume() {
      if (phase !== 'paused') return;
      phase = 'playing';
      overlay.hide();
      sound.blip(494, 0.07, 'triangle', 0.06);
    }
    function toggleFlagMode() { flagMode = !flagMode; hudRefresh(); sound.click(); }

    // ── actions ──
    function applyOpened(opened, t0 = now()) {
      const maxD = opened.reduce((m, o) => Math.max(m, o.d), 0);
      const step = Math.min(0.032, 0.8 / Math.max(1, maxD));
      opened.forEach(({ i, d }) => { appear[i] = t0 + d * step; });
      return maxD * step;
    }
    function lose(mineIdx) {
      phase = 'exploding';
      exploded = mineIdx;
      setFace('dead');
      const t0 = now();
      const [ex, ey] = [mineIdx % board.cols, Math.floor(mineIdx / board.cols)];
      M.minesAt(board).forEach((m) => {
        if (board.st[m] === M.FLAG) return;
        const d = Math.hypot((m % board.cols) - ex, Math.floor(m / board.cols) - ey);
        mineAt[m] = t0 + 0.12 + d * 0.045;
        later(() => { const [x, y] = centerOf(m); particles.burst(x, y, m === mineIdx ? 34 : 12, { speed: m === mineIdx ? 190 : 110, life: 0.8, r: 3, hue: 18, grav: 120 }); sound.noiseHit(0.14, 0.09, 700 + Math.random() * 600); }, (0.12 + d * 0.045) * 1000);
      });
      shake = 0.9;
      sound.noiseHit(0.5, 0.2, 380);
      sound.sweep(220, 40, 0.55, 'sawtooth', 0.14);
      const total = 0.12 + 0.045 * Math.hypot(board.cols, board.rows) + 0.5;
      endTimer = later(() => { phase = 'lost'; scores.touch(scoreId(diff)); hudRefresh(); showLost(); }, total * 1000);
    }
    function win() {
      phase = 'won';
      setFace('cool');
      M.minesAt(board).forEach((m) => { if (board.st[m] !== M.FLAG) { board.st[m] = M.FLAG; board.flags++; } });
      const secs = Math.round(time * 10) / 10;
      time = secs;
      const r = scores.record(scoreId(diff), secs, { lowerIsBetter: true, extra: { level: diff } });
      if (diff === 'beginner' && secs < 60) achievements.unlock('sweeper');
      if (diff === 'expert') achievements.unlock('defuser');
      hudRefresh();
      for (let k = 0; k < 14; k++) later(() => { const i = Math.floor(Math.random() * board.n); const [x, y] = centerOf(i); particles.burst(x, y, 10, { speed: 120, life: 0.9, r: 2.6, hue: 150 + Math.random() * 60, grav: 40 }); }, 90 * k);
      sound.arp([523, 659, 784, 1046], 0.07, 'square', 0.07);
      endTimer = later(() => showWon(r.isBest), 1000);
    }
    function afterReveal(res) {
      if (!started) { started = true; scores.touch(scoreId(diff)); }
      if (res.mine >= 0) { applyOpened(res.opened); lose(res.mine); return; }
      if (res.opened.length) {
        const span = applyOpened(res.opened);
        sound.blip(520 + Math.min(300, res.opened.length * 8), 0.04, 'triangle', 0.05);
        if (res.opened.length > 6) sound.noiseHit(Math.min(0.5, 0.08 + span * 0.5), 0.05, 2200, 'highpass');
      }
      if (M.isWon(board)) win();
      hudRefresh();
    }
    function revealAt(i) {
      if (phase !== 'playing' || i < 0) return;
      if (board.st[i] === M.OPEN) { chordAt(i); return; }
      if (board.st[i] === M.FLAG) return;
      afterReveal(M.reveal(board, i));
    }
    function chordAt(i) {
      if (phase !== 'playing' || i < 0 || board.st[i] !== M.OPEN) return;
      const res = M.chord(board, i);
      if (!res.opened.length) { sound.blip(180, 0.04, 'square', 0.03); return; }
      afterReveal(res);
    }
    function flagAt(i) {
      if (phase !== 'playing' || i < 0) return;
      if (!M.toggleFlag(board, i)) return;
      sound.blip(board.st[i] === M.FLAG ? 700 : 480, 0.05, 'square', 0.05);
      const [x, y] = centerOf(i);
      particles.burst(x, y, 5, { speed: 50, life: 0.35, r: 2, hue: 330 });
      hud.bump('mines');
      hudRefresh();
    }
    const tapAt = (i) => (flagMode && board.st[i] !== M.OPEN ? flagAt(i) : revealAt(i));

    // ── pointer ──
    let down = null; // { i, button, touch, x, y, timer, long }
    function onDown(e) {
      if (phase === 'paused' || overlay.visible) return;
      const p = pointerPos(e, canvas, W, H);
      if (!p) return;
      kbd = false;
      const i = cellAt(p.x, p.y);
      hover = i;
      if (e.button === 2) { flagAt(i); e.preventDefault(); return; }
      if (e.button === 1) { chordAt(i); e.preventDefault(); return; }
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      down = { i, touch: e.pointerType !== 'mouse', x: p.x, y: p.y, long: false, timer: 0, t0: performance.now() };
      pressed = i;
      if (phase === 'playing' && i >= 0) setFace('worry');
      if (down.touch && i >= 0 && board.st[i] !== M.OPEN) {
        down.timer = setTimeout(() => { // long press = flag
          if (!down) return;
          down.long = true;
          pressed = -1;
          flagAt(down.i);
          try { navigator.vibrate && navigator.vibrate(14); } catch { /* not supported */ }
        }, LONG_PRESS);
      }
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    function onMove(e) {
      const p = pointerPos(e, canvas, W, H);
      if (!p) { if (!down) hover = -1; return; }
      if (e.pointerType === 'mouse') kbd = false;
      hover = cellAt(p.x, p.y);
      if (down) {
        if (Math.hypot(p.x - down.x, p.y - down.y) > 10) { clearTimeout(down.timer); pressed = -1; down.i = -2; }
        else pressed = down.long ? -1 : down.i;
      }
    }
    function onUp(e) {
      if (!down) return;
      const d = down;
      down = null;
      clearTimeout(d.timer);
      pressed = -1;
      if (phase === 'playing') setFace('smile');
      if (d.long || d.i < 0) return;
      const p = pointerPos(e, canvas, W, H);
      const i = p ? cellAt(p.x, p.y) : -1;
      if (i === d.i) tapAt(i);
    }
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', () => { if (down) clearTimeout(down.timer); down = null; pressed = -1; if (phase === 'playing') setFace('smile'); });
    canvas.addEventListener('pointerleave', () => { if (!down) hover = -1; });
    const noMenu = (e) => e.preventDefault(); // right-click flags; never open the browser menu inside the screen
    field.addEventListener('contextmenu', noMenu);
    canvas.addEventListener('contextmenu', noMenu);

    // ── keyboard ──
    const moveCursor = (dx, dy) => {
      if (phase !== 'playing') return false;
      kbd = true;
      const x = Math.max(0, Math.min(board.cols - 1, (cursor % board.cols) + dx)), y = Math.max(0, Math.min(board.rows - 1, Math.floor(cursor / board.cols) + dy));
      cursor = y * board.cols + x;
      return true;
    };
    input.on('left', () => moveCursor(-1, 0));
    input.on('right', () => moveCursor(1, 0));
    input.on('up', () => moveCursor(0, -1));
    input.on('down', () => moveCursor(0, 1));
    input.on('reveal', () => { if (phase !== 'playing') return false; kbd = true; revealAt(cursor); return true; });
    input.on('flag', () => { if (phase !== 'playing') return false; kbd = true; flagAt(cursor); return true; });
    input.on('fresh', () => { newGame(); return true; });
    input.on('level', () => { if (phase === 'playing' && started) return false; cycleLevel(); return true; });
    input.on('confirm', () => { if (overlay.visible) { primary(); return true; } if (phase === 'playing') { kbd = true; revealAt(cursor); return true; } return false; });
    input.on('pause', () => {
      if (phase === 'playing') return pause();
      if (phase === 'paused') { resume(); return true; }
      return false; // Esc on a menu card leaves the screen like everywhere else
    });

    // ── loop ──
    function update(dt) {
      if (phase === 'playing' && started) {
        const before = Math.floor(time);
        time += dt;
        if (Math.floor(time) !== before) hudRefresh();
      }
      particles.update(dt);
      shake = Math.max(0, shake - dt * 2.2);
    }
    function render() {
      const t = now();
      g.clearRect(0, 0, W, H);
      g.save();
      if (shake > 0) g.translate((Math.random() - 0.5) * shake * 9, (Math.random() - 0.5) * shake * 9);
      // board plate
      const pw = board.cols * lay.C, ph = board.rows * lay.C;
      g.fillStyle = 'rgba(12,14,44,0.9)';
      g.beginPath();
      g.roundRect(lay.ox - 8, lay.oy - 8, pw + 16, ph + 16, 14);
      g.fill();
      g.strokeStyle = 'rgba(140,150,255,0.18)';
      g.stroke();
      const C = lay.C, hiddenAll = phase === 'paused';
      const lost = phase === 'exploding' || phase === 'lost';
      for (let i = 0; i < board.n; i++) {
        const x = lay.ox + (i % board.cols) * C, y = lay.oy + Math.floor(i / board.cols) * C;
        const st = board.st[i];
        const open = st === M.OPEN && !hiddenAll && appear[i] <= t;
        if (open) {
          if (board.mine[i]) { g.drawImage(i === exploded ? sprites.boom : sprites.open, x, y, C, C); g.drawImage(sprites.mine, x, y, C, C); continue; }
          g.drawImage(sprites.open, x, y, C, C);
          const age = t - appear[i];
          if (age < 0.22 && appear[i] > 0) { // reveal pop: a light flash + a tiny scale-in
            g.save();
            g.globalAlpha = (1 - age / 0.22) * 0.55;
            g.fillStyle = '#9fb0ff';
            g.beginPath();
            g.roundRect(x + 1, y + 1, C - 2, C - 2, C * 0.2);
            g.fill();
            g.restore();
          }
          const c = board.count[i];
          if (c) {
            const k = age < 0.18 && appear[i] > 0 ? 0.55 + 0.45 * (age / 0.18) : 1;
            if (k < 1) g.drawImage(sprites.num[c], x + (C - C * k) / 2, y + (C - C * k) / 2, C * k, C * k);
            else g.drawImage(sprites.num[c], x, y, C, C);
          }
          continue;
        }
        // hidden / flagged (or still waiting for its ripple turn)
        const showMine = lost && board.mine[i] && st !== M.FLAG && mineAt[i] > 0 && mineAt[i] <= t;
        const isHover = !hiddenAll && !down && ((hover === i && !kbd) || (kbd && cursor === i && phase === 'playing')) && phase === 'playing';
        g.drawImage(pressed === i && st !== M.FLAG ? sprites.pressed : isHover ? sprites.hover : sprites.hidden, x, y, C, C);
        if (hiddenAll) continue;
        if (showMine) { g.drawImage(sprites.open, x, y, C, C); g.drawImage(sprites.mine, x, y, C, C); }
        else if (st === M.FLAG) {
          g.drawImage(sprites.flag, x, y, C, C);
          if (lost && !board.mine[i]) g.drawImage(sprites.wrong, x, y, C, C);
        }
      }
      if (kbd && phase === 'playing') { // keyboard cursor ring
        const x = lay.ox + (cursor % board.cols) * C, y = lay.oy + Math.floor(cursor / board.cols) * C;
        g.strokeStyle = '#35f2ff';
        g.lineWidth = 2;
        g.beginPath();
        g.roundRect(x + 1, y + 1, C - 2, C - 2, C * 0.2);
        g.stroke();
      }
      if (down && down.touch && !down.long && down.i >= 0 && phase === 'playing') { // long-press progress ring
        const [cx, cy] = centerOf(down.i);
        g.strokeStyle = 'rgba(255,61,166,0.85)';
        g.lineWidth = 2.5;
        g.beginPath();
        g.arc(cx, cy, C * 0.5, -Math.PI / 2, -Math.PI / 2 + Math.min(1, (performance.now() - down.t0) / LONG_PRESS) * Math.PI * 2);
        g.stroke();
      }
      particles.draw(g);
      g.restore();
    }

    // ── lifecycle ──
    const rt = createRuntime(ctx, {
      id: 'minesweeper', update, render,
      onSuspend() { input.clear(); down = null; pressed = -1; if (phase === 'playing') pause(); },
    });

    // read/write view for the test harness (scripts/lib/game-minesweeper.mjs)
    el.__debug = {
      get phase() { return phase; }, get diff() { return diff; }, get time() { return time; }, get started() { return started; },
      get flagMode() { return flagMode; }, get hover() { return hover; }, get cursor() { return cursor; },
      get cols() { return board.cols; }, get rows() { return board.rows; }, get minesLeft() { return M.minesLeft(board); }, get opened() { return board.opened; },
      get mines() { return M.minesAt(board); }, get st() { return [...board.st]; }, get count() { return [...board.count]; }, get placed() { return board.placed; },
      get face() { return face; },
      cellCenter: (i) => centerOf(i),
      cellPx: () => ({ C: lay.C, ox: lay.ox, oy: lay.oy, W, H }),
      /** Replace the board by a fixed layout. */
      load(level, mineIndices) { setLevel(level); M.loadMines(board, mineIndices); phase = 'playing'; overlay.hide(); hudRefresh(); },
      setTime(s) { time = s; started = true; hudRefresh(); },
      reveal: (i) => revealAt(i), flag: (i) => flagAt(i), chord: (i) => chordAt(i),
    };

    setFace('smile');
    hudRefresh();
    showReady();
    render();
    if (ctx.isInteractive()) rt.loop.start();

    return {
      ...rt.hooks,
      onResize: () => fit.refit(),
      destroy() { timers.forEach(clearTimeout); rt.hooks.destroy(); input.destroy(); fit.destroy(); },
    };
  },
});
