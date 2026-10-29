// "Ori, Can You...?" — the games on the office computer (PURE): a game inside the game inside a computer. Two little classics built on the rules the site
// already has (src/ui/games/*-logic.js): TETRIS (falling blocks) and 2048 (slide and merge). A run ends with a score; the score pays peaches.
import {
  COLS, TOTAL, HIDDEN, TYPES, newBoard, spawnPiece, createBag, collides, tryMove, rotate, dropY, lockPiece, clearLines, toppedOut, gravitySeconds, levelForLines, scoreClear, cellsOf,
} from '../../ui/games/tetris-logic.js';
import { emptyBoard, spawn as spawn2048, move as move2048, canMove, maxTile, toValues, idGen } from '../../ui/games/g2048-logic.js';
import { mulberry32 } from '../rng.js';

export const GAMES = [
  { id: 'tetris', name: 'BLOCKS', blurb: 'Falling blocks. Clear lines.' },
  { id: '2048', name: '2048', blurb: 'Slide, merge, reach 2048.' },
  { id: 'snake', name: 'SNAKE', blurb: 'Eat peaches. Do not eat yourself.', fresh: true }, // [experimental] (a night addition: Shilo judges it)
];

/** How many peaches a score is worth (a good run pays well, a tiny run pays a little, nobody pays nothing). */
export const peachesFor = (game, score) => Math.max(2, Math.min(60, Math.floor(score / (game === 'tetris' ? 120 : game === 'snake' ? 30 : 80))));

export function createTetrisRun({ seed = 1 } = {}) {
  const rng = mulberry32(seed);
  const bag = createBag(rng);
  const s = { board: newBoard(), piece: null, score: 0, lines: 0, level: 1, over: false, acc: 0, lockT: 0, soft: false, b2b: false, combo: 0 };
  const next = () => { s.piece = spawnPiece(bag.next()); s.lockT = 0; s.acc = 0; if (collides(s.board, s.piece)) s.over = true; };
  next();
  function lock() {
    s.board = lockPiece(s.board, s.piece);
    const c = clearLines(s.board);
    s.board = c.board;
    s.lines += c.rows.length;
    s.level = levelForLines(s.lines);
    const sc = scoreClear(c.rows.length, s.level, s.b2b);
    s.score += sc.points + (c.rows.length && s.combo ? 50 * s.combo * s.level : 0);
    if (c.rows.length) { s.b2b = sc.difficult; s.combo++; } else s.combo = 0;
    if (toppedOut(s.board)) s.over = true; else next();
    return c.rows.length;
  }
  const api = {
    state: s,
    move(dx) { if (s.over) return false; const m = tryMove(s.board, s.piece, dx, 0); if (m) { s.piece = m; s.lockT = 0; return true; } return false; },
    rotate(dir) { if (s.over) return false; const r = rotate(s.board, s.piece, dir); if (r) { s.piece = r; s.lockT = 0; return true; } return false; },
    soft(on) { s.soft = !!on; },
    hardDrop() { if (s.over) return 0; const y = dropY(s.board, s.piece); s.score += 2 * (y - s.piece.y); s.piece = { ...s.piece, y }; return lock(); },
    update(dt) {
      if (s.over) return;
      const g = s.soft ? Math.min(0.04, gravitySeconds(s.level)) : gravitySeconds(s.level);
      s.acc += dt;
      while (s.acc >= g && !s.over) {
        s.acc -= g;
        const m = tryMove(s.board, s.piece, 0, 1);
        if (m) { s.piece = m; s.lockT = 0; if (s.soft) s.score += 1; } else break;
      }
      if (!tryMove(s.board, s.piece, 0, 1)) { s.lockT += dt; if (s.lockT >= 0.5) lock(); }
    },
    /** For drawing: the board (visible rows) with the falling piece and its ghost, the next three pieces. */
    view() {
      const rows = [];
      for (let y = HIDDEN; y < TOTAL; y++) rows.push(s.board[y].slice());
      const ghost = [];
      const piece = [];
      if (!s.over) {
        const gy = dropY(s.board, s.piece);
        for (const [x, y] of cellsOf(s.piece, s.piece.rot, s.piece.x, gy)) if (y >= HIDDEN) ghost.push([x, y - HIDDEN]);
        for (const [x, y] of cellsOf(s.piece)) if (y >= HIDDEN) piece.push([x, y - HIDDEN]);
      }
      return { rows, piece, ghost, type: s.piece.type, next: bag.peek(3), score: s.score, lines: s.lines, level: s.level, over: s.over };
    },
  };
  void COLS; void TYPES;
  return api;
}

