// Dev tool: CPU cost of the page's rAF callbacks while the camera is on the laptop screen (T49 before/after), with and without pointer movement.
import { serveDist, launchBrowser, newSession, loadSite, enterScreen, sleep } from './lib/harness.mjs';
const server = await serveDist();
const { browser } = await launchBrowser();
try {
  const s = await newSession(browser, server.origin, { width: 1280, height: 800 });
  await loadSite(s, server.origin);
  await enterScreen(s);
  const p = s.page;
  await sleep(1500);
  await p.evaluate(() => {
    window.__t = { n: 0, ms: 0, long: 0 };
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((t) => { const a = performance.now(); cb(t); const d = performance.now() - a; window.__t.n++; window.__t.ms += d; if (d > 8) window.__t.long++; });
  });
  const sample = async (label, move) => {
    await p.evaluate(() => { window.__t.n = 0; window.__t.ms = 0; window.__t.long = 0; });
    const t0 = Date.now();
    while (Date.now() - t0 < 3000) { if (move) { const a = (Date.now() - t0) / 300; await p.mouse.move(640 + Math.cos(a) * 200, 400 + Math.sin(a) * 140); } else await sleep(100); }
    const r = await p.evaluate(() => ({ ...window.__t, fps: window.__ori.stats().fps }));
    console.log(label.padEnd(18), `${(r.n / 3).toFixed(0)} rAF/s, avg ${(r.ms / Math.max(1, r.n)).toFixed(2)} ms/callback, ${r.long} callbacks > 8 ms, page fps ${r.fps}`);
  };
  await sample('still', false);
  await sample('pointer moving', true);
} finally { await browser.close(); await server.close(); }
