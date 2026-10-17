// The people of "Ori, Can You...?" (T58, pure): the sculpted head and body, the skeleton and skin weights, the expression rig, the animator, the mouth,
// the parametric neighbours and the crowd's coarse figures.      node scripts/test-favors-people.mjs
import assert from 'node:assert/strict';
import { buildPersonData, personStats } from '../src/game3d/favors/people/assemble.js';
import { ORI_SPEC, randomSpec } from '../src/game3d/favors/people/specs.js';
import { EXPRESSIONS, EXPRESSION_NAMES, NEUTRAL, createFace, target } from '../src/game3d/favors/people/expressions.js';
import { createAnimator, GESTURES, posedAt } from '../src/game3d/favors/people/anim.js';
import { hashNumbers } from '../src/game3d/rng.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };

const t0 = performance.now();
const ori = buildPersonData(ORI_SPEC, { quality: 1 });
const buildMs = performance.now() - t0;
const stats = personStats(ori);

test('Ori is built in code with no photo: 11 layers on a 41-bone skeleton, a sensible triangle count', () => {
  assert.equal(stats.bones, 41);
  for (const k of ['skin', 'tee', 'jeans', 'shoes', 'hair', 'eyes', 'frame', 'lens', 'glint', 'metal', 'shine']) assert.ok(ori.layers[k] && ori.layers[k].vertexCount > 8, `layer ${k}`);
  assert.ok(stats.tris > 150000 && stats.tris < 600000, `${stats.tris} triangles`);
  console.log(`    (${Math.round(buildMs)} ms, ${Math.round(stats.tris / 1000)}k triangles: ${JSON.stringify(stats.per)})`);
});
test('every vertex of every layer is finite, every index is valid and every skin weight set sums to 1 with real bones', () => {
  for (const [name, m] of Object.entries(ori.layers)) {
    for (const a of [m.positions, m.normals, m.colors]) for (let i = 0; i < a.length; i++) assert.ok(Number.isFinite(a[i]), `${name}: non-finite value`);
    for (let i = 0; i < m.indices.length; i++) assert.ok(m.indices[i] < m.vertexCount, `${name}: index out of range`);
    for (let v = 0; v < m.vertexCount; v++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) { sum += m.skinWeight[v * 4 + k]; assert.ok(m.skinIndex[v * 4 + k] < stats.bones, `${name}: bone index`); }
      assert.ok(Math.abs(sum - 1) < 1e-3, `${name}: weights sum ${sum}`);
    }
  }
});
test('the skeleton is a tree: every bone has an existing parent, the rest pose puts him on the ground at about 1.6 m, face bones sit on the face', () => {
  const names = new Set(ori.rig.bones.map((b) => b.name));
  for (const b of ori.rig.bones) assert.ok(b.parent === null || names.has(b.parent), `${b.name} has a parent`);
  let top = 0; let bottom = 9;
  for (const m of Object.values(ori.layers)) for (let i = 0; i < m.vertexCount; i++) { top = Math.max(top, m.positions[i * 3 + 1]); bottom = Math.min(bottom, m.positions[i * 3 + 1]); }
  assert.ok(bottom > -0.03 && bottom < 0.03, `feet at ${bottom}`);
  assert.ok(top > 1.6 && top < 2.0, `top of the curls at ${top}`);
  const eye = ori.rig.bones.find((b) => b.name === 'eyeL').pos;
  assert.ok(eye[1] > 1.35 && eye[1] < 1.6 && eye[0] > 0.03 && eye[0] < 0.07, `the left eye at ${eye}`);
});
test('building is deterministic (same spec = same bytes) and cached by key', () => {
  const a = buildPersonData(randomSpec(3), { quality: 0.5 });
  const b = buildPersonData(randomSpec(3), { quality: 0.5 });
  assert.equal(hashNumbers(Array.from(a.layers.skin.positions.slice(0, 2000))), hashNumbers(Array.from(b.layers.skin.positions.slice(0, 2000))));
  const c1 = buildPersonData(randomSpec(4), { quality: 0.5, key: 'k4' });
  assert.equal(buildPersonData(randomSpec(4), { quality: 0.5, key: 'k4' }), c1);
});
test('the mouth: every expression builds finite geometry well inside the 2400-vertex buffer of the renderer', () => {
  for (const name of EXPRESSION_NAMES) {
    const ch = target(name);
    const m = ori.mouth({ w: ch.w, smile: ch.smile, open: ch.open, round: ch.round, asym: ch.asym, teeth: ch.teeth, tongue: ch.tongue });
    assert.ok(m.vertexCount > 40 && m.vertexCount < 2400, `${name}: ${m.vertexCount} vertices`);
    for (const a of [m.positions, m.normals, m.colors]) for (let i = 0; i < a.length; i++) assert.ok(Number.isFinite(a[i]), name);
  }
  const extreme = ori.mouth({ w: 1.3, smile: 1.5, open: 1, round: 1, asym: 1, teeth: 1, tongue: 1 });
  assert.ok(extreme.vertexCount < 2400);
});

