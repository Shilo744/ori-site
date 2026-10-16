// Prints render stats (draw calls / triangles / geometries / textures) from the overview camera:  npm run stats [-- --time=13] [--no-build]
import { build, serveDist, launchBrowser, newSession, loadSite, enterScreen, backToRoom, settle } from './lib/harness.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const time = (args.find((a) => a.startsWith('--time=')) || '').split('=')[1];

if (!flag('no-build')) build();
const server = await serveDist();
const { browser } = await launchBrowser();
try {
  const s = await newSession(browser, server.origin, { width: 1280, height: 800 });
  await loadSite(s, server.origin);
  await enterScreen(s);
  await backToRoom(s);
  if (time) await s.page.evaluate((h) => window.__ori.setTime(+h), time);
  await s.page.evaluate(() => window.__ori.setView('overview'));
  await settle(s, 3);
  const st = await s.page.evaluate(() => window.__ori.stats());
  console.log(JSON.stringify(st));
  if (s.errors.length) { s.errors.forEach((e) => console.error(`✗ ${e.kind}: ${e.text.split('\n')[0]}`)); process.exitCode = 1; }
} finally {
  await browser.close();
  await server.close();
}
