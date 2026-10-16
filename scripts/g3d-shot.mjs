// Dev tool: screenshots of NEON DRIFT from the GPU harness.
//   node scripts/g3d-shot.mjs --biome=city --steps=900,2400 --name=T42-city [--look=night] [--tier=high] [--car=gt|hatch|hyper] [--paint=0xff2d6f] [--hero=2.45,6.2,1.5] [--size=1280x800] [--no-build]
import { join } from 'node:path';
import { build, serveDist, launchBrowser, newSession, loadSite, parseSize, sleep, settle, SHOTS } from './lib/harness.mjs';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const size = parseSize(args.size) || { width: 1280, height: 800 };
const steps = String(args.steps || '900').split(',').map(Number);
const at = args.at ? String(args.at).split(',').map(Number) : null; // arc lengths to teleport to instead of driving
const name = args.name || `g3d-${args.biome || 'city'}`;
if (!args['no-build']) build();
const server = await serveDist();
const { browser } = await launchBrowser();
try {
  const s = await newSession(browser, server.origin, size);
  await loadSite(s, server.origin);
  const { page } = s;
  const opts = { quick: !args.menu, biome: args.biome || 'city', look: args.look, tier: args.tier, seed: args.seed ? +args.seed : undefined, carType: args.car, paint: args.paint ? Number(args.paint) : undefined };
  await page.evaluate((o) => window.__ori.game3d.launch('drift', o), opts);
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state(), null, { timeout: 30000 });
  await page.evaluate(() => window.__ori.game3d.autopilot(true));
  for (let i = 0; i < (at ? at.length : steps.length); i++) {
    if (at) await page.evaluate(([s, v]) => { window.__ori.game3d.teleport(s, v); window.__ori.game3d.step(30); }, [at[i], +(args.speed || 62)]);
    else await page.evaluate((k) => window.__ori.game3d.step(k), steps[i] - (i ? steps[i - 1] : 0));
    if (args.hero) { const [angle, dist, height] = String(args.hero).split(',').map(Number); await page.evaluate((o) => window.__ori.game3d.camera(2, o), { angle, dist, height }); }
    await sleep(250);
    await settle(s, 3);
    const count = at ? at.length : steps.length;
    const file = join(SHOTS, `${name}${count > 1 ? `-${i + 1}` : ''}.png`);
    await page.screenshot({ path: file });
    const st = await page.evaluate(() => ({ stats: window.__ori.game3d.stats(), state: window.__ori.game3d.state() }));
    console.log(file.replace(/.*shots./, 'shots/'), `${st.state.speedKmh} km/h s=${st.state.s} | ${st.stats.calls} calls ${(st.stats.triangles / 1000).toFixed(0)}k tris ${st.stats.fps} fps | ${st.state.biome}/${st.state.look}`);
  }
  s.errors.forEach((e) => console.log('ERR', e.kind, e.text.slice(0, 300)));
} finally {
  await browser.close();
  await server.close();
}
