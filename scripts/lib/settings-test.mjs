// System Settings + theming (T11): real clicks in every pane, dark mode / accent / wallpaper live (desktop + 3D wall art),
// Control Center in sync, sound / display / reduce-motion / Do Not Disturb effects, persistence across a reload.
//   runSettings(session)       works on the screen (state `screen`)
//   runSettingsReload(session) the reload part; call it last (it resets the page)
import { join } from 'node:path';
import { SHOTS, sleep, settle, snap } from './harness.mjs';

export async function runSettings(session, { ok, fail }) {
  const { page } = session;
  const tag = `${session.width}x${session.height}`;
  const check = (cond, msg) => (cond ? ok(`settings: ${msg}`) : fail(`settings: ${msg}`));
  const flat = session.width < 860;
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const until = (fn, arg, timeout = 20000) => page.waitForFunction(fn, arg, { timeout }).then(() => true).catch(() => false);
  const center = (sel) => ev((s) => { const el = document.querySelector(s); el.scrollIntoView({ block: 'nearest' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
  const click = async (sel) => { const p = await center(sel); await page.mouse.click(p.x, p.y); await sleep(60); };
  const shot = (name) => snap(session, join(SHOTS, 'smoke', `${tag}-settings-${name}.png`));
  const win = '.mac .win-settings';
  const sys = (k) => ev((key) => window.__ori.core.system.get(key), k);
  const root = () => ev(() => { const m = document.querySelector('.mac'); return { theme: m.dataset.theme, ac: getComputedStyle(m).getPropertyValue('--ac').trim(), cls: m.className }; });

  // clean slate
  await ev(() => {
    const o = window.__ori;
    o.core.storage.remove('system'); o.core.system.reset();
    o.core.theme.setAppearance('light'); o.core.theme.setAccent('blue'); o.core.wallpaper.set('sunrise');
    o.desktop.reset();
  });
  await ev(() => window.__ori.openApp('settings'));
  await until(() => document.querySelector('.mac .win-settings [data-body]'), null);
  await sleep(300);

  // ── panes ──
  const panes = await ev(() => [...document.querySelectorAll('.mac .win-settings [data-pane]')].map((b) => b.dataset.pane));
  check(panes.length === 10 && ['wifi', 'bluetooth', 'sound', 'display', 'notifications', 'appearance', 'wallpaper', 'accessibility', 'general', 'keyboard'].every((p) => panes.includes(p)), `the sidebar lists ${panes.length} panes (${panes.join(', ')})`);
  let titlesOk = true;
  for (const p of panes) {
    await click(`${win} [data-pane="${p}"]`);
    const t = await until((id) => document.querySelector('.mac .win-settings [data-pane].on')?.dataset.pane === id && document.querySelector('.mac .win-settings [data-body]').children.length > 0, p);
    if (!t) { titlesOk = false; fail(`settings: pane ${p} did not render`); }
  }
  check(titlesOk, 'every pane switches and renders content');
  await click(`${win} [data-pane="keyboard"]`);
  check((await ev(() => document.querySelectorAll('.mac .win-settings .st-kbd').length)) >= 8, 'Keyboard pane lists the shortcuts of this site');

  // ── Wi‑Fi / Bluetooth: cosmetic switches that keep their state ──
  await click(`${win} [data-pane="wifi"]`);
  await until(() => document.querySelector('.mac .win-settings [data-tog="wifi"]'), null);
  check((await ev(() => document.querySelectorAll('.mac .win-settings .st-row').length)) >= 4, 'Wi‑Fi pane shows the known networks while it is on');
  await click(`${win} [data-tog="wifi"]`);
  check(await until(() => window.__ori.core.system.get('wifi') === false && document.querySelector('.mac').classList.contains('wifi-off'), null), 'the Wi‑Fi switch turns it off (menubar icon dims)');
  check(await until(() => document.querySelector('.mac .win-settings [data-tog="wifi"]')?.getAttribute('aria-checked') === 'false' && document.querySelectorAll('.mac .win-settings .st-row').length === 1, null), 'the pane re-renders without the network list');
  await click(`${win} [data-tog="wifi"]`);
  await click(`${win} [data-pane="bluetooth"]`);
  await click(`${win} [data-tog="bluetooth"]`);
  check((await sys('bluetooth')) === false, 'Bluetooth switch works');
  await click(`${win} [data-tog="bluetooth"]`);

  // ── Appearance: Dark / Light / Auto ──
  await click(`${win} [data-pane="appearance"]`);
  const lightBg = await ev(() => getComputedStyle(document.querySelector('.mac .win-settings')).backgroundColor);
  await click(`${win} [data-ap="dark"]`);
  check(await until(() => document.querySelector('.mac').dataset.theme === 'dark', null), 'Dark: the desktop switches to the dark theme');
  const darkBg = await ev(() => getComputedStyle(document.querySelector('.mac .win-settings')).backgroundColor);
  const lum = (c) => { const m = c.match(/\d+/g).map(Number); return (m[0] + m[1] + m[2]) / 3; };
  check(lum(lightBg) > 200 && lum(darkBg) < 60, `window surfaces follow (${lightBg} → ${darkBg})`);
  await shot('dark');
  await click(`${win} [data-ap="light"]`);
  check(await until(() => document.querySelector('.mac').dataset.theme === 'light', null), 'Light switches back');
  await click(`${win} [data-ap="auto"]`);
  await ev(() => window.__ori.setTime(13));
  check(await until(() => document.querySelector('.mac').dataset.theme === 'light', null), 'Auto: light at 13:00');
  await ev(() => window.__ori.setTime(23));
  check(await until(() => document.querySelector('.mac').dataset.theme === 'dark', null), 'Auto: dark at 23:00 (follows the room\'s light)');
  await ev(() => window.__ori.setTime(13));
  await click(`${win} [data-ap="light"]`);

  // ── accent colour ──
  await click(`${win} [data-accent="pink"]`);
  const r1 = await root();
  check(r1.ac.toLowerCase() === '#f74f9e', `accent pink sets --ac (${r1.ac})`);
  await click(`${win} [data-pane="accessibility"]`);
  await click(`${win} [data-tog="reduceMotion"]`);
  const swBg = await ev(() => getComputedStyle(document.querySelector('.mac .win-settings [data-tog="reduceMotion"]')).backgroundColor);
  check(swBg === 'rgb(247, 79, 158)', `switches use the accent (${swBg})`);
  check((await sys('reduceMotion')) === true && (await root()).cls.includes('reduce-motion'), 'Reduce motion: the desktop gets the reduce-motion class');
  check(await ev(() => document.documentElement.classList.contains('reduce-motion')), 'Reduce motion: also on the page root (camera sway / parallax read it)');
  await click(`${win} [data-tog="reduceMotion"]`);
  await click(`${win} [data-pane="appearance"]`);
  await click(`${win} [data-accent="blue"]`);

  // ── wallpaper: desktop canvas + 3D wall art ──
  await click(`${win} [data-pane="wallpaper"]`);
  check((await ev(() => document.querySelectorAll('.mac .win-settings .st-wp').length)) >= 7, 'Wallpaper pane: ≥ 7 wallpapers with thumbnails');
  check((await ev(() => [...document.querySelectorAll('.mac .win-settings [data-wpt] canvas')].every((c) => { const d = c.getContext('2d').getImageData(10, 10, 1, 1).data; return d[3] > 0; }))), 'every thumbnail is painted');
  const sig = () => ev(() => { const c = document.querySelector('.mac .wall canvas'); const g = c.getContext('2d'); const px = [[40, 40], [640, 300], [1200, 700], [300, 600]].flatMap(([x, y]) => [...g.getImageData(x, y, 1, 1).data.slice(0, 3)]); return px.join(','); });
  const art = () => ev(() => { let id = null; window.__ori.scene.traverse((o) => { if (o.isMesh && o.material && o.material.map && o.material.map.image && o.material.map.image.width === 1280 && o.material.map.image.height === 832) id = o.material.map.uuid; }); return id; });
  const s0 = await sig(), a0 = await art();
  await click(`${win} [data-wp="dunes"]`);
  check(await until(() => window.__ori.core.wallpaper.id === 'dunes', null), 'picking Dunes changes the wallpaper');
  const s1 = await sig();
  check(s0 !== s1, 'the desktop wallpaper repaints');
  const a1 = await art();
  check(!!a0 && !!a1 && a0 !== a1, 'the 3D wall art in the room gets the new picture too');
  check((await ev(() => window.__ori.core.storage.get('wallpaper'))) === 'dunes', 'the choice is persisted');
  await shot('wallpaper');
  // Dynamic follows the time of day
  await click(`${win} [data-wp="dynamic"]`);
  await ev(() => window.__ori.setTime(13));
  await until(() => window.__ori.core.wallpaper.id === 'dynamic', null);
  await settle(session, 2);
  const dDay = await sig();
  await ev(() => window.__ori.setTime(1));
  await settle(session, 3);
  const dNight = await sig();
  check(dDay !== dNight, 'Dynamic wallpaper looks different at 13:00 and 01:00');
  await ev(() => { window.__ori.setTime(13); window.__ori.core.wallpaper.set('sunrise'); });

  // ── Sound ↔ audio engine, speaker button ──
  await click(`${win} [data-pane="sound"]`);
  await ev(() => { const s = document.querySelector('.mac .win-settings [data-sld="volume"]'); s.value = '30'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  check((await sys('volume')) === 30 && Math.abs((await ev(() => window.__ori.audio().volume)) - 0.3) < 0.001, 'Output volume slider drives the audio master volume (30%)');
  await click(`${win} [data-tog="muted"]`);
  check(await until(() => window.__ori.core.system.get('muted') === true && window.__ori.audio().enabled === false, null), 'Mute switch silences the audio engine');
  check(await ev(() => { const b = document.getElementById('btn-sound'); return /M16 9\.5l5 5/.test(b.innerHTML) && b.getAttribute('aria-pressed') === 'false'; }), 'the speaker button in the corner shows "muted" too (cross icon, aria-pressed=false)');
  await click(`${win} [data-tog="muted"]`);
  check(await until(() => window.__ori.core.system.get('muted') === false && window.__ori.audio().enabled === true, null), 'Unmuting restores the sound');
  await ev(() => { const s = document.querySelector('.mac .win-settings [data-sld="volume"]'); s.value = '70'; s.dispatchEvent(new Event('input', { bubbles: true })); });

  // ── Display: brightness + Night Shift ──
  await click(`${win} [data-pane="display"]`);
  await ev(() => { const s = document.querySelector('.mac .win-settings [data-sld="brightness"]'); s.value = '50'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  check(await until(() => { const d = document.querySelector('.mac .dimmer'); return !d.hidden && Math.abs(+d.style.opacity - 0.375) < 0.01; }, null), 'Brightness 50% dims the screen (dimmer 0.375)');
  await click(`${win} [data-tog="nightShift"]`);
  check(await until(() => document.querySelector('.mac').classList.contains('night-shift'), null), 'Night Shift warms the screen');
  await click(`${win} [data-tog="nightShift"]`);
  await ev(() => { const s = document.querySelector('.mac .win-settings [data-sld="brightness"]'); s.value = '100'; s.dispatchEvent(new Event('input', { bubbles: true })); });

  // ── Notifications: Do Not Disturb ──
  await click(`${win} [data-pane="notifications"]`);
  await click(`${win} [data-tog="dnd"]`);
  const dnd = await ev(() => { const n = window.__ori.core.notifications; n.notify({ title: 't11', body: 'quiet' }); return { on: n.isDoNotDisturb(), silent: n.recent()[0].silent }; });
  check(dnd.on && dnd.silent, 'Do Not Disturb silences banners (notification kept, flagged silent)');
  await click(`${win} [data-tog="dnd"]`);

  // ── Control Center stays in sync with Settings ──
  await click('.mac [data-act="cc"]');
  await until(() => !document.querySelector('.mac .cc').hidden, null);
  await shot('cc');
  const cc = await ev(() => ({ wifi: document.querySelector('.mac .cc [data-sys="wifi"] .cc-ic').classList.contains('on'), sub: document.querySelector('.mac .cc [data-sub="wifi"]').textContent, vol: document.querySelector('.mac .cc [data-cc="vol"]').value }));
  check(cc.wifi && cc.sub === 'Home' && cc.vol === '70', `Control Center mirrors Settings (Wi‑Fi on / ${cc.sub}, volume ${cc.vol})`);
  await click('.mac .cc [data-sys="wifi"]');
  check(await until(() => window.__ori.core.system.get('wifi') === false && document.querySelector('.mac .cc [data-sub="wifi"]').textContent === 'Off' && document.querySelector('.mac .win-settings [data-pane].on') !== null, null), 'a Control Center toggle flips the shared Wi‑Fi state');
  await click('.mac .cc [data-sys="wifi"]');
  await click('.mac .cc [data-cc-theme]');
  check(await until(() => document.querySelector('.mac').dataset.theme === 'dark', null), 'the Dark Mode tile in Control Center switches the theme');
  await ev(() => { const s = document.querySelector('.mac .cc [data-cc="vol"]'); s.value = '0'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  check(await until(() => window.__ori.core.system.get('muted') === true, null), 'dragging the Control Center volume to 0 mutes');
  await ev(() => { const s = document.querySelector('.mac .cc [data-cc="vol"]'); s.value = '70'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await click('.mac [data-act="cc"]');
  await ev(() => window.__ori.core.theme.setAppearance('light'));

  // ── the other apps in dark mode: none of them keeps a white surface ──
  await ev(() => window.__ori.core.theme.setAppearance('dark'));
  const bad = [];
  for (const id of ['finder', 'safari', 'notes', 'mail', 'welcome']) {
    await ev(() => window.__ori.desktop.reset());
    await ev((a) => window.__ori.openApp(a), id);
    await sleep(350);
    const white = await ev((a) => {
      const w = document.querySelector(`.mac .win-${a}`);
      const light = (c) => { const m = c.match(/[\d.]+/g).map(Number); return (m.length > 3 && m[3] < 0.5) ? false : (m[0] + m[1] + m[2]) / 3 > 215; };
      const r = w.getBoundingClientRect();
      return [...w.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width * b.height > 4000 && light(getComputedStyle(e).backgroundColor) && !e.closest('svg, .cover, .fic, .chips, .lights'); }).map((e) => e.className || e.tagName).slice(0, 3).concat(r.width ? [] : ['hidden']);
    }, id);
    if (white.length) bad.push(`${id}: ${white.join(',')}`);
  }
  check(!bad.length, `dark mode leaves no big light surfaces in Finder / Safari / Notes / Mail / Welcome${bad.length ? ` (${bad.join(' | ')})` : ''}`);
  await ev(() => { window.__ori.core.theme.setAppearance('light'); window.__ori.desktop.reset(); });
}

/** Persistence: everything chosen above survives a reload. Resets the page — call last. */
export async function runSettingsReload(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`settings: ${msg}`) : fail(`settings: ${msg}`));
  await page.evaluate(() => {
    const o = window.__ori.core;
    o.theme.setAppearance('dark'); o.theme.setAccent('green'); o.wallpaper.set('midnight');
    o.system.set('volume', 40); o.system.set('nightShift', true); o.system.set('brightness', 80);
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ori && window.__ori.ready, null, { timeout: 60000 });
  const r = await page.evaluate(() => {
    const m = document.querySelector('.mac');
    const o = window.__ori.core;
    return { theme: m.dataset.theme, accent: m.dataset.ac, ac: getComputedStyle(m).getPropertyValue('--ac').trim(), wp: o.wallpaper.id, vol: o.system.get('volume'), shift: m.classList.contains('night-shift'), bright: o.system.get('brightness'), dim: document.querySelector('.mac .dimmer').hidden };
  });
  check(r.theme === 'dark' && r.accent === 'green', `appearance + accent survive a reload (${r.theme}, ${r.accent} ${r.ac})`);
  check(r.wp === 'midnight', `the wallpaper survives (${r.wp})`);
  check(r.vol === 40 && r.shift && r.bright === 80 && !r.dim, 'volume, Night Shift and brightness survive');
  // prefers-reduced-motion is the default for Reduce motion
  await page.evaluate(() => { window.__ori.core.storage.remove('system'); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ori && window.__ori.ready, null, { timeout: 60000 });
  check(await page.evaluate(() => window.__ori.core.system.get('reduceMotion') === true && document.querySelector('.mac').classList.contains('reduce-motion')), 'the OS "reduce motion" preference turns Reduce motion on by default');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => { const o = window.__ori.core; o.storage.remove('system'); o.storage.remove('theme:appearance'); o.storage.remove('theme:accent'); o.storage.remove('wallpaper'); });
}
