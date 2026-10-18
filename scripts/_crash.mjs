import { join } from 'node:path';
import { build, serveDist, launchBrowser, newSession, loadSite, sleep, settle, SHOTS } from './lib/harness.mjs';
build();
const server = await serveDist();
const { browser } = await launchBrowser();
try {
  const s = await newSession(browser, server.origin, { width: 1100, height: 700 });
  await loadSite(s, server.origin);
  const { page } = s;
  await page.evaluate(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  const cars = await page.evaluate(() => { const g = window.__ori.game3d.game; const m = g.map.props.find((p) => p.mine); return g.map.props.filter((p) => p.type === 'car' && !p.mine && Math.abs(p.z - m.z) < 1 && p.x > m.x).sort((a, b) => a.x - b.x).slice(0, 2).map((p) => [Math.round(p.x), Math.round(p.z)]); });
  console.log('parked cars ahead', JSON.stringify(cars));
  await page.evaluate(() => { const m = window.__ori.game3d.game.map.props.find((p) => p.mine); window.__ori.game3d.game.teleport({ x: m.x, z: m.z + 3.4 }, 0); });
  await sleep(600);
  await page.keyboard.press('KeyF'); await sleep(300);
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
  for (let i = 0; i < 5; i++) { await sleep(500); const st = await page.evaluate(() => { const g = window.__ori.game3d.game; return { car: g.state().car && Math.round(g.state().car.x) + ',' + Math.round(g.state().car.speed), moved: g.map.props.filter((p) => p.body).map((p) => Math.round(p.x) + ',' + Math.round(p.z)) }; }); console.log(JSON.stringify(st)); if (i === 1) await page.screenshot({ path: join(SHOTS, '_crash.png') }); }
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  await sleep(1500);
  console.log('after', await page.evaluate(() => window.__ori.game3d.game.map.props.filter((p) => p.body).map((p) => Math.round(p.x) + ',' + Math.round(p.z) + ' speedless')));
  s.errors.forEach((e) => console.log('ERR', e.kind, e.text.slice(0, 300)));
} finally { await browser.close(); await server.close(); }
