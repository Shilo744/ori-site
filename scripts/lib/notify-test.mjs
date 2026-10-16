// Notifications, Notification Center, achievements UI, onboarding (T16).
//   runNotify(session)            banners (stack, auto-dismiss, hover pause, click, ×), Do Not Disturb, Notification Center,
//                                 toasts in the room, Trophies tag, achievement trackers, Reset progress
//   runNotifyOnboarding(session)  the first-run notifications (reloads the page — call late)
import { join } from 'node:path';
import { SHOTS, sleep, settle, snap } from './harness.mjs';

export async function runNotify(session, { ok, fail }) {
  const { page } = session;
  const tag = `${session.width}x${session.height}`;
  const check = (cond, msg) => (cond ? ok(`notify: ${msg}`) : fail(`notify: ${msg}`));
  const flat = session.width < 860;
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const until = (fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout }).then(() => true).catch(() => false);
  const center = (sel) => ev((s) => { const el = document.querySelector(s); el.scrollIntoView({ block: 'nearest' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
  const click = async (sel) => { const p = await center(sel); await page.mouse.move(p.x - 2, p.y - 2); await page.mouse.click(p.x, p.y); await sleep(60); };
  const shot = (name) => snap(session, join(SHOTS, 'smoke', `${tag}-notify-${name}.png`));
  const send = (n) => ev((x) => window.__ori.core.notifications.notify(x), n);
  const banners = () => ev(() => document.querySelectorAll('.mac .nb:not(.out)').length);
  const reset = () => ev(() => { const o = window.__ori; o.banners.dismissAll(); o.core.notifications.clear(); o.core.system.set('dnd', false); o.banners.duration = 5000; });

  await ev(() => { window.__ori.banners.quiet = false; }); // this block is about the banners themselves
  // we need the screen
  if (!flat && (await ev(() => window.__ori.state)) !== 'screen') {
    await ev(() => window.__ori.enterScreen());
    await until(() => window.__ori.state === 'screen', null, 30000);
  }
  await ev(() => { window.__ori.desktop.reset(); window.__ori.core.storage.set('onboarded', true); });
  await sleep(2800); // a fresh session just entered the screen: let the onboarding notifications (and "First steps") finish arriving
  await reset();
  await sleep(300);

  // ── the achievements catalogue ──
  const list = await ev(() => window.__ori.core.achievements.list().map((a) => ({ id: a.id, icon: !!a.icon, rarity: a.rarity, name: !!a.name, desc: !!a.desc })));
  check(list.length >= 24, `${list.length} achievements defined (≥ 24)`);
  check(list.every((a) => a.icon && a.name && a.desc && ['common', 'rare', 'epic', 'legendary'].includes(a.rarity)), 'each has an icon, a name, a description and a rarity colour');
  for (const id of ['first-steps', 'app-hopper', 'game-night', 'high-roller', 'night-owl', 'konami', 'sudo', 'wallpaper-changer', 'dark-side', 'curious', 'room-explorer', 'sweeper']) {
    if (!list.some((a) => a.id === id)) fail(`notify: achievement "${id}" is missing`);
  }

  // ── banners ──
  await send({ title: '<b>Hello</b> & co', body: 'second line', app: 'mail' });
  check(await until(() => document.querySelectorAll('.mac .nb.in:not(.out)').length === 1, null), 'a banner slides in inside the screen');
  const txt = await ev(() => document.querySelector('.mac .nb:not(.out) strong').innerHTML);
  check(txt === '&lt;b&gt;Hello&lt;/b&gt; &amp; co', 'text is escaped (no markup injection)');
  check((await ev(() => document.querySelector('.mac .nb:not(.out) .nb-top b').textContent)) === 'Mail', 'the header shows the app name');
  await shot('banner');
  for (let i = 0; i < 4; i++) await send({ title: `Stack ${i}`, body: 'x' });
  await sleep(500);
  check((await banners()) <= 3 && (await banners()) >= 2, `at most 3 banners are stacked (${await banners()})`);
  await reset();
  await sleep(500);
  check((await banners()) === 0, 'dismissAll clears the stack');

  // auto-dismiss + hover pause
  await ev(() => { window.__ori.banners.duration = 900; });
  await send({ title: 'Quick', body: 'goes away' });
  await until(() => document.querySelectorAll('.mac .nb.in:not(.out)').length === 1, null);
  check(await until(() => document.querySelectorAll('.mac .nb:not(.out)').length === 0, null, 6000), 'a banner dismisses itself after its time');
  await ev(() => { window.__ori.banners.duration = 2200; });
  await send({ title: 'Hold me', body: 'hover keeps it' });
  await until(() => document.querySelectorAll('.mac .nb.in:not(.out)').length === 1, null);
  await sleep(600); // let the slide-in finish before aiming at it
  const bp = await center('.mac .nb:not(.out)');
  await page.mouse.move(bp.x - 3, bp.y - 3);
  await page.mouse.move(bp.x, bp.y);
  await sleep(3000); // longer than its 2.2 s
  check((await banners()) === 1, 'hovering a banner pauses its timer');
  await page.mouse.move(bp.x - 400, bp.y + 200);
  check(await until(() => document.querySelectorAll('.mac .nb:not(.out)').length === 0, null, 8000), '…and it goes when the pointer leaves');
  await ev(() => { window.__ori.banners.duration = 5000; });

  // click action + ×
  await ev(() => { window.__clicked = 0; window.__ori.core.notifications.notify({ title: 'Click me', body: 'action', onClick: () => { window.__clicked++; } }); });
  await until(() => document.querySelectorAll('.mac .nb.in:not(.out)').length === 1, null);
  await click('.mac .nb:not(.out)');
  check(await until(() => window.__clicked === 1 && document.querySelectorAll('.mac .nb:not(.out)').length === 0, null), 'clicking a banner runs its action and dismisses it');
  await send({ title: 'Close me', body: 'x' });
  await until(() => document.querySelectorAll('.mac .nb.in:not(.out)').length === 1, null);
  const bp2 = await center('.mac .nb:not(.out)');
  await page.mouse.move(bp2.x, bp2.y);
  await sleep(150);
  await click('.mac .nb:not(.out) .nb-x');
  check(await until(() => document.querySelectorAll('.mac .nb:not(.out)').length === 0, null), 'the × button dismisses a banner');
  await ev(() => window.__ori.core.achievements.unlock('dark-side'));
  check(await until(() => /Achievement unlocked/.test(document.querySelector('.mac .nb:not(.out) strong')?.textContent || ''), null), 'unlocking an achievement shows a banner');
  await click('.mac .nb:not(.out)');
  check(await until(() => !!document.querySelector('.mac .win-arcade') && document.querySelector('.mac .win-arcade .arc-tab.on')?.dataset.tab === 'trophies', null), 'clicking it opens the Arcade on the Achievements tab');
  await shot('trophies');
  await ev(() => window.__ori.desktop.reset());
  await reset();

  // ── Do Not Disturb ──
  await ev(() => window.__ori.core.system.set('dnd', true));
  await send({ title: 'Silent one', body: 'no banner' });
  await sleep(500);
  const dnd = await ev(() => ({ b: document.querySelectorAll('.mac .nb:not(.out)').length, silent: window.__ori.core.notifications.recent()[0]?.silent }));
  check(dnd.b === 0 && dnd.silent === true, 'Do Not Disturb: no banner, but the notification is kept');

  // ── Notification Center ──
  await click('#mb-clock');
  check(await until(() => !document.querySelector('.mac .nc').hidden && document.querySelector('.mac .nc').classList.contains('in'), null), 'clicking the clock opens Notification Center');
  const nc = await ev(() => ({ rows: document.querySelectorAll('.mac .nc .nc-n').length, cal: !!document.querySelector('.mac .nc .nc-cal-g'), today: document.querySelector('.mac .nc .nc-cal-g i.t')?.textContent, wx: !!document.querySelector('.mac .nc .nc-wx'), clocks: document.querySelectorAll('.mac .nc .nc-wc div').length, silentRow: [...document.querySelectorAll('.mac .nc .nc-n strong')].some((e) => e.textContent === 'Silent one') }));
  check(nc.rows >= 1 && nc.silentRow, 'it lists the notification that arrived silently');
  check(nc.cal && nc.today === String(new Date().getDate()) && nc.wx && nc.clocks === 4, `Today widgets: calendar (today = ${nc.today}), weather, world clock ×${nc.clocks}`);
  await shot('center');
  await send({ title: 'While open', body: 'live update' });
  check(await until(() => [...document.querySelectorAll('.mac .nc .nc-n strong')].some((e) => e.textContent === 'While open'), null, 4000) || (await ev(() => window.__ori.core.system.get('dnd'))), 'the list updates while the panel is open');
  await click('.mac .nc [data-nc-clear]');
  check(await until(() => document.querySelectorAll('.mac .nc .nc-n').length === 0 && !!document.querySelector('.mac .nc .nc-empty'), null), '"Clear" empties the list');
  await page.mouse.click(300, 360);
  check(await until(() => document.querySelector('.mac .nc').hidden, null), 'a click outside closes it');
  await ev(() => window.__ori.core.system.set('dnd', false));
  await send({ title: 'Banner swept', body: 'by the panel' });
  await until(() => document.querySelectorAll('.mac .nb.in:not(.out)').length === 1, null);
  await click('#mb-clock');
  check(await until(() => document.querySelectorAll('.mac .nb:not(.out)').length === 0 && !document.querySelector('.mac .nc').hidden, null), 'opening Notification Center sweeps the banners away');
  await click('#mb-clock');
  check(await until(() => document.querySelector('.mac .nc').hidden, null), 'the clock toggles it closed');

  // ── achievement trackers ──
  const t0 = await ev(() => window.__ori.core.achievements.counts().unlocked);
  await ev(() => {
    const o = window.__ori.core;
    o.theme.setAppearance('dark'); o.theme.setAppearance('light');
    ['pink', 'green', 'orange', 'red'].forEach((a) => o.theme.setAccent(a)); o.theme.setAccent('blue');
    ['dunes', 'ocean', 'mono'].forEach((w) => o.wallpaper.set(w)); o.wallpaper.set('sunrise');
    o.system.set('dnd', true); o.system.set('dnd', false);
    ['day', 'golden', 'night', 'auto'].forEach((m) => window.__ori.daylight.setMode(m, { instant: true }));
    ['finder', 'notes', 'safari', 'mail', 'terminal', 'settings'].forEach((a) => window.__ori.openApp(a));
  });
  await sleep(500);
  const got = await ev(() => Object.fromEntries(window.__ori.core.achievements.list().filter((a) => ['dark-side', 'accent-artist', 'wallpaper-changer', 'quiet-please', 'time-traveller', 'multitasker'].includes(a.id)).map((a) => [a.id, a.unlocked])));
  check(Object.values(got).every(Boolean), `trackers unlock: ${Object.keys(got).filter((k) => got[k]).join(', ')}`);
  // Konami + Spotlight + notes
  await ev(() => { window.__ori.desktop.reset(); });
  for (const code of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA']) await page.keyboard.press(code);
  check(await until(() => window.__ori.core.achievements.isUnlocked('konami'), null), 'the Konami code unlocks "Old school"');
  await page.keyboard.press('Control+Space');
  await until(() => !document.querySelector('.mac .spot').hidden, null);
  await sleep(200); // the input takes focus a moment after the panel opens
  await page.keyboard.type('notes');
  await sleep(150);
  await page.keyboard.press('Enter');
  check(await until(() => window.__ori.core.achievements.isUnlocked('spotlight-pro'), null), 'opening something with Spotlight unlocks "Spotlight on"');
  await until(() => !!document.querySelector('.mac .win-notes'), null);
  for (const n of ['experience', 'skills']) { await click(`.mac .win-notes [data-note="${n}"]`); }
  check(await until(() => window.__ori.core.achievements.list().find((a) => a.id === 'bookworm').progress >= 3, null), 'reading all three notes moves "Bookworm"');
  const t1 = await ev(() => window.__ori.core.achievements.counts().unlocked);
  check(t1 > t0 + 6, `${t1 - t0} more achievements unlocked by playing around`);
  await ev(() => window.__ori.desktop.reset());

  if (flat) { await reset(); await ev(() => { window.__ori.banners.quiet = true; }); return; }

  // ── the room: toasts instead of banners, the Trophies tag ──
  await reset();
  await page.keyboard.press('Escape');
  await until(() => window.__ori.state === 'overview', null, 30000);
  await send({ title: 'Toast!', body: 'seen from the room', app: 'trophies' });
  check(await until(() => document.querySelectorAll('#toasts .nt.in').length === 1, null), 'in the room a black toast appears instead of a banner');
  check((await ev(() => document.querySelectorAll('.mac .nb:not(.out)').length)) === 0, '…and no banner inside the (tiny) screen');
  await shot('toast');
  const c = await ev(() => window.__ori.core.achievements.counts());
  check((await ev(() => document.getElementById('hud-trophies').textContent)) === `Trophies ${c.unlocked}/${c.total}`, `the HUD tag reads "Trophies ${c.unlocked}/${c.total}"`);
  await click('#hud-trophies');
  check(await until(() => window.__ori.state === 'screen' && document.querySelector('.mac .win-arcade .arc-tab.on')?.dataset.tab === 'trophies', null, 40000), 'clicking the Trophies tag enters the screen and opens the Arcade → Achievements');
  await shot('trophies-tab');

  // ── Reset progress (Settings → General) ──
  await ev(() => { window.__ori.desktop.reset(); window.__ori.openApp('settings'); });
  await until(() => document.querySelector('.mac .win-settings [data-pane="general"]'), null);
  await click('.mac .win-settings [data-pane="general"]');
  await until(() => document.querySelector('.mac .win-settings [data-reset]'), null);
  await click('.mac .win-settings [data-reset]');
  check(await ev(() => document.querySelector('.mac .win-settings [data-reset]').classList.contains('armed')), 'Reset progress asks for confirmation first');
  check((await ev(() => window.__ori.core.achievements.counts().unlocked)) > 0, '…and nothing is reset yet');
  await click('.mac .win-settings [data-reset]');
  check(await until(() => window.__ori.core.achievements.counts().unlocked === 0, null), 'a second click resets the achievements');
  check((await ev(() => window.__ori.core.storage.get('onboarded', null))) === null && (await ev(() => window.__ori.core.storage.keys('scores:').length)) === 0, '…the high scores and the onboarding flag too');
  check((await ev(() => document.getElementById('hud-trophies').textContent)).startsWith('Trophies 0/'), 'the Trophies tag follows');
  await ev(() => { window.__ori.desktop.reset(); window.__ori.core.storage.set('onboarded', true); window.__ori.banners.quiet = true; });
  await page.keyboard.press('Escape');
  await until(() => window.__ori.state === 'overview', null, 30000);
}

/** First run: the welcome notifications arrive one after another (and still arrive silently under Do Not Disturb). */
export async function runNotifyOnboarding(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`onboarding: ${msg}`) : fail(`onboarding: ${msg}`));
  const flat = session.width < 860;
  const until = (fn, arg, timeout = 20000) => page.waitForFunction(fn, arg, { timeout }).then(() => true).catch(() => false);
  await page.evaluate(() => { const c = window.__ori.core; c.storage.remove('onboarded'); c.notifications.clear(); c.system.set('dnd', false); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ori && window.__ori.ready, null, { timeout: 60000 });
  await page.click('#intro-start', { timeout: 15000 });
  await until(() => window.__ori.state === 'ready', null);
  await page.evaluate(() => window.__ori.enterScreen());
  await until((f) => window.__ori.state === (f ? 'flat' : 'screen'), flat, 30000);
  check(await until(() => window.__ori.core.notifications.recent().filter((n) => n.app !== 'trophies').length >= 4, null, 30000), 'four friendly notifications arrive after the first entry');
  const titles = await page.evaluate(() => window.__ori.core.notifications.recent().map((n) => n.title).reverse());
  check(/Welcome/.test(titles.join()) && /Spotlight/.test(titles.join()) && /Arcade/.test(titles.join()) && /terminal/i.test(titles.join()), `welcome → Spotlight → Arcade → terminal (${titles.filter((t) => !/Achievement/.test(t)).join(' | ')})`);
  check(await page.evaluate(() => window.__ori.core.storage.get('onboarded', false) === true), 'it only runs once (flag stored)');
  // a second visit stays quiet
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ori && window.__ori.ready, null, { timeout: 60000 });
  await page.click('#intro-start', { timeout: 15000 });
  await until(() => window.__ori.state === 'ready', null);
  await page.evaluate(() => { window.__ori.core.notifications.clear(); window.__ori.enterScreen(); });
  await until((f) => window.__ori.state === (f ? 'flat' : 'screen'), flat, 30000);
  await new Promise((r) => setTimeout(r, 1500));
  check((await page.evaluate(() => window.__ori.core.notifications.recent().filter((n) => !/Achievement/.test(n.title)).length)) === 0, 'a returning visitor gets no onboarding');
}
