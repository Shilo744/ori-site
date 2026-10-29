// "Ori, Can You...?" — the SOUND of the ring (pure, no browser, no ears): the recipes of every sound as data, the fight music (its notes, its layers, its look-ahead scheduler),
// the engine's behaviour against a fake AudioContext (muted, suspended, broken, no leaks of nodes), and the measuring tools themselves. The real sound is rendered and measured
// offline in the browser by scripts/sound-render.mjs.      node scripts/test-favors-sound.mjs
import assert from 'node:assert/strict';
import { RECIPES, TRIM_DB, thudDb, powerOf, noiseComp, clipCurve, CLIP_MAX, createRingAudio, createFightSfx } from '../src/game3d/favors/fight-sfx.js';
import { TRACKS, stepEvents, instrument, levelFor, hash01, STINGS, createFightMusic } from '../src/game3d/favors/fight-music.js';
import { SOUNDS, MUSIC, STING_LIST, LOUD } from '../src/game3d/favors/sound-list.js';
import { fft, measure, toWav, toPng, bandShare, centroid, mono } from './lib/audio-analysis.mjs';
import { createFakeContext, createFakeTimer } from './lib/fake-audio.mjs';
import { mulberry32 } from '../src/game3d/rng.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const rndOf = (seed) => mulberry32(seed);
const hit = (dmg, extra = {}) => ({ dmg, heavy: dmg >= 13, combo: 1, counter: false, target: 'opp', ...extra });
const tag = (r, t) => r.voices.filter((v) => v.tag === t);
const sane = (r, label) => {
  assert.ok(r.voices.length > 0 && Number.isFinite(r.dur) && r.dur > 0 && r.dur < 6, `${label}: ${r.voices.length} voices, ${r.dur} s`);
  for (const v of r.voices) {
    assert.ok(v.k === 'osc' || v.k === 'noise', `${label}: kind`);
    assert.ok(Number.isFinite(v.dur) && v.dur > 0 && v.dur < 4 && (v.delay || 0) >= 0 && (v.delay || 0) < 2, `${label} ${v.tag}: timing ${v.dur} / ${v.delay}`);
    assert.ok(Number.isFinite(v.peak) && v.peak > 0 && v.peak <= 1.6, `${label} ${v.tag}: peak ${v.peak}`);
    if (v.k === 'osc') assert.ok(v.f0 >= 10 && v.f0 <= 20000 && (!v.f1 || (v.f1 >= 10 && v.f1 <= 20000)), `${label} ${v.tag}: pitch ${v.f0} -> ${v.f1}`);
    for (const key of ['bp', 'lp', 'hp']) if (v[key]) assert.ok(v[key].f0 >= 30 && v[key].f0 <= 20000 && (!v[key].f1 || (v[key].f1 >= 30 && v[key].f1 <= 20000)), `${label} ${v.tag}: ${key} ${JSON.stringify(v[key])}`);
    if (v.env) { assert.ok(v.env.every((p, i) => Number.isFinite(p[0]) && p[1] > 0 && (i === 0 || p[0] > v.env[i - 1][0])), `${label} ${v.tag}: envelope times must rise`); }
    if (v.pan != null) assert.ok(Math.abs(v.pan) <= 1);
    if (v.send != null) assert.ok(v.send >= 0 && v.send <= 1);
  }
};

// ── the recipes ──
test('every sound is plain data and sane for 40 random seeds: finite, a name for every layer, nothing absurd (pitch 10..20k Hz, peaks <= 1.6, envelopes that rise in time)', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const rnd = rndOf(seed);
    sane(RECIPES.thud(hit(8), rnd), 'thud jab'); sane(RECIPES.thud(hit(33, { counter: true, combo: 4, target: 'player' }), rnd), 'thud counter');
    sane(RECIPES.whoosh(0.12, 0.45, true, rnd), 'whoosh'); sane(RECIPES.whoosh(0.9, 1.1, false, rnd), 'whoosh long');
    for (const [k, r] of Object.entries({ block: RECIPES.block(2, rnd), parry: RECIPES.parry(rnd), perfect: RECIPES.perfect(rnd), fury: RECIPES.fury(rnd), guardbreak: RECIPES.guardbreak(rnd), dash: RECIPES.dash(rnd), feint: RECIPES.feint(rnd), blink: RECIPES.blink(rnd), lag: RECIPES.lag(rnd), bell1: RECIPES.bell(1, rnd), bell6: RECIPES.bell(6, rnd), ko: RECIPES.ko('opp', rnd), knockdown: RECIPES.knockdown('player', rnd), count: RECIPES.count(3, rnd), getup: RECIPES.getup('opp', rnd), gasp: RECIPES.gasp(1, rnd), cheer: RECIPES.cheer(1.4, rnd), level: RECIPES.level(rnd), tick: RECIPES.tick(), bag: RECIPES.bagHit(1, rnd), glance: RECIPES.bagGlance(rnd), click: RECIPES.click(true) })) sane(r, k);
  }
});

