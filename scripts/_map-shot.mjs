// TEMP dev tool (deleted when the map work is done): the minimap, the big map (M), the beacon over the ring, the door line, the car tag and hello from the car, in pictures.
//   node scripts/_map-shot.mjs [--no-build] [--w=1280 --h=800]
import { join } from 'node:path';
import { build, serveDist, launchBrowser, newSession, loadSite, sleep, settle, SHOTS } from './lib/harness.mjs';
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
if (!args['no-build']) build();
const server = await serveDist();
const { browser } = await launchBrowser();
try {
  const s = await newSession(browser, server.origin, { width: +(args.w || 1280), height: +(args.h || 800) });
  await loadSite(s, server.origin);
  const { page } = s;
  const g = (fn, a) => page.evaluate(fn, a);
  const S = () => g(() => window.__ori.game3d.state());
  const shot = async (name) => { await settle(s, 2); await page.screenshot({ path: join(SHOTS, `_m-${name}.png`) }); console.log('shot', name); };
  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.setHour(15); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); });
  await sleep(600);
  await shot('spawn');
  // the beacon: from a street some way from the ring
  await g(() => { const gm = window.__ori.game3d.game; const c = gm.fight.center; const yaw = Math.atan2(60, -45); window.__ori.game3d.teleport({ x: c.x - 24, z: c.z + 18 }, yaw); gm.setCamera({ yaw, pitch: 0.2, dist: 6 }); });
  await sleep(900);
  await shot('beacon-day');
  await g(() => window.__ori.game3d.setHour(21));
  await sleep(900);
  await shot('beacon-night');
  await g(() => window.__ori.game3d.setHour(15));
  // the big map
  await page.keyboard.press('KeyM');
  await sleep(500);
  console.log('mapOpen', (await S()).mapOpen);
  await shot('bigmap');
  await page.click('.mp-list li[data-p="court"]');
  await sleep(300);
  console.log('tracked', (await S()).tracked);
  await shot('bigmap-tracked');
  await page.keyboard.press('KeyM');
  await sleep(500);
  console.log('mapOpen', (await S()).mapOpen);
  await shot('tracked-street');
  // the door line
  await g(() => window.__ori.game3d.teleport('cafe'));
  await sleep(600);
  await shot('door-cafe');
  console.log('hint', await g(() => document.querySelector('.fv-gohint') && document.querySelector('.fv-gohint').textContent));
  // the car: get in, hello from the car, get out: the tag
  await g(() => window.__ori.game3d.game.enterOwnCar());
  await sleep(400);
  console.log('driving', (await S()).driving);
  await g(() => { const gm = window.__ori.game3d.game; const d = gm.map.places.mum.door; gm.placeCar(d.x + d.nx * 5, d.z + d.nz * 5, Math.atan2(d.nx, d.nz)); });
  await sleep(600);
  console.log('target', JSON.stringify(await g(() => { const sc = window.__ori.game3d.game.social; return sc && sc.target ? { id: sc.target.id } : null; })));
  await page.keyboard.press('KeyH');
  await sleep(900);
  await shot('hello-in-car');
  console.log('bubbles', await g(() => document.querySelectorAll('.fb').length));
  console.log('car before exit', JSON.stringify((await S()).car), 'player', JSON.stringify((await S()).player && [(await S()).player.x, (await S()).player.z]));
  await page.keyboard.press('KeyF');
  await sleep(700);
  const out = await S();
  console.log('driving', out.driving, 'carTag', JSON.stringify(out.carTag));
  await g((c) => { window.__ori.game3d.teleport({ x: c.x + 9, z: c.z + 3 }, 0); }, out.carTag);
  await sleep(700);
  await shot('car-tag');
  console.log('carTag', JSON.stringify((await S()).carTag));
  await page.keyboard.press('KeyM');
  await sleep(500);
  await shot('bigmap-car');
  s.errors.forEach((e) => console.log('ERR', e.kind, e.text.slice(0, 400)));
} finally { await browser.close(); await server.close(); }
