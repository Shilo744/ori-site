// "Ori, Can You...?" — SNAKE on the office computer (pure rules): the snake, the peaches, the turns, the walls, the levels, the full board.      node scripts/test-favors-snake.mjs
import assert from 'node:assert/strict';
import { createSnakeRun, snakeStep, SNAKE, GAMES, peachesFor } from '../src/game3d/favors/arcade.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const cellsOk = (v) => {
  const seen = new Set();
  for (const [x, y] of v.snake) { assert.ok(x >= 0 && y >= 0 && x < v.cols && y < v.rows, `out of the board (${x}, ${y})`); const k = `${x},${y}`; assert.ok(!seen.has(k), `the snake overlaps itself at ${k}`); seen.add(k); }
  if (v.food) assert.ok(!seen.has(`${v.food[0]},${v.food[1]}`), 'the peach is inside the snake');
};

test('SNAKE is the third game on the menu, marked as new, with its own payout', () => {
  assert.deepEqual(GAMES.map((g) => g.id), ['tetris', '2048', 'snake']);
  assert.equal(GAMES[2].fresh, true);
  assert.ok(peachesFor('snake', 0) === 2 && peachesFor('snake', 300) === 10 && peachesFor('snake', 99999) === 60, 'a little for a short run, a lot for a long one, never more than 60');
  assert.ok(peachesFor('snake', 600) > peachesFor('snake', 300));
  assert.equal(peachesFor('tetris', 1200), 10); assert.equal(peachesFor('2048', 800), 10); // (the other two are as they were)
});

test('a new run: three long, heading up from the middle, one peach on a free cell; the seed decides where', () => {
  const a = createSnakeRun({ seed: 5 }); const v = a.view();
  assert.equal(v.length, 3); assert.equal(v.dir, 'up'); assert.equal(v.score, 0); assert.equal(v.level, 1); assert.equal(v.over, false);
  assert.deepEqual(v.head, [SNAKE.cols / 2, SNAKE.rows / 2]);
  cellsOk(v);
  assert.deepEqual(createSnakeRun({ seed: 5 }).view().food, v.food, 'the same seed, the same peach');
  assert.ok(Array.from({ length: 12 }, (_, i) => createSnakeRun({ seed: i + 1 }).view().food.join(',')).some((f) => f !== v.food.join(',')), 'other seeds put it elsewhere');
});

test('a step moves one cell along the heading and the tail follows; the length does not change', () => {
  const a = createSnakeRun({ seed: 1 });
  a.state.food = [0, 0];
  const h0 = a.view().head;
  a.step();
  const v = a.view();
  assert.deepEqual(v.head, [h0[0], h0[1] - 1]);
  assert.equal(v.length, 3); assert.equal(a.state.moves, 1);
  cellsOk(v);
});

test('turns: never straight back, a repeat of the same turn is ignored, two quick turns between steps are both kept, the third waits', () => {
  const a = createSnakeRun({ seed: 1 });
  a.state.food = [0, 0];
  assert.equal(a.turn('down'), false, 'straight back');
  assert.equal(a.turn('up'), false, 'the way he is already going');
  assert.equal(a.turn('sideways'), false); assert.equal(a.turn(undefined), false);
  assert.equal(a.turn('left'), true);
  assert.equal(a.turn('down'), true, 'a second quick turn is queued');
  assert.equal(a.turn('right'), false, 'the queue holds two');
  a.step();
  assert.equal(a.view().dir, 'left');
  a.step();
  assert.equal(a.view().dir, 'down');
  assert.equal(a.turn('up'), false, 'back on himself while heading down');
  const w = createSnakeRun({ seed: 1 });
  assert.equal(w.turn('left'), true); assert.equal(w.turn('right'), false, 'left then straight back is not allowed in one go either');
});

test('eating a peach: one longer, 10 points x the level, a new peach on a free cell', () => {
  const a = createSnakeRun({ seed: 3 });
  const h = a.view().head;
  a.state.food = [h[0], h[1] - 1];
  a.step();
  const v = a.view();
  assert.equal(v.length, 4); assert.equal(v.score, 10); assert.equal(a.state.eaten, 1);
  cellsOk(v);
  assert.ok(v.food && !(v.food[0] === v.head[0] && v.food[1] === v.head[1]));
});

