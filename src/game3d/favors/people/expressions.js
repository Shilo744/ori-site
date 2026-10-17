// "Ori, Can You...?" — the expression rig as PURE data + a tiny state machine. A face is a handful of numbers (eyelids, brows, mouth, gaze, a sweat
// drop, a flush); named expressions are targets for them; `createFace()` eases towards the target, blinks on its own, glances around, flaps the
// mouth while talking. There is NO angry or negative face on purpose: Ori (and everybody in this neighbourhood) is warm. Overloaded = flustered-but-smiling.

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Neutral values of every channel. lid: 0 = relaxed open, 1 = shut; lidWide < 0 opens wider. smile channel is the mouth's corner lift. */
export const NEUTRAL = {
  lidUp: 0.26, lidUpR: 0.26, lidLo: 0.08, lidLoR: 0.08, // relaxed, friendly lids; the right eye can differ (a wink)
  browInL: 0, browOutL: 0, browInR: 0, browOutR: 0, browTilt: 0, // metres of lift (+up) / tilt
  w: 1, smile: 0.35, open: 0, round: 0, asym: 0, teeth: 0, tongue: 0, // the mouth
  gx: 0, gy: 0, // the gaze (radians)
  sweat: 0, flush: 0, // a drop on the temple, a rosier face
  tilt: 0, // head tilt (radians, applied by the animator)
};

/** Named expressions: deltas on NEUTRAL (every one of them is a happy one). */
export const EXPRESSIONS = {
  neutral: {},
  smile: { smile: 0.8, lidLo: 0.22, lidLoR: 0.22, browInL: 0.003, browInR: 0.003, browOutL: 0.004, browOutR: 0.004 },
  grin: { smile: 1.15, open: 0.32, teeth: 1, lidUp: 0.1, lidUpR: 0.1, lidLo: 0.55, lidLoR: 0.55, browInL: 0.006, browInR: 0.006, browOutL: 0.009, browOutR: 0.009, w: 1.05 },
  laugh: { smile: 1.3, open: 0.78, teeth: 1, tongue: 0.8, lidUp: 0.75, lidUpR: 0.75, lidLo: 0.95, lidLoR: 0.95, browInL: 0.009, browInR: 0.009, browOutL: 0.011, browOutR: 0.011, w: 1.08, tilt: -0.05 },
  wink: { smile: 1.0, open: 0.18, teeth: 0.6, lidUp: 0.0, lidUpR: 1.25, lidLoR: 1.0, lidLo: 0.3, browOutR: -0.003, browInR: -0.003, browInL: 0.009, browOutL: 0.011, asym: 0.5, tilt: 0.07 },
  surprised: { smile: 0.1, open: 0.62, round: 0.85, tongue: 0.2, lidUp: -0.95, lidUpR: -0.95, lidLo: 0, lidLoR: 0, browInL: 0.02, browInR: 0.02, browOutL: 0.022, browOutR: 0.022, w: 0.8 },
  flustered: { smile: 0.75, open: 0.28, teeth: 0.8, lidUp: -0.35, lidUpR: -0.35, browInL: 0.016, browInR: 0.016, browOutL: 0.006, browOutR: 0.006, sweat: 1, flush: 0.8, tilt: 0.08, w: 0.95 },
  sleepy: { smile: 0.6, open: 0.04, lidUp: 0.95, lidUpR: 0.95, lidLo: 0.35, lidLoR: 0.35, browInL: -0.001, browInR: -0.001, flush: 0.25, tilt: -0.1, gy: -0.12 },
  smirk: { smile: 0.85, asym: 0.9, w: 0.95, lidUp: 0.5, lidUpR: 0.1, lidLo: 0.3, browInL: 0.0, browInR: 0.013, browOutL: -0.002, browOutR: 0.018, tilt: 0.07 },
  talking: { smile: 0.55 }, // the animator adds the jaw flaps
  proud: { smile: 0.9, lidUp: 0.45, lidUpR: 0.45, lidLo: 0.35, lidLoR: 0.35, browInL: 0.005, browInR: 0.005, browOutL: 0.008, browOutR: 0.008, tilt: -0.06 },
  love: { smile: 0.95, open: 0.1, lidUp: 0.35, lidUpR: 0.35, lidLo: 0.7, lidLoR: 0.7, browInL: 0.009, browInR: 0.009, browOutL: 0.011, browOutR: 0.011, flush: 0.9, tilt: 0.07 },
};

