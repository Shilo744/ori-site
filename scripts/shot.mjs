// Takes one screenshot into shots/.
//   npm run shot -- overview                     room camera preset (overview|desk|window|shelf|bench|plant|mac-close|iphone|ipad)
//   npm run shot -- app:terminal T17-neofetch    an app window (or `game:<id>`), second arg = file name (no extension)
//   options: --size=1280x800  --time=18.5  --wait=800  --no-build  --headed  --keys="ArrowUp,Space"  --eval="js"  --post="js"
import { join } from 'node:path';
import { SHOTS, build, serveDist, launchBrowser, newSession, loadSite, enterScreen, backToRoom, snap, parseSize, sleep } from './lib/harness.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=') || d;
const pos = args.filter((a) => !a.startsWith('--'));
const target = pos[0];
if (!target) {
  console.error('usage: npm run shot -- <view | app:<id> | game:<id>> [name] [--size=1280x800] [--time=H] [--wait=ms] [--keys=a,b] [--no-build] [--headed]');
  process.exit(2);
}
const size = parseSize(opt('size', '1280x800')) || { width: 1280, height: 800 };
const safe = (s) => s.replace(/[^a-z0-9._-]+/gi, '-');
const name = safe(pos[1] || (target === 'all' ? 'views' : target.replace(':', '-')));
const file = join(SHOTS, `${name}.png`);

if (!flag('no-build')) build();
const server = await serveDist();
const { browser } = await launchBrowser({ headed: flag('headed') });
let code = 0;
try {
  const s = await newSession(browser, server.origin, size);
  const { page } = s;
  await loadSite(s, server.origin);
  await enterScreen(s);

  const time = opt('time', '');
  if (time !== '') await page.evaluate((h) => window.__ori.setTime(+h), time);
  // --eval="js" (repeatable): run page code first, e.g. seed scores: --eval="__ori.core.storage.set('scores:snake',{best:31,plays:4,last:Date.now(),runs:[]})"
  for (const code of args.filter((a) => a.startsWith('--eval=')).map((a) => a.slice(7))) await page.evaluate(code);

  const [kind, id] = target.split(':');
  // several room views in one browser session: `npm run shot -- all T12-before` (all presets) or `-- desk,shelf,plant name` → shots/<name>-<view>.png
  const ALL = ['overview', 'desk', 'window', 'shelf', 'bench', 'plant', 'mac-close', 'mac-keys', 'iphone', 'ipad'];
  const list = target === 'all' ? ALL : target.includes(',') ? target.split(',') : null;
  if (list) {
    if (size.width >= 860) await backToRoom(s);
    for (const v of list) {
      if (!(await page.evaluate((n) => window.__ori.setView(n), v))) throw new Error(`unknown view "${v}"`);
      await sleep(+opt('wait', 600));
      await snap(s, join(SHOTS, `${name}-${v}.png`));
      console.log(`saved ${name}-${v}.png`);
    }
    if (s.errors.length) { code = 1; s.errors.forEach((e) => console.error(`✗ ${e.kind}: ${e.text.split('\n')[0]}`)); }
    await s.context.close();
    await browser.close();
    await server.close();
    process.exit(code);
  }
  if (kind === 'app' || kind === 'game') {
    await page.evaluate(() => window.__ori.desktop.reset());
    const okOpen = await page.evaluate((a) => window.__ori.openApp(a), id);
    if (!okOpen) throw new Error(`unknown app/game "${id}". Registered: ${(await page.evaluate(() => window.__ori.listApps())).join(', ')}`);
  } else {
    if (size.width >= 860) await backToRoom(s);
    const accepted = await page.evaluate((n) => window.__ori.setView(n), target);
    if (!accepted) throw new Error(`unknown view "${target}"`);
  }
  for (const k of opt('keys', '').split(',').filter(Boolean)) { await page.keyboard.press(k); await sleep(120); }
  // --post="js" (repeatable): run page code AFTER the app is open and the keys were pressed (e.g. load a board into a game)
  for (const code of args.filter((x) => x.startsWith('--post=')).map((x) => x.slice(7))) await page.evaluate(code);
  await sleep(+opt('wait', kind === 'game' ? 900 : 600));
  await snap(s, file);
  console.log(`saved ${file}`);
  if (s.errors.length) {
    code = 1;
    for (const e of s.errors) console.error(`✗ ${e.kind}: ${e.text.split('\n')[0]}`);
  }
  await s.context.close();
} catch (e) {
  console.error(e.message || e);
  code = 1;
} finally {
  await browser.close();
  await server.close();
}
process.exit(code);
