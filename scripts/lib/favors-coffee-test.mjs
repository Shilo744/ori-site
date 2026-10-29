// "Ori, Can You...?" the cafe job "Coffee Rush" [experimental], browser checks (T35): the order pad in Roee's cafe opens a 45-second shift; the right keys serve the customers; the clock runs out, the card says
// how it went and pays; the lunch rush pays one and a half times; Esc goes back to the cafe.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';

export async function runFavorsCoffee(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`coffee: ${msg}`) : fail(`coffee: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const S = () => g(() => window.__ori.game3d.state());
  const run = () => g(() => window.__ori.game3d.game.coffee.run.view());
  const KEY = { espresso: 'KeyJ', latte: 'KeyK', tea: 'KeyL' };

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.setHour(15); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); });
  await g(() => window.__ori.game3d.enter('cafe'));
  await page.waitForFunction(() => window.__ori.game3d.insideId() === 'cafe', null, { timeout: 8000 });
  await sleep(500);
  const room = await g(() => window.__ori.game3d.insideInfo());
  const pad = room.spots.find((p) => p.use === 'coffeejob');
  check(!!pad, 'the cafe has an order pad');
  await g((p) => window.__ori.game3d.teleport({ x: p.x, z: p.z + 1.1 }, Math.PI), pad);
  await sleep(500);
  check(await g(() => /Coffee Rush/.test((document.querySelector('.fv-gohint') || {}).textContent || '')), 'at the pad the chip says "Space  Help Roee: Coffee Rush"');

  // ── a shift played with the real keys ──
  const p0 = (await S()).peaches;
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__ori.game3d.game.coffee.isOpen, null, { timeout: 3000 });
  check(await g(() => document.querySelector('.cf').getAttribute('aria-modal') === 'true' && document.activeElement && document.activeElement.closest('.cf') !== null), 'the card is a modal dialog with the focus on it');
  await page.screenshot({ path: join(SHOTS, 'T35-coffee-start.png') });
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    const v = await run();
    if (v.over) break;
    await page.keyboard.press(KEY[v.order.items[v.order.i]]);
    await sleep(110);
  }
  const mid = await run();
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T35-coffee-play.png') });
  check(mid.served >= 6 && mid.score >= 60 && mid.left === 0, `the right keys serve the customers: ${mid.served} served, score ${mid.score}`);
  const dom = await g(() => ({ served: document.querySelector('.cf [data-k="served"]').textContent, score: document.querySelector('.cf [data-k="score"]').textContent, ticket: document.querySelectorAll('.cf-order').length }));
  check(dom.served === String(mid.served) && dom.score === String(mid.score) && dom.ticket >= 1, 'and the card shows it (served, score, the ticket)');
  await page.keyboard.press(KEY.espresso === 'KeyJ' ? 'KeyK' : 'KeyJ'); // (a wrong key at some moment: the order starts again, the streak goes)
  await sleep(150);

  // ── the clock runs out: the pay ──
  await g(() => { window.__ori.game3d.game.coffee.run.state.time = 0.05; });
  await page.waitForFunction(() => /Press Space/.test((document.querySelector('.cf-msg') || {}).textContent || ''), null, { timeout: 4000 });
  const end = await S();
  const msg = await g(() => document.querySelector('.cf-msg').textContent);
  check(end.peaches > p0 && end.progress.cafeRuns === 1 && end.progress.cafeBestServed >= 6 && /customers served/.test(msg), `the shift ends and pays: "${msg.slice(0, 60)}..." (+${end.peaches - p0} peaches)`);
  await page.keyboard.press('Space');
  await sleep(300);
  check(!(await g(() => window.__ori.game3d.game.coffee.isOpen)) && !(await S()).paused && (await g(() => window.__ori.game3d.insideId())) === 'cafe', 'Space goes back to the cafe');

  // ── the lunch rush pays one and a half times ──
  await g(() => window.__ori.game3d.setHour(12.5));
  await sleep(700);
  const p1 = (await S()).peaches;
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__ori.game3d.game.coffee.isOpen, null, { timeout: 3000 });
  check(await g(() => /LUNCH RUSH/.test(document.querySelector('.cf footer').textContent)), 'at lunch the card says the tips are bigger');
  await g(() => { const r = window.__ori.game3d.game.coffee.run.state; r.score = 300; r.time = 0.05; });
  await page.waitForFunction(() => /Press Space/.test((document.querySelector('.cf-msg') || {}).textContent || ''), null, { timeout: 4000 });
  const p2 = (await S()).peaches;
  check(p2 - p1 >= 37, `a score of 300 pays 37 peaches at lunch (25 at other times): +${p2 - p1}`);
  await page.keyboard.press('Escape');
  await sleep(300);
  check(!(await g(() => window.__ori.game3d.game.coffee.isOpen)), 'Esc leaves too');

  // ── a card left open does not follow him out (it would keep the keyboard in the street) ──
  await g((p) => window.__ori.game3d.teleport({ x: p.x, z: p.z + 1.1 }, Math.PI), pad);
  await sleep(400);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__ori.game3d.game.coffee.isOpen, null, { timeout: 3000 });
  await g(() => window.__ori.game3d.leave());
  await page.waitForFunction(() => !window.__ori.game3d.insideId(), null, { timeout: 8000 });
  check(!(await g(() => window.__ori.game3d.game.coffee.isOpen)), 'leaving the cafe closes the card');
}