test('expressions: a full set, ALL of them warm (no angry / sad / negative names, smile never below neutral, no brow tilt that frowns)', () => {
  for (const need of ['neutral', 'smile', 'grin', 'laugh', 'wink', 'surprised', 'flustered', 'sleepy', 'smirk', 'talking']) assert.ok(EXPRESSIONS[need], need);
  for (const name of EXPRESSION_NAMES) {
    assert.ok(!/ang|sad|cry|frown|scowl|mad|rage|upset|sulk|grump|hate|disgust|bitter/i.test(name), `no negative name: ${name}`);
    const e = target(name);
    assert.ok(e.smile >= 0 && (e.smile >= NEUTRAL.smile - 1e-9 || e.round > 0.5), `${name}: the mouth never turns down (only the round "oh" of a happy surprise is flatter than neutral)`);
    assert.ok(e.browInL >= -0.003 && e.browInR >= -0.003, `${name}: the inner brows never drop into a scowl`);
    for (const v of Object.values(e)) assert.ok(Number.isFinite(v));
  }
});
test('the face blinks by itself every few seconds, glances around, talks with a moving jaw and settles on an expression', () => {
  const f = createFace(5);
  f.set('grin');
  let blinks = 0; let was = false; const gazes = new Set(); let maxOpen = 0; let minOpen = 9;
  for (let t = 0; t < 12; t += 1 / 60) {
    const c = f.update(1 / 60, { talk: t > 6 });
    const closed = c.lidUp > 0.6;
    if (closed && !was) blinks++;
    was = closed;
    gazes.add(Math.round(c.gx * 20));
    if (t > 7) { maxOpen = Math.max(maxOpen, c.open); minOpen = Math.min(minOpen, c.open); }
  }
  assert.ok(blinks >= 2 && blinks <= 7, `${blinks} blinks in 12 s`);
  assert.ok(gazes.size >= 3, 'he looks around');
  assert.ok(maxOpen - minOpen > 0.2, `the mouth flaps while he talks (${minOpen.toFixed(2)}..${maxOpen.toFixed(2)})`);
  const c = createFace(5); c.set('grin'); let last; for (let t = 0; t < 2; t += 1 / 60) last = c.update(1 / 60);
  assert.ok(last.smile > 1 && last.teeth > 0.9, 'it settles on the grin');
});

