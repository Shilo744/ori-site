// Room interactions (T14): real mouse hover → outline + tag + pointer cursor, real clicks → each object's reaction,
// the discovery counter + achievements, no interference in the screen state / flat mode, MacBook still opens.
import { join } from 'node:path';
import { SHOTS, sleep, settle, snap } from './harness.mjs';

const THINGS = [
  // id, camera preset that frames it, expected hover-tag text (regex source), expected tag after the click (regex source)
  { id: 'lamp', view: 'shaft', tag: '^Floor lamp · click to turn o', after: '^Floor lamp · o' },
  { id: 'cat', view: 'shaft', tag: '^Cat · click to pet', after: '^Purrr' },
  { id: 'window', view: 'shaft', tag: '^Window · click to change the time of day', after: '^Window · ' },
  { id: 'vacuum', view: 'floor', tag: '^Robot vacuum', after: '^Beep boop' },
  { id: 'mug', view: 'mug', tag: '^Coffee', after: '^Still warm' },
  { id: 'homepod', view: 'homepod', tag: '^HomePod · click to play', after: '^HomePod · (playing|sound is off)' },
  { id: 'iphone', view: 'desk', tag: '^iPhone', after: '^iPhone · ' },
  { id: 'ipad', view: 'desk', tag: '^iPad', after: '^iPad · ' },
  { id: 'art', view: 'art', tag: '^Wall art', after: '^Wall art · ' },
  { id: 'clock', view: 'clock', tag: '^Wall clock · \\d\\d:\\d\\d:\\d\\d', after: "^It's \\d\\d:\\d\\d · " },
  { id: 'plant', view: 'plant', tag: '^Fiddle-leaf fig', after: '^Rustle' },
];