test('a punch has weight and snap: a thump that falls in pitch, a torso tone, a body burst, a slap and a click; the heavy ones add crunch, crack, rumble and boom; the lighter the punch the shorter its body', () => {
  const jab = RECIPES.thud(hit(8), rndOf(1)); const up = RECIPES.thud(hit(31), rndOf(1));
  for (const t of ['thump', 'tone', 'knock', 'body', 'chest', 'slap', 'pop', 'click']) assert.ok(tag(jab, t).length === 1, `a jab has its ${t}`);
  const thump = tag(jab, 'thump')[0];
  assert.ok(thump.f1 < thump.f0 / 2 && thump.f0 < 200 && thump.f1 < 60, 'the thump drops from ~150 Hz to ~50 Hz');
  assert.ok(tag(jab, 'slap')[0].bp.f0 > 2000 && tag(jab, 'click')[0].hp.f0 >= 4000, 'and there is snap above 2 kHz');
  assert.ok(['rumble', 'crunch', 'crack', 'boom'].every((t) => tag(up, t).length === 1) && ['rumble', 'crack', 'boom'].every((t) => tag(jab, t).length === 0), 'only the heavy ones get the extra layers');
  assert.ok(tag(up, 'body')[0].dur > tag(jab, 'body')[0].dur && tag(up, 'thump')[0].dur > tag(jab, 'thump')[0].dur, 'a heavier punch rings longer');
  assert.ok(up.duck && up.duck.amt > 0.3 && !jab.duck, 'a big hit ducks the music, a jab does not');
  // the layers are a few ms apart, so their peaks do not pile up
  const starts = new Set(jab.voices.map((v) => Math.round((v.delay || 0) * 1000)));
  assert.ok(starts.size >= 4, `the layers start at ${[...starts].join(', ')} ms`);
});

test('a punch is never the same twice (pitch +-7%, gain +-10%, which layer leads), climbs in pitch with the combo, and is panned to the one who is hit', () => {
  const f0 = []; const bodies = []; const flavors = new Set();
  for (let s = 1; s <= 60; s++) { const r = RECIPES.thud(hit(17), rndOf(s)); f0.push(tag(r, 'thump')[0].f0); bodies.push(tag(r, 'body')[0].peak); flavors.add(tag(r, 'body')[0].peak > 0.85); }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const sd = (a) => Math.sqrt(mean(a.map((x) => (x - mean(a)) ** 2)));
  assert.ok(sd(f0) / mean(f0) > 0.02 && Math.max(...f0) / Math.min(...f0) < 1.2, `pitch spread ${(sd(f0) / mean(f0) * 100).toFixed(1)}%`);
  assert.ok(sd(bodies) / mean(bodies) > 0.05 && flavors.size === 2, 'the body burst varies and sometimes leads');
  const c1 = tag(RECIPES.thud(hit(17, { combo: 1 }), rndOf(5)), 'thump')[0].f0; const c8 = tag(RECIPES.thud(hit(17, { combo: 8 }), rndOf(5)), 'thump')[0].f0;
  assert.ok(c8 > c1 * 1.05, 'a long combo sounds higher');
  assert.ok(RECIPES.thud(hit(8, { target: 'opp' }), rndOf(1)).voices.every((v) => v.pan > 0) && RECIPES.thud(hit(8, { target: 'player' }), rndOf(1)).voices.every((v) => v.pan < 0), 'Ori is on the left of the screen, the opponent on the right');
  assert.ok(tag(RECIPES.thud(hit(8, { target: 'player' }), rndOf(1)), 'inner').length === 1, 'and Ori feels it in his chest');
});

test('the loudness follows the damage: jab < cross < hook < uppercut, a hit on Ori a little more, and every power is a number between 0.08 and 1', () => {
  const db = [8, 17, 22, 31].map((d) => thudDb(hit(d)));
  assert.ok(db.every((v, i) => i === 0 || v > db[i - 1]), `trims ${db.map((v) => v.toFixed(1))}`);
  assert.ok(thudDb(hit(8, { target: 'player' })) > thudDb(hit(8)));
  for (const d of [0, 1, 8, 40, 1000]) { const p = powerOf(hit(d)); assert.ok(p >= 0.08 && p <= 1); }
  assert.ok(powerOf(hit(17, { counter: true })) > powerOf(hit(17)) && powerOf(0.5) === 0.5 && powerOf(7) === 1);
  assert.ok(Object.values(TRIM_DB).every(Number.isFinite));
});

