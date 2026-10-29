// "Ori, Can You...?" sound captions + the rest of the accessibility pass [experimental], browser checks (T40): the pause menu has a "Sound captions" switch (off by default, a switch in the accessibility tree), the captions
// say the bell, the count, a knock-out, a car horn, the band - and only when the player asked; high contrast reaches the ring's HUD, the map and the journal (measured, not looked at).
import { join } from 'node:path';
import { SHOTS, sleep, settle } from './harness.mjs';

/** In the page: the WCAG contrast ratio of an element's text against what is behind it (the backgrounds of its ancestors laid over black, the ancestors' opacity taken from the text). */
export function contrastOf(sel) {
  const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return [0, 0, 0, 0]; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const over = (t, b) => { const a = t[3] + b[3] * (1 - t[3]); if (a === 0) return [0, 0, 0, 0]; return [0, 1, 2].map((i) => (t[i] * t[3] + b[i] * b[3] * (1 - t[3])) / a).concat([a]); };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const e = document.querySelector(sel);
  if (!e) return null;
  const chain = [];
  let opacity = 1;
  for (let n = e; n && n !== document.documentElement; n = n.parentElement) { const cs = getComputedStyle(n); chain.push(parse(cs.backgroundColor)); opacity *= Number(cs.opacity); }
  let bg = [0, 0, 0, 1];
  for (let i = chain.length - 1; i >= 0; i--) bg = over(chain[i], bg);
  const f0 = parse(getComputedStyle(e).color);
  const fg = over([f0[0], f0[1], f0[2], f0[3] * opacity], bg);
  const [hi, lo] = lum(fg) > lum(bg) ? [lum(fg), lum(bg)] : [lum(bg), lum(fg)];
  return { ratio: (hi + 0.05) / (lo + 0.05), text: (e.textContent || '').trim().slice(0, 24) };
}

