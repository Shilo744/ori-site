// Dev tool (T51): crops the face out of the supplied selfie (.duo/assets/ori-selfie.jpg, never published) into the small, EXIF-free
// picture the game uses for Ori's paper-cutout face:  src/game3d/favors/assets/ori-face.jpg   (embedded in the bundle as a data URI).
//   node scripts/make-ori-face.mjs [--rect=x,y,w,h]      (rect in the ORIGINAL photo's pixels)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { launchBrowser, ROOT } from './lib/harness.mjs';

const arg = (process.argv.find((a) => a.startsWith('--rect=')) || '').split('=')[1];
const src = join(ROOT, '.duo', 'assets', 'ori-selfie.jpg');
const out = join(ROOT, 'src', 'game3d', 'favors', 'assets', 'ori-face.jpg');
const b64 = (await readFile(src)).toString('base64');
const { browser } = await launchBrowser();
try {
  const page = await browser.newPage();
  const res = await page.evaluate(async ({ b64, rect }) => {
    const img = new Image();
    await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = `data:image/jpeg;base64,${b64}`; });
    const k = img.naturalWidth / 1125; // the face box below is given in a 1125-wide frame
    const [x, y, w, h] = rect || [525, 735, 535, 480].map((v) => v * k);
    const W = 360;
    const H = Math.round((W * h) / w);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, W, H);
    return { w: img.naturalWidth, h: img.naturalHeight, W, H, url: c.toDataURL('image/jpeg', 0.88) };
  }, { b64, rect: arg ? arg.split(',').map(Number) : null });
  await mkdir(join(ROOT, 'src', 'game3d', 'favors', 'assets'), { recursive: true });
  await writeFile(out, Buffer.from(res.url.split(',')[1], 'base64'));
  console.log(`photo ${res.w}x${res.h} -> ${res.W}x${res.H} face crop, ${Math.round(res.url.length * 0.75 / 1024)} KB  (${out})`);
} finally { await browser.close(); }
