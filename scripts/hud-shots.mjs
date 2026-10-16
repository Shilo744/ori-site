// Dev tool (T47): the HUD in its main situations, for before/after comparisons.
//   node scripts/hud-shots.mjs before|after [--no-build]      → shots/T47-<label>-<what>.png
import { join } from 'node:path';
import { build, serveDist, launchBrowser, newSession, sleep, settle, SHOTS } from './lib/harness.mjs';

const label = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'after';
if (!process.argv.includes('--no-build')) build();
const server = await serveDist();
const { browser } = await launchBrowser();

async function open({ width = 1280, height = 800 } = {}, hours = 13) {
  const s = await newSession(browser, server.origin, { width, height });
  await s.page.goto(`${server.origin}/?fast=1&quiet=1`, { waitUntil: 'domcontentloaded' });
  await s.page.waitForFunction(() => window.__ori && window.__ori.ready, null, { timeout: 60000 });
  await s.page.evaluate((h) => window.__ori.setTime(h), hours);
  await s.page.click('#intro-start');
  await s.page.waitForFunction(() => window.__ori.state === 'ready' || window.__ori.state === 'flat', null, { timeout: 20000 });
  await sleep(1800);
  return s;
}
const shot = async (s, what) => { await settle(s, 3); await s.page.screenshot({ path: join(SHOTS, `T47-${label}-${what}.png`) }); console.log(`T47-${label}-${what}.png`); };
const view = async (s, v, ms = 1700) => { await s.page.evaluate((n) => window.__ori.setView(n), v); await sleep(ms); };

try {
  let s = await open();
  await shot(s, 'overview');
  await view(s, 'desk');
  await shot(s, 'desk');
  await view(s, 'window');
  await shot(s, 'window');
  // a hover tag + the discovery counter popping
  await view(s, 'overview', 900);
  const p = await s.page.evaluate(() => window.__ori.interactions.screenPos('lamp'));
  if (p && p.visible) { await s.page.mouse.move(p.x - 3, p.y); await s.page.mouse.move(p.x, p.y); await sleep(500); await shot(s, 'hover'); }
  // a toast (rare achievement) on top of the room
  await s.page.evaluate(() => document.getElementById('toasts').classList.remove('quiet'));
  await s.page.evaluate(() => window.__ori.core.notifications.notify({ app: 'Arcade', title: 'Night owl', body: 'You stayed up past midnight', level: 'urgent', onClick: () => {} }));
  await sleep(700);
  await shot(s, 'toast');
  await s.context.close();
  // night
  s = await open({}, 23);
  await shot(s, 'night');
  await view(s, 'desk');
  await shot(s, 'night-desk');
  await s.context.close();
  // phone
  s = await open({ width: 390, height: 844 });
  await shot(s, 'mobile');
  await s.context.close();
  s = await open({ width: 390, height: 844 }, 23);
  await shot(s, 'mobile-night');
  await s.context.close();
} finally { await browser.close(); await server.close(); }
