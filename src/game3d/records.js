// NEON DRIFT — records, medals and the saved choices. PURE: the store (core/storage) is passed in, so the node tests use a Map.
// A medal is earned by a lap time relative to the "par" lap of the Hard rival on that track with that car: Gold beats it.
import { generateTrack } from './track.js';
import { createCar, placeCar, stepCar, DT } from './physics.js';
import { createDriver } from './autodrive.js';
import { DIFFICULTY } from './race-runner.js';

export const MEDALS = ['none', 'bronze', 'silver', 'gold'];
export const MEDAL_FACTOR = { gold: 1.0, silver: 1.08, bronze: 1.18 }; // × par
const PAR_VERSION = 4; // bump when the physics / AI change the reference lap

/** A flying lap (the second of two) of the Hard rival's driver on this track with this car, in seconds (what a perfect-ish run is). */
export function simulatePar(track, carType = 'gt') {
  const key = `par:${carType}`;
  if (track.cache[key]) return track.cache[key];
  const car = createCar(carType);
  placeCar(car, track, track.length - 0.5, 0, 0);
  const drive = createDriver(track, car, { skill: DIFFICULTY.hard.skill });
  const inp = {};
  let last = car.s;
  let t = 0;
  let crossings = 0;
  let lapStart = 0;
  let par = 0;
  // two laps from a standing start; the second one is a flying lap (the standing start is not what a medal is about)
  for (let i = 0; i < 120 * 300; i++) {
    drive(car, inp);
    stepCar(car, inp, track, DT);
    t += DT;
    if (car.s - last < -track.length / 2) {
      crossings++;
      if (crossings === 2) lapStart = t;
      if (crossings === 3) { par = t - lapStart; break; }
    }
    last = car.s;
  }
  track.cache[key] = par || 90;
  return track.cache[key];
}

/** 0 none, 1 bronze, 2 silver, 3 gold. */
export function medalFor(time, par) {
  if (!(time > 0) || !(par > 0)) return 0;
  if (time <= par * MEDAL_FACTOR.gold) return 3;
  if (time <= par * MEDAL_FACTOR.silver) return 2;
  if (time <= par * MEDAL_FACTOR.bronze) return 1;
  return 0;
}

/** Seconds as m:ss.mmm (3 decimals for laps), or an em dash. */
export function fmtTime(t, digits = 2) {
  if (!(t >= 0) || !Number.isFinite(t)) return '—';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(digits)}`;
}

/** Signed delta, e.g. +0.42 / −1.07. */
export function fmtDelta(d) {
  if (d == null || !Number.isFinite(d)) return '';
  return `${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}`;
}

/**
 * @param {{ get: (k: string, d?: any) => any, set: (k: string, v: any) => any }} store
 */
export function createRecords(store) {
  const KEY = 'drift:records';
  const read = () => store.get(KEY, null) || { tracks: {}, prefs: {}, drift: { best: 0, total: 0 } };
  const write = (r) => store.set(KEY, r);
  const blank = () => ({ bestLap: null, bestCar: 'gt', splits: null, medal: 0, races: 0, wins: 0, bestRace: null });
  return {
    /** What the menu shows for a track. */
    track(id) { return { ...blank(), ...(read().tracks[id] || {}) }; },
    /** A finished valid lap. `par` = the reference lap of the car used. */
    recordLap(id, time, { car = 'gt', par = 0, splits = null } = {}) {
      const r = read();
      const t = { ...blank(), ...(r.tracks[id] || {}) };
      const isBest = t.bestLap == null || time < t.bestLap;
      const old = t.medal;
      if (isBest) { t.bestLap = time; t.bestCar = car; t.splits = splits; }
      const medal = medalFor(time, par);
      t.medal = Math.max(t.medal, medal);
      r.tracks[id] = t;
      write(r);
      return { isBest, best: t.bestLap, medal: t.medal, newMedal: t.medal > old, lapMedal: medal };
    },
    recordRace(id, { place, time, difficulty }) {
      const r = read();
      const t = { ...blank(), ...(r.tracks[id] || {}) };
      t.races++;
      if (place === 1) t.wins++;
      const better = !t.bestRace || place < t.bestRace.place || (place === t.bestRace.place && time < t.bestRace.time);
      if (better) t.bestRace = { place, time, difficulty };
      r.tracks[id] = t;
      write(r);
      return { isBest: better, wins: t.wins };
    },
    /** The longest drift chain (s) and the points, kept across sessions. */
    recordDrift(chainSeconds, points) {
      const r = read();
      r.drift = r.drift || { best: 0, total: 0 };
      r.drift.best = Math.max(r.drift.best, chainSeconds);
      r.drift.total += points;
      write(r);
      return r.drift;
    },
    drift() { return read().drift || { best: 0, total: 0 }; },
    goldCount() { return Object.values(read().tracks).filter((t) => t.medal === 3).length; },
    /** The saved menu choices: { mode, biome, difficulty, car, paint }. */
    prefs() { return { mode: 'race', biome: 'city', difficulty: 'normal', car: 'gt', paint: 0, ...(read().prefs || {}) }; },
    setPrefs(p) { const r = read(); r.prefs = { ...(r.prefs || {}), ...p }; write(r); },
    /** Ghost laps live under their own keys (they are big): one per track. */
    ghost(id) { return store.get(`drift:ghost:${id}`, null); },
    setGhost(id, encoded) { return store.set(`drift:ghost:${id}`, encoded); },
    /** Par laps are expensive to simulate: remembered between visits. */
    cachedPar(id, car) { const p = store.get('drift:par', null); return p && p.v === PAR_VERSION ? p.t[`${id}:${car}`] ?? null : null; },
    setPar(id, car, value) {
      let p = store.get('drift:par', null);
      if (!p || p.v !== PAR_VERSION) p = { v: PAR_VERSION, t: {} };
      p.t[`${id}:${car}`] = value;
      store.set('drift:par', p);
    },
  };
}

/** The par lap, from the cache if possible (simulating it takes ~100 ms). */
export function parFor(records, biome, carType) {
  const cached = records.cachedPar(biome.id, carType);
  if (cached) return cached;
  const par = simulatePar(generateTrack(biome.seed), carType);
  records.setPar(biome.id, carType, par);
  return par;
}