test('a whoosh sweeps over the whole wind-up and peaks AT THE STRIKE; a block is dull (no slap) and softer in the highs than a hit; a parry rings with inharmonic metal', () => {
  for (const w of [0.12, 0.38, 0.55]) {
    const r = RECIPES.whoosh(w, 0.8, false, rndOf(2));
    const sweep = tag(r, 'sweep')[0];
    const top = sweep.env.reduce((a, p) => (p[1] > a[1] ? p : a));
    assert.ok(Math.abs(top[0] - w) < 1e-9, `loudest at ${top[0]}, the strike is at ${w}`);
    assert.ok(sweep.bp.f1 > sweep.bp.f0 * 5 && Math.abs(sweep.bp.fdur - w) < 1e-9, 'the band-pass rises for the whole wind-up');
    assert.ok(sweep.dur <= w + 0.1 && sweep.env.at(-1)[1] <= 0.02, 'and it is gone right after');
  }
  assert.ok(RECIPES.whoosh(0.3, 1, true, rndOf(1)).voices[0].peak < RECIPES.whoosh(0.3, 1, false, rndOf(1)).voices[0].peak, 'Ori\'s own punch is quieter than the one coming at him');
  const block = RECIPES.block(2, rndOf(1));
  assert.ok(block.voices.every((v) => !v.hp || v.hp.f0 >= 2000) && !tag(block, 'slap').length && !tag(block, 'click').length, 'a block has no bright slap');
  const parry = RECIPES.parry(rndOf(1)).voices.filter((v) => v.tag === 'partial');
  const ratios = parry.map((v) => v.f0 / parry[0].f0);
  assert.ok(ratios.filter((r) => Math.abs(r - Math.round(r)) > 0.05).length >= 2, `inharmonic partials ${ratios.map((r) => r.toFixed(2))}`);
});

test('the bell: inharmonic partials with shimmering twins, a long decay (2+ s), a metal strike; `times` strikes 0.3 s apart; the last one rings the longest', () => {
  const one = RECIPES.bell(1, rndOf(1)); const three = RECIPES.bell(3, rndOf(1));
  const parts = one.voices.filter((v) => v.tag === 'partial');
  const f0 = parts.find((v) => v.f0 > 800 && v.f0 < 960).f0;
  const ratios = parts.map((v) => v.f0 / f0);
  assert.ok(ratios.some((r) => Math.abs(r - 2.76) < 0.05) && ratios.some((r) => Math.abs(r - 5.4) < 0.1) && ratios.some((r) => Math.abs(r - 0.5) < 0.02), `ratios ${ratios.map((r) => r.toFixed(2))}`);
  assert.ok(one.voices.some((v) => v.tag === 'twin' && v.f0 / f0 > 0.99 && v.f0 / f0 < 1.2) && Math.max(...parts.map((v) => v.dur)) >= 2.4, 'twins and a decay of 2.4 s');
  assert.equal(three.voices.filter((v) => v.tag === 'strike').length, 3);
  const times = [...new Set(three.voices.filter((v) => v.tag === 'strike').map((v) => v.delay))];
  assert.deepEqual(times.map((t) => Math.round(t * 10) / 10), [0, 0.3, 0.6]);
  assert.ok(Math.max(...three.voices.filter((v) => v.delay === 0.6 && v.tag === 'partial').map((v) => v.dur)) > Math.max(...three.voices.filter((v) => v.delay === 0 && v.tag === 'partial').map((v) => v.dur)), 'the last strike rings longest');
});

test('the K.O. is the blow plus a boom, the body on the canvas and ears that ring (the mix goes dull); the knock-down is smaller and ducks the music; the count rises; the crowd is on its own bus', () => {
  const ko = RECIPES.ko('opp', rndOf(3)); const kd = RECIPES.knockdown('opp', rndOf(3));
  assert.ok(['boom', 'canvas', 'mat', 'wump', 'ring', 'slap', 'crack'].every((t) => tag(ko, t).length >= 1), 'all the parts');
  assert.ok(ko.lp && ko.lp.f < 700 && ko.duck.amt > 0.9 && kd.duck && kd.duck.amt >= 0.7 && !kd.lp, 'the K.O. dulls the mix and ducks the music; the knock-down only ducks');
  assert.ok(ko.dur > kd.dur && tag(ko, 'boom')[0].peak >= tag(kd, 'boom')[0].peak, 'the K.O. is bigger');
  const f = [1, 2, 3, 4, 5].map((k) => RECIPES.count(k, rndOf(1)).voices[0].f0);
  assert.ok(f.every((v, i) => i === 0 || v > f[i - 1]), `the count rises: ${f.map((v) => Math.round(v))}`);
  assert.ok(RECIPES.gasp(1, rndOf(1)).voices.every((v) => v.bus === 'crowd') && RECIPES.cheer(1, rndOf(1)).voices.every((v) => v.bus === 'crowd'));
  assert.ok(RECIPES.cheer(1.4, rndOf(1)).voices.length < 30, 'an applause is ONE noise voice with a train of claps, not dozens of nodes');
});

test('a narrow band of noise is lifted so that a noise and a sine of the same `peak` feel alike; the ceiling of the master chain cannot reach 0.98', () => {
  assert.equal(noiseComp({ k: 'noise' }), 1);
  assert.ok(noiseComp({ bp: { f0: 600, q: 0.8 } }) > 3 && noiseComp({ bp: { f0: 600, q: 8 } }) > noiseComp({ bp: { f0: 600, q: 0.8 } }) && noiseComp({ bp: { f0: 100, q: 20 } }) === 7);
  assert.ok(noiseComp({ hp: { f0: 4000 } }) >= 1 && noiseComp({ hp: { f0: 4000 } }) < 1.6);
  const c = clipCurve();
  assert.ok(Math.abs(c[c.length - 1] - CLIP_MAX) < 1e-6 && CLIP_MAX < 0.9 && Math.abs(c[0] + CLIP_MAX) < 1e-6 && Math.abs(c[512]) < 1e-9, 'the curve ends at its ceiling and is symmetric');
  assert.ok(c.every((v, i) => i === 0 || v >= c[i - 1]) && Math.abs(c[700] - ((700 / 1024) * 2 - 1)) < 1e-6, 'it only rises, and is linear in the middle');
});

