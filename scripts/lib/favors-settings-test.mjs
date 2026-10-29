// "Ori, Can You...?" browser checks for the settings in the pause menu (T04): the sound slider writes the room's System Settings (volume, mute), the switches work with the
// mouse AND the keyboard (arrows walk the controls, the sideways arrows move the slider), high contrast / reduce motion / key hints apply at once and are still there next game.
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';

export async function runFavorsSettings(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`settings: ${msg}`) : fail(`settings: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const sys = (k) => g((k) => window.__ori.core.system.get(k), k);
  const KEY = 'ori-favors-settings-v1';
  const launch = async () => {
    await g(() => window.__ori.game3d.launch('favors', { quick: true }));
    await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  };
  const menuOpen = () => g(() => { const m = document.querySelector('.g3d-menu:not(.fv-report)'); return !!m && !m.hidden; });
  const active = () => g(() => { const a = document.activeElement; return a ? { tag: a.tagName, type: a.type || '', s: a.dataset.s || '', a: a.dataset.a || '' } : null; });
  const sw = (k) => g((k) => { const b = document.querySelector(`.g3d-menu [data-s="${k}"]`); return b ? { on: b.getAttribute('aria-checked'), text: b.textContent.trim(), value: b.value } : null; }, k);
  const hudHas = (c) => g((c) => document.querySelector('.fv-hud').classList.contains(c), c);

  // a clean start: the room's defaults, nothing remembered
  await g((KEY) => { const s = window.__ori.core.system; s.set('volume', 70); s.set('muted', false); s.set('reduceMotion', false); try { localStorage.removeItem(KEY); } catch { /* nothing to do */ } }, KEY);
  await launch();
  await sleep(300);
  await page.keyboard.press('Escape');
  await sleep(250);
  check(await menuOpen(), 'Esc opens the pause menu');
  const rows = await g(() => ({ set: !!document.querySelector('.g3d-menu .fv-set'), vol: !!document.querySelector('.fv-vol input[type=range]'), sw: document.querySelectorAll('.fv-opt').length }));
  check(rows.set && rows.vol && rows.sw === 5, `the menu has the sound slider and five options: reduce motion, high contrast, sound captions, key hints, resolution (${JSON.stringify(rows)})`);
  const d0 = { v: await sw('volume'), m: await sw('motion'), c: await sw('contrast'), h: await sw('hints') };
  check(d0.v.value === '70' && d0.m.on === 'false' && d0.c.on === 'false' && /Automatic/.test(d0.h.text), `it shows what is set: sound 70, reduce motion off, contrast off, hints automatic (${d0.v.value} / ${d0.m.on} / ${d0.c.on} / ${d0.h.text})`);

  // ── the keyboard: arrows walk the controls (Resume, Restart, Quit, then the slider), the sideways arrows move the slider ──
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  check((await active()).type === 'range', 'three arrows down from Resume land on the sound slider');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await sleep(120);
  check((await sys('volume')) === 60 && !(await sys('muted')) && (await sw('volume')).value === '60', `ArrowLeft x2 lowers the room's volume 70 -> 60 (${await sys('volume')})`);
  await page.keyboard.press('ArrowDown');
  check((await active()).s === 'motion', 'the next arrow moves on to Reduce motion');
  await page.keyboard.press('Enter');
  await sleep(100);
  check((await sys('reduceMotion')) === true && (await sw('motion')).on === 'true' && (await hudHas('calm')), 'Enter on Reduce motion turns the room\'s setting on and stills the HUD');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await sleep(100);
  const st = await g((KEY) => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }, KEY);
  check((await sw('contrast')).on === 'true' && (await hudHas('hc')) && st && st.contrast === true, 'Space on High-contrast turns it on at once and remembers it');

  // ── the mouse: the key hints cycle automatic -> always -> hidden -> automatic ──
  const hintState = () => g(() => { const k = document.querySelector('.fv-keys'); return { gone: k.classList.contains('gone'), off: k.classList.contains('off'), shown: getComputedStyle(k).display !== 'none' }; });
  await page.click('.g3d-menu [data-s="hints"]');
  await sleep(100);
  const hOn = await hintState();
  check(/Always/.test((await sw('hints')).text) && !hOn.gone && !hOn.off, 'Key hints: "Always" keeps the legend up');
  await page.click('.g3d-menu [data-s="hints"]');
  await sleep(100);
  const hOff = await hintState();
  check(/Hidden/.test((await sw('hints')).text) && hOff.gone && !hOff.shown, 'Key hints: "Hidden" removes the legend');
  await page.click('.g3d-menu [data-s="hints"]');
  await sleep(100);
  check(/Automatic/.test((await sw('hints')).text) && !(await hintState()).gone, 'Key hints: back to "Automatic"');
  await page.click('.g3d-menu [data-s="hints"]'); // leave it on Always for the next game
  await sleep(100);
  const resBefore = await sw('resolution');
  await page.click('.g3d-menu [data-s="resolution"]');
  await sleep(100);
  const resFull = await sw('resolution');
  const resSaved = await g((KEY) => { try { return JSON.parse(localStorage.getItem(KEY)).resolution; } catch { return null; } }, KEY);
  check(/Automatic/.test(resBefore.text) && /Full/.test(resFull.text) && resSaved === 'full', `Resolution: Automatic -> Full, remembered (${resBefore.text} -> ${resFull.text})`);
  await page.click('.g3d-menu [data-s="resolution"]');
  await sleep(100);
  check(/Automatic/.test((await sw('resolution')).text), 'and back to Automatic');

  // ── the slider to the bottom is a mute; up again un-mutes ──
  await g(() => { const r = document.querySelector('.fv-vol input'); r.value = '0'; r.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(100);
  check((await sys('volume')) === 0 && (await sys('muted')) === true && (await sw('volume')).value === '0', 'Sound at 0 is the room\'s mute');
  await g(() => { const r = document.querySelector('.fv-vol input'); r.value = '35'; r.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(100);
  check((await sys('volume')) === 35 && (await sys('muted')) === false, 'raising it again un-mutes (35)');
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T04-settings.png') });

  // ── Esc closes the menu; the HUD keeps the settings ──
  await page.keyboard.press('Escape');
  await sleep(250);
  check(!(await menuOpen()) && (await hudHas('hc')) && (await hudHas('calm')), 'Esc closes the menu; high contrast and the still HUD stay');
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T04-highcontrast.png') });

  // ── the next game still has them (the room's settings and this game's own) ──
  await g(() => window.__ori.game3d.quit());
  await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 20000 });
  await launch();
  await sleep(300);
  check((await hudHas('hc')) && (await hudHas('calm')), 'a new game starts with high contrast and the still HUD');
  const hk = await hintState();
  check(!hk.gone && !hk.off, 'and with the key hints still on "Always"');
  await page.keyboard.press('Escape');
  await sleep(250);
  const d1 = { v: await sw('volume'), m: await sw('motion'), c: await sw('contrast'), h: await sw('hints') };
  check(d1.v.value === '35' && d1.m.on === 'true' && d1.c.on === 'true' && /Always/.test(d1.h.text), `the menu shows them too (${d1.v.value} / ${d1.m.on} / ${d1.c.on} / ${d1.h.text})`);

  // ── the save code (T07): copy it, change the game, paste a wrong code (nothing happens), paste the right one (the game is back) ──
  await g(() => { const c = window.__ori.game3d.game.campaign; c.addLove(10); c.eco.earn(77, 'test'); c.pickGolden(2); c.mark('race'); c.save(); });
  const S = () => g(() => window.__ori.game3d.state());
  const mine = await S();
  await page.click('.g3d-menu [data-s="export"]');
  await sleep(150);
  const code = await g(() => document.querySelector('.fv-codebox textarea').value);
  check(/^ORI2-[A-Za-z0-9_-]+-[0-9a-f]{8}$/.test(code) && (await g(() => !document.querySelector('.fv-codebox').hidden)), `"Copy my save code" shows a short code (${code.length} characters)`);
  await g(() => { const c = window.__ori.game3d.game.campaign; c.addLove(-8); c.eco.earn(500, 'test'); c.state.golden = []; });
  const changed = await S();
  check(changed.love !== mine.love && changed.peaches !== mine.peaches, 'the game moved on after the code was made');
  await page.click('.g3d-menu [data-s="import"]');
  await page.fill('.fv-codebox textarea', 'hello there');
  await page.click('.g3d-menu [data-s="load"]');
  await sleep(150);
  const msg = await g(() => document.querySelector('.fv-codebox [data-s="codemsg"]').textContent);
  const stay = await S();
  check(/does not look like a save code/.test(msg) && (await menuOpen()) && stay.peaches === changed.peaches, `a wrong code says so and changes nothing ("${msg}")`);
  await page.fill('.fv-codebox textarea', `  "${code}"  \n`);
  await page.click('.g3d-menu [data-s="load"]');
  await sleep(500);
  const back = await S();
  const toastText = await g(() => document.querySelector('.fv-toasts').textContent);
  const open2 = await menuOpen();
  check(!open2 && back.love === mine.love && back.peaches === mine.peaches && back.golden === mine.golden, `the right code brings the game back (love ${mine.love.toFixed(1)}, ${mine.peaches} peaches, ${mine.golden} golden) and closes the menu (menu open: ${open2}; now love ${back.love}, ${back.peaches} peaches, ${back.golden} golden; toasts: "${toastText}")`);
  check(/Save loaded/.test(toastText), `Ori says the save is loaded ("${toastText}")`);

  // ── a save that cannot be written: told once, in Ori's voice, and the game goes on ──
  await g(() => {
    const orig = Storage.prototype.setItem;
    window.__origSetItem = orig;
    Storage.prototype.setItem = function (k, v) { if (k === 'ori-favors-week-v1') { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e; } return orig.call(this, k, v); };
    const c = window.__ori.game3d.game.campaign; c.save(); c.save(); c.save();
  });
  await sleep(200);
  const fullToasts = await g(() => [...document.querySelectorAll('.fv-toast')].filter((t) => /Storage is full/.test(t.textContent)).length);
  check(fullToasts === 1, `a full storage is told once, not at every autosave (${fullToasts})`);
  await g(() => { Storage.prototype.setItem = window.__origSetItem; });

  // ── a damaged save at the start: the game starts fresh, says so, and keeps the old text aside ──
  await g(() => window.__ori.game3d.quit());
  await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 20000 });
  await g(() => { localStorage.setItem('ori-favors-week-v1', '{broken'); window.__toastLog = new Set(); window.__toastTimer = setInterval(() => { for (const t of document.querySelectorAll('.fv-toast')) window.__toastLog.add(t.textContent); }, 40); }); // (the toast may be gone by the time the world is built: collect them all)
  await g(() => window.__ori.game3d.launch('favors', { quick: true, fresh: false }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await sleep(300);
  const bad = await g(() => { clearInterval(window.__toastTimer); return { kept: localStorage.getItem('ori-favors-week-v1-bad'), toast: [...window.__toastLog].join(' | ') }; });
  check(bad.kept === '{broken' && /scrambled/.test(bad.toast), `a damaged save: the game starts fresh, tells Ori's way, the old text is kept aside (kept: ${JSON.stringify(bad.kept)}; toasts: "${bad.toast}")`);
  await g(() => { try { localStorage.removeItem('ori-favors-week-v1'); localStorage.removeItem('ori-favors-week-v1-bad'); } catch { /* nothing to do */ } });

  // leave the room as it was
  await g((KEY) => { const s = window.__ori.core.system; s.set('volume', 70); s.set('muted', false); s.set('reduceMotion', false); try { localStorage.removeItem(KEY); } catch { /* nothing to do */ } }, KEY);
  await page.keyboard.press('Escape');
  await sleep(150);
}
