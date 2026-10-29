// "Ori, Can You...?" the street cats [experimental], browser checks (T42): Space next to a cat pets it (a purr, a heart, the chip on the screen), a pet a moment later is only purring, the third pet makes a friend (and some peaches),
// three friends make a "Cat person", the save carries it.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';

export async function runFavorsCats(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`cats: ${msg}`) : fail(`cats: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const S = () => g(() => window.__ori.game3d.state());
  const saw = (re) => page.waitForFunction((src) => [...window.__tl].some((t) => new RegExp(src).test(t)), re.source, { timeout: 3000 }).then(() => true, () => false);
  const cats = () => g(() => window.__ori.game3d.game.cats);
  const beside = async (id) => {
    const c = (await cats()).find((x) => x.id === id);
    await g(([c]) => window.__ori.game3d.teleport({ x: c.x + 1.2, z: c.z }, Math.PI / 2), [c]);
    await page.waitForFunction(() => { const h = document.querySelector('.fv-gohint'); return !!h && h.classList.contains('on') && /Pet/.test(h.textContent); }, null, { timeout: 4000 }).catch(() => {});
  };
  const chip = () => g(() => (document.querySelector('.fv-gohint') || {}).textContent.replace(/\s+/g, ' ').trim());
  const pets = async (id) => ((await S()).progress.cats || {})[id] || 0;

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.setHour(15); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); window.__tl = new Set(); window.__tt = setInterval(() => { for (const t of document.querySelectorAll('.fv-toast')) window.__tl.add(t.textContent); }, 40); });
  await sleep(500);
  const list = await cats();
  check(list.length === 3 && list.map((c) => c.id).sort().join() === 'ginger,grey,tuxedo', `the street has its three cats: ${list.map((c) => c.id).join(', ')}`);

  // ── the first cat: the chip, a pet, a heart, only purring if it is too soon ──
  await beside('ginger');
  check(/Space Pet the ginger cat/.test(await chip()), `next to the ginger cat the chip says "${await chip()}"`);
  const love0 = (await S()).love;
  await page.keyboard.press('Space');
  await sleep(350);
  check((await pets('ginger')) === 1 && (await saw(/A purr\. A very small, very serious purr\./)) && (await g(() => document.querySelectorAll('.fb-heart').length)) >= 1 && (await S()).love > love0, 'Space: a purr, a heart over the cat, a little love');
  await page.keyboard.press('Space');
  await sleep(300);
  check((await pets('ginger')) === 1 && (await saw(/Mango is still purring\./)), 'another Space a moment later: just more purring, nothing counted');
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T42-cat.png') });
  for (let k = 2; k <= 3; k++) { await sleep(4300); await page.keyboard.press('Space'); await sleep(300); }
  const p1 = await S();
  check(p1.progress.cats.ginger === 3 && (await saw(/Mango is your friend now! \+5 peaches/)), 'the third pet: "Mango is your friend now! +5 peaches"');
  check(/Space Pet Mango/.test(await chip()), `and the chip says her name now ("${await chip()}")`);

  // ── all three friends: the achievements, the save code ──
  await g(() => { const c = window.__ori.game3d.game.campaign.state.progress.cats; c.grey = 2; c.tuxedo = 2; });
  for (const id of ['grey', 'tuxedo']) { await beside(id); await page.keyboard.press('Space'); await sleep(400); }
  await sleep(1500);
  const p2 = await S();
  check(p2.progress.cats.grey === 3 && p2.progress.cats.tuxedo === 3 && p2.progress.trophies.includes('purr') && p2.progress.trophies.includes('catperson'), `three friends: "First purr" and "Cat person" (${JSON.stringify(p2.progress.cats)}, ${p2.progress.trophies.filter((x) => /purr|cat/.test(x)).join()})`);
  const rt = await g(() => { const c = window.__ori.game3d.game.campaign; const was = JSON.stringify(c.state.progress.cats); const r = c.importCode(c.exportCode()); return { ok: r.ok, same: was === JSON.stringify(c.state.progress.cats) }; });
  check(rt.ok && rt.same, 'the save code carries the cats');

  // ── a favour waiting at the kiosk door comes first (the tuxedo cat sits next to that door) ──
  const before = ((await S()).progress.cats || {}).tuxedo || 0;
  await g(() => { const gm = window.__ori.game3d.game; const t = gm.quests.inject('mum-bread'); gm.step(1, { mx: 0, mz: 0 }); gm.phone.setActive(t.uid); });
  await g(() => window.__ori.game3d.teleport('kiosk'));
  await sleep(400);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__ori.game3d.state().verb === true, null, { timeout: 4000 }).catch(() => {});
  const s3 = await S();
  check(s3.verb === true && ((s3.progress.cats || {}).tuxedo || 0) === before, `Space at the kiosk door with a favour waiting starts the favour, not the cat (verb ${s3.verb}, pets ${(s3.progress.cats || {}).tuxedo})`);
  await page.keyboard.press('Escape'); // (steps back: the favour waits)
  await sleep(300);
  await g(() => clearInterval(window.__tt));
}
