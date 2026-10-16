// "Ori, Can You...?" browser checks (T51): the host opens the game in its overlay, the neighbourhood and Ori are drawn within budget,
// the real keyboard walks and sprints him, places can be reached, the day clock runs, pause works, and quitting leaves no GPU memory behind.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';
import { scanCursors } from './cursor-test.mjs';

export async function runFavors3d(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`favors3d: ${msg}`) : fail(`favors3d: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const flat = session.width < 860;
  const shot = async (name) => { await settle(session, 2); await page.screenshot({ path: join(SHOTS, flat ? name.replace('.png', '-phone.png') : name) }); };
  const st = () => g(() => window.__ori.game3d.state());
  const D = (fn, ...a) => g(([f, args]) => { const d = window.__ori.game3d; return d[f](...args); }, [fn, a]);

  // ── launch ──
  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 40000 });
  const ov = await g(() => { const o = document.getElementById('g3d'); const r = document.querySelector('#g3d canvas').getBoundingClientRect(); return { game: o.dataset.game, label: o.getAttribute('aria-label'), w: r.width, h: r.height, open: document.body.classList.contains('g3d-open') }; });
  check(ov.game === 'favors' && ov.label === 'Ori, Can You...?' && ov.open, 'the host opens it in the overlay with its own title');
  check(ov.w === session.width && ov.h === session.height, `the canvas covers the viewport (${ov.w}x${ov.h})`);
  const s0 = await st();
  check(s0.clock.label === '06:00' && s0.near === 'home' && s0.crowd === 40, `the day starts at 06:00 at home with 40 passers-by (${s0.clock.label}, near ${s0.near})`);
  check(await g(() => document.querySelector('.fv-clock b').textContent === '06:00' && document.querySelector('.fv-place.on') !== null), 'the HUD shows the clock and the place');
  const face = await g(() => { const o = window.__ori.game3d.game.scene.getObjectByName('ori'); return o ? o.userData.faceSource : null; });
  await page.waitForFunction(() => { const o = window.__ori.game3d.game.scene.getObjectByName('ori'); return o && o.userData.faceSource === 'photo'; }, null, { timeout: 8000 }).catch(() => {});
  check((await g(() => window.__ori.game3d.game.scene.getObjectByName('ori').userData.faceSource)) === 'photo', `Ori's face is the photo cutout (it was "${face}" at launch)`);

  // ── budget ──
  await sleep(600);
  await page.waitForFunction(() => window.__ori.game3d.fps > 40, null, { timeout: 10000 }).catch(() => {}); // (the first frames compile the shaders)
  const a = await g(() => ({ stats: window.__ori.game3d.stats(), fps: window.__ori.game3d.fps }));
  console.log(`  ℹ favors3d: ${a.fps} fps, ${a.stats.calls} draw calls, ${(a.stats.triangles / 1000).toFixed(0)}k tris, ${a.stats.geometries} geometries, ${a.stats.textures} textures`);
  check(a.stats.calls <= 300 && a.stats.triangles <= 600000, `within the budget (${a.stats.calls} calls, ${(a.stats.triangles / 1000).toFixed(0)}k tris)`);
  check(a.fps > 40, `renders at ${a.fps} fps`);

  // ── the room is asleep, the keys are ours ──
  const f1 = await g(() => window.__ori.renderer.info.render.frame);
  await sleep(500);
  check((await g(() => window.__ori.renderer.info.render.frame)) === f1, 'the room render loop is paused while the game runs');

  // ── real keys: W walks, Shift sprints ──
  await g(() => { window.__ori.game3d.teleport({ x: -62, z: 5 }, Math.PI / 2); window.__ori.game3d.game.setCamera({ yaw: Math.PI / 2 }); }); // on the main street, looking east
  const p0 = (await st()).player;
  await page.keyboard.down('KeyW');
  await sleep(1100);
  const p1 = (await st()).player;
  check(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 2.5 && p1.speed > 3, `W walks Ori (${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1)} m, ${p1.speed.toFixed(1)} m/s)`);
  await page.keyboard.down('ShiftLeft');
  await sleep(1200);
  const p2 = (await st()).player;
  check(p2.sprinting && p2.speed > p1.speed + 1.5 && p2.stamina < 1, `Shift sprints (${p2.speed.toFixed(1)} m/s, stamina ${p2.stamina.toFixed(2)})`);
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('KeyW');
  await sleep(700);
  check((await st()).player.speed < 0.3, 'he stops when the keys are up');

  // ── teleport to every place: near it, the label shows, nothing is inside a wall ──
  const places = await g(() => ['home', 'mum', 'auntie', 'cityhall', 'perach', 'studio', 'startup', 'sidegig', 'cafe', 'kiosk', 'busstop', 'park', 'court', 'workshop'].map((id) => { const w = window.__ori.game3d.teleport(id); return { id, near: w.near, x: w.player.x, z: w.player.z }; }));
  check(places.every((p) => p.near === p.id), `every one of the 14 places can be reached (${places.filter((p) => p.near !== p.id).map((p) => `${p.id}→${p.near}`).join(', ') || 'all near their door'})`);
  const stuck = await g(() => window.__ori.game3d.game.map.world.blocked(window.__ori.game3d.state().player.x, window.__ori.game3d.state().player.z, 0.3));
  check(!stuck, 'Ori is never placed inside something');

  // ── a bot walk through the streets: no stuck, no leaving the map ──
  await D('teleport', 'home');
  const walked = await g(() => {
    const d = window.__ori.game3d;
    const game = d.game;
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, 1]];
    let travelled = 0;
    let last = d.state().player;
    for (let i = 0; i < 24; i++) {
      const [mx, mz] = dirs[i % dirs.length];
      game.step(240, { mx, mz, sprint: i % 3 === 0 });
      const p = d.state().player;
      travelled += Math.hypot(p.x - last.x, p.z - last.z);
      last = p;
    }
    const m = game.map;
    return { travelled, x: last.x, z: last.z, inside: last.x >= m.bounds.x0 && last.x <= m.bounds.x1 && last.z >= m.bounds.z0 && last.z <= m.bounds.z1, blocked: m.world.blocked(last.x, last.z, 0.3) };
  });
  check(walked.inside && !walked.blocked && walked.travelled > 100, `a 48-second bot walk stays inside the map and not in a wall (${walked.travelled.toFixed(0)} m)`);

  // ── the day: the clock runs and the light follows ──
  await D('setHour', 6);
  const c1 = await g(() => window.__ori.game3d.clock());
  await sleep(1200);
  const c2 = await g(() => window.__ori.game3d.clock());
  check(c2.hour > c1.hour, `the game clock runs (${c1.label} → ${c2.label})`);
  await D('teleport', 'cafe');
  await D('setHour', 13);
  await shot('T51-street.png');
  await D('setHour', 23);
  await D('teleport', 'park');
  await shot('T51-night.png');
  const winNight = await g(() => window.__ori.game3d.game.scene.getObjectByName('buildings').userData.winUniform.value);
  await D('setHour', 13);
  const winDay = await g(() => window.__ori.game3d.game.scene.getObjectByName('buildings').userData.winUniform.value);
  check(winNight > 0.9 && winDay === 0, `the windows light up at night and not by day (${winNight.toFixed(2)} / ${winDay})`);

  // ── pause: Esc opens the menu and the simulation stands still; Esc resumes ──
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__ori.game3d.paused, null, { timeout: 3000 });
  check(await g(() => !document.querySelector('#g3d .g3d-menu').hidden), 'Esc opens the pause menu');
  const t1 = (await st()).clock.hour;
  await sleep(500);
  check((await st()).clock.hour === t1, 'the clock stands still while paused');
  { const cur = await g(scanCursors); check(cur.count === 0, `the overlay and its menu use the shared cursors (${cur.n} elements, ${cur.count} strays)`); }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__ori.game3d.paused, null, { timeout: 3000 });
  check(await g(() => document.querySelector('#g3d .g3d-menu').hidden), 'Esc resumes');

  // ── quit: everything is released ──
  await g(() => window.__ori.game3d.quit());
  await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 5000 });
  const m = await g(() => window.__ori.game3d.lastMemory);
  check(m && m.geometries === 0 && m.textures === 0, `quitting leaves nothing behind on the GPU (${JSON.stringify(m)})`);
  await sleep(300);
  const room0 = await g(() => ({ geo: window.__ori.renderer.info.memory.geometries, tex: window.__ori.renderer.info.memory.textures })); // (the room after the first visit: it may draw once when it wakes)
  for (let i = 0; i < 3; i++) {
    await g(() => window.__ori.game3d.launch('favors', { quick: true }));
    await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 40000 });
    await sleep(300);
    await g(() => window.__ori.game3d.quit());
    await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 5000 });
    await sleep(150);
    const mm = await g(() => window.__ori.game3d.lastMemory);
    if (!(mm && mm.geometries === 0 && mm.textures === 0)) { fail(`favors3d: launch/quit cycle ${i + 1} leaked (${JSON.stringify(mm)})`); break; }
    if (i === 2) ok('favors3d: launch/quit x3 leaves no GPU memory behind');
  }
  const room2 = await g(() => ({ geo: window.__ori.renderer.info.memory.geometries, tex: window.__ori.renderer.info.memory.textures }));
  check(room2.geo === room0.geo && room2.tex === room0.tex, `the room's memory does not grow over 3 more visits (geometries ${room2.geo}, textures ${room2.tex})`);
}
