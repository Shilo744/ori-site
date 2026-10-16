// NEON DRIFT gameplay checks (T43): main menu + garage + preview, flyover, countdown with the rolling start, a race against 5 rivals
// (HUD, standings, minimap, reset penalty), results, saved records / medals / achievements, the time-trial ghost, pause → menu.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';

export async function runDriftRace(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`drift-race: ${msg}`) : fail(`drift-race: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const flat = session.width < 860;
  const shot = async (name) => { await settle(session, 2); await page.screenshot({ path: join(SHOTS, flat ? name.replace('.png', '-phone.png') : name) }); };
  const waitPhase = (p, t = 30000) => page.waitForFunction((q) => window.__ori.game3d.game && window.__ori.game3d.game.phase === q, p, { timeout: t });
  const visible = (sel) => g((s) => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, sel);

  await g(() => { const st = window.__ori.core.storage; st.clear('drift:'); st.clear('scores:drift'); window.__ori.core.achievements.reset(); });

  // ── the menu ──
  await g(() => window.__ori.game3d.launch('drift'));
  await waitPhase('menu', 60000);
  await sleep(500);
  check(await visible('.g3d-main'), 'the main menu opens by default (not straight into a race)');
  check((await g(() => document.querySelectorAll('.g3d-track').length)) === 3, 'three tracks to choose from');
  check(await g(() => document.querySelectorAll('.g3d-car').length === 3 && document.querySelectorAll('.g3d-paints button').length === 6), '3 cars and 6 paints in the garage');
  check((await g(() => window.__ori.game3d.state().phase)) === 'menu' && (await g(() => window.__ori.game3d.state().cars)) >= 1, 'the preview car stands on the grid behind the menu');
  await shot('T43-menu.png');
  await page.click('[data-act="mode:trial"]');
  check(await g(() => window.__ori.game3d.game.prefs.mode === 'trial' && document.querySelector('.g3d-opt').hidden), 'Time Trial hides the rivals option');
  await page.click('[data-act="mode:race"]');
  await page.click('[data-act="biome:coast"]');
  await page.waitForFunction(() => { const l = document.querySelector('.g3d-loading'); const st = window.__ori.game3d.state(); return st && st.biome === 'coast' && st.phase === 'menu' && l && l.hidden; }, null, { timeout: 30000 });
  check((await g(() => window.__ori.game3d.state().biome)) === 'coast', 'choosing a track rebuilds the preview for it');
  await page.click('[data-act="car:hatch"]');
  await page.click('[data-act="paint:3"]');
  await page.click('[data-act="diff:hard"]');
  check(await g(() => { const p = window.__ori.game3d.game.prefs; return p.car === 'hatch' && p.paint === 3 && p.difficulty === 'hard'; }), 'car, paint and difficulty follow the clicks');
  check(await g(() => { const r = window.__ori.game3d.game.records.prefs(); return r.car === 'hatch' && r.biome === 'coast' && r.difficulty === 'hard'; }), 'the choices are saved');
  await page.click('[data-act="biome:city"]');
  await page.click('[data-act="car:gt"]');
  await page.click('[data-act="paint:0"]');
  await page.click('[data-act="diff:normal"]');
  await page.waitForFunction(() => window.__ori.game3d.state() && window.__ori.game3d.state().biome === 'city', null, { timeout: 30000 });
  await sleep(400);
  await shot('T43-garage.png');
  // arrow keys move the choice (the car group: focus the GT card, ← selects the Hatch), Enter starts
  await page.focus('[data-act="car:gt"]');
  await page.keyboard.press('ArrowLeft');
  await sleep(200);
  check((await g(() => window.__ori.game3d.game.prefs.car)) === 'hatch', 'the arrow keys change the selection inside a group');
  await page.keyboard.press('ArrowRight');
  await sleep(200);
  check((await g(() => window.__ori.game3d.game.prefs.car)) === 'gt', '…and back');

  // ── intro → countdown → race ──
  await page.keyboard.press('Enter');
  await waitPhase('intro', 30000);
  check(await visible('.g3d-skip'), 'the flyover can be skipped (hint on screen)');
  await sleep(1500);
  await shot('T43-flyover.png');
  await page.keyboard.press('Space');
  await waitPhase('countdown', 5000);
  await sleep(1200);
  const cd = await g(() => ({ txt: document.querySelector('.g3d-cd').textContent, rp: window.__ori.game3d.state().runnerPhase, speeds: window.__ori.game3d.game.runner.entries.map((e) => e.car.speed) }));
  check(['3', '2', '1'].includes(cd.txt), `the countdown shows ${cd.txt}`);
  check(cd.speeds.every((v) => v > 6 && v < 18), `everybody rolls at pace (${cd.speeds.map((v) => (v * 3.6).toFixed(0)).join(', ')} km/h)`);
  await shot('T43-grid.png');
  await waitPhase('racing', 8000);
  check(/GO/.test(await g(() => document.querySelector('.g3d-cd').textContent)), 'GO!');
  await sleep(1400);
  const hud = await g(() => ({ place: document.querySelector('.g3d-pos b').textContent, lap: document.querySelector('.g3d-lap b').textContent, rows: document.querySelectorAll('.g3d-board li').length, st: window.__ori.game3d.state(), cdClear: document.querySelector('.g3d-cd').textContent === '' }));
  check(hud.rows === 6 && hud.place === String(hud.st.place) && hud.lap === '1', `the HUD shows P${hud.place}/6, lap ${hud.lap}/3 and a standings tower with ${hud.rows} cars`);
  check(hud.cdClear, 'the GO! message clears itself');
  if (!flat) {
    const mapInk = await g(() => { const c = document.querySelector('.g3d-map'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return n; });
    check(mapInk > 400, `the minimap draws the track (${mapInk} px)`);
  }

  // drive with the keys: speed up, then R (reset: +3 s penalty, cooldown)
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.__ori.game3d.state().speedKmh > 70, null, { timeout: 12000 });
  check(true, 'W accelerates away from the grid');
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyR');
  await sleep(300);
  const pen1 = await g(() => window.__ori.game3d.game.runner.race.entries[window.__ori.game3d.game.runner.playerIndex].penalty);
  check(pen1 === 3, `R puts the car back on the road and costs 3 s (${pen1})`);
  await page.keyboard.press('KeyR');
  await sleep(200);
  const pen2 = await g(() => window.__ori.game3d.game.runner.race.entries[window.__ori.game3d.game.runner.playerIndex].penalty);
  check(pen2 === 3, 'a second R inside the 2 s cooldown does nothing');
  check(/RESET/.test(await g(() => document.querySelector('.g3d-toasts').textContent)), 'a toast tells you');
  await shot('T43-race-start.png');

  // pause → Quit to menu → back in the menu with the world intact
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__ori.game3d.paused, null, { timeout: 3000 });
  await page.click('#g3d [data-a="menu"]');
  await waitPhase('menu', 20000);
  check(await visible('.g3d-main') && !(await g(() => window.__ori.game3d.paused)), 'Quit to menu from the pause menu returns to the main menu');

  // ── a whole race, fast-forwarded with the autopilot ──
  await page.keyboard.press('Enter');
  await waitPhase('intro', 20000);
  await page.keyboard.press('Space');
  await waitPhase('racing', 12000);
  await g(() => { window.__ori.game3d.autopilot(true); });
  await sleep(600);
  await g(() => window.__ori.game3d.step(120 * 25));
  await shot('T43-race.png');
  for (let i = 0; i < 30 && (await g(() => window.__ori.game3d.game.phase)) === 'racing'; i++) await g(() => window.__ori.game3d.step(120 * 10));
  check((await g(() => window.__ori.game3d.game.phase)) === 'finished', 'the race ends when the player finishes lap 3');
  await waitPhase('results', 15000);
  await sleep(700);
  const res = await g(() => ({ rows: document.querySelectorAll('.g3d-table tbody tr').length, you: !!document.querySelector('.g3d-table tr.you'), title: document.querySelector('.g3d-rc h2').textContent, medal: !!document.querySelector('.g3d-rmed svg'), btns: [...document.querySelectorAll('.g3d-actions button')].map((b) => b.textContent) }));
  check(res.rows === 6 && res.you, `the results list all 6 drivers and mark you ("${res.title}")`);
  check(res.medal && res.btns.join('|') === 'Retry|Next track|Menu|Quit to desktop', 'medal + Retry / Next track / Menu / Quit buttons');
  await shot('T43-results.png');
  const saved = await g(() => { const r = window.__ori.game3d.game.records.track('city'); const sc = window.__ori.core.storage.get('scores:drift:city:lap', null); return { best: r.bestLap, races: r.races, medal: r.medal, score: sc && sc.best, splits: r.splits && r.splits.length, ghost: !!window.__ori.game3d.game.records.ghost('city') }; });
  check(saved.best > 50 && saved.races === 1 && saved.score > 50 && saved.splits === 8 && saved.ghost, `the best lap ${saved.best && saved.best.toFixed(2)} s, the race, the splits and the ghost are saved (medal ${saved.medal})`);
  check(await g(() => window.__ori.core.achievements.isUnlocked('drift-first')), 'the "Lights out" achievement unlocked');

  // retry → countdown again, then Esc in the results goes back to the menu
  await page.click('.g3d-actions [data-do="retry"]');
  await waitPhase('intro', 20000);
  await page.keyboard.press('Space');
  await waitPhase('countdown', 5000);
  check(true, 'Retry starts the same race again');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__ori.game3d.paused, null, { timeout: 3000 });
  await page.click('#g3d [data-a="menu"]');
  await waitPhase('menu', 20000);

  // ── time trial with the ghost ──
  await page.click('[data-act="mode:trial"]');
  await page.keyboard.press('Enter');
  await waitPhase('intro', 20000);
  await page.keyboard.press('Space');
  await waitPhase('racing', 12000);
  check(await g(() => window.__ori.game3d.state().ghost && window.__ori.game3d.state().cars === 1), 'a time trial has no rivals and shows the ghost of your best lap');
  check(!(await visible('.g3d-tl')), 'the standings tower is hidden in a time trial');
  await g(() => { window.__ori.game3d.autopilot(true); window.__ori.game3d.step(120 * 40); });
  await sleep(300);
  await shot('T43-trial.png');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__ori.game3d.paused, null, { timeout: 3000 });
  await page.click('#g3d [data-a="menu"]');
  await waitPhase('menu', 20000);
  await page.click('[data-act="mode:race"]');

  // Esc in the menu leaves the game
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 8000 });
  check(true, 'Esc in the main menu quits to the desktop');
  const mem = await g(() => window.__ori.game3d.lastMemory);
  check(mem && mem.geometries === 0 && mem.textures === 0, `everything is released after a whole session (geometries ${mem?.geometries}, textures ${mem?.textures})`);
}
