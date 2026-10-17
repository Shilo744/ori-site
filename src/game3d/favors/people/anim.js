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
};
const HOLD = new Set(['phone', 'carry']); // poses that stay while the flag is set

const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulderL', 'shoulderR', 'upperArmL', 'upperArmR', 'lowerArmL', 'lowerArmR', 'handL', 'handR', 'upLegL', 'upLegR', 'lowLegL', 'lowLegR', 'footL', 'footR', 'toeL', 'toeR'];

export function emptyPose() {
  const bones = {};
  for (const b of BONES) bones[b] = [0, 0, 0];
  return { bones, hipsDY: 0, hipsDX: 0, hipsDZ: 0, fingers: { L: { curl: 0.3, thumb: 0.2, thumbUp: 0 }, R: { curl: 0.3, thumb: 0.2, thumbUp: 0 } }, expression: null, talk: false, look: null, prop: null };
}

/** The target pose of the arms (and a bit of torso / head) for a gesture at normalised time u (0..1). Returns null outside its shape. */
function gesturePose(name, u, t) {
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
  } else if (name === 'carry') {
    set('upperArmL', -0.95, 0, -0.32); set('upperArmR', -0.95, 0, 0.32); set('lowerArmL', -1.05, 0, 0); set('lowerArmR', -1.05, 0, 0);
    set('handL', 0, 0.2, 0); set('handR', 0, -0.2, 0);
    set('spine', -0.05, 0, 0); set('head', -0.04, 0, 0);
    P.fingers = { L: { curl: 0.5, thumb: 0.4 }, R: { curl: 0.5, thumb: 0.4 } };
    P.prop = 'box';
  }
  return P;
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
  const out = emptyPose();
  const target = emptyPose();

  const api = {
    pose: out,
    get gesture() { return gesture ? gesture.name : null; },
    play(name) { if (GESTURES[name]) gesture = { name, t: 0, dur: GESTURES[name] }; },
    /** hold = 'phone' | 'carry' | null */
    hold(name) { held = name; },
    update(dt, { speed = 0, sprinting = false, winded: w = false, stress = 0, hold = held, talking = false, acc = 0 } = {}) {
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

      // ── locomotion ──
      if (mv > 0.001) {
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
      heldW += ((wantHeld ? 1 : 0) - heldW) * Math.min(1, dt * 9);
      let gp = null;
      let ge = 0;
      if (gesture) {
        gesture.t += dt;
        const u = gesture.t / gesture.dur;
        ge = Math.min(sstep(0, 0.16, u), 1 - sstep(0.8, 1, u));
        gp = gesturePose(gesture.name, clamp(u, 0, 1), gesture.t);
        if (gesture.t >= gesture.dur) gesture = null;
      }
      const hp = wantHeld ? heldPose(wantHeld) : null;
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
        if (P.expression && w > 0.4) target.expression = P.expression;
        if (P.prop && w > 0.4) target.prop = P.prop;
      };
      apply(hp, heldW);
      apply(gp, ge);
      void gestW; void hop;

      // ── ease the output towards the target (no pops when the state flips) ──
      const k = 1 - Math.exp(-dt * 16);
      for (const b of BONES) for (let i = 0; i < 3; i++) out.bones[b][i] += (target.bones[b][i] - out.bones[b][i]) * k;
      out.hipsDY += (target.hipsDY - out.hipsDY) * k;
      out.hipsDX += (target.hipsDX - out.hipsDX) * k;
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
