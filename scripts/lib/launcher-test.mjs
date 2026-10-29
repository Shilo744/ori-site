// "Ori's Life" is EASY TO FIND (T59): a Dock icon in the 2nd slot, a hero widget on the desktop, Spotlight, the Welcome window, the
// terminal (`play favors`) and the iPhone on the desk in the 3D room all start the game; quitting brings you back where you were.
import { join } from 'node:path';
import { SHOTS, sleep, settle, backToRoom } from './harness.mjs';

export async function runLauncher(session, { ok, fail }) {
  const { page } = session;
  const flat = session.width < 860;
  const check = (cond, msg) => (cond ? ok(`launcher: ${msg}`) : fail(`launcher: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const running = () => g(() => window.__ori.game3d.running && document.getElementById('g3d') && document.getElementById('g3d').dataset.game === 'favors');
  const waitRunning = (ms = 8000) => page.waitForFunction(() => window.__ori.game3d.running && document.getElementById('g3d') && document.getElementById('g3d').dataset.game === 'favors', null, { timeout: ms }).then(() => true).catch(() => false);
  const quit = async () => { await g(() => window.__ori.game3d.quit()); await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 6000 }).catch(() => {}); await sleep(250); };
  const state = () => g(() => window.__ori.state);

  await g(() => { window.__ori.desktop.reset(); });
  await sleep(300);

  // ── the Dock: 2nd slot, label, bounce on launch ──
  const dock = await g(() => { const items = [...document.querySelectorAll('.mac .dk[data-app]')]; return { ids: items.map((b) => b.dataset.app), label: (items[1] && items[1].querySelector('em') && items[1].querySelector('em').textContent) || '', icon: !!(items[1] && items[1].querySelector('svg')) }; });
  check(dock.ids[1] === 'favors' && dock.ids[0] === 'finder', `the Dock's 2nd icon is "Ori's Life" (${dock.ids.join(', ')})`);
  check(dock.label === "Ori's Life" && dock.icon && dock.ids.includes('arcade'), 'it has its label and its art, and the Arcade is still in the Dock (after it)');

  // ── the hero widget ──
  if (!flat) {
    const w = await g(() => { const e = document.querySelector('.mac .wg-hero'); if (!e) return null; const r = e.getBoundingClientRect(); const s = document.querySelector('.mac .scr').getBoundingClientRect(); return { inside: r.left >= s.left && r.right <= s.right && r.top >= s.top && r.bottom <= s.bottom, w: r.width, h: r.height, cards: e.querySelectorAll('.oh-stack li').length, play: e.querySelector('.oh-play').textContent, svg: !!e.querySelector('svg.oh-ori'), title: e.querySelector('.oh-t b').textContent }; });
    check(!!w && w.inside && w.cards === 3 && /play/i.test(w.play) && w.svg && w.title === "Ori's Life", `the hero widget is on the desktop: Ori's portrait, three parody notifications and PLAY (${w && Math.round(w.w)}x${w && Math.round(w.h)})`);
    const anim = await g(() => { const li = document.querySelector('.mac .oh-stack li'); return { running: getComputedStyle(li).animationPlayState, locked: document.querySelector('.mac').classList.contains('locked') }; });
    check(anim.running === 'running' || anim.locked, 'the notifications cycle (and pause when the screen is not in front of the camera)');
  } else check(await g(() => getComputedStyle(document.querySelector('.mac .wg-hero')).display === 'none'), 'on a phone the widget is out of the way');

  // ── a window stays open across a visit ──
  await g(() => window.__ori.openApp('notes'));
  await sleep(400);

  // Dock click
  await page.click('.mac .dk[data-app="favors"]');
  check(await g(() => document.querySelector('.mac .dk[data-app="favors"]').classList.contains('bounce')), 'the icon bounces like any other');
  check(await waitRunning(), 'clicking the Dock icon starts the game');
  await quit();
  check((await state()) === (flat ? 'flat' : 'screen') && (await g(() => !!document.querySelector('.mac .win-notes'))), 'quitting brings back the desktop with its windows');

  // the widget's PLAY
  if (!flat) {
    await g(() => window.__ori.desktop.reset()); // (the Notes window may sit on top of it)
    await sleep(250);
    await page.click('.mac .oh-play');
    check(await waitRunning(), 'the widget\'s PLAY starts the game');
    await quit();
  }

  // Spotlight
  await g(() => window.__ori.desktop.openSpotlight());
  await sleep(250);
  await page.type('.mac .spot input', "ori's life");
  await sleep(250);
  const top = await g(() => { const r = document.querySelector('.mac .spot-res .sr.on'); return r ? r.textContent : ''; });
  check(/Play: Ori's Life/.test(top), `Spotlight offers "Play: Ori's Life" first (${top.trim().slice(0, 40)})`);
  await page.keyboard.press('Enter');
  check(await waitRunning(), 'Enter on that result starts the game');
  await quit();

  // (the Welcome window no longer has a Play button: the hero widget on the desktop is enough)
  await g(() => { window.__ori.desktop.reset(); window.__ori.openApp('welcome'); }); // (what the old Welcome step left behind: a clean desktop with the window)
  await sleep(3500);

  // the terminal
  await g(() => { window.__ori.desktop.reset(); window.__ori.openApp('terminal'); });
  await sleep(500);
  await page.click('.mac .win-terminal input');
  await page.keyboard.type('play favors');
  await page.keyboard.press('Enter');
  check(await waitRunning(20000), 'the terminal command `play favors` starts the game');
  await quit();
  await g(() => window.__ori.desktop.reset());
}

/** The iPhone on the desk in the 3D room: hover says "1 new task", a click only makes it hop; it never starts the game (T66). Needs the room (state "overview"). */
export async function runIphoneLaunch(session, { ok, fail }) {
  const { page } = session;
  if (session.width < 860) return; // no 3D room on a phone
  const check = (cond, msg) => (cond ? ok(`launcher: ${msg}`) : fail(`launcher: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const waitRunning = (ms = 8000) => page.waitForFunction(() => window.__ori.game3d.running && document.getElementById('g3d') && document.getElementById('g3d').dataset.game === 'favors', null, { timeout: ms }).then(() => true).catch(() => false);
  const quit = async () => { await g(() => window.__ori.game3d.quit()); await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 6000 }).catch(() => {}); await sleep(250); };
  if ((await g(() => window.__ori.state)) !== 'overview') await backToRoom(session);
  await g(() => { window.__ori.setView('desk'); });
  await settle(session, 2);
  await sleep(900);
  const p = await g(() => window.__ori.interactions.screenPos('iphone'));
  await page.mouse.move(p.x - 4, p.y - 4);
  await page.mouse.move(p.x, p.y, { steps: 3 });
  await page.waitForFunction(() => window.__ori.interactions.hoverId === 'iphone', null, { timeout: 5000 }).catch(() => {});
  const tag = await g(() => window.__ori.interactions.tagText);
  check(/^iPhone/.test(tag), `hovering the iPhone says "${tag}"`);
  await page.screenshot({ path: join(SHOTS, 'T59-iphone-hover.png') });
  await page.mouse.click(p.x, p.y);
  await sleep(350);
  await page.screenshot({ path: join(SHOTS, 'T59-iphone-click.png') });
  await sleep(1200); // (the old hook started the game 700 ms after the click)
  check(!(await g(() => window.__ori.game3d && window.__ori.game3d.running)), 'clicking the iPhone does not start the game (no launchGame3D)');
  check((await g(() => window.__ori.state)) === 'overview', 'quitting puts you back in the room');
  await g(() => { window.__ori.setView('overview'); });
}
