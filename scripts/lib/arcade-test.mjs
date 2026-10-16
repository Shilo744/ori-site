// Arcade launcher checks (T5): cards with real cover art + best score, real mouse click / keyboard to launch,
// tabs, leaderboard, achievements, terminal `games` / `play`. Needs the screen in an interactive state.
import { join } from 'node:path';
import { SHOTS, sleep, snap } from './harness.mjs';

export async function runArcade(session, { ok, fail }) {
  const { page } = session;
  const tag = `${session.width}x${session.height}`;
  const check = (cond, msg) => (cond ? ok(`arcade: ${msg}`) : fail(`arcade: ${msg}`));
  const flat = session.width < 860;
  const q = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);
  const text = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent?.replace(/\s+/g, ' ').trim() ?? null, sel);
  const clickCenter = async (sel) => {
    const r = await page.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, sel);
    await page.mouse.click(r.x, r.y);
  };

  await page.evaluate(() => {
    const { storage } = window.__ori.core;
    storage.remove('scores:snake');
    storage.remove('scores:snake:wrap');
    window.__ori.desktop.reset();
    window.__ori.openApp('arcade');
  });
  await sleep(500);
  check(await q('.win-arcade .arc-card[data-play="snake"]'), 'a card for every registered game (Snake)');
  check(await page.evaluate(() => {
    const cv = document.querySelector('.win-arcade .arc-card canvas.arc-cover');
    if (!cv) return false;
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let lit = 0;
    for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 240) lit++;
    return lit > 20; // neon snake pixels present: it is real artwork, not a blank canvas
  }), 'cover art is actually painted');
  check((await text('.win-arcade .arc-stats i:first-child')) === 'Best—', 'no score yet shows an em dash');
  check(/Little games/.test(await text('.win-arcade .arc-hero h1')), 'hero invites a first game when nothing was played');

  // seed a score and re-render through the real event path
  await page.evaluate(() => {
    const { storage, bus } = window.__ori.core;
    storage.set('scores:snake', { best: 31, plays: 7, last: Date.now() - 7200000, lowerIsBetter: false, runs: [{ score: 31, at: Date.now() - 7200000 }, { score: 12, at: Date.now() - 9000000 }] });
    bus.emit('game:score', { id: 'snake' });
  });
  await sleep(150);
  check(/^Best\s*31\s*Plays\s*7\s*Last\s*2h ago$/.test(await text('.win-arcade .arc-stats')), 'card shows best score, play count and last played');
  check(/Pick up\s*Snake/.test(await text('.win-arcade .arc-hero h1')) && (await text('.win-arcade .arc-hero .gk-primary')) === 'Continue playing', 'hero offers "Continue playing" for the last game');
  await snap(session, join(SHOTS, 'smoke', `${tag}-arcade-games.png`));

  // hover tilt uses offsetX/Y (3D mode, mouse only)
  if (!flat) {
    const r = await page.evaluate(() => { const b = document.querySelector('.win-arcade .arc-card').getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
    await page.mouse.move(r.x + r.w * 0.8, r.y + r.h * 0.3);
    await page.mouse.move(r.x + r.w * 0.85, r.y + r.h * 0.32);
    await sleep(300);
    const tilt = await page.evaluate(() => document.querySelector('.win-arcade .arc-card').style.getPropertyValue('--ry'));
    check(tilt !== '' && tilt !== '0deg', `hover tilts the card (--ry=${tilt})`);
  }

  // launch with a REAL click on the card
  await clickCenter('.win-arcade .arc-card[data-play="snake"]');
  await sleep(500);
  check(await q('.win-snake'), 'clicking a card opens the game window');
  await page.evaluate(() => window.__ori.desktop.reset());

  // launch with the keyboard (focus the card, Enter)
  await page.evaluate(() => { window.__ori.openApp('arcade'); });
  await sleep(400);
  await page.evaluate(() => document.querySelector('.win-arcade .arc-card').focus());
  await page.keyboard.press('Enter');
  await sleep(400);
  check(await q('.win-snake'), 'Enter on a focused card opens the game (keyboard accessible)');

  // tabs
  await page.evaluate(() => window.__ori.openApp('arcade'));
  await sleep(300);
  await clickCenter('.win-arcade [data-tab="board"]');
  await sleep(200);
  check(/Personal bests/.test(await text('.win-arcade .arc-body')) && /31/.test(await text('.win-arcade .lb-table')), 'Leaderboard tab lists personal bests');
  check((await page.evaluate(() => document.querySelectorAll('.win-arcade .lb-runs li').length)) === 2, 'Leaderboard shows the recent runs');
  await snap(session, join(SHOTS, 'smoke', `${tag}-arcade-board.png`));
  await clickCenter('.win-arcade [data-tab="trophies"]');
  await sleep(200);
  check(/Hungry/.test(await text('.win-arcade .ach-grid')) && /unlocked/.test(await text('.win-arcade .ach-head')), 'Achievements tab lists trophies (locked until earned)');
  await snap(session, join(SHOTS, 'smoke', `${tag}-arcade-trophies.png`));
  await clickCenter('.win-arcade [data-tab="games"]');

  // live refresh when a trophy unlocks
  await page.evaluate(() => { window.__ori.core.achievements.reset(); window.__ori.core.achievements.unlock('hungry'); }); // (the site now unlocks others on its own while it is being used: start from zero)
  await clickCenter('.win-arcade [data-tab="trophies"]');
  await sleep(200);
  check(/1 of \d+ unlocked/.test(await text('.win-arcade .ach-head')), 'unlocking a trophy updates the Achievements tab');
  await page.evaluate(() => { window.__ori.core.achievements.reset(); window.__ori.core.storage.remove('scores:snake'); });

  // terminal commands
  await page.evaluate(() => { window.__ori.desktop.reset(); window.__ori.openApp('terminal'); });
  await sleep(400);
  const run = (c) => page.evaluate((cmd) => {
    const i = document.querySelector('.win-terminal input');
    i.value = cmd;
    i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }, c);
  await run('games');
  await run('play snake');
  await sleep(500);
  check(/snake/i.test(await text('.win-terminal .out')) && (await q('.win-snake')), 'terminal `games` lists games and `play snake` launches it');
  await run('play nope');
  check(/unknown game/.test(await text('.win-terminal .out')), 'terminal `play <unknown>` explains');

  // Spotlight entry
  await page.evaluate(() => {
    const root = window.__ori.desktop.root;
    root.querySelector('[data-act="spot"]').click();
    const i = root.querySelector('.spot input');
    i.value = 'snake';
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  check(/Snake\s*Game/.test(await text('.mac .spot-res')), 'Spotlight finds "Snake" as a Game');
  await page.evaluate(() => { window.__ori.desktop.closeOverlays(); window.__ori.desktop.reset(); });
}
