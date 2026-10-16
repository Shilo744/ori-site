// Dev tool (T57): draws the whole cursor set on a sheet — 1:1 and enlarged, on light and dark — to shots/T57-cursors.png.
//   node scripts/cursor-shots.mjs [--no-build]
import { join } from 'node:path';
import { SHOTS, build, serveDist, launchBrowser, newSession, loadSite } from './lib/harness.mjs';

if (!process.argv.includes('--no-build')) build();
const server = await serveDist();
const { browser } = await launchBrowser();
try {
  const s = await newSession(browser, server.origin, { width: 1000, height: 560 });
  await loadSite(s, server.origin);
  await s.page.evaluate(() => {
    const names = ['arrow', 'hand', 'text', 'grab', 'grabbing', 'ew', 'ns', 'nwse', 'nesw'];
    const urlOf = (n) => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(`--cur-${n}`);
      const m = /url\("(data:image\/svg\+xml,[^"]+)"\)\s*2x/.exec(v);
      return m ? m[1] : '';
    };
    const sheet = document.createElement('div');
    sheet.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;font:600 12px Inter,system-ui,sans-serif;color:#222;display:grid;grid-template-rows:1fr 1fr;';
    const row = (bg, scale, label) => {
      const r = document.createElement('div');
      r.style.cssText = `background:${bg};display:flex;align-items:center;justify-content:space-around;padding:0 16px;color:${bg === '#fff' ? '#222' : '#eee'}`;
      for (const n of names) {
        const cell = document.createElement('div');
        cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px';
        const img = document.createElement('img');
        img.src = urlOf(n);
        img.style.cssText = `image-rendering:auto;width:${img.width ? '' : ''}`;
        img.onload = () => { img.style.width = `${(img.naturalWidth / 2) * scale}px`; };
        const t = document.createElement('span');
        t.textContent = n;
        cell.append(img, t);
        r.append(cell);
      }
      const l = document.createElement('div');
      l.textContent = label;
      l.style.cssText = 'position:absolute;left:12px;margin-top:-6px;font-weight:500;opacity:.6';
      r.prepend(l);
      return r;
    };
    sheet.append(row('#fff', 4, 'x4 on white'), row('#2b2f3a', 4, 'x4 on dark'));
    document.body.append(sheet);
  });
  await new Promise((r) => setTimeout(r, 600));
  await s.page.screenshot({ path: join(SHOTS, 'T57-cursors.png') });
  console.log('shots/T57-cursors.png');
  await s.context.close();
} finally {
  await browser.close();
  await server.close();
}
