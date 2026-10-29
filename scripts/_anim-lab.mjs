// TEMP dev tool (deleted when the ring animation work is done): contact sheets of the boxing animations - one row of frames per gesture, in one picture.
//   node scripts/_anim-lab.mjs [--no-build] [--only=jab,cross,...] [--frames=8] [--mirror] [--out=name] [--view=front|side]
// The game is paused and stepped by hand (1/60 s per frame), a debug camera looks at Ori standing in the open.
import { join } from 'node:path';
import { build, serveDist, launchBrowser, newSession, loadSite, sleep, settle, SHOTS } from './lib/harness.mjs';
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
if (!args['no-build']) build();
const FR = +(args.frames || 8);
const ONLY = args.only ? String(args.only).split(',') : ['jab', 'cross', 'hook', 'upper', 'hit', 'dodge', 'stance', 'block', 'blockhit', 'stagger', 'ko', 'dodgeL', 'dodgeR', 'dodgeB', 'shuffle'];
const server = await serveDist();
const { browser } = await launchBrowser();
try {
  const s = await newSession(browser, server.origin, { width: 900, height: 760 });
  await loadSite(s, server.origin);
  const { page } = s;
  const g = (fn, a) => page.evaluate(fn, a);
  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.setHour(12); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); x.teleport('park'); });
  await sleep(600);
  await g(() => { document.querySelectorAll('.fv-hud, .fv-talkhint, .fv-toasts, .fv-goal, .pl-mini, .pl-peaches, .fv-arrow, .fv-keys, .fv-gohint').forEach((e) => { e.style.display = 'none'; }); });
  await g(() => window.__ori.game3d.pause());
  await g(() => { document.querySelectorAll('.g3d-menu').forEach((e) => { e.style.display = 'none'; }); });
  const st = await g(() => { const s2 = window.__ori.game3d.state(); return { x: s2.player.x, z: s2.player.z, gy: 0 }; });
  // the camera in front of him and to his right (or square from the side), looking at his chest
  const view = args.view === 'side' ? { fwd: 0.0, right: 3.4 } : args.view === 'front' ? { fwd: 3.2, right: 0.0 } : { fwd: 2.5, right: 1.9 };
  await g(([v, st2]) => { const gm = window.__ori.game3d.game; const h = gm.controller.state.heading; const fx = Math.sin(h); const fz = Math.cos(h); const rx = -fz; const rz = fx; gm.setDebugCamera({ pos: [st2.x + fx * v.fwd + rx * v.right, 1.3, st2.z + fz * v.fwd + rz * v.right], look: [st2.x, 0.95, st2.z], fov: 38 }); }, [view, st]);
  const dur = { jab: 0.34, cross: 0.46, hook: 0.5, upper: 0.54, hit: 0.34, dodge: 0.26, blockhit: 0.24, stagger: 0.6, ko: 1.1, dodgeL: 0.3, dodgeR: 0.3, dodgeB: 0.3 };
  const PEAK = { jab: 0.4, cross: 0.5, hook: 0.55, upper: 0.6 };
  const WIND = { jab: 0.12, cross: 0.2, hook: 0.26, upper: 0.3 };
  const frames = [];
  const grab = async () => { await page.evaluate(() => window.__ori.game3d.game.render(0)); return page.screenshot({ clip: { x: 285, y: 70, width: 330, height: 600 } }); };
  for (const name of ONLY) {
    const row = [];
    await g(([mir, nm]) => {
      const gm = window.__ori.game3d.game; const o = gm.ori;
      o.setMirror(!!mir); o.hold(nm === 'block' ? 'block' : 'guard'); o.force(null);
      o.group.rotation.set(0, o.group.rotation.y, 0);
    }, [!!args.mirror, name]);
    // settle into the stance
    for (let i = 0; i < 40; i++) await g(() => window.__ori.game3d.game.render(1 / 60));
    let total = 0.9;
    if (name === 'stance') total = 1.2;
    else if (name === 'shuffle') total = 1.2;
    else if (name === 'block') total = 0.5;
    else if (dur[name]) {
      const sp = WIND[name] ? dur[name] / (WIND[name] / PEAK[name]) : 1;
      await g(([nm, sp2]) => window.__ori.game3d.game.ori.play(nm, sp2), [name, sp]);
      total = dur[name] / sp;
      if (name === 'ko') total = 1.1;
    }
    let t = 0;
    for (let k = 0; k < FR; k++) {
      const want = (total * k) / (FR - 1);
      while (t + 1e-6 < want) {
        const step = Math.min(1 / 60, want - t);
        await g(([d, nm, tt]) => {
          const gm = window.__ori.game3d.game; const o = gm.ori;
          if (nm === 'shuffle') o.force({ speed: 2.2, sprinting: false, winded: false });
          if (nm === 'ko') { const e = Math.min(1, (tt + d) / 0.75); const ee = 1 - (1 - e) * (1 - e); o.group.rotation.order = 'YXZ'; o.group.rotation.x = -ee * 1.5; }
          gm.render(d);
        }, [step, name, t]);
        t += step;
      }
      row.push(await grab());
    }
    frames.push({ name, row });
    console.log('row', name);
  }
  // stitch the rows into one picture, in a blank page
  const cmp = await browser.newPage({ viewport: { width: 400, height: 300 } });
  const data = frames.map((f) => ({ name: f.name, row: f.row.map((b) => b.toString('base64')) }));
  const url = await cmp.evaluate(async ({ data, scale }) => {
    const imgs = await Promise.all(data.map((r) => Promise.all(r.row.map((b) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = `data:image/png;base64,${b}`; })))));
    const w = Math.round(330 * scale); const h = Math.round(600 * scale);
    const c = document.createElement('canvas'); c.width = w * data[0].row.length; c.height = (h + 18) * data.length;
    const x = c.getContext('2d'); x.fillStyle = '#222'; x.fillRect(0, 0, c.width, c.height);
    imgs.forEach((row, i) => { row.forEach((im, k) => x.drawImage(im, k * w, i * (h + 18) + 18, w, h)); x.fillStyle = '#fff'; x.font = 'bold 14px sans-serif'; x.fillText(data[i].name, 6, i * (h + 18) + 13); });
    return c.toDataURL('image/png');
  }, { data, scale: +(args.scale || 0.62) });
  const buf = Buffer.from(url.split(',')[1], 'base64');
  const { writeFileSync } = await import('node:fs');
  const out = join(SHOTS, `_lab-${args.out || 'sheet'}.png`);
  writeFileSync(out, buf);
  console.log('wrote', out);
  s.errors.forEach((e) => console.log('ERR', e.kind, e.text.slice(0, 300)));
} finally { await browser.close(); await server.close(); }
