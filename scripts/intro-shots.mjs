// Dev tool: the T46 screenshots + the fps while the veil is up.   node scripts/intro-shots.mjs [--no-build]
import { join } from 'node:path';
import { build, serveDist, launchBrowser, newSession, sleep, settle, SHOTS } from './lib/harness.mjs';
const args = new Set(process.argv.slice(2));
if (!args.has('--no-build')) build();
const server = await serveDist();
const { browser } = await launchBrowser();
async function shot(name, { size = { width: 1280, height: 800 }, hours = 13, fast = false, wait = 0, press = false, cycleSteps = 0, reduced = false } = {}) {
  const s = await newSession(browser, server.origin, size);
  if (reduced) await s.page.emulateMedia({ reducedMotion: 'reduce' });
  await s.page.goto(`${server.origin}/${fast ? '?fast=1&quiet=1' : '?quiet=1'}`, { waitUntil: 'domcontentloaded' });
  await s.page.waitForFunction(() => window.__ori && window.__ori.ready, null, { timeout: 60000 });
  await s.page.evaluate((h) => window.__ori.setTime(h), hours);
  await sleep(wait);
  if (cycleSteps) { /* nothing: the real cycle plays */ }
  await settle(s, 3);
  if (press) { await s.page.click('#intro-start'); await sleep(press); }
  await s.page.screenshot({ path: join(SHOTS, name) });
  const info = await s.page.evaluate(() => ({ fps: window.__ori.stats().fps, greet: document.getElementById('intro-greet')?.textContent, btn: !document.getElementById('intro-start')?.hidden }));
  console.log(name.padEnd(28), JSON.stringify(info));
  s.errors.forEach((e) => console.log('ERR', e.kind, e.text.slice(0, 200)));
  await s.context.close();
}
try {
  await shot('T46-intro-greeting.png', { wait: 3300 });
  await shot('T46-intro-light.png', { wait: 11500, hours: 13 });
  await shot('T46-intro-dark.png', { wait: 11500, hours: 23 });
  await shot('T46-intro-mobile.png', { wait: 11500, size: { width: 390, height: 844 } });
  await shot('T46-transition.png', { wait: 11500, press: 450 });
} finally { await browser.close(); await server.close(); }
