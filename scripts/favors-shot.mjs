// Dev tool (T51): screenshots of "Ori, Can You...?" from the GPU harness.
//   node scripts/favors-shot.mjs --name=T51-street --at=home --hour=13 [--tier=high] [--size=1280x800] [--yaw=3.14] [--dist=7] [--no-build]
//   several shots in one go:  --shots="home@13,cafe@19.5,park@23"
import { join } from 'node:path';
import { build, serveDist, launchBrowser, newSession, loadSite, parseSize, sleep, settle, SHOTS } from './lib/harness.mjs';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const size = parseSize(args.size) || { width: 1280, height: 800 };
const name = args.name || 'favors';
const shots = args.shots ? String(args.shots).split(',').map((s) => { const [at, hour] = s.split('@'); return { at, hour: +hour }; }) : [{ at: args.at || 'home', hour: +(args.hour || 13) }];
if (!args['no-build']) build();
const server = await serveDist();
const { browser } = await launchBrowser();
try {
  const s = await newSession(browser, server.origin, size);
  await loadSite(s, server.origin);
  const { page } = s;
  const t0 = Date.now();
  await page.evaluate((o) => window.__ori.game3d.launch('favors', o), { quick: true, tier: args.tier });
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  console.log(`opened in ${Date.now() - t0} ms`);
  for (let i = 0; i < shots.length; i++) {
    const { at, hour } = shots[i];
    await page.evaluate(([at, hour, yaw, dist, pitch, back, off, face]) => {
      const g3 = window.__ori.game3d;
      g3.setHour(hour);
      if (at.includes(':')) { const [x, z] = at.split(':').map(Number); g3.teleport({ x, z }); } else if (off) { const p = g3.place(at); g3.teleport({ x: p.door.x + p.door.nx * off, z: p.door.z + p.door.nz * off }, face ? Math.atan2(-p.door.nx, -p.door.nz) : Math.atan2(p.door.nx, p.door.nz)); } else g3.teleport(at);
      const g = g3.game;
      const heading = g.controller.state.heading;
      const o = { yaw: yaw != null ? yaw : back ? heading + Math.PI : heading };
      if (dist) o.dist = dist;
      if (pitch != null) o.pitch = pitch;
      g3.camera(o);
    }, [at, hour, args.yaw != null ? +args.yaw : null, args.dist ? +args.dist : null, args.pitch != null ? +args.pitch : null, !!args.front, args.off ? +args.off : 0, !!args.face]);
    await sleep(350);
    await settle(s, 3);
    const file = join(SHOTS, `${name}${shots.length > 1 ? `-${i + 1}` : ''}.png`);
    await page.screenshot({ path: file });
    const st = await page.evaluate(() => ({ stats: window.__ori.game3d.stats(), state: window.__ori.game3d.state(), fps: window.__ori.game3d.fps }));
    console.log(file.replace(/.*shots./, 'shots/'), `${st.stats.calls} calls ${(st.stats.triangles / 1000).toFixed(0)}k tris | ${st.stats.geometries} geo ${st.stats.textures} tex | ${st.fps} fps | ${st.state.clock.label}`);
  }
  s.errors.forEach((e) => console.log('ERR', e.kind, e.text.slice(0, 400)));
} finally {
  await browser.close();
  await server.close();
}
