// Integration test of the window-manager contract (T3): registers a throw-away app at runtime and checks
// mount / titlebar / key routing / pause-resume / minimise / lock / resize / destroy / ctx.open.
import { sleep, settle } from './harness.mjs';

export async function runWmContract(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`wm: ${msg}`) : fail(`wm: ${msg}`));
  const log = () => page.evaluate(() => window.__wmlog.slice());
  const clear = () => page.evaluate(() => { window.__wmlog.length = 0; });
  const has = async (entry) => (await log()).includes(entry);

  await page.evaluate(() => {
    window.__wmlog = [];
    window.__ori.registry.registerApp({
      id: 'wmtest', name: 'WM Test', category: 'game', titlebar: 'dark', size: { w: 400, h: 300, minW: 300, minH: 200 },
      icon: '<svg viewBox="0 0 64 64"></svg>',
      mount(el, ctx) {
        window.__wmctx = ctx;
        el.innerHTML = '<div class="wmt" style="flex:1">hello</div>';
        window.__wmlog.push('mount');
        ctx.onKey((e) => { window.__wmlog.push(`key:${e.type}:${e.key}`); return e.key.startsWith('Arrow'); });
        return {
          destroy: () => window.__wmlog.push('destroy'),
          onFocus: () => window.__wmlog.push('onFocus'),
          onBlur: () => window.__wmlog.push('onBlur'),
          onResize: (w, h) => window.__wmlog.push(`resize:${w}x${h}`),
          pause: () => window.__wmlog.push('pause'),
          resume: () => window.__wmlog.push('resume'),
        };
      },
    });
    window.__ori.desktop.reset();
  });

  check(await page.evaluate(() => window.__ori.listApps().includes('wmtest')), 'runtime-registered app is listed');
  await page.evaluate(() => window.__ori.openApp('wmtest'));
  await sleep(300);
  check(await has('mount'), 'mount() called');
  check(await page.evaluate(() => {
    const t = document.querySelector('.mac .win-wmtest > .tb.dark .tt');
    return !!t && t.textContent === 'WM Test' && !!document.querySelector('.mac .win-wmtest > .wm-body .wmt');
  }), 'dark titlebar + body container rendered by the window manager');
  check(await page.evaluate(() => document.querySelector('#mb-app').textContent === 'WM Test'), 'menubar shows the front app name');
  check(await page.evaluate(() => !document.querySelector('.mac .dock .dk[data-app="wmtest"]')), 'dock:false app is not pinned in the Dock');

  await page.evaluate(() => window.__wmctx.win.setTitle('Renamed'));
  check(await page.evaluate(() => document.querySelector('.mac .win-wmtest .tt').textContent === 'Renamed'), 'ctx.win.setTitle updates the title bar');
  const compact = await page.evaluate(() => window.__ori.desktop.root.classList.contains('compact')); // flat mode forces full-width windows
  check(await page.evaluate((c) => { const s = window.__wmctx.win.size(); return c ? s.w > 0 && s.h > 0 : s.w === 400 && s.h === 300; }, compact), 'ctx.win.size() reports the window size');

  // keys
  await clear();
  const consumed = await page.evaluate(() => {
    const ev = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
    window.dispatchEvent(ev);
    const ev2 = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    window.dispatchEvent(ev2);
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp', bubbles: true }));
    return [ev.defaultPrevented, ev2.defaultPrevented];
  });
  check(consumed[0] === true && consumed[1] === false, 'onKey: returning true calls preventDefault (only then)');
  check((await log()).join() === 'key:keydown:ArrowUp,key:keydown:a,key:keyup:ArrowUp', 'onKey receives keydown + keyup');

  // typing in a text field must not reach the game
  await clear();
  await page.evaluate(() => {
    const i = document.createElement('input');
    document.body.appendChild(i);
    i.focus();
    i.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    i.remove();
  });
  check((await log()).length === 0, 'keys typed into an input are not forwarded');

  // focus change → onBlur + pause; keys stop
  await clear();
  await page.evaluate(() => window.__ori.openApp('finder'));
  await sleep(200);
  const afterBlur = await log();
  check(afterBlur.includes('onBlur') && afterBlur.includes('pause'), 'inactive window gets onBlur + pause');
  await clear();
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })));
  check((await log()).length === 0, 'inactive window receives no keys');
  await clear();
  await page.evaluate(() => window.__ori.desktop.wm.focus('wmtest'));
  const afterFocus = await log();
  check(afterFocus.includes('onFocus') && afterFocus.includes('resume'), 're-focus gives onFocus + resume');

  // lock / unlock (camera leaves the screen)
  await clear();
  await page.evaluate(() => window.__ori.desktop.setLocked(true));
  check(await has('pause'), 'setLocked(true) pauses the app');
  check(await page.evaluate(() => window.__wmctx.isInteractive() === false), 'ctx.isInteractive() is false while locked');
  await clear();
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })));
  check((await log()).length === 0, 'no keys while locked');
  await clear();
  await page.evaluate(() => window.__ori.desktop.setLocked(false));
  check(await has('resume'), 'setLocked(false) resumes the active app');
  check(await page.evaluate(() => window.__wmctx.isInteractive() === true), 'ctx.isInteractive() is true again');

  // minimise / restore
  await clear();
  await page.evaluate(() => window.__ori.desktop.wm.minimize('wmtest'));
  check(await has('pause'), 'minimise pauses');
  await clear();
  await page.evaluate(() => window.__ori.desktop.open('wmtest'));
  check(await has('resume'), 'restoring a minimised front window resumes it');

  // resize
  await clear();
  await page.evaluate(() => { document.querySelector('.mac .win-wmtest').style.width = '460px'; });
  await settle(session, 2); // ResizeObserver callbacks only fire when a frame is rendered (slow under software GL)
  if (compact) ok('wm: (flat mode: window size is forced by CSS, resize check skipped)');
  else check((await log()).some((l) => l.startsWith('resize:460x')), 'onResize fires when the window size changes');

  // ctx.open with an alias
  await page.evaluate(() => window.__wmctx.open('skills'));
  await sleep(200);
  check(await page.evaluate(() => !!document.querySelector('.mac .win-notes .nli.on[data-note="skills"]')), 'ctx.open(alias) opens the app with args (Notes → Skills)');

  // close → destroy
  await clear();
  await page.evaluate(() => window.__ori.desktop.wm.close('wmtest'));
  check(await has('destroy'), 'close() calls destroy()');
  await sleep(250);
  check(await page.evaluate(() => !document.querySelector('.mac .win-wmtest')), 'window element removed after the close animation');

  // Spotlight indexes registry apps (games labelled "Game")
  await page.evaluate(() => {
    const root = window.__ori.desktop.root;
    root.querySelector('[data-act="spot"]').click();
    const i = root.querySelector('.spot input');
    i.value = 'wm test';
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  check(await page.evaluate(() => /WM Test/.test(document.querySelector('.mac .spot-res').textContent) && /Game/.test(document.querySelector('.mac .spot-res').textContent)), 'Spotlight lists registry apps with their kind');
  await page.evaluate(() => window.__ori.desktop.closeOverlays());
  await page.evaluate(() => window.__ori.desktop.reset());
}