test('the animator: standing, walking, running and sprinting give finite, bounded, continuous angles', () => {
  const a = createAnimator();
  let prev = JSON.stringify(a.pose.bones);
  void prev;
  const seq = [{ speed: 0 }, { speed: 1.8 }, { speed: 4.4 }, { speed: 8.2, sprinting: true }, { speed: 0, winded: true }, { speed: 0 }];
  let worst = 0;
  const last = {};
  for (const s of seq) {
    for (let i = 0; i < 90; i++) {
      a.update(1 / 60, s);
      for (const [b, r] of Object.entries(a.pose.bones)) {
        for (let k = 0; k < 3; k++) {
          assert.ok(Number.isFinite(r[k]) && Math.abs(r[k]) < 3.2, `${b}[${k}] = ${r[k]}`);
          if (last[b + k] !== undefined) worst = Math.max(worst, Math.abs(r[k] - last[b + k]));
          last[b + k] = r[k];
        }
      }
    }
  }
  assert.ok(worst < 0.25, `no pops between frames (largest step ${worst.toFixed(3)} rad)`);
});
test('walking swings the legs against the arms; running bends the knees and the elbows more than walking', () => {
  const walk = posedAt({ speed: 1.8 }, { at: 0.2 });
  const run = posedAt({ speed: 4.4 }, { at: 0.2 });
  const range = (speed, key) => { const a = createAnimator(); let lo = 9; let hi = -9; for (let i = 0; i < 240; i++) { a.update(1 / 60, { speed }); const v = a.pose.bones[key][0]; lo = Math.min(lo, v); hi = Math.max(hi, v); } return hi - lo; };
  assert.ok(range(4.4, 'upLegL') > range(1.8, 'upLegL') * 1.3, 'a longer stride when running');
  assert.ok(range(1.8, 'upLegL') > 0.3, 'the legs swing when walking');
  assert.ok(run.bones.lowerArmL[0] < walk.bones.lowerArmL[0] + 0.001 || run.bones.lowerArmR[0] < walk.bones.lowerArmR[0] + 0.001, 'the elbows bend more when running');
  const a = createAnimator(); let sumL = 0; let sumA = 0;
  for (let i = 0; i < 240; i++) { a.update(1 / 60, { speed: 4.4 }); sumL += a.pose.bones.upLegL[0] * a.pose.bones.upperArmL[0]; sumA++; }
  assert.ok(sumL / sumA < 0, 'the left arm swings against the left leg');
});
test('gestures: every one plays for its duration, raises the right hand for a thumbs-up (fist, thumb out) and returns to rest', () => {
  for (const g of Object.keys(GESTURES)) {
    const a = createAnimator();
    a.play(g);
    let moved = 0;
    for (let i = 0; i < Math.ceil(GESTURES[g] * 60) + 90; i++) { a.update(1 / 60, {}); for (const r of Object.values(a.pose.bones)) for (const v of r) { assert.ok(Number.isFinite(v)); moved = Math.max(moved, Math.abs(v)); } }
    assert.ok(moved > 0.1, `${g} moves something`);
    assert.equal(a.gesture, null, `${g} ended`);
    assert.ok(Math.abs(a.pose.bones.upperArmR[2]) < 0.4, `${g}: the arm is back down`);
  }
  const t = posedAt({}, { gesture: 'thumbsUp', at: 0.9 });
  assert.ok(t.bones.upperArmR[0] < -0.6 && t.bones.lowerArmR[0] < -1.0, 'the right arm is up and bent');
  assert.ok(t.fingers.R.curl > 0.85 && t.fingers.R.thumb < 0.2, 'a fist with the thumb out');
  assert.equal(t.expression, 'grin');
});
test('held poses: the phone raises the right hand and shows the phone, carrying uses both arms and shows the box; releasing puts them away', () => {
  const ph = posedAt({}, { hold: 'phone' });
  assert.equal(ph.prop, 'phone');
  assert.ok(ph.bones.lowerArmR[0] < -1.0);
  const ca = posedAt({}, { hold: 'carry' });
  assert.equal(ca.prop, 'box');
  assert.ok(ca.bones.upperArmL[0] < -0.6 && ca.bones.upperArmR[0] < -0.6);
  const a = createAnimator(); a.hold('phone'); for (let i = 0; i < 60; i++) a.update(1 / 60, {}); a.hold(null); for (let i = 0; i < 60; i++) a.update(1 / 60, {});
  assert.equal(a.pose.prop, null);
});
test('being out of breath slumps the back and shows a sleepy (happy) face; high chaos shows a flustered smile — never a negative one', () => {
  const idle = posedAt({}, {});
  const tired = posedAt({ winded: true }, {});
  assert.ok(tired.bones.spine[0] > idle.bones.spine[0] + 0.2, 'the back bends');
  assert.equal(tired.expression, 'sleepy');
  const a = createAnimator(); for (let i = 0; i < 90; i++) a.update(1 / 60, { stress: 0.9 });
  assert.equal(a.pose.expression, 'flustered');
});

test('the parametric neighbours: 300 seeds give different people (skin, hair, build, outfit), all plain JSON data, none negative', () => {
  const seen = { skin: new Set(), hair: new Set(), top: new Set(), style: new Set(), glasses: 0, kid: 0, elder: 0 };
  for (let s = 1; s <= 300; s++) {
    const sp = randomSpec(s);
    assert.deepEqual(JSON.parse(JSON.stringify(sp)), sp);
    assert.equal(randomSpec(s).face.skin, sp.face.skin, 'deterministic');
    seen.skin.add(sp.face.skin); seen.hair.add(sp.hair.color); seen.top.add(sp.outfit.topColor); seen.style.add(sp.hair.style);
    if (sp.glasses) seen.glasses++;
    if (sp.age === 'kid') seen.kid++;
    if (sp.age === 'elder') seen.elder++;
    assert.ok(sp.body.build > 0.8 && sp.body.build < 1.3 && sp.scale > 0.6 && sp.scale < 1.1);
  }
  assert.ok(seen.skin.size >= 5 && seen.hair.size >= 6 && seen.top.size >= 9 && seen.style.size >= 6, 'variety');
  assert.ok(seen.glasses > 30 && seen.kid > 10 && seen.elder > 15, 'glasses, kids and elders all appear');
  const q = buildPersonData(randomSpec(8), { quality: 0.45 });
  assert.ok(personStats(q).tris < 130000);
});
test('the crowd figures are coarse: about 10k triangles each, with the same skeleton', () => {
  for (const hair of ['short', 'curly', 'long', 'bun', 'bald']) {
    const d = buildPersonData(randomSpec(11, { hair }), { crowd: true });
    const s = personStats(d);
    assert.ok(s.tris > 4000 && s.tris < 16000, `${hair}: ${s.tris} triangles`);
    assert.equal(s.bones, 41);
  }
});

console.log(`${n} people tests passed`);
