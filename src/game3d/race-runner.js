// NEON DRIFT — a whole race as a pure, deterministic object: the grid, the countdown with the rolling start, the player's car and
// the rival drivers on the physics sim, the race rules (laps, positions, deltas, resets) and the ghost recorder. The game
// (game.js) renders it and feeds it the keyboard; the node tests run exactly the same code with a bot as the player.
import { createCar, placeCar, createSim, DT } from './physics.js';
import { createDriver } from './autodrive.js';
import { createRace, CHECKPOINTS } from './race.js';
import { createRecorder } from './ghost.js';
import { mulberry32, clamp, wrapPi } from './rng.js';
import { closest, frameAt, wrapS } from './track.js';

export const DIFFICULTY = {
  // skill scales the speed profile; the rubber band (up to ±rb at 300 m) keeps the field in reach of the player either way.
  // Measured with the bot driver (scripts/test-race.mjs): a bot at 0.8 wins Easy, 0.88-0.95 fights for the win on Normal, nobody below ~0.97 wins Hard.
  easy: { name: 'Easy', skill: 0.74, mistakes: 1, rbUp: 0.08, rbDown: 0.12, boost: false },
  normal: { name: 'Normal', skill: 0.86, mistakes: 0.25, rbUp: 0.06, rbDown: 0.1, boost: false },
  hard: { name: 'Hard', skill: 0.985, mistakes: 0, rbUp: 0.04, rbDown: 0.03, boost: true },
};
export const DIFFICULTY_IDS = Object.keys(DIFFICULTY);

/** The five rivals: a name, a body and a paint each (hex), in grid order. */
export const RIVALS = [
  { name: 'Vega', type: 'hyper', paint: 0x19c8ff, bias: -0.8 },
  { name: 'Mako', type: 'gt', paint: 0xffd23f, bias: 0.9 },
  { name: 'Rin', type: 'hatch', paint: 0x18e08a, bias: -0.3 },
  { name: 'Dash', type: 'gt', paint: 0x7a5cff, bias: 0.4 },
  { name: 'Nova', type: 'hyper', paint: 0xeceef6, bias: 0 },
];

export const GRID = { front: 52, rowGap: 9, lane: 3.1, pace: 14 };
const COUNTDOWN = 3;
const PLAYER_SLOT = 3; // starts mid-pack

/** Grid slot k (0 = pole): arc length (negative: behind the line) and lateral offset. */
export function gridSlot(k) {
  const row = Math.floor(k / 2);
  const col = k % 2;
  return { s: -(GRID.front + GRID.rowGap * row + (col ? 4.5 : 0)), lateral: (col ? 1 : -1) * GRID.lane };
}

/**
 * @param {object} o
 *   track, mode ('race' | 'trial'), laps, difficulty ('easy' | 'normal' | 'hard'), seed
 *   playerType, rivals (0..5), bestSplits (for the player's deltas)
 */
