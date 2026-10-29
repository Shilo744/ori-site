// "Ori, Can You...?" — builds ALL the geometry of one character from a person spec (specs.js): the sculpted head, hair, facial parts, body, outfit,
// glasses and jewellery, merged into a handful of skinned layers (one per material) that share one skeleton (rig.js). PURE (typed arrays only), so
// node can build and preview a person; person.js turns the layers into three.js skinned meshes. Results are cached per spec.
import { buildHead, faceSpec, skinColor } from './head.js';
import { buildHair } from './hair.js';
import { makeRig } from './rig.js';
import { buildBody, buildChain, BODY_SCALE } from './body.js';
import * as F from './face.js';
import { MeshBuilder } from './geo.js';
import { surfaceTable, surfaceLUTFromTable, buildMouth } from './face.js';

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const cache = new Map();

const cacheKey = (key, quality) => (key ? `${key}@${quality}` : null);

/** Is this person already built (by the worker or an earlier call)? */
export function peekPersonData(key, quality = 1) { return cache.get(cacheKey(key, quality)) || null; }
/** Stores data that came from the worker (finished) under the key. */
export function storePersonData(key, quality, data) { cache.set(cacheKey(key, quality), data); return data; }

/** @param {object} spec a person spec (specs.js) @param {{ quality?: number, key?: string }} o quality 1 = hero, 0.7 = extras */
export function buildPersonData(spec, { quality = 1, key = null, crowd = false } = {}) {
  if (crowd) return finishPersonData(computeCrowdData(spec));
  const ck = cacheKey(key, quality);
  if (ck && cache.has(ck)) return cache.get(ck);
  const data = finishPersonData(computePersonData(spec, { quality }));
  if (ck) cache.set(ck, data);
  return data;
}

/** Adds the mouth builder (a closure over the face's surface) to data that came out of computePersonData — here or from the worker. */
export function finishPersonData(plain) {
  if (plain.mouth || !plain.lut) return plain;
  const lut = surfaceLUTFromTable(plain.lut);
  const A = plain.anchors;
  const head = plain.rig.ids.head;
  plain.mouth = (m) => { const B = new MeshBuilder(); buildMouth(B, A, m, lut, plain.face.lipColor, { head }, { thick: plain.face.lipThick }); const out = B.finish(); const k = plain.headScale; if (k && k !== 1) for (let i = 0; i < out.positions.length; i++) out.positions[i] *= k; if (plain.headDrop) for (let i = 1; i < out.positions.length; i += 3) out.positions[i] -= plain.headDrop; return out; };
  return plain;
}

/** The anchors without their functions (they are the numbers the faces and the crowd read, and they can be cloned between threads). */
const plainAnchors = (A) => ({ eye: A.eye, brow: A.brow, mouth: A.mouth, nose: A.nose, ear: A.ear, chin: A.chin, top: A.top });

