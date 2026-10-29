// "Ori, Can You...?" a bot lives THREE DAYS in a row (T24): every day it says hello round the neighbourhood, goes into two buildings and out again, drives his car, boxes once (through the real
// menus), plays a game on the office computer, opens the map, the journal and the pause menu, saves and exports its code - and goes to sleep at midnight. Nothing may break, nothing may leak:
// the GPU's object counts stay flat from the end of day 1 to the end of day 3, the love only grows, the save always has the right day, the frame rate holds, no console errors.
import { sleep } from './harness.mjs';

export async function runFavorsLife3(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`life3: ${msg}`) : fail(`life3: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const S = () => g(() => window.__ori.game3d.state());
  const DAYS = 3;

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  const mem = () => g(() => { const s = window.__ori.game3d.stats(); const m = performance.memory; return { geo: s.geometries, tex: s.textures, prog: s.programs, fps: s.fps, heap: m ? m.usedJSHeapSize / 1048576 : 0, dom: document.querySelectorAll('#g3d *').length }; });
  const tp = (p, h) => g(([p, h]) => window.__ori.game3d.teleport(p, h), [p, h]);
  const inside = (id) => page.waitForFunction((id) => window.__ori.game3d.insideId() === id, id, { timeout: 8000 });
  const outside = () => page.waitForFunction(() => !window.__ori.game3d.insideId(), null, { timeout: 8000 });

  const days = [];
  for (let d = 1; d <= DAYS; d++) {
    await g(() => { const x = window.__ori.game3d; x.setHour(9 + 0.01); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); });
    const before = await S();
    // ── hello round the neighbourhood ──
    for (const [place, who] of [['park', ['tourist', 'parrot']], ['cafe', ['roee']], ['home', ['moti']], ['kiosk', ['albert']]]) {
      await tp(place);
      await sleep(260);
      for (const id of who) { await g((id) => window.__ori.game3d.game.sayHello(id), id); await sleep(140); }
    }
    // ── two buildings, in and out ──
    for (const id of ['mum', 'startup']) {
      await tp(id);
      await sleep(250);
      await g((id) => window.__ori.game3d.enter(id), id);
      await inside(id);
      await sleep(600);
      await g(() => window.__ori.game3d.leave());
      await outside();
      await sleep(300);
    }
    // ── his car: in, a little way forward, out ──
    await g(() => window.__ori.game3d.game.enterOwnCar());
    await page.waitForFunction(() => window.__ori.game3d.state().driving, null, { timeout: 5000 });
    await page.keyboard.down('KeyW');
    await sleep(1400);
    await page.keyboard.up('KeyW');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => !window.__ori.game3d.state().driving, null, { timeout: 5000 });
    await sleep(300);
    // ── the ring: one fight to its real end ──
    await g(() => { const gm = window.__ori.game3d.game; const a = gm.fight.apron(); window.__ori.game3d.teleport({ x: a.x, z: a.z }, Math.PI); });
    await sleep(350);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 5000 });
    await page.keyboard.press('Digit1');
    await page.waitForFunction(() => window.__ori.game3d.game.fight.phase === 'fight', null, { timeout: 15000 });
    await sleep(500);
    await g(() => { const b = window.__ori.game3d.game.fight.bout; b.O.hp = 0; b.O.state = 'ko'; });
    await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.cardOpen, null, { timeout: 15000 });
    await page.click('.fi-btn.primary');
    await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 8000 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !window.__ori.game3d.game.fight.active && !window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 8000 });
    await sleep(300);
    // ── the office computer: a run of SNAKE that ends at once, paid ──
    await tp('startup');
    await sleep(250);
    await g(() => window.__ori.game3d.enter('startup'));
    await inside('startup');
    await sleep(500);
    const room = await g(() => window.__ori.game3d.insideInfo());
    const pc = room.spots.find((p) => p.use === 'arcade');
    await g((p) => window.__ori.game3d.teleport({ x: p.x, z: p.z + 1.1 }, Math.PI), pc);
    await sleep(400);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__ori.game3d.game.arcade.isOpen, null, { timeout: 3000 });
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__ori.game3d.game.arcade.mode === 'menu', null, { timeout: 6000 });
    await page.keyboard.press('Digit3');
    await page.waitForFunction(() => window.__ori.game3d.game.arcade.mode === 'snake', null, { timeout: 3000 });
    await g(() => { const r = window.__ori.game3d.game.arcade.run; r.state.score = 90 + 30 * (window.__d || 1); r.state.over = true; });
    await sleep(700);
    await page.keyboard.press('Escape'); await sleep(200);
    await page.keyboard.press('Escape'); await sleep(200);
    await g(() => window.__ori.game3d.leave());
    await outside();
    // ── the map, the journal, the pause menu ──
    await page.keyboard.press('KeyM'); await sleep(300); await page.keyboard.press('Escape'); await sleep(200);
    await page.keyboard.press('Tab'); await sleep(300); await page.keyboard.press('Escape'); await sleep(200);
    await page.keyboard.press('Escape'); await sleep(250); await page.keyboard.press('Escape'); await sleep(250);
    // ── the day's end: the save code round-trips, then midnight ──
    const code = await g(() => window.__ori.game3d.game.campaign.exportCode());
    const rt = await g((c) => { // the save code must give the very same game back (and say where it does not)
      const r = window.__ori.game3d.game.campaign;
      const was = JSON.parse(JSON.stringify(r.state));
      const got = r.importCode(c);
      const now = JSON.parse(JSON.stringify(r.state));
      const diff = (x, y, path) => { if (typeof x !== 'object' || x === null || typeof y !== 'object' || y === null) return x === y ? null : `${path}: ${JSON.stringify(x)} -> ${JSON.stringify(y)}`; for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) { const d = diff(x[k], y[k], `${path}.${k}`); if (d) return d; } return null; };
      return { ok: !!got.ok, diff: diff(was, now, 'state') };
    }, code);
    const roundTrip = rt.ok && !rt.diff;
    const afterDay = await S();
    check(roundTrip && /^ORI2-/.test(code), `day ${d}: the save code round-trips (${code.length} characters)${rt.diff ? ` - DIFFERENT: ${rt.diff}` : ""}`);
    await g(() => window.__ori.game3d.setHour(23.99));
    await page.waitForFunction((d) => window.__ori.game3d.state().day === d + 1, d, { timeout: 15000 });
    await sleep(1500);
    const m = await mem();
    const s = await S();
    const saved = await g(() => { try { return JSON.parse(localStorage.getItem('ori-favors-week-v1')); } catch { return null; } });
    days.push({ d, m, s, before, afterDay });
    check(s.day === d + 1 && Number.isFinite(s.love) && Number.isFinite(s.peaches) && s.love >= before.love && !s.paused, `day ${d} is over: day ${s.day}, love ${before.love.toFixed(1)} -> ${s.love.toFixed(1)}, ${s.peaches} peaches, ${m.fps} fps`);
    check(saved && saved.day === d + 1 && saved.love > 0 && saved.version === 2, `the save has the new day (day ${saved && saved.day}, version ${saved && saved.version})`);
    await g((d) => { window.__d = d + 1; }, d);
  }

  const a = days[0].m; const z = days[days.length - 1].m;
  check(z.geo - a.geo <= 12 && z.tex - a.tex <= 12 && z.prog - a.prog <= 4, `the GPU's objects stay flat from the end of day 1 to the end of day ${DAYS} (${a.geo} / ${a.tex} / ${a.prog} -> ${z.geo} / ${z.tex} / ${z.prog} geometries / textures / programs)`);
  check(z.dom - a.dom <= 60, `and so do the page's elements (${a.dom} -> ${z.dom})`);
  if (a.heap) check(z.heap - a.heap < 200, `the JS heap does not run away (${a.heap.toFixed(0)} MB -> ${z.heap.toFixed(0)} MB)`);
  check(days.every((x) => x.m.fps >= 25), `the frame rate held every day (${days.map((x) => x.m.fps).join(', ')} fps)`);
  check(days[DAYS - 1].s.love > days[0].before.love && days[DAYS - 1].s.boxer.wins >= DAYS, `three days of a life: love ${days[0].before.love.toFixed(1)} -> ${days[DAYS - 1].s.love.toFixed(1)}, ${days[DAYS - 1].s.boxer.wins} wins`);
  await g(() => window.__ori.game3d.quit());
  await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 8000 });
  const last = await g(() => window.__ori.game3d.lastMemory);
  check(last && last.geometries === 0 && last.textures === 0, `quitting after three days leaves no GPU memory behind (${last ? `${last.geometries} geometries, ${last.textures} textures` : 'no reading'})`);
}
