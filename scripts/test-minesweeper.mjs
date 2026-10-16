// Minesweeper rules (pure logic).
import assert from 'node:assert/strict';
import * as M from '../src/ui/games/minesweeper-logic.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const layout = (cols, rows, rowsStr) => { // '.' empty, '*' mine
  const b = M.createBoard(cols, rows, 0);
  const mines = [];
  rowsStr.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '*') mines.push(y * cols + x); }));
  M.loadMines(b, mines);
  return b;
};

test('difficulties: 9x9/10, 16x16/40, 30x16/99', () => {
  const d = M.DIFFICULTIES;
  assert.deepEqual([d.beginner.cols, d.beginner.rows, d.beginner.mines], [9, 9, 10]);
  assert.deepEqual([d.intermediate.cols, d.intermediate.rows, d.intermediate.mines], [16, 16, 40]);
  assert.deepEqual([d.expert.cols, d.expert.rows, d.expert.mines], [30, 16, 99]);
});
test('neighbour lists: corners 3, edges 5, interior 8, and symmetric', () => {
  const b = M.createBoard(5, 4, 3);
  assert.equal(b.nb[0].length, 3);
  assert.equal(b.nb[2].length, 5);
  assert.equal(b.nb[7].length, 8);
  assert.equal(b.nb[19].length, 3);
  for (let i = 0; i < b.n; i++) for (const j of b.nb[i]) assert.ok(b.nb[j].includes(i));
});
test('mines are placed exactly and the counts match a brute-force recount', () => {
  for (const d of Object.values(M.DIFFICULTIES)) {
    const b = M.boardFor(d);
    M.placeMines(b, 0, M.mulberry32(5));
    assert.equal(M.minesAt(b).length, d.mines);
    for (let i = 0; i < b.n; i++) {
      let c = 0;
      const x = i % b.cols, y = Math.floor(i / b.cols);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && x + dx >= 0 && y + dy >= 0 && x + dx < b.cols && y + dy < b.rows) c += b.mine[(y + dy) * b.cols + x + dx];
      }
      assert.equal(b.count[i], c);
    }
  }
});
test('the first click is never a mine and always opens an area (200 seeds, corners / edge / centre, every level)', () => {
  for (const d of Object.values(M.DIFFICULTIES)) {
    for (let seed = 1; seed <= 200; seed++) {
      const b = M.boardFor(d);
      const click = [0, d.cols - 1, b.n - 1, Math.floor(b.n / 2), seed % b.n][seed % 5];
      const r = M.reveal(b, click, M.mulberry32(seed));
      assert.equal(r.mine, -1, `${d.id} seed ${seed}`);
      assert.equal(b.mine[click], 0);
      assert.equal(b.count[click], 0, 'the whole neighbourhood is mine-free, so the first click opens an area');
      assert.ok(r.opened.length >= 4);
    }
  }
});
test('very crowded boards still keep the clicked cell safe; impossible ones throw', () => {
  const b = M.createBoard(3, 3, 8);
  M.reveal(b, 4, M.mulberry32(1));
  assert.equal(b.mine[4], 0);
  assert.equal(M.minesAt(b).length, 8);
  const over = M.createBoard(2, 2, 3);
  over.minesTotal = 4;
  assert.throws(() => M.placeMines(over, 0), /too many/);
});
test('flood fill opens the connected zero region plus its numbered border (a number walled in by mines stays closed)', () => {
  const b = layout(6, 4, ['......', '......', '.....*', '......']);
  const r = M.reveal(b, 0);
  assert.equal(b.opened, 22);
  assert.equal(r.opened.length, 22);
  assert.equal(b.st[17], M.HIDDEN, 'the mine stays hidden');
  assert.equal(b.st[23], M.HIDDEN, 'the corner under the mine touches no zero, so the flood cannot reach it');
  assert.equal(M.isWon(b), false);
  M.reveal(b, 23);
  assert.ok(M.isWon(b));
});
test('BFS depth: 0 for the clicked cell, never decreasing afterwards', () => {
  const b = layout(8, 8, ['........', '........', '........', '........', '........', '........', '........', '.......*']);
  const r = M.reveal(b, 0);
  assert.equal(r.opened[0].d, 0);
  for (let k = 1; k < r.opened.length; k++) assert.ok(r.opened[k].d >= r.opened[k - 1].d && r.opened[k].d >= 1);
  assert.ok(r.opened.at(-1).d >= 7);
});
test('numbers stop the flood; a flag blocks it too', () => {
  const b = layout(5, 1, ['..*..']);
  M.reveal(b, 0);
  assert.deepEqual([...b.st], [1, 1, 0, 0, 0]);
  const c = layout(5, 1, ['....*']);
  M.toggleFlag(c, 1);
  M.reveal(c, 0);
  assert.equal(c.st[0], M.OPEN);
  assert.equal(c.st[1], M.FLAG);
  assert.equal(c.st[2], M.HIDDEN);
});
test('revealing a mine reports it; flagged cells are protected; open cells are inert', () => {
  const b = layout(3, 3, ['...', '.*.', '...']);
  M.toggleFlag(b, 4);
  assert.deepEqual(M.reveal(b, 4).opened, []);
  M.toggleFlag(b, 4);
  const hit = M.reveal(b, 4);
  assert.equal(hit.mine, 4);
  assert.equal(M.reveal(b, 4).opened.length, 0);
});
test('flags toggle, count down the mine counter and only work on hidden cells', () => {
  const b = layout(3, 3, ['*..', '...', '...']);
  assert.equal(M.minesLeft(b), 1);
  assert.ok(M.toggleFlag(b, 0));
  assert.equal(M.minesLeft(b), 0);
  assert.ok(M.toggleFlag(b, 0));
  assert.equal(M.minesLeft(b), 1);
  M.toggleFlag(b, 1);
  M.toggleFlag(b, 2);
  assert.equal(M.minesLeft(b), -1, 'over-flagging goes negative, like the original');
  M.reveal(b, 8);
  assert.equal(M.toggleFlag(b, 8), false, 'an open cell cannot be flagged');
});
test('chording: needs matching flags, opens the rest, and detonates on a wrong flag', () => {
  const b = layout(3, 3, ['*..', '...', '...']);
  M.reveal(b, 4);
  assert.equal(b.count[4], 1);
  assert.equal(M.chord(b, 4).opened.length, 0, 'no flag yet');
  M.toggleFlag(b, 0);
  const r = M.chord(b, 4);
  assert.equal(r.mine, -1);
  assert.ok(b.st.every((s, i) => (i === 0 ? s === M.FLAG : s === M.OPEN)));
  assert.ok(M.isWon(b));
  const c = layout(3, 3, ['*..', '...', '...']);
  M.reveal(c, 4);
  M.toggleFlag(c, 1); // the wrong cell
  const r2 = M.chord(c, 4);
  assert.deepEqual(r2.hits, [0]);
  assert.equal(r2.mine, 0);
  assert.deepEqual(M.wrongFlags(c), [1]);
});
test('win detection', () => {
  const b = layout(2, 2, ['*.', '..']);
  assert.equal(M.isWon(b), false);
  M.reveal(b, 1);
  M.reveal(b, 2);
  assert.equal(M.isWon(b), false);
  M.reveal(b, 3);
  assert.ok(M.isWon(b));
});
test('formatTime', () => {
  assert.equal(M.formatTime(42.34), '42.3s');
  assert.equal(M.formatTime(61.5), '1:01.5');
  assert.equal(M.formatTime(600), '10:00.0');
  assert.equal(M.formatTime(null), '—');
});
test('mulberry32 is deterministic', () => {
  const a = M.mulberry32(9), b = M.mulberry32(9);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
});

console.log(`${n} minesweeper tests passed`);
