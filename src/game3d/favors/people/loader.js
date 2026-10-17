// "Ori, Can You...?" — asks the people factory (worker.js) for characters without freezing the page. `prewarmOri(tier)` is called when the site is idle,
// so by the time somebody launches the game Ori is already built; `getOriData(tier)` gives the data at once (building it here, the slow way, only if the
// worker has not finished or cannot run). If Web Workers are not allowed (some file:// setups), everything still works — on the main thread.
import { buildPersonData, finishPersonData, peekPersonData, storePersonData } from './assemble.js';
import { ORI_SPEC } from './specs.js';
import { crowdArchetype, CROWD_STYLES } from './crowd-figure.js';
import workerSource from 'worker-src:./worker.js';

export const ORI_TIERS = { high: { q: 1, curls: 1, outline: true }, medium: { q: 0.72, curls: 0.5, outline: true }, low: { q: 0.45, curls: 0, outline: false } };
export const oriTier = (tier) => ORI_TIERS[tier] || ORI_TIERS.high;
/** Ori's spec for a tier (the number of curls follows the tier). */
export const oriSpecFor = (tier) => ({ ...ORI_SPEC, hair: { ...ORI_SPEC.hair, curlDensity: oriTier(tier).curls } });
export const oriKey = (tier) => `ori-${tier}`;

let worker = null;
let workerFailed = false;
let nextId = 1;
const waiting = new Map();
const crowdCache = new Map();
const pending = new Map();

function startWorker() {
  if (worker || workerFailed) return worker;
  try {
    worker = new Worker(URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' })));
    worker.onmessage = (e) => {
      const w = waiting.get(e.data.id);
      if (!w) return;
      waiting.delete(e.data.id);
      if (e.data.error) w.reject(new Error(e.data.error)); else w.resolve(e.data.data);
    };
    worker.onerror = () => { workerFailed = true; worker = null; for (const w of waiting.values()) w.reject(new Error('worker failed')); waiting.clear(); };
  } catch { workerFailed = true; worker = null; }
  return worker;
}

function ask(msg) {
  const w = startWorker();
  if (!w) return Promise.reject(new Error('no worker'));
  return new Promise((resolve, reject) => { const id = nextId++; waiting.set(id, { resolve, reject }); w.postMessage({ id, ...msg }); });
}

/** Builds Ori for a tier in the background; resolves with the data (also stored, so the game finds it). */
export function prewarmOri(tier = 'high') {
  const key = oriKey(tier);
  const q = oriTier(tier).q;
  const have = peekPersonData(key, q);
  if (have) return Promise.resolve(have);
  if (pending.has(key)) return pending.get(key);
  const p = ask({ kind: 'person', spec: oriSpecFor(tier), quality: q })
    .then((plain) => peekPersonData(key, q) || storePersonData(key, q, finishPersonData(plain)))
    .catch(() => new Promise((r) => setTimeout(() => r(getOriData(tier)), 0))) // no worker: build here, at idle
    .finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}

/** Ori's data right now (the slow way if it is not ready yet). */
export function getOriData(tier = 'high') {
  return buildPersonData(oriSpecFor(tier), { quality: oriTier(tier).q, key: oriKey(tier) });
}

/** A person from any spec (an NPC who stops to talk): off the main thread when possible. */
export function requestPerson(spec, { quality = 0.5, key = null } = {}) {
  const k = key || spec.id;
  const have = peekPersonData(k, quality);
  if (have) return Promise.resolve(have);
  return ask({ kind: 'person', spec, quality }).then((plain) => peekPersonData(k, quality) || storePersonData(k, quality, finishPersonData(plain))).catch(() => buildPersonData(spec, { quality, key: k }));
}

/** The crowd's archetypes (typed arrays), made in the worker when it can. */
export function prewarmCrowd() {
  return Promise.all(CROWD_STYLES.map((s) => (crowdCache.has(s) ? Promise.resolve(crowdCache.get(s)) : ask({ kind: 'crowd', style: s }).then((d) => { crowdCache.set(s, d); return d; }).catch(() => null))));
}
export function getCrowdArchetype(style) {
  if (!crowdCache.has(style)) crowdCache.set(style, crowdArchetype(style));
  return crowdCache.get(style);
}
export function disposeWorker() { if (worker) { worker.terminate(); worker = null; } }
