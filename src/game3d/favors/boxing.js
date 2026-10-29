// "Ori, Can You...?" — the BOXING RING (PURE, seeded: no DOM, no three). One bout: Ori against an opponent on a small square ring, in real time.
// What you DO: move, jab (J), cross (K), guard (hold L / Shift), dash (Space) - and read the other fighter: every punch shows its wind-up before it lands, so
// a dash at the right moment (a PERFECT dodge) or a guard at the right moment (a PARRY) beats the strongest punch and opens the counter.
// The sim turns inputs into fighter states + a list of events (hit, block, parry, dodge, blink, ko ...) that the 3D side shows and plays.
//   input   = { mx, mz (world axes, <= 1), jab, cross, fury, dash (one-frame pulses), block (held) }
//   fighter = { x, z, face, hp, st, state: 'idle' | 'attack' | 'dash' | 'hit' | 'guardbreak' | 'down' | 'ko' | 'win', move, phase: 'wind' | 'active' | 'rec', t, blocking, ... }
// The first time a fighter's health runs out he goes DOWN (a count of five, he gets up on his own - the player gets up quicker by mashing the punch keys - with a little
// health back); the second time is the knock-out. Events: knockdown { who, n }, count { who, n }, getup { who }.
import { mulberry32, subSeed, wrapPi } from '../rng.js';
import { statsFor } from './boxer.js';

export const RING = { half: 3.3, rope: 0.4 };
const LIM = RING.half - RING.rope;
const BODY = 0.78; // fighters never get closer than this (centre to centre)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** times in seconds at normal speed; reach = centre to centre; dmg at damage 1.0 */
export const MOVES = {
  jab: { wind: 0.12, act: 0.06, rec: 0.2, reach: 1.62, dmg: 6, st: 8, stun: 0.26, push: 0.3, lunge: 0.22, cancel: 0.7 },
  cross: { wind: 0.2, act: 0.08, rec: 0.34, reach: 1.78, dmg: 13, st: 16, stun: 0.45, push: 0.75, lunge: 0.42, cancel: 0.75 },
  hook: { wind: 0.26, act: 0.08, rec: 0.36, reach: 1.74, dmg: 17, st: 20, stun: 0.6, push: 1.0, lunge: 0.38, cancel: 0.8, blockSt: 1.35 }, // (a hook is blocked like any punch, it just costs more breath)
  upper: { wind: 0.3, act: 0.08, rec: 0.46, reach: 1.6, dmg: 24, st: 26, stun: 0.95, push: 1.7, lunge: 0.3, cancel: 0.85, breaks: true, blockSt: 1.8 }, // (the uppercut is the one punch that goes under a guard: dash it, or parry it)
};
const DASH = { dist: 2.1, time: 0.2, iframes: 0.15, cd: 0.42, st: 11, perfect: 0.26 };
const BLINK = { dist: 3.4, time: 0.07, iframes: 0.2, cd: 1.1 };
const BLOCK = { chip: 0.14, stCost: 1.5, parry: 0.14, parryStun: 0.6, breakStun: 0.8, walk: 0.6 }; // (walk: how fast he still moves with the guard up)

const mkFighter = (id, s, x, z, face) => ({
  id, x, z, face, vx: 0, vz: 0,
  hp: s.maxHp, maxHp: s.maxHp, st: s.maxSt, maxSt: s.maxSt, dmg: s.dmg, speed: s.speed, atk: s.atk, regen: s.regen, unlocks: s.unlocks || {},
  state: 'idle', t: 0, move: null, phase: null, hitDone: false, queued: null, queuedT: 0, chain: 0, chainT: 0,
  mdx: 0, mdz: 0, blocking: false, blockT: 9, stun: 0, armor: 0, iframes: 0, dashT: 9, dashCd: 0, dashDx: 0, dashDz: 0, dashFrom: [0, 0], blinking: 0,
  combo: 0, comboT: 0, counter: 0, hurt: 0, chainHits: 0, fury: 0, furyHits: 0, meter: 0, moving: 0, lag: 0, tired: 0, downs: 0, downT: 0, getupAt: 0, counted: 0, mashT: 0,
});

