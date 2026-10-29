// "Ori, Can You...?" — the SPEED BAG (PURE: no DOM, no three). A 20-second drill in the corner of the ring: the bag swings to a beat that gets quicker, and you
// punch it (J or K, the same keys as in a fight) just as it comes back to your fist. Keep every beat to build the combo, alternate your hands to score
// properly (the same hand twice in a row only counts as OK), and every eighth beat is an accent worth double. A stray press or a silent beat only drops the
// combo: nothing is ever taken away. It pays a little XP (never peaches), less each time on the same day, so a real fight is always the better way to level.
//   const run = createBagRun()   run.update(dt)   run.punch('J' | 'K')   run.view()   run.drain()   run.result   xpFor(run.result, { today })
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const BAG = {
  time: 20, // seconds of drill
  lead: 60 / 96, // seconds before the first beat: one beat of the starting tempo after GO (the three clicks of the count-in came before it)
  bpm: [96, 164], // the tempo at the start and at the end
  accentEvery: 8,
  points: { perfect: 100, good: 60, ok: 25 },
  stars: [0.24, 0.52, 0.82], // fractions of the best possible score that earn 1, 2, 3 stars
  xp: [2, 5, 8, 12], // XP for 0..3 stars on a first run of the day
  again: [1, 0.7, 0.45, 0.25], // ...times this for the 2nd, 3rd, 4th (and later) run of the same day
};

/** The tempo (beats per minute) at second `t` of a run of `T` seconds. */
export const bpmAt = (t, T = BAG.time, lead = BAG.lead) => lerp(BAG.bpm[0], BAG.bpm[1], clamp((t - lead) / (T - lead), 0, 1));

/** When the beats are (seconds from the start of the run). The last one leaves room for its window before the time is up. */
export function beatTimes(T = BAG.time, lead = BAG.lead) {
  const out = [];
  let t = lead;
  while (t <= T - 0.3) { out.push(t); t += 60 / bpmAt(t, T, lead); }
  return out;
}

/** How near (± seconds) a punch has to be to a beat that comes `iv` seconds before the next one: PERFECT, GOOD, OK. They shrink with the tempo. */
export const windows = (iv) => ({ perfect: clamp(0.15 * iv, 0.045, 0.075), good: clamp(0.27 * iv, 0.08, 0.125), ok: clamp(0.4 * iv, 0.125, 0.19) });

/** The score multiplier after `combo` beats in a row. */
export const multFor = (combo) => 1 + 0.25 * Math.min(10, Math.floor(combo / 2));

export const isAccent = (index) => (index + 1) % BAG.accentEvery === 0;

/** What flawless play scores on these beats (every beat PERFECT, hands alternating). The stars are fractions of this. */
export function bestScore(beats) {
  let s = 0;
  beats.forEach((_, k) => { s += BAG.points.perfect * (isAccent(k) ? 2 : 1) * multFor(k); });
  return Math.round(s);
}

export const starsFor = (rating) => (rating >= BAG.stars[2] ? 3 : rating >= BAG.stars[1] ? 2 : rating >= BAG.stars[0] ? 1 : 0);

/** The XP of a finished run; `today` = how many runs he has already done today. */
export function xpFor(result, { today = 0 } = {}) {
  const base = BAG.xp[clamp(result.stars | 0, 0, 3)];
  return Math.max(1, Math.round(base * BAG.again[clamp(today | 0, 0, BAG.again.length - 1)]));
}

