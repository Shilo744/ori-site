// Nobody can HEAR the sound in a test, so it is measured: every sound of the ring (src/game3d/favors/sound-list.js) and the fight music are rendered OFFLINE in the headless
// Chrome (an OfflineAudioContext running the very code the game plays), written to WAV and drawn as a spectrogram PNG, and judged by numbers: no clipping (peak < 0.98), no DC
// offset, a sensible length, a loudness window, where the energy is (a punch needs weight AND snap, a block must be duller than a hit, a bell must ring for seconds), the balance
// between the sounds (a jab < a cross < an uppercut, a block softer than a hit, the music under the hits, the crowd bed far under everything), the music ducking under a hit
// and the slow-motion low-pass.     node scripts/sound-render.mjs [--only=hit-jab,music-fight-3] [--out=shots/sound] [--quiet]
// Look at the pictures (shots/sound/sheet-*.png): the thump of a punch is the bright curve falling from ~150 Hz to ~40 Hz at the left, the snap is the vertical smear above 2 kHz.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as esbuild from 'esbuild';
import { launchBrowser, ROOT } from './lib/harness.mjs';
import { LOUD } from '../src/game3d/favors/sound-list.js';
import { measure, mono, bandShare, powerSpectrum, loudnessA, toWav, toPng, spectrogram, stack } from './lib/audio-analysis.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1];
const only = flag('only') ? new Set(flag('only').split(',')) : null;
const outDir = join(ROOT, flag('out') || 'shots/sound');
const quiet = args.includes('--quiet');
mkdirSync(outDir, { recursive: true });

const bundle = await esbuild.build({ entryPoints: [join(ROOT, 'scripts/lib/sound-render-entry.js')], bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2020', logLevel: 'error' });
const { browser } = await launchBrowser();
const page = await browser.newPage();
await page.setContent('<!doctype html><html><body></body></html>');
await page.addScriptTag({ content: bundle.outputFiles[0].text });

let failures = 0;
const fails = [];
const fail = (id, msg) => { failures++; fails.push(`${id}: ${msg}`); console.error(`  ✗ ${id}: ${msg}`); };
const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : String(v));

/** Decodes a render from the page: { rate, ch: [Float32Array...] }. */
const decode = (r) => ({ rate: r.rate, n: r.n, ch: r.ch.map((b) => { const buf = Buffer.from(b, 'base64'); return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4); }), alive: r.alive });

const list = await page.evaluate(() => window.__sound.list());
const meas = {};
const pics = []; // { group, id, pic }
const rows = [];

function analyse(id, r, { from = 0, expect = {}, group = '' } = {}) {
  const m = mono(r.ch);
  const start = Math.round(from * r.rate);
  const x = start ? m.subarray(start) : m;
  const s = measure(x, r.rate);
  const finite = r.ch.every((c) => c.every(Number.isFinite));
  if (!finite) fail(id, 'NaN / Infinity in the render');
  const peak = Math.max(...r.ch.map((c) => c.reduce((a, v) => Math.max(a, Math.abs(v)), 0)));
  if (peak >= 0.98) fail(id, `clips: peak ${fmt(peak, 3)}`);
  if (peak < 0.01) fail(id, `silent: peak ${fmt(peak, 4)}`);
  if (Math.abs(s.dc) > 0.005) fail(id, `DC offset ${fmt(s.dc, 4)}`);
  const low = bandShare(x, r.rate, 30, 200); const high = bandShare(x, r.rate, 2000, 16000);
  const e = { ...expect };
  const target = LOUD[id];
  if (target != null) e.loud = [target - (id.startsWith('crowd') ? 5 : 4), target + (id.startsWith('crowd') ? 5 : 4)];
  if (e.dur && (s.tail50 < e.dur[0] || s.tail50 > e.dur[1])) fail(id, `lasts ${fmt(s.tail50, 2)} s (-50 dB), wanted ${e.dur[0]}..${e.dur[1]}`);
  if (e.loud && (s.loudA < e.loud[0] || s.loudA > e.loud[1])) fail(id, `loudness ${fmt(s.loudA)} dBFS(A), wanted ${e.loud[0]}..${e.loud[1]}`);
  if (e.band) { const sh = bandShare(x, r.rate, e.band[0], e.band[1]); if (sh < e.band[2]) fail(id, `only ${fmt(sh * 100, 0)}% of the energy in ${e.band[0]}-${e.band[1]} Hz, wanted ${e.band[2] * 100}%`); }
  if (e.max) { const sh = bandShare(x, r.rate, e.max[0], e.max[1]); if (sh > e.max[2]) fail(id, `${fmt(sh * 100, 1)}% of the energy in ${e.max[0]}-${e.max[1]} Hz, at most ${e.max[2] * 100}%`); }
  if (e.centroid && (s.centroid < e.centroid[0] || s.centroid > e.centroid[1])) fail(id, `centroid ${fmt(s.centroid, 0)} Hz, wanted ${e.centroid[0]}..${e.centroid[1]}`);
  if (e.peakAt && (s.peakAt < e.peakAt[0] || s.peakAt > e.peakAt[1])) fail(id, `loudest at ${fmt(s.peakAt, 2)} s, wanted ${e.peakAt[0]}..${e.peakAt[1]}`);
  const bands = [[30, 120], [120, 500], [500, 2000], [2000, 6000], [6000, 16000]].map(([a, b]) => bandShare(x, r.rate, a, b));
  meas[id] = { ...s, peak, low, high, bands, rate: r.rate };
  rows.push([id, fmt(20 * Math.log10(peak)), fmt(s.dc * 1000, 2), fmt(s.tail50, 2), fmt(s.loudA), fmt(s.centroid, 0), bands.map((b) => fmt(b * 100, 0).padStart(3)).join(' '), target != null ? fmt(target - s.loudA) : '']);
  writeFileSync(join(outDir, `${id}.wav`), toWav(r.ch, r.rate));
  const pic = spectrogram(m, r.rate, { seconds: from ? null : e.long ? null : Math.min(m.length / r.rate, Math.max(0.4, s.tail50 + 0.25)) });
  writeFileSync(join(outDir, `${id}.png`), toPng(pic.w, pic.h, pic.rgba));
  pics.push({ group, id, pic });
  return { s, x };
}

