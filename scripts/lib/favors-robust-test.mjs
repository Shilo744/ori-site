// "Ori, Can You...?" robustness, browser checks (T06): the error boundary. An exception in the frame pauses the game and shows a warm card with a way out,
// instead of a frozen canvas and a flood of console errors; "Carry on" is offered a few times, not in a loop.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';

export async function runFavorsRobust(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`robust: ${msg}`) : fail(`robust: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const launch = async () => {
    await g(() => window.__ori.game3d.launch('favors', { quick: true }));
    await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  };
  const trip = async (what) => {
    await g((what) => window.__ori.game3d.injectError(what), what);
    await page.waitForFunction(() => { const m = document.querySelector('.g3d-msg'); return !!m && !m.hidden && /tripped/.test(m.textContent); }, null, { timeout: 6000 });
    // the harness counts console errors as failures: the one the boundary logs on purpose is expected here
    for (let i = session.errors.length - 1; i >= 0; i--) if (/the game tripped|injected test error|trip \d/.test(session.errors[i].text)) session.errors.splice(i, 1);
  };
  const card = () => g(() => ({ text: document.querySelector('.g3d-msg').textContent, buttons: [...document.querySelectorAll('.g3d-msg .g3d-btn')].map((b) => b.textContent), paused: window.__ori.game3d.paused }));
  const carryOn = async () => { await page.click('.g3d-msg .g3d-btn.primary'); await sleep(150); };

  await launch();
  await sleep(500);
  const fps0 = await g(() => window.__ori.game3d.fps);
  check(fps0 > 3, `the game runs (${fps0} fps)`);

  // ── a frame throws: the game stops on a warm card, it does not freeze in silence ──
  await trip('trip 1');
  const c1 = await card();
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T06-tripped.png') });
  check(/Something tripped/.test(c1.text) && /Ori stumbled over something/.test(c1.text) && /Esc/.test(c1.text), `the card is warm and says what to do ("${c1.text.slice(0, 80)}...")`);
  check(c1.buttons.join('|') === 'Carry on|Back to desktop' && c1.paused === true, `it offers "Carry on" and "Back to desktop", and the game is paused (${c1.buttons.join(' | ')})`);

  // ── carry on: the game runs again ──
  await carryOn();
  await sleep(900);
  const fps1 = await g(() => window.__ori.game3d.fps);
  const open1 = await g(() => { const m = document.querySelector('.g3d-msg'); return !!m && !m.hidden; });
  check(!open1 && !(await g(() => window.__ori.game3d.paused)) && fps1 > 3, `"Carry on" closes the card and the frames run again (${fps1} fps)`);

  // ── it trips again at once: that is final (no loop of cards) ──
  await trip('trip 2');
  const c2 = await card();
  check(/Something tripped again/.test(c2.text) && c2.buttons.join('|') === 'Back to desktop', `tripping again right after carrying on only offers the way out (${c2.buttons.join(' | ')})`);

  // ── Esc is the way out: the overlay is gone, the room is back ──
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 15000 });
  await sleep(450);
  check(await g(() => !document.getElementById('g3d') && !document.body.classList.contains('g3d-open')), 'Esc leaves: the overlay is gone and the room has the screen again');

  // ── after a calm spell it is offered again, but never more than three times in one game ──
  await launch();
  await sleep(300);
  await trip('trip 3');
  await carryOn();
  await sleep(2300);
  await trip('trip 4');
  const c4 = await card();
  check(c4.buttons.join('|') === 'Carry on|Back to desktop', 'after a calm spell "Carry on" is offered again');
  await carryOn();
  await sleep(2300);
  await trip('trip 5');
  const c5 = await card();
  check(c5.buttons.join('|') === 'Back to desktop' && /again/.test(c5.text), `the third trip in one game is final (${c5.buttons.join(' | ')})`);
  await page.click('.g3d-msg .g3d-btn.primary'); // "Back to desktop"
  await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 15000 });
  check(true, 'and the button leaves the game too');

  // ── the frame rate keeper (T18): a slow stretch trades resolution for smoothness, room to spare gives it back ──
  await g(() => window.__ori.game3d.launch('favors', { quick: true, adaptive: { down: 1, up: 2, hold: 0.5 }, warmup: 200 }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  const r0 = await g(() => window.__ori.game3d.stats().pixelRatio);
  const w0 = await g(() => document.querySelector('.g3d-canvas').width);
  await sleep(1500);
  check((await g(() => window.__ori.game3d.stats().pixelRatio)) === r0, `a smooth game keeps its resolution (ratio ${r0})`);
  await g(() => window.__ori.game3d.injectFps((r) => 14 / r)); // (a machine held back by its graphics: fewer pixels, more frames)
  await page.waitForFunction((r) => window.__ori.game3d.stats().pixelRatio < r, r0, { timeout: 8000 });
  const r1 = await g(() => window.__ori.game3d.stats().pixelRatio);
  const w1 = await g(() => document.querySelector('.g3d-canvas').width);
  check(r1 < r0 && w1 < w0, `a slow stretch steps the resolution down (ratio ${r0} -> ${r1}, canvas ${w0} -> ${w1} px wide)`);
  check((await g(() => window.__ori.game3d.state().phase)) === 'play' && !(await g(() => window.__ori.game3d.paused)), 'and the game goes on, no card, no pause');
  await g(() => window.__ori.game3d.injectFps(60));
  await page.waitForFunction((r) => window.__ori.game3d.stats().pixelRatio > r, r1, { timeout: 12000 });
  check((await g(() => window.__ori.game3d.stats().pixelRatio)) > r1, `with room to spare it steps back up (ratio -> ${await g(() => window.__ori.game3d.stats().pixelRatio)})`);
  // "Resolution: Full" in the pause menu: the keeper gives back what it took and leaves the resolution alone, however slow it gets
  await g(() => window.__ori.game3d.injectFps((r) => 14 / r));
  await page.waitForFunction((r) => window.__ori.game3d.stats().pixelRatio < r, r0, { timeout: 8000 });
  await g(() => window.__ori.game3d.game.settings.set({ resolution: 'full' }));
  await page.waitForFunction((r) => window.__ori.game3d.stats().pixelRatio === r, r0, { timeout: 4000 });
  await sleep(3500);
  check((await g(() => window.__ori.game3d.stats().pixelRatio)) === r0, `with Resolution: Full it is back at ${r0} and stays there while the game is slow`);
  await g(() => window.__ori.game3d.game.settings.set({ resolution: 'auto' }));
  await g(() => window.__ori.game3d.injectFps(null));

  // ── reduce motion in the ring (T05): without it a heavy blow shakes the camera, stops the picture for a moment and flashes; with it none of that, and the words do not zoom ──
  const intoRing = async () => {
    await g(() => { const gm = window.__ori.game3d.game; const a = gm.fight.apron(); window.__ori.game3d.teleport({ x: a.x, z: a.z }, Math.PI); });
    await sleep(350);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 5000 });
    await page.keyboard.press('Digit1');
    await page.waitForFunction(() => window.__ori.game3d.game.fight.phase === 'fight', null, { timeout: 15000 });
    await sleep(250);
  };
  const blow = () => g(() => { const f = window.__ori.game3d.game.fight; f.debugEvent({ type: 'hit', who: 'player', target: 'opp', dmg: 14, heavy: true, move: 'cross', counter: false, combo: 1 }); f.ui.flash('ko'); f.ui.bigWord('TEST', '', 300); return { shake: f.shakeNow, stop: f.hitStopNow, calm: f.calm, flash: !!document.querySelector('.fi-flash.on'), hud: document.querySelector('.fi-hud').classList.contains('fi-calm'), word: getComputedStyle(document.querySelector('.fi-big')).animationName }; });
  await g(() => { window.__ori.core.system.set('reduceMotion', false); });
  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await intoRing();
  const lively = await blow();
  check(!lively.calm && lively.shake > 0.2 && lively.stop > 0.05 && lively.flash && !lively.hud && lively.word !== 'none', `normally a heavy blow shakes the camera (${lively.shake.toFixed(2)}), stops the picture (${lively.stop}) and flashes`);
  // the boss's lag (T11): a ring and a word over his head while he is buffering, gone when he is not
  await g(() => { window.__ori.game3d.game.fight.bout.O.lag = 3; });
  await sleep(300);
  const buf1 = await g(() => { const b = document.querySelector('.fi-buf'); return !!b && !b.hidden && /BUFFERING/.test(b.textContent) && b.style.transform.includes('translate'); });
  await g(() => { window.__ori.game3d.game.fight.bout.O.lag = 0; });
  await sleep(300);
  const buf0 = await g(() => document.querySelector('.fi-buf').hidden);
  check(buf1 && buf0, 'while the boss lags a "BUFFERING" ring follows his head; it is gone when he is back');
  await g(() => window.__ori.game3d.game.fight.abort());
  await sleep(300);
  await g(() => { window.__ori.core.system.set('reduceMotion', true); });
  await intoRing();
  const still = await blow();
  check(still.calm && still.shake === 0 && still.stop === 0 && !still.flash && still.hud && still.word === 'none', `with reduce motion: no shake (${still.shake}), no stop (${still.stop}), no flash, the words do not zoom (${still.word})`);
  await g(() => { window.__ori.core.system.set('reduceMotion', false); window.__ori.game3d.game.fight.abort(); });
  await sleep(200);
  await g(() => window.__ori.game3d.quit());
  await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 15000 });
}
