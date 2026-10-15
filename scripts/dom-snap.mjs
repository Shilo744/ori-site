// Regression aid for refactors: records the normalised DOM of the macOS desktop (every app window, dock, menus,
// Spotlight, terminal output) into shots/dom/<label>/*.html so two runs can be diffed.
//   npm run dom-snap -- before     (on the old code)   ...refactor...   npm run dom-snap -- after
//   then:  git diff --no-index --stat shots/dom/before shots/dom/after
import { join } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { SHOTS, build, serveDist, launchBrowser, newSession, loadSite, enterScreen, sleep } from './lib/harness.mjs';

const label = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'snap';
const out = join(SHOTS, 'dom', label);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

build();
const server = await serveDist();
const { browser } = await launchBrowser();
let code = 0;
try {
  const s = await newSession(browser, server.origin, { width: 1280, height: 800 });
  const { page } = s;
  await loadSite(s, server.origin);
  await enterScreen(s);

  // serialises part of the desktop with volatile text (clock, dates) masked and one tag per line
  const grab = (sel) => page.evaluate((q) => {
    const root = window.__ori.desktop.root;
    const el = q === '.mac' ? root : root.querySelector(q);
    if (!el) return `<!-- ${q} not found -->`;
    return el.outerHTML;
  }, sel).then((html) => html
    .replace(/\d{1,2}:\d{2}(:\d{2})?( [AP]M)?/g, '[time]')
    .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d+/g, '[date]')
    .replace(/(January|February|March|April|May|June|July|August|September|October|November|December) \d+, \d{4}/g, '[longdate]')
    .replace(/Last login: [^<]*/g, 'Last login: [date]')
    .replace(/(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)/g, '[WEEKDAY]')
    .replace(/<div class="n" id="wg-date">\d+</g, '<div class="n" id="wg-date">[d]<')
    .replace(/></g, '>\n<'));
  const save = async (name, sel) => writeFile(join(out, `${name}.html`), await grab(sel));
  const click = (sel) => page.evaluate((q) => window.__ori.desktop.root.querySelector(q).click(), sel);

  const apps = await page.evaluate(() => window.__ori.listApps());
  for (const id of apps) {
    await page.evaluate(() => window.__ori.desktop.reset());
    await page.evaluate((a) => window.__ori.openApp(a), id);
    await sleep(500);
    await save(`app-${id}-wins`, '.wins');
    await save(`app-${id}-dock`, '.dock');
    await save(`app-${id}-menubar`, '.mb');
  }

  // aliases
  for (const alias of ['home', 'about', 'experience', 'skills', 'projects', 'contact']) {
    await page.evaluate(() => window.__ori.desktop.reset());
    await page.evaluate((a) => window.__ori.openApp(a), alias);
    await sleep(300);
    await save(`alias-${alias}`, '.wins');
  }

  // menus
  await page.evaluate(() => window.__ori.desktop.reset());
  await page.evaluate(() => { window.__ori.openApp('finder'); window.__ori.openApp('notes'); window.__ori.openApp('terminal'); });
  await sleep(400);
  for (const key of ['apple', 'app', 'file', 'edit', 'view', 'go', 'window', 'help']) {
    await click(`[data-menu="${key}"]`);
    await save(`menu-${key}`, '.menus');
    await click(`[data-menu="${key}"]`);
  }

  // spotlight
  await click('[data-act="spot"]');
  for (const q of ['a', 'about', 'nimbus', 'term', 'zzz']) {
    await page.evaluate((v) => {
      const i = window.__ori.desktop.root.querySelector('.spot input');
      i.value = v;
      i.dispatchEvent(new Event('input', { bubbles: true }));
    }, q);
    await save(`spotlight-${q}`, '.spot');
  }
  await page.keyboard.press('Escape');

  // terminal session
  await page.evaluate(() => window.__ori.desktop.reset());
  await page.evaluate(() => window.__ori.openApp('terminal'));
  await sleep(400);
  for (const cmd of ['help', 'about', 'whoami', 'skills', 'projects', 'experience', 'contact', 'open notes', 'open nope', 'nope', 'sudo', 'clear', 'help']) {
    await page.evaluate((c) => {
      const i = window.__ori.desktop.root.querySelector('.win-terminal input');
      i.value = c;
      i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }, cmd);
  }
  await save('terminal-session', '.win-terminal .term');

  // window controls: minimise / close / focus order
  await page.evaluate(() => window.__ori.desktop.reset());
  await page.evaluate(() => { for (const a of ['finder', 'safari', 'notes']) window.__ori.openApp(a); });
  await sleep(300);
  await click('.win-safari .lights [data-act="min"]');
  await save('after-minimize', '.wins');
  await click('.win-notes .lights [data-act="close"]');
  await sleep(300);
  await save('after-close', '.wins');
  await save('after-close-dock', '.dock');

  console.log(`saved DOM snapshots to ${out}`);
  if (s.errors.length) { code = 1; s.errors.forEach((e) => console.error(`✗ ${e.kind}: ${e.text.split('\n')[0]}`)); }
  await s.context.close();
} catch (e) {
  console.error(e.stack || e);
  code = 1;
} finally {
  await browser.close();
  await server.close();
}
process.exit(code);