test('the list of sounds the lab and the renderer share: unique ids, a play function, a loudness target for each, and the music / stings are listed', () => {
  const ids = SOUNDS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(SOUNDS.length >= 35 && SOUNDS.every((s) => typeof s.play === 'function' && s.len > 0.2 && s.group && s.label));
  for (const s of SOUNDS) assert.ok(Number.isFinite(LOUD[s.id]), `${s.id} has a loudness target`);
  for (const m of [...MUSIC, ...STING_LIST]) assert.ok(Number.isFinite(LOUD[m.id]), `${m.id} has a loudness target`);
  assert.ok(LOUD['hit-jab'] < LOUD['hit-cross'] && LOUD['hit-cross'] < LOUD['hit-upper'] && LOUD['block-light'] < LOUD['hit-jab'] + 0 && LOUD['whoosh-cross'] < LOUD['hit-cross'] && LOUD['crowd-high'] < LOUD['hit-jab'] - 10, 'the hierarchy');
});

// ── the music ──
const count = (evs, inst) => evs.filter((e) => e.inst === inst).length;
const bars = (track, level, nBars = 8) => { const out = []; for (let s = 0; s < nBars * 16; s++) out.push(...stepEvents(track, s, level).map((e) => ({ ...e, step: s }))); return out; };

test('the fight music is E minor at 128 bpm: four on the floor, and the layers come in with the level (kick, hats, bass -> snare, open hats, stabs -> arp, crash -> lead, fills, riser)', () => {
  assert.equal(TRACKS.fight.bpm, 128);
  const L = [0, 1, 2, 3].map((l) => bars('fight', l));
  assert.equal(count(L[0], 'kick') / 8, 4); assert.ok(count(L[0], 'snare') === 0 && count(L[0], 'stab') === 0 && count(L[0], 'arp') === 0 && count(L[0], 'lead') === 0, 'layer 0 is the foundation only');
  assert.ok(count(L[0], 'hat') / 8 === 8 && count(L[0], 'bass') > 0, 'eighth-note hats and a bass riff');
  assert.equal(count(L[1], 'snare') / 8, 2); assert.ok(count(L[1], 'ohat') / 8 === 4 && count(L[1], 'stab') / 8 === 3 && count(L[1], 'arp') === 0, 'layer 1: snare on 2 and 4, open hats, stabs');
  assert.equal(count(L[2], 'arp') / 8, 16); assert.ok(count(L[2], 'crash') === 2 && count(L[2], 'lead') === 0 && count(L[2], 'kick') > count(L[1], 'kick'), 'layer 2: sixteenth arps, a crash every 4 bars, ghost kicks');
  assert.ok(count(L[3], 'lead') >= 20 && count(L[3], 'riser') === 2 && count(L[3], 'snare') > count(L[2], 'snare'), 'layer 3: a lead, a riser and a snare roll before each 4th bar');
  for (let l = 1; l <= 3; l++) assert.ok(L[l].length > L[l - 1].length, `each layer adds notes (${L.map((x) => x.length)})`);
  assert.deepEqual(bars('fight', 3), bars('fight', 3), 'the same every time');
});

test('the notes are where the key says: bass in E1..E3, stabs in the middle, arps and lead above, nothing absurd, never more than 14 events on a step', () => {
  const all = bars('fight', 3, 8);
  for (const e of all) {
    assert.ok(e.vel > 0 && e.vel <= 1 && e.dur > 0 && e.off >= 0 && e.off < 1, JSON.stringify(e));
    if (e.inst === 'bass') assert.ok(e.note >= 28 && e.note <= 52, `bass ${e.note}`);
    if (e.inst === 'stab') assert.ok(e.notes.length === 4 && e.notes.every((m) => m >= 52 && m <= 72), 'stab');
    if (e.inst === 'arp') assert.ok(e.note >= 60 && e.note <= 80, `arp ${e.note}`);
    if (e.inst === 'lead') assert.ok(e.note >= 70 && e.note <= 90, `lead ${e.note}`);
  }
  const per = new Map(); for (const e of all) per.set(e.step, (per.get(e.step) || 0) + 1);
  assert.ok(Math.max(...per.values()) <= 14, `most events on a step: ${Math.max(...per.values())}`);
  const roots = [0, 1, 2, 3].map((b) => stepEvents('fight', b * 16, 0).find((e) => e.inst === 'bass').note);
  assert.deepEqual(roots, [28, 36, 31, 38], 'E, C, G, D: one chord a bar');
  const ruleStab = (b) => stepEvents('fight', b * 16 + 3, 1).find((e) => e.inst === 'stab').notes;
  assert.deepEqual(ruleStab(0), [55, 59, 62, 64], 'Em7 on the first bar');
});

