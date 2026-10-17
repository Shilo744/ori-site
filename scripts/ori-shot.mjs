// Dev tool (T58): portraits of Ori from the GPU harness — any view, expression, gesture or held prop; several in one contact sheet.
//   node scripts/ori-shot.mjs --name=T58-ori-front --view=full [--expr=smile] [--gesture=thumbsUp] [--hold=phone] [--hour=13] [--at=home]
//   a sheet:  --exprs=neutral,smile,grin,laugh --view=face --cols=4      or      --gestures=thumbsUp,facepalm,shrug --view=full
//   views: face | head | three | side | back | full | fullside | street     (street = the normal chase camera)
import { join } from 'node:path';
import { build, serveDist, launchBrowser, newSession, loadSite, parseSize, sleep, settle, SHOTS } from './lib/harness.mjs';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const size = parseSize(args.size) || { width: 900, height: 900 };
const name = args.name || 'ori';
const FORCE = { walk: { speed: 1.8 }, run: { speed: 4.4 }, sprint: { speed: 8.2, sprinting: true }, tired: { speed: 0, winded: true }, idle: null };
const list = args.poses ? String(args.poses).split(',').map((p) => { const [nm, ex] = p.split(':'); return { force: nm, expr: ex || null, hold: nm === 'phone' || nm === 'carry' ? nm : null }; }) : args.exprs ? String(args.exprs).split(',').map((e) => ({ expr: e })) : args.gestures ? String(args.gestures).split(',').map((g) => ({ gesture: g })) : [{ expr: args.expr || null, gesture: args.gesture || null, hold: args.hold || null }];
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
  console.log(`opened in ${Date.now() - t0} ms`, await page.evaluate(() => JSON.stringify(window.__ori.game3d.game.timings)));
  await page.evaluate(([at, hour]) => { const g3 = window.__ori.game3d; g3.setHour(hour); g3.teleport(at); }, [args.at || 'home', +(args.hour || 13)]);
  if (!args.hud) await page.addStyleTag({ content: '#g3d > :not(canvas) { display: none !important; }' });
  const shots = [];
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    await page.evaluate((F) => { window.__FORCE = F; }, FORCE);
    await page.evaluate(([it, view, fov, yawOff, dist]) => {
      if (it.force === 'walk' || it.force === 'run' || it.force === 'sprint' || it.force === 'tired') it.forceState = window.__FORCE[it.force];
      const g = window.__ori.game3d.game;
      const o = g.ori;
      o.lockMood(it.expr || null);
      o.force(it.forceState || null);
      if (it.gesture) o.play(it.gesture);
      o.hold(it.hold || null);
      const st = g.controller.state;
      const h = st.heading + yawOff;
      const f = [Math.sin(h), Math.cos(h)];
      const gy = o.group.position.y;
      const V = {
        face: { d: 1.95, y: 1.52, ly: 1.5, fov: 17 },
        head: { d: 3.4, y: 1.55, ly: 1.4, fov: 24 },
        three: { d: 3.2, y: 1.3, ly: 1.0, fov: 34, a: 0.6 },
        side: { d: 2.6, y: 1.3, ly: 1.15, fov: 34, a: 1.57 },
        back: { d: 3.4, y: 1.3, ly: 1.0, fov: 34, a: 3.14 },
        full: { d: 4.4, y: 1.0, ly: 0.85, fov: 30 },
        fullside: { d: 5.2, y: 1.05, ly: 0.82, fov: 32, a: 1.2 },
      }[view];
      if (view === 'street') { g.setDebugCamera(null); return; }
      const a = (V.a || 0);
      const fx = Math.sin(h + a); const fz = Math.cos(h + a);
      const D = dist || V.d;
      g.setDebugCamera({ pos: [st.x + fx * D, gy + V.y, st.z + fz * D], look: [st.x, gy + V.ly, st.z], fov: fov || V.fov });
    }, [it, args.view || 'face', args.fov ? +args.fov : null, args.yaw ? +args.yaw : 0, args.dist ? +args.dist : null]);
    await sleep(it.gesture ? +(args.wait || 650) : 900);
    await settle(s, 2);
    shots.push(await page.screenshot());
  }
  const stats = await page.evaluate(() => ({ stats: window.__ori.game3d.stats(), fps: window.__ori.game3d.fps }));
  console.log(`${stats.stats.calls} calls, ${(stats.stats.triangles / 1000).toFixed(0)}k tris, ${stats.fps} fps`);
  if (shots.length === 1) { const file = join(SHOTS, `${name}.png`); await (await import('node:fs/promises')).writeFile(file, shots[0]); console.log(file.replace(/.*shots./, 'shots/')); } else {
    const cols = +(args.cols || Math.min(4, shots.length));
    const tile = Math.round(+(args.tile || 420));
    const labels = list.map((l) => l.expr || l.gesture || l.force || '');
    const page2 = await s.context.newPage();
    const html = `<body style="margin:0;background:#dfe7ee;font:600 15px Inter,system-ui"><div style="display:grid;grid-template-columns:repeat(${cols},${tile}px);gap:6px;padding:6px">${shots.map((b, i) => `<figure style="margin:0;position:relative"><img style="width:${tile}px;display:block;border-radius:10px" src="data:image/png;base64,${b.toString('base64')}"><figcaption style="position:absolute;left:10px;bottom:8px;color:#fff;text-shadow:0 1px 3px #000;font-size:17px">${labels[i]}</figcaption></figure>`).join('')}</div></body>`;
    await page2.setViewportSize({ width: cols * (tile + 6) + 6, height: Math.ceil(shots.length / cols) * (tile + 6) + 6 });
    await page2.setContent(html);
    await sleep(300);
    const file = join(SHOTS, `${name}.png`);
    await page2.screenshot({ path: file });
    console.log(file.replace(/.*shots./, 'shots/'));
    await page2.close();
  }
  s.errors.forEach((e) => console.log('ERR', e.kind, e.text.slice(0, 400)));
} finally {
  await browser.close();
  await server.close();
}
