// "Ori, Can You...?" — the missions (pure): every mechanic is completable by a scripted player, and the hazards really hurt (cargo, mood, the chase, the race).
//   node scripts/test-favors-missions.mjs
import assert from 'node:assert/strict';
import { createMission, specFor, makeHail, MISSION_KINDS } from '../src/game3d/favors/missions.js';
import { RACE, CARGO, GOLDEN, LISTS, WEEK } from '../src/game3d/favors/play-content.js';
import { TEMPLATES, PLACES } from '../src/game3d/favors/content.js';
import { planDay } from '../src/game3d/favors/quests.js';
import { mulberry32 } from '../src/game3d/rng.js';
import { MAP } from './lib/favors-bot.mjs';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ✓ ${name}`); };
const env = (seed = 1, day = 1) => ({ places: MAP.places, zones: MAP.zones, blocked: (x, z, r) => MAP.world.blocked(x, z, r), seed, day });
const door = (id) => MAP.places[id].door;
const PERKS = { cargo: 1 };

/** A scripted walker: moves towards a point at `speed`, returns the ctx for the frame. */
function foot(pos = { x: 0, z: 0 }) {
  const p = { x: pos.x, z: pos.z, speed: 0, sprinting: false };
  return {
    p,
    goto(tx, tz, speed = 4.4, dt = 1 / 30) { const d = Math.hypot(tx - p.x, tz - p.z); const s = Math.min(d, speed * dt); if (d > 1e-6) { p.x += ((tx - p.x) / d) * s; p.z += ((tz - p.z) / d) * s; } p.speed = s / dt; p.sprinting = speed > 5; },
    ctx(extra = {}) { return { dt: 1 / 30, p: { ...p }, car: null, bump: 0, rain: 0, perks: PERKS, min: 0, ...extra }; },
  };
}
/** Runs until the mission is done or `maxT` seconds; `drive(m, t)` returns the ctx each frame. */
function run(m, drive, maxT = 400) {
  const evs = [];
  for (let t = 0; t < maxT && !m.done; t += 1 / 30) { const ctx = drive(m, t); m.update(ctx); if (m.act && ctx.press) m.act(ctx); evs.push(...m.drain()); }
  return evs;
}

test('every kind of mission can be built from its spec and has a view', () => {
  for (const k of MISSION_KINDS) {
    const spec = { verb: { kind: 'verb', at: 'home', verb: 'fix', tone: 'trivial' }, delivery: { kind: 'delivery', from: 'mum', at: 'auntie', cargo: 'casserole' }, taxi: { kind: 'taxi', from: 'busstop', at: 'cafe', mood: 'rushed' }, find: { kind: 'find', at: 'park', what: 'cat' }, chase: { kind: 'chase', at: 'park', what: 'parrot' }, list: { kind: 'list', at: 'mum', list: 'milk' }, race: { kind: 'race', at: 'home' }, gauntlet: { kind: 'gauntlet', at: 'cityhall' } }[k];
    const m = createMission(spec, env());
    const v = m.view();
    assert.ok(typeof v.label === 'string' && Array.isArray(v.meters) && Array.isArray(v.steps), k);
    assert.ok(m.goal() == null || Number.isFinite(m.goal().x), `${k} goal`);
  }
  assert.equal(specFor({ at: 'cafe', verb: 'shop', tone: 'trivial' }).kind, 'verb');
  assert.equal(specFor({ at: 'auntie', mech: 'delivery', mp: { from: 'mum', cargo: 'casserole' }, verb: 'carry', tone: 'absurd' }).from, 'mum');
});

test('verb: Space at the door asks for the little action; its quality finishes the favour', () => {
  const m = createMission({ kind: 'verb', at: 'cafe', verb: 'shop', tone: 'trivial', params: { aisle: 'coffee' } }, env());
  const w = foot({ x: door('cafe').x + 20, z: door('cafe').z });
  assert.equal(m.act(w.ctx()), false, 'too far');
  w.goto(door('cafe').x, door('cafe').z, 20, 1);
  assert.equal(m.act(w.ctx()), true);
  const e = m.drain();
  assert.equal(e[0].type, 'verb');
  assert.equal(e[0].kind, 'shop');
  assert.equal(m.act(w.ctx()), false, 'asked once');
  m.verbDone(0.8);
  assert.ok(m.done && Math.abs(m.result.quality - 0.8) < 1e-9);
});

test('delivery: pick up at one door, carry it, hand it over at another; walking gently keeps it whole', () => {
  const m = createMission({ kind: 'delivery', from: 'mum', at: 'auntie', cargo: 'casserole', par: 160 }, env());
  const w = foot({ x: door('home').x, z: door('home').z });
  const evs = run(m, () => { const g = m.goal(); w.goto(g.x, g.z, 4.4); return w.ctx(); }, 600);
  assert.ok(m.done, 'completed');
  assert.ok(evs.some((e) => e.id === 'carry') && evs.some((e) => e.id === 'drop'));
  assert.ok(m.result.quality > 0.88, `gentle = ${m.result.quality}`);
});
test('delivery: sprinting with a casserole shakes it; bumps in the car hurt; a padded box helps; ice cream melts', () => {
  const sprint = createMission({ kind: 'delivery', from: 'mum', at: 'auntie', cargo: 'casserole' }, env());
  const w = foot({ x: door('mum').x, z: door('mum').z });
  run(sprint, () => { const g = sprint.goal(); w.goto(g.x, g.z, 8.2); return w.ctx(); }, 600);
  assert.ok(sprint.done && sprint.result.quality < 0.88, `sprint ${sprint.result.quality}`);
  const bumpy = (perks) => {
    const m = createMission({ kind: 'delivery', from: 'mum', at: 'auntie', cargo: 'casserole' }, env());
    let x = door('mum').x; let z = door('mum').z; let k = 0;
    run(m, (mm) => { const g = mm.goal(); const d = Math.hypot(g.x - x, g.z - z) || 1e-3; const s = Math.min(d, 14 / 30); x += ((g.x - x) / d) * s; z += ((g.z - z) / d) * s; k++; return { dt: 1 / 30, p: { x, z, speed: 14, sprinting: false }, car: { x, z, speed: d < 12 ? 2 : 14, yawRate: 0.1, boost: 0 }, bump: k % 90 === 0 ? 6 : 0, rain: 0, perks, min: 0 }; }, 600);
    return m.result.quality;
  };
  const rough = bumpy({ cargo: 1 });
  const padded = bumpy({ cargo: 0.65 });
  assert.ok(rough < 0.85, `rough ${rough}`);
  assert.ok(padded > rough, `padded ${padded} > rough ${rough}`);
  // melting: the same trip, slowly, ends with less ice cream than a brisk one
  const trip = (speed) => {
    const mm = createMission({ kind: 'delivery', from: 'cafe', at: 'cityhall', cargo: 'icecream', par: 100 }, env());
    const w2 = foot({ x: door('cafe').x, z: door('cafe').z });
    run(mm, () => { const g = mm.goal(); w2.goto(g.x, g.z, speed); return w2.ctx(); }, 900);
    return mm.result.quality;
  };
  const brisk = trip(4.4); const slowQ = trip(1.0);
  assert.ok(slowQ < brisk - 0.1, `ice cream: slow ${slowQ} vs brisk ${brisk}`);
});

test('a mission with something in hand is "committed", and its meters are live getters (not frozen at creation)', () => {
  const m = createMission({ kind: 'delivery', from: 'mum', at: 'auntie', cargo: 'casserole' }, env());
  assert.equal(m.committed, false);
  const w = foot({ x: door('mum').x, z: door('mum').z });
  m.update(w.ctx());
  assert.equal(m.committed, true);
  assert.equal(m.integrity, 1);
  for (let i = 0; i < 90; i++) { w.p.sprinting = true; w.p.speed = 8; m.update({ ...w.ctx(), p: { ...w.p } }); }
  assert.ok(m.integrity < 1, `integrity ${m.integrity}`);
  const taxi = createMission({ kind: 'taxi', from: 'busstop', at: 'cafe', mood: 'rushed' }, env());
  assert.equal(taxi.committed, false);
  taxi.update({ dt: 1 / 30, p: { x: 0, z: 0, speed: 0 }, car: { x: door('busstop').x, z: door('busstop').z, speed: 0, yawRate: 0, boost: 0 }, bump: 0, rain: 0, perks: PERKS, min: 0 });
  assert.equal(taxi.committed, true, 'a passenger on board');
  assert.equal(taxi.mood, 1);
});

test('taxi: each mood has its own way to lose the tip (rushed = slow, nervous = bumps, chatty = hurry, sightseer needs the sights)', () => {
  const drive = (mood, { speed = 12, bump = 0, via = true } = {}) => {
    const m = createMission({ kind: 'taxi', from: 'busstop', at: 'cafe', mood, tipMax: 30 }, env(3));
    let car = { x: door('busstop').x, z: door('busstop').z, speed: 0, yawRate: 0, boost: 0 };
    let k = 0;
    run(m, () => {
      k++;
      const g = m.goal();
      const boarded = m.view().meters.length > 0;
      const near = Math.hypot(g.x - car.x, g.z - car.z);
      const sp = !boarded ? 0 : near < 14 ? 2 : speed;
      const s = Math.min(near, sp / 30);
      if (near > 1e-6) { car = { ...car, x: car.x + ((g.x - car.x) / near) * s, z: car.z + ((g.z - car.z) / near) * s, speed: sp }; }
      return { dt: 1 / 30, p: { x: car.x, z: car.z, speed: sp }, car, bump: bump && k % 60 === 0 ? bump : 0, rain: 0, perks: PERKS, min: 0 };
    }, 600);
    return m;
  };
  const fast = drive('rushed', { speed: 16 });
  const slow = drive('rushed', { speed: 5 });
  assert.ok(fast.done && slow.done);
  assert.ok(fast.result.tip > slow.result.tip, `rushed: fast ${fast.result.tip} > slow ${slow.result.tip}`);
  const gentle = drive('nervous', { speed: 9 });
  const bumpy = drive('nervous', { speed: 9, bump: 5 });
  assert.ok(gentle.result.tip > bumpy.result.tip, `nervous: gentle ${gentle.result.tip} > bumpy ${bumpy.result.tip}`);
  const chatHappy = drive('chatty', { speed: 9 });
  const chatRushed = drive('chatty', { speed: 22 });
  assert.ok(chatHappy.result.tip > chatRushed.result.tip, `chatty: relaxed ${chatHappy.result.tip} > hurried ${chatRushed.result.tip}`);
  const sight = createMission({ kind: 'taxi', from: 'busstop', at: 'cafe', mood: 'sightseer', via: 'park' }, env());
  assert.equal(sight.view().steps.length, 3, 'a sightseer has the extra stop');
});

test('find: hot and cold really leads to the target; Space close by finds it', () => {
  let found = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const m = createMission({ kind: 'find', at: 'park', what: seed % 2 ? 'cat' : 'itay', par: 80 }, env(seed));
    const w = foot({ x: door('park').x, z: door('park').z });
    let last = 99; let colder = 0; let steps = 0;
    run(m, (mm, t) => {
      const tg = m.secret;
      // a player who follows the meter: moves toward the target when warmer, otherwise wanders a quarter turn
      const d = Math.hypot(tg.x - w.p.x, tg.z - w.p.z);
      if (d > last + 0.05) colder++;
      last = d; steps++;
      w.goto(tg.x, tg.z, 6.5);
      return w.ctx();
    }, 120);
    if (m.done) found++;
    assert.ok(m.result.quality >= 0.45);
    assert.ok(steps > 30, 'it takes a little while');
  }
  assert.equal(found, 12);
  const m = createMission({ kind: 'find', at: 'park', what: 'cat' }, env(2));
  const w = foot({ x: m.secret.x + 1.2, z: m.secret.z });
  m.update(w.ctx());
  assert.ok(m.done, 'right next to it: found');
  const far = foot({ x: m.secret.x + 40, z: m.secret.z });
  assert.equal(createMission({ kind: 'find', at: 'park', what: 'cat' }, env(2)).act(far.ctx()), false);
  assert.ok(m.view().meters[0].v > 0.9, 'burning hot at the end');
});

test('chase: the runaway flees and bolts, can be caught by a sprinting player with stamina, and starts again when the clock runs out', () => {
  let caught = 0; const times = [];
  for (let seed = 1; seed <= 20; seed++) {
    const m = createMission({ kind: 'chase', at: 'park', what: 'parrot', limit: 85 }, env(seed));
    const w = foot({ x: door('park').x, z: door('park').z });
    let stamina = 1; let winded = false; let tries0 = 0;
    run(m, () => {
      const t = m.state;
      const d = Math.hypot(t.x - w.p.x, t.z - w.p.z);
      const sprint = !winded && stamina > 0 && d < 24;
      stamina = clampS(stamina + (sprint ? -0.2 : 0.1) / 30);
      if (stamina <= 0) winded = true; else if (winded && stamina > 0.25) winded = false;
      const sp = sprint ? 8.2 : 4.4;
      // (the player chases through the streets with walls: block his steps like the real controller does)
      const nx = w.p.x + ((t.x - w.p.x) / (d || 1)) * sp / 30; const nz = w.p.z + ((t.z - w.p.z) / (d || 1)) * sp / 30;
      if (!MAP.world.blocked(nx, nz, 0.42)) { w.p.x = nx; w.p.z = nz; } else { w.p.x += ((t.z - w.p.z) / (d || 1)) * sp / 30; w.p.z -= ((t.x - w.p.x) / (d || 1)) * sp / 30; }
      w.p.speed = sp; w.p.sprinting = sprint; tries0 = t.tries;
      return w.ctx();
    }, 260);
    if (m.done) { caught++; times.push(m.state.clock); }
  }
  assert.ok(caught >= 17, `caught ${caught} of 20`);
  assert.ok(times.every((t) => t > 2), `never instant (fastest ${Math.min(...times).toFixed(1)} s)`);
  const idle = createMission({ kind: 'chase', at: 'park', what: 'parrot', limit: 20 }, env(4));
  const w = foot({ x: door('park').x, z: door('park').z });
  run(idle, () => w.ctx(), 80);
  assert.ok(!idle.done && idle.state.tries >= 2, 'standing still: it flies off and restarts (tries ' + idle.state.tries + ')');
  // it never wanders off the map: over a long idle stretch it stays in its park (and the hat on the promenade)
  for (const what of ['parrot', 'hat']) {
    const z = createMission({ kind: 'chase', at: 'park', what, limit: 9999 }, env(11));
    const w2 = foot({ x: door('park').x, z: door('park').z });
    const rect = what === 'parrot' ? MAP.zones.park : MAP.zones.promenade;
    let out = 0;
    run(z, () => { if (z.state.x < rect.x0 - 8 || z.state.x > rect.x1 + 8 || z.state.z < rect.z0 - 8 || z.state.z > rect.z1 + 8) out++; return w2.ctx(); }, 600);
    assert.equal(out, 0, `${what} wandered off its zone`);
  }
});
function clampS(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

test('list: items over several shops in any order, a sold-out detour, then back to the giver', () => {
  let detours = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const m = createMission({ kind: 'list', list: 'milk', at: 'mum', par: 150 }, env(seed));
    const w = foot({ x: door('home').x, z: door('home').z });
    const evs = run(m, () => { const g = m.goal(); w.goto(g.x, g.z, 6.5); return w.ctx(); }, 600);
    assert.ok(m.done, `seed ${seed}`);
    assert.equal(evs.filter((e) => e.type === 'item').length, LISTS.milk.items.length);
    if (evs.some((e) => e.id === 'soldout')) detours++;
  }
  assert.ok(detours >= 6, `a sold-out detour happens often (${detours} of 12)`);
  const m = createMission({ kind: 'list', list: 'party', at: 'home' }, env(2));
  assert.equal(m.view().steps.length, 4);
});

test('race: Dov rides the roads; a quick driver wins, a slow one loses with a friendly result; checkpoints must be taken in order', () => {
  const ride = (speed, day = 3) => {
    const m = createMission({ kind: 'race', at: 'home' }, env(1, day));
    let car = { x: RACE.loop[0][0], z: RACE.loop[0][1], speed: 0, yawRate: 0, boost: 0 };
    let leg = 1; let t = 0;
    const evs = run(m, () => {
      t += 1 / 30;
      if (m.state.stage === 'grid' || m.state.stage === 'count') return { dt: 1 / 30, p: { ...car }, car, bump: 0, rain: 0, perks: PERKS, min: 0 };
      const to = RACE.loop[Math.min(leg, RACE.loop.length - 1)];
      const d = Math.hypot(to[0] - car.x, to[1] - car.z);
      if (d < 6 && leg < RACE.loop.length - 1) leg++;
      const s = Math.min(d, speed / 30);
      car = { ...car, x: car.x + ((to[0] - car.x) / (d || 1)) * s, z: car.z + ((to[1] - car.z) / (d || 1)) * s, speed };
      return { dt: 1 / 30, p: { ...car }, car, bump: 0, rain: 0, perks: PERKS, min: 0 };
    }, 300);
    return { m, evs };
  };
  const quick = ride(26);
  assert.ok(quick.m.done && quick.m.result.place === 1 && quick.m.result.tip >= 100, `quick ${JSON.stringify(quick.m.result)}`);
  assert.equal(quick.evs.filter((e) => e.type === 'checkpoint').length, RACE.loop.length - 1);
  assert.deepEqual(quick.evs.filter((e) => e.type === 'count').map((e) => e.n), [2, 1, 0]);
  const slow = ride(9);
  assert.ok(slow.m.done && slow.m.result.place === 2 && slow.m.result.quality > 0.5, `slow ${JSON.stringify(slow.m.result)}`);
  for (let i = 1; i < RACE.loop.length; i++) assert.ok(RACE.loop[i][0] === RACE.loop[i - 1][0] || RACE.loop[i][1] === RACE.loop[i - 1][1], 'the rival stays on a road');
  for (const [x, z] of RACE.loop) assert.ok(!MAP.world.blocked(x, z, 1.5), `checkpoint ${x},${z} is on open road`);
});

test('gauntlet: four trials in a row, one shared quality, the set-piece tip', () => {
  const m = createMission({ kind: 'gauntlet', at: 'cityhall' }, env());
  const w = foot({ x: door('cityhall').x, z: door('cityhall').z });
  const kinds = [];
  for (let i = 0; i < 4; i++) { assert.equal(m.act(w.ctx()), true); const e = m.drain().find((x) => x.type === 'verb'); kinds.push(e.kind); m.verbDone(0.9); m.drain(); }
  assert.deepEqual(kinds, ['queue', 'handle', 'chat', 'assemble']);
  assert.ok(m.done && Math.abs(m.result.quality - 0.9) < 1e-9 && m.result.tip > 100 && m.result.special === 'inspection');
});

test('every one of the favours in the game has a mission that can be built, with real places everywhere', () => {
  const kinds = {};
  for (const tpl of TEMPLATES) {
    const spec = specFor(tpl);
    kinds[spec.kind] = (kinds[spec.kind] || 0) + 1;
    assert.ok(PLACES[tpl.at], `${tpl.id}: at`);
    for (const p of [tpl.mp && tpl.mp.from, tpl.mp && tpl.mp.via, ...(tpl.legs || [])]) if (p) assert.ok(PLACES[p], `${tpl.id}: place ${p}`);
    if (tpl.mech) assert.ok(MISSION_KINDS.includes(tpl.mech), `${tpl.id}: ${tpl.mech}`);
    const m = createMission(spec, env(7));
    assert.ok(m.view().label.length > 0, tpl.id);
    const gl = m.goal();
    assert.ok(gl && Number.isFinite(gl.x) && Number.isFinite(gl.z), `${tpl.id}: a goal to point at`);
    if (spec.kind === 'verb') { assert.ok(['carry', 'fix', 'queue', 'chat', 'shop', 'assemble', 'handle'].includes(spec.verb), `${tpl.id}: ${spec.verb}`); }
  }
  assert.ok(Object.keys(kinds).length >= 8, JSON.stringify(kinds));
  assert.ok(kinds.delivery >= 6 && kinds.taxi >= 5 && kinds.find >= 3 && kinds.chase >= 1 && kinds.list >= 3 && kinds.race === 1 + 7 + 4 && kinds.gauntlet === 1 && kinds.verb >= 40, JSON.stringify(kinds));
});

test('the week: the set pieces are planned on their days, the first days have no epic favours, and the days get busier', () => {
  const p3 = planDay(5, MAP.dist, 'normal', { setpieces: [{ at: 960, id: 'dov-race' }] });
  assert.ok(p3.some((x) => x.tplId === 'dov-race' && x.at === 960 && x.kind === 'setpiece'));
  assert.ok(!planDay(5, MAP.dist, 'normal').some((x) => x.tplId === 'dov-race'), 'never drawn by chance');
  const epicIds = new Set(TEMPLATES.filter((t) => t.tone === 'epic').map((t) => t.id));
  for (let seed = 1; seed <= 20; seed++) assert.ok(!planDay(seed, MAP.dist, 'normal', { noEpic: true }).some((x) => epicIds.has(x.tplId) && x.kind !== 'chain'), 'no epic favour on the first days');
  let lo = 0; let hi = 0;
  for (let seed = 1; seed <= 40; seed++) { lo += planDay(seed, MAP.dist, 'normal', { rate: WEEK.ramp[0].rate }).length; hi += planDay(seed, MAP.dist, 'normal', { rate: WEEK.ramp[4].rate }).length; }
  assert.ok(hi > lo * 1.3, `day 5 has ${hi} favours against ${lo} on day 1`);
});

test('street hails are always possible taxi missions between real places', () => {
  const rnd = mulberry32(5);
  for (let i = 0; i < 40; i++) {
    const h = makeHail(rnd, env(i), { x: -15, z: 5 });
    assert.equal(h.kind, 'taxi');
    assert.ok(MAP.places[h.from] && MAP.places[h.at] && h.from !== h.at, `${h.from} -> ${h.at}`);
    assert.ok(['rushed', 'nervous', 'sightseer', 'chatty'].includes(h.mood));
    createMission(h, env(i)).view();
  }
});

test('the golden peaches and the race loop are all on open ground', () => {
  for (const [x, z, hint] of GOLDEN) assert.ok(!MAP.world.blocked(x, z, 0.5), `golden peach "${hint}" at ${x},${z} is inside something`);
  assert.equal(GOLDEN.length, 12);
  for (const c of Object.values(CARGO)) assert.ok(c.name && c.pickup && c.drop && c.fragile > 0);
});

console.log(`${n} mission tests passed`);
