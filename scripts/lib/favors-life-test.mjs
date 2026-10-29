// "Ori, Can You...?" browser checks (T63, the life of Ori): no phone and no messages; hello with speech bubbles and the love of the neighbourhood; the goals; the journal;
// the office with Shilo and the computer (games inside the game); THE RING: a real fight with the real keys, XP and levels, the hidden last boss; the day that rolls over.
// A scripted player uses the keyboard (H, Tab, Space, G, J, K, L, WASD, digits).
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';

export async function runFavorsLife(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`life: ${msg}`) : fail(`life: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const S = () => g(() => window.__ori.game3d.state());
  const shot = async (name) => { await settle(session, 2); await page.screenshot({ path: join(SHOTS, name) }); };
  const tp = (p, h) => g(([p, h]) => window.__ori.game3d.teleport(p, h), [p, h]);
  const hello = (id) => g((id) => window.__ori.game3d.game.sayHello(id), id);

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.setHour(11); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); });

  // ── no phone, no messages ──
  await g(() => window.__ori.game3d.setHour(14));
  await sleep(1200);
  const s0 = await S();
  check(s0.quests.arrived === 0 && s0.quests.open === 0, `no favours arrive by phone any more (${s0.quests.arrived} messages by 14:00)`);
  check(await g(() => { const b = document.querySelector('.fv-phonebtn'); return !b || getComputedStyle(b).display === 'none'; }) && (await g(() => document.querySelectorAll('.fv-note').length)) === 0, 'there is no phone button and no banner');
  check(await g(() => /LOVE/.test(document.querySelector('.fv-meters').textContent) && /BOXER/.test(document.querySelector('.fv-meters').textContent)), 'the HUD shows the love of the neighbourhood and the boxer level');
  check(s0.goal === 'hello' && (await g(() => /Say hello/.test(document.querySelector('.fv-goal').textContent))), 'one goal at a time: "Say hello to 5 people"');

  // ── hello: five people, speech bubbles, hearts, love, the first goal pays ──
  await g(() => { window.__ori.game3d.setHour(12); window.__ori.game3d.teleport('park'); });
  await sleep(400);
  const a0 = await S();
  for (const id of ['tourist', 'parrot', 'roee', 'albert', 'moti']) { await hello(id); await sleep(150); }
  await sleep(800);
  const a1 = await S();
  check(a1.progress.hellos === 5 && a1.love > a0.love + 8, `five hellos: the love goes up (${a0.love.toFixed(1)} -> ${a1.love.toFixed(1)})`);
  check(await g(() => document.querySelectorAll('.fb').length >= 3), 'speech bubbles are over their heads');
  await shot('T63-hello.png');
  await sleep(1500);
  const a2 = await S();
  check(a2.goal === 'ringfind' && a2.peaches > a0.peaches && a2.boxer.xp > 0, `the goal is done: it paid peaches and XP, and the next one opens: find the ring (${a2.goal})`);
  const again = a2.love;
  await hello('moti');
  await sleep(300);
  check((await S()).love === again, 'saying hello to the same person again at once gives nothing (no farming)');

  // ── find the ring: the goal chip says so, the beam and the map lead there, and stepping up to the court does it ──
  check(await g(() => /Find The Ring/.test(document.querySelector('.fv-goal').textContent)), 'the goal chip says "Find The Ring"');
  check(await g(() => { const m = document.querySelector('.fv-keys'); return !!m && /map/.test(m.textContent); }), 'the key hints mention the map (M)');
  await g(() => { const gm = window.__ori.game3d.game; const p = gm.fight.apron(); window.__ori.game3d.teleport({ x: p.x, z: p.z }, Math.PI); });
  await sleep(1500);
  const a3 = await S();
  check(a3.goal === 'office' && a3.progress.goalsDone.includes('ringfind'), `the ring is found (it pays) and the next goal opens (${a3.goal})`);

  // ── the big map (M): the ring, the office, the garage, the cafe, his car and every other place with what is there; a click follows a place; Esc closes it ──
  await page.keyboard.press('KeyM');
  await sleep(400);
  const mp = await g(() => ({ rows: document.querySelectorAll('.mp-list li').length, text: document.querySelector('.mp-list').textContent, others: document.querySelector('.mp-others').textContent }));
  check((await S()).mapOpen && mp.rows >= 15 && /The Ring/.test(mp.text) && /Ori's car/.test(mp.text) && /Maya, Noga/.test(mp.others), `M opens the big map: the stars and every other place with what is there (${mp.rows} rows)`);
  await shot('T64-map.png');
  await page.click('.mp-list li[data-p="startup"]');
  await sleep(300);
  check((await S()).tracked === 'startup', 'a click on a place follows it');
  await page.keyboard.press('Escape');
  await sleep(300);
  const m1 = await S();
  check(!m1.mapOpen && !m1.paused, 'Esc closes the map (and does not pause the game)');
  check(await g(() => /Heading to The Startup/.test(document.querySelector('.fv-goal').textContent)), 'the goal chip says where he is heading');
  await g(() => window.__ori.game3d.teleport('startup'));
  await sleep(1500);
  check((await S()).tracked === null, 'arriving at the place he followed ends it');
  await g(() => window.__ori.game3d.teleport('cafe'));
  await sleep(500);
  check(await g(() => { const h = document.querySelector('.fv-gohint').textContent; return /Go inside/.test(h) && /espresso/i.test(h); }), 'at a door the chip tells what is inside: "G Go inside - an espresso at the counter..."');

  // ── the car: he can say hello from inside it, "ORI CAR" is over it every time he steps out, and it is on the map ──
  await g(() => window.__ori.game3d.game.enterOwnCar());
  await sleep(400);
  check((await S()).driving, 'he is in his car');
  await g(() => { const gm = window.__ori.game3d.game; const d = gm.map.places.mum.door; gm.placeCar(d.x + d.nx * 5, d.z + d.nz * 5, Math.atan2(d.nx, d.nz)); });
  await page.waitForFunction(() => { const h = document.querySelector('.fv-talkhint:not(.fv-gohint).on'); return !!h && /Say hi to/.test(h.textContent); }, null, { timeout: 6000 }).catch(() => {}); // (the person must be found: wait for it, do not guess a time)
  await sleep(200);
  const hellos0 = (await S()).progress.hellos;
  check(await g(() => { const h = document.querySelector('.fv-talkhint:not(.fv-gohint).on'); return !!h && /Say hi to/.test(h.textContent); }), 'in the car the chip offers "H Say hi to ..."');
  await page.keyboard.press('KeyH');
  await sleep(1300);
  check((await S()).progress.hellos === hellos0 + 1 && (await g(() => document.querySelectorAll('.fb').length)) >= 1, 'H says hello to a person from inside the car: the bubble, the answer, the love');
  await page.keyboard.press('KeyF');
  await sleep(700);
  const car2 = await S();
  check(!car2.driving && !!car2.carTag && car2.carTag.visible, '"ORI CAR" is over his car again as soon as he steps out');
  await g(() => window.__ori.game3d.teleport('park')); // (far from the car: next to it the arrival would end the following at once)
  await sleep(400);
  await page.keyboard.press('KeyM');
  await sleep(400);
  await page.click('.mp-list li[data-p="car"]');
  await sleep(300);
  check((await S()).tracked === 'car', 'his car is on the map, and a click on it follows it');
  await page.keyboard.press('KeyM');
  await sleep(300);
  check(await g(() => /Heading to Ori's car/.test(document.querySelector('.fv-goal').textContent)), 'the goal chip leads to the car');
  await g(() => { const gm = window.__ori.game3d.game; gm.enterOwnCar(); });
  await sleep(300);
  await page.keyboard.press('KeyF');
  await sleep(500);
  check((await S()).tracked === null, 'getting into the car ends it');

  // ── the journal ──
  await page.keyboard.press('Tab');
  await sleep(500);
  check(await g(() => { const c = document.querySelector('.jr-card'); return !!c && /Love of the neighbourhood/.test(c.textContent) && /The ladder/.test(c.textContent) && /Goals/.test(c.textContent); }), 'Tab opens the journal: love, boxer, the ladder, the goals');
  await shot('T63-journal.png');
  await page.keyboard.press('Tab');
  await sleep(300);
  check(await g(() => document.querySelector('.jr-card') === null), 'Tab closes it');

  // ── the office: Shilo, and the computer with games in it ──
  await tp('startup');
  await sleep(300);
  await page.keyboard.press('KeyG');
  await page.waitForFunction(() => window.__ori.game3d.insideId() === 'startup', null, { timeout: 5000 });
  await sleep(800);
  const room = await g(() => window.__ori.game3d.insideInfo());
  check(room.npcs.some((n) => n.id === 'shilo'), 'Shilo works at The Startup');
  const shilo = room.npcs.find((n) => n.id === 'shilo');
  await g((p) => window.__ori.game3d.teleport({ x: p.x + 0.8, z: p.z + 1.0 }, Math.PI), shilo);
  await sleep(600);
  await page.keyboard.press('KeyH');
  await sleep(1100);
  check(await g(() => [...document.querySelectorAll('.fb-boss')].some((b) => /Shilo/i.test(b.textContent))), 'H next to Shilo: he answers in his own bubble');
  await shot('T63-office.png');
  await sleep(1500);
  const o1 = await S();
  check(o1.progress.shiloHi === 1 && o1.goal === 'arcade', `"say hi to Shilo" is done, the next goal is the computer (${o1.goal})`);
  const pc = room.spots.find((p) => p.use === 'arcade');
  await g((p) => window.__ori.game3d.teleport({ x: p.x, z: p.z + 1.1 }, Math.PI), pc);
  await sleep(500);
  const p0 = (await S()).peaches;
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__ori.game3d.game.arcade.isOpen, null, { timeout: 3000 });
  await shot('T63-arcade-boot.png');
  await page.waitForFunction(() => window.__ori.game3d.game.arcade.mode === 'menu', null, { timeout: 6000 });
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => window.__ori.game3d.game.arcade.mode === 'tetris', null, { timeout: 3000 });
  for (let i = 0; i < 4; i++) { await page.keyboard.press('KeyD'); await page.keyboard.press('Space'); await sleep(160); }
  await shot('T63-arcade-tetris.png');
  const mid = await g(() => window.__ori.game3d.game.arcade.run.view().score);
  check(mid > 0, `the blocks fall and can be slammed with Space (${mid} points)`);
  for (let i = 0; i < 40 && !(await g(() => window.__ori.game3d.game.arcade.run.view().over)); i++) { await page.keyboard.press(i % 2 ? 'KeyA' : 'KeyD'); await page.keyboard.press('Space'); await sleep(110); }
  await sleep(700);
  const o2 = await S();
  check(o2.peaches > p0 && o2.progress.arcade === 1, `the run ended and paid peaches by its score (+${o2.peaches - p0})`);
  await page.keyboard.press('Escape'); // back to the menu
  await sleep(300);
  await page.keyboard.press('Escape'); // switch off
  await sleep(300);
  check(!(await g(() => window.__ori.game3d.game.arcade.isOpen)) && !(await S()).paused, 'Esc switches the computer off (the game is not paused)');
  await sleep(1000);
  check(['ring1', 'love25', 'ladder3'].includes((await S()).goal), `"play a game on the computer" is done (next goal: ${(await S()).goal})`);
  await g(() => window.__ori.game3d.leave());
  await sleep(500);

  // ── THE RING: step up, pick Moti, and box him with the real keys ──
  await g(() => { const gm = window.__ori.game3d.game; gm.campaign.state.boxer.level = 3; const p = gm.fight.apron(); window.__ori.game3d.teleport({ x: p.x, z: p.z }, Math.PI); });
  await sleep(700);
  check(await g(() => /Step into The Ring/.test(document.querySelector('.fv-gohint').textContent)), 'at the foot of the ring the chip says "Space Step into The Ring"');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 3000 });
  check(await g(() => document.querySelectorAll('.fi-row').length === 5 && /Pick your fight/.test(document.querySelector('.fi-card').textContent)), 'the ladder: five neighbours to fight (the sixth is a secret)');
  await shot('T63-ring-menu.png');
  const locked = await g(() => [...document.querySelectorAll('.fi-row')].filter((r) => r.classList.contains('locked')).length);
  check(locked === 4, 'only the first is open: the others need the one before, and love');
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.phase === 'intro' || window.__ori.game3d.game.fight.phase === 'fight', null, { timeout: 8000 });
  await sleep(900);
  await shot('T63-ring-intro.png');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.phase === 'fight', null, { timeout: 8000 });
  const day0 = (await S()).clock.progress;
  const held = new Set();
  const hold = async (k, on) => { if (on && !held.has(k)) { held.add(k); await page.keyboard.down(k); } else if (!on && held.has(k)) { held.delete(k); await page.keyboard.up(k); } };
  const press = async (k) => { await page.keyboard.down(k); await sleep(40); await page.keyboard.up(k); };
  let lastPunch = 0; let lastDash = 0; let lastGuard = 0; let shots = 0; let rounds = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 170000) {
    const f = await g(() => window.__ori.game3d.game.fight.snapshot());
    if (!f.P || f.over || f.phase === 'result') break;
    if (f.phase !== 'fight') { await sleep(60); continue; }
    rounds++;
    const P = f.P; const O = f.O;
    const dx = O.x - P.x; const dz = O.z - P.z; const d = Math.hypot(dx, dz) || 1;
    const ax = dx / d; const az = dz / d;
    const right = { x: f.side.z, z: -f.side.x };
    const want = d > 1.7 ? { x: ax, z: az } : d < 1.15 ? { x: -ax, z: -az } : { x: 0, z: 0 };
    const adv = want.x * right.x + want.z * right.z; const into = -(want.x * f.side.x + want.z * f.side.z);
    const now = Date.now();
    const winding = O.state === 'attack' && O.phase === 'wind';
    const left = O.wind - O.t;
    if (winding && left < 0.2 && left > 0.03 && d < 2.5 && now - lastDash > 600) { lastDash = now; await hold('KeyL', false); await hold('KeyW', true); await press('Space'); await sleep(120); await hold('KeyW', false); continue; }
    const guard = winding && d < 2.4 && now - lastDash > 250;
    if (guard) lastGuard = now;
    await hold('KeyL', guard || now - lastGuard < 160);
    await hold('KeyD', adv > 0.35 && !guard); await hold('KeyA', adv < -0.35 && !guard); await hold('KeyW', into > 0.35); await hold('KeyS', into < -0.35);
    const open = O.state === 'hit' || O.state === 'guardbreak' || (O.state === 'attack' && O.phase === 'rec');
    if (!guard && d <= 1.8 && now - lastPunch > 260 && (open || Math.random() < 0.06)) { lastPunch = now; await press(Math.random() < 0.7 ? 'KeyJ' : 'KeyK'); }
    if (!shots && Date.now() - t0 > 6000) { shots = 1; await shot('T63-fight.png'); }
    await sleep(35);
  }
  for (const k of [...held]) await hold(k, false);
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.cardOpen, null, { timeout: 15000 }).catch(() => {});
  const res = await g(() => ({ card: document.querySelector('.fi-card') && document.querySelector('.fi-card').textContent, snap: window.__ori.game3d.game.fight.snapshot() }));
  check(rounds > 40 && !!res.snap.result && res.snap.result.winner === 'player', `a real fight with the real keys: Ori beat Moti (${res.snap.result ? res.snap.result.how : '?'}, ${Math.round(res.snap.result ? res.snap.result.time : 0)} s, ${rounds} decisions)`);
  check(/XP/.test(res.card || '') && /peaches/.test(res.card || ''), 'the card after the fight: XP, peaches and love');
  await shot('T63-ring-result.png');
  const b1 = await S();
  check(b1.boxer.beaten.includes('moti') && b1.boxer.wins === 1 && b1.boxer.xp + (b1.boxer.level - 1) * 1 > 0 && (await S()).clock.progress - day0 < 0.02, 'Moti is beaten and written down; the clock waited while he fought');
  await page.click('.fi-btn.primary');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 8000 });
  check(await g(() => { const r = [...document.querySelectorAll('.fi-row')]; return r[0].classList.contains('beaten') && !r[1].classList.contains('locked'); }), 'back to the ladder: Moti is beaten, Albert is open');
  await page.keyboard.press('Escape');
  await sleep(600);

  // ── the hidden last boss: nobody knew he existed ──
  await g(() => { const gm = window.__ori.game3d.game; const b = gm.campaign.state.boxer; b.level = 8; b.beaten = ['moti', 'albert', 'inspector', 'dov', 'coach']; b.reveal = true; });
  await sleep(300);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 3000 });
  check(await g(() => { const r = document.querySelectorAll('.fi-row'); return r.length === 6 && r[5].classList.contains('secret') && /\?\?\?/.test(r[5].textContent); }), 'after the champion the ladder shows a sixth name: ???');
  await page.keyboard.press('Digit6');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.phase === 'intro', null, { timeout: 8000 });
  await sleep(1200);
  check(await g(() => /\?\?\?/.test(document.querySelector('.fi-big').textContent)), 'the lights go strange: ???');
  await shot('T63-boss-intro.png');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.phase === 'fight', null, { timeout: 12000 });
  // how fast is he? the biggest distance he covers in half a second
  // (the flow is what this block tests, not the balance - which a pure test covers - so a passive Ori is kept on his feet: Shilo hits hard and would otherwise end the fight before the checks)
  const keepAlive = () => g(() => { const b = window.__ori.game3d.game.fight.bout; if (b && b.P) b.P.hp = b.P.maxHp; });
  let fastest = 0; let blinks = 0;
  for (let i = 0; i < 24; i++) {
    await keepAlive();
    const a = await g(() => window.__ori.game3d.game.fight.snapshot());
    await sleep(250);
    const b = await g(() => window.__ori.game3d.game.fight.snapshot());
    if (!a.O || !b.O) break;
    fastest = Math.max(fastest, Math.hypot(b.O.x - a.O.x, b.O.z - a.O.z) / 0.25);
    if (b.O.blinking > 0) blinks++;
  }
  check(fastest > 4.5, `Shilo moves at an absurd speed (${fastest.toFixed(1)} m/s; Ori walks at 2.7)`);
  await shot('T63-boss-fight.png');
  // finish him (the numbers are tested elsewhere): one clean jab at his last scrap of health
  await g(() => { const f = window.__ori.game3d.game.fight.bout; f.O.hp = 3; f.O.st = 150; });
  let sawDown = false; let sawUp = false; // (the first time his health runs out he goes down for a count and gets up; only the second time is the knock-out)
  for (let i = 0; i < 100; i++) {
    const f = await g(() => window.__ori.game3d.game.fight.snapshot());
    if (f.over || f.phase === 'result') break;
    if (f.O.state === 'down') sawDown = true; else if (sawDown) sawUp = true;
    await g(() => { const b = window.__ori.game3d.game.fight.bout; b.P.hp = b.P.maxHp; if (b.O.state !== 'down') b.O.hp = Math.min(b.O.hp, 3); if (b.O.state === 'idle' || b.O.state === 'attack') { b.O.x = b.P.x + 1.2; b.O.z = b.P.z; } });
    await press('KeyJ');
    await sleep(280);
  }
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.cardOpen, null, { timeout: 12000 }).catch(() => {});
  await sleep(500);
  const end = await S();
  check(sawDown && sawUp, 'the first knock-out blow is a knock-DOWN: he goes down for a count and gets up; the second one ends it');
  check(end.boxer.beaten.includes('shilo') && end.fight.result && end.fight.result.winner === 'player', `the hidden boss is beaten${end.fight.result ? '' : ` (no result: phase ${end.fight.phase})`}${end.fight.result && end.fight.result.winner !== 'player' ? ` (he won: ${end.fight.result.how})` : ''}`);
  await shot('T63-boss-result.png');
  await sleep(300);
  check(end.progress.goalsDone && (await g(() => window.__ori.game3d.game.campaign.state.progress.goalsDone)).includes('secret'), 'the last goal ("somebody is waiting in the ring") is done');
  await page.click('.fi-btn:not(.primary)');
  await page.waitForFunction(() => !window.__ori.game3d.game.fight.active, null, { timeout: 8000 });
  check(!(await S()).paused, 'leaving the ring puts Ori back on the street');

  // ── the day rolls over: everything is kept ──
  const keep = await S();
  await g(() => window.__ori.game3d.setHour(23.99));
  await page.waitForFunction(() => window.__ori.game3d.state().day === 2, null, { timeout: 10000 });
  await sleep(1200);
  const d2 = await S();
  check(d2.day === 2 && /^06:0\d$/.test(d2.clock.label) && d2.love === keep.love && d2.boxer.level >= 8 && d2.boxer.beaten.length === 6, `at midnight Ori sleeps and wakes on day 2 with his love (${Math.round(d2.love)}) and his level (${d2.boxer.level}) kept [day ${d2.day}, ${d2.clock.label}, love ${keep.love}->${d2.love}, beaten ${d2.boxer.beaten.length}]`);
  const saved = await g(() => { try { return JSON.parse(localStorage.getItem('ori-favors-week-v1')); } catch { return null; } });
  check(saved && saved.boxer.level >= 8 && saved.boxer.beaten.includes('shilo') && saved.love > 0 && saved.progress.hellos >= 5, `the whole life is saved (a new tab continues where he is) [${saved ? `lv ${saved.boxer.level}, love ${saved.love}, hellos ${saved.progress.hellos}, day ${saved.day}` : 'nothing saved'}]`);
  void blinks;

  // ── quitting after a whole life (the office, the ring, the crowd, the boss) leaves nothing behind ──
  await g(() => window.__ori.game3d.quit());
  await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 8000 });
  const mem = await g(() => window.__ori.game3d.lastMemory);
  check(mem && mem.geometries === 0 && mem.textures === 0, `quitting after the whole life leaves no GPU memory behind (${mem ? `${mem.geometries} geometries, ${mem.textures} textures` : 'no reading'})`);
}