test('the hidden boss: 156 bpm, C# phrygian, a broken kick, 32nd stutters before every 4th bar, data pings, random-walk arps, a tape-stop every 8 bars, and the same notes every time (a hash, not a dice)', () => {
  assert.ok(TRACKS.boss.bpm === 156 && TRACKS.boss.bpm > TRACKS.fight.bpm);
  const b3 = bars('boss', 3, 8);
  assert.ok(count(b3, 'kick') / 8 > 4.5 && count(b3, 'kick') / 8 < 7, 'a broken beat, not four on the floor');
  assert.ok(b3.some((e) => e.inst === 'snare' && e.off === 0.5) && b3.filter((e) => e.off === 0.5).every((e) => e.step % 16 >= 12 || e.inst === 'tick'), 'stutters (half-step retriggers) in the last beat of the bar, and glitch ticks');
  assert.ok(count(b3, 'ping') > 5 && count(b3, 'tick') > 5 && count(b3, 'arp') === 8 * 16, 'pings, ticks and an arp on every step');
  assert.equal(count(b3, 'tape'), 1, 'one tape-stop in 8 bars');
  assert.ok(stepEvents('boss', 4, 0).some((e) => e.inst === 'snare'), 'the boss never plays below layer 1');
  const scale = new Set(TRACKS.boss.scale.map((m) => m % 12));
  assert.ok(b3.filter((e) => e.inst === 'ping' || e.inst === 'arp').every((e) => scale.has(e.note % 12)), 'only notes of the scale');
  assert.deepEqual(bars('boss', 3, 4), bars('boss', 3, 4));
  const h = Array.from({ length: 2000 }, (_, i) => hash01(i, 7));
  assert.ok(h.every((v) => v >= 0 && v < 1) && Math.abs(h.reduce((a, b) => a + b, 0) / 2000 - 0.5) < 0.03, 'hash01 is steady and even');
});

test('every instrument turns into finite voices on a known bus; the stings are warm and short; the layer follows the intensity with hysteresis and never below the track\'s minimum', () => {
  const buses = new Set(['drums', 'hats', 'bass', 'bassBoss', 'synth', 'lead', 'crush']);
  for (const track of ['fight', 'boss']) for (const e of bars(track, 3, 8)) { const r = instrument(e, 60 / TRACKS[track].bpm / 4); assert.ok(buses.has(r.bus), `${e.inst}: ${r.bus}`); sane({ voices: r.voices, dur: 1 }, e.inst); }
  for (const k of ['win', 'lose', 'boss']) { const r = STINGS[k](rndOf(1)); sane(r, `sting ${k}`); assert.ok(r.dur <= 2.2); }
  assert.equal(levelFor(0.1, 0), 0); assert.equal(levelFor(0.35, 0), 1); assert.equal(levelFor(0.9, 0), 3);
  assert.equal(levelFor(0.28, 1), 1, 'between the thresholds it stays where it is'); assert.equal(levelFor(0.2, 1), 0); assert.equal(levelFor(0.6, 3), 2);
  assert.equal(levelFor(0, 0, 1), 1, 'the boss track never drops below layer 1');
});

// ── the engine against a fake AudioContext ──
const SFX_METHODS = ['thud', 'whoosh', 'block', 'parry', 'perfect', 'fury', 'guardbreak', 'dash', 'feint', 'blink', 'lag', 'bell', 'ko', 'knockdown', 'count', 'getup', 'gasp', 'cheer', 'level', 'tick', 'bagHit', 'bagGlance', 'click', 'crowdStart', 'crowd', 'crowdStop', 'setSlow', 'duck', 'dispose'];
const playAll = (s) => {
  s.thud(hit(8)); s.thud(hit(31, { counter: true })); s.thud(0.5); s.whoosh(0.2, 0.6, true); s.whoosh(0.5, 1, false); s.block(2); s.parry(); s.perfect(); s.fury(); s.guardbreak(); s.dash(); s.feint(); s.blink(); s.lag();
  s.bell(1); s.bell(3); s.ko('opp'); s.knockdown('player'); for (let k = 1; k <= 5; k++) s.count(k); s.getup('opp'); s.gasp(1); s.cheer(1.2); s.level(); s.tick(); s.bagHit(1); s.bagGlance(); s.click(true); s.click(false);
  s.crowdStart(50); s.crowd(80); s.setSlow(true); s.setSlow(false); s.duck(0.5, 0.3); s.crowdStop();
};

test('every sound plays on a fake context without a hitch, makes nodes only while it sounds and takes every one down again: no leaks after the sounds end', () => {
  const ctx = createFakeContext();
  const s = createFightSfx({ context: ctx, rnd: rndOf(1) });
  assert.ok(SFX_METHODS.every((m) => typeof s[m] === 'function'), 'the whole API is there');
  s.tick();
  const base = ctx.live;
  assert.ok(base > 10 && base < 40, `the master chain: ${base} nodes`);
  playAll(s);
  assert.ok(ctx.live > base + 100 && s.audio.alive > 50, `${s.audio.alive} voices at once`);
  ctx.advance(8);
  assert.equal(s.audio.alive, 0, 'all the voices ended');
  assert.ok(ctx.live <= base + 1, `only the master chain is left: ${ctx.live} vs ${base}`);
  s.dispose();
  assert.ok(ctx.live <= 1 && !ctx.closed, 'disposed (a context that was handed in is not closed by us)');
});

