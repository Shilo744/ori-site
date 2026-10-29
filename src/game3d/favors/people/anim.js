// "Ori, Can You...?" — procedural animation for the shared skeleton (PURE: numbers in, joint angles out; no three). An animator turns what the character is
// doing (speed, sprinting, out of breath, carrying something, checking the phone, a gesture) into a pose: Euler angles per bone + a few extras (hip bob,
// finger curl, which expression to wear). Convention: a bone hanging down turns BACKWARD with +x; the head leans FORWARD with +x; +z lifts a left
// (+x) limb outward and a right limb inward, so right-hand values mirror in z / y.

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const GESTURES = {
  // name: duration (s) — the shapes live in `gesturePose` below
  thumbsUp: 1.7, facepalm: 1.8, shrug: 1.5, wave: 1.8, cheer: 1.5, nod: 1.0, point: 1.4, sigh: 2.0, bow: 1.6,
  // the ring (boxing.js): the shapes of the punches and of being hit; their speed is scaled by play(name, speed)
  jab: 0.34, cross: 0.46, hook: 0.5, upper: 0.54, hit: 0.34, dodge: 0.26, taunt: 1.2,
  // more of the ring: a punch taken on the guard, a stagger, the first fall of a knock-out, a slip to the left / right and a step back
  blockhit: 0.24, stagger: 0.62, ko: 0.9, dodgeL: 0.3, dodgeR: 0.3, dodgeB: 0.3,
};
const FIGHT = new Set(['jab', 'cross', 'hook', 'upper', 'hit', 'dodge', 'blockhit', 'stagger', 'ko', 'dodgeL', 'dodgeR', 'dodgeB']); // (no slow fade in and out: the wind-up is part of their shape)
const HOLD = new Set(['phone', 'carry', 'guard', 'block', 'tired', 'ko']); // poses that stay while the flag is set

const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulderL', 'shoulderR', 'upperArmL', 'upperArmR', 'lowerArmL', 'lowerArmR', 'handL', 'handR', 'upLegL', 'upLegR', 'lowLegL', 'lowLegR', 'footL', 'footR', 'toeL', 'toeR'];

export function emptyPose() {
  const bones = {};
  for (const b of BONES) bones[b] = [0, 0, 0];
  return { bones, hipsDY: 0, hipsDX: 0, hipsDZ: 0, fingers: { L: { curl: 0.3, thumb: 0.2, thumbUp: 0 }, R: { curl: 0.3, thumb: 0.2, thumbUp: 0 } }, expression: null, talk: false, look: null, prop: null };
}

