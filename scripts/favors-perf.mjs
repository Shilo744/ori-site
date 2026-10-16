// Dev tool (T51): frame times of "Ori, Can You...?" while Ori sprints round the neighbourhood (real keys, GPU harness).
//   node scripts/favors-perf.mjs [--tier=high|medium|low] [--seconds=8] [--size=1280x800] [--no-build]
import { build, serveDist, launchBrowser, newSession, loadSite, parseSize, sleep } from './lib/harness.mjs';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const size = parseSize(args.size) || { width: 1280, height: 800 };
const secs = +(args.seconds || 8);
if (!args['no-build']) build();
const server = await serveDist();
const { browser } = await launchBrowser();
try {
  const s = await newSession(browser, server.origin, size);
  await loadSite(s, server.origin);
  const { page } = s;
  await page.evaluate((o) => window.__ori.game3d.launch('favors', o), { quick: true, tier: args.tier });
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await page.evaluate(() => window.__ori.game3d.teleport({ x: -62, z: 5 }, Math.PI / 2));
  await sleep(1500);
  await page.evaluate(() => { window.__frames = []; let last = performance.now(); const tick = (n) => { window.__frames.push(n - last); last = n; if (window.__frames.length < 4000) window.__raf = requestAnimationFrame(tick); }; window.__raf = requestAnimationFrame(tick); });
  await page.keyboard.down('ShiftLeft');
  const keys = ['KeyW', 'KeyD', 'KeyW', 'KeyA'];
  for (let t = 0; t < secs; t++) {
    const k = keys[t % keys.length];
    await page.keyboard.down(k);
    await sleep(1000);
    await page.keyboard.up(k);
  }
  await page.keyboard.up('ShiftLeft');
  const r = await page.evaluate(() => {
    cancelAnimationFrame(window.__raf);
    const f = window.__frames.slice(5).sort((a, b) => a - b);
    const avg = f.reduce((a, b) => a + b, 0) / f.length;
    return { n: f.length, avgMs: avg, fps: 1000 / avg, p95: f[Math.floor(f.length * 0.95)], p99: f[Math.floor(f.length * 0.99)], max: f[f.length - 1], stats: window.__ori.game3d.stats(), state: window.__ori.game3d.state() };
  });
  console.log(`tier ${args.tier || 'high'} ${size.width}x${size.height}: ${r.fps.toFixed(0)} fps avg (${r.avgMs.toFixed(2)} ms), p95 ${r.p95.toFixed(1)} ms, p99 ${r.p99.toFixed(1)} ms, worst ${r.max.toFixed(1)} ms | ${r.stats.calls} calls ${(r.stats.triangles / 1000).toFixed(0)}k tris | walked to ${r.state.player.x.toFixed(0)},${r.state.player.z.toFixed(0)}`);
  s.errors.forEach((e) => console.log('ERR', e.kind, e.text.slice(0, 300)));
} finally {
  await browser.close();
  await server.close();
}
