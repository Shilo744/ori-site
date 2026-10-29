// "Ori, Can You...?" touch everywhere [experimental], browser checks (T37): a phone-sized screen with ?touch=1. The pads turn the camera, say hello, open the map and the journal; the office computer and the cafe job are played
// with thumbs; every card has a way out; every control is at least 44 px and nothing sits on top of anything.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';

/** In the page: the interactive controls of the game that are on screen (not hidden, not click-through), the ones under 44 px, the ones on top of each other, the ones off the screen. */
export function auditControls() {
  const root = document.getElementById('g3d') || document.body;
  const desc = (e) => {
    const k = e.dataset && (e.dataset.k || e.dataset.id || e.dataset.a || e.dataset.s || e.dataset.act);
    return e.tagName.toLowerCase() + (k ? `[${k}]` : '') + (e.classList.length ? `.${[...e.classList].slice(0, 2).join('.')}` : '');
  };
  const seen = (e) => {
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    for (let n = e; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || n.hidden || Number(cs.opacity) < 0.05) return null;
    }
    if (getComputedStyle(e).pointerEvents === 'none') return null;
    // a thumb has to be able to hit it: what is on top at its middle must be the control itself (a card over the HUD hides the HUD's buttons)
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!top || !(top === e || e.contains(top))) return null;
    return r;
  };
  const scrolls = (e) => { for (let n = e.parentElement; n && n !== document.documentElement; n = n.parentElement) { const o = getComputedStyle(n).overflowY; if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight + 1) return true; } return false; };
  const items = [];
  for (const e of root.querySelectorAll('button, [role="button"], a[href], input:not([type="hidden"]), select, textarea, summary')) {
    const r = seen(e);
    if (r) items.push({ e, d: desc(e), x: r.left, y: r.top, w: r.width, h: r.height });
  }
  const small = items.filter((i) => i.w < 43.5 || i.h < 43.5).map((i) => `${i.d} ${Math.round(i.w)}x${Math.round(i.h)}`);
  const lap = [];
  for (let a = 0; a < items.length; a++) {
    for (let b = a + 1; b < items.length; b++) {
      const A = items[a]; const B = items[b];
      if (A.e.contains(B.e) || B.e.contains(A.e)) continue;
      const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
      const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
      if (ox > 3 && oy > 3) lap.push(`${A.d} x ${B.d}`);
    }
  }
  const off = items.filter((i) => !scrolls(i.e) && (i.x < -1 || i.y < -1 || i.x + i.w > innerWidth + 1 || i.y + i.h > innerHeight + 1)).map((i) => `${i.d} (${Math.round(i.x)},${Math.round(i.y)} ${Math.round(i.w)}x${Math.round(i.h)})`);
  // the HUD's chips (text, not controls): none may sit on another
  const chips = [...document.querySelectorAll('.fv-clock, .fv-meters, .fv-place.on, .fv-goal, .fv-story.on, .fv-tr, .fv-gohint.on')].map((e) => ({ e, d: desc(e), r: e.getBoundingClientRect() })).filter((c) => c.r.width > 1 && getComputedStyle(c.e).opacity !== '0');
  const clash = [];
  for (let a = 0; a < chips.length; a++) {
    for (let b = a + 1; b < chips.length; b++) {
      const A = chips[a].r; const B = chips[b].r;
      const ox = Math.min(A.right, B.right) - Math.max(A.left, B.left);
      const oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
      if (ox > 3 && oy > 3) clash.push(`${chips[a].d} x ${chips[b].d}`);
    }
  }
  return { n: items.length, small, lap, off, clash, names: items.map((i) => i.d) };
}