/** The target pose of the arms (and a bit of torso / head) for a gesture at normalised time u (0..1). Returns null outside its shape. */
function gesturePose(name, u, t, amp = 1) {
  const P = {};
  const set = (b, x = 0, y = 0, z = 0) => { P[b] = [x, y, z]; };
  switch (name) {
    case 'thumbsUp': { // the selfie pose: right arm up in front, a fist with the thumb standing, a big grin and a little bounce
      const pump = Math.sin(clamp((u - 0.35) / 0.4, 0, 1) * Math.PI) * 0.12;
      set('upperArmR', -0.95 - pump, 0.1, -0.2); set('lowerArmR', -1.45 + pump, 0, 0); set('handR', -0.1, 0, 0);
      set('upperArmL', 0.1, 0, 0.12); set('lowerArmL', -0.3, 0, 0);
      set('head', -0.05, -0.12, 0.05); set('spine', -0.04, 0.06, 0);
      P.fingers = { R: { curl: 1, thumb: -0.15, thumbUp: 0 }, L: { curl: 0.35, thumb: 0.2 } };
      P.expression = 'grin';
      return P;
    }
    case 'facepalm': { // a hand to the face: flustered but smiling underneath
      const slap = sstep(0.1, 0.35, u);
      set('upperArmR', -1.15 * slap, 0.3, -0.45 * slap); set('lowerArmR', -2.05 * slap, 0, 0); set('handR', -0.2, 0.3, 0);
      set('upperArmL', 0.08, 0, 0.14); set('lowerArmL', -0.4, 0, 0);
      set('head', 0.28 * slap, 0.1 * slap, 0.06 * slap); set('spine', 0.1 * slap, 0, 0);
      P.fingers = { R: { curl: 0.05, thumb: 0.1 }, L: { curl: 0.3, thumb: 0.2 } };
      P.expression = 'flustered';
      return P;
    }
    case 'shrug': {
      const s = Math.sin(clamp(u, 0, 1) * Math.PI) ** 0.6;
      set('shoulderL', 0, 0, 0.3 * s); set('shoulderR', 0, 0, -0.3 * s);
      set('upperArmL', -0.2 * s, 0, 0.55 * s); set('upperArmR', -0.2 * s, 0, -0.55 * s);
      set('lowerArmL', -1.05 * s, 0, 0); set('lowerArmR', -1.05 * s, 0, 0);
      set('handL', 0, -0.5 * s, 0); set('handR', 0, 0.5 * s, 0);
      set('head', 0.0, 0, 0.14 * s); set('spine', 0, 0, 0);
      P.fingers = { L: { curl: 0.1, thumb: 0.1 }, R: { curl: 0.1, thumb: 0.1 } };
      P.expression = 'smirk';
      return P;
    }
    case 'wave': {
      const w = Math.sin(t * 13) * 0.45;
      set('upperArmR', 0.0, 0, -2.45); set('lowerArmR', -0.2, 0, -0.2 + w * 0.0); set('handR', 0, 0, w);
      set('upperArmL', 0.1, 0, 0.1);
      set('head', 0, 0, 0.08);
      P.fingers = { R: { curl: 0, thumb: 0.1 }, L: { curl: 0.3, thumb: 0.2 } };
      P.expression = 'grin';
      return P;
    }
    case 'cheer': {
      const bounce = Math.abs(Math.sin(t * 9)) * 0.06;
      set('upperArmL', 0, 0, 2.55); set('upperArmR', 0, 0, -2.55); set('lowerArmL', -0.25, 0, 0); set('lowerArmR', -0.25, 0, 0);
      set('head', -0.18, 0, 0); set('spine', -0.08, 0, 0);
      P.hipsDY = bounce;
      P.fingers = { L: { curl: 0.7, thumb: 0.3 }, R: { curl: 0.7, thumb: 0.3 } };
      P.expression = 'laugh';
      return P;
    }
    case 'nod': {
      set('head', 0.22 * Math.sin(u * Math.PI * 3) * (1 - u), 0, 0);
      P.expression = 'smile';
      return P;
    }
    case 'point': {
      set('upperArmR', -1.35, 0.15, -0.2); set('lowerArmR', -0.2, 0, 0); set('handR', 0, 0, 0);
      set('head', 0, -0.15, 0);
      P.fingers = { R: { curl: 0.9, thumb: 0.5 }, L: { curl: 0.3, thumb: 0.2 } };
      P.expression = 'smile';
      return P;
    }
    case 'sigh': { // a happy little exhale: chest rises and drops, a gentle head roll
      const b = Math.sin(u * Math.PI);
      set('chest', -0.05 * b, 0, 0); set('spine', 0.05 * b, 0, 0); set('head', -0.1 * b, 0.1 * Math.sin(u * Math.PI * 2), 0.06 * b);
      set('shoulderL', 0, 0, 0.12 * b); set('shoulderR', 0, 0, -0.12 * b);
      P.expression = 'sleepy';
      return P;
    }
    case 'bow': {
      const b = Math.sin(clamp(u, 0, 1) * Math.PI);
      set('spine', 0.45 * b, 0, 0); set('head', 0.2 * b, 0, 0); set('hips', 0.15 * b, 0, 0);
      set('upperArmL', 0.1, 0, 0.1); set('upperArmR', 0.1, 0, -0.1);
      P.expression = 'smile';
      return P;
    }
    // ── boxing (orthodox stance: the left hand leads; every punch starts from and returns to the guard) ──
    // ARMS are absolute (they replace the guard's arms); everything else is a DELTA on top of the held guard. u runs 0..1 over the whole move; PK is where the fist lands (the
    // sim strikes then). The body COILS first (weight back, shoulder cocked), drives through at PK with the hips and the legs behind it, holds a moment and snaps back.
    // Only the punching arm is defined: the other hand keeps the guard.
    case 'jab': { // the lead hand snaps out; the shoulder, the chest and the lead leg go with it
      const PK = 0.4;
      const coil = sstep(0, PK * 0.5, u) * (1 - sstep(PK * 0.5, PK * 0.95, u));
      const e = sstep(PK * 0.5, PK, u) * (1 - sstep(PK + 0.12, PK + 0.5, u));
      set('upperArmL', lerp(-0.78, -1.58, e) + 0.16 * coil, lerp(-0.3, 0.1, e), lerp(0.16, -0.14, e)); set('lowerArmL', lerp(-1.95, -0.05, e), 0, 0); set('handL', lerp(-0.1, 0, e), 0, 0);
      set('spine', 0.05 * e - 0.03 * coil, 0.34 * e - 0.1 * coil, 0.03 * e); set('chest', 0.02 * e, 0.22 * e - 0.05 * coil, 0); set('hips', 0, 0.14 * e - 0.05 * coil, 0);
      set('head', 0.06 * e, -0.16 * e, 0); set('shoulderL', 0.1 * e, 0, -0.14 * e);
      set('upLegL', -0.14 * e + 0.04 * coil, 0, 0); set('lowLegL', 0.1 * e, 0, 0); set('upLegR', 0.08 * e, 0, 0); set('lowLegR', 0.04 * e - 0.03 * coil, 0, 0);
      P.hipsDY = -0.02 * e - 0.01 * coil; P.hipsDZ = 0.06 * e - 0.025 * coil;
      P.fingers = { L: { curl: 1, thumb: 0.5 }, R: { curl: 1, thumb: 0.5 } };
      P.expression = 'determined';
      return P;
    }
    case 'cross': { // the rear hand with the whole body behind it: the hips turn, the back heel comes off the ground
      const PK = 0.5;
      const coil = sstep(0, PK * 0.55, u) * (1 - sstep(PK * 0.55, PK * 0.95, u));
      const e = sstep(PK * 0.55, PK, u) * (1 - sstep(PK + 0.1, PK + 0.42, u));
      set('upperArmR', lerp(-0.85, -1.55, e) + 0.18 * coil, lerp(0.3, -0.06, e), lerp(0.1, 0.2, e)); set('lowerArmR', lerp(-1.95, -0.05, e), 0, 0); set('handR', 0, 0, 0);
      set('upperArmL', -0.82, -0.3, 0.18); set('lowerArmL', -2.05, 0, 0);
      set('spine', 0.04 * e, -0.6 * e + 0.2 * coil, -0.04 * e); set('chest', 0, -0.34 * e + 0.08 * coil, 0); set('hips', 0, -0.42 * e + 0.12 * coil, 0);
      set('head', 0.05 * e, 0.22 * e, 0); set('shoulderR', 0.12 * e, 0, 0.12 * e);
      set('upLegL', -0.08 * e, 0, 0); set('lowLegL', 0.06 * e, 0, 0); set('upLegR', -0.26 * e + 0.06 * coil, 0, 0); set('lowLegR', 0.38 * e, 0, 0); set('footR', -0.2 * e, 0, 0);
      P.hipsDY = -0.04 * e - 0.015 * coil; P.hipsDZ = 0.1 * e - 0.04 * coil;
      P.fingers = { L: { curl: 1, thumb: 0.5 }, R: { curl: 1, thumb: 0.5 } };
      P.expression = 'determined';
      return P;
    }
    case 'hook': { // a wide swing of the rear hand across, the elbow high, the whole body turning into it
      const PK = 0.55;
      const coil = sstep(0, PK * 0.55, u) * (1 - sstep(PK * 0.55, PK * 0.95, u));
      const e = sstep(PK * 0.5, PK, u) * (1 - sstep(PK + 0.1, PK + 0.4, u));
      set('upperArmR', lerp(-0.9, -1.3, e), lerp(0.2, 1.15, e) - 0.35 * coil, lerp(0.15, 1.1, e)); set('lowerArmR', lerp(-1.95, -1.5, e), 0, 0); set('handR', 0, 0, 0);
      set('upperArmL', -0.82, -0.3, 0.18); set('lowerArmL', -2.05, 0, 0);
      set('spine', 0.03 * e, -0.85 * e + 0.3 * coil, -0.1 * e); set('chest', 0, -0.48 * e + 0.1 * coil, 0); set('hips', 0, -0.58 * e + 0.18 * coil, 0);
      set('head', 0, 0.32 * e, 0.1 * e);
      set('upLegL', 0.04 * e, 0, 0); set('lowLegL', 0.08 * e, 0, 0); set('upLegR', -0.1 * e, 0, 0); set('lowLegR', 0.28 * e, 0, 0); set('footR', -0.14 * e, 0, 0);
      P.hipsDY = -0.035 * e - 0.012 * coil; P.hipsDZ = 0.05 * e - 0.025 * coil;
      P.fingers = { L: { curl: 1, thumb: 0.5 }, R: { curl: 1, thumb: 0.5 } };
      P.expression = 'determined';
      return P;
    }
    case 'upper': { // a dip into the knees, then the rear hand drives up from below with the whole body rising behind it
      const dip = sstep(0, 0.4, u) * (1 - sstep(0.4, 0.55, u));
      const e = sstep(0.4, 0.6, u) * (1 - sstep(0.7, 0.95, u));
      set('upperArmR', lerp(-0.4, -0.95, e), 0.1, lerp(0.2, 0.1, e)); set('lowerArmR', lerp(-0.7, -2.35, e), 0, 0);
      set('upperArmL', -0.82, -0.3, 0.18); set('lowerArmL', -2.05, 0, 0);
      set('spine', 0.25 * dip - 0.55 * e, -0.4 * e, 0); set('chest', -0.15 * e, 0, 0); set('hips', 0, -0.2 * e, 0); set('head', -0.04 * dip - 0.3 * e, 0, 0);
      set('upLegL', -0.16 * dip, 0, 0); set('lowLegL', 0.4 * dip - 0.25 * e, 0, 0); set('upLegR', 0.06 * dip, 0, 0); set('lowLegR', 0.36 * dip - 0.22 * e, 0, 0);
      P.hipsDY = -0.12 * dip + 0.06 * e; P.hipsDZ = 0.04 * e;
      P.fingers = { L: { curl: 1, thumb: 0.5 }, R: { curl: 1, thumb: 0.5 } };
      P.expression = 'determined';
      return P;
    }
    case 'hit': { // the head whips back, the shoulders twist away, the weight goes back and the guard opens a little (amp: how hard it was)
      const k = Math.sin(clamp(u, 0, 1) * Math.PI) ** 0.7 * amp;
      set('head', -0.5 * k, 0.28 * k, 0.14 * k); set('neck', -0.2 * k, 0, 0); set('spine', -0.34 * k, 0.18 * k, 0.06 * k); set('chest', -0.14 * k, 0.1 * k, 0);
      set('upperArmL', -0.78 + 0.34 * k, -0.3, 0.16 + 0.55 * k); set('upperArmR', -0.85 + 0.34 * k, 0.3, -0.1 - 0.55 * k); set('lowerArmL', -1.95 + 0.45 * k, 0, 0); set('lowerArmR', -1.95 + 0.45 * k, 0, 0);
      set('upLegL', 0.1 * k, 0, 0); set('upLegR', 0.08 * k, 0, 0); set('lowLegL', 0.06 * k, 0, 0);
      P.hipsDY = -0.04 * k; P.hipsDZ = -0.1 * k;
      P.fingers = { L: { curl: 0.6, thumb: 0.3 }, R: { curl: 0.6, thumb: 0.3 } };
      P.expression = 'surprised';
      return P;
    }
    case 'blockhit': { // a punch taken on the guard: the arms jolt, the body leans into the block and is pushed back
      const k = Math.sin(clamp(u, 0, 1) * Math.PI) ** 0.8;
      set('upperArmL', -1.0 + 0.24 * k, -0.15, 0.3 + 0.1 * k); set('upperArmR', -1.0 + 0.24 * k, 0.15, -0.3 - 0.1 * k); set('lowerArmL', -2.45 + 0.12 * k, 0, 0); set('lowerArmR', -2.45 + 0.12 * k, 0, 0);
      set('spine', -0.14 * k, 0.04 * k, 0); set('chest', -0.06 * k, 0, 0); set('head', -0.1 * k, 0, 0.04 * k);
      set('shoulderL', 0, 0, 0.06 * k); set('shoulderR', 0, 0, -0.06 * k);
      set('upLegL', 0.1 * k, 0, 0); set('upLegR', 0.08 * k, 0, 0); set('lowLegL', 0.06 * k, 0, 0); set('lowLegR', 0.06 * k, 0, 0);
      P.hipsDY = -0.02 * k; P.hipsDZ = -0.07 * k;
      P.fingers = { L: { curl: 1, thumb: 0.5 }, R: { curl: 1, thumb: 0.5 } };
      P.expression = 'determined';
      return P;
    }
    case 'stagger': { // the guard is broken or a heavy punch landed: he reels back, the arms open for balance, the knees wobble
      const k = Math.sin(clamp(u, 0, 1) * Math.PI) ** 0.6;
      const w = Math.sin(u * 14) * (1 - u) * 0.5;
      set('head', -0.34 * k, 0.2 * w, 0.18 * w); set('spine', -0.28 * k, 0.16 * w, 0.1 * w); set('chest', -0.1 * k, 0, 0);
      set('upperArmL', -0.5, 0, 0.95 * k); set('upperArmR', -0.5, 0, -0.95 * k); set('lowerArmL', -0.9 * k, 0, 0); set('lowerArmR', -0.9 * k, 0, 0);
      set('upLegL', 0.2 * k + 0.16 * w, 0, 0.1 * k); set('upLegR', 0.12 * k - 0.16 * w, 0, -0.1 * k); set('lowLegL', 0.2 * k, 0, 0); set('lowLegR', 0.16 * k, 0, 0);
      P.hipsDY = -0.05 * k; P.hipsDZ = -0.16 * k;
      P.fingers = { L: { curl: 0.4, thumb: 0.2 }, R: { curl: 0.4, thumb: 0.2 } };
      P.expression = 'surprised';
      return P;
    }
    case 'ko': { // the first moment of the fall: the head and the arms fly back, the knees give way
      const k = sstep(0, 0.55, u);
      set('head', -0.5 * k, 0.3 * k, 0.2 * k); set('neck', -0.18 * k, 0, 0); set('spine', -0.3 * k, 0, 0); set('chest', -0.12 * k, 0, 0);
      set('upperArmL', 0.2 * k, 0, 1.1 * k); set('upperArmR', 0.2 * k, 0, -1.1 * k); set('lowerArmL', -0.3 * k, 0, 0); set('lowerArmR', -0.3 * k, 0, 0);
      set('upLegL', 0.1 * k, 0, 0.14 * k); set('upLegR', 0.1 * k, 0, -0.14 * k); set('lowLegL', 0.5 * (1 - sstep(0.4, 0.9, u)), 0, 0); set('lowLegR', 0.45 * (1 - sstep(0.4, 0.9, u)), 0, 0);
      P.hipsDY = -0.08 * k; P.hipsDZ = -0.1 * k;
      P.fingers = { L: { curl: 0.3, thumb: 0.2 }, R: { curl: 0.3, thumb: 0.2 } };
      P.expression = 'sleepy';
      return P;
    }
    case 'dodge': { // a quick lean out of the way (he went straight away from the punch)
      const k = Math.sin(clamp(u, 0, 1) * Math.PI);
      set('spine', 0.18 * k, 0, 0.3 * k); set('chest', 0, 0, 0.12 * k); set('head', 0.08 * k, 0, -0.22 * k); set('hips', 0, 0, -0.1 * k);
      set('upLegL', -0.2 * k, 0, 0); set('upLegR', 0.16 * k, 0, 0); set('lowLegL', 0.24 * k, 0, 0); set('lowLegR', 0.24 * k, 0, 0);
      set('upperArmL', -0.8, -0.3, 0.2); set('upperArmR', -0.9, 0.3, 0.1); set('lowerArmL', -1.95, 0, 0); set('lowerArmR', -1.95, 0, 0);
      P.hipsDY = -0.08 * k;
      P.fingers = { L: { curl: 1, thumb: 0.5 }, R: { curl: 1, thumb: 0.5 } };
      P.expression = 'grin';
      return P;
    }
    case 'dodgeL': case 'dodgeR': { // a slip: the body ducks and leans out of the line of the punch, the hands stay up
      const side = name === 'dodgeL' ? 1 : -1; // +1: towards his left (+x). A rotation about z by +a takes the top of the spine towards -x (his right): so the lean is -side.
      const k = Math.sin(clamp(u, 0, 1) * Math.PI) ** 0.8;
      set('spine', 0.2 * k, 0, -0.4 * side * k); set('chest', 0, 0, -0.16 * side * k); set('hips', 0, 0, 0.14 * side * k); set('head', 0.1 * k, 0, 0.3 * side * k);
      set('upLegL', -0.12 * k, 0, 0.14 * side * k); set('upLegR', 0.1 * k, 0, 0.14 * side * k); set('lowLegL', 0.3 * k, 0, 0); set('lowLegR', 0.3 * k, 0, 0);
      set('upperArmL', -0.8, -0.3, 0.2); set('upperArmR', -0.9, 0.3, 0.1); set('lowerArmL', -1.95, 0, 0); set('lowerArmR', -1.95, 0, 0);
      P.hipsDY = -0.1 * k; P.hipsDX = 0.2 * side * k;
      P.fingers = { L: { curl: 1, thumb: 0.5 }, R: { curl: 1, thumb: 0.5 } };
      P.expression = 'grin';
      return P;
    }
    case 'dodgeB': { // a step back out of reach: the weight goes to the rear foot, the head pulls back, the hands stay up
      const k = Math.sin(clamp(u, 0, 1) * Math.PI) ** 0.8;
      set('spine', -0.16 * k, 0, 0); set('chest', -0.06 * k, 0, 0); set('head', -0.18 * k, 0, 0);
      set('upLegL', 0.3 * k, 0, 0); set('upLegR', 0.1 * k, 0, 0); set('lowLegL', 0.16 * k, 0, 0); set('lowLegR', 0.24 * k, 0, 0);
      set('upperArmL', -0.8, -0.3, 0.2); set('upperArmR', -0.9, 0.3, 0.1); set('lowerArmL', -1.95, 0, 0); set('lowerArmR', -1.95, 0, 0);
      P.hipsDY = -0.05 * k; P.hipsDZ = -0.2 * k;
      P.fingers = { L: { curl: 1, thumb: 0.5 }, R: { curl: 1, thumb: 0.5 } };
      P.expression = 'grin';
      return P;
    }
    case 'taunt': { // come on, then
      const w = Math.sin(t * 9);
      set('upperArmL', -0.9, -0.3, 0.3); set('lowerArmL', -2.0, 0, 0); set('upperArmR', -1.0 + 0.2 * w, 0.3, 0.1); set('lowerArmR', -1.7, 0, 0);
      set('head', 0.05, 0.2 * Math.sin(t * 4), 0.1); set('spine', 0.08, 0.2, 0);
      P.fingers = { L: { curl: 1, thumb: 0.5 }, R: { curl: 0.4, thumb: 0.2 } };
      P.expression = 'smirk';
      return P;
    }
    default: return null;
  }
}