/** PURE and thread-safe: everything about a person as plain data (typed arrays, numbers). */
export function computePersonData(spec, { quality = 1 } = {}) {
  const f = faceSpec(spec.face);
  const cell = (spec.headCell ?? 0.0058) / quality;
  const head = buildHead(f, { cell });
  const A = head.anchors;
  const HS = spec.headScale ?? 1; // (a person spec can shrink the cartoon head to a human size: every part in the head frame is scaled about the skull centre, the face bones follow)
  const HD = spec.headDrop ?? 0; // (and lower it towards the shoulders, metres)
  const Ar = HS === 1 && !HD ? A : { ...A, eye: { ...A.eye, x: A.eye.x * HS, y: A.eye.y * HS - HD, z: A.eye.z * HS }, brow: { ...A.brow, x: A.brow.x * HS, y: A.brow.y * HS - HD, z: A.brow.z * HS } };
  const rig = makeRig(Ar, BODY_SCALE);
  const ids = rig.ids;
  const H = [rig.headPos[0], rig.headPos[1] - HD, rig.headPos[2]];
  const skinFn = skinColor(f);
  const L = { skin: new MeshBuilder(), tee: new MeshBuilder(), jeans: new MeshBuilder(), shoes: new MeshBuilder(), hair: new MeshBuilder(), eyes: new MeshBuilder(), shine: new MeshBuilder(), frame: new MeshBuilder(), lens: new MeshBuilder(), glint: new MeshBuilder(), metal: new MeshBuilder(), lid: new MeshBuilder() };

  // the head, weighted between the head bone and the neck bone
  const hm = head.mesh;
  hm.skinIndex = new Uint16Array(hm.vertexCount * 4);
  hm.skinWeight = new Float32Array(hm.vertexCount * 4);
  for (let i = 0; i < hm.vertexCount; i++) {
    const y = hm.positions[i * 3 + 1];
    const w = sstep(-0.115, -0.185, y);
    hm.skinIndex[i * 4] = ids.head; hm.skinWeight[i * 4] = 1 - w;
    hm.skinIndex[i * 4 + 1] = ids.neck; hm.skinWeight[i * 4 + 1] = w;
  }
  L.skin.add(hm, { offset: H, scale: HS });

  // body parts
  const body = buildBody(rig, spec, { quality });
  const S = BODY_SCALE;
  for (const m of body.skin) L.skin.add(m, { scale: S });
  for (const m of body.tee) L.tee.add(m, { scale: S });
  for (const m of body.jeans) L.jeans.add(m, { scale: S });
  for (const m of body.shoes) L.shoes.add(m, { scale: S });
  for (const m of body.parts) L.skin.add(m, { scale: S });

  // the face
  const mk = () => new MeshBuilder();
  const eyes = mk(); const shine = mk(); const lids = mk(); const brows = mk(); const fhair = mk(); const frame = mk(); const lens = mk(); const hoop = mk();
  F.buildEyes(eyes, A, f, ids, spec.eyes?.iris, { irisR: spec.eyes?.irisR, pupilR: spec.eyes?.pupilR, ring: spec.eyes?.ring, squash: spec.eyes?.squash });
  F.buildEyeShine(shine, A, ids);
  // (a light eye - blue, grey, green - must not sit under the dark cartoon outline of the lids: it gets the lid layer without one; a head with its lids carved in (eyes.noLids) has none)
  const ic = parseInt(String((spec.eyes && spec.eyes.iris) || '#3a2216').replace('#', ''), 16);
  const lumI = (((ic >> 16) & 255) * 0.2126 + ((ic >> 8) & 255) * 0.7152 + (ic & 255) * 0.0722) / 255;
  if (!(spec.eyes && spec.eyes.noLids)) F.buildLids(lids, A, f, ids, skinFn);
  F.buildBrows(brows, A, f, ids, spec.brows?.color || spec.hair?.color || '#1a1210', spec.brows || {});
  if (spec.facialHair) F.buildFacialHair(fhair, A, f, ids, spec.facialHair, spec.facialHair.color || '#1a1210', skinFn);
  const glint = mk();
  if (spec.glasses) F.buildGlasses(frame, lens, A, f, ids, spec.glasses, glint);
  if (spec.hoop) F.buildHoop(hoop, A, f, ids, spec.hoop.color, spec.hoop.side || 1);
  L.eyes.add(eyes.finish(), { offset: H, scale: HS });
  L.shine.add(shine.finish(), { offset: H, scale: HS });
  (lumI > 0.36 ? L.lid : L.skin).add(lids.finish(), { offset: H, scale: HS });
  L.hair.add(brows.finish(), { offset: H, scale: HS });
  L.hair.add(fhair.finish(), { offset: H, scale: HS });
  L.frame.add(frame.finish(), { offset: H, scale: HS });
  L.lens.add(lens.finish(), { offset: H, scale: HS });
  L.glint.add(glint.finish(), { offset: H, scale: HS });
  L.metal.add(hoop.finish(), { offset: H, scale: HS });
  if (spec.chain) L.metal.add(buildChain(rig, spec.chain.color), { scale: S });
  // hair (rigid to the hair bone, a bone that can jiggle a little)
  const hair = spec.hair && spec.hair.style !== 'bald' ? buildHair(spec.hair, A, { cell: 0.0072 / quality, seed: spec.seed || 7, quality }) : null;
  if (hair) { L.hair.add(hair.mesh, { offset: H, scale: HS, bone: ids.hair }); if (hair.curls) L.hair.add(hair.curls, { offset: H, scale: HS, bone: ids.hair }); }

  const layers = {};
  for (const [name, b] of Object.entries(L)) { const m = b.finish(); if (m.vertexCount) layers[name] = m; }
  // the mouth is rebuilt every frame from an expression (head frame, parented to the head bone): finishPersonData makes the builder
  const lut = surfaceTable(A.surface, -0.075, 0.075, -0.2, -0.03);
  return { spec, face: f, anchors: plainAnchors(A), rig, layers, headPos: rig.headPos, lut, headScale: HS, headDrop: HD };
}

/** Triangle counts per layer + the total (for the budget numbers). */
export function personStats(data) {
  const per = {};
  let tris = 0;
  for (const [k, m] of Object.entries(data.layers)) { per[k] = m.triangleCount; tris += m.triangleCount; }
  return { per, tris, layers: Object.keys(data.layers).length, bones: data.rig.bones.length };
}

/** The far crowd's version of a person: the same head, hair and body but meshed coarsely, with no face parts, hands or curls. */
export function computeCrowdData(spec) {
  const f = faceSpec(spec.face);
  const head = buildHead(f, { cell: 0.016, ao: true }); // (a finer head than the body: the eyes have to be readable)
  const A = head.anchors;
  const rig = makeRig(A, BODY_SCALE);
  const L = { skin: new MeshBuilder(), tee: new MeshBuilder(), jeans: new MeshBuilder(), shoes: new MeshBuilder(), hair: new MeshBuilder() };
  const H = rig.headPos;
  const hm = head.mesh;
  hm.skinIndex = new Uint16Array(hm.vertexCount * 4);
  hm.skinWeight = new Float32Array(hm.vertexCount * 4);
  for (let i = 0; i < hm.vertexCount; i++) { hm.skinIndex[i * 4] = rig.ids.head; hm.skinWeight[i * 4] = 1; }
  L.skin.add(hm, { offset: H });
  const body = buildBody(rig, spec, { crowd: true });
  for (const m of body.skin) L.skin.add(m, { scale: BODY_SCALE });
  for (const m of body.parts) L.skin.add(m, { scale: BODY_SCALE });
  for (const m of body.tee) L.tee.add(m, { scale: BODY_SCALE });
  for (const m of body.jeans) L.jeans.add(m, { scale: BODY_SCALE });
  for (const m of body.shoes) L.shoes.add(m, { scale: BODY_SCALE });
  const hair = spec.hair && spec.hair.style !== 'bald' ? buildHair({ ...spec.hair, curlDensity: 0 }, A, { cell: 0.026, seed: spec.seed || 7, quality: 0.3 }) : null;
  if (hair) L.hair.add(hair.mesh, { offset: H, bone: rig.ids.hair });
  const layers = {};
  for (const [name, b] of Object.entries(L)) { const m = b.finish(); if (m.vertexCount) layers[name] = m; }
  return { spec, face: f, anchors: plainAnchors(A), rig, layers, headPos: H, crowd: true };
}
