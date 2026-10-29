// "Ori's Life" browser checks (T51): the host opens the game in its overlay, the neighbourhood and Ori are drawn within budget,
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
  check(ov.game === 'favors' && ov.label === "Ori's Life" && ov.open, 'the host opens it in the overlay with its own title');
  check(ov.w === session.width && ov.h === session.height, `the canvas covers the viewport (${ov.w}x${ov.h})`);
  const s0 = await st();
  check(/^06:0[0-3]$/.test(s0.clock.label) && s0.near === 'home' && s0.crowd === 40, `the day starts at 06:00 at home with 40 passers-by (${s0.clock.label}, near ${s0.near})`);
  check(await g(() => /^06:0[0-3]$/.test(document.querySelector('.fv-clock b').textContent) && document.querySelector('.fv-place.on') !== null), 'the HUD shows the clock and the place');
  // Ori is SCULPTED (no photo): a skinned character on one skeleton, no image textures on any of his materials, an expressive face
  const ori = await g(() => {
    const o = window.__ori.game3d.game.scene.getObjectByName('ori');
    if (!o) return null;
    let skinned = 0; let bones = 0; let tex = 0; let tris = 0;
    o.traverse((m) => {
      if (m.isSkinnedMesh) { skinned++; bones = Math.max(bones, m.skeleton.bones.length); if (m.geometry.index) tris += m.geometry.index.count / 3; }
      const ms = m.isSkinnedMesh && m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
      for (const mt of ms) if (mt.map) tex++;
    });
    return { face: o.userData.faceSource, skinned, bones, tex, tris: Math.round(tris), person: !!(window.__ori.game3d.game.ori && window.__ori.game3d.game.ori.person) };
  });
  check(!!ori && ori.face === 'sculpted' && ori.skinned >= 10 && ori.bones >= 40 && ori.tex === 0, `Ori's face is sculpted geometry on a skinned rig, not a photo (${ori && ori.skinned} skinned layers, ${ori && ori.bones} bones, ${ori && ori.tex} image textures, ${ori && Math.round(ori.tris / 1000)}k tris)`);

  // ── budget ──
  await sleep(600);
  await page.waitForFunction(() => window.__ori.game3d.fps > 40, null, { timeout: 10000 }).catch(() => {}); // (the first frames compile the shaders)
  const a = await g(() => ({ stats: window.__ori.game3d.stats(), fps: window.__ori.game3d.fps }));
  console.log(`  ℹ favors3d: ${a.fps} fps, ${a.stats.calls} draw calls, ${(a.stats.triangles / 1000).toFixed(0)}k tris, ${a.stats.geometries} geometries, ${a.stats.textures} textures`);
  check(a.stats.calls <= 700 && a.stats.triangles <= 2500000, `within the High-tier budget (<= 700 calls, <= 2.5M tris: ${a.stats.calls} calls, ${(a.stats.triangles / 1000).toFixed(0)}k tris)`);
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

  // ── the world art (T60): real facades, the sky, the weather, the life, and the budget in every kind of view ──
  const art = await g(() => {
    const sc = window.__ori.game3d.game.scene;
    const b = sc.getObjectByName('buildings');
    const sky = sc.children.find((o) => o.isMesh && o.material && o.material.uniforms && o.material.uniforms.uSunDir);
    const cam = window.__ori.game3d.game.camera;
    const kinds = {};
    b.children.forEach((m) => { const k = m.name.replace(/-[-0-9,]+$/, ''); kinds[k] = (kinds[k] || 0) + 1; });
    return {
      chunks: b.children.filter((m) => m.name.startsWith('walls')).length, culled: b.children.every((m) => m.frustumCulled !== false), kinds,
      skyRadius: sky ? sky.geometry.parameters.radius * sky.scale.x : 0, far: cam.far,
      life: ['pigeons', 'litter', 'cat-ginger', 'cat-grey', 'cat-tuxedo', 'string-lights', 'parasol-tint', 'rain'].filter((n) => !!sc.getObjectByName(n)),
      matLib: window.__ori.game3d.game.weather() !== null,
    };
  });
  check(art.chunks >= 12 && art.culled, `the neighbourhood is cut into ${art.chunks} chunks the camera can cull (walls, trim, fine detail, glass, cloth ...: ${Object.keys(art.kinds).join(', ')})`);
  check(art.skyRadius > 100 && art.skyRadius < art.far * 0.95, `the sky dome sits inside the camera's far plane, so the sky is drawn (${Math.round(art.skyRadius)} m < ${art.far} m)`);
  check(art.life.length === 8, `the street life is there: pigeons, litter, three cats, the café lights, parasols, rain (${art.life.join(', ')})`);
  // the budget in every kind of view and light (High tier): street, plaza, café terrace, park, promenade; day, golden hour, night, and rain
  const views = [['home', 13, 0], ['cafe', 19.9, 0], ['cityhall', 16, 0], ['park', 10, 0], ['busstop', 18.7, 0], ['cafe', 21.8, 1], ['home', 14, 1]];
  const worst = { calls: 0, tris: 0, at: '' };
  for (const [at, hour, rain] of views) {
    await D('setHour', hour);
    await g((r) => window.__ori.game3d.game.setWeather(r ? { rain: 1 } : null), rain);
    await D('teleport', at);
    await sleep(700);
    const v = await g(() => window.__ori.game3d.stats());
    if (v.triangles > worst.tris) { worst.tris = v.triangles; worst.calls = v.calls; worst.at = `${at} ${hour}h${rain ? ' rain' : ''}`; }
    if (v.calls > 700 || v.triangles > 2500000) fail(`favors3d: over budget at ${at} ${hour}h ${rain ? 'rain' : ''}: ${v.calls} calls, ${(v.triangles / 1000).toFixed(0)}k tris`);
    if (rain) check(await g(() => window.__ori.game3d.game.scene.getObjectByName('rain').visible), 'it rains (the streaks are drawn)');
  }
  await g(() => window.__ori.game3d.game.setWeather(null));
  ok(`favors3d: 7 views (street, café at dusk, plaza, park, bus stop, night rain, wet street) all inside the budget; the heaviest: ${(worst.tris / 1000).toFixed(0)}k tris, ${worst.calls} calls at ${worst.at}`);
  await D('setHour', 13);
  check(await g(() => window.__ori.game3d.game.scene.getObjectByName('rain').visible === false), 'the sky clears when the weather is released');

  // ── talking (T61): the hint, the conversation with real faces, choices, a compliment, effects, Esc, no leaks ──
  await g(() => { const x = window.__ori.game3d; x.setHour(13); x.teleport('mum'); });
  await sleep(500);
  check(await g(() => document.querySelector('.fv-talkhint:not(.fv-gohint).on') && /Mum/.test(document.querySelector('.fv-talkhint:not(.fv-gohint)').textContent)), "standing at Mum's door the hint says 'T Talk to Mum'");
  // (T63) H says hello: a wave, a bubble over Ori, the answer in a bubble over Mum, a heart, and the love of the neighbourhood goes up
  const love0 = await g(() => window.__ori.game3d.game.state().love);
  await page.keyboard.press('KeyH');
  await sleep(1100);
  check(await g(() => [...document.querySelectorAll('.fb')].some((b) => /Mum/i.test(b.textContent)) && document.querySelector('.fb-ori') !== null), 'H says hello: Ori and Mum both answer in speech bubbles (no conversation panel)');
  check((await g(() => window.__ori.game3d.game.state().love)) > love0, 'and the love of the neighbourhood goes up a little');
  await sleep(2600);
  // (the long conversation of T61 still exists behind the dev API)
  const rel0 = await g(() => window.__ori.game3d.game.state().quests.rel);
  await g(() => window.__ori.game3d.talk('ima'));
  await sleep(700);
  let ts = await g(() => window.__ori.game3d.talkState());
  check(ts.open && ts.who === 'ima' && /Motek/.test(ts.line.text), 'the conversation opens with Mum, in her own words');
  check(await g(() => { const c = [...document.querySelectorAll('.fv-talk canvas')]; return c.length === 2 && c.every((x) => x.width > 100 && x.getContext('2d').getImageData(120, 130, 1, 1).data[3] > 0); }), 'both faces are drawn (Ori and Mum, real 3D heads)');
  await page.keyboard.down('KeyW'); await sleep(500); await page.keyboard.up('KeyW');
  check((await st()).player.speed < 0.3, 'Ori stands and listens while they talk (W does nothing)');
  await page.keyboard.press('Space'); await sleep(120); // finishes the typing
  ts = await g(() => window.__ori.game3d.talkState());
  check(ts.line.choices && ts.line.choices.length === 3 && ts.line.shown === ts.line.text.length, 'the line is typed out, then three choices appear');
  await page.keyboard.press('Digit3'); await sleep(200); // "you look wonderful today"
  ts = await g(() => window.__ori.game3d.talkState());
  check(ts.flags.includes('ima.complimented'), 'a choice sets a flag');
  const rel1 = await g(() => window.__ori.game3d.game.state().quests.rel);
  check(rel1.family > rel0.family, `the relationship moves (family ${rel0.family.toFixed(1)} -> ${rel1.family.toFixed(1)})`);
  await page.keyboard.press('KeyC'); await sleep(200);
  ts = await g(() => window.__ori.game3d.talkState());
  check(ts.line && ts.line.speaker === 'ori', 'C pays a compliment: Ori speaks first');
  await page.keyboard.press('Escape'); await sleep(400);
  ts = await g(() => window.__ori.game3d.talkState());
  check(!ts.open && !(await g(() => window.__ori.game3d.state().paused)), 'Esc says goodbye (and does not open the pause menu)');
  // a stranger
  await g(() => { const x = window.__ori.game3d; x.teleport('park'); });
  const open2 = await g(() => window.__ori.game3d.talk('stranger:4'));
  await sleep(300);
  ts = await g(() => window.__ori.game3d.talkState());
  check(open2 && ts.who === 'stranger:4' && /Bus 5/.test(ts.line.text), 'a passer-by can be talked to');
  await page.keyboard.press('Escape'); await sleep(300);

  // ── walkable interiors (T62): G at a door goes in (a fade), the street is hidden, he walks about, the doormat leads out; no leaks ──
  await g(() => { const x = window.__ori.game3d; x.setHour(13); x.teleport('cafe'); });
  await sleep(400);
  check(await g(() => /Go inside/.test(document.querySelector('.fv-gohint')?.textContent || '')), "at a door the chip says 'G Go inside'");
  { const c = await g(() => { const r = document.querySelector('.fv-gohint').getBoundingClientRect(); return { mid: r.left + r.width / 2, half: innerWidth / 2, w: r.width }; }); check(Math.abs(c.mid - c.half) < 8, `the chip sits in the middle of the screen (its middle ${c.mid.toFixed(0)}, the screen's ${c.half.toFixed(0)})`); }
  const geo0 = await g(() => window.__ori.game3d.stats().geometries);
  await page.keyboard.press('KeyG');
  await page.waitForFunction(() => window.__ori.game3d.insideId() === 'cafe', null, { timeout: 4000 }).catch(() => {});
  await sleep(500);
  const in1 = await g(() => ({ id: window.__ori.game3d.insideId(), info: window.__ori.game3d.insideInfo(), p: window.__ori.game3d.state().player, vis: window.__ori.game3d.game.scene.children.filter((c) => c.visible && !c.isLight).length }));
  check(in1.id === 'cafe' && in1.p.x > 800 && !in1.info.trans, `G walks Ori into the cafe (${in1.p.x.toFixed(0)}, ${in1.p.z.toFixed(0)})`);
  check(in1.vis <= 6, `the street is hidden while he is inside (${in1.vis} visible scene objects)`);
  const roomCalls = await g(() => window.__ori.game3d.stats().calls);
  check(roomCalls < 400, `a room draws few calls (${roomCalls})`);
  const px0 = (await st()).player;
  await page.keyboard.down('KeyW'); await sleep(1400); await page.keyboard.up('KeyW');
  const px1 = (await st()).player;
  check(Math.hypot(px1.x - px0.x, px1.z - px0.z) > 2.5, 'he walks about inside');
  await page.keyboard.down('KeyW'); await sleep(2500); await page.keyboard.up('KeyW');
  const wall = (await st()).player;
  const room = await g(() => window.__ori.game3d.insideInfo());
  check(wall.z > room.exit.z - 9.5 && Math.abs(wall.x - room.exit.x) < 6.8, 'the walls and the furniture hold him in');
  await page.keyboard.press('Space'); // something near? (nothing breaks)
  await sleep(200);
  if ((await g(() => window.__ori.game3d.talkState())).open) { await page.keyboard.press('Escape'); await sleep(350); } // (it may have been a person: a conversation opens)
  if (await g(() => !!window.__ori.game3d.game.coffee && window.__ori.game3d.game.coffee.isOpen)) { await page.keyboard.press('Escape'); await sleep(350); } // (or the order pad by the cafe counter: the Coffee Rush card opens)
  await g(() => { const x = window.__ori.game3d; const i = x.insideInfo(); x.teleport({ x: i.exit.x + 0.3, z: i.exit.z - 1.4 }, (i.spawn && i.spawn.heading) ?? Math.PI); }); // (facing the room's way, so the camera - which follows his heading - is straight and S walks straight at the door, not slantwise past the jamb)
  await sleep(300);
  await page.keyboard.down('KeyS'); // onto the doormat (held until he is out: a slow machine walks slower and must not fail the check)
  await page.waitForFunction(() => window.__ori.game3d.insideId() === null, null, { timeout: 9000 }).catch(() => {});
  await page.keyboard.up('KeyS');
  await sleep(500);
  const out1 = await g(() => ({ id: window.__ori.game3d.insideId(), p: window.__ori.game3d.state().player, vis: window.__ori.game3d.game.scene.children.filter((c) => c.visible && !c.isLight).length }));
  check(out1.id === null && out1.p.x < 300 && out1.vis > 8, 'walking onto the doormat leads back out into the street');
  // six rooms in and out (twice: the people are built once and kept for the day), then the memory is the same
  const ROOMS_TRIED = ['home', 'mum', 'cityhall', 'perach', 'studio', 'kiosk', 'cafe', 'mum'];
  const pass = async () => {
    for (const pid of ROOMS_TRIED) {
      await g((p) => { const x = window.__ori.game3d; x.teleport(p); x.enter(p); x.game.render(1 / 60); x.game.render(1 / 60); }, pid);
      if ((await g(() => window.__ori.game3d.insideId())) !== pid) check(false, `can enter ${pid}`);
      await g(() => { window.__ori.game3d.leave(); window.__ori.game3d.game.render(1 / 60); });
    }
    return g(() => window.__ori.game3d.stats().geometries);
  };
  const geoA = await pass();
  const geo1 = await pass();
  check(geo1 === geoA, `entering and leaving 8 rooms again leaves no geometry behind (${geo0} → ${geoA} after the first round with all the people, ${geo1} after the second)`);
  check(await g(() => window.__ori.game3d.insideId() === null), 'all six places and more can be entered and left');

  // ── pause: Esc opens the menu and the simulation stands still; Esc resumes ──
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__ori.game3d.paused, null, { timeout: 3000 });
  check(await g(() => !document.querySelector('#g3d .g3d-menu').hidden), 'Esc opens the pause menu');
  const t1 = (await st()).clock.hour;
  await sleep(500);
  check((await st()).clock.hour === t1, 'the clock stands still while paused');
  { const cur = await g(scanCursors); check(cur.count === 0, `the overlay and its menu use the shared cursors (${cur.n} elements, ${cur.count} strays${cur.count ? `: ${cur.bad.join(' | ')}` : ''})`); }
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
