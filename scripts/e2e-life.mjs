// Runs the ambient-life browser checks alone (no full smoke):  npm run test:life [-- --size=1280x800] [--no-build]
import { build, serveDist, launchBrowser, newSession, loadSite, enterScreen, backToRoom, parseSize } from './lib/harness.mjs';
import { runLife } from './lib/life-test.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const size = parseSize((args.find((a) => a.startsWith('--size=')) || '').split('=')[1]) || { width: 1280, height: 800 };
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
  if (size.width >= 860) await backToRoom(s);
  await runLife(s, { ok, fail });
  s.errors.forEach((e) => fail(`${e.kind}: ${e.text.split('\n')[0]}`));
  await s.context.close();
} catch (e) {
  fail(`harness error: ${e.stack || e}`);
} finally {
  await browser.close();
  await server.close();
}
console.log(failures ? `\nLIFE FAILED (${failures})` : '\nLIFE OK');
process.exit(failures ? 1 : 0);
