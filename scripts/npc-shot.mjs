// Dev tool (T58): a line-up of generated neighbours (people/specs.js randomSpec) from the GPU harness.
//   node scripts/npc-shot.mjs --name=T58-npcs --seeds=1,2,3,4,5,6,7,8 [--quality=0.5] [--size=1500x520]
import { join } from 'node:path';
import { build, serveDist, launchBrowser, newSession, loadSite, parseSize, sleep, settle, SHOTS } from './lib/harness.mjs';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const size = parseSize(args.size) || { width: 1500, height: 560 };
const name = args.name || 'npcs';
const seeds = String(args.seeds || '1,2,3,4,5,6,7,8').split(',').map(Number);
if (!args['no-build']) build();
const server = await serveDist();
const { browser } = await launchBrowser();
try {
  const s = await newSession(browser, server.origin, size);
  await loadSite(s, server.origin);
  const { page } = s;
  await page.evaluate((o) => window.__ori.game3d.launch('favors', o), { quick: true, tier: args.tier });
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await page.addStyleTag({ content: '#g3d > :not(canvas) { display: none !important; }' });
  const info = await page.evaluate(async ([seeds, q, hour, at]) => {
    const g3 = window.__ori.game3d;
    g3.setHour(hour); g3.teleport(at);
    const t0 = performance.now();
    const n = g3.game.spawnPeople(seeds, { quality: q, spacing: 1.05, ahead: 4.6 });
    const g = g3.game;
    const st = g.controller.state;
    g.ori.group.visible = false;
    const gy = g.ori.group.position.y;
    g3.game.setDebugCamera({ pos: [st.x - Math.sin(st.heading) * 0.4, gy + 1.15, st.z - Math.cos(st.heading) * 0.4], look: [st.x + Math.sin(st.heading) * 4.6, gy + 0.85, st.z + Math.cos(st.heading) * 4.6], fov: 46 });
    return { n, ms: Math.round(performance.now() - t0) };
  }, [seeds, +(args.quality || 0.5), +(args.hour || 13), args.at || 'park']);
  console.log('spawned', JSON.stringify(info));
  await sleep(1200);
  await settle(s, 2);
  const file = join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file });
  const st = await page.evaluate(() => ({ stats: window.__ori.game3d.stats(), fps: window.__ori.game3d.fps }));
  console.log(file.replace(/.*shots./, 'shots/'), `${st.stats.calls} calls ${(st.stats.triangles / 1000).toFixed(0)}k tris ${st.fps} fps`);
  s.errors.forEach((e) => console.log('ERR', e.kind, e.text.slice(0, 400)));
} finally {
  await browser.close();
  await server.close();
}
