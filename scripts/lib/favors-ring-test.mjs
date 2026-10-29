// "Ori, Can You...?" browser checks (the polish of THE RING): the numbers that float over a fighter who is hit (white / gold / small grey, pooled, nothing leaks),
// the faces that flinch when they are hit, the SPEED BAG drill with the real keys (XP, less each time on the same day), and the touch buttons on a phone (only on a
// touch device, they do what the keys do). The scripted player uses the real keyboard / real touches.
import { join } from 'node:path';
import { SHOTS, sleep, settle, loadSite } from './harness.mjs';
import { xpFor } from '../../src/game3d/favors/training.js';

const FIGHT = 'window.__ori.game3d.game.fight';

/** The drill (and the ring) with the real keyboard. */
export async function runFavorsRing(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`ring: ${msg}`) : fail(`ring: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const S = () => g(() => window.__ori.game3d.game.state ? window.__ori.game3d.state() : null);
  const shot = async (name) => { await settle(session, 2); await page.screenshot({ path: join(SHOTS, name) }); };
  const press = async (k, ms = 40) => { await page.keyboard.down(k); await sleep(ms); await page.keyboard.up(k); };
  const visible = (sel) => g((sel) => [...document.querySelectorAll(sel)].filter((e) => !e.hidden).map((e) => ({ text: e.textContent, cls: e.className, t: e.style.transform })), sel);

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.setHour(15); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); });
  await g(() => { const gm = window.__ori.game3d.game; gm.campaign.state.boxer.level = 5; gm.campaign.state.love = 40; gm.fight.setCrowd(40); const p = gm.fight.apron(); window.__ori.game3d.teleport({ x: p.x, z: p.z }, Math.PI); });
  await sleep(700);
  check(await g(() => { const t = document.querySelector('.fi-touch'); return !t || t.hidden || getComputedStyle(t).display === 'none'; }), 'no touch buttons on a keyboard-and-mouse screen');

  // ── the menu now has the speed bag next to the ladder; the five rows are still five ──
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 5000 });
  check(await g(() => document.querySelectorAll('.fi-row').length === 5 && !!document.querySelector('.fi-train') && /Speed bag/.test(document.querySelector('.fi-train').textContent)), 'the menu of the ring: five fighters and a "Speed bag" button');
  await shot('ring-menu-bag.png');

  // ── floating numbers over the fighter who is hit ──
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.phase === 'fight', null, { timeout: 15000 });
  await sleep(300);
  check(await g(() => document.querySelectorAll('.fi-num').length === 10 && window.__ori.game3d.game.fight.ui.floatSlots === 10), 'ten number elements are made once, up front (pooled)');
  const fr = (on) => g((on) => { const u = window.__ori.game3d.game.fight.ui; u.freezeFloats(on); if (on) u.clearFloats(); }, on);
  const place = () => g(() => { const b = window.__ori.game3d.game.fight.bout; b.P.x = 0; b.P.z = 0.5; b.O.x = 0; b.O.z = -0.85; b.O.hp = b.O.maxHp; b.P.hp = b.P.maxHp; b.P.st = b.P.maxSt; });
  /** Where the head of a fighter is on the screen right now (from the sim's position and the real camera). */
  const headOnScreen = (who) => g((who) => {
    const gm = window.__ori.game3d.game; const f = gm.fight; const s = f.snapshot(); const c = f.center; const cam = gm.camera;
    const p = who === 'opp' ? s.O : s.P; const V = cam.position.constructor;
    const v = new V(c.x + p.x, f.floorY + 1.55, c.z + p.z).project(cam);
    const w = document.documentElement.clientWidth; const h = document.documentElement.clientHeight;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, w, h };
  }, who);
  const parse = (t) => { const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(t || ''); return m ? { x: +m[1], y: +m[2] } : null; };

  // white: a jab that lands
  await fr(true); await place();
  await press('KeyJ');
  await page.waitForFunction(() => [...document.querySelectorAll('.fi-num')].some((e) => !e.hidden && e.classList.contains('white')), null, { timeout: 4000 }).catch(() => {});
  const white = (await visible('.fi-num.white'))[0];
  check(!!white && /^\d+$/.test(white.text) && +white.text >= 1 && +white.text < 60, `a clean hit floats a white number over Moti (${white ? white.text : 'none'})`);
  if (white) {
    const p = parse(white.t); const h = await headOnScreen('opp');
    check(!!p && p.x > 0 && p.x < h.w && p.y > 0 && p.y < h.h && Math.abs(p.x - h.x) < 130 && p.y < h.y + 15 && p.y > h.y - 170, `...and it is over his head (number at ${p ? Math.round(p.x) : '?'},${p ? Math.round(p.y) : '?'} px, his head at ${Math.round(h.x)},${Math.round(h.y)})`);
  }
  await shot('ring-number-white.png');

  // gold: a counter (the payoff of a perfect dodge)
  await fr(true); await sleep(500); await place();
  await g(() => { window.__ori.game3d.game.fight.bout.P.counter = 1.2; });
  await press('KeyK');
  await page.waitForFunction(() => [...document.querySelectorAll('.fi-num')].some((e) => !e.hidden && e.classList.contains('gold')), null, { timeout: 4000 }).catch(() => {});
  const gold = (await visible('.fi-num.gold'))[0];
  check(!!gold && /^\d+$/.test(gold.text) && +gold.text > (white ? +white.text : 0), `a counter floats a bigger gold number (${gold ? gold.text : 'none'})`);
  await shot('ring-number-gold.png');

  // grey: a punch the guard took (hold L while he swings)
  await fr(true); await sleep(600); await place();
  await g(() => { window.__ori.game3d.game.fight.bout.O.z = -0.75; });
  await page.keyboard.down('KeyL');
  let grey = null;
  for (let i = 0; i < 400 && !grey; i++) { await sleep(30); grey = (await visible('.fi-num.grey'))[0]; if (i % 40 === 39) await place(); }
  await sleep(40);
  check(!!grey && /^\d+$/.test(grey.text) && +grey.text <= 5, `a blocked punch floats a small grey number over Ori (${grey ? grey.text : 'none'})`);
  if (grey) {
    const p = parse(grey.t); const h = await headOnScreen('player');
    check(!!p && Math.abs(p.x - h.x) < 130 && p.y < h.y + 15, 'the grey one is over Ori (the one who guarded), not over Moti');
  }
  const guardFace = await g(() => ({ name: window.__ori.game3d.game.ori.person.face.name, blocking: window.__ori.game3d.game.fight.bout.P.blocking }));
  check(guardFace.blocking && guardFace.name === 'determined', `with the guard up Ori's face is "determined" (${guardFace.name})`);
  await shot('ring-number-grey.png');
  await page.keyboard.up('KeyL');
  await fr(false);

  // a long flurry: still ten elements, never more numbers than that on screen
  await place();
  let most = 0;
  for (let i = 0; i < 24; i++) { await press(i % 3 === 2 ? 'KeyK' : 'KeyJ', 30); await sleep(70); most = Math.max(most, (await visible('.fi-num')).length); if (i % 6 === 5) await place(); }
  check(most >= 1 && most <= 10 && (await g(() => document.querySelectorAll('.fi-num').length)) === 10, `a flurry never adds elements: at most ${most} numbers at once, still 10 elements`);
  await sleep(1300);
  check((await visible('.fi-num')).length === 0 && (await g(() => window.__ori.game3d.game.fight.ui.floatsLive)) === 0, 'every number is gone after its second');

  // ── the faces flinch when they are hit (0.3 s) and go back ──
  await place();
  await g(() => { const b = window.__ori.game3d.game.fight.bout; b.O.ai = b.O.ai; });
  const face = await g(() => new Promise((resolve) => {
    const f = window.__ori.game3d.game.fight; const ori = window.__ori.game3d.game.ori; const t0 = performance.now();
    const base = { open: ori.person.face.cur.open, lid: ori.person.face.cur.lidUp }; let max = { open: base.open, lid: base.lid }; let hit = false; const hp0 = f.bout.P.hp;
    const id = setInterval(() => {
      const c = ori.person.face.cur; max = { open: Math.max(max.open, c.open), lid: Math.max(max.lid, c.lidUp) };
      f.bout.O.x = 0; f.bout.O.z = Math.min(f.bout.O.z, f.bout.P.z - 1.1); // (Moti stays close and swings at an idle Ori)
      if (f.bout.P.hp < hp0 - 1) hit = true;
      if (performance.now() - t0 > 9000) { clearInterval(id); setTimeout(() => resolve({ base, max, hit, end: { open: ori.person.face.cur.open, lid: ori.person.face.cur.lidUp } }), 900); }
    }, 8);
  }));
  check(face.hit && face.max.open > face.base.open + 0.15, `Ori is hit and his face flinches (mouth ${face.base.open.toFixed(2)} -> ${face.max.open.toFixed(2)})`);
  check(Math.abs(face.end.open - face.base.open) < 0.12, `a second later the face is back to normal (${face.end.open.toFixed(2)})`);

  // ── finish him, back to the ladder ──
  await g(() => { const b = window.__ori.game3d.game.fight.bout; b.rise = [0]; b.O.hp = 2; b.P.hp = b.P.maxHp; }); // (rise [0]: he goes down and does not get up: the count runs out)
  for (let i = 0; i < 40; i++) {
    const f = await g(() => window.__ori.game3d.game.fight.snapshot());
    if (f.over || f.phase === 'result') break;
    await g(() => { const b = window.__ori.game3d.game.fight.bout; b.P.hp = b.P.maxHp; if (b.O.state === 'idle' || b.O.state === 'attack') { b.O.x = b.P.x; b.O.z = b.P.z - 1.2; } });
    await press('KeyJ'); await sleep(260);
  }
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.cardOpen, null, { timeout: 15000 });
  check(await g(() => { const b = window.__ori.game3d.game.fight.bout; return b.O.state === 'ko' && b.O.willRise === false && b.result.how === 'ko' && b.result.winner === 'player'; }), 'he went down and did not get up (the dice said no): the count ran out, a K.O., the result card is up');
  await page.click('.fi-btn.primary');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 8000 });

  // ── the speed bag: B in the menu, three clicks, GO, 20 seconds of beats ──
  const xp0 = await g(() => { const b = window.__ori.game3d.game.campaign.state.boxer; return { xp: b.xp, level: b.level }; });
  await page.keyboard.press('KeyB');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.mode === 'bag' && window.__ori.game3d.game.fight.phase === 'intro', null, { timeout: 15000 });
  await sleep(900);
  check(await g(() => window.__ori.game3d.game.fight.stage.visible && window.__ori.game3d.game.fight.ui.bagOpen && document.querySelector('.fi-hud').hidden), 'B starts the drill: the bag and its stand are in the ring, the fight bars give way to the drill\'s HUD');
  await shot('ring-bag-intro.png');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.phase === 'fight', null, { timeout: 10000 });
  let shots = 0; let pressed = 0;
  for (let i = 0; i < 2500; i++) {
    const s = await g(() => window.__ori.game3d.game.fight.snapshot());
    if (!s.bag || s.bag.over) break;
    const up = s.bag.upcoming.find((u) => !u.hit && u.dt > -0.05);
    if (up && up.dt < 0.04) { await press(s.bag.nextHand === 'J' ? 'KeyJ' : 'KeyK', 30); pressed++; await sleep(90); } else await sleep(12);
    if (!shots && s.bag.time > 8) { shots = 1; await shot('ring-bag-mid.png'); }
  }
  const words = await g(() => document.querySelectorAll('.fi-num').length);
  check(pressed >= 20, `played with the real keys, on the beat (${pressed} punches)`);
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.cardOpen, null, { timeout: 15000 });
  const res = await g(() => ({ snap: window.__ori.game3d.game.fight.snapshot(), card: document.querySelector('.fi-card').textContent, s: window.__ori.game3d.state() }));
  const r1 = res.snap.bag.result;
  check(!!r1 && r1.hits >= 15 && r1.score > 1000 && r1.stars >= 1, `the run ends: ${r1 ? `${r1.hits} hits of ${r1.beats}, score ${r1.score}, ${r1.stars} star(s), best combo ${r1.maxCombo}` : 'no result'}`);
  const want1 = xpFor(r1, { today: 0 });
  check(new RegExp(`\\+${want1} XP`).test(res.card) && /SPEED BAG/.test(res.card) && /Coach:/.test(res.card), `the card pays a little XP (+${want1}) with a warm word from Coach`);
  check(res.s.boxer.xp + 0 === xp0.xp + want1 || res.s.boxer.level > xp0.level, `the XP is added to the boxer (${xp0.xp} -> ${res.s.boxer.xp})`);
  check(await g(() => document.querySelector('.fi-bag').hidden && document.querySelectorAll('[data-a]').length === 3), 'the drill\'s HUD is gone and the card offers: back to the ladder, train again, leave the ring');
  await shot('ring-bag-result.png');

  // a second run the same day pays less (the first one of the day is the best)
  await page.click('[data-a="retry"]');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.mode === 'bag' && window.__ori.game3d.game.fight.phase === 'fight', null, { timeout: 15000 });
  await g(() => { window.__ori.game3d.game.fight.run.update(30); }); // (the clock is run out at once: a bystander's run)
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.cardOpen, null, { timeout: 15000 });
  const res2 = await g(() => ({ snap: window.__ori.game3d.game.fight.snapshot(), card: document.querySelector('.fi-card').textContent, tr: window.__ori.game3d.game.campaign.state.progress.train }));
  const want2 = xpFor(res2.snap.bag.result, { today: 1 });
  check(res2.tr && res2.tr.n === 2 && new RegExp(`\\+${want2} XP`).test(res2.card), `the second run of the day pays less (+${want2} XP for ${res2.snap.bag.result.stars} stars)`);
  await page.click('[data-a="leave"]');
  await page.waitForFunction(() => !window.__ori.game3d.game.fight.active, null, { timeout: 10000 });
  check(await g(() => !window.__ori.game3d.game.fight.stage.visible && !window.__ori.game3d.state().paused), 'leaving puts the bag away and Ori back on the street');
  void words;

  // ── a clean quit after all of it: the bag, its texture, the numbers, the buttons: nothing is left behind ──
  await g(() => window.__ori.game3d.quit());
  await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 8000 });
  const mem = await g(() => window.__ori.game3d.lastMemory);
  check(mem && mem.geometries === 0 && mem.textures === 0, `quitting after the drill and the fights leaves no GPU memory behind (${mem ? `${mem.geometries} geometries, ${mem.textures} textures` : 'no reading'})`);
  check(await g(() => document.querySelectorAll('.fi-num, .fi-bag, .fi-touch, .fi-dot').length === 0), 'and no leftover elements of the ring in the page');
  void S;
}

