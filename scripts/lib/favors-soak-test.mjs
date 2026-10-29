// "Ori, Can You...?" soak, browser checks (T09): twelve real fights in a row through the real menus (the fights themselves are ended quickly: the rules are the pure soak's job; this is
// about what a fight BUILDS and TEARS DOWN - the ring's props, the fighters, the UI, the music). The GPU's object counts must stay flat, the JS heap must not run away, no console errors.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';

export async function runFavorsSoak(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`soak: ${msg}`) : fail(`soak: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const FIGHTS = 12;
  // the ceilings: about 35 % above what was measured on 2026-10-21 (the street 484 calls / 2.27 M triangles, a fight 499 / 2.28 M, 67 fps at 1280x800 on the RTX 3060 laptop); the floor is low on purpose (two browsers may share the machine)
  const BUDGET = { streetCalls: 680, streetTris: 3100000, ringCalls: 680, ringTris: 3100000, ringFps: 30 };

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.setHour(12); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); });
  const mem = () => g(() => { const s = window.__ori.game3d.stats(); const m = performance.memory; return { geo: s.geometries, tex: s.textures, prog: s.programs, calls: s.calls, heap: m ? m.usedJSHeapSize / 1048576 : 0, dom: document.querySelectorAll('#g3d *').length }; });

  await sleep(800);
  const street = await g(() => window.__ori.game3d.stats());
  const ring = [];
  const samples = [];
  let wins = 0;
  for (let i = 1; i <= FIGHTS; i++) {
    await g(() => { const gm = window.__ori.game3d.game; const p = gm.fight.apron(); window.__ori.game3d.teleport({ x: p.x, z: p.z }, Math.PI); });
    await sleep(350);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 5000 });
    await page.keyboard.press('Digit1');
    await page.waitForFunction(() => window.__ori.game3d.game.fight.phase === 'fight', null, { timeout: 15000 });
    await sleep(300 + (i % 3) * 400); // (a different length of fight each time)
    ring.push(await g(() => { const x = window.__ori.game3d.stats(); return { calls: x.calls, tris: x.triangles, fps: x.fps }; }));
    await g(() => { const b = window.__ori.game3d.game.fight.bout; b.O.hp = 0; b.O.state = 'ko'; }); // the opponent is out: the real end of a fight (result, card, XP, music, back to the street)
    await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.cardOpen, null, { timeout: 15000 });
    if (await g(() => { const r = window.__ori.game3d.game.fight.snapshot().result; return !!r && r.winner === 'player'; })) wins++;
    await page.click('.fi-btn.primary');
    await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 8000 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !window.__ori.game3d.game.fight.active && !window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 8000 });
    await sleep(250);
    samples.push(await mem());
  }
  check(wins === FIGHTS, `${wins} / ${FIGHTS} fights went through the whole flow: menu, intro, fight, result card, back to the ladder, back to the street`);

  const base = samples[1]; // (the first two build their caches)
  const last = samples[samples.length - 1];
  const grow = (k) => Math.max(...samples.slice(2).map((s) => s[k])) - base[k];
  const fmt = (s) => `${s.geo} geometries, ${s.tex} textures, ${s.prog} programs`;
  check(grow('geo') <= 8 && grow('tex') <= 8 && grow('prog') <= 2, `the GPU's objects stay flat from fight 2 to fight ${FIGHTS} (${fmt(base)} -> ${fmt(last)}; most extra ${grow('geo')} / ${grow('tex')} / ${grow('prog')})`);
  if (base.heap) check(last.heap - base.heap < 120, `the JS heap does not run away (${base.heap.toFixed(0)} MB -> ${last.heap.toFixed(0)} MB)`);
  const maxCalls = Math.max(...ring.map((r) => r.calls)); const maxTris = Math.max(...ring.map((r) => r.tris)); const minFps = Math.min(...ring.map((r) => r.fps));
  check(street.calls <= BUDGET.streetCalls && street.triangles <= BUDGET.streetTris && maxCalls <= BUDGET.ringCalls && maxTris <= BUDGET.ringTris && minFps >= BUDGET.ringFps,
    `budget: the street ${street.calls} calls / ${street.triangles} triangles; the ring at most ${maxCalls} calls / ${maxTris} triangles, at least ${minFps} fps (ceilings ${BUDGET.ringCalls} / ${BUDGET.ringTris}, floor ${BUDGET.ringFps} fps)`);
  const b = await g(() => window.__ori.game3d.state().boxer);
  check(b.wins === FIGHTS || b.wins >= FIGHTS - 1, `the fights were counted (${b.wins} wins, Lv ${b.level})`);
  // the journal's career page counted every one of them
  await page.keyboard.press('Tab');
  await sleep(300);
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T15-journal-career.png') });
  const career = await g(() => Object.fromEntries([...document.querySelectorAll('.jr-career li')].map((li) => [li.querySelector('small').textContent, li.querySelector('b').textContent])));
  check(career['Fights won'] === `${FIGHTS} / ${FIGHTS}` && career['Knock-outs'] === String(FIGHTS), `the journal's career page counted them: ${JSON.stringify(career)}`);
  await page.keyboard.press('Escape');
  await sleep(200);
  check(grow('dom') <= 24, `the page's elements stay flat too (${base.dom} -> ${last.dom} in the game's overlay)`);
}