export async function runInteract(session, { ok, fail }) {
  const { page } = session;
  const tag = `${session.width}x${session.height}`;
  const check = (cond, msg) => (cond ? ok(`interact: ${msg}`) : fail(`interact: ${msg}`));
  const flat = session.width < 860;
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const until = (fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout }).then(() => true).catch(() => false);
  const shot = (name) => snap(session, join(SHOTS, 'smoke', `${tag}-interact-${name}.png`));

  if (flat) {
    check(await ev(() => window.__ori.interactions.hoverId === null && getComputedStyle(document.getElementById('hud-found')).display === 'none'), 'flat mode: no room interactions, the discovery tag is hidden');
    return;
  }

  // start from a clean slate, in the room
  await ev(() => { window.__ori.core.storage.remove('room:found'); window.__ori.core.wallpaper.set('sunrise'); window.__ori.core.achievements.reset(); window.__ori.interactions.reset(); window.__ori.daylight.setMode('day', { instant: true }); });
  if ((await ev(() => window.__ori.state)) !== 'overview') {
    await ev(() => window.__ori.exitScreen());
    await until(() => window.__ori.state === 'overview', null, 60000);
  }
  await ev(() => window.__ori.setTime(13));
  const ids = await ev(() => window.__ori.interactions.ids());
  check(THINGS.every((t) => ids.includes(t.id)) && ids.includes('mac'), `all ${THINGS.length} things + the MacBook are registered (${ids.join(', ')})`);
  check((await ev(() => document.getElementById('hud-found').textContent)) === `Discovered 0/${THINGS.length}`, 'the HUD shows "Discovered 0/11"');

  const move = async (p) => { await page.mouse.move(p.x - 3, p.y - 3); await page.mouse.move(p.x, p.y, { steps: 2 }); };
  let outlinesOk = true, tagsOk = true, clicksOk = true;
  for (const th of THINGS) {
    await ev((v) => window.__ori.setView(v), th.view);
    await settle(session, 2);
    const p = await ev((id) => window.__ori.interactions.screenPos(id), th.id);
    if (!p || !p.visible || p.x < 0 || p.y < 0 || p.x > session.width || p.y > session.height) { fail(`interact: ${th.id} is not on screen in the "${th.view}" view (${JSON.stringify(p)})`); continue; }
    await move(p);
    const hovered = await until((id) => window.__ori.interactions.hoverId === id, th.id);
    if (!hovered) { fail(`interact: hovering ${th.id} at ${Math.round(p.x)},${Math.round(p.y)} did not pick it (picked ${await ev(() => window.__ori.interactions.hoverId)})`); continue; }
    const text = await ev(() => window.__ori.interactions.tagText);
    if (!new RegExp(th.tag).test(text)) { tagsOk = false; fail(`interact: ${th.id} hover tag was "${text}", expected /${th.tag}/`); }
    const hulls = await ev(() => window.__ori.interactions.visibleHulls());
    if (th.id !== 'plant' && hulls < 1) { outlinesOk = false; fail(`interact: ${th.id} shows no hover outline`); }
    const cursor = await ev(() => window.__ori.renderer.domElement.style.cursor);
    if (cursor !== 'pointer') { outlinesOk = false; fail(`interact: ${th.id} hover cursor is "${cursor}"`); }
    if (th.id === 'lamp' || th.id === 'cat') await shot(`hover-${th.id}`);
    await page.mouse.click(p.x, p.y);
    const clicked = await until(([rx]) => new RegExp(rx).test(window.__ori.interactions.tagText), th.after, 30000);
    if (!clicked) { clicksOk = false; fail(`interact: clicking ${th.id}: tag "${await ev(() => window.__ori.interactions.tagText)}" does not match /${th.after}/`); }
  }
  check(tagsOk && outlinesOk, 'hovering every thing shows its tag, an outline (plant: sway) and the pointer cursor');
  check(clicksOk, 'clicking every thing runs its reaction and shows its message');

  // ── side effects ──
  const fx = await ev(() => {
    const o = window.__ori;
    return {
      lampOverride: o.daylight.lamp.on, mode: o.daylight.mode, art: o.core.wallpaper.id,
      cat: o.core.achievements.list().find((a) => a.id === 'cat-person').progress,
      mood: o.core.achievements.list().find((a) => a.id === 'mood-lighting').progress,
      found: o.interactions.found().length, sway: o.life.debug().swayAmp, hp: o.life.homepod.active,
    };
  });
  check(fx.lampOverride || fx.mood >= 1, 'floor lamp: the click toggled the real light (counter ' + fx.mood + ')');
  check(fx.mode !== 'day', `window: the click changed the time-of-day mode (now "${fx.mode}")`);
  check(fx.art && fx.art !== 'sunrise' && (await ev(() => window.__ori.core.storage.get('wallpaper'))) === fx.art, `wall art: it cycled the shared wallpaper and it was remembered ("${fx.art}")`);
  check(fx.cat === 1, 'cat: one pet counted for the "Cat person" achievement');
  check(fx.found === THINGS.length, `discovery: ${fx.found}/${THINGS.length} found`);
  check((await ev(() => document.getElementById('hud-found').textContent)) === `Discovered ${THINGS.length}/${THINGS.length}`, 'the HUD tag reads "Discovered 11/11"');
  const ach = await ev(() => window.__ori.core.achievements.list().filter((a) => a.unlocked).map((a) => a.id));
  check(ach.includes('curious') && ach.includes('room-explorer'), `achievements: Curious + Room explorer unlocked (${ach.join(', ')})`);
  check((await ev(() => window.__ori.core.storage.get('room:found', []).length)) === THINGS.length, 'discoveries are persisted');
  await shot('all-found');

  // ── touch: a tap runs the action and shows the tag as a short message (there is no hover on a touchscreen) ──
  await ev((v) => window.__ori.setView(v), 'mug');
  const hudBtn0 = await page.locator('#btn-sound').boundingBox();
  await page.mouse.move(hudBtn0.x + hudBtn0.width / 2, hudBtn0.y + hudBtn0.height / 2); // real mouse off the room: nothing hovered
  await until(() => window.__ori.interactions.hoverId === null, null);
  await settle(session, 2);
  const tp = await ev(() => window.__ori.interactions.screenPos('mug'));
  const tapHover = await ev(({ x, y }) => {
    const c = window.__ori.renderer.domElement;
    const o = { clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true };
    c.dispatchEvent(new PointerEvent('pointermove', o));
    c.dispatchEvent(new PointerEvent('pointerdown', o));
    c.dispatchEvent(new PointerEvent('pointerup', o));
    c.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true }));
    return window.__ori.interactions.hoverId;
  }, tp);
  check(tapHover === null && (await until(() => /^Still warm/.test(window.__ori.interactions.tagText), null)), 'touch: a tap on the mug shows its message and leaves no hover outline behind');

  // leaving the hover clears outline + tag
  await ev((v) => window.__ori.setView(v), 'desk');
  const hudBtn = await page.locator('#btn-sound').boundingBox(); // a DOM element above the canvas: nothing in the room can be under it
  await page.mouse.move(hudBtn.x + hudBtn.width / 2, hudBtn.y + hudBtn.height / 2);
  const cleared = await until(() => window.__ori.interactions.hoverId === null && window.__ori.interactions.visibleHulls() === 0 && window.__ori.interactions.tagText === '', null);
  check(cleared, 'moving away clears the outline and the tag' + (cleared ? '' : ` (hover=${await ev(() => window.__ori.interactions.hoverId)}, hulls=${await ev(() => window.__ori.interactions.visibleHulls())}, tag="${await ev(() => window.__ori.interactions.tagText)}")`));

  // ── the MacBook keeps its click-to-enter; the keyboard base is clickable too ──
  const mp = await ev((id) => window.__ori.interactions.screenPos(id), 'mac');
  await move(mp);
  check((await until(() => /^MacBook · click to open/.test(window.__ori.interactions.tagText), null)) || (await ev(() => window.__ori.interactions.hoverId)) === 'mac-screen', 'hovering the MacBook shows its tag');
  await page.mouse.click(mp.x, mp.y);
  check(await until(() => window.__ori.state === 'entering' || window.__ori.state === 'screen', null, 60000), 'clicking the MacBook still enters the screen');
  await until(() => window.__ori.state === 'screen', null, 90000);
  await settle(session, 2);
  // ── on the screen the room is inert ──
  await page.mouse.move(session.width / 2 + 40, session.height / 2 + 40);
  await sleep(400);
  check((await ev(() => window.__ori.interactions.hoverId === null && window.__ori.interactions.tagText === '')), 'screen state: no hover, no tag');
  await ev(() => window.__ori.exitScreen());
  await until(() => window.__ori.state === 'overview', null, 60000);
  await ev(() => { window.__ori.setView('free'); window.__ori.core.achievements.reset(); window.__ori.core.storage.remove('room:found'); window.__ori.core.wallpaper.set('sunrise'); window.__ori.interactions.reset(); window.__ori.daylight.setMode('auto', { instant: true }); });
}
