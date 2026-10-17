// "Ori, Can You...?" — the skeleton every character shares (Ori, the passers-by, the shopkeepers): bone names, parents and rest positions in model
// space (y up, +z forward, feet at y = 0, his left = +x), plus the helpers that turn a distance to a limb into skin weights. PURE data + maths.
// The face bones live in the head frame and come from the face anchors (so a bigger nose / wider-set eyes move the eyelids with them).

export const BODY_BONES = [
  // name, parent, rest position
  ['root', null, [0, 0, 0]],
  ['hips', 'root', [0, 0.86, 0]],
  ['spine', 'hips', [0, 0.99, 0]],
  ['chest', 'spine', [0, 1.13, 0]],
  ['neck', 'chest', [0, 1.31, -0.035]],
  ['head', 'neck', [0, 1.545, -0.01]],
  ['hair', 'head', [0, 1.545, -0.01]],
];

const SIDES = [['L', 1], ['R', -1]];

/** The arm / hand / leg bones for both sides (mirrored in x). */
function limbBones() {
  const out = [];
  for (const [S, k] of SIDES) {
    out.push([`shoulder${S}`, 'chest', [k * 0.07, 1.3, -0.01]]);
    out.push([`upperArm${S}`, `shoulder${S}`, [k * 0.205, 1.285, 0]]);
    out.push([`lowerArm${S}`, `upperArm${S}`, [k * 0.262, 1.025, 0]]);
    out.push([`hand${S}`, `lowerArm${S}`, [k * 0.305, 0.795, 0]]);
    out.push([`finger${S}`, `hand${S}`, [k * 0.305, 0.795 - 0.092, 0]]);
    out.push([`fingerTip${S}`, `finger${S}`, [k * 0.305, 0.795 - 0.132, 0]]);
    out.push([`thumb${S}`, `hand${S}`, [k * 0.305, 0.795 - 0.04, 0.03]]);
    out.push([`thumbTip${S}`, `thumb${S}`, [k * 0.305, 0.795 - 0.075, 0.052]]);
    out.push([`upLeg${S}`, 'hips', [k * 0.098, 0.87, 0]]);
    out.push([`lowLeg${S}`, `upLeg${S}`, [k * 0.104, 0.485, 0.005]]);
    out.push([`foot${S}`, `lowLeg${S}`, [k * 0.105, 0.095, -0.005]]);
    out.push([`toe${S}`, `foot${S}`, [k * 0.105, 0.04, 0.115]]);
  }
  return out;
}

/** The face bones, positioned from the head's anchors (head frame -> model space). */
function faceBones(A, headPos) {
  const at = (x, y, z) => [headPos[0] + x, headPos[1] + y, headPos[2] + z];
  const out = [];
  for (const [S, k] of SIDES) {
    out.push([`eye${S}`, 'head', at(k * A.eye.x, A.eye.y, A.eye.z)]);
    out.push([`lidUp${S}`, 'head', at(k * A.eye.x, A.eye.y, A.eye.z)]);
    out.push([`lidLo${S}`, 'head', at(k * A.eye.x, A.eye.y, A.eye.z)]);
    out.push([`browIn${S}`, 'head', at(k * A.eye.x * 0.55, A.brow.y, A.brow.z)]);
    out.push([`browOut${S}`, 'head', at(k * A.eye.x * 1.7, A.brow.y - 0.004, A.brow.z - 0.012)]);
  }
  return out;
}

/** @returns {{ bones: {name:string,parent:string|null,pos:number[]}[], ids: Record<string, number>, headPos: number[] }} */
export function makeRig(A, S = 1) {
  const neck = BODY_BONES.find((b) => b[0] === 'neck')[2];
  const head = [neck[0] * S, neck[1] * S + 0.27, neck[2] * S + 0.025]; // the head keeps its size; only the body below it is scaled
  const body = [...BODY_BONES, ...limbBones()].map(([name, parent, pos]) => [name, parent, name === 'head' || name === 'hair' ? head : pos.map((v) => v * S)]);
  const list = [...body, ...faceBones(A, head)];
  const bones = list.map(([name, parent, pos]) => ({ name, parent, pos }));
  const ids = {};
  bones.forEach((b, i) => { ids[b.name] = i; });
  return { bones, ids, headPos: head };
}

// ── skin weights ──
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Weights along a chain of joints P0..Pn (n bones: bone i spans Pi -> Pi+1): a vertex follows the bone it is closest to, and blends with the
 * next one within `blend` metres of a joint, so an elbow or a knee bends like skin instead of folding like cardboard. Returns [b0, w0, b1, w1].
 */
export function chainWeights(joints, boneIds, blend) {
  const n = boneIds.length;
  const S = [0];
  for (let i = 0; i < n; i++) S.push(S[i] + Math.hypot(joints[i + 1][0] - joints[i][0], joints[i + 1][1] - joints[i][1], joints[i + 1][2] - joints[i][2]));
  return (x, y, z) => {
    let best = 0; let bestD = 1e9; let bestT = 0;
    for (let i = 0; i < n; i++) {
      const a = joints[i]; const b = joints[i + 1];
      const abx = b[0] - a[0]; const aby = b[1] - a[1]; const abz = b[2] - a[2];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * abx + (y - a[1]) * aby + (z - a[2]) * abz) / (abx * abx + aby * aby + abz * abz || 1)));
      const d = Math.hypot(x - (a[0] + abx * t), y - (a[1] + aby * t), z - (a[2] + abz * t));
      if (d < bestD - 1e-9) { bestD = d; best = i; bestT = t; }
    }
    const s = S[best] + bestT * (S[best + 1] - S[best]);
    for (let k = 1; k < n; k++) {
      if (Math.abs(s - S[k]) < blend) { const w = sstep(S[k] - blend, S[k] + blend, s); return [boneIds[k - 1], 1 - w, boneIds[k], w]; }
    }
    return [boneIds[best], 1];
  };
}

/** Blend between two weight functions by a 0..1 mask (for a vertex that follows the chest near the shoulder and the arm below it). */
export function blendWeights(wa, wb, mask) {
  return (x, y, z) => {
    const m = mask(x, y, z);
    if (m <= 0) return wa(x, y, z);
    if (m >= 1) return wb(x, y, z);
    const A = wa(x, y, z); const B = wb(x, y, z);
    const acc = new Map();
    for (let i = 0; i < A.length; i += 2) acc.set(A[i], (acc.get(A[i]) || 0) + A[i + 1] * (1 - m));
    for (let i = 0; i < B.length; i += 2) acc.set(B[i], (acc.get(B[i]) || 0) + B[i + 1] * m);
    const out = [];
    [...acc.entries()].sort((p, q) => q[1] - p[1]).slice(0, 4).forEach(([b, w]) => out.push(b, w));
    return out;
  };
}

/** A single-bone weight function. */
export const rigid = (id) => () => [id, 1];
