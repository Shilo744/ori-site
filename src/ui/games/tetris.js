// TETRIS — SRS rotation + wall kicks, 7-bag, hold, 3-piece preview, ghost, lock delay, DAS/ARR, guideline gravity curve,
// line-clear flash, back-to-back scoring, chiptune music. Rules live in tetris-logic.js (unit-tested in node).
import { registerApp } from '../apps/registry.js';
import { sq, lg } from '../apps/icons.js';
import { achievements } from '../../core/achievements.js';
import * as sound from '../../audio.js';
import { createRuntime, fitCanvas, createInput, createHud, createOverlay, createPad, createParticles, createFit } from './kit.js';
import { scores } from './scores.js';
import { registerGameInfo } from './catalog.js';
import { createChiptune } from './chiptune.js';
import * as T from './tetris-logic.js';

const CELL = 20;
const BX = 104, BY = 0, BW = T.COLS * CELL, BH = T.ROWS * CELL; // the visible well
const W = 428, H = 400;
const COLORS = { I: '#35f2ff', O: '#ffe14a', T: '#b36bff', S: '#8dff5a', Z: '#ff4d6d', J: '#4a8dff', L: '#ff9d2e' };
const LOCK_DELAY = 0.5, MAX_LOCK_RESETS = 15;

const ICON = sq('TT',
  `<rect width="64" height="64" fill="url(#gTT)"/>
   <g stroke="rgba(255,255,255,.35)" stroke-width="1.2">
     <rect x="8" y="30" width="13" height="13" rx="3" fill="#ff9d2e"/><rect x="21" y="30" width="13" height="13" rx="3" fill="#ff9d2e"/><rect x="34" y="30" width="13" height="13" rx="3" fill="#ff9d2e"/><rect x="34" y="17" width="13" height="13" rx="3" fill="#ff9d2e"/>
     <rect x="8" y="43" width="13" height="13" rx="3" fill="#35f2ff"/><rect x="21" y="43" width="13" height="13" rx="3" fill="#b36bff"/><rect x="34" y="43" width="13" height="13" rx="3" fill="#b36bff"/><rect x="47" y="43" width="9" height="13" rx="3" fill="#8dff5a"/>
     <rect x="21" y="8" width="13" height="13" rx="3" fill="#ff4d6d"/><rect x="8" y="17" width="13" height="13" rx="3" fill="#ffe14a"/>
   </g>`,
  lg('gTT', '#1d1e52', '#070818'));

