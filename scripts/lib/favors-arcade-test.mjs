// "Ori, Can You...?" the office computer's third game, SNAKE (T21, [experimental]), browser checks: it is on the menu (key 3), it is played with the real keys, a run ends, pays peaches,
// is written down as a best score and shows on the journal's career page.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';

export async function runFavorsArcade(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`arcade: ${msg}`) : fail(`arcade: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const S = () => g(() => window.__ori.game3d.state());

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.setHour(12); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); });
  await g(() => window.__ori.game3d.teleport('startup'));
  await sleep(300);
  await page.keyboard.press('KeyG');
  await page.waitForFunction(() => window.__ori.game3d.insideId() === 'startup', null, { timeout: 5000 });
  await sleep(700);
  const room = await g(() => window.__ori.game3d.insideInfo());
  const pc = room.spots.find((p) => p.use === 'arcade');
  await g((p) => window.__ori.game3d.teleport({ x: p.x, z: p.z + 1.1 }, Math.PI), pc);
  await sleep(500);
  const p0 = (await S()).peaches;
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__ori.game3d.game.arcade.isOpen, null, { timeout: 3000 });
  await page.keyboard.press('Space'); // (skips the boot screen)
  await page.waitForFunction(() => window.__ori.game3d.game.arcade.mode === 'menu', null, { timeout: 6000 });
  await sleep(200);
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T21-arcade-menu.png') });
  await page.keyboard.press('Digit3');
  await page.waitForFunction(() => window.__ori.game3d.game.arcade.mode === 'snake', null, { timeout: 3000 });
  check(true, 'key 3 on the menu starts SNAKE (the third game)');

  // ── played with the real keys by a greedy bot: it eats peaches ──
  const steer = () => g(() => {
    const v = window.__ori.game3d.game.arcade.run.view();
    if (v.over || !v.food) return null;
    const D = { KeyW: [0, -1, 'up'], KeyS: [0, 1, 'down'], KeyA: [-1, 0, 'left'], KeyD: [1, 0, 'right'] };
    const back = { up: 'down', down: 'up', left: 'right', right: 'left' }[v.dir];
    const free = ([x, y]) => x >= 0 && y >= 0 && x < v.cols && y < v.rows && !v.snake.slice(0, -1).some(([sx, sy]) => sx === x && sy === y);
    const opts = Object.entries(D).filter(([, [dx, dy, name]]) => name !== back && free([v.head[0] + dx, v.head[1] + dy]));
    opts.sort((a, b) => (Math.abs(v.head[0] + a[1][0] - v.food[0]) + Math.abs(v.head[1] + a[1][1] - v.food[1])) - (Math.abs(v.head[0] + b[1][0] - v.food[0]) + Math.abs(v.head[1] + b[1][1] - v.food[1])));
    return opts.length ? opts[0][0] : null;
  });
  const t0 = Date.now();
  while (Date.now() - t0 < 9000) {
    const k = await steer();
    if (k) await page.keyboard.press(k);
    await sleep(70);
    if ((await g(() => window.__ori.game3d.game.arcade.run.view().score)) >= 30) break;
  }
  const mid = await g(() => window.__ori.game3d.game.arcade.run.view());
  check(mid.score >= 10 && mid.length > 3, `the snake eats: ${mid.score} points, ${mid.length} long, level ${mid.level}`);
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T21-arcade-snake.png') });

  // ── then it runs into the wall: the run ends, pays peaches, is the best score ──
  const wall = await g(() => window.__ori.game3d.game.arcade.run.view().dir);
  const to = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' }[wall];
  for (let i = 0; i < 80 && !(await g(() => window.__ori.game3d.game.arcade.run.view().over)); i++) { await page.keyboard.press(to); await sleep(150); }
  await sleep(800);
  const o = await S();
  check(o.peaches > p0 && o.progress.arcade === 1 && o.progress.best && o.progress.best.snake >= 10, `the run ended: +${o.peaches - p0} peaches, best SNAKE ${o.progress.best && o.progress.best.snake}`);
  await page.keyboard.press('Escape'); await sleep(250);
  await page.keyboard.press('Escape'); await sleep(250);
  check(!(await g(() => window.__ori.game3d.game.arcade.isOpen)), 'Esc, Esc: the computer is off again');

  // ── and the journal's career page says so ──
  await page.keyboard.press('Tab');
  await sleep(300);
  const career = await g(() => Object.fromEntries([...document.querySelectorAll('.jr-career li')].map((li) => [li.querySelector('small').textContent, li.querySelector('b').textContent])));
  check(/SNAKE \d+/.test(career['Arcade bests'] || ''), `the career page lists it ("${career['Arcade bests']}")`);
  await page.keyboard.press('Escape');
  await sleep(200);
}
