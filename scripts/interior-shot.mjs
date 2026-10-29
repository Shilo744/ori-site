// Dev tool (T62): a screenshot from inside a building.   node scripts/interior-shot.mjs --place=mum --name=T62-mum-flat [--hour=13] [--walk=x,z] [--yaw=] [--dist=] [--size=1600x900] [--no-build]
import { build, serveDist, launchBrowser, newSession, loadSite, parseSize, sleep, settle, SHOTS } from './lib/harness.mjs';
import { join } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const size = parseSize(args.size) || { width: 1600, height: 900 };
if (!args['no-build']) build();
const server = await serveDist();
const { browser } = await launchBrowser();
try {
  const s = await newSession(browser, server.origin, size);
  await loadSite(s, server.origin);
  const { page } = s;
  await page.evaluate(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 90000 });
  const places = String(args.place || 'mum').split(',');
  for (const pl of places) {
    await page.evaluate(([pl, hour]) => { const g = window.__ori.game3d; g.setHour(hour); g.teleport(pl); }, [pl, +(args.hour || 13)]);
    await sleep(500);
    console.log('enter', pl, await page.evaluate((p) => window.__ori.game3d.enter(p), pl));
    await sleep(1800);
    if (args.walk) { // teleport inside: world coords relative to the room origin
      const info = await page.evaluate(() => window.__ori.game3d.insideInfo());
      const [dx, dz] = String(args.walk).split(',').map(Number);
      await page.evaluate(([x, z]) => window.__ori.game3d.teleport({ x, z }), [info.exit.x + dx, info.exit.z + dz]);
      await sleep(900);
    }
    if (args.click) await page.addStyleTag({ content: '' });
    await settle(s, 2);
    const out = join(SHOTS, `${places.length > 1 ? `${args.name || 'T62'}-${pl}` : args.name || `T62-${pl}`}.png`);
    await page.screenshot({ path: out });
    const st = await page.evaluate(() => ({ stats: window.__ori.game3d.stats(), fps: window.__ori.game3d.fps }));
    console.log('wrote', out, `${st.stats.calls} calls ${(st.stats.triangles / 1000).toFixed(0)}k tris, ${st.fps} fps`);
    await page.evaluate(() => window.__ori.game3d.leave());
    await sleep(500);
  }
  s.errors.forEach((e) => console.log('ERR', e.kind, e.text.slice(0, 300)));
} finally { await browser.close(); await server.close(); }
