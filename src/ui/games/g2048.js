// 2048 — slide numbered tiles, merge equal ones, reach 2048. Rules live in g2048-logic.js (unit-tested in node).
import './g2048.css';
import { registerApp } from '../apps/registry.js';
import { sq, lg } from '../apps/icons.js';
import { achievements } from '../../core/achievements.js';
import * as sound from '../../audio.js';
import { createInput, createHud, createOverlay, createPad, createFit } from './kit.js';
import { scores } from './scores.js';
import { registerGameInfo } from './catalog.js';
import * as L from './g2048-logic.js';

const BOARD = 372, TILE = 78, GAP = 12;
const MAX_UNDO = 3;
const SLIDE_MS = 110;
const posOf = (idx) => [GAP + (idx % L.SIZE) * (TILE + GAP), GAP + Math.floor(idx / L.SIZE) * (TILE + GAP)];

// arcade colour ramp: indigo → blue → cyan → green → lime → amber → coral → hot pink → violet
const RAMP = {
  2:    ['#2a3080', '#1c2159', '#d4dbff', '#6b7cff'],
  4:    ['#3640a6', '#242b78', '#e4e8ff', '#8794ff'],
  8:    ['#2d6bdc', '#2150b5', '#ffffff', '#4ea2ff'],
  16:   ['#1ea5e0', '#1480b8', '#ffffff', '#35f2ff'],
  32:   ['#17c9b4', '#0f9e8f', '#04211d', '#35f2d0'],
  64:   ['#36db78', '#22b45c', '#04210f', '#4dff94'],
  128:  ['#a3e03a', '#7bb81f', '#1b2504', '#b6ff3c'],
  256:  ['#f3d12f', '#d1a817', '#2a2203', '#ffe04a'],
  512:  ['#ffa22e', '#e0791a', '#2b1500', '#ffb52e'],
  1024: ['#ff6070', '#e03a50', '#ffffff', '#ff5c7a'],
  2048: ['#ff3da6', '#c026d3', '#ffffff', '#ff3da6'],
  4096: ['#b36bff', '#7a3cff', '#ffffff', '#b36bff'],
};
const BIG = ['#f4f6ff', '#bcc8ff', '#1b1f4a', '#ffffff'];
const rampOf = (v) => RAMP[v] || BIG;

const ICON = sq('G48',
  `<rect width="64" height="64" fill="url(#gG48)"/>
   <g font-family="Inter,Arial,sans-serif" font-weight="800" text-anchor="middle">
     <rect x="7" y="8" width="23" height="23" rx="5.5" fill="#2d6bdc"/><text x="18.5" y="25" font-size="14" fill="#fff">8</text>
     <rect x="34" y="8" width="23" height="23" rx="5.5" fill="#17c9b4"/><text x="45.5" y="25" font-size="12.5" fill="#04211d">32</text>
     <rect x="7" y="34" width="23" height="23" rx="5.5" fill="#ffa22e"/><text x="18.5" y="50.5" font-size="11" fill="#2b1500">512</text>
     <rect x="34" y="34" width="23" height="23" rx="5.5" fill="#ff3da6"/><text x="45.5" y="49.5" font-size="9.5" fill="#fff">2048</text>
   </g>`,
  lg('gG48', '#1d1e52', '#090a22'));

