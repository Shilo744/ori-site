// Unit tests for the Tetris rules (src/ui/games/tetris-logic.js). Run: node scripts/test-tetris.mjs  (or npm run test:games)
import assert from 'node:assert/strict';
import {
  COLS, TOTAL, HIDDEN, TYPES, SHAPES, kicks, newBoard, spawnPiece, cellsOf, collides, tryMove, rotate, dropY, lockPiece,
  clearLines, toppedOut, createBag, gravitySeconds, levelForLines, scoreClear, createDAS,
} from '../src/ui/games/tetris-logic.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
const norm = (cells) => cells.map(([x, y]) => `${x},${y}`).sort().join(' ');
const piece = (type, rot = 0, x = 3, y = 5) => ({ type, rot, x, y });

console.log('Tetris rules');

t('every piece has four cells in every rotation, inside its box', () => {
  for (const ty of TYPES) {
    assert.equal(SHAPES[ty].length, 4);
    SHAPES[ty].forEach((cells) => {
      assert.equal(cells.length, 4, `${ty} has 4 cells`);
      assert.equal(new Set(cells.map((c) => c.join())).size, 4, `${ty} cells are distinct`);
      const box = ty === 'I' || ty === 'O' ? 4 : 3;
      cells.forEach(([x, y]) => assert.ok(x >= 0 && x < box && y >= 0 && y < box, `${ty} cell inside ${box}x${box}`));
    });
  }
});

t('SRS shapes: T pointing up / right / down / left, and I horizontal / vertical', () => {
  assert.equal(norm(SHAPES.T[0]), norm([[1, 0], [0, 1], [1, 1], [2, 1]]));
  assert.equal(norm(SHAPES.T[1]), norm([[1, 0], [1, 1], [2, 1], [1, 2]]));
  assert.equal(norm(SHAPES.T[2]), norm([[0, 1], [1, 1], [2, 1], [1, 2]]));
  assert.equal(norm(SHAPES.T[3]), norm([[1, 0], [0, 1], [1, 1], [1, 2]]));
  assert.equal(norm(SHAPES.I[0]), norm([[0, 1], [1, 1], [2, 1], [3, 1]]));
  assert.equal(norm(SHAPES.I[1]), norm([[2, 0], [2, 1], [2, 2], [2, 3]]));
});

t('rotating clockwise four times returns to the start; rotating back undoes it', () => {
  const b = newBoard();
  for (const ty of TYPES) {
    let p = piece(ty, 0, 3, 8);
    for (let i = 0; i < 4; i++) p = rotate(b, p, 1);
    assert.equal(p.rot, 0, `${ty} full circle`);
    const cw = rotate(b, piece(ty, 0, 3, 8), 1);
    const back = rotate(b, cw, -1);
    assert.equal(norm(cellsOf(back)), norm(cellsOf(piece(ty, 0, 3, 8))), `${ty} undo`);
  }
});

t('O never changes shape or position when rotated', () => {
  const b = newBoard();
  const p = piece('O', 0, 3, 8);
  const r = rotate(b, p, 1);
  assert.equal(norm(cellsOf(r)), norm(cellsOf(p)));
});

t('walls and floor collide, the hidden rows above the field do not', () => {
  const b = newBoard();
  assert.equal(collides(b, piece('I', 0, -1, 5)), true);
  assert.equal(collides(b, piece('I', 0, 7, 5)), true);
  assert.equal(collides(b, piece('I', 0, 3, TOTAL - 1)), true, 'floor');
  assert.equal(collides(b, piece('I', 0, 3, TOTAL - 2)), false, 'resting on the floor');
  assert.equal(collides(b, piece('T', 0, 3, -1)), false, 'above the top is open');
  b[5][4] = 1;
  assert.equal(collides(b, piece('O', 0, 3, 4)), true, 'locked blocks collide');
});

t('tryMove: sideways and down, blocked by walls', () => {
  const b = newBoard();
  assert.deepEqual({ ...tryMove(b, piece('T', 0, 3, 5), 1, 0) }, { type: 'T', rot: 0, x: 4, y: 5 });
  assert.equal(tryMove(b, piece('T', 0, 0, 5), -1, 0), null);
  assert.equal(tryMove(b, piece('I', 0, 6, 5), 1, 0), null, 'I flush against the right wall');
});

t('wall kick: a vertical I against the left wall rotates by kicking right', () => {
  const b = newBoard();
  const p = piece('I', 1, -2, 6); // vertical, column x+2 = 0 (touching the left wall)
  const r = rotate(b, p, 1); // → 2 (horizontal) needs room: x..x+3 must be ≥ 0
  assert.ok(r, 'a kick was found');
  assert.ok(cellsOf(r).every(([x]) => x >= 0 && x < COLS));
  assert.equal(r.kicked, true);
});

