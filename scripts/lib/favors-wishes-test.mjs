// "Ori, Can You...?" the daily wishes [experimental], browser checks (T38): three wishes every morning (one of each tier), the journal's Wishes page, a wish done pays and earns a sticker, three out of three pay the bonus,
// a wish with a time says "maybe tomorrow" after it, a new day draws three others and keeps the stickers, and the save code carries it all.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';
import { wishOf, wordsOf } from '../../src/game3d/favors/wishes.js';

export async function runFavorsWishes(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`wishes: ${msg}`) : fail(`wishes: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const S = () => g(() => window.__ori.game3d.state());
  const setList = (list) => g((l) => { const pr = window.__ori.game3d.game.campaign.state.progress; pr.wish.list = l; pr.wish.done = {}; pr.wish.bonus = false; pr.wish.places = {}; }, list);
  const saw = (re) => page.waitForFunction((src) => [...window.__tl].some((t) => new RegExp(src).test(t)), re.source, { timeout: 3000 }).then(() => true, () => false); // (the toasts are read by a poll: wait for it rather than look once)
  const tabs = () => g(() => [...document.querySelectorAll('.jr-tabs [role="tab"]')].map((t) => t.textContent.trim().replace(/\s+/g, ' ')));

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.setHour(9); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); window.__tl = new Set(); window.__tt = setInterval(() => { for (const t of document.querySelectorAll('.fv-toast')) window.__tl.add(t.textContent); }, 40); });
  await sleep(500);

  // ── the morning: three wishes, one of each tier, from today's seed ──
  const s0 = await S();
  const w0 = s0.progress.wish;
  check(w0.day === 1 && w0.list.length === 3 && w0.list.every((c) => wishOf(c)) && w0.list.map((c) => wishOf(c).tier).join() === '1,2,3', `day 1 starts with three wishes, one of each tier: ${w0.list.join(' · ')}`);
  check(Object.keys(w0.done).length === 0 && Object.keys(w0.base).length >= 8, 'nothing is done yet and the morning\'s numbers are kept to measure from');

  // ── the journal: a Wishes page, in the tab list and the accessibility tree ──
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.__ori.game3d.game.journal.isOpen, null, { timeout: 3000 });
  await sleep(350);
  const t0 = await tabs();
  check(t0.length === 3 && t0[1] === 'Wishes 0 / 3', `the journal has a Wishes page: ${t0.join(' | ')}`);
  await page.keyboard.press('ArrowRight');
  await sleep(300);
  const pg = await g(() => ({ rows: [...document.querySelectorAll('.wi-list .wi b')].map((b) => b.textContent), sel: document.querySelector('.jr-tabs [aria-selected="true"]').textContent.trim(), days: document.querySelectorAll('.wi-day').length }));
  check(pg.rows.join('|') === w0.list.map((c) => wordsOf(wishOf(c))).join('|') && /^Wishes/.test(pg.sel) && pg.days === 1, `the arrow key turns to it and it lists the three in words: ${pg.rows.join(' / ')}`);
  const tree = await page.getByRole('dialog', { name: 'Journal' }).ariaSnapshot();
  check(/tab "Wishes 0 \/ 3"/.test(tree) && /tabpanel/.test(tree), 'it is a tab in the accessibility tree');
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T38-wishes.png') });
  await page.keyboard.press('ArrowLeft'); await sleep(250);
  check(await g(() => !!document.querySelector('.jr-love')), 'the left arrow goes back to Life');
  await page.keyboard.press('Escape');
  await sleep(250);

  // ── three wishes done with the real game: hellos, a cafe shift, a fight ──
  await setList(['hello:3', 'coffee:1', 'win:1']);
  const p0 = (await S()).peaches;
  for (const id of ['tourist', 'parrot', 'roee']) { await g((id) => window.__ori.game3d.game.sayHello(id), id); await sleep(150); }
  await page.waitForFunction(() => window.__ori.game3d.state().progress.wish.done.hello === true, null, { timeout: 4000 });
  check((await saw(/Wish done: Say hello to 3 people\. \+6 peaches/)) && (await S()).peaches >= p0 + 6, 'three hellos: "Wish done: Say hello to 3 people. +6 peaches"');
  await g(() => window.__ori.game3d.game.campaign.bump('cafeRuns'));
  await page.waitForFunction(() => window.__ori.game3d.state().progress.wish.done.coffee === true, null, { timeout: 4000 });
  check(await saw(/Wish done: Help Roee with Coffee Rush\. \+12 peaches/), 'a shift at the cafe: +12 peaches (the second tier pays more)');
  const love0 = (await S()).love;
  await g(() => { window.__ori.game3d.game.campaign.state.boxer.wins += 1; });
  await page.waitForFunction(() => window.__ori.game3d.state().progress.wish.bonus === true, null, { timeout: 4000 });
  const s1 = await S();
  check(s1.peaches >= p0 + 6 + 12 + 20 + 30 && (await saw(/All three wishes today! \+30 peaches/)) && s1.progress.wishDone === 3 && s1.progress.wishDays === 1 && s1.love > love0, `a fight won, and all three are done: +30 on top (${s1.peaches - p0} peaches, love ${love0.toFixed(1)} -> ${s1.love.toFixed(1)})`);
  await sleep(1500);
  check((await S()).progress.trophies.includes('fullday'), 'and the "A full day" achievement comes with it');
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.__ori.game3d.game.journal.isOpen, null, { timeout: 3000 });
  await sleep(300);
  check((await tabs())[1] === 'Wishes 3 / 3', 'the tab says 3 / 3');
  await page.keyboard.press('ArrowRight');
  await sleep(300);
  const done3 = await g(() => ({ on: document.querySelectorAll('.wi.on').length, dots: document.querySelectorAll('.wi-day.now i.on').length, total: document.querySelector('.jr-wishes .jr-sub:last-child').textContent }));
  check(done3.on === 3 && done3.dots === 3 && /3 wishes done in all · 1 full day$/.test(done3.total), `three ticks and three stickers today ("${done3.total}")`);
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T38-wishes-done.png') });
  await page.keyboard.press('Escape');
  await sleep(250);

  // ── the save code carries the day's wishes ──
  const rt = await g(() => { const c = window.__ori.game3d.game.campaign; const was = JSON.stringify([c.state.progress.wish, c.state.progress.wishLog, c.state.progress.wishDone, c.state.progress.wishDays]); const r = c.importCode(c.exportCode()); return { ok: r.ok, same: was === JSON.stringify([c.state.progress.wish, c.state.progress.wishLog, c.state.progress.wishDone, c.state.progress.wishDays]) }; });
  check(rt.ok && rt.same, 'the wishes survive a save code (the day\'s list, what is done, the stickers)');

  // ── the next morning: three others, yesterday's stickers kept ──
  const yest = (await S()).progress.wish.list.map((c) => wishOf(c).id);
  await g(() => window.__ori.game3d.game.nextDay());
  await sleep(600);
  const s2 = await S();
  const w2 = s2.progress.wish;
  check(w2.day === 2 && w2.list.length === 3 && w2.list.every((c) => !yest.includes(wishOf(c).id)) && Object.keys(w2.done).length === 0 && w2.bonus === false && JSON.stringify(s2.progress.wishLog) === '[3]', `day 2: three new wishes (${w2.list.join(' · ')}), yesterday's three stickers are kept`);

  // ── places and a wish with a time ──
  await setList(['places:2', 'event:1', 'hello-am:3']);
  await g(() => window.__ori.game3d.setHour(10));
  for (const pid of ['cafe', 'kiosk']) {
    await g((p) => window.__ori.game3d.enter(p), pid);
    await page.waitForFunction((p) => window.__ori.game3d.insideId() === p, pid, { timeout: 8000 });
    await sleep(300);
    await g(() => window.__ori.game3d.leave());
    await page.waitForFunction(() => !window.__ori.game3d.insideId(), null, { timeout: 8000 });
  }
  await page.waitForFunction(() => window.__ori.game3d.state().progress.wish.done.places === true, null, { timeout: 4000 });
  check(await saw(/Wish done: Go inside 2 different places\. \+6 peaches/), 'going into two different places today: the first-tier wish is done');
  await g(() => window.__ori.game3d.setHour(13));
  for (const id of ['moti', 'albert', 'tourist']) { await g((id) => window.__ori.game3d.game.sayHello(id), id); await sleep(150); }
  await sleep(1500);
  const late = await g(() => { const pr = window.__ori.game3d.game.campaign.state.progress; return { done: !!pr.wish.done['hello-am'] }; });
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.__ori.game3d.game.journal.isOpen, null, { timeout: 3000 });
  await sleep(300);
  await page.keyboard.press('ArrowRight');
  await sleep(300);
  const lateRow = await g(() => { const li = [...document.querySelectorAll('.wi')].find((e) => /before noon/.test(e.textContent)); return li ? { cls: li.className, text: li.querySelector('small').textContent } : null; });
  check(!late.done && lateRow && /late/.test(lateRow.cls) && /Maybe tomorrow/.test(lateRow.text), `after noon a "before noon" wish is not paid and says so kindly ("${lateRow && lateRow.text}")`);
  await page.keyboard.press('Escape');
  await sleep(250);
  await g(() => clearInterval(window.__tt));
}