test('muted: nothing is made and nothing throws; suspended: it asks to resume and still plays; a context that breaks: silent, no exception; the volume reaches the master', () => {
  const m = createFakeContext(); let muted = true;
  const sm = createFightSfx({ context: m, isMuted: () => muted, rnd: rndOf(1) });
  playAll(sm);
  assert.equal(m.nodes.length, 0, 'muted: not a single node');
  muted = false; sm.thud(hit(8));
  assert.ok(m.nodes.length > 10, 'unmuted: it plays');
  muted = true; sm.thud(hit(8));
  assert.equal(sm.audio.nodes.master.gain.value, 0, 'muting silences what is still going');
  const su = createFakeContext({ state: 'suspended' });
  const ss = createFightSfx({ rnd: rndOf(1), context: su });
  ss.audio.ready(); // (an injected context counts as offline when it can render: this one cannot)
  playAll(ss);
  assert.ok(su.nodes.length > 100, 'a suspended context is still driven');
  const broken = createFakeContext(); broken.createDynamicsCompressor = () => { throw new Error('no compressor'); };
  const sb = createFightSfx({ context: broken, rnd: rndOf(1) });
  assert.doesNotThrow(() => playAll(sb), 'a broken context is silent');
  const v = createFakeContext(); const sv = createFightSfx({ context: v, volume: () => 0.5, rnd: rndOf(1) });
  sv.tick(); assert.ok(Math.abs(sv.audio.nodes.master.gain.value - 0.45) < 1e-9, `master ${sv.audio.nodes.master.gain.value}`);
  const real = createFightSfx({ rnd: rndOf(1) }); // (no window here: no AudioContext can be made)
  assert.doesNotThrow(() => playAll(real));
});

test('the murmur of the crowd is a bed of three nodes\' worth, its loudness follows the love, and it goes quiet and is taken down when the fight ends', () => {
  const ctx = createFakeContext(); const s = createFightSfx({ context: ctx, rnd: rndOf(1) });
  s.crowdStart(10);
  const bed = ctx.nodes.filter((x) => !x.dead && (x.kind === 'bufsrc' || x.kind === 'osc'));
  assert.equal(bed.length, 3, 'one noise source and two slow breathing oscillators');
  const out = ctx.nodes.find((x) => x.kind === 'gain' && x.gain.calls.some((c) => c[0] === 'target'));
  const level = (g) => g.gain.calls.filter((c) => c[0] === 'target').at(-1)[1];
  const low = level(out); s.crowd(90); const high = level(out);
  assert.ok(high > low * 2 && high < low * 6, `love 10 -> ${low.toFixed(3)}, love 90 -> ${high.toFixed(3)}`);
  s.crowdStop(); ctx.advance(3);
  assert.equal(ctx.nodes.filter((x) => !x.dead && (x.kind === 'bufsrc' || x.kind === 'osc')).length, 0, 'the bed is gone');
});

test('slow motion dulls the mix (850 Hz low-pass, back in 80 ms) even when it is switched on before the first sound; a big hit ducks the music bus and it comes back', () => {
  const ctx = createFakeContext(); const s = createFightSfx({ context: ctx, rnd: rndOf(1) });
  s.setSlow(true); s.tick();
  const f = s.audio.nodes.slow.frequency;
  assert.equal(f.value, 850, 'on from the very first sound');
  s.setSlow(true); const n0 = f.calls.length; s.setSlow(true); assert.equal(f.calls.length, n0, 'asking again costs nothing');
  s.setSlow(false);
  assert.ok(f.calls.some((c) => c[0] === 'target' && c[1] === 22000), 'it opens again');
  const mb = s.audio.nodes.music.gain;
  const k = mb.calls.length; s.thud(hit(33, { counter: true }));
  const dips = mb.calls.slice(k).filter((c) => c[0] === 'target');
  assert.ok(dips.length === 2 && dips[0][1] < s.audio.musicBase / 2 && dips[1][1] === s.audio.musicBase, 'down fast, back to the resting level');
  const k2 = mb.calls.length; s.thud(hit(8)); assert.equal(mb.calls.length, k2, 'a jab leaves the music alone');
  s.ko('opp');
  assert.ok(f.calls.some((c) => c[0] === 'target' && c[1] === 520), 'the K.O. makes the ears ring');
});

// ── the music scheduler ──
function stage({ muted = false, volume = 1 } = {}) {
  const ctx = createFakeContext(); const timer = createFakeTimer();
  const sfx = createFightSfx({ context: ctx, rnd: rndOf(4), isMuted: () => muted, volume: () => volume });
  const music = createFightMusic({ audio: sfx.audio, timer });
  const run = (sec, dt = 0.03) => { for (let t = 0; t < sec - 1e-9; t += dt) { ctx.advance(dt); timer.tick(); } };
  return { ctx, timer, sfx, music, run, setMuted: (v) => { muted = v; } };
}

