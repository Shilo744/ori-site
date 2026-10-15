// SNAKE — neon snake with smooth interpolated motion, pulsing food, combo scoring, speed ramp and a wrap/walls mode.
import { registerApp } from '../apps/registry.js';
import { sq, lg } from '../apps/icons.js';
import { achievements } from '../../core/achievements.js';
import * as sound from '../../audio.js';
import { createRuntime, fitCanvas, createInput, createHud, createOverlay, createPad, createParticles, createFit } from './kit.js';
import { scores } from './scores.js';
import { registerGameInfo } from './catalog.js';

const COLS = 20, ROWS = 20, CELL = 20, W = COLS * CELL, H = ROWS * CELL;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const MAX_PTS = COLS * ROWS + 3;
const OFFS_X = [-W, 0, W];
const OFFS_Y = [-H, 0, H];
// pre-built body colours (cyan → violet) so the render loop never builds strings
const SEG_COLORS = Array.from({ length: 64 }, (_, i) => `hsl(${172 + (i / 63) * 98} 100% ${60 - (i / 63) * 8}%)`);
const haloSprite = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,61,166,0.55)');
  gr.addColorStop(1, 'rgba(255,61,166,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  return c;
})();

const ICON = sq('SN',
  `<rect width="64" height="64" fill="url(#gSN)"/>
   <path d="M12 46 L26 46 L26 30 L42 30 L42 18 L52 18" fill="none" stroke="#35f2ff" stroke-opacity=".35" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
   <path d="M12 46 L26 46 L26 30 L42 30 L42 18 L52 18" fill="none" stroke="url(#gSN2)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
   <circle cx="52" cy="18" r="6" fill="#d6fff6"/><circle cx="54" cy="16" r="1.6" fill="#07101e"/>
   <circle cx="16" cy="18" r="6.5" fill="#ff3da6"/><circle cx="14" cy="16" r="2" fill="#fff" opacity=".8"/>`,
  lg('gSN', '#1b1c46', '#07081a') + lg('gSN2', '#8f6bff', '#35f2ff', 1, 0));

achievements.define([{
  id: 'hungry', name: 'Hungry', desc: 'Score 25 in Snake', goal: 25, rarity: 'common',
  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18h6V9h8V5"/><circle cx="18" cy="5" r="1.6" fill="currentColor"/></svg>',
}]);

