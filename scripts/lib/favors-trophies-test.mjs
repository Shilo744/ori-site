// "Ori, Can You...?" achievements [experimental], browser checks (T31): hellos, a building, the car and a fight earn trophies with a toast; the journal has a second page with the grid and
// the progress; the earned ones are saved (also through a save code); the page works with the keys and with the mouse and is named in the accessibility tree.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';

export async function runFavorsTrophies(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`trophies: ${msg}`) : fail(`trophies: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const S = () => g(() => window.__ori.game3d.state());

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.setHour(12); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); window.__tl = new Set(); window.__tt = setInterval(() => { for (const t of document.querySelectorAll('.fv-toast')) window.__tl.add(t.textContent); }, 40); });

  // ── ten hellos, the last one to Shilo ──
  for (const id of ['roee', 'albert', 'moti', 'tourist', 'parrot', 'coach', 'uzi', 'dov', 'maya', 'shilo']) { await g((id) => window.__ori.game3d.game.sayHello(id), id); await sleep(260); }
  await sleep(1600);
  const s1 = await S();
  const t1 = await g(() => [...window.__tl]);
  check(['hello1', 'hello10', 'office'].every((id) => (s1.progress.trophies || []).includes(id)), `ten hellos earn "First hello", "Friendly face" and "Hi, Shilo" (${(s1.progress.trophies || []).join(', ')})`);
  check(t1.some((t) => /Achievement: First hello/.test(t)) && t1.some((t) => /Achievement: Friendly face|achievements unlocked/.test(t)), `each comes with a toast ("${t1.filter((t) => /chievement/.test(t)).join('" / "')}")`);
  check(Object.keys(s1.progress).filter((k) => k.startsWith('hi_')).length === 10, 'and who was met is counted by name');

  // ── a building, the car, a fight ──
  await g(() => window.__ori.game3d.teleport('mum'));
  await sleep(250);
  await g(() => window.__ori.game3d.enter('mum'));
  await page.waitForFunction(() => window.__ori.game3d.insideId() === 'mum', null, { timeout: 8000 });
  await sleep(400);
  await g(() => window.__ori.game3d.leave());
  await page.waitForFunction(() => !window.__ori.game3d.insideId(), null, { timeout: 8000 });
  await g(() => window.__ori.game3d.game.enterOwnCar());
  await page.waitForFunction(() => window.__ori.game3d.state().driving, null, { timeout: 5000 });
  await page.keyboard.down('KeyW'); await sleep(1600); await page.keyboard.up('KeyW');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !window.__ori.game3d.state().driving, null, { timeout: 5000 });
  await g(() => { const gm = window.__ori.game3d.game; const a = gm.fight.apron(); window.__ori.game3d.teleport({ x: a.x, z: a.z }, Math.PI); });
  await sleep(350);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 5000 });
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.phase === 'fight', null, { timeout: 15000 });
  await sleep(400);
  await g(() => { const b = window.__ori.game3d.game.fight.bout; b.O.hp = 0; b.O.state = 'ko'; });
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.cardOpen, null, { timeout: 15000 });
  await page.click('.fi-btn.primary');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 8000 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__ori.game3d.game.fight.active && !window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 8000 });
  await sleep(1500);
  const s2 = await S();
  check((s2.progress.seen || {}).mum === true && s2.progress.driven > 5, `the places gone into and the odometer are counted (${Object.keys(s2.progress.seen || {}).join(', ')}; ${Math.round(s2.progress.driven)} m)`);
  check(['win1', 'ko1', 'flawless'].every((id) => (s2.progress.trophies || []).includes(id)), `the fight earns "First win", "Lights out" and "Untouchable" (${(s2.progress.trophies || []).join(', ')})`);

  // ── the journal's second page ──
  await page.keyboard.press('Tab');
  await sleep(350);
  const tabs = await g(() => [...document.querySelectorAll('.jr-tabs [role="tab"]')].map((t) => ({ text: t.textContent.trim(), sel: t.getAttribute('aria-selected') })));
  check(tabs.length === 3 && tabs[0].sel === 'true' && /^Wishes \d \/ 3$/.test(tabs[1].text) && /^Achievements \d+ \/ \d+$/.test(tabs[2].text), `the journal has three pages: ${tabs.map((t) => t.text).join(' | ')}`);
  await page.keyboard.press('ArrowRight');
  await sleep(300);
  await page.keyboard.press('ArrowRight');
  await sleep(300);
  const pg = await g(() => ({ tiles: document.querySelectorAll('.tr-grid li').length, on: document.querySelectorAll('.tr-grid li.on').length, head: document.querySelector('.jr-trophies .jr-row').textContent, sel: document.querySelector('.jr-tabs [aria-selected="true"]').textContent }));
  check(pg.tiles >= 28 && pg.on === (s2.progress.trophies || []).length && /Achievements/.test(pg.sel), `the arrow key turns the page: ${pg.on} of ${pg.tiles} earned ("${pg.head.replace(/\s+/g, ' ')}")`);
  const locked = await g(() => { const li = document.querySelector('.tr-grid li:not(.on) small'); const bar = document.querySelector('.tr-grid li:not(.on) .tr-bar'); return { how: li && li.textContent, bar: !!bar }; });
  check(!!locked.how && locked.how.length > 8, `a locked one says what to do ("${locked.how}")`);
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T31-achievements.png') });
  const tree = await page.getByRole('dialog', { name: 'Journal' }).ariaSnapshot();
  check(/tab "Life"/.test(tree) && /tab "Achievements/.test(tree) && /tabpanel/.test(tree), 'the pages are tabs in the accessibility tree');
  await page.click('.jr-tabs [data-page="life"]');
  await sleep(250);
  check(await g(() => !!document.querySelector('.jr-love') && !document.querySelector('.jr-trophies')), 'clicking "Life" goes back');
  await page.keyboard.press('Escape');
  await sleep(200);
  await page.keyboard.press('Tab');
  await sleep(250);
  check(await g(() => !!document.querySelector('.jr-love')), 'it opens on the Life page again');
  await page.keyboard.press('Escape');
  await sleep(200);

  // ── they are saved, also through a save code ──
  const rt = await g(() => { const c = window.__ori.game3d.game.campaign; const was = [...c.state.progress.trophies]; const seen = Object.keys(c.state.progress.seen || {}).length; const r = c.importCode(c.exportCode()); return { ok: r.ok, same: JSON.stringify(c.state.progress.trophies) === JSON.stringify(was), seen: Object.keys(c.state.progress.seen || {}).length === seen, hi: Object.keys(c.state.progress).filter((k) => k.startsWith('hi_')).length }; });
  check(rt.ok && rt.same && rt.seen && rt.hi === 10, 'the earned ones, the places and the people met survive a save code');
  const saved = await g(() => { try { return JSON.parse(localStorage.getItem('ori-favors-week-v1')).progress.trophies; } catch { return null; } });
  check(Array.isArray(saved) && saved.length >= 6, `and the save on disk has them (${saved && saved.length})`);
  await g(() => clearInterval(window.__tt));
}