achievements.define([
  { id: 'tetris-4', name: 'Tetris!', desc: 'Clear four lines at once', rarity: 'rare', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v18M7 8v13M17 5v16"/></svg>' },
  { id: 'marathon', name: 'Marathon', desc: 'Clear 40 lines in one game', goal: 40, rarity: 'epic', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18h16M4 14h12M4 10h8M4 6h4"/></svg>' },
]);

// pre-rendered glossy block sprites (one per colour) so the render loop only drawImage()s
const sprites = (() => {
  const out = {};
  Object.entries(COLORS).forEach(([k, col]) => {
    const c = document.createElement('canvas');
    c.width = c.height = CELL * 2;
    const g = c.getContext('2d');
    g.scale(2, 2);
    g.shadowColor = col;
    g.shadowBlur = 5;
    const gr = g.createLinearGradient(0, 0, CELL, CELL);
    gr.addColorStop(0, col);
    gr.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = col;
    g.beginPath(); g.roundRect(1.5, 1.5, CELL - 3, CELL - 3, 3.5); g.fill();
    g.shadowBlur = 0;
    g.fillStyle = gr;
    g.globalAlpha = 0.55;
    g.beginPath(); g.roundRect(1.5, 1.5, CELL - 3, CELL - 3, 3.5); g.fill();
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.beginPath(); g.roundRect(3.5, 3, CELL - 7, 3, 1.5); g.fill();
    out[k] = c;
  });
  return out;
})();

function drawCover(g, w, h) {
  const bg = g.createRadialGradient(w * 0.5, h * 0.4, 10, w * 0.5, h * 0.5, w * 0.8);
  bg.addColorStop(0, '#1c1d52');
  bg.addColorStop(1, '#070817');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const s = h * 0.085, cols = 10, ox = (w - cols * s) / 2, oy = h - 12 * s - h * 0.08;
  g.fillStyle = 'rgba(255,255,255,0.04)';
  for (let y = 0; y < 12; y++) for (let x = 0; x < cols; x++) g.fillRect(ox + x * s + 0.5, oy + y * s + 0.5, s - 1, s - 1);
  const stack = ['IIIIOOZZLL', 'JJJSSOOZZL', 'TJLLSSOZZL', '.TTTLLSSZ.', '..TIII....'];
  stack.slice().reverse().forEach((row, i) => [...row].forEach((ch, x) => { if (ch !== '.') cell(g, ox + x * s, oy + (11 - i) * s, s, COLORS[ch]); }));
  [[4, 3, 'T'], [3, 4, 'T'], [4, 4, 'T'], [5, 4, 'T']].forEach(([x, y, t]) => cell(g, ox + x * s, oy + y * s, s, COLORS[t], true));
  function cell(gg, x, y, size, col, glow) {
    gg.save();
    if (glow) { gg.shadowColor = col; gg.shadowBlur = 16; }
    gg.fillStyle = col;
    gg.beginPath(); gg.roundRect(x + 1, y + 1, size - 2, size - 2, size * 0.2); gg.fill();
    gg.restore();
    gg.fillStyle = 'rgba(255,255,255,0.32)';
    gg.fillRect(x + size * 0.2, y + size * 0.16, size * 0.6, size * 0.12);
  }
}

registerGameInfo({
  id: 'tetris',
  name: 'Tetris',
  tagline: 'Stack, clear, and chase the Tetris.',
  accent: '#b36bff',
  controls: '← → move · ↑ rotate · Space drop · C hold',
  drawCover,
});

registerApp({
  id: 'tetris',
  name: 'Tetris',
  icon: ICON,
  category: 'game',
  titlebar: 'dark',
  size: { w: 462, h: 506, minW: 360, minH: 440 },
  pos: { x: 250, y: 30 },
  mount(el, ctx) {
    // ── DOM ──
    el.classList.add('gk', 'gk-tetris');
    const hud = createHud(el, [
      { id: 'score', label: 'Score', value: 0 },
      { id: 'level', label: 'Level', value: 1, accent: 'violet' },
      { id: 'lines', label: 'Lines', value: 0, accent: 'lime' },
      { id: 'best', label: 'Best', value: 0, accent: 'amber' },
    ]);
    const musicBtn = hud.addButton('music', 'Music', () => toggleMusic());
    const field = document.createElement('div');
    field.className = 'gk-field';
    const canvas = document.createElement('canvas');
    field.appendChild(canvas);
    el.appendChild(field);
    const { g } = fitCanvas(canvas, W, H);
    const fit = createFit(el, field, W, H, { reserve: () => (ctx.isCompact() || matchMedia('(pointer: coarse)').matches ? 168 : 0) });
    const overlay = createOverlay(field, { onPrimary: () => primary(), onSecondary: () => startRun() });
    const input = createInput(ctx, {
      target: field,
      keys: {
        left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], down: ['ArrowDown', 'KeyS'], up: ['ArrowUp', 'KeyW', 'KeyX'], ccw: ['KeyZ'],
        drop: ['Space'], hold: ['KeyC', 'ShiftLeft', 'ShiftRight'], pause: ['KeyP', 'Escape'], confirm: ['Enter'], music: ['KeyM'],
      },
    });
    createPad(el, input, { dirs: true, buttons: [{ action: 'ccw', label: '⟲' }, { action: 'hold', label: 'Hold' }, { action: 'drop', label: 'Drop' }] });
    const particles = createParticles(160);
    const music = createChiptune();
    let musicOn = ctx.storage.get('tetris:music', true) !== false;

    // ── state ──
    let state = 'ready'; // ready | playing | paused | clearing | over
    let board = T.newBoard();
    let bag = T.createBag();
    let forced = []; // test hook: piece types that will spawn next
    let piece = null;
    let hold = null;
    let holdUsed = false;
    let score = 0, lines = 0, level = 1, combo = -1, b2b = false;
    let gravAcc = 0, lockT = 0, lockResets = 0, lowestY = 0;
    let clearRows = [], clearTimer = 0, pendingBoard = null;
    let lastDir = 0;
    let flash = 0;
    const das = T.createDAS();

    const best = () => scores.best('tetris') || 0;
    const nextType = () => (forced.length ? forced.shift() : bag.next());

    function hudRefresh() {
      hud.set('score', score);
      hud.set('level', level);
      hud.set('lines', lines);
      hud.set('best', Math.max(best(), score));
      musicBtn.querySelector('b').textContent = musicOn ? 'ON' : 'OFF';
    }

    function spawn(type = nextType()) {
      piece = T.spawnPiece(type);
      holdUsed = false;
      gravAcc = 0; lockT = 0; lockResets = 0; lowestY = piece.y;
      if (T.collides(board, piece)) { gameOver(); return false; }
      // guideline: a freshly spawned piece drops one row immediately if it can
      const moved = T.tryMove(board, piece, 0, 1);
      if (moved) piece = moved;
      return true;
    }

    // ── screens ──
    function showReady() {
      overlay.show({ kicker: 'Arcade', title: 'Tetris', stats: [{ label: 'Best', value: best(), accent: 'amber' }], hint: '← → move · ↑ rotate · Z counter-rotate · Space drop · C hold · P pause', primary: 'Play' });
    }
    function showPaused() {
      overlay.show({ kicker: 'Paused', title: 'Take a breath', stats: [{ label: 'Score', value: score, accent: 'cyan' }, { label: 'Lines', value: lines }], hint: 'Space or P to resume', primary: 'Resume', secondary: 'Restart' });
    }
    function showOver(isBest) {
      overlay.show({
        kicker: 'Game over', title: 'Stack overflow',
        stats: [{ label: 'Score', value: score, accent: 'cyan' }, { label: 'Lines', value: lines }, { label: 'Best', value: Math.max(best(), score), accent: 'amber' }],
        banner: isBest && score > 0 ? 'New best!' : '', hint: 'Press Enter to play again', primary: 'Play again',
      });
    }

    // ── flow ──
    function resetRun() {
      board = T.newBoard();
      bag = T.createBag();
      hold = null; holdUsed = false;
      score = 0; lines = 0; level = 1; combo = -1; b2b = false;
      clearRows = []; pendingBoard = null; flash = 0;
      das.reset();
      particles.clear();
    }
    function startRun() {
      resetRun();
      state = 'playing';
      overlay.hide();
      scores.touch('tetris');
      spawn();
      hudRefresh();
      if (musicOn) music.start();
      sound.arp([392, 523, 659], 0.05, 'square', 0.06);
    }
    function pauseRun() {
      if (state !== 'playing' && state !== 'clearing') return false;
      state = state === 'clearing' ? 'clearing-paused' : 'paused';
      input.clear();
      das.reset();
      music.stop();
      showPaused();
      sound.blip(330, 0.07, 'triangle', 0.06);
      return true;
    }
    function resumeRun() {
      if (state !== 'paused' && state !== 'clearing-paused') return;
      state = state === 'clearing-paused' ? 'clearing' : 'playing';
      overlay.hide();
      if (musicOn) music.start();
      sound.blip(494, 0.07, 'triangle', 0.06);
    }
    function primary() {
      if (state === 'paused' || state === 'clearing-paused') resumeRun();
      else if (state === 'ready' || state === 'over') startRun();
    }
    function gameOver() {
      state = 'over';
      music.stop();
      const r = scores.record('tetris', score, { extra: { lines, level } });
      hudRefresh();
      showOver(r.isBest);
      sound.sweep(380, 50, 0.7, 'sawtooth', 0.1);
      sound.noiseHit(0.4, 0.12, 500);
    }

    // ── piece control ──
    const grounded = () => T.collides(board, piece, piece.rot, piece.x, piece.y + 1);
    function touch() { // a move / rotation on the ground restarts the lock timer (up to 15 times)
      if (grounded() && lockResets < MAX_LOCK_RESETS) { lockT = 0; lockResets++; }
    }
    function move(dx) {
      if (state !== 'playing' || !piece) return false;
      const p = T.tryMove(board, piece, dx, 0);
      if (!p) return false;
      piece = p;
      touch();
      sound.blip(190, 0.02, 'triangle', 0.035);
      return true;
    }
    function rotateP(dir) {
      if (state !== 'playing' || !piece) return;
      const p = T.rotate(board, piece, dir);
      if (!p) return;
      piece = p;
      touch();
      sound.blip(dir > 0 ? 340 : 300, 0.03, 'square', 0.04);
    }
    function stepDown(soft) {
      const p = T.tryMove(board, piece, 0, 1);
      if (!p) return false;
      piece = p;
      if (piece.y > lowestY) { lowestY = piece.y; lockResets = 0; }
      lockT = 0;
      if (soft) score += 1;
      return true;
    }
    function hardDrop() {
      if (state !== 'playing' || !piece) return;
      const y = T.dropY(board, piece);
      score += 2 * (y - piece.y);
      // sparks along the fall
      for (const [cx, cy] of T.cellsOf({ ...piece, y })) particles.burst(BX + (cx + 0.5) * CELL, BY + (cy - T.HIDDEN + 1) * CELL, 2, { speed: 60, life: 0.35, r: 2, hue: 190, angle: -Math.PI / 2, spread: 1 });
      piece = { ...piece, y };
      sound.sweep(520, 130, 0.12, 'square', 0.06);
      lockPiece();
    }
    function holdPiece() {
      if (state !== 'playing' || !piece || holdUsed) return;
      const cur = piece.type;
      const swap = hold;
      hold = cur;
      if (!spawn(swap || nextType())) return;
      holdUsed = true;
      sound.blip(262, 0.05, 'triangle', 0.05);
    }

    function lockPiece() {
      board = T.lockPiece(board, piece);
      sound.noiseHit(0.05, 0.07, 700);
      const r = T.clearLines(board);
      const out = T.toppedOut(board);
      if (r.rows.length) {
        const n = r.rows.length;
        const sc = T.scoreClear(n, level, b2b);
        score += sc.points;
        b2b = sc.difficult;
        combo += 1;
        if (combo > 0) score += 50 * combo * level;
        lines += n;
        const newLevel = T.levelForLines(lines);
        if (newLevel > level) { level = newLevel; flash = 1; sound.arp([523, 659, 784, 1047], 0.06, 'square', 0.07); }
        clearRows = r.rows;
        pendingBoard = r.board;
        state = 'clearing';
        clearTimer = 0.32;
        piece = null;
        r.rows.forEach((row) => particles.burst(BX + BW / 2, BY + (row - T.HIDDEN + 0.5) * CELL, 14, { speed: 160, life: 0.55, r: 2.4, hue: 200 + n * 20, spread: Math.PI * 2 }));
        sound.arp(n === 4 ? [523, 659, 784, 1047, 1319] : [440 + n * 60, 554 + n * 60], 0.05, 'square', 0.07);
        if (n === 4) { ctx.achievements.unlock('tetris-4'); sound.noiseHit(0.3, 0.16, 1200); }
        ctx.achievements.progress('marathon', lines);
      } else {
        combo = -1;
        piece = null;
        if (out) { gameOver(); return; }
        spawn();
      }
      hudRefresh();
    }

    // ── simulation ──
    function update(dt) {
      particles.update(dt);
      if (flash > 0) flash = Math.max(0, flash - dt * 2);
      if (state === 'clearing') {
        clearTimer -= dt;
        if (clearTimer <= 0) {
          board = pendingBoard;
          clearRows = [];
          state = 'playing';
          if (T.toppedOut(board)) { gameOver(); return; }
          spawn();
          hudRefresh();
        }
        return;
      }
      if (state !== 'playing' || !piece) return;
      // DAS / ARR for held left / right
      const l = input.isDown('left'), r = input.isDown('right');
      const dir = l && !r ? -1 : r && !l ? 1 : l && r ? lastDir : 0;
      const n = das.step(dir, dt);
      for (let i = 0; i < n; i++) if (!move(dir)) break;
      // gravity (soft drop = 25× or at least one row per 40 ms)
      const soft = input.isDown('down');
      const gs = T.gravitySeconds(level);
      const interval = soft ? Math.min(gs, 0.04) : gs;
      gravAcc += dt;
      while (gravAcc >= interval) {
        gravAcc -= interval;
        if (!stepDown(soft)) { gravAcc = 0; break; }
      }
      // lock delay
      if (grounded()) {
        lockT += dt;
        if (lockT >= LOCK_DELAY) lockPiece();
      } else lockT = 0;
    }

    // ── rendering ──
    function drawBlock(x, y, type, a = 1) {
      g.globalAlpha = a;
      g.drawImage(sprites[type], x, y, CELL, CELL);
      g.globalAlpha = 1;
    }
    function drawMini(type, cx, cy, size) {
      const cells = T.SHAPES[type][0];
      const minX = Math.min(...cells.map((c) => c[0])), maxX = Math.max(...cells.map((c) => c[0])), minY = Math.min(...cells.map((c) => c[1])), maxY = Math.max(...cells.map((c) => c[1]));
      const ox = cx - ((minX + maxX + 1) * size) / 2, oy = cy - ((minY + maxY + 1) * size) / 2;
      cells.forEach(([x, y]) => { g.drawImage(sprites[type], ox + x * size, oy + y * size, size, size); });
    }
    function label(text, x, y) {
      g.fillStyle = 'rgba(236,238,255,0.55)';
      g.font = '700 10px Inter, system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(text, x, y);
    }
    function render() {
      g.clearRect(0, 0, W, H);
      // side panels
      g.fillStyle = 'rgba(255,255,255,0.045)';
      g.beginPath(); g.roundRect(0, 0, 92, 78, 12); g.fill();
      g.beginPath(); g.roundRect(316, 0, 112, 214, 12); g.fill();
      label('HOLD', 46, 16);
      label('NEXT', 372, 16);
      if (hold) { g.globalAlpha = holdUsed ? 0.35 : 1; drawMini(hold, 46, 48, 14); g.globalAlpha = 1; }
      [...forced, ...bag.peek(3)].slice(0, 3).forEach((t, i) => drawMini(t, 372, 52 + i * 52, 15));
      // the well
      g.fillStyle = '#070816';
      g.beginPath(); g.roundRect(BX - 4, BY - 4, BW + 8, BH + 8, 8); g.fill();
      g.strokeStyle = flash > 0 ? `rgba(255,255,255,${0.15 + flash * 0.6})` : 'rgba(140,150,255,0.25)';
      g.lineWidth = 2;
      g.beginPath(); g.roundRect(BX - 4, BY - 4, BW + 8, BH + 8, 8); g.stroke();
      g.fillStyle = 'rgba(150,160,255,0.07)';
      for (let x = 1; x < T.COLS; x++) g.fillRect(BX + x * CELL - 0.5, BY, 1, BH);
      for (let y = 1; y < T.ROWS; y++) g.fillRect(BX, BY + y * CELL - 0.5, BW, 1);
      // locked blocks
      for (let y = T.HIDDEN; y < T.TOTAL; y++) for (let x = 0; x < T.COLS; x++) {
        const v = board[y][x];
        if (v) drawBlock(BX + x * CELL, BY + (y - T.HIDDEN) * CELL, T.TYPES[v - 1]);
      }
      // line-clear flash
      if (clearRows.length) {
        const k = 1 - clearTimer / 0.32;
        g.fillStyle = `rgba(255,255,255,${0.9 * (1 - k) + 0.1 * Math.sin(k * 30)})`;
        clearRows.forEach((row) => g.fillRect(BX, BY + (row - T.HIDDEN) * CELL, BW, CELL));
      }
      // ghost + current piece
      if (piece && (state === 'playing' || state === 'paused')) {
        const gy = T.dropY(board, piece);
        if (gy !== piece.y) {
          g.strokeStyle = COLORS[piece.type];
          g.globalAlpha = 0.5;
          g.lineWidth = 1.5;
          for (const [cx, cy] of T.cellsOf(piece, piece.rot, piece.x, gy)) if (cy >= T.HIDDEN) { g.beginPath(); g.roundRect(BX + cx * CELL + 2.5, BY + (cy - T.HIDDEN) * CELL + 2.5, CELL - 5, CELL - 5, 3); g.stroke(); }
          g.globalAlpha = 1;
        }
        for (const [cx, cy] of T.cellsOf(piece)) if (cy >= T.HIDDEN) drawBlock(BX + cx * CELL, BY + (cy - T.HIDDEN) * CELL, piece.type, grounded() ? 0.8 + 0.2 * Math.sin(lockT * 24) : 1);
      }
      particles.draw(g);
    }

    // ── input ──
    input.on('left', () => { lastDir = -1; das.reset(); move(-1); });
    input.on('right', () => { lastDir = 1; das.reset(); move(1); });
    input.on('down', () => { if (state === 'playing') { gravAcc = 0; stepDown(true); } else if (state === 'ready') return false; return true; });
    input.on('up', () => { if (state === 'ready') startRun(); else rotateP(1); });
    input.on('ccw', () => rotateP(-1));
    input.on('drop', () => { if (state === 'playing') hardDrop(); else primary(); });
    input.on('hold', () => holdPiece());
    input.on('music', () => toggleMusic());
    input.on('pause', (e) => {
      if (e && e.code === 'Escape') return state === 'playing' || state === 'clearing' ? pauseRun() : false;
      if (state === 'playing' || state === 'clearing') return pauseRun();
      primary();
      return true;
    });
    input.on('confirm', () => { if (state === 'over' || state === 'ready') startRun(); else if (state === 'paused' || state === 'clearing-paused') resumeRun(); });
    input.on('tap', () => { if (state === 'ready' || state === 'over' || state === 'paused' || state === 'clearing-paused') primary(); });

    function toggleMusic() {
      musicOn = !musicOn;
      ctx.storage.set('tetris:music', musicOn);
      musicBtn.querySelector('b').textContent = musicOn ? 'ON' : 'OFF';
      if (musicOn && state === 'playing') music.start(); else music.stop();
      sound.click();
    }

    // ── lifecycle ──
    const rt = createRuntime(ctx, {
      id: 'tetris', update, render,
      onSuspend() { input.clear(); das.reset(); music.stop(); if (state === 'playing' || state === 'clearing') pauseRun(); },
    });

    // read/write view for the test harness (scripts/lib/game-tetris.mjs)
    el.__debug = {
      get state() { return state; }, get score() { return score; }, get lines() { return lines; }, get level() { return level; },
      get piece() { return piece && { ...piece }; }, get hold() { return hold; }, get board() { return board.map((r) => r.slice()); }, get music() { return musicOn && music.playing; },
      forceQueue(list) { forced = list.slice(); },
      loadBoard(rows) { board = T.newBoard(); rows.forEach((r, i) => { const y = T.TOTAL - rows.length + i; [...r].forEach((ch, x) => { if (ch !== '.') board[y][x] = T.TYPES.indexOf(ch) + 1 || 1; }); }); if (piece) piece = { ...piece }; },
      respawn(type) { spawn(type); },
      set(o) { if ('level' in o) level = o.level; if ('lines' in o) lines = o.lines; if ('b2b' in o) b2b = o.b2b; hudRefresh(); },
    };

    hud.set('best', best());
    musicBtn.querySelector('b').textContent = musicOn ? 'ON' : 'OFF';
    showReady();
    render();
    if (ctx.isInteractive()) rt.loop.start();

    return {
      ...rt.hooks,
      onResize: () => fit.refit(),
      destroy() { music.stop(); rt.hooks.destroy(); input.destroy(); fit.destroy(); },
    };
  },
});
