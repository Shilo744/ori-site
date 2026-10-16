// Tetris rules — pure functions (no DOM), unit-tested in node (scripts/test-tetris.mjs).
// Guideline-style: 10×20 visible field + 2 hidden rows on top, SRS rotation with wall kicks, 7-bag randomiser,
// hold, ghost, guideline gravity curve, line-clear scoring with back-to-back bonus.
export const COLS = 10;
export const ROWS = 20;
export const HIDDEN = 2;
export const TOTAL = ROWS + HIDDEN;
export const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

// four rotation states per piece (0, R, 2, L) as [x, y] cells inside the piece's box (I: 4×4, O: 4×4, others 3×3)
export const SHAPES = {
  I: [[[0, 1], [1, 1], [2, 1], [3, 1]], [[2, 0], [2, 1], [2, 2], [2, 3]], [[0, 2], [1, 2], [2, 2], [3, 2]], [[1, 0], [1, 1], [1, 2], [1, 3]]],
  O: Array(4).fill([[1, 0], [2, 0], [1, 1], [2, 1]]),
  T: [[[1, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [1, 2]], [[1, 0], [0, 1], [1, 1], [1, 2]]],
  S: [[[1, 0], [2, 0], [0, 1], [1, 1]], [[1, 0], [1, 1], [2, 1], [2, 2]], [[1, 1], [2, 1], [0, 2], [1, 2]], [[0, 0], [0, 1], [1, 1], [1, 2]]],
  Z: [[[0, 0], [1, 0], [1, 1], [2, 1]], [[2, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [1, 2], [2, 2]], [[1, 0], [0, 1], [1, 1], [0, 2]]],
  J: [[[0, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [2, 2]], [[1, 0], [1, 1], [0, 2], [1, 2]]],
  L: [[[2, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [1, 2], [2, 2]], [[0, 1], [1, 1], [2, 1], [0, 2]], [[0, 0], [1, 0], [1, 1], [1, 2]]],
};

// SRS wall-kick tests, written as in the guideline tables (x right, y UP); `kicks()` flips y for our y-down board.
const JLSTZ = {
  '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};
const IKICKS = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};
export function kicks(type, from, to) {
  if (type === 'O') return [[0, 0]];
  const table = type === 'I' ? IKICKS : JLSTZ;
  return table[`${from}>${to}`].map(([x, y]) => [x, y ? -y : 0]);
}

export const newBoard = () => Array.from({ length: TOTAL }, () => Array(COLS).fill(0));
export const cloneBoard = (b) => b.map((r) => r.slice());

/** A falling piece: { type, rot, x, y } — (x, y) is the top-left of its box on the board (y includes the hidden rows). */
export const spawnPiece = (type) => ({ type, rot: 0, x: 3, y: 0 });

export const cellsOf = (p, rot = p.rot, x = p.x, y = p.y) => SHAPES[p.type][rot].map(([cx, cy]) => [x + cx, y + cy]);

export function collides(board, p, rot = p.rot, x = p.x, y = p.y) {
  for (const [cx, cy] of cellsOf(p, rot, x, y)) {
    if (cx < 0 || cx >= COLS || cy >= TOTAL) return true;
    if (cy >= 0 && board[cy][cx]) return true;
  }
  return false;
}

/** Moves by (dx, dy) if free; returns the moved piece or null. */
export function tryMove(board, p, dx, dy) {
  return collides(board, p, p.rot, p.x + dx, p.y + dy) ? null : { ...p, x: p.x + dx, y: p.y + dy };
}

/** SRS rotation: dir = +1 clockwise, −1 counter-clockwise. Returns the rotated (and kicked) piece, or null if every kick fails. */
export function rotate(board, p, dir) {
  const to = (p.rot + dir + 4) % 4;
  for (const [kx, ky] of kicks(p.type, p.rot, to)) {
    if (!collides(board, p, to, p.x + kx, p.y + ky)) return { ...p, rot: to, x: p.x + kx, y: p.y + ky, kicked: kx !== 0 || ky !== 0 };
  }
  return null;
}

/** y where the piece would come to rest when dropped straight down. */
export function dropY(board, p) {
  let y = p.y;
  while (!collides(board, p, p.rot, p.x, y + 1)) y++;
  return y;
}

/** Writes the piece into a copy of the board (value = index+1 of its type for colouring). Returns the new board. */
export function lockPiece(board, p) {
  const b = cloneBoard(board);
  const v = TYPES.indexOf(p.type) + 1;
  for (const [cx, cy] of cellsOf(p)) if (cy >= 0 && cy < TOTAL) b[cy][cx] = v;
  return b;
}

/** Removes full rows. Returns { board, rows: [indices that were cleared (top→bottom)] }. */
export function clearLines(board) {
  const rows = [];
  board.forEach((r, i) => { if (r.every(Boolean)) rows.push(i); });
  if (!rows.length) return { board, rows };
  const kept = board.filter((_, i) => !rows.includes(i));
  const fresh = Array.from({ length: rows.length }, () => Array(COLS).fill(0));
  return { board: [...fresh, ...kept], rows };
}

/** True if any locked block sits in the hidden rows (game over: lock-out) */
export const toppedOut = (board) => board.slice(0, HIDDEN).some((r) => r.some(Boolean));

/** 7-bag randomiser: every 7 pieces are a shuffled permutation of all seven. */
export function createBag(rng = Math.random) {
  let queue = [];
  const refill = () => {
    const bag = TYPES.slice();
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    queue.push(...bag);
  };
  return {
    next() { if (queue.length < 2) refill(); return queue.shift(); },
    peek(n = 3) { while (queue.length < n + 1) refill(); return queue.slice(0, n); },
  };
}

/** Seconds per row of gravity at `level` (guideline curve). */
export const gravitySeconds = (level) => Math.pow(0.8 - (level - 1) * 0.007, level - 1);

export const levelForLines = (lines) => Math.floor(lines / 10) + 1;

const BASE = [0, 100, 300, 500, 800];
/**
 * Score for clearing `n` lines at `level`. Tetrises are "difficult"; a difficult clear straight after another gets ×1.5 (back-to-back).
 * Returns { points, difficult } — the caller keeps `b2b` (was the previous clear difficult?) and applies the combo bonus separately.
 */
export function scoreClear(n, level, b2b) {
  if (!n) return { points: 0, difficult: b2b };
  const difficult = n === 4;
  const pts = BASE[n] * level * (difficult && b2b ? 1.5 : 1);
  return { points: Math.round(pts), difficult };
}

/**
 * Delayed Auto Shift: the first move happens on key-down (done by the caller). Holding the key waits `das` seconds, then
 * repeats every `arr` seconds. `step(dir, dt)` returns how many extra moves to make this frame (dir: -1, 0, 1).
 */
export function createDAS({ das = 0.16, arr = 0.035 } = {}) {
  let dir = 0, t = 0, acc = 0;
  return {
    reset() { dir = 0; t = 0; acc = 0; },
    step(d, dt) {
      if (d !== dir) { dir = d; t = 0; acc = 0; return 0; }
      if (!dir) return 0;
      const prev = t;
      t += dt;
      if (t < das) return 0;
      if (arr <= 0) return 10; // instant: slam to the wall
      acc += prev >= das ? dt : t - das;
      const n = Math.floor(acc / arr);
      acc -= n * arr;
      return n;
    },
  };
}
