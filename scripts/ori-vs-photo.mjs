// Dev tool (T58): the render of Ori next to the private reference selfie (.duo/assets/ori-selfie.jpg, git-ignored; the output stays in shots/, also ignored).
//   node scripts/ori-vs-photo.mjs shots/render.png shots/T58-ori-vs-photo.png
import { readFileSync } from 'node:fs';
import { launchBrowser } from './lib/harness.mjs';
const [render, out] = [process.argv[2], process.argv[3] || 'shots/T58-ori-vs-photo.png'];
const a = readFileSync(render).toString('base64');
const b = readFileSync('.duo/assets/ori-selfie.jpg').toString('base64');
const { browser } = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 820 } })).newPage();
  await page.setContent(`<body style="margin:0;background:#12161c;display:flex;gap:10px;padding:10px;align-items:flex-start;font:600 18px system-ui;color:#fff">
    <div><div style="margin:0 0 6px 4px">the game</div><img style="height:780px;border-radius:12px;display:block" src="data:image/png;base64,${a}"></div>
    <div><div style="margin:0 0 6px 4px">the reference (private)</div><div style="width:430px;height:780px;overflow:hidden;border-radius:12px"><img style="width:880px;margin:-300px 0 0 -230px;display:block" src="data:image/jpeg;base64,${b}"></div></div></body>`);
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: out });
  console.log('wrote', out);
} finally { await browser.close(); }