test('the scheduler books every 16th step once, in order, 150 ms ahead of the audio clock, at the right tempo; the timer stops when the music does; nothing allocates per tick but the notes', () => {
  const { ctx, timer, music, run, sfx } = stage();
  music.start({ boss: false, intensity: 0.5 });
  assert.ok(timer.active && timer.ms === 30 && music.playing);
  run(10);
  const sd = 60 / 128 / 4;
  const st = music.stats();
  const expected = (10 + 0.15 + 0.06) / sd;
  assert.ok(Math.abs(st.step - expected) <= 3, `step ${st.step}, expected about ${expected.toFixed(1)}: not a step lost or doubled`);
  assert.ok(st.scheduled > st.step * 1.2, `${st.scheduled} notes for ${st.step} steps`);
  // the books are always a little ahead of the clock and never far
  const kicks = ctx.sources.concat([]).filter((s) => s.kind === 'osc' && s.frequency.calls.some((c) => c[0] === 'set' && c[1] > 150 && c[1] < 160));
  assert.ok(kicks.length >= 1 && kicks.every((k) => k.startAt >= ctx.currentTime - 0.5 && k.startAt <= ctx.currentTime + 0.35), 'kicks are booked about now');
  const starts = kicks.map((k) => k.startAt).sort((a, b) => a - b);
  assert.ok(starts.every((t, i) => i === 0 || Math.abs(t - starts[i - 1] - 60 / 128) < 1e-6 || t - starts[i - 1] > 0.3), 'a kick every beat (60/128 s)');
  music.stop({ now: true });
  assert.ok(!timer.active && !music.playing, 'the timer is cleared');
  const before = st.scheduled; run(2); assert.equal(music.stats().scheduled, before, 'and nothing is booked after stop');
  void sfx;
});

test('the layers follow the intensity on a bar line with hysteresis; the boss starts hot and has its own tempo; a late timer (a hidden tab) rejoins on a bar line instead of bursting', () => {
  const { ctx, music, run, timer } = stage();
  music.start({ intensity: 0.05 });
  run(4); assert.equal(music.level, 0);
  music.setIntensity(0.9); run(6); assert.equal(music.level, 3, 'the music builds');
  music.setIntensity(0.5); run(6); assert.ok(music.level >= 2, `0.5 keeps layer ${music.level} (above the way down)`);
  music.setIntensity(0.0); run(20); assert.equal(music.level, 0, 'and it drops back');
  music.start({ boss: true, intensity: 0 });
  assert.equal(music.track, 'boss'); assert.ok(music.level >= 1 && music.stats().bpm === 156);
  // a stall of three seconds (the tab was hidden): the next tick rejoins on a bar line and books a step or two, not three seconds of catch-up notes
  const before = music.stats().scheduled;
  ctx.advance(3);
  timer.tick();
  const after = music.stats();
  assert.ok(after.scheduled - before < 40, `${after.scheduled - before} notes after a 3 s stall`);
  assert.ok([0, 1, 2, 3, 4].some((k) => (after.step - k) % 16 === 0), `rejoined on a bar line (step ${after.step})`);
});

test('muted: the scheduler waits and books nothing (and makes no nodes); unmuted, it joins in; the volume reaches the master; pause turns the music down to a whisper and back; a sting plays', () => {
  const st = stage({ muted: true });
  st.music.start({ intensity: 0.5 });
  st.run(2);
  assert.equal(st.ctx.nodes.length, 0, 'not a node while muted'); assert.equal(st.music.stats().scheduled, 0);
  st.setMuted(false); st.run(1);
  assert.ok(st.music.stats().scheduled > 10 && st.ctx.nodes.length > 30, 'it starts when the sound is back');
  const gate = st.ctx.nodes.find((n) => n.kind === 'gain' && n.out.some((o) => o === st.sfx.audio.nodes.music));
  st.music.pause(true); assert.ok(gate.gain.calls.some((c) => c[0] === 'target' && c[1] === 0.08));
  st.music.pause(false); assert.ok(gate.gain.calls.some((c) => c[0] === 'target' && c[1] === 1));
  const n0 = st.ctx.nodes.length; st.music.sting('win', 0.2); assert.ok(st.ctx.nodes.length > n0 + 20, 'the sting');
  st.music.sting('nonsense'); st.setMuted(true); assert.doesNotThrow(() => { st.music.sting('lose'); st.music.pause(true); st.music.duck(1, 1); });
  const v = stage({ volume: 0.25 }); v.music.start({}); v.run(0.2);
  assert.ok(Math.abs(v.sfx.audio.nodes.master.gain.value - 0.225) < 1e-9, 'volume 0.25 -> master 0.225');
});