/**
 * One bout.
 * @param {{ level?: number, opp: object, seed?: number, round?: number }} o `opp` = an entry of fight-content.js OPPONENTS (hp, dmg, speed, atk, ai...)
 */
export function createBout({ level = 1, opp, seed = 1, round = 75, intro = 1.6 } = {}) {
  const rnd = mulberry32(subSeed(seed, 5));
  const ps = statsFor(level);
  const os = { maxHp: opp.hp, maxSt: opp.st ?? 100, dmg: opp.dmg ?? 1, speed: opp.speed ?? 1, atk: opp.atk ?? 1, regen: opp.regen ?? 1, unlocks: { combo: true } };
  const P = mkFighter('player', ps, 0, 1.45, Math.PI);
  const O = mkFighter('opp', os, 0, -1.45, 0);
  const events = [];
  const emit = (e) => events.push(e);
  const b = {
    P, O, opp, level, time: 0, timeLeft: round, round, intro, over: false, result: null, over_t: 0, slow: 0, slowK: 0.35, stats: { maxCombo: 0, perfect: 0, parry: 0, taken: 0, dealt: 0, hits: 0, thrown: 0, downs: 0 },
    drain() { return events.splice(0, events.length); },
  };

  // ── the opponent's brain ──
  const A = opp.ai || {};
  const ai = { think: 0, plan: [], rest: A.start ?? 0.8, circle: 1, circleT: 0, block: 0, mode: 'approach', dashIn: 0 };
  const aiInput = (dt) => {
    const inp = { mx: 0, mz: 0, jab: false, cross: false, hook: false, upper: false, dash: false, block: false, blink: false, feint: false };
    if (O.state === 'ko' || O.state === 'win' || O.state === 'down') return inp;
    if (P.state === 'down') { // he is down: step back and wait for the count (no punches at a man on the canvas)
      const bx = P.x - O.x; const bz = P.z - O.z; const bd = Math.hypot(bx, bz) || 1;
      if (bd < 3.2) { inp.mx = -bx / bd; inp.mz = -bz / bd; }
      ai.plan = []; ai.rest = Math.max(ai.rest, 0.7);
      return inp;
    }
    const dx = P.x - O.x; const dz = P.z - O.z; const d = Math.hypot(dx, dz) || 1e-6;
    const fx = dx / d; const fz = dz / d;
    ai.think -= dt; ai.rest -= dt; ai.block -= dt; ai.circleT -= dt; ai.dashIn -= dt;
    if (ai.circleT <= 0) { ai.circle = rnd() < 0.5 ? 1 : -1; ai.circleT = 0.8 + rnd() * 1.6; }
    const foeAttacking = P.state === 'attack' && P.phase !== 'rec';
    const foeOpen = P.state === 'hit' || P.state === 'guardbreak' || (P.state === 'attack' && P.phase === 'rec');
    // react to a punch coming: guard it or step out of the way (a person is never perfect: `react` is how slow he is)
    if (foeAttacking && d < (MOVES[P.move] ? MOVES[P.move].reach + 0.5 : 2.2) && P.t > (A.react ?? 0.25) * 0.4 && ai.think <= 0) {
      ai.think = (A.react ?? 0.25) * (0.7 + rnd() * 0.6);
      const r = rnd();
      if (r < (A.dodge ?? 0.1)) { if (A.blink) inp.blink = true; else inp.dash = true; inp.mx = -fz * ai.circle; inp.mz = fx * ai.circle; }
      else if (r < (A.dodge ?? 0.1) + (A.block ?? 0.2)) ai.block = 0.45 + rnd() * 0.3;
    }
    if (ai.block > 0 && O.state === 'idle') inp.block = true;
    const range = A.range ?? 1.45;
    // movement: approach, hold the range, circle
    if (O.state === 'idle' || O.state === 'idle-block') {
      if (d > range + 0.35) { inp.mx = fx; inp.mz = fz; }
      else if (d < range - 0.45) { inp.mx = -fx * 0.8; inp.mz = -fz * 0.8; }
      else { inp.mx = -fz * ai.circle * 0.6; inp.mz = fx * ai.circle * 0.6; }
      if (A.blink && ai.dashIn <= 0 && d > 3.0 && O.blinking <= 0 && O.dashCd <= 0) { inp.blink = true; ai.dashIn = 1.6 + rnd() * 1.4; inp.mx = fx; inp.mz = fz; }
    }
    // attack: a pattern is a list of punches thrown one after the other
    if (!ai.plan.length && ai.rest <= 0 && O.state === 'idle' && d <= range + 0.25) {
      const pats = A.patterns || [['jab']];
      ai.plan = pats[Math.floor(rnd() * pats.length)].slice();
    }
    if (foeOpen && ai.plan.length === 0 && ai.rest <= 0 && d <= range + 0.4 && O.state === 'idle' && rnd() < (A.punish ?? 0.5)) ai.plan = ['cross'];
    if (ai.plan.length && (O.state === 'idle' || (O.state === 'attack' && O.phase === 'rec' && O.t >= MOVES[O.move].rec * 0.35)) && d <= (MOVES[ai.plan[0]] ? MOVES[ai.plan[0]].reach : 1.6) + 0.35) {
      const m = ai.plan.shift();
      inp[m] = true;
      // a feint: he starts the punch, pulls out of it half way and throws it for real a beat later - a dash at the first wind-up is then spent (only the clever ones do it)
      const fup = ai.followUp; ai.followUp = false; // (the real punch after a feint is never a feint again)
      if (A.feint && !fup && O.state === 'idle' && ai.plan.length === 0 && rnd() < A.feint) inp.feint = true;
      if (!ai.plan.length) ai.rest = (A.rest ? A.rest[0] + rnd() * (A.rest[1] - A.rest[0]) : 0.7);
    } else if (ai.plan.length && d > 2.4) ai.plan = [];
    return inp;
  };

  // ── helpers ──
  const dirTo = (a, c) => { const dx = c.x - a.x; const dz = c.z - a.z; const d = Math.hypot(dx, dz) || 1e-6; return [dx / d, dz / d, d]; };
  const dur = (f, m) => ({ wind: (MOVES[m].wind * (f.id === 'opp' ? (opp.ai && opp.ai.tell) || 1 : 1)) / f.atk, act: MOVES[m].act / f.atk, rec: MOVES[m].rec / f.atk });
  function startAttack(f, m, o) {
    const mv = MOVES[m];
    if (f.st < mv.st * 0.5) { f.tired = 0.4; if (f.id === 'player') emit({ type: 'tired', who: f.id }); return false; }
    f.st = Math.max(0, f.st - mv.st);
    f.state = 'attack'; f.move = m; f.phase = 'wind'; f.t = 0; f.hitDone = false; f.queued = null; f.blocking = false; f.feint = false;
    f.d = dur(f, m);
    b.stats.thrown += f.id === 'player' ? 1 : 0;
    if (f.id === 'player') { if (m === 'jab') f.chain = f.chainT > 0 && f.chainMove === 'jab' ? f.chain + 1 : 1; else f.chain = 0; f.chainMove = m; f.chainT = 1.0; }
    emit({ type: 'swing', who: f.id, move: m, wind: f.d.wind });
    void o;
    return true;
  }
  /** What the player asked for becomes a move (the combinations: jab, jab, cross -> hook; jab, jab, jab, cross -> uppercut; after a perfect dodge a counter). */
  function pick(f, inp) {
    if (inp.fury) return 'fury';
    if (inp.hook) return 'hook';
    if (inp.upper) return 'upper';
    if (inp.jab) return 'jab';
    if (inp.cross) {
      if (f.id === 'player') {
        if (f.counter > 0 && f.unlocks.counter) return 'cross';
        if (f.chain >= 3 && f.chainMove === 'jab' && f.unlocks.upper) return 'upper';
        if (f.chain >= 2 && f.chainMove === 'jab' && f.unlocks.combo) return 'hook';
      }
      return 'cross';
    }
    return null;
  }
  function startDash(f, inp, blink) {
    const o = f === P ? O : P;
    const [fx, fz, d] = dirTo(f, o);
    let dx = inp.mx; let dz = inp.mz;
    const m = Math.hypot(dx, dz);
    if (m < 0.25) { dx = -fx; dz = -fz; } else { dx /= m; dz /= m; }
    const cfg = blink ? BLINK : DASH;
    f.state = 'dash'; f.t = 0; f.phase = null; f.move = null; f.blocking = false; f.dashT = 0; f.dashCd = cfg.cd; f.queued = null;
    f.blinking = blink ? cfg.time + 0.35 : 0;
    f.iframes = cfg.iframes;
    f.dashFrom = [f.x, f.z];
    if (blink) { // to the far side of the player: behind him (a "glitch")
      const tx = o.x + fx * 1.15 + (-fz) * 0.4 * (rnd() < 0.5 ? 1 : -1); const tz = o.z + fz * 1.15 + fx * 0.4;
      const dist = Math.min(BLINK.dist, Math.hypot(tx - f.x, tz - f.z));
      const ux = (tx - f.x) / (Math.hypot(tx - f.x, tz - f.z) || 1); const uz = (tz - f.z) / (Math.hypot(tx - f.x, tz - f.z) || 1);
      f.dashDx = ux * dist; f.dashDz = uz * dist; f.dashTime = BLINK.time;
      emit({ type: 'blink', who: f.id, from: [f.x, f.z] });
    } else { f.dashDx = dx * DASH.dist; f.dashDz = dz * DASH.dist; f.dashTime = DASH.time; f.st = Math.max(0, f.st - DASH.st); emit({ type: 'dash', who: f.id, dir: [dx, dz] }); }
    void d;
  }
  /** The first time his health runs out: down, with a count. */
  function knockdown(f, by) {
    f.downs++; b.stats.downs += f.id === 'player' ? 1 : 0;
    f.state = 'down'; f.t = 0; f.hp = 0.01; f.move = null; f.phase = null; f.blocking = false; f.queued = null; f.stun = 0; f.downT = 0; f.counted = 0; f.mashT = 0;
    f.getupAt = f.id === 'player' ? 3.4 : (A.blink ? 2.2 : 2.9) + rnd() * 1.0;
    by.meter = Math.min(100, by.meter + 25);
    emit({ type: 'knockdown', who: f.id, n: f.downs });
  }
  function getUp(f) {
    f.state = 'idle'; f.t = 0; f.downT = 0; f.counted = 0;
    f.hp = f.maxHp * (f.id === 'player' ? 0.3 : 0.22); f.st = Math.max(f.st, f.maxSt * 0.6); f.iframes = 1.2;
    emit({ type: 'getup', who: f.id });
  }
  function ko(f, by) {
    f.state = 'ko'; f.t = 0; f.hp = 0; f.move = null; f.phase = null; f.blocking = false;
    by.state = 'win'; by.t = 0;
    emit({ type: 'ko', who: f.id });
  }

  function resolve(att, tgt, m, scale = 1) {
    const mv = MOVES[m];
    const [fx, fz, d] = dirTo(att, tgt);
    emit({ type: 'strike', who: att.id, move: m });
    if (d > mv.reach) { emit({ type: 'whiff', who: att.id, move: m }); return; }
    if (tgt.state === 'ko' || tgt.state === 'down') return;
    if (tgt.iframes > 0) { // missed him: he was already gone
      emit({ type: 'dodged', who: tgt.id, by: att.id, move: m });
      if (tgt.state === 'dash' && tgt.dashT <= DASH.perfect) {
        tgt.counter = 1.2; tgt.meter = Math.min(100, tgt.meter + 22);
        if (tgt.id === 'player') { b.stats.perfect++; b.slow = 0.5; emit({ type: 'perfect', who: tgt.id }); }
      }
      return;
    }
    const base = mv.dmg * att.dmg * scale;
    const guarded = tgt.blocking && (tgt.state === 'idle');
    if (guarded && tgt.blockT <= BLOCK.parry) { // PARRY: the punch is thrown back at him
      att.state = 'hit'; att.stun = BLOCK.parryStun; att.t = 0; att.move = null; att.phase = null; att.queued = null;
      tgt.counter = 1.0; tgt.meter = Math.min(100, tgt.meter + 16);
      if (tgt.id === 'player') b.stats.parry++;
      emit({ type: 'parry', who: tgt.id, by: att.id, x: tgt.x, z: tgt.z });
      return;
    }
    if (guarded && !mv.breaks) {
      const chip = base * BLOCK.chip;
      tgt.hp = Math.max(1, tgt.hp - chip);
      tgt.st -= mv.dmg * BLOCK.stCost * (mv.blockSt || 1) * att.dmg * scale;
      knock(tgt, fx, fz, mv.push * 0.35);
      emit({ type: 'block', who: tgt.id, by: att.id, dmg: chip, x: tgt.x, z: tgt.z });
      if (tgt.st <= 0) { tgt.st = 0; tgt.state = 'guardbreak'; tgt.stun = BLOCK.breakStun; tgt.t = 0; tgt.blocking = false; emit({ type: 'guardbreak', who: tgt.id }); }
      return;
    }
    // a clean hit (a breaking punch goes through a guard for a bit less)
    let dmg = base * (guarded ? 0.7 : 1);
    att.comboT = 1.4; att.combo++;
    dmg *= 1 + 0.045 * Math.min(att.combo - 1, 8);
    let counter = false;
    if (att.counter > 0 && att.unlocks.counter !== false && att.id === 'player' && att.unlocks.counter) { dmg *= 1.8; att.counter = 0; counter = true; } else if (att.counter > 0 && att.id === 'opp') { dmg *= 1.4; att.counter = 0; counter = true; }
    tgt.hp -= dmg;
    tgt.hurt = 0.25;
    b.stats[att.id === 'player' ? 'dealt' : 'taken'] += dmg;
    if (att.id === 'player') { b.stats.hits++; b.stats.maxCombo = Math.max(b.stats.maxCombo, att.combo); att.meter = Math.min(100, att.meter + 7 + (counter ? 8 : 0)); }
    att.st = Math.min(att.maxSt, att.st + 3);
    tgt.blocking = false;
    if (tgt.armor > 0) { knock(tgt, fx, fz, mv.push * 0.2); } else {
      tgt.state = 'hit'; tgt.stun = mv.stun * (guarded ? 0.7 : 1); tgt.t = 0; tgt.move = null; tgt.phase = null; tgt.queued = null;
      tgt.chainHits++;
      if (tgt.chainHits >= 3) { tgt.armor = 1.0; tgt.chainHits = 0; }
      knock(tgt, fx, fz, mv.push);
    }
    emit({ type: 'hit', who: att.id, target: tgt.id, move: m, dmg, combo: att.combo, counter, heavy: mv.dmg >= 13, x: tgt.x, z: tgt.z, hp: Math.max(0, tgt.hp) });
    if (tgt.hp <= 0) { if (tgt.downs < 1 && !b.noKnockdowns) knockdown(tgt, att); else ko(tgt, att); }
  }
  function knock(f, fx, fz, amount) { f.x += fx * amount; f.z += fz * amount; }

  function fighterStep(f, o, inp, dt) {
    f.t += dt;
    f.dashT += dt; f.dashCd = Math.max(0, f.dashCd - dt); f.iframes = Math.max(0, f.iframes - dt); f.armor = Math.max(0, f.armor - dt); f.hurt = Math.max(0, f.hurt - dt);
    f.blinking = Math.max(0, f.blinking - dt); f.tired = Math.max(0, f.tired - dt); f.lag = Math.max(0, f.lag - dt);
    if (f.comboT > 0) { f.comboT -= dt; if (f.comboT <= 0) f.combo = 0; }
    if (f.chainT > 0) { f.chainT -= dt; if (f.chainT <= 0) { f.chain = 0; f.chainMove = null; } }
    if (f.counter > 0) f.counter = Math.max(0, f.counter - dt);
    if (f.queuedT > 0) { f.queuedT -= dt; if (f.queuedT <= 0) f.queued = null; }
    if (f.state !== 'hit' && f.state !== 'guardbreak') f.chainHits = Math.max(0, f.chainHits - dt * 0.8);
    f.moving = 0;
    // face the other fighter (a dash keeps the facing)
    if (f.state !== 'ko' && f.state !== 'dash') f.face = Math.atan2(o.x - f.x, o.z - f.z);
    const mag = Math.min(1, Math.hypot(inp.mx || 0, inp.mz || 0));

    if (f.state === 'ko' || f.state === 'win') return;
    if (f.state === 'down') { // on the canvas: the count, and the player gets up quicker by mashing the punch keys
      f.downT += dt; f.mashT = Math.max(0, f.mashT - dt);
      if (f.id === 'player' && f.mashT <= 0 && (inp.jab || inp.cross || inp.dash)) { f.getupAt = Math.max(1.4, f.getupAt - 0.2); f.mashT = 0.09; }
      const n = Math.min(5, Math.floor(f.downT));
      if (n > f.counted) { f.counted = n; emit({ type: 'count', who: f.id, n }); }
      if (f.downT >= f.getupAt) getUp(f);
      return;
    }
    if (f.state === 'hit' || f.state === 'guardbreak') {
      f.stun -= dt;
      if (f.stun <= 0) { f.state = 'idle'; f.t = 0; }
      return;
    }
    if (f.lag > 0) return; // (a "buffering" moment: the glitchy boss is helpless)
    if (f.state === 'dash') {
      const u = clamp(f.t / f.dashTime, 0, 1);
      const e = 1 - (1 - u) * (1 - u);
      const px = f.dashFrom[0] + f.dashDx * e; const pz = f.dashFrom[1] + f.dashDz * e;
      f.x = px; f.z = pz;
      if (u >= 1) { f.state = 'idle'; f.t = 0; if (f.blinking > 0 && f.id === 'opp') { /* the boss lands ready to strike */ ai.rest = Math.min(ai.rest, 0); } }
      return;
    }
    // stamina comes back when he is not busy
    if (f.state === 'idle') f.st = Math.min(f.maxSt, f.st + (f.blocking ? 5 : 15) * f.regen * dt);
    // the move in progress
    if (f.state === 'attack') {
      const mv = MOVES[f.move];
      if (f.phase === 'wind') {
        const [fx, fz] = dirTo(f, o);
        const sp = (mv.lunge / f.d.wind) * dt; f.x += fx * sp; f.z += fz * sp;
        if (f.feint && f.t >= f.d.wind * 0.58) { // the feint: he pulls out of the punch (the real one follows in a moment)
          const mm = f.move; f.feint = false; f.state = 'idle'; f.t = 0; f.move = null; f.phase = null; f.st = Math.min(f.maxSt, f.st + MOVES[mm].st);
          f.x -= fx * 0.25; f.z -= fz * 0.25;
          emit({ type: 'feint', who: f.id, move: mm });
          if (f.id === 'opp') { ai.plan = [mm]; ai.rest = 0.12; ai.followUp = true; }
          return;
        }
        if (f.t >= f.d.wind) { f.phase = 'active'; f.t = 0; if (!f.hitDone) { f.hitDone = true; resolve(f, o, f.move, f.moveScale || 1); } }
      } else if (f.phase === 'active') {
        if (f.t >= f.d.act) { f.phase = 'rec'; f.t = 0; }
      } else if (f.phase === 'rec') {
        const want = f.queued || pickAny(f, inp);
        if (want && f.t >= f.d.rec * mv.cancel) {
          if (want === 'fury') { startFury(f); return; }
          startAttack(f, want);
          return;
        }
        if (f.t >= f.d.rec) { f.state = 'idle'; f.t = 0; f.move = null; f.phase = null; }
      }
      if (f.state === 'attack') { const w = pickAny(f, inp); if (w) { f.queued = w; f.queuedT = 0.3; } } // (a press during a punch is remembered for a moment)
      return;
    }
    if (f.state === 'fury') { stepFury(f, o, dt); return; }
    // idle: guard, move, throw
    f.blocking = !!inp.block && f.state === 'idle';
    f.blockT = f.blocking ? (f.blockT < 9 ? f.blockT + dt : 0) : 9;
    if (inp.dash || inp.blink) {
      if (inp.blink && f.dashCd <= 0) { startDash(f, inp, true); return; }
      if (inp.dash && f.dashCd <= 0 && f.st >= DASH.st * 0.6) { startDash(f, inp, false); return; }
    }
    const w = f.queued || pickAny(f, inp);
    if (w) {
      if (w === 'fury') { if (f.meter >= 100 && f.unlocks.fury) startFury(f); return; }
      if (startAttack(f, w)) { f.feint = !!inp.feint && f.id === 'opp'; return; }
    }
    if (mag > 0.05) {
      const sp = 2.7 * f.speed * (f.blocking ? BLOCK.walk : 1) * mag;
      f.x += (inp.mx / mag) * sp * dt; f.z += (inp.mz / mag) * sp * dt;
      f.moving = sp; f.mdx = inp.mx / mag; f.mdz = inp.mz / mag; // (which way, for the footwork)
    }
  }
  const pickAny = (f, inp) => pick(f, inp);

  // ── Peach Fury: a flurry of six blows while he cannot be touched ──
  function startFury(f) {
    if (f.meter < 100 || !f.unlocks.fury) return;
    f.meter = 0; f.state = 'fury'; f.t = 0; f.furyHits = 0; f.iframes = 1.5; f.blocking = false; f.queued = null;
    emit({ type: 'fury', who: f.id });
  }
  function stepFury(f, o, dt) {
    f.iframes = Math.max(f.iframes, 0.1);
    const [fx, fz, d] = dirTo(f, o);
    if (d > 1.3) { f.x += fx * 9 * dt; f.z += fz * 9 * dt; }
    const n = Math.floor(f.t / 0.2);
    while (f.furyHits < Math.min(n, 6)) { f.furyHits++; if (d <= 1.9) resolve(f, o, f.furyHits === 6 ? 'upper' : f.furyHits % 2 ? 'jab' : 'cross', 1.25); if (o.state === 'ko' || o.state === 'down') return; }
    if (f.t >= 1.5) { f.state = 'idle'; f.t = 0; f.iframes = 0; }
  }

  b.update = function update(dt, input = {}) {
    if (b.over && b.over_t > 4) return;
    const rt = Math.min(dt, 0.05);
    let k = 1;
    if (b.slow > 0) { b.slow -= rt; k = b.slowK; }
    const d = rt * k;
    b.time += rt;
    if (b.time < intro) { P.face = Math.atan2(O.x - P.x, O.z - P.z); O.face = Math.atan2(P.x - O.x, P.z - O.z); return; }
    if (b.over) { b.over_t += rt; fighterStep(P, O, { mx: 0, mz: 0 }, d); fighterStep(O, P, { mx: 0, mz: 0 }, d); return; }
    const pin = { mx: input.mx || 0, mz: input.mz || 0, jab: !!input.jab, cross: !!input.cross, fury: !!input.fury, dash: !!input.dash, block: !!input.block };
    const oin = aiInput(d);
    // the "buffering" of a glitchy boss: after a long combo he stops for a moment
    if (A.lag && O.state === 'attack' && O.phase === 'rec' && O.combo === 0 && ai.plan.length === 0 && O.lagArmed) { O.lag = A.lag; O.lagArmed = false; emit({ type: 'lag', who: 'opp' }); }
    if (A.lag && O.state === 'attack' && O.phase === 'active') O.lagArmed = true;
    fighterStep(P, O, pin, d);
    fighterStep(O, P, oin, d);
    // keep them in the ring and apart
    for (const f of [P, O]) { f.x = clamp(f.x, -LIM, LIM); f.z = clamp(f.z, -LIM, LIM); }
    const dx = O.x - P.x; const dz = O.z - P.z; const dd = Math.hypot(dx, dz);
    if (dd < BODY && P.state !== 'dash' && O.state !== 'dash') {
      const push = (BODY - dd) / 2; const ux = dd > 1e-6 ? dx / dd : 0; const uz = dd > 1e-6 ? dz / dd : 1;
      P.x -= ux * push; P.z -= uz * push; O.x += ux * push; O.z += uz * push;
      for (const f of [P, O]) { f.x = clamp(f.x, -LIM, LIM); f.z = clamp(f.z, -LIM, LIM); }
    }
    b.timeLeft = Math.max(0, round - (b.time - intro));
    if (!b.over && (P.state === 'ko' || O.state === 'ko')) finish(P.state === 'ko' ? 'opp' : 'player', 'ko');
    else if (!b.over && b.timeLeft <= 0) {
      const a = P.hp / P.maxHp; const c = O.hp / O.maxHp;
      finish(a > c + 0.005 ? 'player' : c > a + 0.005 ? 'opp' : 'draw', 'time');
    }
  };
  function finish(winner, how) {
    b.over = true; b.over_t = 0;
    for (const f of [P, O]) if (f.state === 'down') f.getupAt = 1e9; // (the bout is over: he stays down)
    b.result = { winner, how, hp: Math.round(P.hp), hpOpp: Math.round(O.hp), stats: { ...b.stats }, time: b.time - intro };
    if (how === 'time') { if (winner === 'player') { P.state = 'win'; } else if (winner === 'opp') O.state = 'win'; }
    emit({ type: 'over', winner, how });
  }
  return b;
}

