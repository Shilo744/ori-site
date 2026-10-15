// Runs the end-to-end check of ONE game in a real browser:  npm run test:game -- snake  [--size=1280x800] [--no-build] [--headed]
import { build, serveDist, launchBrowser, newSession, loadSite, enterScreen, parseSize } from './lib/harness.mjs';
import { GAME_TESTS } from './lib/games.mjs';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const flag = (n) => args.includes(`--${n}`);
const size = parseSize((args.find((a) => a.startsWith('--size=')) || '').split('=')[1]) || { width: 1280, height: 800 };
if (!id || !GAME_TESTS[id]) {
  console.error(`usage: npm run test:game -- <${Object.keys(GAME_TESTS).join('|')}>`);
  process.exit(2);
}

let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { failures++; console.error(`  ✗ ${m}`); };

if (!flag('no-build')) build();
const server = await serveDist();
const { browser } = await launchBrowser({ headed: flag('headed') });
try {
  const s = await newSession(browser, server.origin, size);
  await loadSite(s, server.origin);
  await enterScreen(s);
  await GAME_TESTS[id](s, { ok, fail });
  s.errors.forEach((e) => fail(`${e.kind}: ${e.text.split('\n')[0]}`));
  await s.context.close();
} catch (e) {
  fail(`harness error: ${e.stack || e}`);
} finally {
  await browser.close();
  await server.close();
}
console.log(failures ? `\n${id.toUpperCase()} FAILED (${failures})` : `\n${id.toUpperCase()} OK`);
process.exit(failures ? 1 : 0);