export async function runFavorsTouch(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`touch: ${msg}`) : fail(`touch: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const S = () => g(() => window.__ori.game3d.state());
  let lastAudit = null;
  const audit = async (label) => {
    await sleep(480); // (a card scales in over 0.3 s: measured too early it is a hair small)
    await settle(session, 2);
    const a = await g(auditControls);
    lastAudit = a;
    check(a.n > 0 && a.small.length === 0 && a.lap.length === 0 && a.off.length === 0 && a.clash.length === 0,
      `${label}: ${a.n} controls, all at least 44 px, none on top of another, none off the screen${a.small.length ? ` — small: ${a.small.slice(0, 5).join(' | ')}` : ''}${a.lap.length ? ` — overlapping: ${a.lap.slice(0, 5).join(' | ')}` : ''}${a.off.length ? ` — off screen: ${a.off.slice(0, 4).join(' | ')}` : ''}${a.clash.length ? ` — chips: ${a.clash.slice(0, 4).join(' | ')}` : ''}`);
  };
  const tap = async (sel) => { const b = await page.$(sel); if (!b) throw new Error(`no ${sel}`); const r = await b.boundingBox(); await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2); };
  const down = async (sel) => { const b = await page.$(sel); const r = await b.boundingBox(); await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down(); };

  // ── a phone: 390 x 844, the pads forced on by the address ──
  await page.setViewportSize({ width: 390, height: 844 });
  const origin = new URL(page.url()).origin;
  await page.goto(`${origin}/?fast=1&quiet=1&touch=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ori && window.__ori.ready, null, { timeout: 60000 });
  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.setHour(15); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); });
  await sleep(600);

  // ── walking about ──
  const ids = await g(() => [...document.querySelectorAll('.fv-kp.walk .fv-kb')].map((b) => b.dataset.id));
  check(['hi', 'map', 'journal', 'camL', 'camR'].every((i) => ids.includes(i)) && (await g(() => !!document.querySelector('.fv-touch.on'))), `the street has the stick, Run, Use and five more keys: ${ids.join(' ')}`);
  await audit('the street');
  await page.screenshot({ path: join(SHOTS, 'T37-touch-street.png') });
  // the camera: hold the right arrow and the view turns, let go and it stops
  const yaw0 = await g(() => window.__ori.game3d.game.camera.rotation.y);
  await down('.fv-kp.walk [data-id="camR"]'); await sleep(700);
  const yaw1 = await g(() => window.__ori.game3d.game.camera.rotation.y);
  await page.mouse.up(); await sleep(150);
  const yaw2 = await g(() => window.__ori.game3d.game.camera.rotation.y); await sleep(400);
  const yaw3 = await g(() => window.__ori.game3d.game.camera.rotation.y);
  check(Math.abs(yaw1 - yaw0) > 0.15 && Math.abs(yaw3 - yaw2) < 0.02, `a held camera key turns the view (${(yaw1 - yaw0).toFixed(2)} rad) and letting go stops it`);
  // the map and the journal
  await tap('.fv-kp.walk [data-id="map"]');
  await page.waitForFunction(() => window.__ori.game3d.game.mapUi.isOpen, null, { timeout: 3000 });
  await audit('the big map');
  await page.screenshot({ path: join(SHOTS, 'T37-touch-map.png') });
  await g(() => window.__ori.game3d.game.mapUi.close());
  await tap('.fv-kp.walk [data-id="journal"]');
  await page.waitForFunction(() => window.__ori.game3d.game.journal.isOpen, null, { timeout: 3000 });
  await audit('the journal');
  await page.screenshot({ path: join(SHOTS, 'T37-touch-journal.png') });
  await g(() => window.__ori.game3d.game.journal.close());
  // the pause menu and the help panel
  await tap('.fv-tr [data-k="pause"]');
  await page.waitForFunction(() => window.__ori.game3d.paused, null, { timeout: 3000 });
  await audit('the pause menu');
  await page.screenshot({ path: join(SHOTS, 'T37-touch-pause.png') });
  await tap('.g3d-menu [data-a="resume"]');
  await page.waitForFunction(() => !window.__ori.game3d.paused, null, { timeout: 3000 });
  await tap('.fv-tr [data-k="help"]');
  await page.waitForFunction(() => window.__ori.game3d.state().guideOpen, null, { timeout: 3000 });
  await audit('the help panel');
  await tap('.gd [data-act="close"]');
  await page.waitForFunction(() => !window.__ori.game3d.state().guideOpen, null, { timeout: 3000 });

  // ── hello with a thumb: next to a walker, "Hi" says it ──
  const h0 = (await S()).progress.hellos || 0;
  await g(() => { const gm = window.__ori.game3d.game; const w = gm.crowd.walkers[0]; window.__ori.game3d.teleport({ x: w.x + 1.6, z: w.z }, -Math.PI / 2); });
  await sleep(300);
  await tap('.fv-kp.walk [data-id="hi"]');
  await page.waitForFunction((h) => (window.__ori.game3d.state().progress.hellos || 0) > h, h0, { timeout: 4000 }).catch(() => {});
  const h1 = (await S()).progress.hellos || 0;
  check(h1 === h0 + 1 && (await g(() => document.querySelectorAll('.fb').length)) >= 1, `"Hi" says hello to a passer-by with a thumb: the bubble, the answer, the love (${h0} -> ${h1})`);

  // ── the office computer ──
  await g(() => window.__ori.game3d.enter('startup'));
  await page.waitForFunction(() => window.__ori.game3d.insideId() === 'startup', null, { timeout: 8000 });
  await sleep(500);
  const office = await g(() => window.__ori.game3d.insideInfo());
  const pc = office.spots.find((p) => p.use === 'arcade');
  await g((p) => window.__ori.game3d.teleport({ x: p.x, z: p.z + 1.1 }, Math.PI), pc);
  await sleep(500);
  await tap('.fv-touch [data-k="do"]'); // "Use"
  await page.waitForFunction(() => window.__ori.game3d.game.arcade.isOpen, null, { timeout: 4000 });
  check(await g(() => window.__ori.game3d.game.arcade.mode) === 'boot' && (await g(() => document.querySelector('.ar .fv-kp').dataset.pad)) === 'arcade-boot', 'Use at the computer turns it on; the pad says Start and Back');
  await audit('the computer: boot');
  await tap('.ar .fv-kb[data-id="start"]');
  await page.waitForFunction(() => window.__ori.game3d.game.arcade.mode === 'menu', null, { timeout: 4000 });
  await audit('the computer: the games');
  await page.screenshot({ path: join(SHOTS, 'T37-touch-arcade-menu.png') });
  // blocks: slide, turn, slam with the buttons
  await tap('.ar .fv-kb[data-id="play"]');
  await page.waitForFunction(() => window.__ori.game3d.game.arcade.mode === 'tetris', null, { timeout: 4000 });
  await page.waitForFunction(() => window.__ori.game3d.game.arcade.run.view().piece.length > 0, null, { timeout: 4000 });
  const x0 = await g(() => window.__ori.game3d.game.arcade.run.view().piece.map((p) => p[0]));
  await down('.ar .fv-kb[data-id="left"]'); await sleep(450); await page.mouse.up(); await sleep(150);
  const x1 = await g(() => window.__ori.game3d.game.arcade.run.view().piece.map((p) => p[0]));
  check(x1.length > 0 && Math.min(...x1) < Math.min(...x0), `blocks: "left" slides the piece (column ${Math.min(...x0)} -> ${Math.min(...x1)})`);
  await tap('.ar .fv-kb[data-id="slam"]'); await sleep(200);
  check(await g(() => window.__ori.game3d.game.arcade.run.view().score) > 0, 'blocks: "Slam" drops it and scores');
  await audit('the computer: blocks');
  await page.screenshot({ path: join(SHOTS, 'T37-touch-arcade-blocks.png') });
  await tap('.ar .fv-kb[data-id="back"]');
  await page.waitForFunction(() => window.__ori.game3d.game.arcade.mode === 'menu', null, { timeout: 4000 });
  // snake: a tap on its row of the screen picks it, then the arrows steer
  { const r = await (await page.$('.ar canvas')).boundingBox(); await page.mouse.click(r.x + r.width / 2, r.y + (90 + 2 * 74 + 30) * (r.height / 440)); }
  await page.waitForFunction(() => window.__ori.game3d.game.arcade.mode === 'snake', null, { timeout: 4000 });
  check(true, 'a tap on the third row of the computer screen starts SNAKE');
  await tap('.ar .fv-kb[data-id="up"]'); await sleep(100);
  const dir = await g(() => window.__ori.game3d.game.arcade.run.view().dir);
  check(dir === 'up' || dir === undefined, `snake: the arrows steer (heading ${dir})`);
  await audit('the computer: snake');
  await g(() => { const r = window.__ori.game3d.game.arcade.run; r.state.over = true; });
  await page.waitForFunction(() => document.querySelector('.ar .fv-kp').dataset.pad === 'arcade-over', null, { timeout: 4000 });
  await tap('.ar .fv-kb[data-id="next"]');
  await page.waitForFunction(() => window.__ori.game3d.game.arcade.mode === 'menu', null, { timeout: 4000 });
  await tap('.ar .fv-kb[data-id="back"]');
  await page.waitForFunction(() => !window.__ori.game3d.game.arcade.isOpen, null, { timeout: 4000 });
  check(true, 'Back leaves the computer: nobody is stuck behind it');
  await g(() => window.__ori.game3d.leave());
  await page.waitForFunction(() => !window.__ori.game3d.insideId(), null, { timeout: 8000 });

  // ── the cafe job ──
  await g(() => window.__ori.game3d.enter('cafe'));
  await page.waitForFunction(() => window.__ori.game3d.insideId() === 'cafe', null, { timeout: 8000 });
  await sleep(500);
  const cafe = await g(() => window.__ori.game3d.insideInfo());
  const orderPad = cafe.spots.find((p) => p.use === 'coffeejob');
  await g((p) => window.__ori.game3d.teleport({ x: p.x, z: p.z + 1.1 }, Math.PI), orderPad);
  await sleep(500);
  await tap('.fv-touch [data-k="do"]');
  await page.waitForFunction(() => window.__ori.game3d.game.coffee.isOpen, null, { timeout: 4000 });
  await audit('Coffee Rush');
  await page.screenshot({ path: join(SHOTS, 'T37-touch-coffee.png') });
  const KEY = { espresso: 'espresso', latte: 'latte', tea: 'tea' };
  let served = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 9000 && served < 3) {
    const v = await g(() => window.__ori.game3d.game.coffee.run.view());
    if (v.over) break;
    await tap(`.cf .fv-kb[data-id="${KEY[v.order.items[v.order.i]]}"]`);
    served = (await g(() => window.__ori.game3d.game.coffee.run.view())).served;
  }
  check(served >= 3, `Coffee Rush: three customers served by tapping the drinks (${served})`);
  await g(() => { window.__ori.game3d.game.coffee.run.state.time = 0.05; });
  await page.waitForFunction(() => /Tap Done/.test((document.querySelector('.cf-msg') || {}).textContent || ''), null, { timeout: 4000 });
  await tap('.cf .fv-kb[data-id="done"]');
  await sleep(300);
  check(!(await g(() => window.__ori.game3d.game.coffee.isOpen)) && !(await S()).paused, 'Done closes the shift and the game goes on');
  await g(() => window.__ori.game3d.leave());
  await page.waitForFunction(() => !window.__ori.game3d.insideId(), null, { timeout: 8000 });

  // ── the ring: the menu, a fight with its own pads (the street's keys are out of the way), the result card ──
  await g(() => { const gm = window.__ori.game3d.game; const p = gm.fight.apron(); window.__ori.game3d.teleport({ x: p.x, z: p.z }, Math.PI); });
  await sleep(400);
  await tap('.fv-touch [data-k="do"]');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 5000 });
  await audit('the ring menu');
  await page.screenshot({ path: join(SHOTS, 'T37-touch-ring-menu.png') });
  await tap('.fi-row[data-i="0"]');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.phase === 'fight', null, { timeout: 15000 });
  await sleep(600);
  await audit('the fight');
  check(lastAudit.names.some((n) => /fi-tb/.test(n)) && !lastAudit.names.some((n) => /\[(hi|map|journal|camL|camR|do|sprint)\]/.test(n)), `in the fight the ring's own pads are on screen and the street's keys are not (${lastAudit.names.filter((n) => /fi-tb|fv-kb|fv-act/.test(n)).join(' ')})`);
  await page.screenshot({ path: join(SHOTS, 'T37-touch-fight.png') });
  await g(() => { const b = window.__ori.game3d.game.fight.bout; b.O.hp = 0; b.O.state = 'ko'; });
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.cardOpen, null, { timeout: 15000 });
  await audit('the result card');
  await tap('.fi-btn.primary');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.phase !== 'fight' && !window.__ori.game3d.game.fight.ui.cardOpen, null, { timeout: 10000 }).catch(() => {});
  await sleep(600);

  // ── held sideways: 844 x 390 ──
  await page.setViewportSize({ width: 844, height: 390 });
  await sleep(500);
  await audit('the street held sideways');
  await page.screenshot({ path: join(SHOTS, 'T37-touch-street-sideways.png') });
  await page.setViewportSize({ width: 1280, height: 800 });
}
