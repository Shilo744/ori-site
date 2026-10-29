// "Ori, Can You...?" the first steps and "what now?" [experimental], browser checks (T32): a new player gets a card that ticks itself off (walk, hello, map) and goes away once, remembered;
// "?" (the key, the button, the goal chip) opens a panel with the goal, where it is, a "show it on the map" and the keys; the pause menu can show the first steps again.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';

export async function runFavorsGuide(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`guide: ${msg}`) : fail(`guide: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const S = () => g(() => window.__ori.game3d.state());
  const launch = async (opts) => {
    await g((o) => window.__ori.game3d.launch('favors', o), opts);
    await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
    await g(() => { const x = window.__ori.game3d; x.setHour(12); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); });
  };
  const steps = () => g(() => [...document.querySelectorAll('.gd-steps li')].map((li) => li.classList.contains('done')));

  // ── a new player: the card appears, ticks itself off, and is gone for good ──
  await launch({ quick: true, tour: true });
  await page.waitForFunction(() => window.__ori.game3d.state().tour === true, null, { timeout: 6000 });
  const first = await steps();
  check(first.length === 3 && first.every((d) => !d), 'a new player sees three first steps, none done');
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T32-first-steps.png') });
  await g(() => window.__ori.game3d.teleport('park')); // (open ground: at the front door of his flat a wall stops him after two metres)
  await sleep(400);
  await page.keyboard.down('KeyW'); await sleep(3200); await page.keyboard.up('KeyW');
  await page.waitForFunction(() => document.querySelectorAll('.gd-steps li.done').length >= 1, null, { timeout: 5000 });
  check((await steps())[0] === true, 'walking ticks the first step');
  await g(() => window.__ori.game3d.game.sayHello('moti'));
  await page.waitForFunction(() => document.querySelectorAll('.gd-steps li.done').length >= 2, null, { timeout: 5000 });
  check((await steps())[1] === true, 'a hello ticks the second');
  await page.keyboard.press('KeyM'); await sleep(900); await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelectorAll('.gd-steps li.done').length === 3, null, { timeout: 5000 });
  check(await g(() => /You are ready/.test(document.querySelector('.gd-head b').textContent)), 'the map ticks the third: "You are ready!"');
  await page.waitForFunction(() => window.__ori.game3d.state().tour === false, null, { timeout: 9000 });
  const s1 = await S();
  check(s1.progress.tour === 1 && (await g(() => document.querySelector('.gd-tour').hidden)), 'the card goes away by itself and is written on the save');

  // ── "what now?": the key, the button, the goal chip ──
  await page.keyboard.press('Shift+Slash');
  await sleep(300);
  const p1 = await g(() => ({ open: window.__ori.game3d.state().guideOpen, title: (document.querySelector('.gd-card h2') || {}).textContent, hint: (document.querySelector('.gd-hint') || {}).textContent, prog: (document.querySelector('.gd-prog') || {}).textContent, keys: document.querySelectorAll('.gd-keys li').length, track: !!document.querySelector('[data-act="track"]'), modal: (document.querySelector('.gd') || {}).getAttribute && document.querySelector('.gd').getAttribute('aria-modal') }));
  check(p1.open && /Say hello/.test(p1.title) && /press H/.test(p1.hint) && /\d \/ 5/.test(p1.prog) && p1.keys >= 8 && !p1.track && p1.modal === 'true', `"?" opens the panel: "${p1.title}" ${p1.prog}, ${p1.keys} keys, no map button for a goal without a place`);
  const tree = await page.getByRole('dialog', { name: 'What now?' }).ariaSnapshot();
  check(/heading/.test(tree) && /button "Close"/.test(tree), 'it is a named dialog with a Close button');
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T32-what-now.png') });
  await page.keyboard.press('Escape');
  await sleep(250);
  check(!(await S()).guideOpen && !(await S()).paused, 'Esc closes it (and does not pause the game)');
  await g(() => { const c = window.__ori.game3d.game.campaign; c.state.progress.hellos = 5; });
  await sleep(1500); // (the goal moves on to the ring)
  await page.click('[data-k="help"]');
  await sleep(300);
  const p2 = await g(() => ({ title: document.querySelector('.gd-card h2').textContent, where: document.querySelector('.gd-where').textContent, track: !!document.querySelector('[data-act="track"]') }));
  check(/Find The Ring/.test(p2.title) && /It is at/.test(p2.where) && p2.track, `the "?" button too: "${p2.title}", ${p2.where} and a button to follow it`);
  await page.click('[data-act="track"]');
  await sleep(300);
  const s2 = await S();
  check(s2.tracked === 'court' && !s2.guideOpen, 'the button makes the beam lead there and closes the panel');
  await page.click('.fv-goal');
  await sleep(250);
  check((await S()).guideOpen && /already leads/.test(await g(() => (document.querySelector('[data-act="track"]') || {}).textContent || '')), 'a click on the goal chip opens it, and it knows the beam already leads there');
  await page.keyboard.press('Shift+Slash');
  await sleep(200);
  check(!(await S()).guideOpen, '"?" again closes it');

  // ── remembered: a second game of the same player has no card ──
  await g(() => window.__ori.game3d.quit());
  await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 8000 });
  await launch({ quick: true, tour: true, fresh: false });
  await sleep(2500);
  check(!(await S()).tour && (await S()).progress.tour === 1, 'the next game starts without the card (it is remembered)');

  // ── the pause menu can show it again ──
  await page.keyboard.press('Escape');
  await sleep(300);
  await page.click('.g3d-menu [data-s="tips"]');
  await sleep(900);
  const again = await g(() => ({ paused: window.__ori.game3d.state().paused, tour: window.__ori.game3d.state().tour, shown: !document.querySelector('.gd-tour').hidden }));
  check(!again.paused && again.tour && again.shown, '"Show the first steps again" in the pause menu closes the menu and shows the card');
}
