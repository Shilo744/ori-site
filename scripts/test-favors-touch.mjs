// "Ori, Can You...?" — touch devices [experimental] (pure): who counts as one, and the pads (a button is a key; every card has a way out).      node scripts/test-favors-touch.mjs
import assert from 'node:assert/strict';
import { MIN_TARGET, isTouchDevice, PADS, arcadePad, coffeePad, keyInit } from '../src/game3d/favors/touch.js';
import { DRINKS } from '../src/game3d/favors/coffee.js';
import { GAMES } from '../src/game3d/favors/arcade.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const BANNED = /\b(miss(ed|ing)?|fail(ed|s|ure|ing)?|sorry|can'?t|cannot|won'?t|not now|never|hate[sd]?|angry|annoy(ed|ing)?|stupid|useless|loser|lazy|too late|give up|ignore[ds]?|refuse[sd]?|terrible|awful|worst)\b/i;
const CODE = /^(Key[A-Z]|Digit\d|Arrow(Up|Down|Left|Right)|Space|Escape|Tab|Enter)$/;

test('a coarse pointer is a touch device; ?touch=1 forces the pads on, ?touch=0 off (even on a phone)', () => {
  assert.equal(isTouchDevice({ coarse: true }), true);
  assert.equal(isTouchDevice({ coarse: false }), false);
  assert.equal(isTouchDevice({}), false);
  assert.equal(isTouchDevice({ search: '?fast=1&touch=1' }), true);
  assert.equal(isTouchDevice({ search: '?touch=1' }), true);
  assert.equal(isTouchDevice({ coarse: true, search: '?touch=0' }), false);
  assert.equal(isTouchDevice({ coarse: false, search: '?touch=10' }), false, 'only 0 or 1');
  assert.equal(isTouchDevice({ coarse: true, search: '?x=1' }), true);
  assert.equal(MIN_TARGET, 44);
});

test('every pad button is a real key, has a name for the screen reader, and the ids are unique', () => {
  for (const [name, pad] of Object.entries(PADS)) {
    assert.ok(pad.length >= 2, name);
    assert.equal(new Set(pad.map((b) => b.id)).size, pad.length, `${name}: unique ids`);
    for (const b of pad) {
      assert.match(b.code, CODE, `${name}/${b.id}`);
      assert.ok(b.icon || (b.label && b.label.length <= 9), `${name}/${b.id}: a short word or a drawn arrow`);
      assert.ok(!b.icon || ['up', 'down', 'left', 'right'].includes(b.icon));
      assert.ok(b.aria && b.aria.length >= 2, `${name}/${b.id}: aria`);
    }
  }
});

test('nobody is stuck behind a card: every card pad has Back (Escape)', () => {
  for (const [name, pad] of Object.entries(PADS)) {
    if (name === 'walk') continue;
    assert.ok(pad.some((b) => b.code === 'Escape'), `${name} has a way out`);
  }
});

test('the pads speak each game\'s own keys', () => {
  const codes = (name) => PADS[name].map((b) => b.code);
  assert.deepEqual(codes('coffee').slice(0, 3), DRINKS.map((d) => d.code), 'the three drinks, in the cafe\'s order');
  for (const g of ['2048', 'snake']) assert.deepEqual(codes(`arcade-${g}`).filter((c) => c !== 'Escape').sort(), ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp']);
  assert.ok(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].every((c) => codes('arcade-tetris').includes(c)), 'blocks: slide, turn, drop, slam');
  assert.ok(GAMES.every((g) => PADS[`arcade-${g.id}`]), 'every game on the computer has a pad');
  assert.ok(['KeyH', 'KeyM', 'Tab', 'KeyQ', 'KeyE'].every((c) => codes('walk').includes(c)), 'walking: hello, map, journal, camera');
});

test('which pad a card shows: by mode, and "over" for a finished run', () => {
  assert.equal(arcadePad('menu'), 'arcade-menu');
  assert.equal(arcadePad('boot'), 'arcade-boot');
  assert.equal(arcadePad('snake'), 'arcade-snake');
  assert.equal(arcadePad('snake', true), 'arcade-over');
  assert.equal(arcadePad('tetris', true), 'arcade-over');
  assert.equal(arcadePad('menu', true), 'arcade-menu', 'the menu is never "over"');
  assert.equal(coffeePad(false), 'coffee');
  assert.equal(coffeePad(true), 'coffee-over');
  for (const m of ['boot', 'menu', 'tetris', '2048', 'snake']) for (const o of [false, true]) assert.ok(PADS[arcadePad(m, o)], `${m}/${o}`);
});

test('the words on the buttons are kind and plain (no emoji, none of the banned words)', () => {
  for (const pad of Object.values(PADS)) for (const b of pad) { const s = `${b.label} ${b.aria}`; assert.ok(!BANNED.test(s), s); assert.ok(!/\p{Extended_Pictographic}/u.test(s), s); }
});

test('the key events carry the code the game reads, bubbling', () => {
  const e = keyInit('KeyM');
  assert.equal(e.code, 'KeyM'); assert.equal(e.key, 'm'); assert.equal(e.bubbles, true); assert.equal(e.cancelable, true);
  assert.equal(keyInit('Space').key, ' ');
  assert.equal(keyInit('Escape').key, 'Escape');
  assert.equal(keyInit('ArrowLeft').key, 'ArrowLeft');
});

console.log(`${n} touch tests passed`);
