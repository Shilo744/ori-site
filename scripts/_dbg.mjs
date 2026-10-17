import { serveDist, launchBrowser, newSession, loadSite, sleep } from './lib/harness.mjs';
const server = await serveDist();
const { browser } = await launchBrowser();
try {
  const s = await newSession(browser, server.origin, { width: 1280, height: 800 });
  await loadSite(s, server.origin);
  const { page } = s;
  await page.evaluate(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await sleep(3000);
  await page.keyboard.press('Tab');
  await sleep(1500);
  const r = await page.evaluate(() => new Promise((res) => {
    const el = document.querySelector('.fv-tasks');
    let n = 0; const log = [];
    const mo = new MutationObserver(() => { n++; if (log.length < 8) log.push(Math.round(performance.now()) + ':' + (window.__ori.game3d.state().player.speed.toFixed(2)) + ':' + window.__ori.game3d.state().clock.label); });
    mo.observe(el, { childList: true, subtree: true });
    setTimeout(() => { mo.disconnect(); res({ n, log, st: window.__ori.game3d.state().player }); }, 4000);
  }));
  console.log(JSON.stringify(r));
} finally { await browser.close(); await server.close(); }