export async function runFavorsCaptions(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`captions: ${msg}`) : fail(`captions: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const lines = () => g(() => [...document.querySelectorAll('.fv-cap-line')].map((l) => l.textContent));
  const waitLine = (re, ms = 4000) => page.waitForFunction((src) => [...document.querySelectorAll('.fv-cap-line')].some((l) => new RegExp(src).test(l.textContent)), re.source, { timeout: ms }).then(() => true, () => false);
  const ratio = async (sel) => { const r = await g(contrastOf, sel); return r ? r.ratio : 0; };
  const strong = async (label, sels, min = 7) => { const out = []; for (const s of sels) { const r = await ratio(s); out.push(`${s} ${r.toFixed(1)}`); } check(out.every((x) => Number(x.split(' ').pop()) >= min), `${label}: every text is at least ${min}:1 (${out.join(', ')})`); };
  const openMenu = async () => { await page.keyboard.press('Escape'); await page.waitForFunction(() => window.__ori.game3d.paused, null, { timeout: 3000 }); await sleep(250); };
  const closeMenu = async () => { await page.keyboard.press('Escape'); await page.waitForFunction(() => !window.__ori.game3d.paused, null, { timeout: 3000 }); await sleep(200); };

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.setHour(15); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); });
  await sleep(500);

  // ── the setting: off by default, a switch with a name in the accessibility tree ──
  await openMenu();
  const sw0 = await g(() => { const b = document.querySelector('.g3d-menu [data-s="captions"]'); return b ? { on: b.getAttribute('aria-checked'), role: b.getAttribute('role'), text: b.textContent.trim() } : null; });
  check(!!sw0 && sw0.on === 'false' && sw0.role === 'switch' && /Sound captions/.test(sw0.text), `the pause menu has a "Sound captions" switch, off: ${JSON.stringify(sw0)}`);
  const tree0 = await page.getByRole('dialog', { name: 'Paused' }).ariaSnapshot();
  check(/switch "Sound captions"/.test(tree0) && !/switch "Sound captions" \[checked\]/.test(tree0), 'the accessibility tree has it as a switch that is not checked');
  await closeMenu();
  await g(() => window.__ori.game3d.game.sfx.honk());
  await sleep(500);
  check((await lines()).length === 0, 'with the setting off a car horn says nothing (nothing is shown unasked)');

  // ── on: through the real switch ──
  await openMenu();
  await page.click('.g3d-menu [data-s="captions"]');
  await sleep(200);
  const st = await g(() => ({ on: window.__ori.game3d.game.settings.get().captions, checked: document.querySelector('.g3d-menu [data-s="captions"]').getAttribute('aria-checked') }));
  const tree1 = await page.getByRole('dialog', { name: 'Paused' }).ariaSnapshot();
  check(st.on === true && st.checked === 'true' && /switch "Sound captions" \[checked\]/.test(tree1), 'clicking it turns it on, remembers it, and the tree says it is checked');
  await closeMenu();

  // ── the street: a horn, only once for two quick honks; it goes by itself ──
  await g(() => { window.__ori.game3d.game.sfx.honk(); window.__ori.game3d.game.sfx.honk(); });
  check(await waitLine(/A car horn/), 'a car horn: "A car horn"');
  check((await lines()).filter((t) => /car horn/.test(t)).length === 1, 'two honks in a moment make one line');
  await page.waitForFunction(() => !document.querySelector('.fv-cap-line'), null, { timeout: 6000 }).catch(() => {});
  check((await lines()).length === 0, 'and the line goes away by itself');
  await g(() => { const x = window.__ori.game3d; x.setHour(18); x.teleport('park'); });
  check(await waitLine(/A street band is playing/, 6000), 'in the park at sundown: "A street band is playing"');
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T40-caption-street.png') });
  await g(() => { const x = window.__ori.game3d; x.setHour(15); });

  // ── the ring: the bell, then a knock-out; high contrast reaches its HUD ──
  await g(() => { const gm = window.__ori.game3d.game; const p = gm.fight.apron(); window.__ori.game3d.teleport({ x: p.x, z: p.z }, Math.PI); });
  await sleep(350);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 5000 });
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.phase === 'fight', null, { timeout: 15000 });
  check(await waitLine(/Bell: get ready/, 8000), 'the fight starts with "Bell: get ready" (and "Bell: fight!" for the word FIGHT)');
  await sleep(500);
  await settle(session, 2);
  await page.screenshot({ path: join(SHOTS, 'T40-caption-ring.png') });
  await g(() => window.__ori.game3d.game.settings.set({ contrast: true }));
  await sleep(300);
  check(await g(() => document.getElementById('g3d').classList.contains('fv-hc')), 'high contrast puts its class on the whole overlay, not only the HUD');
  await strong('the ring HUD in high contrast', ['.fi-me .fi-name b', '.fi-me .fi-name span', '.fi-foe .fi-name b', '.fi-foe .fi-name span', '.fi-mid b', '.fi-mid span']);
  await page.screenshot({ path: join(SHOTS, 'T40-highcontrast-ring.png') });
  await g(() => { const f = window.__ori.game3d.game.fight; f.debugEvent({ type: 'count', n: 3, who: 'opp' }); f.debugEvent({ type: 'perfect', who: 'player', target: 'opp' }); });
  check((await waitLine(/The referee counts: 3/)) && (await waitLine(/Perfect dodge!/)), 'the count and a perfect dodge have words, through the real show of the fight');
  await g(() => { const f = window.__ori.game3d.game.fight; f.debugEvent({ type: 'ko', who: 'opp' }); const b = f.bout; b.O.hp = 0; b.O.state = 'ko'; });
  check(await waitLine(/Knock-out!/, 8000), 'the end: "Knock-out!"');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.cardOpen, null, { timeout: 15000 });
  await sleep(700); // (the card scales in over 0.3 s)
  await strong('the result card in high contrast', ['.fi-card h2', '.fi-card .fi-btn.primary']);
  await page.click('.fi-btn.primary');
  await page.waitForFunction(() => !window.__ori.game3d.game.fight.active && !window.__ori.game3d.game.fight.ui.cardOpen, null, { timeout: 12000 }).catch(() => {});
  await sleep(900);
  if (await g(() => window.__ori.game3d.game.fight.ui.menuOpen)) { await page.keyboard.press('Escape'); await page.waitForFunction(() => !window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 4000 }); } // (the card's button brings the ladder back: Esc closes it)
  await sleep(500);

  // ── the map and the journal in high contrast ──
  const dbg = await g(() => { const gm = window.__ori.game3d.game; return JSON.stringify({ paused: gm.paused, phase: gm.fight.phase, active: gm.fight.active, card: gm.fight.ui.cardOpen, menu: gm.fight.ui.menuOpen, over: window.__ori.game3d.state().phase, cap: gm.settings.get().captions }); });
  await page.keyboard.press('KeyM');
  await page.waitForFunction(() => window.__ori.game3d.game.mapUi.isOpen, null, { timeout: 3000 }).catch((e) => { throw new Error(e.message + ' | ' + dbg); });
  await sleep(450);
  await strong('the map in high contrast', ['.mp-card h2', '.mp-list li b', '.mp-list li small', '.mp-card footer small']);
  await page.screenshot({ path: join(SHOTS, 'T40-highcontrast-map.png') });
  await page.keyboard.press('Escape'); await sleep(250);
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.__ori.game3d.game.journal.isOpen, null, { timeout: 3000 });
  await sleep(350);
  await strong('the journal (Life) in high contrast', ['.jr-card h2', '.jr-sub', '.jr-moves li small']);
  await page.keyboard.press('ArrowRight'); await sleep(300);
  await strong('the Wishes page in high contrast', ['.wi b', '.wi small', '.wi-day']);
  await page.keyboard.press('ArrowRight'); await sleep(300);
  await strong('the Achievements page in high contrast', ['.sb small', '.tr small', '.tr b']);
  await page.screenshot({ path: join(SHOTS, 'T40-highcontrast-journal.png') });
  await page.keyboard.press('Escape'); await sleep(250);

  // ── back to normal: the overlay class is gone with the setting ──
  await g(() => window.__ori.game3d.game.settings.set({ contrast: false, captions: false }));
  await sleep(200);
  check(await g(() => !document.getElementById('g3d').classList.contains('fv-hc')), 'turning high contrast off takes the class off the overlay');
  await g(() => window.__ori.game3d.game.sfx.honk());
  await sleep(500);
  check((await lines()).length === 0, 'and with captions off again a horn is silent on screen');
}
