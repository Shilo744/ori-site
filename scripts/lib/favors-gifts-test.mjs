// "Ori, Can You...?" gifts from the neighbours [experimental], browser checks (T41): somebody he greets on enough days hands him a small gift (a toast, a little love), once; the collection on the Achievements page; the real
// days of hellos; all twenty-one make the achievements; the save carries them.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';
import { GIFT_IDS, GIFTS } from '../../src/game3d/favors/gifts.js';

export async function runFavorsGifts(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`gifts: ${msg}`) : fail(`gifts: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const S = () => g(() => window.__ori.game3d.state());
  const saw = (re) => page.waitForFunction((src) => [...window.__tl].some((t) => new RegExp(src).test(t)), re.source, { timeout: 3000 }).then(() => true, () => false);
  const hello = (id) => g((id) => window.__ori.game3d.game.sayHello(id), id);
  const openCollection = async () => {
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => window.__ori.game3d.game.journal.isOpen, null, { timeout: 3000 });
    await sleep(300);
    await page.keyboard.press('ArrowRight'); await sleep(200); await page.keyboard.press('ArrowRight'); await sleep(350);
  };

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.setHour(15); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); window.__tl = new Set(); window.__tt = setInterval(() => { for (const t of document.querySelectorAll('.fv-toast')) window.__tl.add(t.textContent); }, 40); });
  await sleep(500);
  check(Object.keys((await S()).progress.gifts || {}).length === 0, 'a new game has no gifts');

  // ── the empty collection ──
  await openCollection();
  const c0 = await g(() => ({ head: [...document.querySelectorAll('.sb-head')].map((h) => h.textContent.replace(/\s+/g, ' ')), cells: document.querySelectorAll('.gf').length, on: document.querySelectorAll('.gf.on').length, moti: [...document.querySelectorAll('.gf small')].map((s) => s.textContent).find((t) => /^Moti/.test(t)) }));
  check(c0.cells === 21 && c0.on === 0 && c0.head.some((h) => /Gifts from the neighbours\s*0 \/ 21/.test(h)) && c0.moti === 'Moti 0 / 2', `the Achievements page has the collection: 21 givers, none yet, "${c0.moti}"`);
  await page.keyboard.press('Escape'); await sleep(250);

  // ── the second day of hellos: a gift ──
  await g(() => { window.__ori.game3d.game.campaign.state.progress.gdays = { moti: { n: 1, d: 0 } }; });
  const love0 = (await S()).love;
  await hello('moti');
  await page.waitForFunction(() => window.__ori.game3d.state().progress.gifts && window.__ori.game3d.state().progress.gifts.moti, null, { timeout: 4000 });
  check(await saw(/Moti gave you a gift: A lucky coin\./) && (await S()).love >= love0 + 0.5, `Moti on the second day: "Moti gave you a gift: A lucky coin." and a little love (${love0.toFixed(1)} -> ${(await S()).love.toFixed(1)})`);
  await hello('moti');
  await sleep(300);
  check(Object.keys((await S()).progress.gifts).length === 1, 'hello again: no second gift');
  await settle(session, 2);

  // ── the real thing: three days of hellos to Roee ──
  for (let d = 1; d <= 2; d++) {
    await hello('roee');
    await sleep(300);
    const n = Object.keys((await S()).progress.gifts).length;
    if (d < 2) { check(n === 1, `day ${d}: hello to Roee (${(await S()).progress.gdays.roee.n} of 2): not yet`); await g(() => window.__ori.game3d.game.nextDay()); await sleep(600); }
  }
  check(await saw(/Roee gave you a gift: A bag of coffee beans\./) && (await S()).progress.gifts.roee === true, 'day 2: "Roee gave you a gift: A bag of coffee beans."');

  // ── the journal shows what he has and what is next ──
  await openCollection();
  const c1 = await g(() => ({ on: document.querySelectorAll('.gf.on').length, names: [...document.querySelectorAll('.gf.on small')].map((s) => s.textContent), ima: [...document.querySelectorAll('.gf small')].map((s) => s.textContent).find((t) => /^Mum/.test(t)) }));
  check(c1.on === 2 && c1.names.includes('A lucky coin') && c1.names.includes('A bag of coffee beans') && /^Mum 0 \/ 2$/.test(c1.ima || ''), `the collection shows the two he has and how far Mum is ("${c1.ima}")`);
  await page.screenshot({ path: join(SHOTS, 'T41-gifts.png') });
  await page.keyboard.press('Escape'); await sleep(250);

  // ── everybody: the achievements, the save code ──
  for (const id of GIFT_IDS) {
    if ((await S()).progress.gifts[id]) continue;
    await g(([id, at]) => { window.__ori.game3d.game.campaign.state.progress.gdays ||= {}; window.__ori.game3d.game.campaign.state.progress.gdays[id] = { n: at - 1, d: 0 }; }, [id, GIFTS[id].at]);
    await hello(id);
    await sleep(120);
  }
  await page.waitForFunction((n) => Object.keys(window.__ori.game3d.state().progress.gifts).length === n, GIFT_IDS.length, { timeout: 8000 });
  await sleep(1500);
  const tr = (await S()).progress.trophies;
  check(tr.includes('gifts5') && tr.includes('giftsall'), 'all twenty-one: "Dear to the neighbours" and "Everybody\'s friend"');
  const rt = await g(() => { const c = window.__ori.game3d.game.campaign; const was = JSON.stringify(c.state.progress.gifts); const r = c.importCode(c.exportCode()); return { ok: r.ok, same: was === JSON.stringify(c.state.progress.gifts), n: Object.keys(c.state.progress.gifts).length }; });
  check(rt.ok && rt.same && rt.n === GIFT_IDS.length, 'the save code carries the collection');
  await g(() => clearInterval(window.__tt));
}