/** Arcade cover art: a glowing snake curling toward an apple on a neon grid. */
function drawCover(g, w, h) {
  const bg = g.createRadialGradient(w * 0.5, h * 0.45, 10, w * 0.5, h * 0.5, w * 0.75);
  bg.addColorStop(0, '#1c1d52');
  bg.addColorStop(1, '#070817');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const cell = h / 9;
  g.fillStyle = 'rgba(255,255,255,0.03)';
  for (let y = 0; y < 9; y++) for (let x = 0; x * cell < w; x++) if ((x + y) % 2 === 0) g.fillRect(x * cell, y * cell, cell, cell);
  g.fillStyle = 'rgba(150,160,255,0.28)';
  for (let y = 1; y < 9; y++) for (let x = 1; x * cell < w; x++) g.fillRect(x * cell - 1, y * cell - 1, 2, 2);
  // the snake: an S-curve of rounded segments, cyan head → violet tail
  const pts = [[0.86, 0.3], [0.7, 0.3], [0.54, 0.3], [0.4, 0.3], [0.4, 0.5], [0.4, 0.7], [0.26, 0.7], [0.14, 0.7], [0.14, 0.5]];
  g.lineCap = g.lineJoin = 'round';
  g.strokeStyle = 'rgba(53,242,255,0.16)';
  g.lineWidth = cell * 1.3;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x * w, y * h) : g.moveTo(x * w, y * h)));
  g.stroke();
  for (let i = pts.length - 2; i >= 0; i--) {
    const k = i / (pts.length - 1);
    g.strokeStyle = `hsl(${172 + k * 98} 100% ${60 - k * 8}%)`;
    g.lineWidth = cell * (0.86 - k * 0.3);
    g.beginPath();
    g.moveTo(pts[i][0] * w, pts[i][1] * h);
    g.lineTo(pts[i + 1][0] * w, pts[i + 1][1] * h);
    g.stroke();
  }
  const hx = pts[0][0] * w, hy = pts[0][1] * h;
  g.shadowColor = 'rgba(53,242,255,0.95)';
  g.shadowBlur = 22;
  g.fillStyle = '#e8fffd';
  g.beginPath();
  g.arc(hx, hy, cell * 0.5, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = '#071018';
  g.beginPath();
  g.arc(hx - cell * 0.05, hy - cell * 0.2, cell * 0.11, 0, Math.PI * 2);
  g.arc(hx - cell * 0.05, hy + cell * 0.2, cell * 0.11, 0, Math.PI * 2);
  g.fill();
  // the apple
  const ax = 0.9 * w - cell * 0.2, ay = 0.7 * h;
  const halo = g.createRadialGradient(ax, ay, 0, ax, ay, cell * 1.6);
  halo.addColorStop(0, 'rgba(255,61,166,0.6)');
  halo.addColorStop(1, 'rgba(255,61,166,0)');
  g.fillStyle = halo;
  g.fillRect(ax - cell * 2, ay - cell * 2, cell * 4, cell * 4);
  g.shadowColor = '#ff3da6';
  g.shadowBlur = 18;
  g.fillStyle = '#ff5cb6';
  g.beginPath();
  g.arc(ax, ay, cell * 0.42, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  g.arc(ax - cell * 0.13, ay - cell * 0.13, cell * 0.12, 0, Math.PI * 2);
  g.fill();
}

registerGameInfo({
  id: 'snake',
  name: 'Snake',
  tagline: 'Eat. Grow. Don’t bite yourself.',
  accent: '#35f2ff',
  controls: 'Arrows / WASD · Space to pause',
  variants: [{ id: 'snake:wrap', label: 'Wrap' }],
  drawCover,
});

registerApp({
  id: 'snake',
  name: 'Snake',
  icon: ICON,
  category: 'game',
  titlebar: 'dark',
  size: { w: 440, h: 506, minW: 340, minH: 420 },
  pos: { x: 262, y: 34 },
  mount(el, ctx) {
    const store = ctx.storage;
    let wrap = !!store.get('snake:wrap', false);
    const modeId = () => (wrap ? 'snake:wrap' : 'snake');

    // ── DOM ──
    el.classList.add('gk', 'gk-snake');
    const hud = createHud(el, [
      { id: 'score', label: 'Score', value: 0 },
      { id: 'best', label: 'Best', value: 0, accent: 'amber' },
      { id: 'combo', label: 'Combo', value: '×1', accent: 'pink' },
    ]);
    const modeBtn = hud.addButton('mode', 'Mode', () => { if (state === 'ready' || state === 'over') { setWrap(!wrap); sound.click(); } });
    const field = document.createElement('div');
    field.className = 'gk-field';
    const canvas = document.createElement('canvas');
    field.appendChild(canvas);
    el.appendChild(field);
    const { g } = fitCanvas(canvas, W, H);
    const bgCanvas = document.createElement('canvas');
    const bgG = fitCanvas(bgCanvas, W, H).g;
    const fit = createFit(el, field, W, H, { reserve: () => (ctx.isCompact() || matchMedia('(pointer: coarse)').matches ? 168 : 0) });
    const overlay = createOverlay(field, { onPrimary: () => primary(), onSecondary: () => startRun() });
    const input = createInput(ctx, { target: field });
    createPad(el, input, { dirs: true, buttons: [{ action: 'action', label: 'Pause' }] });
    const particles = createParticles(140);

    // ── state ──
    let state = 'ready'; // ready | playing | paused | dying | over
    let snake = [];
    let dir = DIRS.right;
    let queue = [];
    let food = { x: 14, y: 10 };
    let foodBorn = 0;
    let tailPrev = null;
    let moveT = 0;
    let stepTime = 0.13;
    let score = 0;
    let combo = 1;
    let lastEat = -99;
    let gameTime = 0;
    let dyingT = 0;
    let shake = 0;
    let deathReason = '';
    const floaters = [];
    const px = new Float32Array(MAX_PTS);
    const py = new Float32Array(MAX_PTS);

    const best = () => scores.best(modeId()) || 0;
    const speedFor = (s) => Math.max(0.062, 0.13 - s * 0.0014);

    function setWrap(v) {
      wrap = v;
      store.set('snake:wrap', wrap);
      modeBtn.querySelector('b').textContent = wrap ? 'WRAP' : 'WALLS';
      hud.set('best', best());
      drawBackground();
      if (state === 'ready') showReady();
    }

    function reset() {
      snake = [{ x: 6, y: 10 }, { x: 5, y: 10 }, { x: 4, y: 10 }];
      dir = DIRS.right;
      queue = [];
      tailPrev = null;
      moveT = 0;
      score = 0;
      combo = 1;
      lastEat = -99;
      stepTime = speedFor(0);
      shake = 0;
      floaters.length = 0;
      particles.clear();
      placeFood();
      hud.set('score', 0);
      hud.set('combo', '×1');
      hud.set('best', best());
    }

    function placeFood() {
      const occupied = new Set(snake.map((s) => s.y * COLS + s.x));
      const free = [];
      for (let i = 0; i < COLS * ROWS; i++) if (!occupied.has(i)) free.push(i);
      const pick = free.length ? free[(Math.random() * free.length) | 0] : 0;
      food = { x: pick % COLS, y: (pick / COLS) | 0 };
      foodBorn = gameTime;
    }

    // ── overlay screens ──
    function showReady() {
      overlay.show({
        kicker: 'Arcade', title: 'Snake',
        stats: [{ label: wrap ? 'Best · wrap' : 'Best', value: best(), accent: 'amber' }],
        hint: 'Arrow keys or WASD to steer · Space or P to pause', primary: 'Play',
      });
    }
    function showPaused() {
      overlay.show({
        kicker: 'Paused', title: 'Take a breath',
        stats: [{ label: 'Score', value: score, accent: 'cyan' }, { label: 'Best', value: best(), accent: 'amber' }],
        hint: 'Space or P to resume', primary: 'Resume', secondary: 'Restart',
      });
    }
    function showOver(isBest) {
      overlay.show({
        kicker: 'Game over', title: deathReason,
        stats: [{ label: 'Score', value: score, accent: 'cyan' }, { label: 'Best', value: best(), accent: 'amber' }],
        banner: isBest && score > 0 ? 'New best!' : '',
        hint: 'Press Enter to play again', primary: 'Play again',
      });
    }

    // ── flow ──
    function startRun() {
      reset();
      state = 'playing';
      overlay.hide();
      modeBtn.disabled = true;
      scores.touch(modeId());
      sound.arp([392, 523, 659], 0.055, 'square', 0.07);
    }
    function pauseRun() {
      if (state !== 'playing') return false;
      state = 'paused';
      input.clear();
      showPaused();
      sound.blip(330, 0.07, 'triangle', 0.07);
      return true;
    }
    function resumeRun() {
      if (state !== 'paused') return;
      state = 'playing';
      overlay.hide();
      sound.blip(494, 0.07, 'triangle', 0.07);
    }
    function primary() {
      if (state === 'paused') resumeRun();
      else if (state === 'ready' || state === 'over') startRun();
    }
    function die(reason) {
      state = 'dying';
      deathReason = reason;
      dyingT = 0.6;
      shake = 1;
      const head = snake[0];
      particles.burst((head.x + 0.5) * CELL, (head.y + 0.5) * CELL, 26, { speed: 150, life: 0.8, r: 3, hue: 350 });
      snake.forEach((s, i) => { if (i % 2 === 0) particles.burst((s.x + 0.5) * CELL, (s.y + 0.5) * CELL, 2, { speed: 60, life: 0.7, hue: 190 + i * 2 }); });
      sound.sweep(420, 50, 0.55, 'sawtooth', 0.11);
      sound.noiseHit(0.32, 0.14, 700);
    }
    function finish() {
      const r = scores.record(modeId(), score);
      hud.set('best', best());
      state = 'over';
      modeBtn.disabled = false;
      showOver(r.isBest);
      if (r.isBest && score > 0) sound.arp([523, 659, 784, 1047], 0.07, 'square', 0.08);
    }

    // ── simulation ──
    function turn(name) {
      const d = DIRS[name];
      if (state === 'ready') { startRun(); }
      if (state !== 'playing') return;
      const base = queue.length ? queue[queue.length - 1] : dir;
      if (d[0] === -base[0] && d[1] === -base[1]) return; // no 180° turns
      if (d[0] === base[0] && d[1] === base[1]) return;
      if (queue.length < 2) { queue.push(d); sound.blip(280 + queue.length * 30, 0.03, 'triangle', 0.035); }
    }

    function step() {
      if (queue.length) dir = queue.shift();
      const head = snake[0];
      let nx = head.x + dir[0], ny = head.y + dir[1];
      if (wrap) { nx = (nx + COLS) % COLS; ny = (ny + ROWS) % ROWS; }
      else if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) { die('You hit the wall'); return; }
      const eating = nx === food.x && ny === food.y;
      const limit = eating ? snake.length : snake.length - 1; // the tail cell frees up when we do not grow
      for (let i = 0; i < limit; i++) if (snake[i].x === nx && snake[i].y === ny) { die('You bit yourself'); return; }
      snake.unshift({ x: nx, y: ny });
      if (eating) {
        tailPrev = null;
        combo = gameTime - lastEat <= 3 ? combo + 1 : 1;
        lastEat = gameTime;
        const pts = 1 + Math.min(combo - 1, 3);
        score += pts;
        stepTime = speedFor(score);
        const fx = (food.x + 0.5) * CELL, fy = (food.y + 0.5) * CELL;
        particles.burst(fx, fy, 16 + combo * 3, { speed: 120, life: 0.65, r: 2.6, hue: 330 });
        particles.burst(fx, fy, 6, { speed: 70, life: 0.5, r: 2, hue: 170 });
        floaters.push({ x: fx, y: fy - 8, t: 0.8, text: `+${pts}` });
        if (floaters.length > 4) floaters.shift();
        hud.set('score', score);
        hud.bump('score');
        hud.set('combo', `×${combo}`);
        if (combo > 1) hud.bump('combo');
        sound.blip(520 + Math.min(combo, 6) * 60, 0.08, 'square', 0.08);
        sound.blip(780 + Math.min(combo, 6) * 90, 0.1, 'square', 0.07, 0.06);
        ctx.achievements.progress('hungry', score);
        placeFood();
      } else {
        tailPrev = snake.pop();
        if (gameTime - lastEat > 3 && combo > 1) { combo = 1; hud.set('combo', '×1'); }
      }
    }

    function update(dt) {
      gameTime += dt;
      particles.update(dt);
      if (shake > 0) shake = Math.max(0, shake - dt * 2.4);
      for (let i = floaters.length - 1; i >= 0; i--) { floaters[i].t -= dt; floaters[i].y -= 18 * dt; if (floaters[i].t <= 0) floaters.splice(i, 1); }
      if (state === 'playing') {
        moveT += dt;
        while (moveT >= stepTime && state === 'playing') { moveT -= stepTime; step(); }
      } else if (state === 'dying') {
        dyingT -= dt;
        if (dyingT <= 0) finish();
      }
    }

    // ── rendering ──
    function drawBackground() {
      const b = bgG;
      b.clearRect(0, 0, W, H);
      const grad = b.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.75);
      grad.addColorStop(0, '#12133a');
      grad.addColorStop(1, '#070816');
      b.fillStyle = grad;
      b.fillRect(0, 0, W, H);
      b.fillStyle = 'rgba(255,255,255,0.025)';
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if ((x + y) % 2 === 0) b.fillRect(x * CELL, y * CELL, CELL, CELL);
      b.fillStyle = 'rgba(150,160,255,0.2)';
      for (let y = 1; y < ROWS; y++) for (let x = 1; x < COLS; x++) b.fillRect(x * CELL - 0.75, y * CELL - 0.75, 1.5, 1.5);
      b.lineWidth = 3;
      b.strokeStyle = wrap ? 'rgba(53,242,255,0.5)' : 'rgba(255,61,166,0.55)';
      if (wrap) b.setLineDash([6, 8]);
      b.strokeRect(1.5, 1.5, W - 3, H - 3);
      b.setLineDash([]);
    }

    const wrapD = (d, n) => (d > n / 2 ? d - n : d < -n / 2 ? d + n : d);

    function computePath(t) {
      const n = snake.length;
      const head = snake[0], ph = snake[1];
      px[0] = ph.x + 0.5 + wrapD(head.x - ph.x, COLS) * t;
      py[0] = ph.y + 0.5 + wrapD(head.y - ph.y, ROWS) * t;
      for (let i = 1; i < n; i++) {
        px[i] = px[i - 1] + wrapD(snake[i].x + 0.5 - px[i - 1], COLS);
        py[i] = py[i - 1] + wrapD(snake[i].y + 0.5 - py[i - 1], ROWS);
      }
      // keep the chain anchored on the real cells (undo float drift from the interpolated head)
      const last = snake[n - 1];
      let tx = px[n - 1], ty = py[n - 1];
      if (tailPrev) { tx += wrapD(tailPrev.x - last.x, COLS) * (1 - t); ty += wrapD(tailPrev.y - last.y, ROWS) * (1 - t); }
      px[n] = tx;
      py[n] = ty;
      return n;
    }

    function drawSnake(ox, oy, n, head) {
      g.save();
      g.translate(ox, oy);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      // soft glow pass
      g.strokeStyle = 'rgba(53,242,255,0.16)';
      g.lineWidth = CELL * 1.05;
      g.beginPath();
      g.moveTo(px[0] * CELL, py[0] * CELL);
      for (let i = 1; i <= n; i++) g.lineTo(px[i] * CELL, py[i] * CELL);
      g.stroke();
      // tapered, colour-shifting body
      for (let i = n - 1; i >= 0; i--) {
        const k = i / n;
        g.strokeStyle = SEG_COLORS[(k * 63) | 0];
        g.lineWidth = CELL * (0.78 - k * 0.3);
        g.beginPath();
        g.moveTo(px[i] * CELL, py[i] * CELL);
        g.lineTo(px[i + 1] * CELL, py[i + 1] * CELL);
        g.stroke();
      }
      if (head) {
        const hx = px[0] * CELL, hy = py[0] * CELL;
        g.shadowColor = 'rgba(53,242,255,0.9)';
        g.shadowBlur = 14;
        g.fillStyle = '#e8fffd';
        g.beginPath();
        g.arc(hx, hy, CELL * 0.46, 0, Math.PI * 2);
        g.fill();
        g.shadowBlur = 0;
        const [dx, dy] = dir;
        const ex = -dy * 4.2, ey = dx * 4.2;
        g.fillStyle = '#071018';
        g.beginPath();
        g.arc(hx + dx * 2.6 + ex, hy + dy * 2.6 + ey, 2.1, 0, Math.PI * 2);
        g.arc(hx + dx * 2.6 - ex, hy + dy * 2.6 - ey, 2.1, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }

    function drawFood() {
      const fx = (food.x + 0.5) * CELL, fy = (food.y + 0.5) * CELL;
      const age = gameTime - foodBorn;
      const pop = Math.min(1, age / 0.22);
      const s = (1 - Math.pow(1 - pop, 3)) * (1 + Math.sin(gameTime * 7) * 0.09);
      const r = CELL * 0.36 * s;
      const hr = CELL * (1.05 + Math.sin(gameTime * 7) * 0.14) * Math.max(0.01, pop);
      g.drawImage(haloSprite, fx - hr, fy - hr, hr * 2, hr * 2);
      g.shadowColor = '#ff3da6';
      g.shadowBlur = 12;
      g.fillStyle = '#ff5cb6';
      g.beginPath();
      g.arc(fx, fy, r, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.arc(fx - r * 0.3, fy - r * 0.3, r * 0.28, 0, Math.PI * 2);
      g.fill();
    }

    function render(alpha) {
      const t = state === 'playing' ? Math.min(1, moveT / stepTime) : state === 'ready' ? 1 : (state === 'paused' || state === 'dying' || state === 'over') ? lastT : alpha;
      lastT = t;
      g.clearRect(0, 0, W, H);
      g.save();
      if (shake > 0) g.translate((Math.random() - 0.5) * shake * 7, (Math.random() - 0.5) * shake * 7);
      g.drawImage(bgCanvas, 0, 0, W, H);
      drawFood();
      const n = computePath(t);
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (let i = 0; i <= n; i++) { minX = Math.min(minX, px[i]); maxX = Math.max(maxX, px[i]); minY = Math.min(minY, py[i]); maxY = Math.max(maxY, py[i]); }
      const alive = state !== 'dying' && state !== 'over';
      if (wrap) {
        for (const ox of OFFS_X) for (const oy of OFFS_Y) {
          const sx = ox / CELL, sy = oy / CELL;
          if (maxX + sx < -1 || minX + sx > COLS + 1 || maxY + sy < -1 || minY + sy > ROWS + 1) continue;
          drawSnake(ox, oy, n, true);
        }
      } else {
        g.globalAlpha = alive ? 1 : 0.55;
        drawSnake(0, 0, n, true);
        g.globalAlpha = 1;
      }
      particles.draw(g);
      if (floaters.length) {
        g.font = '700 13px "JetBrains Mono", monospace';
        g.textAlign = 'center';
        floaters.forEach((f) => { g.globalAlpha = Math.min(1, f.t * 2); g.fillStyle = '#ffe27a'; g.fillText(f.text, f.x, f.y); });
        g.globalAlpha = 1;
      }
      g.restore();
    }
    let lastT = 1;

    // ── input ──
    ['up', 'down', 'left', 'right'].forEach((d) => input.on(d, () => { turn(d); }));
    input.on('action', () => { if (state === 'playing') pauseRun(); else primary(); });
    input.on('pause', (e) => {
      if (e && e.code === 'Escape') return state === 'playing' ? pauseRun() : false; // Esc outside a run leaves the screen
      if (state === 'playing') return pauseRun();
      primary();
      return true;
    });
    input.on('confirm', () => { if (state === 'over' || state === 'ready') startRun(); else if (state === 'paused') resumeRun(); });
    input.on('tap', () => { if (state === 'paused' || state === 'ready' || state === 'over') primary(); });

    // ── lifecycle ──
    const rt = createRuntime(ctx, {
      id: 'snake',
      update,
      render,
      onSuspend() { input.clear(); if (state === 'playing') pauseRun(); },
    });

    // read-only view of the game for the test harness (scripts/lib/game-snake.mjs)
    el.__debug = { get state() { return state; }, get score() { return score; }, get food() { return food; }, get head() { return snake[0]; }, get dir() { return dir; }, get length() { return snake.length; } };

    modeBtn.querySelector('b').textContent = wrap ? 'WRAP' : 'WALLS';
    drawBackground();
    reset();
    showReady();
    render(1);
    if (ctx.isInteractive()) rt.loop.start();

    return {
      ...rt.hooks,
      onResize: () => fit.refit(),
      destroy() { rt.hooks.destroy(); input.destroy(); fit.destroy(); },
    };
  },
});