achievements.define([
  { id: 'power-of-two', name: 'Power of two', desc: 'Make a 512 tile in 2048', rarity: 'rare', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 9.5h7l-6 5h6"/></svg>' },
  { id: 'legend', name: 'Legend', desc: 'Reach the 2048 tile', rarity: 'epic', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.4 6.8 19.2l1-5.9L3.5 9.2l5.9-.8z"/></svg>' },
]);

function drawCover(g, w, h) {
  const bg = g.createRadialGradient(w * 0.5, h * 0.4, 10, w * 0.5, h * 0.5, w * 0.8);
  bg.addColorStop(0, '#1e2058');
  bg.addColorStop(1, '#070817');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const rows = [[2, 4, 8, 16], [0, 0, 32, 64], [0, 2, 256, 128], [4, 8, 1024, 2048]];
  const s = h * 0.19, gap = s * 0.14, total = 4 * s + 3 * gap;
  const ox = (w - total) / 2, oy = (h - total) / 2;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  rows.forEach((row, r) => row.forEach((v, c) => {
    const x = ox + c * (s + gap), y = oy + r * (s + gap);
    if (!v) { g.fillStyle = 'rgba(255,255,255,0.06)'; g.beginPath(); g.roundRect(x, y, s, s, s * 0.17); g.fill(); return; }
    const [c1, c2, fg, glow] = rampOf(v);
    g.save();
    g.shadowColor = glow;
    g.shadowBlur = v >= 512 ? 18 : 9;
    const gr = g.createLinearGradient(x, y, x + s, y + s);
    gr.addColorStop(0, c1);
    gr.addColorStop(1, c2);
    g.fillStyle = gr;
    g.beginPath();
    g.roundRect(x, y, s, s, s * 0.17);
    g.fill();
    g.restore();
    g.fillStyle = fg;
    g.font = `800 ${Math.round(s * (String(v).length > 3 ? 0.3 : String(v).length > 2 ? 0.4 : 0.5))}px "JetBrains Mono", monospace`;
    g.fillText(String(v), x + s / 2, y + s / 2 + 1);
  }));
}

registerGameInfo({
  id: '2048',
  name: '2048',
  tagline: 'Slide, merge, reach the glowing tile.',
  accent: '#ff3da6',
  controls: 'Arrows / WASD / swipe · U to undo',
  drawCover,
});

registerApp({
  id: '2048',
  name: '2048',
  icon: ICON,
  category: 'game',
  titlebar: 'dark',
  size: { w: 420, h: 488, minW: 340, minH: 420 },
  pos: { x: 270, y: 36 },
  mount(el, ctx) {
    const store = ctx.storage;
    const nextId = L.idGen(1);
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };

    // ── DOM ──
    el.classList.add('gk', 'g48');
    const hud = createHud(el, [
      { id: 'score', label: 'Score', value: 0 },
      { id: 'best', label: 'Best', value: 0, accent: 'amber' },
    ]);
    const undoBtn = hud.addButton('undo', 'Undo', () => undo());
    hud.addButton('new', 'New', () => newGame()).setAttribute('aria-label', 'New game');
    const field = document.createElement('div');
    field.className = 'gk-field';
    const board = document.createElement('div');
    board.className = 'g48-board';
    for (let i = 0; i < L.CELLS; i++) {
      const c = document.createElement('div');
      c.className = 'g48-cell';
      const [x, y] = posOf(i);
      c.style.left = `${x}px`;
      c.style.top = `${y}px`;
      board.appendChild(c);
    }
    field.appendChild(board);
    el.appendChild(field);
    const fit = createFit(el, field, BOARD, BOARD, { reserve: () => (ctx.isCompact() || matchMedia('(pointer: coarse)').matches ? 168 : 0) });
    const overlay = createOverlay(field, { onPrimary: () => primary(), onSecondary: () => newGame() });
    const input = createInput(ctx, {
      target: field,
      keys: { up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], undo: ['KeyU', 'KeyZ'], fresh: ['KeyN'], confirm: ['Enter'] },
    });
    createPad(el, input, { dirs: true, buttons: [{ action: 'undo', label: 'Undo' }] });

    // ── state ──
    let cells = L.emptyBoard();
    let score = 0;
    let won = false; // the win overlay was shown (or dismissed with "Keep going")
    let keep = false;
    let over = false;
    let recorded = false;
    let undoStack = [];
    const els = new Map(); // tile id → element

    const bestNow = () => Math.max(scores.best('2048') || 0, score);
    const overlayOpen = () => overlay.visible;

    function save() {
      store.set('2048:game', { v: L.toValues(cells), score, won, keep, over, recorded, undo: undoStack });
    }

    function place(node, idx) {
      const [x, y] = posOf(idx);
      node.style.transform = `translate(${x}px, ${y}px)`;
    }
    function makeTile(t, idx, cls = '') {
      const node = document.createElement('div');
      node.className = `g48-tile ${cls}`.trim();
      node.dataset.v = String(t.v);
      node.dataset.d = String(String(t.v).length);
      const [c1, c2, fg, glow] = rampOf(t.v);
      node.style.cssText = `--bg1:${c1};--bg2:${c2};--fg:${fg};--glow:${glow}`;
      node.innerHTML = `<b>${t.v}</b>`;
      place(node, idx);
      board.appendChild(node);
      els.set(t.id, node);
      return node;
    }
    function clearTiles() {
      board.querySelectorAll('.g48-tile').forEach((n) => n.remove());
      els.clear();
    }
    function renderAll(cls = 'fresh') {
      clearTiles();
      cells.forEach((t, i) => { if (t) makeTile(t, i, cls); });
    }

    function hudRefresh() {
      hud.set('score', score);
      hud.set('best', bestNow());
      undoBtn.querySelector('b').textContent = `×${undoStack.length}`;
      undoBtn.disabled = !undoStack.length;
    }

    // ── flow ──
    function record() {
      if (recorded || score <= 0) return null;
      recorded = true;
      return scores.record('2048', score);
    }
    let playedTouched = false; // the run counts as "played" from its first move (opening the window must not)
    function newGame() {
      record();
      playedTouched = false;
      cells = L.fromValues(Array(L.CELLS).fill(0), nextId);
      cells = L.spawn(L.spawn(cells, Math.random, nextId).cells, Math.random, nextId).cells;
      score = 0; won = false; keep = false; over = false; recorded = false; undoStack = [];
      overlay.hide();
      renderAll('fresh');
      hudRefresh();
      save();
      sound.arp([330, 440, 554], 0.05, 'square', 0.06);
    }

    function showWin() {
      overlay.show({
        kicker: 'You win!', title: '2048', stats: [{ label: 'Score', value: score, accent: 'cyan' }],
        hint: 'Keep going to chase a bigger tile.', primary: 'Keep going', secondary: 'New game',
      });
      sound.arp([523, 659, 784, 1047, 1319], 0.08, 'square', 0.08);
    }
    function showOver() {
      const r = record();
      hudRefresh();
      overlay.show({
        kicker: 'Game over', title: 'No more moves',
        stats: [{ label: 'Score', value: score, accent: 'cyan' }, { label: 'Best', value: bestNow(), accent: 'amber' }],
        banner: r && r.isBest ? 'New best!' : '', hint: 'Press Enter to try again', primary: 'Try again',
      });
      sound.sweep(380, 70, 0.5, 'sawtooth', 0.1);
      if (r && r.isBest) sound.arp([523, 659, 784, 1047], 0.07, 'square', 0.07);
    }
    function primary() {
      if (over) newGame();
      else if (overlayOpen() && won) { keep = true; overlay.hide(); save(); }
    }

    function doMove(dir) {
      if (over || overlayOpen()) return;
      const r = L.move(cells, dir, nextId);
      if (r.moved && !playedTouched) { playedTouched = true; scores.touch('2048'); }
      if (!r.moved) {
        board.classList.remove('nope');
        void board.offsetWidth;
        board.classList.add('nope');
        sound.blip(110, 0.05, 'triangle', 0.05);
        return;
      }
      undoStack.push({ v: L.toValues(cells), score });
      if (undoStack.length > MAX_UNDO) undoStack.shift();
      score += r.gained;

      // slide: every tile that existed moves to its destination (merging tiles slide into each other)
      const mergedAway = new Set(r.merged.flatMap((m) => m.from));
      r.travel.forEach(({ id, to }) => { const n = els.get(id); if (n) place(n, to); });
      mergedAway.forEach((id) => {
        const n = els.get(id);
        if (!n) return;
        n.classList.add('gone');
        els.delete(id);
        later(() => n.remove(), 320);
      });
      r.merged.forEach((m) => makeTile({ id: m.id, v: m.v }, m.to, 'pop'));

      // spawn the next tile
      const s = L.spawn(r.cells, Math.random, nextId);
      cells = s ? s.cells : r.cells;
      if (s) makeTile({ id: s.spawned.id, v: s.spawned.v }, s.spawned.idx, 'new');

      // feedback
      sound.blip(150, 0.05, 'triangle', 0.05);
      r.merged.slice(0, 3).forEach((m, i) => sound.blip(L.mergeFreq(m.v), 0.11, 'square', 0.07, 0.04 + i * 0.05));
      if (r.merged.length) hud.bump('score');
      hudRefresh();

      const top = L.maxTile(cells);
      if (top >= 512) ctx.achievements.unlock('power-of-two');
      if (top >= 2048) ctx.achievements.unlock('legend');
      if (top >= 2048 && !won) { won = true; save(); later(showWin, 450); return; }
      if (!L.canMove(cells)) { over = true; save(); later(showOver, 500); return; }
      save();
    }

    function undo() {
      if (!undoStack.length || overlayOpen()) return;
      const snap = undoStack.pop();
      cells = L.fromValues(snap.v, nextId);
      score = snap.score;
      over = false;
      renderAll('');
      hudRefresh();
      save();
      sound.sweep(300, 520, 0.12, 'triangle', 0.06);
    }

    // ── input ──
    ['up', 'down', 'left', 'right'].forEach((d) => input.on(d, () => { doMove(d); }));
    input.on('undo', () => { undo(); });
    input.on('fresh', () => { if (!overlayOpen() || over) newGame(); });
    input.on('confirm', () => { if (overlayOpen()) primary(); });

    // ── restore / start ──
    const saved = store.get('2048:game', null);
    if (saved && Array.isArray(saved.v) && saved.v.length === L.CELLS && saved.v.some(Boolean)) {
      cells = L.fromValues(saved.v, nextId);
      score = saved.score || 0;
      won = !!saved.won; keep = !!saved.keep; over = !!saved.over; recorded = !!saved.recorded;
      undoStack = Array.isArray(saved.undo) ? saved.undo.slice(-MAX_UNDO) : [];
      renderAll('fresh');
      hudRefresh();
      if (over) later(showOver, 200);
      else if (won && !keep) later(showWin, 200);
    } else {
      newGame();
    }
    el.__debug = { get cells() { return L.toValues(cells); }, get score() { return score; }, get over() { return over; }, get won() { return won; }, set(values, s = 0) { cells = L.fromValues(values, nextId); score = s; over = false; won = false; keep = false; overlay.hide(); renderAll(''); hudRefresh(); save(); } };

    return {
      onResize: () => fit.refit(),
      pause() { input.clear(); },
      destroy() { timers.forEach(clearTimeout); timers.clear(); input.destroy(); fit.destroy(); },
    };
  },
});
