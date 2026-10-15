// MacBook lid / Sleep / Shut Down / Restart / key-press checks (T6). 3D mode and flat mode behave differently.
import { join } from 'node:path';
import { SHOTS, sleep, settle, snap } from './harness.mjs';

export async function runLid(session, { ok, fail }) {
  const { page } = session;
  const tag = `${session.width}x${session.height}`;
  const check = (cond, msg) => (cond ? ok(`mac: ${msg}`) : fail(`mac: ${msg}`));
  const flat = session.width < 860;
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const clickMenu = (menu, label) => ev(({ m, l }) => {
    const root = window.__ori.desktop.root;
    root.querySelector(`[data-menu="${m}"]`).click();
    const item = [...root.querySelectorAll('.menu .mi')].find((e) => e.textContent.trim().startsWith(l));
    if (!item || item.classList.contains('dis')) return false;
    item.click();
    return true;
  }, { m: menu, l: label });
  const waitState = (s, t = 20000) => page.waitForFunction((x) => window.__ori.state === x, s, { timeout: t });
  const lid = () => ev(() => ({ angle: window.__ori.mac.lidAngle, open: window.__ori.mac.lidOpen, vis: window.__ori.desktop.root.style.visibility }));
  const boot = () => ev(() => { const b = document.querySelector('.mac .boot'); return { run: b.classList.contains('run'), done: b.classList.contains('done'), shut: b.classList.contains('shut'), wake: b.dataset.wake || '' }; });

  // we start inside the screen with the lid open
  await ev(() => { window.__ori.desktop.reset(); window.__ori.openApp('finder'); window.__ori.openApp('notes'); });
  await sleep(300);

  if (!flat) {
    const l0 = await lid();
    check(l0.angle > 100 && l0.open && l0.vis === '', `the lid is open at the desktop (${l0.angle.toFixed(0)}°) and the screen is shown`);

    // key presses follow real keyboard events (and release again)
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'a', bubbles: true })));
    await settle(session, 3);
    const pressed = await ev(() => window.__ori.mac.keys.depthOf('KeyA'));
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA', key: 'a', bubbles: true })));
    await settle(session, 8);
    const released = await ev(() => window.__ori.mac.keys.depthOf('KeyA'));
    check(pressed > 0.5, `keydown presses the 3D key (depth ${pressed.toFixed(2)})`);
    check(released < 0.1, `keyup lets it spring back (depth ${released.toFixed(2)})`);
    check((await ev(() => window.__ori.mac.keys.depthOf('Nope'))) === null, 'unknown codes are ignored');

    // ── Sleep ──
    check(await clickMenu('apple', 'Sleep'), 'Apple menu → Sleep is enabled');
    await waitState('overview');
    await page.waitForFunction(() => window.__ori.mac.lidAngle < 0.5, null, { timeout: 20000 });
    const l1 = await lid();
    check(!l1.open && l1.vis === 'hidden', 'Sleep closes the lid and hides the screen DOM (CSS3D is not depth tested)');
    check(await ev(() => window.__ori.state === 'overview'), 'the camera returns to the room (state overview)');
    await ev(() => window.__ori.setView('overview'));
    await settle(session, 2);
    await snap(session, join(SHOTS, 'smoke', `${tag}-lid-closed.png`));
    await ev(() => window.__ori.setView('free'));

    // wake by clicking the closed laptop (picked in 3D because the DOM is hidden)
    const pt = await ev(() => {
      const o = window.__ori;
      const v = o.mac.group.position.clone();
      v.y += 1.6;
      v.project(o.camera);
      return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
    });
    await page.mouse.click(pt.x, pt.y);
    await waitState('screen');
    await page.waitForFunction(() => window.__ori.mac.lidAngle > 100, null, { timeout: 20000 });
    const l2 = await lid();
    check(l2.open && l2.vis === '', 'clicking the closed laptop opens the lid and shows the screen again');
    check(await ev(() => !!document.querySelector('.mac .win-notes') && !!document.querySelector('.mac .win-finder')), 'Sleep keeps the windows (instant desktop)');
    check((await boot()).done, 'no boot animation after Sleep');

    // ── Shut Down → boot on next open ──
    check(await clickMenu('apple', 'Shut Down'), 'Apple menu → Shut Down…');
    await waitState('overview');
    await page.waitForFunction(() => window.__ori.mac.lidAngle < 0.5, null, { timeout: 20000 });
    check(await ev(() => !document.querySelector('.mac .win')), 'Shut Down closes all windows');
    check((await lid()).vis === 'hidden', 'and shuts the lid');
    await page.mouse.click(pt.x, pt.y);
    await page.waitForFunction(() => { const b = document.querySelector('.mac .boot'); return b.classList.contains('run'); }, null, { timeout: 10000 });
    check(true, 'waking after Shut Down runs the boot animation');
    await waitState('screen');
    await page.waitForFunction(() => !!document.querySelector('.mac .win-welcome'), null, { timeout: 20000 });
    check(true, 'the Welcome window opens after the boot');

    // ── Restart keeps its behaviour (boot in place, lid stays open) ──
    check(await clickMenu('apple', 'Restart'), 'Apple menu → Restart…');
    await page.waitForFunction(() => document.querySelector('.mac .boot').classList.contains('run'), null, { timeout: 10000 });
    check((await lid()).open, 'Restart keeps the lid open');
    await page.waitForFunction(() => !!document.querySelector('.mac .win-welcome'), null, { timeout: 20000 });

    // geometry / budget report
    const st = await ev(() => ({ keyTris: window.__ori.mac.keys.triangles }));
    check(st.keyTris > 10000 && st.keyTris < 40000, `keycaps cost ${Math.round(st.keyTris)} triangles in one instanced draw call`);
  } else {
    // flat mode: no lid; Sleep blacks the screen out, click wakes instantly. Shut Down needs a click to boot.
    check(await clickMenu('apple', 'Sleep'), 'flat: Apple menu → Sleep');
    await sleep(200);
    let b = await boot();
    check(b.shut && b.wake === 'sleep', 'flat: Sleep blacks out the screen');
    check(await ev(() => !!document.querySelector('.mac .win-notes')), 'flat: windows are kept while asleep');
    await ev(() => document.querySelector('.mac').click());
    await sleep(200);
    b = await boot();
    check(!b.shut && b.done && b.wake === '', 'flat: a click wakes the desktop instantly (no boot)');

    check(await clickMenu('apple', 'Shut Down'), 'flat: Apple menu → Shut Down…');
    await sleep(200);
    b = await boot();
    check(b.shut && b.wake === 'off', 'flat: Shut Down blacks out the screen');
    await ev(() => document.querySelector('.mac').click());
    await page.waitForFunction(() => document.querySelector('.mac .boot').classList.contains('run'), null, { timeout: 10000 });
    check(true, 'flat: clicking after Shut Down boots again');
    await page.waitForFunction(() => !!document.querySelector('.mac .win-welcome'), null, { timeout: 20000 });
  }
}