for (const s of list.sounds) {
  if (only && !only.has(s.id)) continue;
  analyse(s.id, decode(await page.evaluate((id) => window.__sound.sfx(id), s.id)), s);
}
for (const m of list.music) {
  if (only && !only.has(m.id)) continue;
  const r = decode(await page.evaluate((id) => window.__sound.music(id), m.id));
  analyse(m.id, r, { group: 'Music', expect: { long: true } });
}
for (const s of list.stings) {
  if (only && !only.has(s.id)) continue;
  analyse(s.id, decode(await page.evaluate((id) => window.__sound.sting(id), s.id)), { group: 'Music', expect: { dur: [0.8, 3.4] } });
}

// ── the balance between the sounds ──
const L = (id) => meas[id] && meas[id].loudA;
const rel = (name, ok, detail) => { if (!ok) fail('balance', `${name} ${detail || ''}`); };
if (!only) {
  rel('a jab is softer than a cross', L('hit-jab') + 0.8 <= L('hit-cross'), `(${fmt(L('hit-jab'))} vs ${fmt(L('hit-cross'))})`);
  rel('a cross is softer than an uppercut', L('hit-cross') + 0.8 <= L('hit-upper'), `(${fmt(L('hit-cross'))} vs ${fmt(L('hit-upper'))})`);
  rel('an uppercut is softer than a counter', L('hit-upper') <= L('hit-counter') + 0.5, `(${fmt(L('hit-upper'))} vs ${fmt(L('hit-counter'))})`);
  rel('a block is softer than a jab', L('block-light') + 2 <= L('hit-jab'), `(${fmt(L('block-light'))} vs ${fmt(L('hit-jab'))})`);
  rel('a whoosh is softer than the hit it announces', L('whoosh-cross') + 3 <= L('hit-cross'), `(${fmt(L('whoosh-cross'))} vs ${fmt(L('hit-cross'))})`);
  rel('the murmur bed is far below a jab', L('crowd-high') + 14 <= L('hit-jab'), `(${fmt(L('crowd-high'))} vs ${fmt(L('hit-jab'))})`);
  rel('more love, a louder crowd (but not by much)', L('crowd-high') > L('crowd-low') + 1.5 && L('crowd-high') < L('crowd-low') + 14, `(${fmt(L('crowd-low'))} -> ${fmt(L('crowd-high'))})`);
  rel('the bell stands in the mix like a cross', Math.abs(L('bell-1') - L('hit-cross')) <= 9, `(${fmt(L('bell-1'))} vs ${fmt(L('hit-cross'))})`);
  rel('the K.O. is the biggest thing in the ring', L('ko-opp') >= L('hit-upper') - 1.5, `(${fmt(L('ko-opp'))} vs ${fmt(L('hit-upper'))})`);
  rel('the full-on music sits under the hits', L('music-fight-3') + 2 <= L('hit-cross') && L('music-fight-3') >= L('hit-cross') - 20, `(${fmt(L('music-fight-3'))} vs ${fmt(L('hit-cross'))})`);
  rel('each layer adds to the music', L('music-fight-0') < L('music-fight-1') + 0.2 && L('music-fight-1') < L('music-fight-2') + 0.2 && L('music-fight-2') < L('music-fight-3') + 0.2, `(${[0, 1, 2, 3].map((i) => fmt(L(`music-fight-${i}`))).join(' / ')})`);
  rel('the boss music is as loud as the fight music (+-4 dB)', Math.abs(L('music-boss-3') - L('music-fight-3')) <= 4, `(${fmt(L('music-boss-3'))} vs ${fmt(L('music-fight-3'))})`);
  rel('a slow-motion hit has no top', meas['hit-slowmo'].high < meas['hit-cross'].high / 5, `(${fmt(meas['hit-slowmo'].high * 100, 2)}% vs ${fmt(meas['hit-cross'].high * 100, 2)}%)`);
  rel('a block is duller than a hit', meas['block-heavy'].centroid < meas['hit-cross'].centroid, `(${fmt(meas['block-heavy'].centroid, 0)} vs ${fmt(meas['hit-cross'].centroid, 0)} Hz)`);
  rel('the parry is brighter than the hit', meas.parry.centroid > meas['hit-cross'].centroid * 1.5, `(${fmt(meas.parry.centroid, 0)} vs ${fmt(meas['hit-cross'].centroid, 0)} Hz)`);
  rel('a bell outlasts a punch', meas['bell-1'].tail50 > meas['hit-upper'].tail50 + 0.5, `(${fmt(meas['bell-1'].tail50, 2)} vs ${fmt(meas['hit-upper'].tail50, 2)} s)`);
}