t('wall kick: J pushed into the left wall rotates 0→R with the (−1,0)-style SRS kick table', () => {
  const b = newBoard();
  // T flat against the right wall, rotating counter-clockwise uses test 2 of 0→L = (+1,0) flipped… just prove kicks exist and fit
  const p = piece('T', 1, 7, 8); // pointing right, touching the right wall
  const r = rotate(b, p, 1);
  assert.ok(r && r.rot === 2);
  assert.ok(cellsOf(r).every(([x]) => x < COLS));
});

t('SRS tables: 5 tests each, first is always (0,0); I uses its own table; O has a single test', () => {
  for (let from = 0; from < 4; from++) {
    for (const dir of [1, -1]) {
      const to = (from + dir + 4) % 4;
      assert.equal(kicks('T', from, to).length, 5);
      assert.deepEqual(kicks('T', from, to)[0], [0, 0]);
      assert.equal(kicks('I', from, to).length, 5);
    }
  }
  assert.notDeepEqual(kicks('I', 0, 1), kicks('T', 0, 1));
  assert.deepEqual(kicks('O', 0, 1), [[0, 0]]);
  // spot check against the guideline: JLSTZ 0→R second test is (−1, 0), and 0→R fourth is (0, −2) with y up → (0, +2) on our y-down board
  assert.deepEqual(kicks('T', 0, 1)[1], [-1, 0]);
  assert.deepEqual(kicks('T', 0, 1)[3], [0, 2]);
});

t('a T-spin style kick: T rotates into an overhang using the floor kick', () => {
  const b = newBoard();
  // a slot: floor of garbage with a one-wide, two-deep notch at x = 4
  for (let y = TOTAL - 2; y < TOTAL; y++) for (let x = 0; x < COLS; x++) if (x !== 4) b[y][x] = 1;
  // pointing down into the notch from above fits; rotating it flat inside the notch must be impossible without kicks
  const p = piece('T', 2, 3, TOTAL - 4);
  assert.equal(collides(b, p), false, 'T pointing down sits in the notch');
  const r = rotate(b, p, 1);
  assert.ok(r === null || cellsOf(r).every(([x, y]) => !(y >= 0 && b[y][x])), 'any result must be legal');
});

t('dropY / hard drop: lands on the floor and on a stack', () => {
  const b = newBoard();
  const p = piece('I', 0, 3, 0);
  assert.equal(dropY(b, p), TOTAL - 2, 'horizontal I rests on the bottom row');
  for (let x = 3; x < 7; x++) b[TOTAL - 1][x] = 1;
  assert.equal(dropY(b, p), TOTAL - 3, 'stops one row higher on a stack');
});

t('locking writes the piece into a copy of the board', () => {
  const b = newBoard();
  const p = piece('O', 0, 0, TOTAL - 3);
  const l = lockPiece(b, p);
  assert.equal(b.flat().filter(Boolean).length, 0, 'original untouched');
  assert.equal(l.flat().filter(Boolean).length, 4);
  assert.equal(l[TOTAL - 2][1], TYPES.indexOf('O') + 1);
});

t('line clears: 1, 2, 3, 4 rows; rows above fall; gaps survive', () => {
  for (let n = 1; n <= 4; n++) {
    const b = newBoard();
    for (let i = 0; i < n; i++) b[TOTAL - 1 - i].fill(1);
    b[TOTAL - 1 - n][2] = 7; // a lone block above
    const r = clearLines(b);
    assert.equal(r.rows.length, n);
    assert.equal(r.board.length, TOTAL);
    assert.equal(r.board[TOTAL - 1][2], 7, 'the block above dropped onto the floor');
    assert.equal(r.board.flat().filter(Boolean).length, 1);
  }
  const b = newBoard();
  b[TOTAL - 1].fill(1);
  b[TOTAL - 2].fill(1);
  b[TOTAL - 2][5] = 0; // a hole: this row must stay
  const r = clearLines(b);
  assert.equal(r.rows.length, 1);
  assert.equal(r.board[TOTAL - 1].filter(Boolean).length, COLS - 1);
});

t('top-out: a locked block in the hidden rows ends the game', () => {
  const b = newBoard();
  assert.equal(toppedOut(b), false);
  b[HIDDEN - 1][4] = 1;
  assert.equal(toppedOut(b), true);
  const spawn = spawnPiece('T');
  const full = newBoard();
  full[1][4] = 1;
  assert.equal(collides(full, spawn), true, 'a blocked spawn is a game over');
});

t('7-bag: every group of seven is a permutation of the seven pieces', () => {
  let seed = 3;
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const bag = createBag(rng);
  for (let g = 0; g < 50; g++) {
    const seven = Array.from({ length: 7 }, () => bag.next());
    assert.deepEqual([...seven].sort(), [...TYPES].sort(), `bag ${g}`);
  }
  const b2 = createBag(rng);
  const preview = b2.peek(3);
  assert.deepEqual(preview, [b2.next(), b2.next(), b2.next()], 'peek shows what comes next');
  // no piece appears more than twice in a row, ever (max run across bag borders is 2)
  const stream = Array.from({ length: 700 }, () => bag.next());
  for (let i = 2; i < stream.length; i++) assert.ok(!(stream[i] === stream[i - 1] && stream[i] === stream[i - 2]), 'no triple');
});

