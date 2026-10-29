// TEMP dev tool (deleted when the ring animation work is done): storyboards of a real fight at the real camera - punches, a guard that takes blows, a slip, a knock-out.
//   node scripts/_ring-seq.mjs [--no-build] [--opp=moti] [--level=3] [--only=punch,block,dodge,ko] [--w=1280 --h=800] [--out=name]
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { build, serveDist, launchBrowser, newSession, loadSite, sleep, SHOTS } from './lib/harness.mjs';
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
if (!args['no-build']) build();
const ONLY = args.only ? String(args.only).split(',') : ['punch', 'block', 'dodge', 'ko'];
const W = +(args.w || 1280); const H = +(args.h || 800);
const server = await serveDist();
const { browser } = await launchBrowser();
try {
  const s = await newSession(browser, server.origin, { width: W, height: H });
  await loadSite(s, server.origin);
  const { page } = s;
  const g = (fn, a) => page.evaluate(fn, a);
  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(([lv, love]) => { const gm = window.__ori.game3d.game; window.__ori.game3d.setHour(17.5); gm.setWeather({ rain: 0, wet: 0, overcast: 0 }); gm.campaign.state.boxer.level = lv; gm.campaign.state.love = love; const p = gm.fight.apron(); window.__ori.game3d.teleport({ x: p.x, z: p.z }, Math.PI); }, [+(args.level || 4), 30]);
  await sleep(600);
  await g((id) => window.__ori.game3d.game.startFight(id), args.opp || 'moti');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.phase === 'fight', null, { timeout: 15000 });
  await g(() => { document.querySelectorAll('.fv-keys, .fi-keys, .fv-toasts, .pl-mini, .fv-goal, .fi-sub').forEach((e) => { e.style.display = 'none'; }); });
  await sleep(400);
  const clip = { x: Math.round(W * 0.2), y: Math.round(H * 0.2), width: Math.round(W * 0.6), height: Math.round(H * 0.62) };
  const rows = [];
  const grab = (n, gap = 0) => (async () => { const out = []; for (let i = 0; i < n; i++) { out.push((await page.screenshot({ clip, type: 'jpeg', quality: 80 })).toString('base64')); if (gap) await sleep(gap); } return out; })();
  const close = () => g(() => { const f = window.__ori.game3d.game.fight.bout; f.O.x = f.P.x; f.O.z = f.P.z - 1.3; f.P.hp = f.P.maxHp; f.P.st = f.P.maxSt; });
  const calm = () => g(() => { const f = window.__ori.game3d.game.fight.bout; f.O.ai = f.O.ai || {}; });
  void calm;
  if (ONLY.includes('punch')) {
    await close();
    await page.keyboard.press('KeyJ'); const a = await grab(5, 10);
    await page.keyboard.press('KeyK'); const b = await grab(5, 10);
    rows.push({ name: 'jab then cross', f: [...a, ...b] });
    await sleep(900);
  }
  if (ONLY.includes('block')) {
    await close();
    await page.keyboard.down('KeyL');
    const f = await grab(14, 60);
    await page.keyboard.up('KeyL');
    rows.push({ name: 'guard up (L held) while he throws', f });
    await sleep(500);
  }
  if (ONLY.includes('dodge')) {
    await close();
    await sleep(700);
    // dash when he winds up: poll for the wind-up, then dash to the side
    const t0 = Date.now(); let seen = false;
    while (Date.now() - t0 < 8000) { const o = await g(() => { const f = window.__ori.game3d.game.fight.bout; return { st: f.O.state, ph: f.O.phase, t: f.O.t, w: f.O.d ? f.O.d.wind : 0 }; }); if (o.st === 'attack' && o.ph === 'wind' && o.w - o.t < 0.17) { seen = true; break; } await sleep(15); }
    await page.keyboard.down('KeyA'); await page.keyboard.press('Space');
    const f = await grab(12, 25);
    await page.keyboard.up('KeyA');
    rows.push({ name: seen ? 'a dash to the side as he winds up' : 'a dash (he did not attack in time)', f });
    await sleep(500);
  }
  if (ONLY.includes('ko')) {
    await close();
    await g(() => { const f = window.__ori.game3d.game.fight.bout; f.O.hp = 2; f.O.state = 'idle'; });
    await page.keyboard.press('KeyJ');
    const f = await grab(15, 230);
    rows.push({ name: 'a knock-down: down, the count, he gets up', f });
  }
  const cmp = await browser.newPage({ viewport: { width: 400, height: 300 } });
  const per = Math.max(...rows.map((r) => r.f.length));
  const url = await cmp.evaluate(async ({ rows, per, scale }) => {
    const imgs = await Promise.all(rows.map((r) => Promise.all(r.f.map((b) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = `data:image/jpeg;base64,${b}`; })))));
    const iw = imgs[0][0].width; const ih = imgs[0][0].height;
    const w = Math.round(iw * scale); const h = Math.round(ih * scale);
    const cols = 5; const lines = rows.map((r) => Math.ceil(r.f.length / cols)).reduce((a, b) => a + b, 0);
    const c = document.createElement('canvas'); c.width = w * cols; c.height = h * lines + 20 * rows.length;
    const x = c.getContext('2d'); x.fillStyle = '#222'; x.fillRect(0, 0, c.width, c.height);
    let yy = 0;
    imgs.forEach((row, i) => { x.fillStyle = '#fff'; x.font = 'bold 14px sans-serif'; x.fillText(rows[i].name, 6, yy + 14); yy += 20; row.forEach((im, k) => x.drawImage(im, (k % cols) * w, yy + Math.floor(k / cols) * h, w, h)); yy += Math.ceil(row.length / cols) * h; });
    void per;
    return c.toDataURL('image/png');
  }, { rows: rows.map((r) => ({ name: r.name, f: r.f })), per, scale: +(args.scale || 0.44) });
  const out = join(SHOTS, `_seq-${args.out || 'sheet'}.png`);
  writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', out);
  s.errors.forEach((e) => console.log('ERR', e.kind, e.text.slice(0, 300)));
} finally { await browser.close(); await server.close(); }
