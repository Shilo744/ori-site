// Runs ONE browser check block of the smoke suite on its own:  npm run test:life | test:daylight | test:interact | test:settings | wm2   (or  node scripts/e2e-block.mjs <life|daylight|wm2|interact|settings> [--size=WxH] [--no-build])
import { build, serveDist, launchBrowser, newSession, loadSite, enterScreen, backToRoom, parseSize } from './lib/harness.mjs';
import { runLife } from './lib/life-test.mjs';
import { runDaylight } from './lib/daylight-test.mjs';
import { runWm2 } from './lib/wm2-test.mjs';
import { runInteract } from './lib/interact-test.mjs';
import { runSettings, runSettingsReload } from './lib/settings-test.mjs';

const BLOCKS = { life: runLife, daylight: runDaylight, wm2: runWm2, interact: runInteract, settings: async (s, h) => { await runSettings(s, h); await runSettingsReload(s, h); } };
const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--'));
const flag = (n) => args.includes(`--${n}`);
const size = parseSize((args.find((a) => a.startsWith('--size=')) || '').split('=')[1]) || { width: 1280, height: 800 };
if (!name || !BLOCKS[name]) {
  console.error(`usage: node scripts/e2e-block.mjs <${Object.keys(BLOCKS).join('|')}> [--size=1280x800] [--no-build]`);
  process.exit(2);
}
let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { failures++; console.error(`  ✗ ${m}`); };

if (!flag('no-build')) build();
const server = await serveDist();
const { browser } = await launchBrowser();
try {
  const s = await newSession(browser, server.origin, size);
  await loadSite(s, server.origin);
  await enterScreen(s);
  if (size.width >= 860 && name !== 'wm2' && name !== 'settings') await backToRoom(s); // wm2 works on the screen itself
  await BLOCKS[name](s, { ok, fail });
  s.errors.forEach((e) => fail(`${e.kind}: ${e.text.split('\n')[0]}`));
  await s.context.close();
} catch (e) {
  fail(`harness error: ${e.stack || e}`);
} finally {
  await browser.close();
  await server.close();
}
console.log(failures ? `\n${name.toUpperCase()} FAILED (${failures})` : `\n${name.toUpperCase()} OK`);
process.exit(failures ? 1 : 0);
