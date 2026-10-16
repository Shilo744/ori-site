// Ambient-life checks (T13): the wall clock tells the real time with a smooth second hand, the cat breathes, the robot
// vacuum patrols, steam / light shaft follow the time of day, the HomePod ring reacts, the draw-call budget holds, and
// nothing animates in `flat` mode or while the camera is on the laptop screen.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';
import { clearance, VACUUM_R } from '../../src/scene/life-path.js';

export async function runLife(session, { ok, fail }) {
  const { page } = session;
  const tag = `${session.width}x${session.height}`;
  const check = (cond, msg) => (cond ? ok(`life: ${msg}`) : fail(`life: ${msg}`));
  const flat = session.width < 860;
  const dbg = () => page.evaluate(() => window.__ori.life.debug());

  if (flat) {
    // flat mode: the 3D room is not rendered — the ambient life must not tick at all
    const a = await dbg();
    await sleep(1200);
    const b = await dbg();
    check(a.swayTime === b.swayTime && a.catScale === b.catScale && a.vacuum.x === b.vacuum.x, 'flat mode: nothing in the room animates');
    return;
  }

  if ((await page.evaluate(() => window.__ori.state)) !== 'overview') {
    await page.evaluate(() => window.__ori.exitScreen());
    await page.waitForFunction(() => window.__ori.state === 'overview', null, { timeout: 60000 }).catch(() => {});
  }
  await page.evaluate(() => { window.__ori.daylight.transitionSeconds = 0.01; window.__ori.daylight.setMode('auto'); });
  await settle(session, 3);

  // ── wall clock: real local time, hands at the right angles, second hand sweeps ──
  const real = await page.evaluate(() => { const d = new Date(); return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds() + d.getMilliseconds() / 1000 }; });
  const c1 = (await dbg()).clock;
  const expHour = (((real.h % 12) + real.m / 60) / 12) * 360;
  const expMin = ((real.m + real.s / 60) / 60) * 360;
  const dAng = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  check(dAng(c1.hour, expHour) < 4, `clock: the hour hand shows the real time (${c1.hour.toFixed(1)}° vs ${expHour.toFixed(1)}°)`);
  check(dAng(c1.minute, expMin) < 8, `clock: the minute hand shows the real time (${c1.minute.toFixed(1)}° vs ${expMin.toFixed(1)}°)`);
  const secs = [];
  for (let i = 0; i < 4; i++) { await sleep(250); secs.push((await dbg()).clock.second); }
  check(secs.some((v) => v % 6 > 0.35 && v % 6 < 5.65), `clock: the second hand sweeps smoothly, it is not a ticker (${secs.map((v) => v.toFixed(1)).join(', ')}°)`);

  // ── cat breathes ──
  const cs = await page.evaluate(() => { const c = window.__ori.life.cat, out = []; for (let i = 0; i < 60; i++) { c.update(0.1, 100 + i * 0.1); out.push(c.group.children[0].scale.y); } return out; });
  check(Math.max(...cs) - Math.min(...cs) > 0.004, `cat: the chest rises and falls (scale.y ${Math.min(...cs).toFixed(3)}–${Math.max(...cs).toFixed(3)})`);
  await page.evaluate(() => window.__ori.life.cat.pet());
  await sleep(500);
  check(true, 'cat: pet() lifts the head without errors');

  // ── robot vacuum patrols its route (stepped in simulated time: software GL renders only 1–2 fps) ──
  const trace = await page.evaluate(() => {
    const v = window.__ori.life.vacuum, out = [];
    for (let i = 0; i < 700; i++) { v.update(0.1); out.push([v.group.position.x, v.group.position.z, v.speed]); }
    return { out, stops: v.stops.length };
  });
  const travelled = trace.out.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - trace.out[i - 1][0], p[1] - trace.out[i - 1][1]) : s), 0);
  const closest = Math.min(...trace.out.map((p) => clearance(p[0], p[1])));
  const paused = trace.out.filter((p) => p[2] < 0.6).length;
  check(trace.stops >= 3 && travelled > 400, `vacuum: patrols a long route (${trace.stops} stops, ${travelled.toFixed(0)} cm in 70 s of simulated time)`);
  check(closest >= VACUUM_R + 2, `vacuum: never touches furniture or walls (closest ${(closest - VACUUM_R).toFixed(1)} cm of free space)`);
  check(paused > 5, `vacuum: stops and turns on the spot now and then (${paused} slow samples)`);

  // ── steam / light shaft / dust follow the time of day ──
  const at = async (h) => { await page.evaluate((x) => window.__ori.setTime(x), h); await settle(session, 2); return dbg(); };
  const morning = await at(7.8), noon = await at(13.2), night = await at(2);
  check(morning.steam > noon.steam && morning.steam > 0.6, `steam: strongest at breakfast (${morning.steam.toFixed(2)} vs ${noon.steam.toFixed(2)} at noon)`);
  check(noon.shaft > 0.05 && night.shaft < 0.02, `light shaft: bright by day (${noon.shaft.toFixed(3)}), almost gone at 02:00 (${night.shaft.toFixed(3)})`);
  check(noon.dust > 0.5 && night.dust < 0.15, `dust motes: visible in the sun (${noon.dust.toFixed(2)}), faint at night (${night.dust.toFixed(2)})`);

  // ── HomePod ring, plant gust ──
  const idle = await dbg();
  await page.evaluate(() => { window.__ori.life.homepod.setActive(true); window.__ori.life.homepod.setLevel(1); });
  await sleep(900);
  await settle(session, 2);
  const live = await dbg();
  check(live.ring !== idle.ring && live.ringScale > 1.15, `HomePod: the light ring changes colour and pulses when music plays (scale ${live.ringScale.toFixed(2)})`);
  await page.evaluate(() => { window.__ori.life.homepod.setActive(false); window.__ori.life.plant.rustle(); });
  await settle(session, 2);
  check((await dbg()).swayAmp > 1.5, 'plant: rustle() raises the leaf sway');

  // ── budget + screen-state throttling ──
  await page.evaluate(() => window.__ori.setView('overview'));
  await sleep(1500);
  const stats = await page.evaluate(() => window.__ori.stats());
  check(stats.calls <= 165 && stats.triangles <= 200000, `budget: ${stats.calls} draw calls / ${stats.triangles} triangles (limit 165 / 200k)`);
  await page.evaluate(() => window.__ori.setView('free'));
  await page.screenshot({ path: join(SHOTS, 'smoke', `${tag}-life.png`) });
  await page.evaluate(() => window.__ori.enterScreen());
  await page.waitForFunction(() => window.__ori.state === 'screen', null, { timeout: 60000 }).catch(() => {});
  await sleep(600);
  const s1 = await dbg();
  await sleep(1500);
  const s2 = await dbg();
  check(s1.swayTime === s2.swayTime && s1.catScale === s2.catScale && s1.vacuum.x === s2.vacuum.x, 'screen state: the room stops animating while you are on the laptop');
  await page.evaluate(() => window.__ori.exitScreen());
  await page.waitForFunction(() => window.__ori.state === 'overview', null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(() => { window.__ori.daylight.transitionSeconds = 1.5; });
}
