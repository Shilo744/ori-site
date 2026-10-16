// NEON DRIFT — the rules of a race, with no rendering and no physics: laps and checkpoints from the distance driven, positions,
// split deltas against the best lap, the wrong-way warning, resets (with a cooldown and a penalty) and the final result.
// PURE (no three, no DOM, no Math.random). The runner (race-runner.js) feeds it one fixed step at a time.
import { deltaS } from './track-query.js';

export const CHECKPOINTS = 8; // gates per lap (the line itself is gate 0)
export const RESET_COOLDOWN = 2; // s
export const RESET_PENALTY = 3; // s added to a race time per reset
const JUMP = 90; // m: a bigger step in one tick is a teleport, not driving
const WRONG_WAY_ANGLE = 2.0; // rad
const WRONG_WAY_AFTER = 0.9; // s

/**
 * @param {object} o
 *   track        the track (length is all that is used)
 *   laps         laps to drive
 *   mode         'race' | 'trial' (a reset costs time in a race, and voids the lap in a trial)
 *   entries      [{ id, name, player?: boolean, s, distStart?: number }] — `s` is the arc length they start at
 *   bestSplits   the splits (s) of the best lap so far, to show deltas against (the player's)
 */
export function createRace({ track, laps = 3, mode = 'race', entries, bestSplits = null }) {
  const L = track.length;
  const race = {
    track, laps, mode, L,
    phase: 'grid', // 'grid' → 'racing' → 'finished'
    t: 0, // race clock: runs from GO
    events: [],
    entries: entries.map((e, i) => ({
      id: e.id, name: e.name, player: !!e.player, index: i,
      prevS: e.s,
      dist: e.s > L / 2 ? e.s - L : e.s, // unwrapped distance: negative while still behind the line
      lap: 0, // laps completed
      lapStart: null, // race time the current lap started (set on the first crossing of the line)
      lapTimes: [], bestLap: null, lapValid: true,
      splits: [], // times of the checkpoints of the current lap (s since the lap start)
      bestSplits: e.player && bestSplits ? bestSplits.slice() : null,
      delta: null, deltaAt: 0,
      finished: false, finishTime: null, penalty: 0, place: i + 1,
      lastReset: -1e9, resets: 0, wrongWay: false, wrongT: 0, cut: false, topSpeed: 0, driftBest: 0,
    })),
  };
  const emit = (type, e, extra) => race.events.push({ type, id: e.id, player: e.player, t: race.t, ...extra });

  race.go = () => { race.phase = 'racing'; race.t = 0; emit('go', race.entries[0]); };

  /**
   * One fixed step. `states[i]` = { s, speed, headingErr } for entry i (same order as `entries`).
   */
  race.step = (dt, states) => {
    if (race.phase === 'racing') race.t += dt;
    for (let i = 0; i < race.entries.length; i++) {
      const e = race.entries[i];
      const c = states[i];
      if (e.finished) { e.prevS = c.s; continue; }
      let d = deltaS(track, e.prevS, c.s);
      e.prevS = c.s;
      if (Math.abs(d) > JUMP) { // teleported (a reset to the road, a cut): do not count the jump
        d = 0;
        e.cut = true;
        e.lapValid = false;
        emit('cut', e);
      }
      const before = e.dist;
      e.dist += d;
      e.topSpeed = Math.max(e.topSpeed, c.speed);
      if (race.phase !== 'racing') continue;

      // laps and gates: crossing times are interpolated inside the step
      const gateNow = Math.floor((e.dist / L) * CHECKPOINTS);
      const gateBefore = Math.floor((before / L) * CHECKPOINTS);
      if (gateNow > gateBefore && d > 0) {
        for (let g = gateBefore + 1; g <= gateNow; g++) {
          const over = e.dist - (g * L) / CHECKPOINTS;
          const tCross = race.t - (over / d) * dt;
          if (g % CHECKPOINTS === 0) {
            const lapDone = g / CHECKPOINTS; // laps completed with this crossing
            if (lapDone >= 1) {
              const time = tCross - e.lapStart;
              if (e.lapStart != null) {
                const valid = e.lapValid;
                e.lapTimes.push({ time, valid });
                // the delta of the lap just finished is against the best lap BEFORE it (the last split entry is the whole lap)
                if (e.player && e.bestSplits) { e.delta = time - e.bestSplits[CHECKPOINTS - 1]; e.deltaAt = race.t; }
                if (valid && (e.bestLap == null || time < e.bestLap)) {
                  e.bestLap = time;
                  e.bestSplitsNew = e.splits.concat([time]);
                  if (e.player) e.bestSplits = e.bestSplitsNew.slice(); // the next laps are timed against it
                  emit('best-lap', e, { time, splits: e.bestSplitsNew });
                }
                emit('lap', e, { lap: lapDone, time, valid, best: e.bestLap });
              }
              e.lap = lapDone;
              if (lapDone >= race.laps) {
                e.finished = true;
                e.finishTime = tCross + e.penalty;
                emit('finish', e, { time: e.finishTime });
              } else {
                e.lapStart = tCross;
                e.splits = [];
                e.lapValid = true;
              }
            } else {
              e.lapStart = tCross; // the first crossing of the line starts lap 1
              e.splits = [];
              e.lapValid = true;
              emit('start-lap', e, { lap: 1 });
            }
          } else if (e.lapStart != null) {
            const split = tCross - e.lapStart;
            e.splits.push(split);
            const gi = (g % CHECKPOINTS) - 1;
            if (e.player && e.bestSplits && e.bestSplits[gi] != null) { e.delta = split - e.bestSplits[gi]; e.deltaAt = race.t; }
            emit('checkpoint', e, { gate: g % CHECKPOINTS, split, delta: e.delta });
          }
        }
      }

      // wrong way: facing against the road at speed for a moment
      const bad = c.speed > 4 && Math.abs(c.headingErr) > WRONG_WAY_ANGLE;
      e.wrongT = bad ? e.wrongT + dt : Math.max(0, e.wrongT - dt * 2);
      const wasWrong = e.wrongWay;
      e.wrongWay = e.wrongT > WRONG_WAY_AFTER ? true : (e.wrongT < 0.2 ? false : e.wrongWay);
      if (e.wrongWay !== wasWrong) emit(e.wrongWay ? 'wrong-way' : 'right-way', e);
    }
    updatePlaces();
    if (race.phase === 'racing') {
      const p = race.entries.find((e) => e.player);
      if (p && p.finished) {
        race.phase = 'finished';
        race.result = race.results();
        emit('race-over', p, { place: p.place });
      }
    }
  };

  /** Finished cars first (by time), then everyone by distance driven. */
  function order() {
    return [...race.entries].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.dist - a.dist;
    });
  }
  function updatePlaces() {
    order().forEach((e, i) => { e.place = i + 1; });
  }
  race.standings = () => order();

  /** The player asks for a reset: allowed after the cooldown. In a race it costs time, in a trial it voids the lap. */
  race.requestReset = (index) => {
    const e = race.entries[index];
    if (race.phase !== 'racing') return { ok: false, wait: 0 };
    const wait = RESET_COOLDOWN - (race.t - e.lastReset);
    if (wait > 0) return { ok: false, wait };
    e.lastReset = race.t;
    e.resets++;
    if (race.mode === 'race') e.penalty += RESET_PENALTY;
    else e.lapValid = false;
    emit('reset', e, { penalty: e.penalty, voided: race.mode !== 'race' });
    return { ok: true, wait: 0 };
  };
  race.resetCooldown = (index) => Math.max(0, RESET_COOLDOWN - (race.t - race.entries[index].lastReset));

  /** The final table. Cars still driving get a projected time (marked `projected`). */
  race.results = () => {
    const total = race.laps * L;
    return order().map((e, i) => {
      let time = e.finishTime;
      let projected = false;
      if (!e.finished) {
        const speed = Math.max(25, e.dist > 0 ? e.dist / Math.max(1, race.t) : 25);
        time = race.t + Math.max(0, total - e.dist) / speed + e.penalty;
        projected = true;
      }
      return { id: e.id, name: e.name, player: e.player, place: i + 1, time, projected, bestLap: e.bestLap, resets: e.resets, penalty: e.penalty };
    });
  };

  race.player = () => race.entries.find((e) => e.player);
  race.lapNumber = (e) => Math.min(race.laps, e.lap + 1);
  return race;
}
