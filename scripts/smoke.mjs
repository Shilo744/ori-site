// Smoke test: builds, serves dist/, then walks the whole core flow in a real browser and opens every registered
// app (and game). Exits non-zero on any console error, page error or failed same-origin request.
//   npm run smoke                       default sizes (1280x800 + 390x844 flat mode)
//   npm run smoke -- --sizes=1366x768   custom sizes (comma separated)
//   npm run smoke -- --no-build --headed
import { join } from 'node:path';
import { SHOTS, build, serveDist, launchBrowser, newSession, loadSite, enterScreen, backToRoom, snap, parseSize, sleep } from './lib/harness.mjs';
import { runWmContract } from './lib/wm-contract.mjs';
import { runCoreContract } from './lib/core-contract.mjs';
import { GAME_TESTS } from './lib/games.mjs';
import { runArcade } from './lib/arcade-test.mjs';
import { runLid } from './lib/lid-test.mjs';
import { runWm2 } from './lib/wm2-test.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1] || d;
const sizes = opt('sizes', '1280x800,390x844').split(',').map(parseSize).filter(Boolean);
const outDir = join(SHOTS, 'smoke');

const log = (...a) => console.log(...a);
let failures = 0;
const fail = (msg) => { failures++; console.error(`  ✗ ${msg}`); };
const ok = (msg) => log(`  ✓ ${msg}`);

if (!flag('no-build')) { log('building…'); build(); }
const server = await serveDist();
const { browser, channel, headless } = await launchBrowser({ headed: flag('headed') });
log(`browser: ${channel}${headless ? ' (headless)' : ' (headed)'}  site: ${server.url}`);

try {
  for (const size of sizes) {
    const tag = `${size.width}x${size.height}`;
    log(`\n── ${tag} ──`);
    const s = await newSession(browser, server.origin, size);
    const { page } = s;
    const shot = (name) => snap(s, join(outDir, `${tag}-${name}.png`));

    await loadSite(s, server.origin);
    ok('page loaded, first frame rendered');
    await sleep(300);
    await shot('00-intro');

    const lidBefore = await page.evaluate(() => window.__ori.mac.lidAngle);
    if (lidBefore < 1) ok('the MacBook lid starts shut'); else fail(`the lid should start shut (angle ${lidBefore})`);
    await enterScreen(s);
    const st = await page.evaluate(() => window.__ori.state);
    if (st === (size.width < 860 ? 'flat' : 'screen')) ok(`entered the screen (state: ${st})`); else fail(`unexpected state after entering: ${st}`);
    await sleep(500);
    await shot('01-desktop');

    // every registered app (and game)
    const apps = await page.evaluate(() => window.__ori.listApps());
    log(`  apps: ${apps.join(', ')}`);
    for (const id of apps) {
      await page.evaluate(() => window.__ori.desktop.reset());
      const opened = await page.evaluate((a) => window.__ori.openApp(a), id);
      if (!opened) { fail(`openApp(${id}) returned false`); continue; }
      await sleep(450);
      const winCount = await page.evaluate(() => document.querySelectorAll('.mac .win').length);
      if (winCount < 1) fail(`app ${id}: no window in the DOM`);
      await shot(`app-${id}`);
    }
    ok(`opened ${apps.length} apps`);
    await page.evaluate(() => window.__ori.desktop.reset());

    // window-manager contract (registers a throw-away app, so it runs after the app loop)
    await runWmContract(s, { ok, fail });

    // Arcade launcher (covers, scores, real click / keyboard launch, tabs, terminal commands)
    await runArcade(s, { ok, fail });

    // window manager v2: drag / resize / zoom / snap / minimise to the Dock / geometry memory
    await runWm2(s, { ok, fail });

    // MacBook: lid, key presses, Sleep / Shut Down / Restart
    await runLid(s, { ok, fail });

    // full gameplay checks for every game that has one (slow under software GL, so opt-in: --games)
    if (flag('games')) {
      for (const id of apps) {
        if (GAME_TESTS[id]) { log(`  ── game: ${id}`); await GAME_TESTS[id](s, { ok, fail }); }
      }
    }

    // room camera presets (3D mode only)
    if (size.width >= 860) {
      await page.evaluate(() => window.__ori.desktop.open('home'));
      await sleep(300);
      await backToRoom(s);
      for (const v of ['overview', 'desk', 'window', 'shelf', 'bench', 'plant', 'mac-close', 'iphone', 'ipad']) {
        const accepted = await page.evaluate((n) => window.__ori.setView(n), v);
        if (!accepted) { fail(`setView(${v}) rejected`); continue; }
        await sleep(350);
        await shot(`view-${v}`);
      }
      ok('camera presets rendered');

      // render stats from the overview camera (the whole room in frame), for before/after comparisons
      await page.evaluate(() => window.__ori.setView('overview'));
      await sleep(2500);
      const stats = await page.evaluate(() => window.__ori.stats());
      await page.evaluate(() => window.__ori.setView('free'));
      log(`  stats: ${stats.calls} draw calls · ${stats.triangles} triangles · ${stats.geometries} geometries · ${stats.textures} textures · ~${stats.fps} fps (software GL)`);
    }

    // core services (reloads the page to prove persistence, so it runs last)
    await runCoreContract(s, { ok, fail });

    if (s.warnings.length) log(`  (${s.warnings.length} console warning${s.warnings.length > 1 ? 's' : ''}: ${[...new Set(s.warnings)].slice(0, 3).map((w) => w.slice(0, 90)).join(' | ')})`);
    if (s.errors.length) {
      for (const e of s.errors) fail(`${e.kind}: ${e.text.split('\n')[0]}`);
    } else ok('0 console errors, 0 page errors, 0 failed requests');
    await s.context.close();
  }
} catch (e) {
  fail(`harness error: ${e.stack || e}`);
} finally {
  await browser.close();
  await server.close();
}

log(failures ? `\nSMOKE FAILED (${failures} problem${failures > 1 ? 's' : ''})` : `\nSMOKE OK — screenshots in ${outDir}`);
process.exit(failures ? 1 : 0);
