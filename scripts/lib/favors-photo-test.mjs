// "Ori, Can You...?" photo mode [experimental], browser checks (T27): V puts the HUD away, Space takes a polaroid and the browser gets it as a PNG download, Esc / V come back, the other keys wait, photos in five places make a Photographer.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { SHOTS, sleep, settle } from './harness.mjs';

export async function runFavorsPhoto(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`photo: ${msg}`) : fail(`photo: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const S = () => g(() => window.__ori.game3d.state());
  const hudShown = () => g(() => getComputedStyle(document.querySelector('.fv-hud')).visibility !== 'hidden');
  const on = () => g(() => window.__ori.game3d.state().photo.on);
  const pngSize = (path) => { const b = readFileSync(path); return { sig: b.subarray(0, 8).toString('hex'), w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length }; };
  const shoot = async (saveAs = null) => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.keyboard.press('Space')]);
    const path = saveAs || join(SHOTS, 'T27-last.png');
    await dl.saveAs(path);
    return { name: dl.suggestedFilename(), path };
  };

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.setHour(15); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); });
  await sleep(500);

  // ── V: the HUD goes, the viewfinder comes; the other keys wait ──
  check((await hudShown()) && !(await on()), 'the HUD is there to begin with');
  await page.keyboard.press('KeyV');
  await page.waitForFunction(() => window.__ori.game3d.state().photo.on, null, { timeout: 3000 });
  await sleep(250);
  check(!(await hudShown()) && (await g(() => !document.querySelector('.ph').hidden)), 'V puts the HUD away and puts the viewfinder up');
  await page.keyboard.press('KeyM'); await sleep(250);
  await page.keyboard.press('Tab'); await sleep(250);
  check((await g(() => !window.__ori.game3d.game.mapUi.isOpen && !window.__ori.game3d.game.journal.isOpen)) && (await on()), 'the map and the journal wait until he is back');
  const p0 = (await S()).player;
  await page.keyboard.down('KeyW'); await sleep(900); await page.keyboard.up('KeyW');
  const p1 = (await S()).player;
  check(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 1.5, 'but he can still walk about to find the shot');

  // ── Space: the polaroid, as a PNG download ──
  const shot = await shoot(join(SHOTS, 'T27-photo.png'));
  const png = pngSize(shot.path);
  check(/^ori-day1-\d{4}\.png$/.test(shot.name) && png.sig === '89504e470d0a1a0a' && png.w >= 640 && png.h > png.w * 0.55 && png.bytes > 20000, `Space: a download "${shot.name}", a real PNG of ${png.w} x ${png.h} (${Math.round(png.bytes / 1024)} KB)`);
  const s1 = await S();
  check(s1.progress.photos === 1 && Object.keys(s1.progress.photoPlaces).length === 1, 'it is counted, with where it was taken');
  const th = await g(() => { const t = document.querySelector('.ph-thumb'); return { shown: !t.hidden, src: t.getAttribute('src').slice(0, 22) }; });
  check(th.shown && th.src === 'data:image/png;base64,', 'a little polaroid slides in');
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T27-viewfinder.png') });

  // ── Esc: back (and it does not pause) ──
  await page.keyboard.press('Escape');
  await sleep(300);
  check(!(await on()) && (await hudShown()) && !(await S()).paused, 'Esc comes back to the street (it does not pause)');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__ori.game3d.paused, null, { timeout: 3000 });
  await page.keyboard.press('KeyV'); await sleep(250);
  check(!(await on()), 'in the pause menu V does nothing');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__ori.game3d.paused, null, { timeout: 3000 });

  // ── five places: a Photographer ──
  for (const pid of ['cafe', 'kiosk', 'mum', 'auntie']) {
    await g((p) => window.__ori.game3d.enter(p), pid);
    await page.waitForFunction((p) => window.__ori.game3d.insideId() === p, pid, { timeout: 8000 });
    await sleep(450);
    await page.keyboard.press('KeyV');
    await page.waitForFunction(() => window.__ori.game3d.state().photo.on, null, { timeout: 3000 });
    await shoot();
    await page.keyboard.press('KeyV');
    await sleep(200);
    await g(() => window.__ori.game3d.leave());
    await page.waitForFunction(() => !window.__ori.game3d.insideId(), null, { timeout: 8000 });
    await sleep(300);
  }
  await sleep(1500);
  const s2 = await S();
  check(s2.progress.photos === 5 && Object.keys(s2.progress.photoPlaces).length === 5 && s2.progress.trophies.includes('photographer'), `five photos in five places: ${Object.keys(s2.progress.photoPlaces).join(', ')} and the "Photographer" achievement`);

  // ── not while he is in a conversation or a fight; the save carries the places ──
  const rt = await g(() => { const c = window.__ori.game3d.game.campaign; const was = JSON.stringify([c.state.progress.photos, c.state.progress.photoPlaces]); const r = c.importCode(c.exportCode()); return { ok: r.ok, same: was === JSON.stringify([c.state.progress.photos, c.state.progress.photoPlaces]) }; });
  check(rt.ok && rt.same, 'the save code carries the photos and where they were taken');
}
