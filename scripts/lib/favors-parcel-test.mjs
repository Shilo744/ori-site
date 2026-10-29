// "Ori, Can You...?" the parcel run [experimental], browser checks (T36): a parcel from Uzi's garage to a door against the clock - the chip counts down, the beam leads there, the grade is by the time (three stars
// to none), late still pays a thank-you, a run left alone goes back to the garage, three deliveries make a Courier.
import { sleep } from './harness.mjs';

export async function runFavorsParcel(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`parcel: ${msg}`) : fail(`parcel: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const S = () => g(() => window.__ori.game3d.state());

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.setHour(15); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); window.__tl = new Set(); window.__tt = setInterval(() => { for (const t of document.querySelectorAll('.fv-toast')) window.__tl.add(t.textContent); }, 40); });

  /** Into the garage, to the shelf, Space: a parcel. */
  const takeParcel = async () => {
    await g(() => window.__ori.game3d.enter('workshop'));
    await page.waitForFunction(() => window.__ori.game3d.insideId() === 'workshop', null, { timeout: 8000 });
    await sleep(400);
    const room = await g(() => window.__ori.game3d.insideInfo());
    const shelf = room.spots.find((p) => p.use === 'parcel');
    await g((p) => window.__ori.game3d.teleport({ x: p.x, z: p.z + 1.1 }, Math.PI), shelf);
    await sleep(500);
    const label = await g(() => (document.querySelector('.fv-gohint') || {}).textContent || '');
    await page.keyboard.press('Space');
    await sleep(500);
    await g(() => window.__ori.game3d.leave());
    await page.waitForFunction(() => !window.__ori.game3d.insideId(), null, { timeout: 8000 });
    return { shelf, label };
  };
  const deliver = async (to) => { await g((to) => window.__ori.game3d.teleport(to), to); await page.waitForFunction(() => window.__ori.game3d.state().parcel === null, null, { timeout: 5000 }); };

  // ── 1: a quick run: three stars ──
  const p0 = (await S()).peaches;
  const t1 = await takeParcel();
  check(!!t1.shelf && /Take a parcel/.test(t1.label), `the garage has a parcel shelf: "${t1.label.replace(/\s+/g, ' ').trim()}"`);
  const s1 = await S();
  check(!!s1.parcel && s1.tracked === s1.parcel.to && s1.parcel.limit >= 35, `a parcel for ${s1.parcel && s1.parcel.to}: ${s1.parcel && s1.parcel.limit} seconds, ${s1.parcel && Math.round(s1.parcel.meters)} m, and the beam leads there`);
  await page.waitForFunction(() => /Parcel for/.test(document.querySelector('.fv-story').textContent), null, { timeout: 4000 });
  check(await g(() => document.querySelector('.fv-story').classList.contains('on')), 'the chip under the goal counts the time down');
  await deliver(s1.parcel.to);
  const d1 = await S();
  check(d1.peaches >= p0 + 16 && d1.progress.parcels === 1 && d1.progress.parcelStars === 3 && d1.tracked === null, `delivered fast: three stars, +${d1.peaches - p0} peaches, the beam is gone`);
  check((await g(() => [...window.__tl])).some((t) => /Delivered to .*★★★/.test(t)), 'with a toast');

  // ── 2: late: still a thank-you ──
  const t2 = await takeParcel();
  void t2;
  const s2 = await S();
  await g(() => { const r = window.__ori.game3d.game.parcelRun; r.t = r.limit + 6; });
  const q0 = (await S()).peaches;
  await deliver(s2.parcel.to);
  const d2 = await S();
  check(d2.peaches - q0 === 3 && d2.progress.parcels === 2 && d2.progress.parcelStars === 3, `late: no stars, a thank-you and +${d2.peaches - q0} peaches`);

  // ── 3: left alone: it goes back to the garage, nothing counted ──
  await takeParcel();
  await g(() => { const r = window.__ori.game3d.game.parcelRun; r.t = r.limit * 2 + 1; });
  await page.waitForFunction(() => window.__ori.game3d.state().parcel === null, null, { timeout: 4000 });
  await page.waitForFunction(() => [...window.__tl].some((t) => /went back to the garage/.test(t)), null, { timeout: 2500 }).catch(() => {}); // (the toast is read by a poll: give it a moment on a busy machine)
  const d3 = await S();
  const seenBack = (await g(() => [...window.__tl])).some((t) => /went back to the garage/.test(t));
  check(d3.progress.parcels === 2 && d3.tracked === null && seenBack, `a run left alone goes back to the garage with a kind word, and is not counted (parcels ${d3.progress.parcels}, tracked ${d3.tracked}, toast ${seenBack})`);

  // ── 4: the third delivery: a Courier ──
  await takeParcel();
  const s4 = await S();
  await deliver(s4.parcel.to);
  await sleep(1500);
  const d4 = await S();
  check(d4.progress.parcels === 3 && (d4.progress.trophies || []).includes('courier'), 'three deliveries: the "Courier" trophy');

  // ── only one at a time; and it is on the save ──
  await takeParcel();
  const again = await g(() => { const t0 = window.__ori.game3d.state().parcel; return t0 && t0.to; });
  await g(() => window.__ori.game3d.enter('workshop'));
  await page.waitForFunction(() => window.__ori.game3d.insideId() === 'workshop', null, { timeout: 8000 });
  await sleep(300);
  const room = await g(() => window.__ori.game3d.insideInfo());
  const shelf = room.spots.find((p) => p.use === 'parcel');
  await g((p) => window.__ori.game3d.teleport({ x: p.x, z: p.z + 1.1 }, Math.PI), shelf);
  await sleep(400);
  await page.keyboard.press('Space');
  await sleep(300);
  check((await S()).parcel.to === again && (await g(() => [...window.__tl])).some((t) => /carrying one for .* already/.test(t)), 'one parcel at a time');
  const rt = await g(() => { const c = window.__ori.game3d.game.campaign; const r = c.importCode(c.exportCode()); return { ok: r.ok, parcels: c.state.progress.parcels, stars: c.state.progress.parcelStars }; });
  check(rt.ok && rt.parcels === 3 && rt.stars === 6, 'the deliveries are on the save (also through a save code)');
  await g(() => clearInterval(window.__tt));
}
