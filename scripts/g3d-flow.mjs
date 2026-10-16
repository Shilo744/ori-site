// Dev tool: walks the whole NEON DRIFT flow on the GPU harness and takes the T43 screenshots (menu, garage, flyover, grid, race, results).
//   node scripts/g3d-flow.mjs [--biome=city] [--mode=race|trial] [--difficulty=normal] [--prefix=T43] [--no-build] [--size=1280x800]
import { join } from 'node:path';
import { build, serveDist, launchBrowser, newSession, loadSite, parseSize, sleep, settle, SHOTS } from './lib/harness.mjs';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const size = parseSize(args.size) || { width: 1280, height: 800 };
const prefix = args.prefix || 'T43';
if (!args['no-build']) build();
const server = await serveDist();
const { browser } = await launchBrowser();
try {
  const s = await newSession(browser, server.origin, size);
  await loadSite(s, server.origin);
  const { page } = s;
  const shot = async (name) => { await sleep(300); await settle(s, 3); const f = join(SHOTS, `${prefix}-${name}.png`); await page.screenshot({ path: f }); console.log('shot', name); };
  const state = () => page.evaluate(() => window.__ori.game3d.state());
  const phase = () => page.evaluate(() => window.__ori.game3d.game?.phase);
  const waitPhase = (p, t = 30000) => page.waitForFunction((q) => window.__ori.game3d.game?.phase === q, p, { timeout: t });

  await page.evaluate(() => window.__ori.storage?.clear?.());
  await page.evaluate((o) => window.__ori.game3d.launch('drift', o), {});
  await waitPhase('menu', 60000);
  if (args.biome || args.mode || args.difficulty) {
    await page.evaluate((o) => window.__ori.game3d.game.setPrefs(o), { ...(args.biome ? { biome: args.biome } : {}), ...(args.mode ? { mode: args.mode } : {}), ...(args.difficulty ? { difficulty: args.difficulty } : {}) });
    await page.evaluate(() => window.__ori.game3d.reconfigure({}));
    await waitPhase('menu');
  }
  await shot('menu');
  await page.click('[data-act="car:hyper"]');
  await page.click('[data-act="paint:1"]');
  await sleep(500);
  await shot('garage');
  await page.keyboard.press('Enter');
  await waitPhase('intro');
  await sleep(1400);
  await shot('flyover');
  await page.keyboard.press('Space');
  await waitPhase('countdown');
  await sleep(900);
  await shot('grid');
  await waitPhase('racing', 10000);
  await page.evaluate(() => window.__ori.game3d.autopilot(true));
  await sleep(2500);
  await page.evaluate(() => window.__ori.game3d.step(120 * 14));
  await shot('race');
  await page.evaluate(() => window.__ori.game3d.step(120 * 60));
  await shot('race2');
  // finish the race quickly
  for (let i = 0; i < 40 && (await phase()) === 'racing'; i++) await page.evaluate(() => window.__ori.game3d.step(120 * 10));
  console.log('state', JSON.stringify(await state()));
  await page.waitForFunction(() => window.__ori.game3d.game?.phase === 'results', null, { timeout: 15000 });
  await sleep(800);
  await shot('results');
  s.errors.forEach((e) => console.log('ERR', e.kind, e.text.slice(0, 300)));
} finally {
  await browser.close();
  await server.close();
}