/** Held poses: the iPhone in the right hand, a box in both arms. */
function heldPose(name) {
  const P = {};
  const set = (b, x = 0, y = 0, z = 0) => { P[b] = [x, y, z]; };
  if (name === 'phone') {
    set('upperArmR', -0.85, 0, -0.18); set('lowerArmR', -1.55, 0, 0); set('handR', 0.25, 0, 0);
    set('upperArmL', 0.1, 0, 0.1);
    set('head', 0.26, -0.04, 0); set('neck', 0.1, 0, 0);
    P.fingers = { R: { curl: 0.55, thumb: 0.5 }, L: { curl: 0.3, thumb: 0.2 } };
    P.prop = 'phone';
  } else if (name === 'guard') { // the boxer stance: hands up by the chin, knees soft, chin tucked, a little bladed
    set('upperArmL', -0.78, -0.3, 0.16); set('lowerArmL', -1.95, 0, 0); set('handL', -0.1, 0, 0);
    set('upperArmR', -0.85, 0.3, 0.1); set('lowerArmR', -1.95, 0, 0);
    set('spine', 0.1, 0.18, 0); set('chest', 0.03, 0.1, 0); set('hips', 0, 0.12, 0); set('head', 0.14, -0.12, 0);
    set('upLegL', -0.28, 0, 0); set('lowLegL', 0.5, 0, 0); set('upLegR', 0.18, 0, 0); set('lowLegR', 0.35, 0, 0);
    P.hipsDY = -0.07;
    P.fingers = { L: { curl: 1, thumb: 0.5 }, R: { curl: 1, thumb: 0.5 } };
    P.expression = 'determined';
  } else if (name === 'tired') { // out of breath: the guard sags, the shoulders drop, the head hangs, the knees give a little
    set('upperArmL', -0.42, -0.2, 0.3); set('lowerArmL', -1.5, 0, 0); set('handL', -0.1, 0, 0);
    set('upperArmR', -0.46, 0.2, 0.22); set('lowerArmR', -1.45, 0, 0);
    set('shoulderL', 0, 0, 0.12); set('shoulderR', 0, 0, -0.12);
    set('spine', 0.34, 0.14, 0); set('chest', 0.16, 0.06, 0); set('hips', 0, 0.1, 0); set('head', 0.36, -0.08, 0);
    set('upLegL', -0.3, 0, 0); set('lowLegL', 0.66, 0, 0); set('upLegR', 0.2, 0, 0); set('lowLegR', 0.5, 0, 0);
    P.hipsDY = -0.12;
    P.fingers = { L: { curl: 0.8, thumb: 0.4 }, R: { curl: 0.8, thumb: 0.4 } };
    P.expression = 'determined';
  } else if (name === 'block') { // the guard up for real: both forearms in front of the face, elbows in, chin down, knees bent
    set('upperArmL', -1.0, -0.15, 0.3); set('lowerArmL', -2.45, 0, 0); set('handL', -0.2, 0, 0);
    set('upperArmR', -1.0, 0.15, -0.3); set('lowerArmR', -2.45, 0, 0); set('handR', -0.2, 0, 0);
    set('shoulderL', 0, 0, 0.14); set('shoulderR', 0, 0, -0.14);
    set('spine', 0.25, 0.1, 0); set('chest', 0.1, 0.05, 0); set('hips', 0, 0.08, 0); set('head', 0.32, -0.06, 0);
    set('upLegL', -0.28, 0, 0); set('lowLegL', 0.7, 0, 0); set('upLegR', 0.18, 0, 0); set('lowLegR', 0.55, 0, 0);
    P.hipsDY = -0.1;
    P.fingers = { L: { curl: 1, thumb: 0.5 }, R: { curl: 1, thumb: 0.5 } };
    P.expression = 'determined';
  } else if (name === 'ko') { // lying on the canvas: the arms out, the legs a little apart, the head to one side
    set('upperArmL', 0.2, 0, 1.1); set('upperArmR', 0.2, 0, -1.1); set('lowerArmL', -0.3, 0, 0); set('lowerArmR', -0.3, 0, 0);
    set('head', -0.1, 0.45, 0.2); set('spine', -0.08, 0, 0);
    set('upLegL', -0.04, 0, 0.18); set('upLegR', 0.04, 0, -0.18); set('lowLegL', 0.1, 0, 0); set('lowLegR', 0.14, 0, 0);
    P.fingers = { L: { curl: 0.3, thumb: 0.2 }, R: { curl: 0.3, thumb: 0.2 } };
    P.expression = 'sleepy';
  } else if (name === 'carry') {
    set('upperArmL', -0.95, 0, -0.32); set('upperArmR', -0.95, 0, 0.32); set('lowerArmL', -1.05, 0, 0); set('lowerArmR', -1.05, 0, 0);
    set('handL', 0, 0.2, 0); set('handR', 0, -0.2, 0);
    set('spine', -0.05, 0, 0); set('head', -0.04, 0, 0);
    P.fingers = { L: { curl: 0.5, thumb: 0.4 }, R: { curl: 0.5, thumb: 0.4 } };
    P.prop = 'box';
  }
  return P;
}

