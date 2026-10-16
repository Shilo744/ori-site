// The opening screen on its own (T46):  npm run test:intro [-- --size=390x844] [--no-build]
import { build, serveDist, launchBrowser, newSession, loadSite, parseSize } from './lib/harness.mjs';
import { runIntro } from './lib/intro-test.mjs';
const args = process.argv.slice(2);
const size = parseSize((args.find((a) => a.startsWith('--size=')) || '').split('=')[1]) || { width: 1280, height: 800 };
let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { failures++; console.error(`  ✗ ${m}`); };
if (!args.includes('--no-build')) build();
const server = await serveDist();
const { browser } = await launchBrowser();
try {
  const s = await newSession(browser, server.origin, size);
  await loadSite(s, server.origin);
  await runIntro(s, { ok, fail });
  s.errors.forEach((e) => fail(`${e.kind}: ${e.text.split('\n')[0]}`));
} catch (e) { fail(`harness error: ${e.stack || e}`); } finally { await browser.close(); await server.close(); }
console.log(failures ? `\nINTRO FAILED (${failures})` : '\nINTRO OK');
process.exit(failures ? 1 : 0);
