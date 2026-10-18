// "Ori, Can You...?" — writes an animator pose (anim.js) and the face channels (expressions.js) onto a skeleton of three.js-style bones
// (anything with .rotation.set / .position.set — real THREE.Bone objects in the game, plain Object3D in the node preview).

export const HEAD_SCALE = 0.9;

/** @param {Record<string, any>} bones name -> bone  @param {Record<string, number[]>} rest name -> local rest position  @param {object} pose  @param {object} face */
export function applyPose(bones, rest, pose, face) {
  const R = pose.bones;
  const set = (name, x, y, z) => { const b = bones[name]; if (b) b.rotation.set(x, y, z); };
  for (const name of Object.keys(R)) set(name, R[name][0], R[name][1], R[name][2]);
  // the hips also travel (bob, weight shift)
  const hr = rest.hips;
  bones.hips.position.set(hr[0] + pose.hipsDX, hr[1] + pose.hipsDY, hr[2] + (pose.hipsDZ || 0));
  // fingers curl towards the palm (inwards: -z on the left hand, +z on the right); the thumb folds across or stands up
  for (const [S, k] of [['L', 1], ['R', -1]]) {
    const f = pose.fingers[S];
    set('finger' + S, 0, 0, -k * f.curl * 1.25);
    set('fingerTip' + S, 0, 0, -k * f.curl * 1.5);
    const up = f.thumbUp || 0;
    set('thumb' + S, -2.35 * up, -k * (f.thumb * 0.75 + 0.4 * up), 0);
    set('thumbTip' + S, -0.25 * up - f.thumb * 0.3, 0, -k * f.thumb * 0.5);
  }
  if (!face) return;
  const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  // eyes: gaze; the upper lid follows the eye a little
  for (const [S, k] of [['L', 1], ['R', -1]]) {
    const up = S === 'L' ? face.lidUp : face.lidUpR;
    const lo = S === 'L' ? face.lidLo : face.lidLoR;
    set('eye' + S, -face.gy, face.gx, 0);
    set('lidUp' + S, 0.12 + clampN(up, -1.2, 1.3) * 0.55 - face.gy * 0.55, 0, 0);
    set('lidLo' + S, -(clampN(lo, 0, 1.3) * 0.55), 0, 0);
    const bi = bones['browIn' + S]; const bo = bones['browOut' + S];
    const ri = rest['browIn' + S]; const ro = rest['browOut' + S];
    const inL = S === 'L' ? face.browInL : face.browInR;
    const outL = S === 'L' ? face.browOutL : face.browOutR;
    bi.position.set(ri[0], ri[1] + inL, ri[2]);
    bo.position.set(ro[0], ro[1] + outL, ro[2]);
    set('browIn' + S, 0, 0, k * (inL - outL) * 4);
    set('browOut' + S, 0, 0, k * (inL - outL) * 4);
  }
  const hb = bones.head;
  hb.rotation.z += face.tilt || 0;
  hb.scale.setScalar(HEAD_SCALE); // the sculpted head is cartoon-large: slim it to believable proportions (neck weights follow)
}