export function createRun2048({ seed = 1 } = {}) {
  const rng = mulberry32(seed);
  const nextId = idGen(1);
  const s = { cells: emptyBoard(), score: 0, over: false, won: false, moves: 0 };
  for (let i = 0; i < 2; i++) { const r = spawn2048(s.cells, rng, nextId); if (r) s.cells = r.cells; }
  return {
    state: s,
    move(dir) {
      if (s.over) return false;
      const r = move2048(s.cells, dir, nextId);
      if (!r.moved) return false;
      s.cells = r.cells; s.score += r.gained; s.moves++;
      const sp = spawn2048(s.cells, rng, nextId);
      if (sp) s.cells = sp.cells;
      if (maxTile(s.cells) >= 2048) s.won = true;
      if (!canMove(s.cells)) s.over = true;
      return true;
    },
    view() { return { values: toValues(s.cells), score: s.score, over: s.over, won: s.won, best: maxTile(s.cells) }; },
  };
}

// ── SNAKE (a night addition, [experimental]): the board is a grid, the snake eats peaches and grows, a wall or its own tail ends the run. Each 4 peaches the level goes up: more points, quicker steps. ──
export const SNAKE = { cols: 18, rows: 20 };
const SNAKE_DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
/** Seconds between two steps at a level: 0.17 at the start, quicker each level, never quicker than 0.07. */
export const snakeStep = (level) => Math.max(0.07, 0.17 - 0.012 * (level - 1));

export function createSnakeRun({ seed = 1, cols = SNAKE.cols, rows = SNAKE.rows } = {}) {
  const rng = mulberry32(seed);
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  const s = { snake: [[cx, cy], [cx, cy + 1], [cx, cy + 2]], dir: 'up', queue: [], food: null, score: 0, eaten: 0, level: 1, over: false, won: false, acc: 0, moves: 0 };
  function place() { // a free cell, picked by the seed (null when the whole board is the snake)
    const used = new Set(s.snake.map(([x, y]) => y * cols + x));
    const free = [];
    for (let i = 0; i < cols * rows; i++) if (!used.has(i)) free.push(i);
    if (!free.length) { s.food = null; return; }
    const k = free[Math.floor(rng() * free.length)];
    s.food = [k % cols, Math.floor(k / cols)];
  }
  place();
  const api = {
    state: s,
    /** Turns the snake ('up' | 'down' | 'left' | 'right'). A turn straight back is ignored; two quick taps between steps are both kept. */
    turn(dir) {
      if (s.over || !SNAKE_DIRS[dir]) return false;
      const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
      if (dir === last || dir === OPPOSITE[last] || s.queue.length >= 2) return false;
      s.queue.push(dir);
      return true;
    },
    /** One move. */
    step() {
      if (s.over) return;
      if (s.queue.length) s.dir = s.queue.shift();
      const [dx, dy] = SNAKE_DIRS[s.dir];
      const nx = s.snake[0][0] + dx;
      const ny = s.snake[0][1] + dy;
      const eating = !!s.food && nx === s.food[0] && ny === s.food[1];
      const body = eating ? s.snake : s.snake.slice(0, -1); // (the tail moves out of the way unless he is growing)
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || body.some(([x, y]) => x === nx && y === ny)) { s.over = true; return; }
      s.snake.unshift([nx, ny]);
      s.moves++;
      if (eating) {
        s.eaten++;
        s.level = 1 + Math.floor(s.eaten / 4);
        s.score += 10 * s.level;
        place();
        if (!s.food) { s.over = true; s.won = true; } // the board is full: a perfect game
      } else s.snake.pop();
    },
    update(dt) {
      if (s.over) return;
      s.acc += dt;
      const g = snakeStep(s.level);
      while (s.acc >= g && !s.over) { s.acc -= g; api.step(); }
    },
    /** For drawing and for tests. */
    view() { return { snake: s.snake.map((c) => c.slice()), head: s.snake[0].slice(), food: s.food ? s.food.slice() : null, dir: s.dir, score: s.score, length: s.snake.length, level: s.level, over: s.over, won: s.won, cols, rows }; },
  };
  return api;
}
