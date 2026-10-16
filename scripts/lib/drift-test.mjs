// NEON DRIFT browser checks (T41): the host opens a full-viewport overlay with its own renderer, pauses the room, takes the
// keyboard, drives (autopilot + keys), pauses/resumes/quits cleanly and leaves no GPU memory behind.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';

export async function runDrift(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`drift: ${msg}`) : fail(`drift: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const flat = session.width < 860; // flat mode does not render the 3D room at all
  const shot = async (name) => { await settle(session, 2); await page.screenshot({ path: join(SHOTS, flat ? name.replace('.png', '-phone.png') : name) }); };

  // the room must be alive before the game starts
  const room0 = await g(() => ({ frame: window.__ori.renderer.info.render.frame, geo: window.__ori.renderer.info.memory.geometries, tex: window.__ori.renderer.info.memory.textures }));
  check(!(await g(() => window.__ori.game3d.running)), 'not running before launch');

  // ── launch ──
  await g(() => window.__ori.game3d.launch('drift'));
  await page.waitForFunction(() => window.__ori.game3d.running, null, { timeout: 20000 });
  check(await g(() => !!document.getElementById('g3d') && document.body.classList.contains('g3d-open')), 'the overlay is in the page and the body is flagged');
  const rect = await g(() => { const r = document.querySelector('#g3d canvas').getBoundingClientRect(); return { w: r.width, h: r.height, top: r.top, left: r.left, z: getComputedStyle(document.getElementById('g3d')).zIndex }; });
  check(rect.w === session.width && rect.h === session.height && rect.top === 0 && rect.left === 0, `the canvas covers the viewport (${rect.w}x${rect.h})`);
  check(Number(rect.z) >= 100000, 'the overlay is above everything');

  // the room render loop is stopped: its frame counter freezes
  await sleep(400);
  const f1 = await g(() => window.__ori.renderer.info.render.frame);
  await sleep(600);
  const f2 = await g(() => window.__ori.renderer.info.render.frame);
  check(f2 === f1, `the room render loop is paused while the game runs (frame ${f1} → ${f2})`);
  if (!flat) check(f1 > room0.frame, 'the room was rendering before the launch');
  check(await g(() => window.__ori.audio().gain === 0 || window.__ori.audio().gain === undefined || window.__ori.audio().gain < 0.02), 'the room audio is ducked');

  // ── autopilot drives full speed ──
  await g(() => window.__ori.game3d.autopilot(true));
  await page.waitForFunction(() => { const s = window.__ori.game3d.state(); return s && s.speedKmh > 150; }, null, { timeout: 30000 });
  await sleep(1200);
  const st = await g(() => ({ state: window.__ori.game3d.state(), stats: window.__ori.game3d.stats(), fps: window.__ori.game3d.fps }));
  check(st.state.speedKmh > 100 && Math.abs(st.state.lateral) < 12, `the autopilot drives at ${st.state.speedKmh} km/h on the road (lateral ${st.state.lateral} m)`);
  console.log(`  ℹ drift: ${st.fps} fps, ${st.stats.calls} draw calls, ${(st.stats.triangles / 1000).toFixed(0)}k tris, ${st.stats.geometries} geometries, ${st.stats.textures} textures (DPR ${st.stats.pixelRatio}, track ${st.state.track.length} m, ${st.state.track.hairpins} hairpins)`);
  check(st.fps > 30, `renders at ${st.fps} fps`);
  await shot('T41-drive-straight.png');

  // deterministic picture of a corner at speed: advance the simulation by steps
  await g(() => window.__ori.game3d.step(120 * 9));
  await shot('T41-drive-corner.png');

  // ── keyboard: W, then D + Space → a slide ──
  await g(() => { window.__ori.game3d.setSeed(7); window.__ori.game3d.autopilot(false); });
  await sleep(300);
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.__ori.game3d.state().speedKmh > 90, null, { timeout: 15000 });
  check(true, 'W accelerates the car');
  await page.keyboard.down('KeyD');
  await page.keyboard.down('Space');
  const slid = await page.waitForFunction(() => { const s = window.__ori.game3d.state(); return Math.abs(s.slipDeg) > 18 ? s : null; }, null, { timeout: 6000 }).then((h) => h.jsonValue()).catch(() => null);
  check(!!slid, `D + Space throws the car sideways${slid ? ` (slip ${slid.slipDeg}°, speed ${slid.speedKmh} km/h)` : ''}`);
  await sleep(500);
  await shot('T41-drift.png');
  await page.keyboard.up('Space');
  await page.keyboard.up('KeyD');
  await page.keyboard.up('KeyW');
  const boosted = await g(() => window.__ori.game3d.state().boost);
  check(boosted > 0, `drifting charged the boost meter (${boosted}%)`);

  // ── the room never sees the game keys ──
  const stationBefore = await g(() => window.__ori.stations().index);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('KeyA');
  check((await g(() => window.__ori.stations().index)) === stationBefore, 'arrow keys do not move the room camera while playing');

  // ── pause menu ──
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__ori.game3d.paused, null, { timeout: 3000 });
  check(await g(() => !document.querySelector('#g3d .g3d-menu').hidden), 'Esc opens the pause menu');
  const t1 = await g(() => window.__ori.game3d.state().tick);
  await sleep(500);
  check((await g(() => window.__ori.game3d.state().tick)) === t1, 'the simulation stands still while paused');
  await shot('T41-pause.png');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__ori.game3d.paused, null, { timeout: 3000 });
  check(true, 'Esc resumes');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__ori.game3d.paused, null, { timeout: 3000 });
  await page.click('#g3d [data-a="restart"]');
  await page.waitForFunction(() => !window.__ori.game3d.paused, null, { timeout: 3000 });
  check((await g(() => window.__ori.game3d.state().s)) < 30, 'Restart puts the car back on the start line');

  // ── resize ──
  await page.setViewportSize({ width: 900, height: 600 });
  await sleep(300);
  const r2 = await g(() => { const c = document.querySelector('#g3d canvas'); return { w: c.getBoundingClientRect().width, bw: c.width }; });
  check(r2.w === 900 && r2.bw === 900 * (await g(() => window.__ori.game3d.stats().pixelRatio)), `resize follows the window (${r2.w} css px, ${r2.bw} px buffer)`);
  await page.setViewportSize({ width: session.width, height: session.height });
  await sleep(200);

  // ── quit via the menu: back to the desktop, room rendering again, nothing left on the GPU ──
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__ori.game3d.paused, null, { timeout: 3000 });
  await page.click('#g3d [data-a="quit"]');
  await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 5000 });
  await sleep(400);
  check(await g(() => !document.getElementById('g3d') && !document.body.classList.contains('g3d-open')), 'the overlay is gone after Quit');
  const f3 = await g(() => window.__ori.renderer.info.render.frame);
  await sleep(500);
  const f4 = await g(() => window.__ori.renderer.info.render.frame);
  if (!flat) check(f4 > f3, `the room renders again after Quit (frame ${f3} → ${f4})`);
  const mem = await g(() => window.__ori.game3d.lastMemory);
  check(mem && mem.geometries === 0 && mem.textures === 0, `the game's GPU memory is released (geometries ${mem?.geometries}, textures ${mem?.textures})`);
  const room1 = await g(() => ({ geo: window.__ori.renderer.info.memory.geometries, tex: window.__ori.renderer.info.memory.textures }));
  check(room1.geo === room0.geo && room1.tex === room0.tex, `the room's own memory is untouched (geometries ${room0.geo} → ${room1.geo}, textures ${room0.tex} → ${room1.tex})`);

  // ── WebGL context loss: a card on screen, the game carries on after the browser restores the context ──
  await g(() => window.__ori.game3d.launch('drift'));
  await page.waitForFunction(() => window.__ori.game3d.running, null, { timeout: 20000 });
  await sleep(300);
  await g(() => { const gl = document.querySelector('#g3d canvas').getContext('webgl2'); window.__lose = gl.getExtension('WEBGL_lose_context'); window.__lose.loseContext(); });
  await page.waitForFunction(() => { const m = document.querySelector('#g3d .g3d-msg'); return m && !m.hidden; }, null, { timeout: 5000 });
  check(true, 'a lost WebGL context shows a message card instead of a broken screen');
  await g(() => window.__lose.restoreContext());
  await page.waitForFunction(() => document.querySelector('#g3d .g3d-msg').hidden, null, { timeout: 8000 });
  const tk = await g(() => window.__ori.game3d.state().tick);
  await sleep(500);
  check((await g(() => window.__ori.game3d.state().tick)) > tk, 'the game carries on after the context is restored');
  await g(() => window.__ori.game3d.quit());
  await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 5000 });

  // ── the three biomes at their tiers: world budget, the right look, and a clean teardown each time ──
  for (const [biome, tier, car] of [['city', 'high', 'gt'], ['desert', 'high', 'hyper'], ['coast', 'high', 'hatch'], ['city', 'medium', 'gt'], ['coast', 'low', 'gt']]) {
    await g((o) => window.__ori.game3d.launch('drift', o), { biome, tier, carType: car });
    await page.waitForFunction(() => window.__ori.game3d.running, null, { timeout: 30000 });
    await g(() => { window.__ori.game3d.autopilot(true); window.__ori.game3d.step(900); });
    await sleep(500);
    const w = await g(() => ({ stats: window.__ori.game3d.stats(), state: window.__ori.game3d.state() }));
    const maxCalls = tier === 'low' ? 120 : 300;
    check(w.state.biome === biome && w.state.speedKmh > 100, `${biome}/${tier}: world built, the car drives (${w.state.look}, ${w.state.speedKmh} km/h)`);
    check(w.stats.calls <= maxCalls && w.stats.triangles <= 600000, `${biome}/${tier}: budget ${w.stats.calls} draw calls (≤ ${maxCalls}), ${(w.stats.triangles / 1000).toFixed(0)}k triangles (≤ 600k), ${w.stats.fps} fps`);
    await g(() => window.__ori.game3d.quit());
    await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 5000 });
    await sleep(120);
    const m = await g(() => window.__ori.game3d.lastMemory);
    check(m && m.geometries === 0 && m.textures === 0, `${biome}/${tier}: everything released on quit (geometries ${m?.geometries}, textures ${m?.textures})`);
  }
  // switching biome / look / tier while running rebuilds the world without leaking
  await g(() => window.__ori.game3d.launch('drift', { biome: 'city' }));
  await page.waitForFunction(() => window.__ori.game3d.running, null, { timeout: 30000 });
  const sw = await g(() => {
    const d = window.__ori.game3d;
    const out = [];
    for (const [fn, arg] of [['setBiome', 'desert'], ['setLook', 'noon'], ['setTier', 'low'], ['setTier', 'high'], ['setBiome', 'coast']]) { d[fn](arg); out.push(d.state()); }
    return out;
  });
  check(sw[0].biome === 'desert' && sw[1].look === 'Noon' && sw[4].biome === 'coast', 'biome / look / tier can be switched while running');
  await g(() => window.__ori.game3d.quit());
  await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 5000 });
  const ms = await g(() => window.__ori.game3d.lastMemory);
  check(ms && ms.geometries === 0 && ms.textures === 0, 'after switching worlds a quit still leaves nothing behind');

  // ── launch / quit x5: no growth ──
  for (let i = 0; i < 5; i++) {
    await g(() => window.__ori.game3d.launch('drift'));
    await page.waitForFunction(() => window.__ori.game3d.running, null, { timeout: 20000 });
    await sleep(250);
    await g(() => window.__ori.game3d.quit());
    await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 5000 });
    await sleep(150);
    const m = await g(() => window.__ori.game3d.lastMemory);
    if (!(m && m.geometries === 0 && m.textures === 0)) { fail(`drift: launch/quit cycle ${i + 1} leaked (${JSON.stringify(m)})`); break; }
    if (i === 4) ok('drift: launch/quit x5 leaves no GPU memory behind');
  }
  const room2 = await g(() => ({ geo: window.__ori.renderer.info.memory.geometries, tex: window.__ori.renderer.info.memory.textures, programs: window.__ori.renderer.info.programs.length }));
  check(room2.geo === room0.geo && room2.tex === room0.tex, `the room's memory is unchanged after 5 cycles (geometries ${room2.geo}, textures ${room2.tex})`);
}