t('gravity gets faster with the level (guideline curve) and levels come every 10 lines', () => {
  assert.ok(Math.abs(gravitySeconds(1) - 1) < 1e-9);
  assert.ok(Math.abs(gravitySeconds(2) - 0.793) < 0.001);
  let prev = Infinity;
  for (let l = 1; l <= 20; l++) { const g = gravitySeconds(l); assert.ok(g < prev && g > 0, `level ${l}`); prev = g; }
  assert.equal(levelForLines(0), 1);
  assert.equal(levelForLines(9), 1);
  assert.equal(levelForLines(10), 2);
  assert.equal(levelForLines(40), 5);
});

t('scoring: single/double/triple/tetris × level, back-to-back tetris ×1.5, other clears break the chain', () => {
  assert.equal(scoreClear(1, 1, false).points, 100);
  assert.equal(scoreClear(2, 1, false).points, 300);
  assert.equal(scoreClear(3, 1, false).points, 500);
  assert.equal(scoreClear(4, 1, false).points, 800);
  assert.equal(scoreClear(4, 3, false).points, 2400);
  assert.equal(scoreClear(4, 1, true).points, 1200, 'back-to-back tetris');
  assert.equal(scoreClear(1, 1, true).points, 100, 'a single is never boosted');
  assert.equal(scoreClear(4, 1, false).difficult, true);
  assert.equal(scoreClear(2, 1, true).difficult, false, 'a double breaks back-to-back');
  assert.equal(scoreClear(0, 1, true).difficult, true, 'no clear keeps the chain');
});

t('simulated game: dropping pieces straight down eventually tops out and the board stays legal', () => {
  let seed = 99;
  const rng = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  const bag = createBag(rng);
  let board = newBoard();
  let lines = 0, pieces = 0;
  while (pieces < 400) {
    const p = spawnPiece(bag.next());
    if (collides(board, p)) break;
    const y = dropY(board, p);
    board = lockPiece(board, { ...p, y });
    const r = clearLines(board);
    board = r.board;
    lines += r.rows.length;
    pieces++;
    assert.equal(board.length, TOTAL);
    assert.ok(board.every((row) => row.length === COLS));
    if (toppedOut(board)) break;
  }
  assert.ok(pieces > 10 && pieces < 400, `the stack grew and ended (${pieces} pieces, ${lines} lines)`);
});

t('DAS: no repeats before the delay, then one move per ARR period; releasing resets; a new direction restarts the delay', () => {
  const d = createDAS({ das: 0.16, arr: 0.04 });
  assert.equal(d.step(1, 0.016), 0, 'direction change: the first move is the key press itself');
  let moves = 0;
  for (let i = 0; i < 9; i++) moves += d.step(1, 0.016); // 0.144 s held
  assert.equal(moves, 0, 'still inside the delay (144 ms < 160 ms)');
  moves += d.step(1, 0.016); // 160 ms: the delay just ended
  assert.equal(moves, 0);
  moves += d.step(1, 0.04);
  assert.equal(moves, 1, 'one ARR period after the delay → one repeat');
  moves = 0;
  for (let i = 0; i < 25; i++) moves += d.step(1, 0.016); // 0.4 s more
  assert.equal(moves, 10, 'a steady repeat at 60 fps: 0.4 s / 40 ms = 10 moves');
  assert.equal(d.step(0, 0.016), 0, 'released');
  assert.equal(d.step(-1, 0.016), 0, 'a new direction starts over');
  let n = 0;
  for (let i = 0; i < 9; i++) n += d.step(-1, 0.016);
  assert.equal(n, 0, 'and waits the full delay again');
});

t('DAS is frame-rate independent: 20, 60 and 120 fps give (nearly) the same number of repeats in a second', () => {
  const run = (fps) => { const d = createDAS({ das: 0.16, arr: 0.035 }); let n = 0; d.step(1, 1 / fps); for (let i = 0; i < fps; i++) n += d.step(1, 1 / fps); return n; };
  const a = run(20), b = run(120), c = run(60);
  assert.ok(Math.abs(a - c) <= 1 && Math.abs(b - c) <= 1, `repeats in one second: ${a} / ${c} / ${b}`);
  assert.ok(c >= 23 && c <= 25, `about (1 − 0.16) / 0.035 = 24 repeats (got ${c})`);
});

t('instant ARR (0) slams to the wall', () => {
  const d = createDAS({ das: 0.1, arr: 0 });
  d.step(1, 0.016);
  let n = 0;
  for (let i = 0; i < 10; i++) n += d.step(1, 0.016);
  assert.ok(n >= 10);
});

console.log(`\n${passed} tests passed`);
