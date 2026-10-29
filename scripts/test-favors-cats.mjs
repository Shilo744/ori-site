// "Ori, Can You...?" — the street cats [experimental] (pure): three cats, petted with Space next to them, a purr and a little love for the first pets, the third makes a friend; a pet a moment after a pet is only purring.      node scripts/test-favors-cats.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATS, CAT_IDS, REACH, COOLDOWN, FRIEND_AT, LOVE_PER_PET, LOVE_PETS, FRIEND_PEACHES, nearestCat, label, pet, friends, petted, nameOf } from '../src/game3d/favors/cats.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const BANNED = /\b(miss(ed|ing)?|fail(ed|s|ure|ing)?|sorry|can'?t|cannot|won'?t|not now|never|hate[sd]?|angry|annoy(ed|ing)?|stupid|useless|loser|lazy|too late|give up|ignore[ds]?|refuse[sd]?|terrible|awful|worst)\b/i;

test('three cats, the very ones the street has, each with a plain colour word and a name', () => {
  assert.deepEqual(CAT_IDS, ['ginger', 'grey', 'tuxedo']);
  assert.ok(/\['ginger', 'grey', 'tuxedo'\]/.test(readFileSync(new URL('../src/game3d/favors/life3d.js', import.meta.url), 'utf8')), 'life3d.js builds the same three');
  for (const c of CATS) { for (const t of [c.color, c.name, label(c.id, 0), label(c.id, FRIEND_AT)]) assert.ok(t.length >= 4 && t.length <= 30 && !BANNED.test(t) && !/\p{Extended_Pictographic}/u.test(t), t); }
  assert.equal(new Set(CATS.map((c) => c.name)).size, 3);
  assert.ok(REACH >= 1.5 && REACH <= 3 && COOLDOWN >= 2 && COOLDOWN <= 8 && FRIEND_AT === 3 && LOVE_PER_PET > 0 && LOVE_PETS >= FRIEND_AT && FRIEND_PEACHES > 0);
});

test('the cat within reach is the nearest one; none when they are all far; nonsense is ignored', () => {
  const list = [{ id: 'ginger', x: 10, z: 0 }, { id: 'grey', x: 11, z: 0 }, { id: 'tuxedo', x: 40, z: 40 }];
  assert.equal(nearestCat({ x: 11.5, z: 0 }, list).id, 'grey');
  assert.equal(nearestCat({ x: 9, z: 0 }, list).id, 'ginger');
  assert.equal(nearestCat({ x: 10.5, z: 0 }, list).id, 'ginger');
  assert.equal(nearestCat({ x: 0, z: 0 }, list), null);
  assert.equal(nearestCat({ x: 10, z: REACH + 0.01 }, list), null);
  assert.equal(nearestCat({ x: 10, z: 0 }, [{ id: 'dog', x: 10, z: 0 }]), null, 'only the three');
  assert.equal(nearestCat({ x: 10, z: 0 }, null), null);
});

test('the words on the chip: the colour first, the name once they are friends', () => {
  assert.equal(label('ginger', 0), 'Pet the ginger cat');
  assert.equal(label('tuxedo', 2), 'Pet the black and white cat');
  assert.equal(label('ginger', 3), 'Pet Mango');
  assert.equal(label('nope', 9), '');
  assert.equal(nameOf('grey'), 'Misty');
});

test('a pet: counted unless it is too soon; the third is a friend; love only for the first five', () => {
  assert.deepEqual(pet(0, null), { counted: true, pets: 1, friend: false, love: LOVE_PER_PET });
  assert.deepEqual(pet(1, COOLDOWN - 0.1), { counted: false, pets: 1, friend: false, love: 0 });
  assert.deepEqual(pet(1, COOLDOWN), { counted: true, pets: 2, friend: false, love: LOVE_PER_PET });
  const third = pet(2, 60);
  assert.deepEqual([third.pets, third.friend, third.love], [3, true, LOVE_PER_PET]);
  assert.equal(pet(3, 60).friend, false, 'a friend is made once');
  assert.equal(pet(LOVE_PETS - 1, 60).love, LOVE_PER_PET);
  assert.equal(pet(LOVE_PETS, 60).love, 0, 'after five pets it is only purring');
});

test('how many are petted and how many are friends', () => {
  assert.equal(friends({}), 0);
  assert.equal(friends(null), 0);
  assert.equal(petted({ cats: { ginger: 1, grey: 0 } }), 1);
  assert.equal(friends({ cats: { ginger: 3, grey: 2, tuxedo: 9, dog: 9 } }), 2);
  assert.equal(friends({ cats: { ginger: 3, grey: 3, tuxedo: 3 } }), 3);
});

console.log(`${n} cats tests passed`);
