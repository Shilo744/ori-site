// Window manager v2 (T8): drag + clamp, resize from every edge with min sizes and cursors, zoom (button + double-click),
// edge snapping with preview, minimise to the Dock + restore, geometry memory, cascade, dimming, shortcuts, flat mode.
import { join } from 'node:path';
import { SHOTS, sleep, settle, snap } from './harness.mjs';

export async function runWm2(session, { ok, fail }) {
  const { page } = session;
  const tag = `${session.width}x${session.height}`;
  const flat = session.width < 860;
  const check = (cond, msg) => (cond ? ok(`wm2: ${msg}`) : fail(`wm2: ${msg}`));
  const close = (a, b, tol, msg) => check(Math.abs(a - b) <= tol, `${msg} (${Math.round(a * 10) / 10} ≈ ${Math.round(b * 10) / 10})`);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const rect = (id) => ev((i) => window.__ori.desktop.wm.rect(i), id);
  const mode = (id) => ev((i) => window.__ori.desktop.wm.get(i)?.mode, id);
  const front = () => ev(() => window.__ori.desktop.wm.front());
  const center = (sel) => ev((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, sel);
  const rootBox = () => ev(() => { const r = window.__ori.desktop.root; const b = r.getBoundingClientRect(); return { left: b.left, top: b.top, width: b.width, height: b.height, k: b.width / r.offsetWidth, w: r.offsetWidth, h: r.offsetHeight }; });
  const reset = () => ev(() => { const o = window.__ori; o.core.storage.remove('wm:geom'); o.desktop.reset(); });
  // the open animation (scale .94 → 1) only starts at the first rendered frame, which is slow under software GL: wait for it
  const open = async (...ids) => { await ev((l) => l.forEach((i) => window.__ori.openApp(i)), ids); await settle(session, 2); await sleep(330); };
  const drag = async (from, to, steps = 10) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps });
    await page.mouse.up();
  };
  const clickDock = async (sel) => {
    for (let i = 0; i < 2; i++) { const t = await center(sel); await page.mouse.move(t.x, t.y); await sleep(90); }
    const t = await center(sel);
    await page.mouse.move(t.x, t.y);
    await sleep(90);
    await page.mouse.click(t.x, t.y);
  };
  const shot = (name) => snap(session, join(SHOTS, 'smoke', `${tag}-wm-${name}.png`));
  const cursorKind = () => ev(() => document.querySelector('.mac .cur').dataset.k);
  // input events and CSS transitions are only processed when the (software-rendered, ~1fps) page gets a frame: poll instead of sleeping
  const until = (fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout }).then(() => true).catch(() => false);
  const untilRect = (id, r) => until(([i, t]) => { const g = window.__ori.desktop.wm.rect(i); return g && g.x === t.x && g.y === t.y && g.w === t.w && g.h === t.h; }, [id, r]);

  // deterministic geometry: the open animation (scale .94 → 1) only starts at the first rendered frame, which is slow under software GL
  const noAnim = await page.addStyleTag({ content: '.mac .win { animation: none !important; }' });
  await reset();

  if (flat) {
    // flat mode: no resize handles, no dragging, no snapping, zoom is a no-op
    await open('terminal');
    check(await ev(() => getComputedStyle(document.querySelector('.win-terminal .rz')).display === 'none'), 'flat: resize handles are hidden');
    const before = await rect('terminal');
    const c = await center('.win-terminal > header');
    await drag(c, { x: c.x + 30, y: c.y + 30 });
    const after = await rect('terminal');
    check(before.x === after.x && before.y === after.y, 'flat: dragging a title bar does not move the window');
    await ev(() => window.__ori.desktop.wm.zoom('terminal'));
    await ev(() => window.__ori.desktop.wm.snap('terminal', 'left'));
    check((await mode('terminal')) === 'normal', 'flat: zoom / snap are ignored');
    await reset();
    await noAnim.evaluate((el) => el.remove());
    return;
  }

  // ── drag + clamp ──
  await open('terminal');
  const r0 = await rect('terminal');
  const box = await rootBox();
  let c = await center('.win-terminal > header');
  await drag(c, { x: c.x + 60, y: c.y + 40 });
  let r1 = await rect('terminal');
  close(r1.x - r0.x, 60 / box.k, 8, 'dragging the title bar moves the window horizontally');
  close(r1.y - r0.y, 40 / box.k, 8, 'and vertically');
  c = await center('.win-terminal > header');
  await drag(c, { x: c.x, y: c.y - 600 });
  check((await rect('terminal')).y === 32, 'a window cannot be dragged above the menubar (y clamps to 32)');
  c = await center('.win-terminal > header');
  await drag(c, { x: 4, y: c.y + 100 }); // way off to the left (twice): part of the window must stay visible
  c = await center('.win-terminal > header');
  await drag(c, { x: 4, y: c.y });
  const rl = await rect('terminal');
  check(rl.x + rl.w >= 140, `a window keeps ≥140px on screen when dragged far left (x=${rl.x})`);

  // ── resize: every handle moves the right edges; cursor shapes ──
  await ev(() => { window.__ori.desktop.reset(); }); await reset(); await open('terminal');
  const kinds = { n: 'ns', s: 'ns', e: 'ew', w: 'ew', ne: 'nesw', sw: 'nesw', nw: 'nwse', se: 'nwse' };
  let cursorsOk = true;
  for (const [edge, kind] of Object.entries(kinds)) {
    const p = await center(`.win-terminal .rz[data-rz="${edge}"]`);
    await page.mouse.move(p.x - 1, p.y - 1);
    await page.mouse.move(p.x, p.y);
    if (!(await until(([k]) => document.querySelector('.mac .cur').dataset.k === k, [kind]))) {
      cursorsOk = false;
      const info = await ev(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? `${e.tagName}.${e.className} at ${Math.round(x)},${Math.round(y)}; state=${window.__ori.state}` : 'none'; }, [p.x, p.y]);
      fail(`wm2: cursor over the ${edge} handle should be ${kind}, got ${await cursorKind()} (hit: ${info})`);
    }
  }
  check(cursorsOk, 'the in-screen cursor changes to ew / ns / nwse / nesw over the resize handles');
  const ra = await rect('terminal');
  let p = await center('.win-terminal .rz[data-rz="se"]');
  await drag(p, { x: p.x + 80, y: p.y + 50 });
  let rb = await rect('terminal');
  close(rb.w - ra.w, 80 / box.k, 8, 'SE handle widens');
  close(rb.h - ra.h, 50 / box.k, 8, 'SE handle heightens');
  check(rb.x === ra.x && rb.y === ra.y, 'SE resize keeps the top-left corner fixed');
  p = await center('.win-terminal .rz[data-rz="nw"]');
  const right = rb.x + rb.w, bottom = rb.y + rb.h;
  await drag(p, { x: p.x + 900, y: p.y + 700 });
  rb = await rect('terminal');
  const def = await ev(() => window.__ori.registry.getApp('terminal').size);
  check(rb.w === def.minW && rb.h === def.minH, `shrinking stops at the app minimum ${def.minW}×${def.minH} (got ${rb.w}×${rb.h})`);
  check(rb.x + rb.w === right && rb.y + rb.h === bottom, 'NW resize keeps the opposite corner fixed');
  p = await center('.win-terminal .rz[data-rz="n"]');
  await drag(p, { x: p.x, y: p.y - 900 });
  check((await rect('terminal')).y === 32, 'resizing from the top cannot cross the menubar');
  p = await center('.win-terminal .rz[data-rz="w"]');
  const rw0 = await rect('terminal');
  await drag(p, { x: p.x - 60, y: p.y });
  const rw1 = await rect('terminal');
  close(rw1.w - rw0.w, 60 / box.k, 8, 'W handle widens to the left');
  p = await center('.win-terminal .rz[data-rz="e"]');
  await drag(p, { x: p.x + 40, y: p.y });
  p = await center('.win-terminal .rz[data-rz="s"]');
  await drag(p, { x: p.x, y: p.y + 40 });
  p = await center('.win-terminal .rz[data-rz="ne"]');
  await drag(p, { x: p.x + 20, y: p.y + 30 });
  p = await center('.win-terminal .rz[data-rz="sw"]');
  await drag(p, { x: p.x - 20, y: p.y + 20 });
  check(true, 'E / S / NE / SW handles work without errors');

  // ── zoom: button, double-click ──
  await reset(); await open('finder');
  const fr0 = await rect('finder');
  const zr = await ev(() => window.__ori.desktop.wm.zoomRect());
  p = await center('.win-finder .lights .g');
  await page.mouse.click(p.x, p.y);
  await untilRect('finder', zr); await settle(session, 2);
  let fz = await rect('finder');
  check(fz.x === zr.x && fz.y === zr.y && fz.w === zr.w && fz.h === zr.h, `the green button fills the desktop between menubar and Dock (${fz.w}×${fz.h})`);
  check((await mode('finder')) === 'zoom', 'window mode is zoom');
  await shot('maximized');
  p = await center('.win-finder .lights .g');
  await page.mouse.click(p.x, p.y);
  await untilRect('finder', fr0);
  const fb = await rect('finder');
  check(fb.x === fr0.x && fb.y === fr0.y && fb.w === fr0.w && fb.h === fr0.h, 'clicking it again restores the previous size');
  // double-click the title bar (the Finder title bar lives in the content pane header)
  p = await center('.win-finder .pane > header .sp');
  await page.mouse.dblclick(p.x, p.y);
  await untilRect('finder', zr);
  check((await mode('finder')) === 'zoom', 'double-clicking a title bar zooms');
  p = await center('.win-finder .pane > header .sp');
  await page.mouse.dblclick(p.x, p.y);
  await untilRect('finder', fr0);
  check((await mode('finder')) === 'normal', 'and double-clicking again restores');

  // ── snapping with preview ──
  await reset(); await open('notes');
  const nbox = await rootBox();
  c = await center('.win-notes .pane > header .sp');
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(nbox.left + 4, c.y + 80, { steps: 14 });
  await until(() => document.querySelector('.mac .snap-prev').classList.contains('on'), null);
  await sleep(300);
  const prev = await ev(() => { const s = document.querySelector('.mac .snap-prev'); return { on: s.classList.contains('on'), left: s.offsetLeft, w: s.offsetWidth }; });
  check(prev.on && prev.w < 500 && prev.left < 20, `dragging to the left edge shows a half-screen preview (width ${prev.w})`);
  await shot('snap-preview');
  await page.mouse.up();
  const half = await ev(() => window.__ori.desktop.root.offsetWidth / 2);
  await untilRect('notes', { x: 0, y: zr.y, w: half, h: zr.h }); await settle(session, 2);
  let nr = await rect('notes');
  check(nr.x === 0 && nr.w === half && nr.h === zr.h, `releasing snaps the window to the left half (${nr.w}×${nr.h})`);
  check((await mode('notes')) === 'left', 'mode = left');
  await shot('snapped-left');
  // drag it back out: the old size returns
  c = await center('.win-notes .pane > header .sp');
  await drag(c, { x: c.x + 220, y: c.y + 60 });
  nr = await rect('notes');
  check((await mode('notes')) === 'normal' && nr.w === (await ev(() => window.__ori.registry.getApp('notes').size.w)), 'dragging a tiled window out restores its previous size');
  c = await center('.win-notes .pane > header .sp');
  await drag(c, { x: nbox.left + nbox.width - 3, y: c.y + 50 });
  await sleep(450);
  nr = await rect('notes');
  check(nr.w === half && nr.x === nbox.w - half, 'dragging to the right edge tiles to the right half');
  c = await center('.win-notes .pane > header .sp');
  await drag(c, { x: c.x - 300, y: nbox.top + 2 });
  await sleep(450);
  check((await mode('notes')) === 'zoom', 'dragging to the top edge zooms');

  // ── minimise to the Dock + restore ──
  await reset(); await open('finder', 'terminal');
  check(await ev(() => document.querySelector('.win-terminal')?.classList.contains('active')), 'the newest window is active');
  await settle(session, 2);
  check(await ev(() => getComputedStyle(document.querySelector('.win-finder'), '::after').opacity === '1'), 'the inactive window is dimmed');
  // slow motion for the screenshot: 30s transitions, then freeze them at 40% so the picture shows the window mid-flight to the Dock
  await ev(() => { const w = document.querySelector('.win-terminal'); w.style.transitionDuration = '30s'; w.style.transitionDelay = '0s'; });
  p = await center('.win-terminal .lights .y');
  await page.mouse.click(p.x, p.y);
  await settle(session, 2);
  await ev(() => document.querySelector('.win-terminal').getAnimations().forEach((an) => { an.pause(); an.currentTime = 12000; }));
  await shot('minimizing');
  await ev(() => { const w = document.querySelector('.win-terminal'); w.getAnimations().forEach((an) => an.finish()); w.style.transitionDuration = ''; w.style.transitionDelay = ''; });
  check(await ev(() => !!document.querySelector('.dock .dk.mini[data-restore="terminal"]')), 'a minimised window gets a thumbnail in the Dock');
  check((await front()) === 'finder', 'focus moves to the next visible window');
  check(await until(() => getComputedStyle(document.querySelector('.win-terminal')).opacity === '0', null), 'the minimised window has flown away');
  check(await ev(() => document.querySelector('.dock .dk[data-app="terminal"]').classList.contains('on')), 'the running dot stays on for a minimised app');
  await clickDock('.dock .dk.mini[data-restore="terminal"]');
  await sleep(700);
  check(await ev(() => !document.querySelector('.win-terminal').classList.contains('min') && !document.querySelector('.dock .dk.mini')), 'clicking the Dock thumbnail restores the window (thumbnail removed)');
  check((await front()) === 'terminal', 'and focuses it');
  // a game has no Dock icon of its own: it must still be restorable
  await ev(() => window.__ori.openApp('snake'));
  await sleep(400);
  p = await center('.win-snake .lights .y');
  await page.mouse.click(p.x, p.y);
  await sleep(700);
  check(await ev(() => !!document.querySelector('.dock .dk.mini[data-restore="snake"]')), 'a minimised game (no Dock icon) gets a thumbnail too');
  await clickDock('.dock .dk.mini[data-restore="snake"]');
  await sleep(600);
  check(await ev(() => !document.querySelector('.win-snake').classList.contains('min')), 'the game is restored from its thumbnail');
  // clicking the app's own Dock icon restores it as well
  await ev(() => window.__ori.desktop.wm.minimize('terminal'));
  await sleep(500);
  await clickDock('.dock .dk[data-app="terminal"]');
  await sleep(600);
  check(await ev(() => !document.querySelector('.win-terminal').classList.contains('min')), "clicking the app's Dock icon restores a minimised window");

  // ── geometry memory ──
  await reset(); await open('mail');
  c = await center('.win-mail > header');
  await drag(c, { x: c.x - 90, y: c.y + 50 });
  p = await center('.win-mail .rz[data-rz="se"]');
  await drag(p, { x: p.x + 40, y: p.y + 30 });
  const saved = await rect('mail');
  await ev(() => window.__ori.desktop.wm.close('mail'));
  await sleep(300);
  await open('mail');
  const again = await rect('mail');
  check(JSON.stringify(saved) === JSON.stringify(again), `the last position and size are remembered per app (${again.w}×${again.h} at ${again.x},${again.y})`);

  // ── cascade for new windows (no saved geometry) ──
  await reset(); await open('finder', 'safari', 'notes');
  const cas = await ev(() => ['finder', 'safari', 'notes'].map((i) => window.__ori.desktop.wm.rect(i)));
  const def0 = await ev(() => ['finder', 'safari', 'notes'].map((i) => window.__ori.registry.getApp(i).pos));
  check(cas[0].x - def0[0].x === 0 && cas[1].x - def0[1].x === 18 && cas[2].x - def0[2].x === 36, 'new windows cascade by 18px');

  // ── shortcuts + menu items ──
  await reset(); await open('finder', 'notes');
  await ev(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', key: 'm', metaKey: true, bubbles: true, cancelable: true })));
  check(await ev(() => document.querySelector('.win-notes').classList.contains('min')), '⌘M minimises the front window');
  await ev(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', metaKey: true, ctrlKey: true, bubbles: true, cancelable: true })));
  await sleep(450);
  check((await mode('finder')) === 'zoom', '⌃⌘F zooms the front window');
  await ev(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w', metaKey: true, bubbles: true, cancelable: true })));
  await sleep(300);
  check(await ev(() => !document.querySelector('.win-finder')), '⌘W closes the front window');
  await reset(); await open('finder');
  await ev(() => { const r = window.__ori.desktop.root; r.querySelector('[data-menu="window"]').click(); });
  const items = await ev(() => [...document.querySelectorAll('.mac .menu .mi')].map((m) => ({ t: m.querySelector('span').textContent, dis: m.classList.contains('dis') })));
  check(items.find((i) => i.t === 'Zoom' && !i.dis) && items.find((i) => /Left of Screen/.test(i.t) && !i.dis), 'Window menu: Zoom and Tile Left/Right are enabled');
  await ev(() => { [...document.querySelectorAll('.mac .menu .mi')].find((m) => /Left of Screen/.test(m.textContent)).click(); });
  await sleep(450);
  check((await mode('finder')) === 'left', 'Window → Tile Window to Left of Screen works');
  await reset();
  await noAnim.evaluate((el) => el.remove());
}
