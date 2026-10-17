// "Ori, Can You...?" — the world-art tests (T60), all PURE (no browser): the procedural material maps (deterministic, the right brightness, they tile), the alpha cards,
// the weather schedule, the colour grade of the day, the pigeons' behaviour and the geometry of every building facade (no NaN, real window openings, within the lot).
//   node scripts/test-favors-art.mjs
import assert from 'node:assert/strict';
import { generateMaterial, generateCard, channelMean, MATERIAL_NAMES } from '../src/game3d/favors/matgen.js';
import { weatherPlan, weatherAt, applyOvercast } from '../src/game3d/favors/weather.js';
import { skyAt, gradeAt } from '../src/game3d/favors/daycycle.js';
import { createPigeons } from '../src/game3d/favors/pigeons.js';
import { buildMap } from '../src/game3d/favors/map.js';
import { GeoBuilder } from '../src/game3d/favors/gfx.js';
import { lotStyle, buildShell } from '../src/game3d/favors/buildings/facade.js';
import { makeGround } from '../src/game3d/favors/buildings/shopfront.js';
import { createExtras, buildBalconies } from '../src/game3d/favors/buildings/balconies.js';
import { rooftop } from '../src/game3d/favors/buildings/roofs.js';
import { hash01 } from '../src/game3d/favors/buildings/face.js';
import { mulberry32 } from '../src/game3d/rng.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };

// ── materials ──
test('every procedural material is deterministic and made of three maps of the right size', () => {
  for (const name of MATERIAL_NAMES) {
    const a = generateMaterial(name, 64, 1);
    const b = generateMaterial(name, 64, 1);
    assert.equal(a.albedo.length, 64 * 64 * 4, name);
    assert.deepEqual(Array.from(a.albedo.slice(0, 400)), Array.from(b.albedo.slice(0, 400)), `${name} albedo`);
    assert.deepEqual(Array.from(a.normal.slice(0, 400)), Array.from(b.normal.slice(0, 400)), `${name} normal`);
    assert.equal(a.rough.length, a.albedo.length);
  }
});
test('the brightness is physical: stucco is light, asphalt is dark, normal maps point mostly out of the surface', () => {
  const stucco = generateMaterial('stucco', 128);
  const asphalt = generateMaterial('asphalt', 128);
  const paving = generateMaterial('paving', 128);
  assert.ok(channelMean(stucco.albedo, 0) > 200, 'stucco is near white');
  assert.ok(channelMean(asphalt.albedo, 0) < 140 && channelMean(asphalt.albedo, 0) > 60, 'asphalt is dark grey');
  assert.ok(channelMean(paving.albedo, 0) > 130 && channelMean(paving.albedo, 0) < 235);
  for (const name of MATERIAL_NAMES) {
    const m = generateMaterial(name, 64);
    assert.ok(channelMean(m.normal, 2) > 170, `${name}: the normals face outwards (blue ${channelMean(m.normal, 2).toFixed(0)})`);
    const r = channelMean(m.rough, 1) / 255;
    assert.ok(r > 0.2 && r <= 1, `${name}: roughness ${r.toFixed(2)}`);
  }
});
test('the maps tile: the seam between the last and the first column is no rougher than the picture itself', () => {
  for (const name of ['stucco', 'asphalt', 'sand', 'lawn', 'terrazzo', 'bark']) {
    const N = 128;
    const m = generateMaterial(name, N);
    let seam = 0; let inner = 0;
    for (let y = 0; y < N; y++) {
      seam += Math.abs(m.albedo[(y * N) * 4] - m.albedo[(y * N + N - 1) * 4]);
      for (let x = 0; x < N - 1; x++) inner += Math.abs(m.albedo[(y * N + x) * 4] - m.albedo[(y * N + x + 1) * 4]) / (N - 1);
    }
    assert.ok(seam <= inner * 2.2 + N * 2, `${name}: seam ${seam.toFixed(0)} vs an inner pair ${inner.toFixed(0)}`);
  }
});
test('the alpha cards (palm frond, leaf cluster) are cut-outs: partly clear, partly leaf, and green', () => {
  for (const name of ['frond', 'leaves']) {
    const c = generateCard(name, 128);
    let solid = 0; let g = 0;
    for (let i = 0; i < c.albedo.length; i += 4) if (c.albedo[i + 3] > 128) { solid++; g += c.albedo[i + 1] > c.albedo[i + 2] ? 1 : 0; }
    const cover = solid / (128 * 128);
    assert.ok(cover > 0.06 && cover < 0.75, `${name} covers ${(cover * 100).toFixed(0)}%`);
    assert.ok(g / solid > 0.9, `${name} is green`);
  }
});