test('the levels: every four peaches, more points per peach and a quicker step, down to a floor', () => {
  const a = createSnakeRun({ seed: 4, cols: 40, rows: 40 });
  let score = 0;
  for (let i = 1; i <= 12; i++) {
    const h = a.view().head;
    a.state.food = [h[0], h[1] - 1];
    a.step();
    const level = 1 + Math.floor(i / 4);
    score += 10 * level;
    assert.equal(a.view().level, level, `after ${i} peaches`); assert.equal(a.view().score, score, `score after ${i}`);
  }
  assert.ok(snakeStep(1) === 0.17 && snakeStep(2) < snakeStep(1) && snakeStep(5) < snakeStep(2) && snakeStep(50) === 0.07, 'quicker, never below 0.07');
  for (let l = 1; l < 20; l++) assert.ok(snakeStep(l + 1) <= snakeStep(l));
});

test('a wall ends the run; so does the snake\'s own body; but the cell the tail is just leaving is free', () => {
  const a = createSnakeRun({ seed: 1 });
  a.state.food = [0, 0];
  for (let i = 0; i < 40 && !a.view().over; i++) a.step();
  assert.ok(a.view().over && !a.view().won);
  const moves = a.state.moves; a.step(); a.turn('left'); a.step();
  assert.equal(a.state.moves, moves, 'nothing moves after the end');
  // his own body: a tight turn on a long snake
  const b = createSnakeRun({ seed: 1, cols: 12, rows: 12 });
  b.state.snake = [[5, 5], [5, 6], [6, 6], [7, 6], [7, 5], [7, 4], [6, 4], [5, 4]]; // heading up from (5,6): the next cell (5,4) is the tail's: free as it leaves
  b.state.dir = 'up'; b.state.food = [0, 0];
  b.step();
  assert.equal(b.view().over, false, 'the tail cell is free');
  const c = createSnakeRun({ seed: 1, cols: 12, rows: 12 });
  c.state.snake = [[5, 5], [5, 6], [6, 6], [7, 6], [7, 5], [7, 4], [6, 4], [5, 4], [4, 4]]; // one longer: (5,4) is body that does not move away
  c.state.dir = 'up'; c.state.food = [0, 0];
  c.step();
  assert.equal(c.view().over, true, 'the body is not');
});

test('update(dt) takes the steps the time allows: one per interval, several for a long frame, none once over', () => {
  const a = createSnakeRun({ seed: 2 });
  a.state.food = [0, 0];
  a.update(0.1); assert.equal(a.state.moves, 0);
  a.update(0.08); assert.equal(a.state.moves, 1);
  a.update(0.6); assert.equal(a.state.moves, 4, `${a.state.moves} steps after 0.78 s`);
  for (let i = 0; i < 60; i++) a.update(0.2);
  assert.ok(a.view().over);
  const m = a.state.moves; a.update(5); assert.equal(a.state.moves, m);
});

test('a full board is a win: no free cell for another peach, the run is over and marked won', () => {
  const a = createSnakeRun({ seed: 1, cols: 3, rows: 6 });
  const seq = [];
  for (let y = 0; y < 6; y++) for (let k = 0; k < 3; k++) seq.push([y % 2 ? 2 - k : k, y]);
  a.state.snake = seq.slice(0, 17).reverse(); // the head is at (1, 5), the last free cell is (0, 5)
  a.state.dir = 'left'; a.state.food = [0, 5];
  a.step();
  const v = a.view();
  assert.ok(v.over && v.won && v.food === null && v.length === 18, `${v.over} ${v.won} ${v.length}`);
});

test('a steering bot plays 600 steps on many seeds: the board stays valid, the length is 3 + the peaches, the same seed gives the same game', () => {
  const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const play = (seed) => {
    const a = createSnakeRun({ seed });
    for (let i = 0; i < 600 && !a.view().over; i++) {
      const v = a.view();
      const free = (d) => { const [x, y] = [v.head[0] + dirs[d][0], v.head[1] + dirs[d][1]]; return x >= 0 && y >= 0 && x < v.cols && y < v.rows && !v.snake.slice(0, -1).some(([sx, sy]) => sx === x && sy === y); };
      const want = Object.keys(dirs).filter(free).sort((p, q) => Math.abs(v.head[0] + dirs[p][0] - v.food[0]) + Math.abs(v.head[1] + dirs[p][1] - v.food[1]) - (Math.abs(v.head[0] + dirs[q][0] - v.food[0]) + Math.abs(v.head[1] + dirs[q][1] - v.food[1])))[0];
      if (want) a.turn(want);
      a.step();
      cellsOk(a.view());
      assert.equal(a.view().length, 3 + a.state.eaten);
    }
    return a.view();
  };
  let ate = 0;
  for (let seed = 1; seed <= 40; seed++) { const v = play(seed); ate += v.length - 3; }
  assert.ok(ate > 40, `the bot eats (${ate} peaches in 40 runs)`);
  assert.deepEqual(play(9), play(9));
});

console.log(`${n} snake tests passed`);