/** Two held poses mixed: the guard goes up into the block over a tenth of a second instead of snapping. */
function blendPoses(A, B, m) {
  const R = {};
  const lerpF = (a, b) => ({ curl: lerp(a ? a.curl : 0.3, b ? b.curl : 0.3, m), thumb: lerp(a ? a.thumb : 0.2, b ? b.thumb : 0.2, m) });
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const a = A[k]; const b = B[k];
    if (Array.isArray(a) || Array.isArray(b)) { const x = a || [0, 0, 0]; const y = b || [0, 0, 0]; R[k] = [lerp(x[0], y[0], m), lerp(x[1], y[1], m), lerp(x[2], y[2], m)]; }
    else if (k === 'hipsDY') R[k] = lerp(a || 0, b || 0, m);
    else if (k === 'fingers') R[k] = { L: lerpF(a && a.L, b && b.L), R: lerpF(a && a.R, b && b.R) };
    else R[k] = m > 0.5 ? (b ?? a) : (a ?? b);
  }
  return R;
}

/** The same pose with left and right swapped (a southpaw: the right hand leads). Rotations about y and z flip sign; the head, spine and hips keep their names. */
const swapLR = (b) => (/[LR]$/.test(b) && b !== 'fingerL' ? b.slice(0, -1) + (b.endsWith('L') ? 'R' : 'L') : b);
export function mirrorPose(P) {
  const M = {};
  for (const k of Object.keys(P)) {
    const v = P[k];
    if (k === 'fingers') M.fingers = { L: v.R, R: v.L };
    else if (Array.isArray(v) && v.length === 3) M[swapLR(k)] = [v[0], -v[1], -v[2]];
    else M[k] = k === 'hipsDX' ? -v : v; // (a sideways shift of the hips mirrors too)
  }
  return M;
}

