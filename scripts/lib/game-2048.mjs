// End-to-end check for 2048: real key presses, deterministic boards via the read/write debug hook, animations,
// undo, overlays, achievements, persistence. Screenshots go to shots/smoke/.
import { join } from 'node:path';
import { SHOTS, sleep, settle, snap } from './harness.mjs';

export async function run2048(session, { ok, fail }) {
  const { page } = session;
  const tag = `${session.width}x${session.height}`;
  const check = (cond, msg) => (cond ? ok(`2048: ${msg}`) : fail(`2048: ${msg}`));
  const flat = session.width < 860;
  const dbg = (fn, arg) => page.evaluate(([f, a]) => { const d = document.querySelector('.win-2048 .wm-body').__debug; return new Function('d', 'a', `return (${f})(d, a)`)(d, a); }, [fn.toString(), arg]);
  const cells = () => dbg((d) => d.cells);
  const score = () => dbg((d) => d.score);
  const setBoard = (values, s = 0) => dbg((d, a) => d.set(a.values, a.s), { values, s });
  const hud = (id) => page.evaluate((i) => document.querySelector(`.win-2048 .gk-pill[data-id="${i}"] b`)?.textContent, id);
  const overlayKicker = () => page.evaluate(() => { const o = document.querySelector('.win-2048 .gk-ov'); return o && !o.hidden ? o.querySelector('.gk-kicker').textContent.toLowerCase() : ''; });
  const press = async (key) => { await page.keyboard.press(key); await sleep(60); };
  const shot = (name) => snap(session, join(SHOTS, 'smoke', `${tag}-game-2048-${name}.png`));
  const sum = (a) => a.reduce((x, y) => x + y, 0);

  await page.evaluate(() => { window.__ori.core.storage.remove('2048:game'); window.__ori.desktop.reset(); window.__ori.openApp('2048'); });
  await sleep(500);
  let c = await cells();
  check(c.filter(Boolean).length === 2 && c.every((v) => v === 0 || v === 2 || v === 4), 'a new game starts with two tiles (2 or 4)');
  check((await hud('score')) === '0', 'score starts at 0');

  // ── slide + merge + scoring ──
  await setBoard([2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  await press('ArrowLeft');
  c = await cells();
  check(c[0] === 4 && sum(c) >= 6 && sum(c) <= 8 && c.filter(Boolean).length === 2, `ArrowLeft merges 2+2 → 4 and spawns one tile (${c.join(',')})`);
  check((await score()) === 4 && (await hud('score')) === '4', 'score +4 shown in the HUD');
  check(await page.evaluate(() => !!document.querySelector('.win-2048 .g48-tile.pop') && !!document.querySelector('.win-2048 .g48-tile.new')), 'merge pop + spawn animations are applied');
  await sleep(500);
  check(await page.evaluate(() => document.querySelectorAll('.win-2048 .g48-tile').length) === 2, 'merged-away tiles are removed from the DOM');

  // ── undo (last 3) ──
  await setBoard([2, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  for (const k of ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp']) { await press(k); }
  check((await hud('undo')) === '×3', 'undo is capped at the last 3 moves');
  const afterFour = await cells();
  await press('KeyU');
  await press('KeyU');
  check((await hud('undo')) === '×1', 'U steps back (×1 left after two undos)');
  check(JSON.stringify(await cells()) !== JSON.stringify(afterFour), 'undo restores an earlier board');
  await press('KeyZ');
  check((await hud('undo')) === '×0', 'Z also undoes; the Undo pill shows ×0');

  // ── invalid move: nothing changes, no spawn ──
  await setBoard([2, 4, 8, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const stuck = await cells();
  await press('ArrowLeft');
  check(JSON.stringify(await cells()) === JSON.stringify(stuck), 'a move that changes nothing spawns nothing');
  check(await page.evaluate(() => document.querySelector('.win-2048 .g48-board').classList.contains('nope')), 'and the board shakes');

  // ── WASD ──
  await setBoard([0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  await press('KeyA');
  check((await cells())[0] === 2, 'A moves left (WASD works)');

  // ── keys are consumed (the page must never scroll) ──
  const consumed = await page.evaluate(() => {
    const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true, cancelable: true });
    window.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  check(consumed, 'arrow keys are preventDefault-ed');

  // ── colour ramp screenshot ──
  await setBoard([2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 0, 0, 0, 8192], 12345);
  await sleep(300);
  await shot('ramp');

  // ── achievements: 512 → Power of two ──
  await page.evaluate(() => window.__ori.core.achievements.reset());
  await setBoard([256, 256, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  await press('ArrowLeft');
  check(await page.evaluate(() => window.__ori.core.achievements.isUnlocked('power-of-two')), 'merging to 512 unlocks "Power of two"');
  check(!(await page.evaluate(() => window.__ori.core.achievements.isUnlocked('legend'))), '"Legend" stays locked until 2048');

  // ── win at 2048: overlay → Keep going ──
  await setBoard([1024, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  await press('ArrowLeft');
  await page.waitForFunction(() => { const o = document.querySelector('.win-2048 .gk-ov'); return o && !o.hidden; }, null, { timeout: 15000 });
  check((await overlayKicker()) === 'you win!', 'reaching 2048 shows the win overlay');
  check(await page.evaluate(() => window.__ori.core.achievements.isUnlocked('legend')), '"Legend" unlocked at 2048');
  await shot('win');
  const frozen = await cells();
  await press('ArrowDown');
  check(JSON.stringify(await cells()) === JSON.stringify(frozen), 'moves are ignored while the overlay is open');
  await press('Enter');
  await sleep(150);
  check((await overlayKicker()) === '', 'Enter = "Keep going" closes the overlay');
  await press('ArrowDown');
  check(JSON.stringify(await cells()) !== JSON.stringify(frozen), 'play continues after "Keep going"');

  // ── game over: a full board where the last move+spawn leaves no moves ──
  await setBoard([8, 16, 8, 16, 16, 8, 16, 8, 8, 16, 8, 16, 8, 16, 8, 0], 777);
  await press('ArrowRight');
  await page.waitForFunction(() => { const o = document.querySelector('.win-2048 .gk-ov'); return o && !o.hidden && /game over/i.test(o.querySelector('.gk-kicker').textContent); }, null, { timeout: 15000 });
  check(true, 'a board with no moves left shows Game over');
  await shot('over');
  const rec = await page.evaluate(() => window.__ori.core.storage.get('scores:2048'));
  check(!!rec && rec.plays >= 1 && rec.best >= 777, `the score is recorded (best ${rec && rec.best})`);
  await press('Enter');
  await sleep(300);
  check((await overlayKicker()) === '' && (await score()) === 0, 'Enter starts a new game from Game over');

  // ── New game via N, persistence across close/reopen ──
  await setBoard([2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 40);
  const before = await cells();
  await page.evaluate(() => window.__ori.desktop.reset());
  await page.evaluate(() => window.__ori.openApp('2048'));
  await sleep(500);
  check(JSON.stringify(await cells()) === JSON.stringify(before) && (await score()) === 40, 'the game is restored after closing and reopening the window');
  await press('KeyN');
  await sleep(300);
  check((await score()) === 0 && (await cells()).filter(Boolean).length === 2, 'N starts a new game');

  // ── touch: swipe + pad ──
  await setBoard([0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  await page.evaluate(() => {
    const f = document.querySelector('.win-2048 .gk-field');
    const r = f.getBoundingClientRect();
    const x = r.x + r.width * 0.6, y = r.y + r.height * 0.5;
    const fire = (type, dx) => f.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', pointerId: 7, clientX: x + dx, clientY: y, isPrimary: true }));
    fire('pointerdown', 0);
    fire('pointermove', -45); // one threshold-crossing step = exactly one move
    fire('pointerup', -45);
  });
  await sleep(120);
  check((await cells())[0] === 2, 'a leftward swipe (touch) moves the tiles left');
  if (flat) {
    await setBoard([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2]);
    const r = await page.evaluate(() => { const b = document.querySelector('.win-2048 .gk-pb-up').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    await page.mouse.click(r.x, r.y);
    await sleep(150);
    check((await cells())[3] === 2, 'flat mode: the on-screen D-pad moves tiles');
    await shot('pad');
  }
  // leave no trace for later checks
  await page.evaluate(() => { const o = window.__ori; o.desktop.reset(); o.core.achievements.reset(); o.core.storage.remove('2048:game'); o.core.storage.remove('scores:2048'); });
}