/** A phone: touch buttons appear only there, and they do what the keys do. */
export async function runFavorsRingTouch(session, { ok, fail }) {
  const origin = new URL(session.page.url()).origin;
  const browser = session.context.browser();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.stack || e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const s2 = { context, page, errors, width: 390, height: 844 };
  const check = (cond, msg) => (cond ? ok(`touch: ${msg}`) : fail(`touch: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const shot = async (name) => { await settle(s2, 2); await page.screenshot({ path: join(SHOTS, name) }); };
  try {
    await loadSite(s2, origin);
    await g(() => window.__ori.game3d.launch('favors', { quick: true }));
    await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
    await g(() => { const x = window.__ori.game3d; x.setHour(15); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); });
    await g(() => { const gm = window.__ori.game3d.game; gm.campaign.state.boxer.level = 5; gm.campaign.state.love = 40; const p = gm.fight.apron(); window.__ori.game3d.teleport({ x: p.x, z: p.z }, Math.PI); });
    await sleep(700);
    const cdp = await context.newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p[0], y: p[1], id: p[2] ?? i })) });
    const center = (sel) => g((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
    const tap = async (sel) => { const [x, y] = await center(sel); await page.touchscreen.tap(x, y); };
    const isOn = () => g(() => { const t = document.querySelector('.fi-touch'); return !!t && !t.hidden && getComputedStyle(t).display !== 'none'; });
    const P = () => g(() => window.__ori.game3d.game.fight.snapshot().P);

    // the ring's menu is tapped, not typed
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 5000 });
    check(!(await isOn()), 'before a fight there are no fight buttons on the screen');
    await tap('.fi-row[data-i="0"]');
    await page.waitForFunction(() => window.__ori.game3d.game.fight.phase === 'fight', null, { timeout: 15000 });
    await sleep(300);
    check(await isOn(), 'on a phone the fight shows the stick and the buttons');
    check(await g(() => ['.fi-stick', '.fi-tb.jab', '.fi-tb.cross', '.fi-tb.guard', '.fi-tb.dash'].every((s) => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return r.width > 50 && r.left >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight && getComputedStyle(e).display !== 'none'; })), 'all four buttons and the stick fit in a 390 px wide screen');
    check(await g(() => { const f = document.querySelector('.fv-touch'); return !f || getComputedStyle(f).display === 'none'; }), 'the street\'s own stick gives way to the ring\'s');
    await shot('ring-touch-fight.png');

    // the stick walks him (up = into the screen, right = to the right)
    const [sx, sy] = await center('.fi-stick');
    const p0 = await P();
    await touch('touchStart', [[sx, sy, 1]]);
    await touch('touchMove', [[sx + 30, sy - 40, 1]]);
    await sleep(500);
    const p1 = await P();
    check(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.4, `the stick walks Ori (${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(2)} m in half a second)`);
    // a second finger on JAB while the first one keeps the stick
    const [jx, jy] = await center('.fi-tb.jab');
    await g(() => { window.__ori.game3d.game.fight.bout.stats.thrown = 0; });
    await touch('touchStart', [[sx + 30, sy - 40, 1], [jx, jy, 2]]);
    await sleep(60);
    await touch('touchEnd', [[sx + 30, sy - 40, 1]]);
    await sleep(40);
    await touch('touchEnd', []);
    check((await g(() => window.__ori.game3d.game.fight.bout.stats.thrown)) >= 1, 'JAB with a second finger throws a punch while the stick is held');
    await page.touchscreen.tap(...(await center('.fi-tb.cross')));
    await sleep(120);
    check((await g(() => window.__ori.game3d.game.fight.bout.stats.thrown)) >= 2, 'CROSS throws another');
    // the guard is held for as long as the finger stays
    const [gx, gy] = await center('.fi-tb.guard');
    await sleep(600);
    await touch('touchStart', [[gx, gy, 3]]);
    await sleep(250);
    const held = await g(() => window.__ori.game3d.game.fight.bout.P.blocking);
    await shot('ring-touch-guard.png');
    await touch('touchEnd', []);
    await sleep(200);
    const let_go = await g(() => window.__ori.game3d.game.fight.bout.P.blocking);
    check(held && !let_go, 'GUARD is held as long as the finger stays on it');
    await sleep(500);
    await page.touchscreen.tap(...(await center('.fi-tb.dash')));
    await sleep(100);
    check((await P()).state === 'dash' || (await g(() => window.__ori.game3d.game.fight.bout.P.dashCd)) > 0, 'DASH dashes');

    // finish the fight quickly and tap through to the speed bag
    await g(() => { const b = window.__ori.game3d.game.fight.bout; b.rise = [1]; b.O.hp = 1; b.P.hp = b.P.maxHp; });
    for (let i = 0; i < 40; i++) {
      const f = await g(() => window.__ori.game3d.game.fight.snapshot());
      if (f.over || f.phase === 'result') break;
      await g(() => { const b = window.__ori.game3d.game.fight.bout; b.P.hp = b.P.maxHp; if (b.O.state === 'idle' || b.O.state === 'attack') { b.O.x = b.P.x; b.O.z = b.P.z - 1.2; } });
      await page.touchscreen.tap(...(await center('.fi-tb.jab')));
      await sleep(260);
    }
    await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.cardOpen, null, { timeout: 15000 });
    check(!(await isOn()), 'the buttons go away when the fight is over');
    await tap('[data-a="again"]');
    await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 8000 });
    await tap('.fi-train');
    await page.waitForFunction(() => window.__ori.game3d.game.fight.mode === 'bag' && window.__ori.game3d.game.fight.phase === 'fight', null, { timeout: 15000 });
    await sleep(300);
    check(await g(() => { const t = document.querySelector('.fi-touch'); return !t.hidden && t.classList.contains('bag') && getComputedStyle(document.querySelector('.fi-stick')).display === 'none' && getComputedStyle(document.querySelector('.fi-tb.guard')).display === 'none'; }), 'in the speed bag only the two hands are on screen: JAB and CROSS, one under each thumb');
    const [lx, ly] = await center('.fi-tb.jab'); const [rx, ry] = await center('.fi-tb.cross');
    check(lx < 195 && rx > 195, 'JAB is on the left, CROSS on the right');
    let score = 0;
    for (let i = 0; i < 16; i++) {
      const s = await g(() => window.__ori.game3d.game.fight.snapshot());
      const up = s.bag.upcoming.find((u) => !u.hit && u.dt > -0.05);
      if (up) { await sleep(Math.max(0, up.dt * 1000 - 70)); const h = s.bag.nextHand === 'J' ? [lx, ly] : [rx, ry]; await page.touchscreen.tap(h[0], h[1]); }
      if (i === 9) await shot('ring-touch-bag.png');
      await sleep(100);
    }
    score = await g(() => window.__ori.game3d.game.fight.snapshot().bag.score);
    check(score > 400, `tapping the beat scores in the drill (${score} points)`);
    const lane = await g(() => { const l = document.querySelector('.fi-lane').getBoundingClientRect(); const b = document.querySelector('.fi-tb.jab').getBoundingClientRect(); return { laneBottom: l.bottom, btnTop: b.top, laneLeft: l.left, laneRight: l.right, w: window.innerWidth }; });
    check(lane.laneBottom <= lane.btnTop + 1 && lane.laneLeft >= 0 && lane.laneRight <= lane.w, 'the beat lane sits above the buttons and fits the screen');
    await g(() => window.__ori.game3d.quit());
    await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 8000 });
    const mem = await g(() => window.__ori.game3d.lastMemory);
    check(mem && mem.geometries === 0 && mem.textures === 0, `the phone quits clean too (${mem ? `${mem.geometries} geometries, ${mem.textures} textures` : 'no reading'})`);
    check(errors.length === 0, `no errors on the phone${errors.length ? `: ${errors[0].split('\n')[0]}` : ''}`);
  } finally {
    await context.close();
  }
}