/** A scripted player for tests / demos. `skill` 0..1: how often he reads the punch; `mash`: no defence at all. */
export function botInput(b, rnd, { skill = 0.7, mash = false, aggression = 0.6 } = {}) {
  const P = b.P; const O = b.O;
  const inp = { mx: 0, mz: 0, jab: false, cross: false, fury: false, dash: false, block: false };
  if (P.state === 'down') { inp.jab = rnd() < 0.35; return inp; } // (on the canvas he mashes the keys to get up)
  const dx = O.x - P.x; const dz = O.z - P.z; const d = Math.hypot(dx, dz) || 1e-6;
  const fx = dx / d; const fz = dz / d;
  const st = (b._bot ||= { cd: 0, circle: 1, circleT: 0, think: 0, hold: 0 });
  st.cd -= 1 / 60; st.circleT -= 1 / 60; st.think -= 1 / 60; st.hold -= 1 / 60;
  if (st.circleT <= 0) { st.circle = rnd() < 0.5 ? 1 : -1; st.circleT = 0.7 + rnd() * 1.2; }
  const incoming = O.state === 'attack' && O.phase === 'wind';
  if (!mash && incoming && d < 2.5) {
    const wind = O.d ? O.d.wind : 0.2;
    const left = wind - O.t;
    if (st.think <= 0 && rnd() < skill) {
      st.think = 0.12;
      if (left < 0.17 && left > 0.03 && P.dashCd <= 0 && P.st > 12) { inp.dash = true; inp.mx = -fz * st.circle; inp.mz = fx * st.circle; }
      else st.hold = 0.3;
    }
  }
  if (st.hold > 0 && !mash) inp.block = true;
  if (P.state === 'idle' && !inp.dash) {
    if (d > 1.55) { inp.mx = fx; inp.mz = fz; } else if (d < 1.0) { inp.mx = -fx; inp.mz = -fz; } else if (!inp.block) { inp.mx = -fz * st.circle * 0.4; inp.mz = fx * st.circle * 0.4; }
  }
  if (d < 1.9 && st.cd <= 0 && (!inp.block) && !inp.dash) {
    const open = O.state === 'hit' || O.state === 'guardbreak' || (O.state === 'attack' && O.phase === 'rec');
    if (mash || open || rnd() < aggression * 0.05) {
      const r = rnd();
      if (P.counter > 0 && P.unlocks.counter) inp.cross = true;
      else if (r < 0.55) inp.jab = true; else inp.cross = true;
      st.cd = 0.12 + rnd() * 0.25;
    }
  }
  if (P.unlocks.fury && P.meter >= 100 && d < 1.7) inp.fury = true;
  return inp;
}
