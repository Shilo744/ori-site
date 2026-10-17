// "Ori, Can You...?" browser checks (T52): the phone buzzes with a banner, Tab opens it (and the day slows down), the Tasks list sorts and
// answers, the Map follows a pin, Messages and Focus work, Space at the door does the favour, the meters move, the day ends with a report.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';
import { scanCursors } from './cursor-test.mjs';

export async function runFavorsPhone(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`phone: ${msg}`) : fail(`phone: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const flat = session.width < 860;
  const shot = async (name) => { await settle(session, 2); await page.screenshot({ path: join(SHOTS, flat ? name.replace('.png', '-phone.png') : name) }); };
  const Q = () => g(() => { const q = window.__ori.game3d.game.quests; return { min: q.state.min, open: q.open().map((t) => ({ uid: t.uid, id: t.tplId, state: t.state, deadline: t.deadline, later: t.later, pri: t.pri })), score: q.state.score, chaos: q.state.chaos, done: q.state.stats.done, failed: q.state.stats.failed, arrived: q.state.stats.arrived, focus: q.state.focus.on }; });
  const S = () => g(() => window.__ori.game3d.state());

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 40000 });
  await g(() => window.__ori.game3d.teleport({ x: -62, z: 5 }, Math.PI / 2));
  check((await Q()).arrived === 0 && (await g(() => document.querySelector('.fv-phonebtn [data-k="badge"]').hidden)), 'at 06:00 nothing has been asked yet (no badge)');

  // ── the first task: banner, buzz, shake, badge, the beam ──
  await g(() => window.__ori.game3d.setHour(6.4));
  const first = await Q();
  check(first.arrived === 1 && first.open[0].id === 'mum-remote' && first.open[0].pri === 3, 'the tutorial task is Mum\'s URGENT remote');
  const ban = await g(() => ({ n: document.querySelectorAll('.fv-note').length, text: document.querySelector('.fv-note') && document.querySelector('.fv-note').textContent, urgent: document.querySelector('.fv-note.urgent') !== null, shake: document.querySelector('.fv-hud').classList.contains('shake'), badge: document.querySelector('.fv-phonebtn [data-k="badge"]').textContent, hot: document.querySelector('.fv-phonebtn').classList.contains('hot') }));
  check(ban.n === 1 && /Mum/.test(ban.text) && /URGENT/.test(ban.text) && ban.urgent, `a lock-screen banner slides in: "${ban.text}"`);
  check(ban.shake && ban.badge === '1' && ban.hot, `urgent: the screen shakes a little, the badge counts, the phone button pulses (${JSON.stringify({ shake: ban.shake, badge: ban.badge, hot: ban.hot })})`);
  const goal = await g(() => ({ chip: document.querySelector('.fv-goal.on') && document.querySelector('.fv-goal').textContent, beam: window.__ori.game3d.game.scene.getObjectByName('beam').visible, following: window.__ori.game3d.state().quests.following }));
  check(!!goal.chip && /URGENT/.test(goal.chip) && goal.beam && goal.following === first.open[0].uid, `the task is followed: chip "${goal.chip}", the beam stands over the place`);
  await shot('T52-lockscreen.png');

  // ── Tab opens the phone and slows the day ──
  await g(() => window.__ori.game3d.teleport({ x: -62, z: 5 }, Math.PI / 2));
  await sleep(300);
  const h0 = (await g(() => window.__ori.game3d.clock())).hour;
  await sleep(1000);
  const h1 = (await g(() => window.__ori.game3d.clock())).hour;
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.__ori.game3d.state().quests.phoneOpen, null, { timeout: 3000 });
  check(await g(() => !document.querySelector('.fv-phone').hidden), 'Tab opens the phone');
  const h2 = (await g(() => window.__ori.game3d.clock())).hour;
  await sleep(1000);
  const h3 = (await g(() => window.__ori.game3d.clock())).hour;
  check((h3 - h2) < (h1 - h0) * 0.4 && h3 > h2, `with the phone open the day crawls (${((h3 - h2) * 60).toFixed(2)} vs ${((h1 - h0) * 60).toFixed(2)} game minutes per second)`);
  if (flat) { const r = await g(() => { const b = document.querySelector('.fv-phone').getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: innerWidth, h: innerHeight }; }); check(r.l >= -1 && r.r <= r.w + 1 && r.b <= r.h + 1 && r.t > 0, 'on a phone the phone is a bottom sheet inside the screen'); }

  // ── Tasks: sorted rows, details, the three replies ──
  await g(() => window.__ori.game3d.setHour(12));
  await sleep(500);
  const rows = await g(() => [...document.querySelectorAll('.fv-task')].map((r) => ({ uid: +r.dataset.uid, title: r.querySelector('b').textContent, left: r.querySelector('.fv-left').textContent, pri: r.querySelector('.fv-pri').textContent })));
  const open = await Q();
  check(rows.length === open.open.length && rows.length >= 2, `the Tasks list shows every open task (${rows.length})`);
  const order = await g(() => window.__ori.game3d.game.quests.list('home').map((t) => t.uid));
  check(JSON.stringify(rows.map((r) => r.uid)) === JSON.stringify(order), 'sorted by deadline, soonest first');
  check(rows.every((r) => /^!{1,3}$/.test(r.pri) && r.left.length > 0), 'each row has its priority marks and the time left');
  await page.click('.fv-task .fv-row');
  const det = await g(() => ({ chips: [...document.querySelectorAll('.fv-task.sel .fv-chip')].map((c) => c.textContent), body: document.querySelector('.fv-task.sel .fv-detail p').textContent }));
  check(det.chips.length >= 3 && det.body.length > 10, `a row opens its details with the replies (${det.chips.join(' | ')})`);
  const uid = rows[0].uid;
  const d0 = (await Q()).open.find((t) => t.uid === uid).deadline;
  await page.click('.fv-task.sel [data-act="later"]');
  const later = (await Q()).open.find((t) => t.uid === uid);
  check(later && later.deadline === d0 + 30 && later.later, '"Give me a bit?" adds 30 minutes (once)');
  check((await S()).quests.following === uid, 'the most urgent task is followed by itself (the beam)');
  const other = await g(() => Number(document.querySelectorAll('.fv-task')[1].dataset.uid));
  await page.click('.fv-task:nth-child(2) .fv-row');
  await page.click('.fv-task.sel [data-act="pin"]');
  check((await S()).quests.following === other, '"Follow" on another task moves the beam there');
  await page.click('.fv-task.sel [data-act="pin"]');
  check((await S()).quests.following === null, 'and pressing it again lets go');
  await page.click('.fv-task .fv-row');
  await shot('T52-tasks.png');
  const before = (await Q()).open.length;
  await page.click('.fv-task.sel [data-act="no"]');
  check((await Q()).open.length === before - 1, '"No" declines it (the row goes)');

  // ── Map ──
  await page.click('[data-tab="map"]');
  await sleep(500);
  const mp = await g(() => { const c = document.querySelector('.fv-pane[data-pane="map"] canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let colored = 0; let blue = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 200) colored++; if (d[i + 2] > 200 && d[i] < 40 && d[i + 1] > 100 && d[i + 1] < 160) blue++; } return { w: c.width, h: c.height, colored, blue }; });
  check(mp.colored > mp.w * mp.h * 0.9 && mp.blue > 10, 'the map is drawn: streets, places, pins and the blue arrow that is Ori');
  await g(() => window.__ori.game3d.game.phone.setActive(null));
  const pin = await g(() => { const gm = window.__ori.game3d.game; const t = gm.quests.list('home')[0]; if (!t) return null; const c = document.querySelector('.fv-pane[data-pane="map"] canvas'); const r = c.getBoundingClientRect(); const [cx, cz] = gm.phone.pinPoint(t.at); return { uid: t.uid, x: r.left + (cx / c.width) * r.width, y: r.top + (cz / c.height) * r.height }; });
  if (pin) {
    await page.mouse.click(pin.x, pin.y);
    check((await S()).quests.following === pin.uid, 'tapping a pin on the map follows that task');
    await shot('T52-map.png');
  }
  await page.click('[data-tab="messages"]');
  await sleep(300);
  check((await g(() => document.querySelectorAll('.fv-th').length)) >= 1, 'Messages lists the people who wrote');
  await page.click('.fv-th');
  await sleep(200);
  const thr = await g(() => ({ bubbles: document.querySelectorAll('.fv-bubble').length, chips: document.querySelectorAll('.fv-quick .fv-chip').length }));
  check(thr.bubbles >= 1, `a thread shows the message as a bubble (${thr.bubbles}) and the quick replies (${thr.chips})`);
  if (thr.chips) { await page.click('.fv-quick .fv-chip'); await sleep(150); check((await g(() => document.querySelectorAll('.fv-bubble.out').length)) >= 1, 'answering from Messages writes your reply in the thread'); }
  await page.click('[data-tab="focus"]');
  await sleep(200);
  await page.click('.fv-sw');
  check((await Q()).focus === true, 'Focus: Do Not Disturb switches on');
  await page.click('.fv-sw');
  check((await Q()).focus === false, '…and off again');
  const mentors = await g(() => ({ tokens: window.__ori.game3d.game.quests.state.mentors.tokens, buttons: document.querySelectorAll('.fv-quick [data-act="mentors"]').length }));
  if (mentors.buttons) { await page.click('.fv-quick [data-act="mentors"]'); check((await g(() => window.__ori.game3d.game.quests.state.mentors.tokens)) === mentors.tokens - 1, 'the mentors take a trivial favour (a token is spent)'); }
  { const cur = await g(scanCursors); check(cur.count === 0, `the phone uses the shared cursors (${cur.n} elements, ${cur.count} strays${cur.count ? ': ' + cur.bad.join(' | ') : ''})`); }

  // ── Esc closes the phone first (the game is not paused), then Space does a favour ──
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__ori.game3d.state().quests.phoneOpen, null, { timeout: 3000 });
  check(!(await g(() => window.__ori.game3d.paused)), 'Esc closes the phone before it pauses the game');
  const s0 = (await Q());
  const open1 = s0.open.find((t) => t.state !== 'delegated');
  if (open1) {
    const place = await g((id) => window.__ori.game3d.game.quests.get(id).at, open1.uid);
    await g((p) => window.__ori.game3d.teleport(p), place);
    await page.keyboard.press('Space');
    await sleep(200);
    const s1 = await Q();
    check(s1.done === s0.done + 1 && s1.score > s0.score, `Space at the door does the favour (+${s1.score - s0.score} favours)`);
    check(await g(() => document.querySelector('.fv-float') !== null && document.querySelector('[data-k="score"]').textContent !== '0'), 'a "+points" word floats up and the favour meter moves');
  }
  check(await g(() => Number(document.querySelector('[data-k="chaosn"]').textContent) >= 0 && document.querySelector('.fv-meters') !== null), 'the chaos and favour meters are on the HUD');

  // ── the end of the day: the report card ──
  await g(() => window.__ori.game3d.setHour(23.99));
  await page.waitForFunction(() => window.__ori.game3d.state().phase === 'over', null, { timeout: 5000 }).catch(() => {});
  const rep = await g(() => ({ phase: window.__ori.game3d.state().phase, card: document.querySelector('.fv-report') && document.querySelector('.fv-report').textContent }));
  check(rep.phase === 'over' && /The day is over/.test(rep.card || '') && /You slept 0 hours/.test(rep.card || '') && /helped/.test(rep.card || ''), 'at midnight the report card appears (rank, "You slept 0 hours.")');
  await shot('T52-report.png');
  await page.click('.fv-report [data-a="again"]');
  await sleep(300);
  const again = await S();
  check(again.phase === 'play' && again.clock.label === '06:00' && again.quests.arrived === 0, '"Another day" starts a new morning with a new phone');

  await g(() => window.__ori.game3d.quit());
  await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 5000 });
  const m = await g(() => window.__ori.game3d.lastMemory);
  check(m && m.geometries === 0 && m.textures === 0, 'quitting after a full day leaves no GPU memory behind');
}
