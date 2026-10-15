// End-to-end gameplay check for Snake (keyboard only, like a player). Screenshots go to shots/smoke/.
import { join } from 'node:path';
import { SHOTS, sleep, snap } from './harness.mjs';

export async function runSnake(session, { ok, fail }) {
  const { page } = session;
  const tag = `${session.width}x${session.height}`;
  const check = (cond, msg) => (cond ? ok(`snake: ${msg}`) : fail(`snake: ${msg}`));
  const ov = () => page.evaluate(() => {
    const o = document.querySelector('.win-snake .gk-ov');
    return o && !o.hidden ? o.querySelector('.gk-kicker').textContent.toLowerCase() : '';
  });
  const hud = (id) => page.evaluate((i) => document.querySelector(`.win-snake .gk-pill[data-id="${i}"] b`)?.textContent, id);
  const waitFor = (fn, arg, timeout = 90000) => page.waitForFunction(fn, arg, { timeout });
  const shot = (name) => snap(session, join(SHOTS, 'smoke', `${tag}-game-snake-${name}.png`));

  await page.evaluate(() => { window.__ori.desktop.reset(); window.__ori.openApp('snake'); });
  await sleep(500);
  check((await ov()) === 'arcade', 'start overlay is shown');
  await shot('ready');

  // Enter starts; arrows steer; the page must not scroll and arrows must be consumed
  await page.keyboard.press('Enter');
  await sleep(200);
  check((await ov()) === '', 'Enter starts the run (overlay hidden)');
  const consumed = await page.evaluate(() => {
    const out = [];
    for (const key of ['ArrowDown', 'ArrowUp', 'Space']) {
      const ev = new KeyboardEvent('keydown', { key, code: key === 'Space' ? 'Space' : key, bubbles: true, cancelable: true });
      window.dispatchEvent(ev);
      out.push(ev.defaultPrevented);
    }
    return out;
  });
  // the Space above paused the game; resume it
  check(consumed.every(Boolean), 'arrows / Space are consumed (no page scroll)');
  check((await ov()) === 'paused', 'Space pauses a running game');
  await page.keyboard.press('KeyP');
  await sleep(150);
  check((await ov()) === '', 'P resumes');

  // autopilot: steer toward the food like a player would, until a few apples are eaten
  const dbg = () => page.evaluate(() => {
    const d = document.querySelector('.win-snake .wm-body').__debug;
    return { state: d.state, score: d.score, food: d.food, head: d.head, dir: d.dir, len: d.length };
  });
  const keyFor = (dx, dy) => (dx === 1 ? 'ArrowRight' : dx === -1 ? 'ArrowLeft' : dy === 1 ? 'ArrowDown' : 'ArrowUp');
  const t0 = Date.now();
  let target = 4;
  while (Date.now() - t0 < 60000) {
    const d = await dbg();
    if (d.state !== 'playing') break;
    if (d.score >= target) break;
    const dx = Math.sign(d.food.x - d.head.x), dy = Math.sign(d.food.y - d.head.y);
    const want = d.dir[0] === 0 ? (dx !== 0 ? [dx, 0] : [0, dy]) : (dy !== 0 ? [0, dy] : [dx, 0]);
    if (want[0] !== d.dir[0] || want[1] !== d.dir[1]) {
      if (!(want[0] === -d.dir[0] && want[1] === -d.dir[1])) await page.keyboard.press(keyFor(...want));
    }
    await sleep(90);
  }
  const eaten = await dbg();
  check(eaten.score >= 1, `the snake eats food and scores (score ${eaten.score}, length ${eaten.len})`);
  check((await hud('score')) === String(eaten.score), 'HUD score follows the game');
  // freeze the run for a clean mid-game screenshot (overlay hidden just for the picture)
  await page.keyboard.press('KeyP');
  await sleep(150);
  await page.evaluate(() => { document.querySelector('.win-snake .gk-ov').style.visibility = 'hidden'; });
  await shot('play');
  await page.evaluate(() => { document.querySelector('.win-snake .gk-ov').style.visibility = ''; });
  await page.keyboard.press('Space');
  await sleep(150);

  // Esc pauses (and does not leave the screen) …
  await page.keyboard.press('Escape');
  await sleep(150);
  check((await ov()) === 'paused', 'Esc pauses the run');
  check(await page.evaluate(() => window.__ori.state === 'screen' || window.__ori.state === 'flat'), 'Esc did not leave the screen while a run was active');
  await shot('paused');
  await page.keyboard.press('Space');
  await sleep(150);

  // inactive window → paused; no input leaks to the game
  await page.evaluate(() => window.__ori.openApp('finder'));
  await sleep(200);
  check((await ov()) === 'paused', 'a window that loses focus pauses itself');
  const before = await hud('score');
  await page.keyboard.press('ArrowDown');
  check((await hud('score')) === before && (await ov()) === 'paused', 'keys do not reach an unfocused game');
  await page.evaluate(() => window.__ori.openApp('snake'));
  await sleep(200);
  check((await ov()) === 'paused', 'refocusing keeps it paused until you resume');
  await page.keyboard.press('Space');
  await sleep(150);
  check((await ov()) === '', 'Space resumes after refocus');

  // camera leaves the screen → paused, loop stopped
  await page.evaluate(() => window.__ori.desktop.setLocked(true));
  await sleep(100);
  check((await ov()) === 'paused', 'locking the desktop (camera off the screen) pauses');
  await page.evaluate(() => window.__ori.desktop.setLocked(false));
  await sleep(100);
  check((await ov()) === 'paused', 'unlocking leaves the game paused');
  await page.keyboard.press('Space');

  // run into the wall → game over, score recorded, Enter restarts
  await waitFor(() => { const o = document.querySelector('.win-snake .gk-ov'); return o && !o.hidden && /game over/i.test(o.querySelector('.gk-kicker').textContent); });
  check(true, 'running into a wall ends the run');
  await sleep(300);
  await shot('over');
  const stored = await page.evaluate(() => window.__ori.core.storage.get('scores:snake'));
  check(!!stored && stored.plays >= 1 && Array.isArray(stored.runs) && stored.runs.length >= 1, 'run recorded in the hi-score store');
  check((await hud('best')) === String(stored.best), 'HUD shows the stored best');
  await page.keyboard.press('Enter');
  await sleep(250);
  check((await ov()) === '' && (await hud('score')) === '0', 'Enter restarts from game over');

  // achievement is defined and tracks the score
  check(await page.evaluate(() => { const a = window.__ori.core.achievements.list().find((x) => x.id === 'hungry'); return !!a && a.goal === 25; }), '"Hungry" achievement (score 25) is registered');

  // wrap mode toggle (only between runs)
  await page.evaluate(() => window.__ori.desktop.reset());
  await page.evaluate(() => window.__ori.openApp('snake'));
  await sleep(300);
  await page.evaluate(() => document.querySelector('.win-snake .gk-toggle').click());
  check((await page.evaluate(() => document.querySelector('.win-snake .gk-toggle b').textContent)) === 'WRAP', 'mode pill toggles Walls → Wrap');
  await page.evaluate(() => document.querySelector('.win-snake .gk-toggle').click());
  await page.evaluate(() => window.__ori.desktop.reset());
}
