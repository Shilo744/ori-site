// "Ori, Can You...?" the stamp book [experimental], browser checks (T39): a stamp when he first goes into a room, a stamp when he first walks up to the bus stop, the park or the ring, "Stamped" on the map's list,
// the book on the journal's Achievements page, a full book pays and earns an achievement, the save code carries it.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';
import { STAMPS, ROOM_STAMPS } from '../../src/game3d/favors/stamps.js';

export async function runFavorsStamps(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`stamps: ${msg}`) : fail(`stamps: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const S = () => g(() => window.__ori.game3d.state());
  const saw = (re) => page.waitForFunction((src) => [...window.__tl].some((t) => new RegExp(src).test(t)), re.source, { timeout: 3000 }).then(() => true, () => false); // (the toasts are read by a poll: wait for it rather than look once)
  const stamped = async () => Object.keys((await S()).progress.stamps || {}).sort();
  const goIn = async (pid) => {
    await g((p) => window.__ori.game3d.enter(p), pid);
    await page.waitForFunction((p) => window.__ori.game3d.insideId() === p, pid, { timeout: 8000 });
    await sleep(250);
    await g(() => window.__ori.game3d.leave());
    await page.waitForFunction(() => !window.__ori.game3d.insideId(), null, { timeout: 8000 });
  };

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.setHour(15); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); window.__tl = new Set(); window.__tt = setInterval(() => { for (const t of document.querySelectorAll('.fv-toast')) window.__tl.add(t.textContent); }, 40); });
  await sleep(500);

  // ── the empty book on the Achievements page ──
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.__ori.game3d.game.journal.isOpen, null, { timeout: 3000 });
  await sleep(300);
  await page.keyboard.press('ArrowRight'); await sleep(200); await page.keyboard.press('ArrowRight'); await sleep(300);
  const b0 = await g(() => ({ head: document.querySelector('.sb-head').textContent, cells: document.querySelectorAll('.sb-grid:not(.gf-grid) .sb').length, on: document.querySelectorAll('.sb-grid:not(.gf-grid) .sb.on').length, first: document.querySelector('.jr-trophies .jr-row').textContent }));
  check(b0.cells === 14 && b0.on === 0 && /Stampbook0\/14/.test(b0.head.replace(/\s+/g, '')) && /Achievements/.test(b0.first), `the Achievements page opens with the stamp book: ${b0.cells} places, none stamped`);
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T39-stamps-empty.png') });
  await page.keyboard.press('Escape'); await sleep(250);

  // ── a room: the stamp comes at the door, with a toast; again is nothing ──
  await goIn('cafe');
  check(await saw(/Stamp: Cafe Sababa \(1 \/ 14\)/) && (await stamped()).join() === 'cafe', 'the first time he goes into the cafe: "Stamp: Cafe Sababa (1 / 14)"');
  await goIn('cafe');
  check((await stamped()).length === 1, 'going in again stamps nothing more');

  // ── the map's list says which places are stamped ──
  await page.keyboard.press('KeyM');
  await page.waitForFunction(() => window.__ori.game3d.game.mapUi.isOpen, null, { timeout: 3000 });
  await sleep(450);
  const ml = await g(() => ({ cafe: document.querySelector('.mp-list li[data-p="cafe"] em').textContent, kiosk: document.querySelector('.mp-list li[data-p="kiosk"] em').textContent, cls: document.querySelector('.mp-list li[data-p="cafe"]').className }));
  check(ml.cafe === 'Stamped' && ml.kiosk === '' && /stamped/.test(ml.cls), 'the big map lists the cafe as "Stamped" and the kiosk not');
  await page.keyboard.press('Escape'); await sleep(250);

  // ── the open places: the bus stop, the park, the ring: when he walks up to them ──
  await g(() => window.__ori.game3d.teleport('busstop'));
  check(await saw(/Stamp: Bus Stop 5 \(2 \/ 14\)/), 'walking up to the bus stop stamps it');
  await g(() => window.__ori.game3d.teleport('park'));
  check(await saw(/Stamp: Park & Beach \(3 \/ 14\)/), 'and the park');
  await g(() => { const gm = window.__ori.game3d.game; const p = gm.fight.apron(); window.__ori.game3d.teleport({ x: p.x, z: p.z }, Math.PI); });
  check(await saw(/Stamp: The Ring \(4 \/ 14\)/), 'and the ring (from its apron, where "Space steps in" shows)');

  // ── the rest of the rooms: a full book pays and earns the achievements ──
  const p0 = (await S()).peaches;
  for (const pid of ROOM_STAMPS.filter((id) => id !== 'cafe')) await goIn(pid);
  await page.waitForFunction(() => Object.keys(window.__ori.game3d.state().progress.stamps || {}).length === 14, null, { timeout: 5000 });
  check(await saw(/The stamp book is full! \+40 peaches/) && (await S()).peaches >= p0 + 40, `the fourteenth stamp: "The stamp book is full! +40 peaches" (${(await S()).peaches - p0} peaches)`);
  await sleep(1500);
  const tr = (await S()).progress.trophies;
  check(tr.includes('explorer') && tr.includes('stampbook'), 'Explorer (ten stamps) and "Full stamp book" are both earned');

  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.__ori.game3d.game.journal.isOpen, null, { timeout: 3000 });
  await sleep(300);
  await page.keyboard.press('ArrowRight'); await sleep(200); await page.keyboard.press('ArrowRight'); await sleep(300);
  const b1 = await g(() => ({ head: document.querySelector('.sb-head').textContent.replace(/\s+/g, ''), on: document.querySelectorAll('.sb-grid:not(.gf-grid) .sb.on').length, label: document.querySelector('.sb-grid:not(.gf-grid) .sb.on i').textContent }));
  check(b1.on === 14 && /Stampbook14\/14/.test(b1.head) && b1.label.length >= 3, `the book shows all fourteen stamped (${b1.head})`);
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T39-stamps-full.png') });
  await page.keyboard.press('Escape'); await sleep(250);

  // ── the save code carries the book ──
  const rt = await g(() => { const c = window.__ori.game3d.game.campaign; const was = JSON.stringify(c.state.progress.stamps); const r = c.importCode(c.exportCode()); return { ok: r.ok, same: was === JSON.stringify(c.state.progress.stamps), n: Object.keys(c.state.progress.stamps).length }; });
  check(rt.ok && rt.same && rt.n === STAMPS.length, 'the stamps survive a save code');
  await g(() => clearInterval(window.__tt));
}
