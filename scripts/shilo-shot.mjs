// Dev tool (T63): renders of Shilo (the cast member 'shilo', people/specs.js SHILO_SPEC) from the GPU harness, to compare with the private reference photos
// (.duo/assets/shilo-1..4.jpg, git-ignored; the output stays in shots/, also ignored).
//   node scripts/shilo-shot.mjs [--no-build] [--views=face,head,three,side,full] [--name=shilo] [--hour=13] [--noline] [--size=1000x760]
//   views: face (eyes and brows, very close) | head | three (3/4 view of head and shoulders) | side | full (the whole body)
//   --noline hides the cartoon outline shells (to judge the raw shapes and colours).
//   node scripts/ori-vs-photo.mjs shots/shilo-face.png shots/shilo-vs-photo.png  puts a render next to a photo (adapt the photo path in that script).
import { join } from 'node:path';
import { build, serveDist, launchBrowser, newSession, loadSite, parseSize, sleep, settle, SHOTS } from './lib/harness.mjs';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const size = parseSize(args.size) || { width: 1000, height: 760 };
const views = String(args.views || 'face,head,three,full').split(',');
const name = args.name || 'shilo';
// distance, camera height, look-at height, fov, turn (radians round him; 0 = from the front)
const V = { face: [1.1, 1.42, 1.42, 17, 0], head: [2.4, 1.46, 1.38, 22, 0], three: [2.2, 1.46, 1.34, 22, 0.6], side: [2.2, 1.46, 1.34, 22, 1.5], full: [4.2, 1.1, 0.95, 32, 0] };
if (!args['no-build']) build();
const server = await serveDist();
const { browser } = await launchBrowser();
try {
  const s = await newSession(browser, server.origin, size);
  await loadSite(s, server.origin);
  const { page } = s;
  await page.evaluate(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await page.addStyleTag({ content: '#g3d > :not(canvas) { display: none !important; }' });
  await page.evaluate(([hour, noline]) => {
    const g3 = window.__ori.game3d;
    g3.setHour(hour);
    g3.teleport('park');
    g3.game.spawnCast(['shilo'], { ahead: 3 });
    if (noline) g3.game.scene.traverse((o) => { if (/outline/.test(o.name)) o.visible = false; });
  }, [+(args.hour || 13), !!args.noline]);
  for (const view of views) {
    const [d, y, ly, fov, turn] = V[view] || V.head;
    await page.evaluate(([d, y, ly, fov, turn]) => {
      const g = window.__ori.game3d.game;
      const st = g.controller.state;
      const gy = g.ori.group.position.y;
      const px = st.x + Math.sin(st.heading) * 3; // where Shilo stands (he faces Ori)
      const pz = st.z + Math.cos(st.heading) * 3;
      const a = st.heading + Math.PI + turn;
      g.ori.group.visible = false;
      g.setDebugCamera({ pos: [px + Math.sin(a) * d, gy + y, pz + Math.cos(a) * d], look: [px, gy + ly, pz], fov });
    }, [d, y, ly, fov, turn]);
    await sleep(1100);
    await settle(s, 2);
    const file = join(SHOTS, `${name}-${view}.png`);
    await page.screenshot({ path: file });
    console.log(file.replace(/.*shots./, 'shots/'));
  }
  s.errors.forEach((e) => console.log('ERR', e.kind, e.text.slice(0, 300)));
} finally {
  await browser.close();
  await server.close();
}
