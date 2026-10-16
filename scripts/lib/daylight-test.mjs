// Time-of-day checks (T9): distinct lighting at 07:00 / 13:00 / 18:30 / 23:00, the real floor-lamp light, the HUD button +
// T key cycling with persistence, the cross-fade, and measured brightness / warmth of real screenshots.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';

export async function runDaylight(session, { ok, fail }) {
  const { page } = session;
  const tag = `${session.width}x${session.height}`;
  const check = (cond, msg) => (cond ? ok(`daylight: ${msg}`) : fail(`daylight: ${msg}`));
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const st = () => ev(() => { const d = window.__ori.daylight; const s = d.state; return { mode: d.mode, hours: s.hours, keyI: s.keyI, hemiI: s.hemiI, env: s.env, exp: s.exp, stars: s.stars, lamp: d.lamp.level, lampOn: d.lamp.on, sunVis: s.sunVis, moonVis: s.moonVis, top: s.top.getHexString(), sky: window.__ori.scene.environmentIntensity, exposure: window.__ori.renderer.toneMappingExposure, screen: s.screen, bg1: getComputedStyle(document.documentElement).getPropertyValue('--bg1').trim(), light: window.__ori.scene.children.find((c) => c.isDirectionalLight && c.castShadow)?.intensity }; });
  const shotLuma = async (name) => {
    await settle(session, 2);
    const buf = await page.screenshot({ path: join(SHOTS, 'smoke', `${tag}-daylight-${name}.png`) });
    const r = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = 160; c.height = 100;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, 160, 100);
      const d = g.getImageData(0, 0, 160, 100).data;
      let R = 0, G = 0, B = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; }
      return { r: R / n, g: G / n, b: B / n, luma: (0.2126 * R + 0.7152 * G + 0.0722 * B) / n };
    }, buf.toString('base64'));
    return r;
  };
  const flat = session.width < 860;

  await ev(() => { window.__ori.core.storage.remove('daylight:mode'); window.__ori.desktop.reset(); });

  // ── the four reference times ──
  const times = { morning: 7, noon: 13, golden: 18.5, night: 23 };
  const S = {};
  for (const [k, h] of Object.entries(times)) { await ev((x) => window.__ori.setTime(x), h); await settle(session, 2); S[k] = await st(); } // state is applied once per rendered frame
  check(Math.abs(S.noon.hours - 13) < 0.01 && Math.abs(S.night.hours - 23) < 0.01, 'setTime(h) jumps to that hour');
  check(S.noon.keyI > S.golden.keyI && S.golden.keyI > S.morning.keyI && S.morning.keyI > S.night.keyI, `key-light intensity: noon ${S.noon.keyI.toFixed(2)} > golden ${S.golden.keyI.toFixed(2)} > morning ${S.morning.keyI.toFixed(2)} > night ${S.night.keyI.toFixed(2)}`);
  check(S.night.stars > 0.9 && S.noon.stars === 0 && S.golden.stars < 0.1, 'stars come out only at night');
  check(S.night.moonVis > 0.5 && S.noon.moonVis === 0, 'the moon is up at night, not at noon');
  check(S.noon.sunVis > 0.9 && S.night.sunVis === 0, 'the sun disc is up at noon, not at night');
  check(S.night.exp > S.noon.exp && S.night.env < S.noon.env, 'night: higher exposure, less environment light');
  check(new Set([S.morning.top, S.noon.top, S.golden.top, S.night.top]).size === 4, 'four different sky colours');
  check(S.night.bg1 !== S.noon.bg1 && S.golden.bg1 !== S.noon.bg1, `the page background follows the light (${S.noon.bg1} → ${S.night.bg1})`);
  check(S.night.screen > S.noon.screen, 'the laptop screen glow is stronger at night');
  check(S.night.lamp > 0.95 && S.noon.lamp < 0.05 && S.golden.lamp > 0.3 && S.golden.lamp < 0.7, `the floor lamp is on at night (${S.night.lamp.toFixed(2)}), off at noon, half-on at golden hour (${S.golden.lamp.toFixed(2)})`);
  check(await ev(() => { const l = window.__ori.scene.getObjectByProperty('isPointLight', true); return true && window.__ori.scene.children.some((c) => c.children && c.children.some((x) => x.isPointLight)); }), 'the floor lamp holds a real PointLight');
  check(S.night.exposure === S.night.exp, 'renderer exposure is driven by the state');

  // the key light moves (shadows move): compare its position at two times
  const pos = async (h) => { await ev((x) => window.__ori.setTime(x), h); await settle(session, 2); return ev(() => { const l = window.__ori.scene.children.find((c) => c.isDirectionalLight && c.castShadow); return l.position.toArray().map((v) => Math.round(v)); }); };
  const p8 = await pos(8), p13 = await pos(13), p17 = await pos(17);
  check(JSON.stringify(p8) !== JSON.stringify(p13) && JSON.stringify(p13) !== JSON.stringify(p17), `the sun moves across the sky, so shadows move (${p8} → ${p13} → ${p17})`);

  // ── real screenshots differ in brightness and warmth ──
  if (!flat) {
    await ev(() => { const o = window.__ori; o.desktop.reset(); });
    await ev(() => window.__ori.exitScreen());
    await page.waitForFunction(() => window.__ori.state === 'overview', null, { timeout: 20000 });
    const L = {};
    for (const [k, h] of Object.entries(times)) {
      await ev((x) => { window.__ori.setView('overview'); window.__ori.setTime(x); }, h);
      L[k] = await shotLuma(`overview-${k}`);
    }
    check(L.noon.luma > L.morning.luma && L.noon.luma > L.golden.luma && L.golden.luma > L.night.luma, `brightness: noon ${L.noon.luma.toFixed(0)} > golden ${L.golden.luma.toFixed(0)} > night ${L.night.luma.toFixed(0)} (morning ${L.morning.luma.toFixed(0)})`);
    check(L.golden.r / L.golden.b > L.noon.r / L.noon.b + 0.05, `golden hour is warmer than noon (R/B ${(L.golden.r / L.golden.b).toFixed(2)} vs ${(L.noon.r / L.noon.b).toFixed(2)})`);
    check(L.night.b / L.night.r > L.noon.b / L.noon.r + 0.04, `night is bluer than noon (B/R ${(L.night.b / L.night.r).toFixed(2)} vs ${(L.noon.b / L.noon.r).toFixed(2)})`);
    for (const [k, h] of Object.entries(times)) {
      await ev((x) => { window.__ori.setView('window'); window.__ori.setTime(x); }, h);
      await shotLuma(`window-${k}`);
    }
    await ev(() => window.__ori.setView('free'));
  }

  // ── lamp control (T14 will call this) ──
  await ev(() => window.__ori.setTime(23));
  await settle(session, 2);
  await ev(() => window.__ori.daylight.lamp.setOn(false));
  check(await page.waitForFunction(() => window.__ori.daylight.lamp.level < 0.05, null, { timeout: 30000 }).then(() => true).catch(() => false), 'lamp.setOn(false) switches it off even at night');
  await ev(() => window.__ori.daylight.lamp.toggle());
  check(await page.waitForFunction(() => window.__ori.daylight.lamp.level > 0.9, null, { timeout: 30000 }).then(() => true).catch(() => false), 'lamp.toggle() turns it back on');
  await ev(() => window.__ori.daylight.lamp.auto());

  // ── modes: HUD button + T key + persistence + cross-fade (3D mode only: the HUD row is hidden in flat) ──
  if (!flat) {
    await ev(() => window.__ori.daylight.setMode('auto', { instant: true }));
    const order = [];
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => document.getElementById('btn-time').click());
      order.push(await ev(() => window.__ori.daylight.mode));
    }
    check(order.join() === 'day,golden,night,auto', `the HUD sun/moon button cycles the modes (${order.join(' → ')})`);
    check(await ev(() => document.getElementById('btn-time').title.includes('Auto')), 'its tooltip names the current mode');
    await page.keyboard.press('t');
    check((await ev(() => window.__ori.daylight.mode)) === 'day', 'the T key cycles too (while looking at the room)');
    check((await ev(() => window.__ori.core.storage.get('daylight:mode'))) === 'day', 'the mode is persisted');
    // cross-fade: right after switching to night the stars are not yet at full strength, then they arrive
    await ev(() => window.__ori.daylight.setMode('day', { instant: true }));
    await settle(session, 2);
    check((await ev(() => window.__ori.daylight.state.stars)) === 0, 'day mode: no stars');
    await ev(() => window.__ori.daylight.setMode('night'));
    const mid = await page.waitForFunction(() => { const s = window.__ori.daylight.state.stars; return s > 0.05 && s < 0.9 ? s : false; }, null, { timeout: 60000 }).then((h) => h.jsonValue()).catch(() => null);
    await page.waitForFunction(() => window.__ori.daylight.state.stars > 0.95, null, { timeout: 60000 });
    check(mid !== null, `the mode change cross-fades through intermediate states (stars passed through ${mid && mid.toFixed(2)} on the way to 0.96)`);
    await ev(() => window.__ori.daylight.setMode('auto', { instant: true }));
  }

  // typing a "t" in a text field must not change the time of day
  await ev(() => { window.__ori.daylight.setMode('day', { instant: true }); });
  if (!flat) {
    await ev(() => { window.__ori.desktop.root.querySelector('[data-act="spot"]'); });
    await page.evaluate(() => { const i = document.createElement('input'); i.id = 'tmp-in'; document.body.appendChild(i); i.focus(); });
    await page.keyboard.press('t');
    await ev(() => document.getElementById('tmp-in').remove());
    check((await ev(() => window.__ori.daylight.mode)) === 'day', 'typing "t" in an input does not cycle the mode');
  }
  await ev(() => { window.__ori.daylight.setMode('auto', { instant: true }); window.__ori.core.storage.remove('daylight:mode'); });
}
