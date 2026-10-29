// "Ori, Can You...?" the Sababa Cup [experimental], browser checks (T51): the board in Uzi's workshop (Space at the counter) - seven rivals up a ladder, the first one open, the others say why not -
// a race picked on the board is the lap round the neighbourhood against him, a win pays the prize and the driver XP and opens the next rival, a loss pays a little and a kind word, a rematch pays half,
// the driver level steps up, a race he chose and left costs nothing, the save carries it. (The driving itself is proved in favors-play: here the car is put on each ring.)
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';
import { RACE } from '../../src/game3d/favors/play-content.js';
import { buildTrack, EXIT } from '../../src/game3d/favors/tracks.js';
import { LADDER } from '../../src/game3d/favors/fight-content.js';

export async function runFavorsLeague(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`league: ${msg}`) : fail(`league: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const S = () => g(() => window.__ori.game3d.state());
  const saw = (re) => page.waitForFunction((src) => [...window.__tl].some((t) => new RegExp(src).test(t)), re.source, { timeout: 3500 }).then(() => true, () => false);
  const card = () => g(() => {
    const el = document.querySelector('.lg');
    if (!el || el.hidden) return null;
    return {
      role: el.getAttribute('role'),
      level: (el.querySelector('.lg-me b') || {}).textContent,
      rows: [...el.querySelectorAll('.lg-row')].map((r) => ({ name: r.querySelector('b').textContent, state: ['won', 'next', 'locked'].find((c) => r.classList.contains(c)), tag: r.querySelector('em').textContent, pay: (r.querySelector('.lg-pay') || {}).textContent })),
    };
  });
  const leagueTasks = () => g(() => window.__ori.game3d.game.quests.open().filter((t) => /^league-/.test(t.tplId)).map((t) => t.tplId));
  const chip = () => g(() => (document.querySelector('.fv-gohint') || {}).textContent.replace(/\s+/g, ' ').trim());
  const cardOpen = () => page.waitForFunction(() => { const el = document.querySelector('.lg'); return !!el && !el.hidden; }, null, { timeout: 3000 }).then(() => true, () => false);
  const progress = async () => (await S()).progress;

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.setHour(15); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); window.__tl = new Set(); window.__tt = setInterval(() => { for (const t of document.querySelectorAll('.fv-toast')) window.__tl.add(t.textContent); }, 40); window.__mo = new MutationObserver((ml) => { for (const m of ml) for (const n of m.addedNodes) if (n.classList && n.classList.contains('fv-toast')) window.__tl.add(n.textContent); }); window.__mo.observe(document.body, { childList: true, subtree: true }); }); // (every toast ever added counts, even one pushed out in the same frame by two more)
  await sleep(400);

  /** Into the garage, to the board, Space: the card. */
  const toBoard = async () => {
    if ((await g(() => window.__ori.game3d.insideId())) !== 'workshop') {
      await g(() => window.__ori.game3d.enter('workshop'));
      await page.waitForFunction(() => window.__ori.game3d.insideId() === 'workshop', null, { timeout: 8000 });
      await sleep(400);
    }
    const room = await g(() => window.__ori.game3d.insideInfo());
    const spot = room.spots.find((p) => p.use === 'league');
    if (spot) await g((p) => window.__ori.game3d.teleport({ x: p.x + 1.0, z: p.z }, -Math.PI / 2), spot);
    await page.waitForFunction(() => { const h = document.querySelector('.fv-gohint'); return !!h && h.classList.contains('on') && /Sababa Cup/.test(h.textContent); }, null, { timeout: 4000 }).catch(() => {});
    const label = await chip();
    await page.keyboard.press('Space');
    await cardOpen();
    return { spot, label };
  };
  /** Out of the garage, into Ori's own car on the start line; wait for the countdown to end. */
  const toStart = async (uid) => {
    await g(() => window.__ori.game3d.leave());
    await page.waitForFunction(() => !window.__ori.game3d.insideId(), null, { timeout: 8000 });
    for (let k = 0; k < 8; k++) { await sleep(450); if (await g(() => window.__ori.game3d.game.enterOwnCar())) break; } // (the door is still swinging for a moment)
    await g(() => window.__ori.game3d.game.placeCar(-19, 5, -Math.PI / 2));
    await page.waitForFunction((u) => { const m = window.__ori.game3d.game.missions.get(u); return !!m && ['count', 'go'].includes(m.state.stage); }, uid, { timeout: 8000 });
    await page.waitForFunction((u) => window.__ori.game3d.game.missions.get(u).state.stage === 'go', uid, { timeout: 9000 });
  };
  /** The lap: the car is put on each ring in turn (a loss: the rival is already home). */
  const lap = async (uid, { win = true } = {}) => {
    if (!win) await g((u) => { window.__ori.game3d.game.missions.get(u).state.rivalDone = 0.001; }, uid);
    for (const [x, z] of RACE.loop.slice(1)) {
      await g(([x, z]) => window.__ori.game3d.game.placeCar(x, z, 0), [x, z]);
      await sleep(170);
    }
    await page.waitForFunction((u) => window.__ori.game3d.game.quests.get(u).state === 'done', uid, { timeout: 8000 });
    await sleep(500);
  };
  const uidOf = (tpl) => g((t) => { const q = window.__ori.game3d.game.quests.open().find((x) => x.tplId === t); return q ? q.uid : null; }, tpl);
  const leaveCar = async () => { await g(() => window.__ori.game3d.game.onAction('interact')); await sleep(400); };

  // ── 1: the board in the garage: two cups out of town, no race in the city ──
  const b1 = await toBoard();
  const c1 = await card();
  check(!!b1.spot && !!c1 && c1.role === 'dialog' && c1.rows.map((r) => r.name).join() === 'Sababa Speedway,Old Port Sprint,Coast Road Cup,Ridge Run' && c1.rows[0].state === 'next' && c1.rows.slice(1).every((r) => r.state === 'locked'), `the board has only the four cups out of town: ${c1 && c1.rows.map((r) => `${r.name} ${r.state}`).join(', ')}`);
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T51-board.png') });
  await page.keyboard.press('Digit3');
  await sleep(250);
  check(!!(await card()), 'a locked cup does nothing');
  await page.keyboard.press('Escape');
  await sleep(300);
  check(!(await card()) && !(await S()).paused, 'Esc closes the card (and does not open the pause menu)');
  await g(() => window.__ori.game3d.leave());
  await page.waitForFunction(() => !window.__ori.game3d.insideId(), null, { timeout: 8000 });
  await sleep(900);

  // ── 6b: the start is at the edge of town: a gate, the chip, R (and only there) ──
  check(await g(() => !!window.__ori.game3d.game.scene.getObjectByName('start-gate')), 'the gate stands at the edge of town (a banner, a chequered line)');
  await g(() => window.__ori.game3d.teleport({ x: 20, z: 5 }, Math.PI / 2));
  await sleep(500);
  await page.keyboard.press('KeyR');
  await sleep(500);
  check(!(await card()) && (await saw(/out of town/)), 'R in the city only says where the races are');
  await g(([x]) => window.__ori.game3d.teleport({ x: x - 8, z: 5 }, Math.PI / 2), [EXIT.x]);
  await page.waitForFunction(() => { const h = document.querySelector('.fv-gohint'); return !!h && h.classList.contains('on') && /Sababa Cup/.test(h.textContent); }, null, { timeout: 4000 }).catch(() => {});
  check(/R The Sababa Cup: pick a race/.test(await chip()), `at the gate the chip says so ("${await chip()}")`);
  await page.keyboard.press('Space');
  await sleep(500);
  check(!(await card()), 'Space does not take the board (it is for getting into the car)');
  await page.keyboard.press('KeyR');
  check(await cardOpen(), 'R opens the board at the gate');
  await page.keyboard.press('Escape');
  await sleep(300);
  for (let k = 0; k < 8; k++) { await sleep(450); if (await g(() => window.__ori.game3d.game.enterOwnCar())) break; }
  await g(([x]) => window.__ori.game3d.game.placeCar(x - 6, 5, Math.PI / 2), [EXIT.x]);
  await sleep(2000);
  check(!(await card()), 'stopping the car there does not pop the board up by itself');
  await page.keyboard.press('KeyR');
  check(await cardOpen(), 'in the car, R opens it');
  await page.keyboard.press('Escape');
  await sleep(300);
  await g(() => window.__ori.game3d.game.onAction('interact')); // (out of the car)
  await sleep(500);


  // ── 6c: a cup out of town: the board lists it, a pick drives him there, a whole field races, the place pays, and he is back at the line ──
  await g(() => { const pr = window.__ori.game3d.game.campaign.state.progress; pr.driverXp = 60; pr.leagueWon = {}; });
  await g(([x]) => window.__ori.game3d.teleport({ x: x - 8, z: 5 }, Math.PI / 2), [EXIT.x]);
  await sleep(500);
  await page.keyboard.press('KeyR');
  await cardOpen();
  const cups = await g(() => [...document.querySelectorAll('.lg-row')].map((r) => ({ name: r.querySelector('b').textContent, state: ['won', 'next', 'locked'].find((c) => r.classList.contains(c)), pay: (r.querySelector('.lg-pay') || {}).textContent })));
  check(cups.length === 4 && cups[0].name === 'Sababa Speedway' && cups[0].state === 'next' && cups[1].state === 'locked' && /1st 150/.test(cups[0].pay), `the board lists the cups out of town: ${cups.map((c) => `${c.name} ${c.state}`).join(', ')}`);
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T53-board-cups.png') });
  const pre = await S();
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => !!window.__ori.game3d.game.track, null, { timeout: 8000 });
  check((await g(() => window.__ori.game3d.game.track.id)) === 'speedway', 'a pick drives him out of town, to the Sababa Speedway');
  await sleep(700);
  check(await g(() => { const w = window.__ori.game3d.game.scene.getObjectByName('track-speedway'); return !!w && w.visible && document.querySelector('.pl-mini').hidden; }), 'the track is there and the minimap is put away');
  const uidC = await uidOf('cup-speedway');
  await page.waitForFunction((u) => { const m = window.__ori.game3d.game.missions.get(u); return !!m && ['count', 'go'].includes(m.state.stage); }, uidC, { timeout: 8000 });
  check((await g((u) => window.__ori.game3d.game.missions.get(u).targets().filter((t) => t.kind === 'rival').length, uidC)) === 4, 'four rivals on the grid: a whole field, not one against one');
  await page.screenshot({ path: join(SHOTS, 'T53-grid.png') });
  // the countdown holds the car: W pressed during the numbers moves nothing (no false start)
  await page.waitForFunction((u) => window.__ori.game3d.game.missions.get(u).state.stage === 'count', uidC, { timeout: 8000 }).catch(() => {});
  const p0 = await g(() => { const c = window.__ori.game3d.state().car; return { x: c.x, z: c.z }; });
  await page.keyboard.down('KeyW');
  await sleep(900);
  const hold = await g((u) => { const c = window.__ori.game3d.state().car; const m = window.__ori.game3d.game.missions.get(u); return { x: c.x, z: c.z, stage: m.state.stage, locked: m.locked, panel: (document.querySelector('.pl-race') || {}).textContent || '' }; }, uidC);
  check(hold.stage === 'count' && hold.locked && Math.hypot(hold.x - p0.x, hold.z - p0.z) < 0.5, `W pressed during the countdown moves nothing (${Math.hypot(hold.x - p0.x, hold.z - p0.z).toFixed(2)} m, stage ${hold.stage})`);
  check(/GET READY/.test(hold.panel), `the panel counts down with the numbers ("${hold.panel}")`);
  await page.waitForFunction((u) => window.__ori.game3d.game.missions.get(u).state.stage === 'go', uidC, { timeout: 9000 });
  await sleep(900);
  await page.keyboard.up('KeyW');
  const gone = await g((u) => { const c = window.__ori.game3d.state().car; const m = window.__ori.game3d.game.missions.get(u); return { x: c.x, z: c.z, locked: m.locked, rings: m.targets().filter((t) => t.kind === 'checkpoint').length, panel: (document.querySelector('.pl-race') || {}).textContent || '' }; }, uidC);
  check(!gone.locked && Math.hypot(gone.x - p0.x, gone.z - p0.z) > 3, `GO: the car is free and goes (${Math.hypot(gone.x - p0.x, gone.z - p0.z).toFixed(1)} m in a second)`);
  check(/LAP1\/2/.test(gone.panel) && /PLACE\d\/5/.test(gone.panel) && /TIME0:0\d\.\d/.test(gone.panel), `the panel says the lap, the place and the time ("${gone.panel}") instead of a ring per 25 m`);
  check(gone.rings === 0, 'no glowing ring on the road: the road is the way');
  await page.screenshot({ path: join(SHOTS, 'T57-race-hud.png') });
  // the other cars are solid: a car put on top of a rival is pushed off him and the rival is shoved
  const bump = await g((u) => { const gm = window.__ori.game3d.game; const m = gm.missions.get(u); const c = m.cars()[0]; gm.placeCar(c.x, c.z, c.h); return true; }, uidC);
  const shoved = await page.waitForFunction((u) => window.__ori.game3d.game.missions.get(u).field.some((r) => r.stun > 0), uidC, { timeout: 2000 }).then(() => true, () => false);
  check(bump && shoved, 'a car put on a rival bumps him (he is shoved and loses speed)');
  // the obstacles: a cone is knocked over, a stack of tyres is solid, oil takes the grip
  const hzInfo = await g(() => { const h = window.__ori.game3d.game.hz; return h ? { n: h.list.length, kinds: [...new Set(h.list.map((o) => o.kind))].sort().join() } : null; });
  check(!!hzInfo && hzInfo.n >= 8, `the Speedway has obstacles on the road (${hzInfo && hzInfo.n}: ${hzInfo && hzInfo.kinds})`);
  const cone = await g(() => { const gm = window.__ori.game3d.game; const o = gm.hz.list.find((x) => x.kind === 'cone'); gm.placeCar(o.x, o.z, 0); return o.i; });
  const knocked = await page.waitForFunction((i) => window.__ori.game3d.game.hz.down.has(i), cone, { timeout: 2000 }).then(() => true, () => false);
  check(knocked, 'driving into a cone knocks it over');
  const oilO = await g(() => { const gm = window.__ori.game3d.game; const o = gm.hz.list.find((x) => x.kind === 'oil'); gm.placeCar(o.x, o.z, 0); return !!o; });
  const slick = await page.waitForFunction(() => window.__ori.game3d.game.hz.oil > 0, null, { timeout: 2000 }).then(() => true, () => false);
  check(oilO && slick, 'driving into oil takes the grip for a moment');
  await page.screenshot({ path: join(SHOTS, 'T57-oil.png') });
  const c0 = await g(() => { const c = window.__ori.game3d.state().car; return { x: c.x, z: c.z }; });
  await g(([x, z]) => window.__ori.game3d.game.placeCar(x + 60, z + 60, 0), [c0.x, c0.z]);
  await sleep(500);
  const off = await g(() => { const c = window.__ori.game3d.state().car; return { x: c.x, z: c.z }; });
  check(buildTrack('speedway').nearest(off.x, off.z).dist < 9, 'the barrier puts a car that left the road back on it');
  const T = buildTrack('speedway');
  for (let l = 0; l < 2; l++) for (const c of T.cps) { await g(([x, z]) => window.__ori.game3d.game.placeCar(x, z, 0), [c.x, c.z]); await sleep(75); }
  await page.waitForFunction((u) => window.__ori.game3d.game.quests.get(u).state === 'done', uidC, { timeout: 10000 });
  const won = await S();
  check(won.progress.leagueWon.speedway === true && won.progress.driverXp - pre.progress.driverXp === 90 && won.peaches - pre.peaches >= 150, `first of five: the cup, +${won.progress.driverXp - pre.progress.driverXp} driver XP, +${won.peaches - pre.peaches} peaches`);
  check(await saw(/The Sababa Cup: you won the Sababa Speedway!/), 'with a toast');
  await page.waitForFunction(() => !window.__ori.game3d.game.track, null, { timeout: 14000 });
  await sleep(800);
  const back = await g(() => { const c = window.__ori.game3d.state().car; return c ? { x: c.x, z: c.z } : null; });
  check(!!back && Math.hypot(back.x - (EXIT.x - 9), back.z - 5) < 8 && !(await g(() => document.querySelector('.pl-mini').hidden)), 'a few seconds after the finish he is back at the start line in town, and the minimap is back');
  await g(() => window.__ori.game3d.game.onAction('interact')); // (out of the car)
  await sleep(400);

  // ── 6d: the Sababa Open: three fights in one night, each starting with what was left and some of it back ──
  await g(([ids]) => { const gm = window.__ori.game3d.game; gm.campaign.state.boxer.beaten = ids; gm.campaign.state.love = 100; }, [LADDER.slice(0, 3).map((f) => f.id)]);
  await g(() => { const a = window.__ori.game3d.game.fight.apron(); window.__ori.game3d.teleport({ x: a.x, z: a.z }, Math.PI); });
  await sleep(500);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 6000 });
  const nightRow = await g(() => { const rs = [...document.querySelectorAll('.fi-row')]; const r = rs[rs.length - 1]; return r ? { name: r.querySelector('b').textContent, locked: r.classList.contains('locked') } : null; });
  check(!!nightRow && nightRow.name === 'Sababa Open' && !nightRow.locked, `the ring's menu has a night of three fights: ${JSON.stringify(nightRow)}`);
  await page.evaluate(() => { const rs = [...document.querySelectorAll('.fi-row')]; rs[rs.length - 1].click(); });
  const hpLeft = [0.3, 0.2];
  const seen = [];
  for (let k = 0; k < 3; k++) {
    await page.waitForFunction(() => window.__ori.game3d.game.fight.phase === 'fight', null, { timeout: 20000 });
    await sleep(400);
    seen.push(await g(() => { const b = window.__ori.game3d.game.fight.bout; return { who: b.opp.name, hp: b.P.hp / b.P.maxHp }; }));
    await g(([left]) => { const b = window.__ori.game3d.game.fight.bout; if (left) b.P.hp = b.P.maxHp * left; b.O.hp = 0; b.O.state = 'ko'; }, [hpLeft[k] || 0]);
    await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.cardOpen, null, { timeout: 15000 });
    if (k < 2) {
      check(/Next: /.test(await g(() => document.querySelector('.fi-btn.primary').textContent)), `after fight ${k + 1} the card says who is next: "${await g(() => document.querySelector('.fi-btn.primary').textContent.trim())}"`);
      await page.click('.fi-btn.primary');
    }
  }
  check(seen.length === 3 && seen[0].hp > 0.95 && Math.abs(seen[1].hp - 0.7) < 0.03 && Math.abs(seen[2].hp - 0.6) < 0.03, `each fight starts with what was left plus 40 %: ${seen.map((x) => `${x.who} ${Math.round(x.hp * 100)} %`).join(', ')}`);
  const nightDone = await S();
  check(nightDone.progress.openWins === 1, `the third win is the night: openWins ${nightDone.progress.openWins}`);
  check(await saw(/You won the Sababa Open/), "and a toast says so");
  await page.click('.fi-btn.primary');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 8000 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__ori.game3d.game.fight.active && !window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 8000 });
  await sleep(1200);

  // ── 7: the trophies, the save ──
  await g(() => { const pr = window.__ori.game3d.game.campaign.state.progress; pr.leagueWon = { moti: true, albert: true, roee: true, dov: true, maya: true, bossB: true, uzi: true, speedway: true, harbor: true, coast: true, ridge: true }; pr.driverXp = 800; window.__ori.game3d.game.campaign.save(); });
  await sleep(2000);
  const fin = await progress();
  check(fin.trophies.includes('cup1') && fin.trophies.includes('cupall') && fin.trophies.includes('roadtrip') && fin.trophies.includes('openchamp'), `"Sababa Cup rookie" and "Champion of the Cup" (${fin.trophies.filter((x) => /cup/.test(x)).join()})`);
  const rt = await g(() => {
    const c = window.__ori.game3d.game.campaign;
    const was = JSON.stringify([c.state.progress.driverXp, c.state.progress.leagueWon, c.state.progress.leagueRaces]);
    const r = c.importCode(c.exportCode());
    return { ok: r.ok, same: was === JSON.stringify([c.state.progress.driverXp, c.state.progress.leagueWon, c.state.progress.leagueRaces]) };
  });
  check(rt.ok && rt.same, 'the save code carries the driver XP, the stars and the race count');
  await g(() => { clearInterval(window.__tt); if (window.__mo) window.__mo.disconnect(); });
}
