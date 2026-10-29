// "Ori, Can You...?" the city's little events by the hour [experimental], browser checks (T33): fresh bread at the kiosk (morning), the lunch rush at the cafe (noon), the street band in the park (golden
// hour: you can HEAR it, louder as you come close) and pizza in the office (night). Each is announced, has a beam of light and a badge on the map, and pays once a day when he goes and enjoys it.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';

export async function runFavorsEvents(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`events: ${msg}`) : fail(`events: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const S = () => g(() => window.__ori.game3d.state());
  const hour = (h) => g((h) => window.__ori.game3d.setHour(h), h);
  const tp = (p) => g((p) => window.__ori.game3d.teleport(p), p);

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); window.__tl = new Set(); window.__tt = setInterval(() => { for (const t of document.querySelectorAll('.fv-toast')) window.__tl.add(t.textContent); }, 40); });
  await hour(10); await sleep(1500);
  check((await S()).events.open.length === 0 && (await g(() => window.__ori.game3d.game.landmarks.every((l) => l.icon !== 'event'))), 'at ten in the morning nothing is on, and no event badge is on the maps');

  // ── the morning: fresh bread at the kiosk ──
  await hour(7.5);
  await page.waitForFunction(() => window.__ori.game3d.state().events.open.includes('bakery'), null, { timeout: 4000 });
  await sleep(500);
  const e1 = await S();
  const lm = await g(() => window.__ori.game3d.game.landmarks.filter((l) => l.icon === 'event').map((l) => l.short));
  check(e1.events.beam === 'bakery' && lm.includes('BREAD'), `the bakery is announced, has a beam of light (${e1.events.beam}) and a badge on the maps (${lm.join(', ')})`);
  check((await g(() => [...window.__tl])).some((t) => /fresh bread at Albert/.test(t)), 'with a toast');
  const p0 = e1.peaches; const love0 = e1.love;
  await tp('kiosk');
  await page.waitForFunction(() => window.__ori.game3d.state().events.done.includes('bakery'), null, { timeout: 12000 });
  await sleep(300);
  const e2 = await S();
  check(e2.peaches >= p0 + 5 && e2.love > love0 && e2.progress.evCount === 1 && !e2.events.open.includes('bakery') && e2.events.beam === null, `standing at the kiosk for a few seconds pays once (+${e2.peaches - p0} peaches, love ${love0.toFixed(1)} -> ${e2.love.toFixed(1)}) and the beam and the badge go`);
  check((await g(() => [...window.__tl])).some((t) => /Warm bread/.test(t)), 'with a warm line');
  await sleep(1500);
  check((await S()).progress.evCount === 1, 'and not twice');

  // ── noon: the lunch rush at the cafe, enjoyed from INSIDE it ──
  await hour(12.4); await sleep(1500);
  check((await S()).events.open.includes('lunch'), 'at noon: lunch rush');
  await g(() => window.__ori.game3d.enter('cafe'));
  await page.waitForFunction(() => window.__ori.game3d.insideId() === 'cafe', null, { timeout: 8000 });
  await page.waitForFunction(() => window.__ori.game3d.state().events.done.includes('lunch'), null, { timeout: 14000 });
  check(true, 'inside the cafe he enjoys it too');
  await g(() => window.__ori.game3d.leave());
  await page.waitForFunction(() => !window.__ori.game3d.insideId(), null, { timeout: 8000 });

  // ── golden hour: the band, heard from afar, louder close by ──
  await hour(18); await tp('court'); await sleep(1600);
  const far = await S();
  await tp('park'); await sleep(900);
  const near = await S();
  check(near.events.open.includes('band') && near.events.band === true && far.events.band === false, `the band plays only near enough: far from the park ${far.events.band}, in it ${near.events.band}`);
  // (the park is a big green square: the band stands in the middle of it, thirty metres in from the gate)
  const mid = await g(() => { const l = window.__ori.game3d.game.landmarks.find((x) => x.icon === 'event'); return { x: l.x - 7, z: l.z + 7 }; });
  await g(([x, z]) => window.__ori.game3d.teleport({ x, z }, 0), [mid.x, mid.z - 26]); await sleep(1500); // (a good look at the beam from the south)
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T33-band.png') });
  await tp(mid); await sleep(600);
  await page.waitForFunction(() => window.__ori.game3d.state().events.done.includes('band'), null, { timeout: 16000 });
  check((await S()).progress.evCount === 3, 'twelve seconds in front of the band: the third event of the day is his');
  await hour(19.6); await sleep(1500);
  check((await S()).events.band === false, 'and it stops when the hour is over');

  // ── night: pizza at the office; four events make a regular ──
  await hour(20.5); await sleep(1500);
  await g(() => window.__ori.game3d.enter('startup'));
  await page.waitForFunction(() => window.__ori.game3d.insideId() === 'startup', null, { timeout: 8000 });
  await page.waitForFunction(() => window.__ori.game3d.state().events.done.includes('pizza'), null, { timeout: 14000 });
  await sleep(1500);
  const e4 = await S();
  check(e4.progress.evCount === 4 && (e4.progress.trophies || []).includes('events4'), `four events: "Town regular" (${(e4.progress.trophies || []).includes('events4')})`);
  await g(() => window.__ori.game3d.leave());
  await page.waitForFunction(() => !window.__ori.game3d.insideId(), null, { timeout: 8000 });

  // ── remembered today, on again tomorrow ──
  const rt = await g(() => { const c = window.__ori.game3d.game.campaign; const r = c.importCode(c.exportCode()); return { ok: r.ok, done: Object.keys(c.state.progress.evDone || {}).length, day: c.state.progress.evDay }; });
  check(rt.ok && rt.done === 4 && rt.day === 1, 'what was enjoyed today is on the save (also through a save code)');
  await g(() => window.__ori.game3d.setHour(23.99));
  await page.waitForFunction(() => window.__ori.game3d.state().day === 2, null, { timeout: 12000 });
  await hour(7.4); await sleep(1500);
  check((await S()).events.open.includes('bakery') && !(await S()).events.done.includes('bakery'), 'the next morning the bread is there again');
  await g(() => clearInterval(window.__tt));
}
