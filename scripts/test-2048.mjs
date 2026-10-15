// Unit tests for the 2048 rules (src/ui/games/g2048-logic.js). Run: node scripts/test-2048.mjs  (or npm run test:games)
import assert from 'node:assert/strict';
import { idGen, fromValues, toValues, move, spawn, canMove, maxTile, mergeFreq, lineIndices } from '../src/ui/games/g2048-logic.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
const board = (rows) => fromValues(rows.flat(), idGen(1));
const run = (rows, dir) => { const r = move(board(rows), dir, idGen(100)); return { ...r, values: toValues(r.cells) }; };
const line = (values, dir = 'left') => run([values, [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], dir);

console.log('2048 rules');

t('slides tiles to the wall', () => {
  assert.deepEqual(line([0, 0, 0, 2]).values.slice(0, 4), [2, 0, 0, 0]);
  assert.deepEqual(line([0, 2, 0, 4]).values.slice(0, 4), [2, 4, 0, 0]);
});

t('merges equal neighbours', () => {
  const r = line([2, 2, 0, 0]);
  assert.deepEqual(r.values.slice(0, 4), [4, 0, 0, 0]);
  assert.equal(r.gained, 4);
});

t('merges across gaps', () => {
  assert.deepEqual(line([2, 0, 0, 2]).values.slice(0, 4), [4, 0, 0, 0]);
  assert.deepEqual(line([4, 0, 2, 2]).values.slice(0, 4), [4, 4, 0, 0]);
});

t('a tile merges only once per move', () => {
  assert.deepEqual(line([2, 2, 2, 2]).values.slice(0, 4), [4, 4, 0, 0]);
  assert.deepEqual(line([2, 2, 4, 0]).values.slice(0, 4), [4, 4, 0, 0]);
  assert.deepEqual(line([4, 2, 2, 0]).values.slice(0, 4), [4, 4, 0, 0]);
  assert.deepEqual(line([2, 2, 2, 0]).values.slice(0, 4), [4, 2, 0, 0]);
  assert.deepEqual(line([2, 4, 2, 2]).values.slice(0, 4), [2, 4, 4, 0]);
  assert.deepEqual(line([8, 8, 8, 8]).values.slice(0, 4), [16, 16, 0, 0]);
});

t('the merge nearest the wall wins when three equal tiles line up', () => {
  const r = line([2, 2, 2, 0], 'right');
  assert.deepEqual(r.values.slice(0, 4), [0, 0, 2, 4]);
});

t('all four directions are consistent (a rotated board gives a rotated result)', () => {
  const rows = [[2, 2, 0, 0], [0, 4, 4, 0], [2, 0, 0, 2], [0, 0, 0, 8]];
  assert.deepEqual(run(rows, 'left').values, [4, 0, 0, 0, 8, 0, 0, 0, 4, 0, 0, 0, 8, 0, 0, 0]);
  assert.deepEqual(run(rows, 'right').values, [0, 0, 0, 4, 0, 0, 0, 8, 0, 0, 0, 4, 0, 0, 0, 8]);
  assert.deepEqual(run(rows, 'up').values, [4, 2, 4, 2, 0, 4, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(run(rows, 'down').values, [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 4, 4, 4, 8]);
});

t('score gained equals the sum of the created tiles', () => {
  const r = run([[2, 2, 4, 4], [8, 8, 8, 8], [0, 0, 0, 0], [16, 0, 16, 0]], 'left');
  assert.equal(r.gained, 4 + 8 + 16 + 16 + 32);
  assert.equal(r.merged.length, 5);
});

t('moved is false when nothing changes (no spawn must follow)', () => {
  assert.equal(line([2, 4, 8, 16]).moved, false);
  assert.equal(line([2, 0, 0, 0]).moved, false);
  assert.equal(line([0, 0, 0, 2]).moved, true);
  assert.equal(run([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]], 'up').moved, false);
});

t('tiles keep their id while sliding; merges create a new id and report both sources', () => {
  const cells = board([[2, 0, 2, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  const ids = cells.filter(Boolean).map((c) => c.id);
  const r = move(cells, 'left', idGen(100));
  assert.equal(r.travel.length, 3, 'every old tile travels');
  assert.deepEqual(new Set(r.travel.map((x) => x.id)), new Set(ids));
  assert.equal(r.merged.length, 1);
  assert.deepEqual(new Set(r.merged[0].from), new Set([ids[0], ids[1]]));
  assert.ok(!ids.includes(r.merged[0].id), 'merged tile is new');
  const survivor = r.cells[1];
  assert.equal(survivor.id, ids[2], 'the unmerged 4 slides to column 1 keeping its id');
  assert.deepEqual(r.travel.find((x) => x.id === ids[2]), { id: ids[2], from: 3, to: 1 });
});

t('line index order matches the direction of travel', () => {
  assert.deepEqual(lineIndices('left', 1), [4, 5, 6, 7]);
  assert.deepEqual(lineIndices('right', 1), [7, 6, 5, 4]);
  assert.deepEqual(lineIndices('up', 2), [2, 6, 10, 14]);
  assert.deepEqual(lineIndices('down', 2), [14, 10, 6, 2]);
});

t('spawn picks an empty cell, 90% twos / 10% fours, and never overwrites', () => {
  let seed = 7;
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let twos = 0, fours = 0;
  for (let i = 0; i < 2000; i++) {
    const cells = fromValues([2, 4, 0, 8, 0, 0, 16, 0, 0, 32, 0, 0, 0, 0, 64, 0]);
    const empties = cells.map((c, j) => (c ? -1 : j)).filter((j) => j >= 0);
    const s = spawn(cells, rng, idGen(9000));
    assert.ok(empties.includes(s.spawned.idx));
    assert.equal(cells[s.spawned.idx], null, 'input board is not mutated');
    assert.equal(s.cells.filter(Boolean).length, cells.filter(Boolean).length + 1);
    if (s.spawned.v === 2) twos++; else { assert.equal(s.spawned.v, 4); fours++; }
  }
  assert.ok(twos > 1600 && twos < 1950, `about 90% twos (got ${twos})`);
  assert.ok(fours > 50, 'some fours');
  assert.equal(spawn(fromValues(Array(16).fill(2))), null, 'a full board cannot spawn');
});

t('game over: a full board with no equal neighbours', () => {
  const dead = board([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]);
  assert.equal(canMove(dead), false);
  for (const d of ['left', 'right', 'up', 'down']) assert.equal(move(dead, d).moved, false);
});

t('not over: an empty cell, or an equal pair (horizontal / vertical)', () => {
  assert.equal(canMove(board([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 0]])), true);
  assert.equal(canMove(board([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 2, 4]])), true);
  assert.equal(canMove(board([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 4, 2], [4, 2, 4, 4]])), true);
  assert.equal(canMove(board([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]].map((r, i) => (i === 3 ? [2, 2, 4, 2] : r)))), true);
});

t('win detection: the 2048 tile is reported by maxTile', () => {
  assert.equal(maxTile(board([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])), 1024);
  const r = run([[1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'left');
  assert.equal(maxTile(r.cells), 2048);
  assert.equal(r.gained, 2048);
});

t('merge pitch rises with the tile value', () => {
  let prev = 0;
  for (const v of [4, 8, 16, 32, 64, 128, 256, 512, 1024]) {
    const f = mergeFreq(v);
    assert.ok(f > prev, `${v} should be higher than the previous merge`);
    prev = f;
  }
  assert.ok(mergeFreq(1 << 20) <= 2093, 'capped');
});

t('long random game: board stays consistent (tile count, sum, ids unique)', () => {
  let seed = 12345;
  const rng = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  const nextId = idGen(1);
  let cells = fromValues(Array(16).fill(0), nextId);
  cells = spawn(spawn(cells, rng, nextId).cells, rng, nextId).cells;
  let score = 0, moves = 0;
  const dirs = ['left', 'up', 'right', 'down'];
  while (canMove(cells) && moves < 3000) {
    const before = toValues(cells).reduce((a, b) => a + b, 0);
    const r = move(cells, dirs[Math.floor(rng() * 4)], nextId);
    if (!r.moved) { moves++; continue; }
    const after = toValues(r.cells).reduce((a, b) => a + b, 0);
    assert.equal(after, before, 'merging never changes the total of tile values');
    const ids = r.cells.filter(Boolean).map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, 'ids stay unique');
    score += r.gained;
    cells = spawn(r.cells, rng, nextId).cells;
    moves++;
  }
  assert.ok(score > 100, 'the random game scored');
  assert.equal(canMove(cells), false, 'it ends in a real game over');
});

console.log(`\n${passed} tests passed`);