// ── scenarios: ducking, slow motion, the whole mix ──
if (!only || only.has('scenarios')) {
  const win = (x, rate, a, b) => x.subarray(Math.round(a * rate), Math.round(b * rate));
  {
    const r = decode(await page.evaluate(() => window.__sound.scenario('duck'))); const x = mono(r.ch);
    const before = loudnessA(win(x, r.rate, 2.4, 2.95), r.rate); const during = loudnessA(win(x, r.rate, 3.08, 3.3), r.rate); const after = loudnessA(win(x, r.rate, 4.7, 5.5), r.rate);
    rel('the music ducks under a big hit', during <= before - 6, `(before ${fmt(before)}, during ${fmt(during)} dB)`);
    rel('...and comes back', after >= before - 2.5, `(before ${fmt(before)}, after ${fmt(after)} dB)`);
    console.log(`  duck: before ${fmt(before)}  during ${fmt(during)}  after ${fmt(after)} dBFS(A)`);
    analyse('scenario-duck', r, { group: 'Scenarios', expect: { long: true } });
  }
  {
    const r = decode(await page.evaluate(() => window.__sound.scenario('slow'))); const x = mono(r.ch);
    const ref = mono(decode(await page.evaluate(() => window.__sound.scenario('slow-ref'))).ch); // (the same music without the slow motion)
    const topE = (sig, a, b) => { const w = win(sig, r.rate, a, b); const { power, df } = powerSpectrum(w, r.rate); let e = 0; for (let k = 1; k < power.length; k++) if (k * df >= 3000) e += power[k]; return 10 * Math.log10(e + 1e-18); };
    const during = topE(x, 3.3, 4.8) - topE(ref, 3.3, 4.8); const after = topE(x, 5.4, 6.8) - topE(ref, 5.4, 6.8); const before = topE(x, 2.0, 2.9) - topE(ref, 2.0, 2.9);
    rel('slow motion takes the top off the mix', during <= -18, `(>3 kHz vs the same music: ${fmt(during)} dB while it lasts)`);
    rel('...and it opens up again', Math.abs(after) <= 3 && Math.abs(before) <= 3, `(before ${fmt(before)}, after ${fmt(after)} dB)`);
    console.log(`  slow-mo: >3 kHz against the same music: before ${fmt(before)}  during ${fmt(during)}  after ${fmt(after)} dB`);
    analyse('scenario-slow', r, { group: 'Scenarios', expect: { long: true } });
  }
  {
    const r = decode(await page.evaluate(() => window.__sound.scenario('mix')));
    analyse('scenario-mix', r, { group: 'Scenarios', expect: { loud: [-30, -6], long: true } });
    console.log(`  mix: peak ${fmt(20 * Math.log10(meas['scenario-mix'].peak))} dBFS, ${r.alive} voices still alive at the end of the render`);
  }
}

// ── the pictures: one sheet per group ──
const groups = [...new Set(pics.map((p) => p.group))];
for (const g of groups) {
  const mine = pics.filter((p) => p.group === g);
  for (let i = 0; i < mine.length; i += 6) {
    const part = mine.slice(i, i + 6);
    const sheet = stack(part.map((p) => p.pic));
    writeFileSync(join(outDir, `sheet-${g.toLowerCase().replace(/[^a-z]+/g, '-')}${mine.length > 6 ? `-${i / 6 + 1}` : ''}.png`), toPng(sheet.w, sheet.h, sheet.rgba));
    if (!quiet) console.log(`  sheet ${g}${mine.length > 6 ? ` ${i / 6 + 1}` : ''}: ${part.map((p) => p.id).join(', ')}`);
  }
}
writeFileSync(join(outDir, 'report.json'), JSON.stringify(meas, null, 1));

console.log('\n  id                 peak dB   DC(m)  -50dB s  loud dBA  centroid  energy %: 30-120 120-500 .5-2k 2-6k 6-16k');
for (const r of rows) console.log(`  ${r[0].padEnd(18)} ${r[1].padStart(7)} ${r[2].padStart(7)} ${r[3].padStart(7)} ${r[4].padStart(9)} ${r[5].padStart(9)}             ${r[6]}   ${r[7] ? `trim ${r[7]} dB` : ''}`);
await browser.close();
console.log(failures ? `\nSOUND RENDER FAILED (${failures})\n${fails.map((f) => `  - ${f}`).join('\n')}` : `\nSOUND RENDER OK: ${rows.length} renders in ${outDir}`);
process.exit(failures ? 1 : 0);
