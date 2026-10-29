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
];

/** How many peaches a score is worth (a good run pays well, a tiny run pays a little, nobody pays nothing). */
export const peachesFor = (game, score) => Math.max(2, Math.min(60, Math.floor(game === 'tetris' ? score / 120 : score / 80)));

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