export function createRunner({ track, mode = 'race', laps = 3, difficulty = 'normal', seed = 1, playerType = 'gt', rivals = mode === 'race' ? 5 : 0, bestSplits = null }) {
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  const rnd = mulberry32(seed * 7919 + 11);
  const entries = [];
  const slots = mode === 'race' ? [...Array(rivals + 1).keys()] : [0];
  // the player takes slot PLAYER_SLOT (or the last one if the grid is smaller); the rivals fill the rest in order
  const playerSlot = Math.min(PLAYER_SLOT, slots.length - 1);
  let rv = 0;
  slots.forEach((k) => {
    const player = k === playerSlot;
    const info = player ? null : RIVALS[rv++ % RIVALS.length];
    const car = createCar(player ? playerType : info.type);
    const slot = gridSlot(k);
    placeCar(car, track, wrapS(track, slot.s), slot.lateral, 0);
    const e = { id: player ? 'player' : `rival-${rv}`, name: player ? 'You' : info.name, kind: player ? 'player' : 'rival', car, slot: k, lane: slot.lateral, type: car.type, paint: info ? info.paint : null, driver: null, pace: null, stuckT: 0, resets: 0 };
    e.pace = createDriver(track, car, { fixedSpeed: GRID.pace, lane: slot.lateral });
    if (!player) {
      e.driver = createDriver(track, car, { skill: diff.skill, mistakes: diff.mistakes, rnd, bias: info.bias, boost: diff.boost });
    }
    entries.push(e);
  });
  const playerIndex = entries.findIndex((e) => e.kind === 'player');
  const cars = entries.map((e) => e.car);
  const sim = createSim({ track, seed, cars });
  const race = createRace({ track, laps, mode, bestSplits, entries: entries.map((e) => ({ id: e.id, name: e.name, player: e.kind === 'player', s: e.car.s })) });
  const recorder = createRecorder();
  const inputs = entries.map(() => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false }));
  const states = entries.map(() => ({ s: 0, speed: 0, headingErr: 0 }));
  const others = entries.map(() => []);
  const fr = {};
  const cl = {};
  const cruise = entries.map((e) => createDriver(track, e.car, { skill: 0.55, line: false }));

  const runner = {
    track, mode, laps, difficulty, diff, sim, race, entries, playerIndex,
    phase: 'grid', // 'grid' → 'countdown' → 'racing' → 'finished'
    countdown: COUNTDOWN,
    events: [],
    ghost: null, // the best lap recorded in this session: { time, x, z, psi, steer }
    time: 0,
    get player() { return entries[playerIndex]; },
    /** Lights out soon: the countdown begins and everybody rolls forward. */
    start() { if (runner.phase === 'grid') { runner.phase = 'countdown'; runner.countdown = COUNTDOWN; } },
    /** Tests / free drive: no grid, no countdown — the lights are already out. */
    skipToRacing() { runner.phase = 'racing'; race.go(); recorder.begin(0); },
    /** One fixed step. `playerInput` = the keyboard / bot output for the player's car. */
    step(playerInput) {
      const dt = DT;
      if (runner.phase === 'grid') {
        for (const e of entries) { e.car.vx = e.car.vz = 0; }
        return;
      }
      if (runner.phase === 'countdown') {
        runner.countdown -= dt;
        for (let i = 0; i < entries.length; i++) entries[i].pace(entries[i].car, inputs[i]);
        if (runner.countdown <= 0) {
          runner.phase = 'racing';
          race.go();
          recorder.begin(0);
        }
      } else {
        const pd = race.entries[playerIndex].dist;
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i];
          const re = race.entries[i];
          if (re.finished) { cruise[i](e.car, inputs[i]); continue; }
          if (e.kind === 'player') { Object.assign(inputs[i], playerInput); continue; }
          // rival: the other cars it must get around + a rubber band that keeps the race close
          const list = others[i];
          list.length = 0;
          for (let j = 0; j < entries.length; j++) if (j !== i) list.push(entries[j].car);
          const gap = re.dist - pd; // > 0: this rival is ahead of the player
          const mul = gap > 0 ? 1 - diff.rbDown * clamp(gap / 300, 0, 1) : 1 + diff.rbUp * clamp(-gap / 300, 0, 1);
          e.driver(e.car, inputs[i], { others: list, mul });
          // stuck for a couple of seconds (wedged against a wall or a car): put it back on the road
          if (e.car.speed < 2.5 && race.t > 3) { e.stuckT += dt; if (e.stuckT > 2.2) { putOnRoad(e, 12); e.resets++; e.stuckT = 0; } } else e.stuckT = 0;
        }
      }
      sim.step(inputs);
      // rules
      for (let i = 0; i < entries.length; i++) {
        const c = entries[i].car;
        const f = frameAt(track, c.s, fr);
        states[i].s = c.s;
        states[i].speed = c.speed;
        states[i].headingErr = wrapPi(c.psi - f.heading);
      }
      race.step(dt, states);
      if (runner.phase === 'racing' || runner.phase === 'finished') {
        const pc = entries[playerIndex].car;
        if (race.entries[playerIndex].lapStart != null && !race.entries[playerIndex].finished) recorder.push(race.t, pc.x, pc.z, pc.psi, pc.steer);
      }
      if (race.events.length) {
        for (const ev of race.events) {
          runner.events.push(ev);
          if (ev.player && (ev.type === 'start-lap' || ev.type === 'lap')) {
            if (ev.type === 'lap' && ev.valid && recorder.length > 10) {
              const g = recorder.finish(ev.time);
              if (!runner.ghost || g.time < runner.ghost.time) { runner.ghost = g; runner.events.push({ type: 'ghost', time: g.time, ghost: g, t: ev.t }); }
            }
            recorder.begin(ev.t);
          }
        }
        race.events.length = 0;
      }
      if (race.phase === 'finished' && runner.phase === 'racing') { runner.phase = 'finished'; }
      runner.time += dt;
    },
    /** Real-time driver: runs as many fixed steps as `frameDt` allows. Returns the number of steps. */
    update(frameDt, playerInput) {
      sim.accum += Math.min(frameDt, 0.25);
      let n = 0;
      while (sim.accum >= DT - 1e-9 && n < sim.maxSteps) { runner.step(playerInput); sim.accum -= DT; n++; }
      if (n === sim.maxSteps && sim.accum >= DT) sim.accum = 0;
      sim.alpha = clamp(sim.accum / DT, 0, 1);
      return n;
    },
    /** The player's R key. Returns { ok, wait }. */
    resetPlayer() {
      const r = race.requestReset(playerIndex);
      if (r.ok) putOnRoad(entries[playerIndex], entries[playerIndex].car.speed * 0.5);
      return r;
    },
    resetCooldown: () => race.resetCooldown(playerIndex),
    /** Everything the HUD needs about the player. */
    hud() {
      const e = race.entries[playerIndex];
      return {
        phase: runner.phase, countdown: runner.countdown, t: race.t,
        lap: Math.min(laps, e.lap + 1), laps, place: e.place, cars: entries.length,
        lapTime: e.lapStart != null ? Math.max(0, race.t - e.lapStart) : 0, bestLap: e.bestLap, delta: e.delta, deltaAge: race.t - e.deltaAt,
        wrongWay: e.wrongWay, resetWait: race.resetCooldown(playerIndex), finished: e.finished, penalty: e.penalty, resets: e.resets, valid: e.lapValid,
      };
    },
  };

  function putOnRoad(e, speed) {
    const c = closest(track, e.car.x, e.car.z, e.car.idx, cl);
    placeCar(e.car, track, c.s, 0, speed);
  }
  return runner;
}

export { CHECKPOINTS };