// ── weather ──
test('weather: about every second day has one afternoon shower, always inside the afternoon, and it never rains outside its window', () => {
  let rainy = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const p = weatherPlan(seed);
    assert.deepEqual(weatherPlan(seed), p, 'deterministic');
    if (!p.rains) { for (let h = 6; h <= 24; h += 0.5) assert.equal(weatherAt(p, h).rain, 0); continue; }
    rainy++;
    assert.ok(p.start >= 14.5 && p.start + p.dur <= 19, `window ${p.start} + ${p.dur}`);
    assert.equal(weatherAt(p, p.start - 0.3).rain, 0);
    assert.equal(weatherAt(p, p.start + p.dur + 0.1).rain, 0);
    assert.ok(weatherAt(p, p.start + p.dur / 2).rain > 0.9, 'it really rains in the middle');
  }
  assert.ok(rainy > 70 && rainy < 130, `${rainy} of 200 days rain`);
});
test('weather: the streets get wet during the shower and take about an hour to dry; the sky greys over before it starts', () => {
  const p = { rains: true, start: 16, dur: 0.8 };
  const during = weatherAt(p, 16.6);
  assert.ok(during.wet > 0.9 && during.overcast > 0.9);
  const after = weatherAt(p, 17.0);
  assert.ok(after.wet > 0.8 && after.rain < 0.2, 'still wet right after it stops');
  assert.ok(weatherAt(p, 18.3).wet < 0.35, 'dry again after an hour or so');
  assert.ok(weatherAt(p, 15.8).overcast > 0.2 && weatherAt(p, 15.8).rain === 0, 'it greys over first');
  for (let h = 6; h <= 24; h += 0.1) { const w = weatherAt(p, h); for (const k of ['rain', 'wet', 'overcast']) assert.ok(w[k] >= 0 && w[k] <= 1, `${k} ${w[k]} at ${h}`); }
});
test('an overcast sky is greyer and dimmer, with the street lamps and windows coming on earlier', () => {
  const clear = skyAt(16.5);
  const grey = applyOvercast(skyAt(16.5), 1);
  assert.ok(grey.keyI < clear.keyI * 0.5, 'the sun is mostly hidden');
  const sat = (c) => Math.max(...c) - Math.min(...c);
  assert.ok(sat(grey.hor) < sat(clear.hor), 'the sky loses colour');
  assert.ok(grey.lamps > clear.lamps && grey.win > clear.win);
  assert.deepEqual(applyOvercast(skyAt(10), 0).top, skyAt(10).top, 'no change when it is clear');
});

// ── the grade of the day ──
test('the colour grade: warm and gold at sunset, cool and blue at night, clean at noon; the light shafts belong to the low sun', () => {
  const noon = gradeAt(skyAt(13));
  const gold = gradeAt(skyAt(18.7));
  const night = gradeAt(skyAt(23));
  assert.ok(noon.golden < 0.15 && gold.golden > 0.5 && night.golden === 0);
  assert.ok(gold.tint[0] > gold.tint[2] + 0.15, 'warm');
  assert.ok(night.tint[2] > night.tint[0] + 0.15, 'cool');
  assert.ok(Math.abs(noon.tint[0] - noon.tint[2]) < 0.06, 'neutral at noon');
  assert.ok(gold.shafts > 0.6 && noon.shafts < 0.12 && night.shafts < 0.01);
  assert.ok(night.vignette > noon.vignette);
  for (let h = 6; h <= 24; h += 0.25) { const g = gradeAt(skyAt(h)); assert.ok(g.sat > 0.8 && g.sat < 1.35 && g.contrast > 0.95 && g.contrast < 1.2 && g.bloom > 0.2 && g.bloom < 1.2, `hour ${h}`); }
});

