// Pure-logic checks for T11: the wallpaper palettes (interpolation, time of day), every wallpaper paints, accent colours.
import assert from 'node:assert/strict';
import { WALLPAPERS, WALLPAPER_IDS, drawWallpaper, dynamicPalette, lerpPalette, wallpaperName } from '../src/core/wallpapers.js';
import { ACCENTS, accentVars, mix } from '../src/core/theme.js';
import { system } from '../src/core/system.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
// a canvas stand-in that records what is painted
function fakeCtx() {
  const calls = { fills: 0, gradients: 0 };
  const grad = () => ({ addColorStop() { calls.gradients++; } });
  return {
    calls,
    createLinearGradient: grad, createRadialGradient: grad,
    fillRect() { calls.fills++; }, fill() { calls.fills++; }, stroke() {}, beginPath() {}, moveTo() {}, lineTo() {}, bezierCurveTo() {}, arc() {}, closePath() {},
    set fillStyle(v) { if (typeof v === 'string') assert.ok(v.length > 3, `bad fillStyle ${v}`); }, set strokeStyle(v) {}, set lineWidth(v) {},
  };
}

test('there are at least 7 wallpapers, including the five named ones and Dynamic', () => {
  assert.ok(WALLPAPERS.length >= 7);
  for (const id of ['sunrise', 'aurora', 'dunes', 'ocean', 'midnight', 'mono', 'dynamic']) assert.ok(WALLPAPER_IDS.includes(id), id);
  assert.equal(wallpaperName('midnight'), 'Midnight Peaks');
  assert.equal(wallpaperName('nope'), 'Sunrise');
});
test('every wallpaper paints something (any size, any hour)', () => {
  for (const id of WALLPAPER_IDS) for (const [w, h] of [[1280, 832], [168, 109]]) for (const hr of [0, 7, 13, 19, 23.9]) {
    const g = fakeCtx();
    drawWallpaper(g, w, h, id, hr);
    assert.ok(g.calls.fills > 0 && g.calls.gradients > 0, `${id} ${w}x${h} @${hr}`);
  }
});
test('lerpPalette blends colours, numbers and nested shapes', () => {
  const a = { c: '#000000', n: 0, arr: [['#ff0000', 1]] }, b = { c: '#ffffff', n: 10, arr: [['#0000ff', 0]] };
  const m = lerpPalette(a, b, 0.5);
  assert.equal(m.c, '#808080');
  assert.equal(m.n, 5);
  assert.equal(m.arr[0][0], '#800080');
  assert.equal(m.arr[0][1], 0.5);
  assert.deepEqual(lerpPalette(a, b, 0), a);
});
test('Dynamic: continuous across midnight, brighter at noon than at night, different at every key hour', () => {
  assert.deepEqual(dynamicPalette(0), dynamicPalette(24));
  const lum = (c) => { const v = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); return (v[0] + v[1] + v[2]) / 3; };
  assert.ok(lum(dynamicPalette(13).bg[1]) > lum(dynamicPalette(1).bg[1]) + 80, 'day sky is much brighter');
  const seen = new Set([0, 6.5, 10, 14, 18, 20, 22].map((h) => dynamicPalette(h).bg.join()));
  assert.equal(seen.size, 7);
  // no jump: 1-minute steps never change the first stop by more than a few levels
  let prev = dynamicPalette(0).bg[0];
  for (let h = 0.02; h < 24; h += 0.02) {
    const cur = dynamicPalette(h).bg[0];
    const d = [1, 3, 5].reduce((s, i) => s + Math.abs(parseInt(cur.slice(i, i + 2), 16) - parseInt(prev.slice(i, i + 2), 16)), 0);
    assert.ok(d < 40, `jump of ${d} at ${h.toFixed(2)}h`);
    prev = cur;
  }
});
test('accent colours: 7+ macOS accents, dark mode lifts them, derived shades are valid hex', () => {
  assert.ok(ACCENTS.length >= 7);
  assert.equal(ACCENTS[0].id, 'blue');
  for (const a of ACCENTS) {
    const l = accentVars(a.id, false), d = accentVars(a.id, true);
    for (const v of [l['--ac'], l['--ac-hi'], l['--ac-lo'], l['--ac-ic'], d['--ac']]) assert.match(v, /^#[0-9a-f]{6}$/);
    assert.notEqual(l['--ac'], d['--ac'], `${a.id}: dark differs`);
    assert.match(l['--ac-rgb'], /^\d+,\d+,\d+$/);
  }
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(accentVars('nope', false)['--ac'], '#007aff');
});
test('system preferences: defaults, set / toggle / reset', () => {
  assert.equal(system.get('volume'), 70);
  assert.equal(system.get('wifi'), true);
  assert.equal(system.set('volume', 70), false, 'same value is a no-op');
  assert.equal(system.set('nope', 1), false, 'unknown keys are ignored');
  assert.equal(system.toggle('dnd'), true);
  system.set('volume', 20);
  system.reset();
  assert.equal(system.get('volume'), 70);
  assert.equal(system.get('dnd'), false);
});

console.log(`${n} theme tests passed`);
process.exit(0);