/** One run of the drill. */
export function createBagRun({ time = BAG.time, lead = BAG.lead } = {}) {
  const beats = beatTimes(time, lead);
  const n = beats.length;
  const iv = beats.map((b, j) => (j + 1 < n ? beats[j + 1] - b : j > 0 ? b - beats[j - 1] : 0.5));
  const win = iv.map(windows);
  const best = bestScore(beats);
  const consumed = new Array(n).fill(false);
  const events = [];
  const emit = (e) => events.push(e);
  let settled = 0; // beats before this one are over (hit, or gone by)
  let beatSeen = 0; // beats before this one have been announced
  const state = { time: 0, over: false, score: 0, combo: 0, maxCombo: 0, hits: 0, perfect: 0, good: 0, ok: 0, off: 0, slack: 0, lost: 0, lastHand: null, lastGrade: null, lastAt: -9 };
  let result = null;

  function settle() {
    while (settled < n && (consumed[settled] || beats[settled] + win[settled].ok < state.time)) {
      if (!consumed[settled]) { state.slack++; state.combo = 0; state.lost++; state.lastGrade = 'slack'; emit({ type: 'slack', index: settled }); }
      settled++;
    }
  }
  function finish() {
    if (state.over) return;
    settle();
    state.over = true;
    const rating = best ? clamp(state.score / best, 0, 1) : 0;
    result = {
      score: state.score, best, rating, stars: starsFor(rating), perfect: state.perfect, good: state.good, ok: state.ok, off: state.off, slack: state.slack,
      hits: state.hits, beats: n, maxCombo: state.maxCombo, time,
    };
    emit({ type: 'over', result });
  }

  return {
    state, beats, best,
    get result() { return result; },
    get over() { return state.over; },
    drain() { return events.splice(0, events.length); },
    /** Time passes (seconds). */
    update(dt) {
      if (state.over) return;
      state.time = Math.min(time, state.time + Math.max(0, dt));
      while (beatSeen < n && beats[beatSeen] <= state.time) { emit({ type: 'beat', index: beatSeen, accent: isAccent(beatSeen) }); beatSeen++; }
      settle();
      if (state.time >= time) finish();
    },
    /** A punch with `hand` ('J' or 'K') right now. Returns { grade: 'perfect' | 'good' | 'ok' | 'off', points, ... }. */
    punch(hand) {
      if (state.over) return null;
      const t = state.time;
      let pick = -1;
      let dist = Infinity;
      for (let j = settled; j < Math.min(n, settled + 3); j++) {
        if (consumed[j]) continue;
        const d = Math.abs(t - beats[j]);
        if (d <= win[j].ok && d < dist) { pick = j; dist = d; }
      }
      state.lastAt = t;
      if (pick < 0) { // nowhere near a beat: the bag glances off the glove
        state.off++; state.combo = 0; state.lost++; state.lastGrade = 'off';
        emit({ type: 'off', hand });
        return { grade: 'off', points: 0 };
      }
      consumed[pick] = true;
      const w = win[pick];
      let grade = dist <= w.perfect ? 'perfect' : dist <= w.good ? 'good' : 'ok';
      const same = state.lastHand === hand;
      if (same) grade = 'ok'; // (alternate your hands: J, K, J, K...)
      const accent = isAccent(pick);
      const mult = multFor(state.combo);
      const points = Math.round(BAG.points[grade] * (accent ? 2 : 1) * mult);
      state.score += points; state.combo++; state.maxCombo = Math.max(state.maxCombo, state.combo); state.hits++; state[grade]++; state.lost = 0;
      state.lastHand = hand; state.lastGrade = grade;
      const early = t - beats[pick];
      emit({ type: 'hit', grade, hand, index: pick, accent, points, combo: state.combo, mult, early, same });
      settle();
      return { grade, points, accent, mult, combo: state.combo, early };
    },
    /** Everything the HUD and the 3D bag need this moment. */
    view() {
      const t = state.time;
      let k = Math.max(-1, settled - 3); // (a beat hit early is already settled, so look a little further back)
      while (k + 1 < n && beats[k + 1] <= t) k++;
      const before = k >= 0 ? beats[k] : beats[0] - 60 / BAG.bpm[0];
      const after = k + 1 < n ? beats[k + 1] : beats[n - 1] + 60 / BAG.bpm[1];
      const phase = clamp((t - before) / Math.max(0.05, after - before), 0, 1);
      const upcoming = [];
      for (let j = Math.max(0, settled - 1); j < n && beats[j] - t < 2.2; j++) if (beats[j] - t > -0.25) upcoming.push({ index: j, dt: beats[j] - t, accent: isAccent(j), hit: consumed[j] });
      return {
        time: t, left: Math.max(0, time - t), over: state.over, score: state.score, combo: state.combo, mult: multFor(state.combo), bpm: bpmAt(t, time, lead),
        phase, iv: Math.max(0.05, after - before), swing: Math.cos(phase * Math.PI * 2), accent: k + 1 < n && isAccent(k + 1), nextHand: state.lastHand === 'J' ? 'K' : 'J', lastGrade: state.lastGrade,
        lost: state.lost, upcoming, best,
      };
    },
  };
}
