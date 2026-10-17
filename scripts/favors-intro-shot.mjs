// Dev tool (T58): frames of the 4-second fly-in at the start of "Ori, Can You...?" (a contact sheet).
//   node scripts/favors-intro-shot.mjs --name=T58-intro [--no-build]
import { join } from 'node:path';
import { build, serveDist, launchBrowser, newSession, loadSite, sleep, SHOTS } from './lib/harness.mjs';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
if (!args['no-build']) build();
const server = await serveDist();
const { browser } = await launchBrowser();
try {
  const s = await newSession(browser, server.origin, { width: 960, height: 600 });
  await loadSite(s, server.origin);
  const { page } = s;
  await page.evaluate(() => window.__ori.game3d.launch('favors', {}));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  const shots = [];
  const times = [150, 900, 900, 900, 900, 1200];
  for (const ms of times) { await sleep(ms); shots.push(await page.screenshot()); }
  const page2 = await s.context.newPage();
  const tile = 480;
  await page2.setViewportSize({ width: tile * 3 + 24, height: Math.ceil((tile * 0.625 + 6) * 2) + 12 });
  await page2.setContent(`<body style="margin:0;background:#101418"><div style="display:grid;grid-template-columns:repeat(3,${tile}px);gap:6px;padding:6px">${shots.map((b) => `<img style="width:${tile}px;display:block;border-radius:8px" src="data:image/png;base64,${b.toString('base64')}">`).join('')}</div></body>`);
  await sleep(300);
  const file = join(SHOTS, `${args.name || 'T58-intro'}.png`);
  await page2.screenshot({ path: file });
  console.log(file.replace(/.*shots./, 'shots/'));
  s.errors.forEach((e) => console.log('ERR', e.kind, e.text.slice(0, 400)));
} finally {
  await browser.close();
  await server.close();
}