// ── pigeons ──
test('pigeons: they peck about their spot, burst into the air when somebody comes close, and settle again further on', () => {
  const spots = [{ x: 0, z: 0, n: 5, r: 2.5 }, { x: 40, z: 10, n: 3, r: 2 }];
  const flock = createPigeons(7, spots);
  assert.equal(flock.birds.length, 8);
  for (let i = 0; i < 120; i++) flock.update(1 / 30, []);
  assert.ok(flock.birds.every((b) => b.state === 'peck' && b.y === 0), 'nobody around: they stay on the ground');
  assert.ok(flock.birds.every((b) => Math.hypot(b.x - spots[b.spot].x, b.z - spots[b.spot].z) < 10));
  const before = flock.birds.slice(0, 5).map((b) => [b.x, b.z]);
  flock.update(1 / 30, [{ x: 0.5, z: 0.5 }]);
  assert.ok(flock.birds.slice(0, 5).some((b) => b.state === 'fly'), 'the ones next to the visitor take off');
  assert.ok(flock.birds.slice(5).every((b) => b.state === 'peck'), 'the far flock does not care');
  let maxY = 0;
  for (let i = 0; i < 160; i++) { flock.update(1 / 30, [{ x: 0.5, z: 0.5 }]); for (const b of flock.birds) maxY = Math.max(maxY, b.y); }
  assert.ok(maxY > 1.2 && maxY < 8, `they fly up to ${maxY.toFixed(1)} m`);
  assert.ok(flock.birds.slice(0, 5).every((b) => b.state === 'peck' && b.y === 0), 'and land again');
  assert.ok(flock.birds.slice(0, 5).some((b, i) => Math.hypot(b.x - before[i][0], b.z - before[i][1]) > 4), 'somewhere else');
});

// ── the facades ──
test('every building facade is real geometry: windows are openings, nothing is NaN, nothing strays out of its lot', () => {
  const map = buildMap(51);
  const rnd = mulberry32(99);
  const fakeAtlas = { uv: () => [0, 0, 1, 1] };
  const fakeArt = { uvMural: () => [0, 0, 1, 1], uvPoster: () => [0, 0, 1, 1] };
  let totalTris = 0; let windows = 0; let lotsWithGlass = 0;
  for (const lot of map.lots) {
    const b = {};
    for (const k of ['walls', 'trim', 'fine', 'roofs', 'tiles', 'metal', 'cloth', 'glass', 'signs', 'art']) b[k] = new GeoBuilder();
    const inst = [];
    const place = lot.named ? map.places[lot.id] : null;
    const st = lotStyle(lot, rnd, lot.named);
    const extras = createExtras(b, inst, rnd);
    const ground = makeGround(b, lot, st, place, rnd, fakeAtlas, extras, fakeArt);
    const shell = buildShell(b, lot, st, rnd, { ground, extras });
    buildBalconies(b, lot, st, shell, inst, rnd, []);
    rooftop(b, lot.rect, lot.h + 0.01, rnd, st);
    const r = lot.rect;
    let tris = 0;
    for (const [k, B] of Object.entries(b)) {
      tris += B.i.length / 3;
      for (let i = 0; i < B.p.length; i += 3) {
        const x = B.p[i]; const y = B.p[i + 1]; const z = B.p[i + 2];
        assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z), `${lot.id}/${k}: NaN`);
        const m = lot.id === 'cityhall' ? 3 : 2.2; // (porticos, awnings and balconies reach out)
        assert.ok(x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m, `${lot.id}/${k}: a vertex at ${x.toFixed(1)},${z.toFixed(1)} is outside the lot`);
        assert.ok(y > -0.05 && y < lot.h + 7, `${lot.id}/${k}: height ${y.toFixed(2)}`);
      }
      assert.ok(B.p.length === B.n.length && B.p.length / 3 === B.uv.length / 2 && B.p.length / 3 === B.extra.length && B.p.length / 3 === B.extra2.length, `${lot.id}/${k}: attribute lengths agree`);
    }
    assert.ok(tris < 60000, `${lot.id} has ${tris} triangles`);
    totalTris += tris;
    if (b.glass.count > 0) { lotsWithGlass++; windows += b.glass.count / 4; }
    assert.ok(b.walls.count > 0 && b.glass.count > 0 || lot.id === 'kiosk', `${lot.id}: has walls and glass`);
  }
  assert.ok(windows > 600, `${windows} windows`);
  assert.equal(lotsWithGlass, map.lots.length);
  assert.ok(totalTris > 400000 && totalTris < 1900000, `the neighbourhood is ${Math.round(totalTris / 1000)}k triangles`);
});
test('hash01 is a steady 0..1 hash (the per-window variety does not depend on the order of anything)', () => {
  let min = 1; let max = 0; let sum = 0;
  for (let i = 0; i < 4000; i++) { const h = hash01(i, i * 3, 7); assert.equal(h, hash01(i, i * 3, 7)); min = Math.min(min, h); max = Math.max(max, h); sum += h; }
  assert.ok(min >= 0 && max < 1 && Math.abs(sum / 4000 - 0.5) < 0.03);
});

console.log(`${n} art tests passed`);
