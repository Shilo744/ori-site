// "Ori's Life" — photo mode [experimental] (pure): how big the picture is, the polaroid round it and where the words go, the file's name, the keys it lets through.      node scripts/test-favors-photo.mjs
import assert from 'node:assert/strict';
import { KEY, MAX_W, MIN_W, HINT, sizeFor, polaroid, captionOf, photoName, placeKey, ALLOWED } from '../src/game3d/favors/photo.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const BANNED = /\b(miss(ed|ing)?|fail(ed|s|ure|ing)?|sorry|can'?t|cannot|won'?t|not now|never|hate[sd]?|angry|annoy(ed|ing)?|stupid|useless|loser|lazy|too late|give up|ignore[ds]?|refuse[sd]?|terrible|awful|worst)\b/i;

test('the picture is the canvas\'s size, scaled down when it is huge and up when it is tiny, always the same shape', () => {
  assert.deepEqual(sizeFor(1280, 800), { w: 1280, h: 800, scale: 1 });
  assert.deepEqual(sizeFor(3200, 2000), { w: MAX_W, h: 1000, scale: 0.5 });
  assert.deepEqual(sizeFor(160, 100), { w: MIN_W, h: 200, scale: 2 });
  for (const [w, h] of [[1920, 1080], [390, 844], [844, 390], [2560, 1440], [1, 1], [0, 0], [NaN, NaN]]) {
    const s = sizeFor(w, h);
    assert.ok(Number.isFinite(s.w) && Number.isFinite(s.h) && s.w >= MIN_W - 1 && s.w <= MAX_W, `${w}x${h} -> ${s.w}x${s.h}`);
    if (w > 0 && h > 0) assert.ok(Math.abs(s.w / s.h - w / h) < 0.02 || Math.max(w, h) < 4, `${w}x${h}: the shape is kept`);
  }
});

test('the polaroid: a thin border, a wide foot, the picture inside, the words inside the paper', () => {
  for (const [w, h] of [[1280, 800], [1600, 900], [390, 844], [320, 200]]) {
    const g = polaroid(w, h);
    assert.ok(g.width > w && g.height > h && g.x === g.y && g.x >= 4, `${w}x${h}: a border`);
    assert.equal(g.picW, w); assert.equal(g.picH, h);
    assert.ok(g.x + g.picW <= g.width && g.y + g.picH <= g.height, 'the picture is on the paper');
    const foot = g.height - g.y - g.picH;
    assert.ok(foot >= 64 && foot > g.x * 2, `the foot (${foot}) is wider than the border (${g.x})`);
    assert.ok(g.titleY < g.subY && g.subY < g.height && g.titleY > g.y + g.picH, 'title above the sub line, both in the foot');
    assert.ok(g.textX >= g.x && g.tagX <= g.width - g.x + 1 && g.tagX > g.textX, 'the left words and the right tag are on the paper');
    assert.ok(g.fontTitle >= 18 && g.fontSub < g.fontTitle && g.fontTag <= g.fontSub, 'the sizes step down');
  }
});

test('the words under the photo, kind and short; the file\'s name is safe', () => {
  assert.deepEqual(captionOf({ place: 'Cafe Sababa', day: 3, label: '15:40' }), { title: 'Cafe Sababa', sub: 'Day 3 · 15:40', tag: "Ori's Life" });
  assert.deepEqual(captionOf({}), { title: 'Out and about', sub: 'Day 1', tag: "Ori's Life" });
  assert.equal(photoName({ day: 3, label: '15:40' }), 'ori-day3-1540.png');
  assert.equal(photoName({ day: 12, label: '6:05' }), 'ori-day12-0605.png');
  for (const bad of [{}, { day: 0, label: 'x' }, { day: -4, label: '' }, { day: NaN, label: null }]) assert.match(photoName(bad), /^ori-day[1-9]\d*-0000\.png$/);
  for (const t of [HINT, captionOf({ place: 'Park & Beach', day: 2, label: '10:00' }).sub, 'Out and about', "Ori's Life"]) { assert.ok(!BANNED.test(t) && !/\p{Extended_Pictographic}/u.test(t), t); assert.ok(t.length < 60, t); }
});

test('a place key for the photographer count: a plain id is itself, anything else is the street', () => {
  assert.equal(placeKey('cafe'), 'cafe');
  assert.equal(placeKey('busstop'), 'busstop');
  for (const bad of [null, undefined, '', 'Cafe', 'a b', 'x'.repeat(20), 7, '__proto__x1', 'a']) assert.equal(placeKey(bad), 'street', String(bad));
});

test('photo mode lets walking and the camera through, and keeps the maps, journals and chats for later', () => {
  assert.equal(KEY, 'KeyV');
  for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'KeyQ', 'KeyE', 'ShiftLeft', 'Space', 'Escape', 'Equal', 'Minus']) assert.ok(ALLOWED.has(k), k);
  for (const k of ['KeyM', 'Tab', 'KeyH', 'KeyT', 'KeyG', 'KeyJ', 'KeyK', 'KeyL', 'KeyR', 'KeyB', 'Slash']) assert.ok(!ALLOWED.has(k), k);
});

console.log(`${n} photo tests passed`);