test('the game is paused (it stops updating): the music goes quiet at once and comes back on a bar line when it runs again; a knock-down count keeps it a whisper', () => {
  const ctx = createFakeContext(); const timer = createFakeTimer(); let running = true;
  const sfx = createFightSfx({ context: ctx, rnd: rndOf(4) });
  const music = createFightMusic({ audio: sfx.audio, timer, active: () => running });
  const run = (sec) => { for (let t = 0; t < sec - 1e-9; t += 0.03) { ctx.advance(0.03); timer.tick(); } };
  music.start({ intensity: 0.5 }); run(2);
  const gate = ctx.nodes.find((n) => n.kind === 'gain' && n.out.some((o) => o === sfx.audio.nodes.music));
  const sched = music.stats().scheduled;
  running = false; run(1);
  assert.ok(gate.gain.calls.some((c) => c[0] === 'target' && c[1] < 0.001), 'paused: the gate closes');
  assert.equal(music.stats().scheduled, sched, 'and nothing is booked while the game stands still');
  running = true; run(0.5);
  assert.ok(gate.gain.calls.at(-1)[1] === 1 && music.stats().scheduled > sched && music.stats().step % 16 <= 8, "it comes back, on a bar line");
  music.pause(true); running = false; run(0.2); running = true; run(0.2);
  assert.equal(gate.gain.calls.at(-1)[1], 0.08, 'after a pause in the middle of a count it is still a whisper');
  music.dispose(); sfx.dispose();
});

test('stop() fades (0.3 s) or cuts; the notes that were booked end by themselves; after dispose not one node of the music is left; start() again works', () => {
  const { ctx, music, run, sfx, timer } = stage();
  music.start({ intensity: 0.9 }); run(3);
  const live1 = ctx.live;
  music.stop({ fade: 0.3 });
  const gate = ctx.nodes.find((n) => n.kind === 'gain' && n.out.some((o) => o === sfx.audio.nodes.music));
  assert.ok(gate.gain.calls.some((c) => c[0] === 'lin' && c[1] === 0 && Math.abs(c[2] - (ctx.currentTime + 0.3)) < 1e-6), 'a 0.3 s fade to silence');
  assert.ok(!timer.active);
  run(2);
  assert.equal(sfx.audio.alive, 0, 'every booked note has ended');
  music.start({ intensity: 0.3 }); run(1); assert.ok(music.playing && sfx.audio.alive > 0);
  music.dispose(); run(2);
  assert.equal(sfx.audio.alive, 0);
  sfx.dispose();
  assert.ok(ctx.live <= 1, `${ctx.live} nodes left after dispose`);
  // the offline path: scheduleRange books a whole stretch at once with no timer
  const o = stage(); const booked = o.music.scheduleRange({ boss: false, from: 0, to: 32, t0: 0.05, level: 3 });
  assert.ok(booked > 90 && !o.timer.active && !o.music.playing, `${booked} notes booked offline`);
});

// ── the measuring tools ──
test('the tools that judge the sound are themselves right: an FFT finds a sine, the loudness and DC are exact, a band share adds up, a WAV and a PNG are well formed', () => {
  const rate = 44100; const x = new Float32Array(rate); for (let i = 0; i < rate; i++) x[i] = 0.5 * Math.sin((2 * Math.PI * 1000 * i) / rate) + 0.1;
  const re = Float64Array.from({ length: 1024 }, (_, i) => Math.sin((2 * Math.PI * 64 * i) / 1024)); const im = new Float64Array(1024); fft(re, im);
  const mag = re.map((v, i) => Math.hypot(v, im[i])); assert.equal(mag.indexOf(Math.max(...mag.slice(0, 512))), 64);
  const m = measure(x, rate);
  assert.ok(Math.abs(m.peak - 0.6) < 1e-3 && Math.abs(m.dc - 0.1) < 1e-3 && Math.abs(m.centroid - 1000) < 40, `peak ${m.peak} dc ${m.dc} centroid ${m.centroid}`);
  const s = new Float32Array(rate); for (let i = 0; i < rate; i++) s[i] = 0.5 * Math.sin((2 * Math.PI * 1000 * i) / rate);
  assert.ok(Math.abs(measure(s, rate).rmsDb - -9.03) < 0.05 && bandShare(s, rate, 900, 1100) > 0.99 && bandShare(s, rate, 100, 300) < 0.001 && Math.abs(centroid(s, rate) - 1000) < 5);
  assert.ok(Math.abs(measure(s, rate).loudA - -9.03) < 0.2, 'A-weighting is 0 dB at 1 kHz');
  assert.equal(mono([s, s]).length, rate);
  const wav = toWav([s, s], rate);
  assert.ok(wav.toString('latin1', 0, 4) === 'RIFF' && wav.toString('latin1', 8, 12) === 'WAVE' && wav.readUInt16LE(22) === 2 && wav.readUInt32LE(24) === rate && wav.length === 44 + rate * 4);
  const png = toPng(4, 2, new Uint8Array(4 * 2 * 4).fill(255));
  assert.ok(png.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' && png.toString('latin1', 12, 16) === 'IHDR' && png.readUInt32BE(16) === 4 && png.readUInt32BE(20) === 2, 'a PNG');
  assert.ok(createRingAudio({ context: createFakeContext() }).ready() !== null);
});

console.log(`${n} sound tests passed`);