const ARM_BONES = ['shoulderL', 'shoulderR', 'upperArmL', 'upperArmR', 'lowerArmL', 'lowerArmR', 'handL', 'handR'];

export function createAnimator() {
  let phase = 0;
  let time = 0;
  let speedS = 0;
  let gesture = null; // { name, t, dur }
  let held = null;
  let heldW = 0;
  let gestW = 0;
  let winded = 0;
  let hop = 0;
  let mirror = false; // a southpaw (his fight poses are mirrored)
  let heldCur = null; // the held pose now, and the one it is blending in from
  let heldFrom = null;
  let heldMix = 1;
  let fwPhase = 0; // the footwork's own clock (a shuffle is quicker than a walk)
  const out = emptyPose();
  const target = emptyPose();

  const api = {
    pose: out,
    get gesture() { return gesture ? gesture.name : null; },
    /** `speed` > 1 plays it faster (a quick boxer's hands). */
    play(name, speed = 1, amp = 1) { if (GESTURES[name]) gesture = { name, t: 0, dur: GESTURES[name] / Math.max(0.05, speed), amp }; },
    /** hold = 'phone' | 'carry' | 'guard' | null */
    hold(name) { held = name; },
    get held() { return held; },
    /** Fight poses with the right hand in front (Ori fights as a southpaw so that his lead hand is the one the camera sees). */
    setMirror(on) { mirror = !!on; },
    /** fw = { fwd, side }: where he moves, relative to the way he faces (-1..1; side > 0 = to his right) - the footwork of a fighter. */
    update(dt, { speed = 0, sprinting = false, winded: w = false, stress = 0, hold = held, talking = false, acc = 0, fw = null } = {}) {
      time += dt;
      held = hold;
      const sp = speed;
      speedS += (sp - speedS) * Math.min(1, dt * 10);
      const mv = sstep(0.15, 0.9, speedS);
      const run = clamp(speedS / 4.4, 0, 1);
      const strideRate = speedS * 1.35 + (speedS > 0.2 ? 2 : 0);
      phase += dt * strideRate;
      const sprint = sprinting ? 1 : 0;
      winded += ((w ? 1 : 0) - winded) * Math.min(1, dt * 3);

      // reset the target
      for (const b of BONES) { const r = target.bones[b]; r[0] = 0; r[1] = 0; r[2] = 0; }
      target.hipsDY = 0; target.hipsDX = 0; target.hipsDZ = 0;
      target.fingers.L.curl = 0.3; target.fingers.L.thumb = 0.2; target.fingers.L.thumbUp = 0; target.fingers.R.curl = 0.3; target.fingers.R.thumb = 0.2; target.fingers.R.thumbUp = 0;
      target.expression = null; target.talk = talking; target.look = null; target.prop = null;
      const B = target.bones;

      // ── idle: breathing, a lazy weight shift, a slow glance of the head ──
      const breathe = Math.sin(time * (1.7 + stress * 1.4 + winded * 2.4));
      B.chest[0] += breathe * (0.014 + winded * 0.03); B.spine[0] += breathe * 0.01;
      B.shoulderL[2] += breathe * 0.012; B.shoulderR[2] -= breathe * 0.012;
      B.head[1] += Math.sin(time * 0.45) * 0.06 * (1 - mv); B.head[0] += Math.sin(time * 0.7) * 0.015;
      target.hipsDX += Math.sin(time * 0.37) * 0.012 * (1 - mv);
      B.hips[2] += Math.sin(time * 0.37) * 0.018 * (1 - mv);
      B.upperArmL[2] += 0.07; B.upperArmR[2] -= 0.07;
      B.lowerArmL[0] -= 0.14; B.lowerArmR[0] -= 0.14;
      B.handL[0] -= 0.05; B.handR[0] -= 0.05;

      // ── a fighter's stance: a light bounce on the balls of the feet, the weight going from side to side, and a shuffle - not a walk - when he moves ──
      const stance = held === 'guard' || held === 'block';
      fwPhase += dt * (4.6 + speedS * 2.4);
      if (stance) {
        const bt = time * (mv > 0.05 ? 8.8 : 6.6);
        const sway = Math.sin(bt);
        const bob = Math.sin(bt * 2) * (held === 'block' ? 0.45 : 1);
        target.hipsDY += -0.012 + bob * 0.015;
        B.hips[2] += sway * 0.05; B.chest[2] += -sway * 0.035; B.head[2] += sway * 0.04 * (1 - mv * 0.5);
        B.lowLegL[0] += 0.04 + (0.5 + 0.5 * bob) * 0.07; B.lowLegR[0] += 0.04 + (0.5 - 0.5 * bob) * 0.07;
        B.upLegL[0] += sway * 0.035; B.upLegR[0] += -sway * 0.035;
        B.footL[0] += -(0.5 + 0.5 * bob) * 0.05; B.footR[0] += -(0.5 - 0.5 * bob) * 0.05;
        if (mv > 0.001) {
          const f = fw ? fw.fwd : 1; const sd = fw ? fw.side : 0;
          const s1 = Math.sin(fwPhase); const s2 = Math.sin(fwPhase + Math.PI);
          B.upLegL[0] += -s1 * 0.19 * f * mv; B.upLegR[0] += -s2 * 0.19 * f * mv;
          B.lowLegL[0] += Math.max(0, Math.cos(fwPhase)) * 0.32 * mv; B.lowLegR[0] += Math.max(0, Math.cos(fwPhase + Math.PI)) * 0.32 * mv;
          B.upLegR[2] += -Math.max(0, s1) * 0.24 * sd * mv - Math.max(0, s2) * 0.1 * sd * mv; B.upLegL[2] += -Math.max(0, s2) * 0.24 * sd * mv - Math.max(0, s1) * 0.1 * sd * mv;
          B.hips[2] += -sd * 0.05 * mv; B.spine[2] += -sd * 0.04 * mv;
          B.spine[0] += 0.03 * f * mv;
        }
      }

      // ── locomotion ──
      if (mv > 0.001 && !stance) {
        const A = (0.3 + 0.55 * run + 0.12 * sprint) * mv;
        const s1 = Math.sin(phase);
        const s2 = Math.sin(phase + Math.PI);
        B.upLegL[0] += -s1 * A; B.upLegR[0] += -s2 * A;
        const kneeL = (0.1 + (0.55 + 0.5 * run) * Math.max(0, Math.cos(phase))) * mv;
        const kneeR = (0.1 + (0.55 + 0.5 * run) * Math.max(0, Math.cos(phase + Math.PI))) * mv;
        B.lowLegL[0] += kneeL; B.lowLegR[0] += kneeR;
        B.footL[0] += -(-s1 * A + kneeL) * 0.75 + 0.1 * Math.max(0, s1) * mv;
        B.footR[0] += -(-s2 * A + kneeR) * 0.75 + 0.1 * Math.max(0, s2) * mv;
        B.toeL[0] += Math.max(0, -Math.cos(phase)) * 0.25 * mv; B.toeR[0] += Math.max(0, -Math.cos(phase + Math.PI)) * 0.25 * mv;
        const Aa = (0.22 + 0.6 * run + 0.18 * sprint) * mv * (1 - winded * 0.4);
        B.upperArmL[0] += s1 * Aa; B.upperArmR[0] += s2 * Aa;
        B.lowerArmL[0] += -(0.15 + 0.85 * run + 0.25 * sprint) * mv * (0.55 + 0.45 * Math.max(0, s1 * -1 + 0.4));
        B.lowerArmR[0] += -(0.15 + 0.85 * run + 0.25 * sprint) * mv * (0.55 + 0.45 * Math.max(0, s2 * -1 + 0.4));
        B.spine[1] += s1 * 0.1 * run * mv; B.chest[1] += s1 * 0.06 * run * mv; B.hips[1] += -s1 * 0.09 * run * mv;
        B.hips[2] += s1 * 0.04 * mv; B.chest[2] += -s1 * 0.03 * mv;
        const lean = (0.04 + 0.2 * run + 0.1 * sprint) * mv;
        B.spine[0] += lean * 0.6; B.chest[0] += lean * 0.4; B.head[0] += -lean * 0.7;
        target.hipsDY += -(0.012 + 0.018 * run) * mv + (1 - Math.cos(2 * phase)) * 0.5 * (0.012 + 0.04 * run) * mv;
        const f = 0.3 + 0.55 * run + 0.2 * sprint; target.fingers.L.curl = f; target.fingers.R.curl = f;
        B.head[2] += Math.sin(phase * 0.5) * 0.035 * run * mv;
      }
      // out of breath: a happy slump (hands on knees energy)
      if (winded > 0.01) {
        B.spine[0] += 0.32 * winded; B.chest[0] += 0.1 * winded; B.head[0] += -0.1 * winded; B.neck[0] += 0.08 * winded;
        B.shoulderL[2] += -0.1 * winded; B.shoulderR[2] += 0.1 * winded;
        B.lowLegL[0] += 0.12 * winded; B.lowLegR[0] += 0.12 * winded; B.upLegL[0] += -0.06 * winded; B.upLegR[0] += -0.06 * winded;
        target.hipsDY += -0.03 * winded;
        B.upperArmL[0] += 0.18 * winded; B.upperArmR[0] += 0.18 * winded;
        target.expression = 'sleepy';
      }
      // high chaos: quick, slightly nervous energy (never a frown)
      if (stress > 0.4) { const j = (stress - 0.4) / 0.6; B.head[2] += Math.sin(time * 19) * 0.012 * j; B.shoulderL[2] += Math.sin(time * 23) * 0.015 * j; target.expression = target.expression || (stress > 0.75 ? 'flustered' : null); }
      if (acc < -3 && mv > 0.2) { B.spine[0] += 0.08; B.upLegL[0] -= 0.1; } // braking

      // ── held poses and gestures override the arms ──
      const wantHeld = held && HOLD.has(held) ? held : null;
      if (wantHeld !== heldCur) { heldFrom = heldCur; heldCur = wantHeld; heldMix = heldFrom && wantHeld ? 0 : 1; }
      heldMix = Math.min(1, heldMix + dt * 11);
      heldW += ((wantHeld ? 1 : 0) - heldW) * Math.min(1, dt * 9);
      let gp = null;
      let ge = 0;
      if (gesture) {
        gesture.t += dt;
        const u = gesture.t / gesture.dur;
        ge = FIGHT.has(gesture.name) ? Math.min(sstep(0, 0.05, u), 1 - sstep(0.88, 1, u)) : Math.min(sstep(0, 0.16, u), 1 - sstep(0.8, 1, u));
        gp = gesturePose(gesture.name, clamp(u, 0, 1), gesture.t, gesture.amp || 1);
        if (gp && mirror && (FIGHT.has(gesture.name) || gesture.name === 'taunt')) gp = mirrorPose(gp);
        if (gesture.t >= gesture.dur) gesture = null;
      }
      const heldFor = (n) => { let q = heldPose(n); if (q && mirror && (n === 'guard' || n === 'block')) q = mirrorPose(q); return q; };
      let hp = wantHeld ? heldFor(wantHeld) : null;
      if (hp && heldFrom && heldMix < 1) { const hf = heldFor(heldFrom); if (hf) hp = blendPoses(hf, hp, heldMix); }
      const apply = (P, w) => {
        if (!P || w <= 0.001) return;
        for (const b of Object.keys(P)) {
          if (!B[b]) continue;
          const isArm = ARM_BONES.includes(b);
          const base = B[b];
          // arms are replaced by the pose (so a swing does not leak into a thumbs-up); others are added on top
          for (let i = 0; i < 3; i++) base[i] = isArm ? lerp(base[i], P[b][i], w) : base[i] + P[b][i] * w;
        }
        if (P.fingers) for (const side of ['L', 'R']) if (P.fingers[side]) { target.fingers[side].curl = lerp(target.fingers[side].curl, P.fingers[side].curl, w); target.fingers[side].thumb = lerp(target.fingers[side].thumb, P.fingers[side].thumb, w); target.fingers[side].thumbUp = lerp(target.fingers[side].thumbUp, P.fingers[side].thumbUp || 0, w); }
        if (P.hipsDY) target.hipsDY += P.hipsDY * w;
        if (P.hipsDX) target.hipsDX += P.hipsDX * w;
        if (P.hipsDZ) target.hipsDZ += P.hipsDZ * w;
        if (P.expression && w > 0.4) target.expression = P.expression;
        if (P.prop && w > 0.4) target.prop = P.prop;
      };
      apply(hp, heldW);
      if (stance && heldW > 0.5 && !gp) { const bb = Math.sin(time * (mv > 0.05 ? 8.8 : 6.6) * 2) * 0.035; B.upperArmL[0] += bb; B.upperArmR[0] += bb; B.lowerArmL[0] += -bb * 0.8; B.lowerArmR[0] += -bb * 0.8; }
      apply(gp, ge);
      void gestW; void hop;

      // ── ease the output towards the target (no pops when the state flips) ──
      const k = 1 - Math.exp(-dt * (gp && gesture && FIGHT.has(gesture.name) ? 42 : stance ? 24 : 16));
      for (const b of BONES) for (let i = 0; i < 3; i++) out.bones[b][i] += (target.bones[b][i] - out.bones[b][i]) * k;
      out.hipsDY += (target.hipsDY - out.hipsDY) * k;
      out.hipsDX += (target.hipsDX - out.hipsDX) * k;
      out.hipsDZ += (target.hipsDZ - out.hipsDZ) * k;
      for (const side of ['L', 'R']) { out.fingers[side].curl += (target.fingers[side].curl - out.fingers[side].curl) * k; out.fingers[side].thumb += (target.fingers[side].thumb - out.fingers[side].thumb) * k; out.fingers[side].thumbUp += (target.fingers[side].thumbUp - out.fingers[side].thumbUp) * k; }
      out.expression = target.expression; out.talk = target.talk; out.look = target.look; out.prop = target.prop;
      return out;
    },
  };
  return api;
}

/** A frozen pose for a still frame (previews, tests): `settle` runs the animator for a second so the easing is done. */
export function posedAt(inp = {}, { gesture = null, at = 0.5, hold = null, steps = 90 } = {}) {
  const a = createAnimator();
  if (hold) a.hold(hold);
  if (gesture) a.play(gesture);
  const dt = 1 / 60;
  const total = gesture ? at : steps / 60;
  for (let t = 0; t < total; t += dt) a.update(dt, { ...inp, hold });
  return JSON.parse(JSON.stringify(a.pose));
}