export const EXPRESSION_NAMES = Object.keys(EXPRESSIONS);

/** The target channel values for an expression name at an intensity (0..1) — never anything negative in tone. */
export function target(name, k = 1) {
  const e = EXPRESSIONS[name] || EXPRESSIONS.neutral;
  const out = { ...NEUTRAL };
  for (const key of Object.keys(out)) if (key in e) out[key] = lerp(NEUTRAL[key], e[key], k);
  return out;
}

/**
 * A living face. `set(name, k)` picks the target; `update(dt, { talk, look })` eases the channels, blinks (every 2.5 - 5.5 s), glances around, and
 * adds mouth flaps while `talk` is true. Returns the current channel values (read-only for the caller).
 */
export function createFace(seed = 1) {
  let s = (seed >>> 0) || 1;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const cur = { ...NEUTRAL };
  let tgt = { ...NEUTRAL };
  let name = 'neutral';
  let blinkIn = 1.5 + rnd() * 2;
  let blinkT = -1;
  let glanceIn = 1 + rnd() * 2;
  let gazeTx = 0; let gazeTy = 0;
  let talkPhase = 0;
  let t = 0;
  const speed = { default: 11, lid: 24, mouth: 14, sweat: 6 };
  return {
    get name() { return name; },
    cur,
    set(n, k = 1) { if (!EXPRESSIONS[n]) n = 'neutral'; name = n; tgt = target(n, k); },
    blink() { if (blinkT < 0) blinkT = 0; },
    update(dt, { talk = false, look = null, calm = false } = {}) {
      t += dt;
      // ease every channel to its target
      for (const k of Object.keys(cur)) {
        const sp = k.startsWith('lid') ? speed.lid : k === 'sweat' || k === 'flush' ? speed.sweat : k === 'open' || k === 'w' || k === 'smile' || k === 'round' ? speed.mouth : speed.default;
        cur[k] += (tgt[k] - cur[k]) * Math.min(1, dt * sp);
      }
      // gaze: glances now and then, or at `look` ({ x, y } radians) when given
      glanceIn -= dt;
      if (look) { gazeTx = look.x; gazeTy = look.y; } else if (glanceIn <= 0) { glanceIn = 1.2 + rnd() * 3.4; gazeTx = (rnd() - 0.5) * 0.5; gazeTy = (rnd() - 0.5) * 0.25; }
      cur.gx += (gazeTx - cur.gx) * Math.min(1, dt * 14);
      cur.gy += (gazeTy + (tgt.gy || 0) - cur.gy) * Math.min(1, dt * 14);
      // blink
      blinkIn -= dt;
      if (blinkIn <= 0 && blinkT < 0 && !calm) { blinkT = 0; blinkIn = 2.5 + rnd() * 3; if (rnd() < 0.15) blinkIn = 0.35; }
      let blink = 0;
      if (blinkT >= 0) { blinkT += dt; const u = blinkT / 0.16; blink = u < 0.5 ? u * 2 : Math.max(0, 2 - u * 2); if (u >= 1) blinkT = -1; }
      // talking: the mouth opens and closes with syllable-like beats
      let flap = 0;
      if (talk) { talkPhase += dt * 11; flap = (0.5 + 0.5 * Math.sin(talkPhase) * Math.sin(talkPhase * 0.37 + 1)) * 0.5 + 0.12; }
      return {
        ...cur,
        lidUp: cur.lidUp + blink * (1 - cur.lidUp),
        lidUpR: cur.lidUpR + blink * (1 - cur.lidUpR),
        lidLo: cur.lidLo + blink * 0.8 * (1 - cur.lidLo),
        lidLoR: cur.lidLoR + blink * 0.8 * (1 - cur.lidLoR),
        open: clamp01(cur.open + flap * (1 - cur.open * 0.5)),
        teeth: Math.max(cur.teeth, flap * 0.55),
        tongue: Math.max(cur.tongue, flap * 0.3),
      };
    },
  };
}
