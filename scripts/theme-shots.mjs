// Light + dark screenshots of the built-in apps in ONE browser session:  npm run theme-shots [-- --apps=finder,safari --time=13 --no-build]
// → shots/T11-<app>-light.png / -dark.png
import { join } from 'node:path';
import { SHOTS, build, serveDist, launchBrowser, newSession, loadSite, enterScreen, snap, sleep } from './lib/harness.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=') || d;
const apps = opt('apps', 'finder,safari,notes,mail,terminal,settings,arcade,welcome').split(',');
const time = opt('time', '13');
if (!args.includes('--no-build')) build();
const server = await serveDist();
const { browser } = await launchBrowser();
let code = 0;
try {
  const s = await newSession(browser, server.origin, { width: 1280, height: 800 });
  await loadSite(s, server.origin);
  await enterScreen(s);
  await s.page.evaluate((h) => window.__ori.setTime(+h), time);
  for (const mode of ['light', 'dark']) {
    await s.page.evaluate((m) => window.__ori.core.theme.setAppearance(m), mode);
    for (const id of apps) {
      await s.page.evaluate(() => window.__ori.desktop.reset());
      await s.page.evaluate((a) => window.__ori.openApp(a), id);
      await sleep(500);
      await snap(s, join(SHOTS, `T11-${id}-${mode}.png`));
      console.log(`saved T11-${id}-${mode}.png`);
    }
  }
  await s.page.evaluate(() => window.__ori.core.theme.setAppearance('light'));
  if (s.errors.length) { code = 1; s.errors.forEach((e) => console.error(`✗ ${e.kind}: ${e.text.split('\n')[0]}`)); }
  await s.context.close();
} catch (e) { console.error(e.message || e); code = 1; } finally { await browser.close(); await server.close(); }
process.exit(code);
