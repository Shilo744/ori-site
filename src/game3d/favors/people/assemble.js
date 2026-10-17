// "Ori, Can You...?" — builds ALL the geometry of one character from a person spec (specs.js): the sculpted head, hair, facial parts, body, outfit,
// glasses and jewellery, merged into a handful of skinned layers (one per material) that share one skeleton (rig.js). PURE (typed arrays only), so
// node can build and preview a person; person.js turns the layers into three.js skinned meshes. Results are cached per spec.
import { buildHead, faceSpec, skinColor } from './head.js';
import { buildHair } from './hair.js';
import { makeRig } from './rig.js';
import { buildBody, buildChain, BODY_SCALE } from './body.js';
import * as F from './face.js';
import { MeshBuilder } from './geo.js';

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const cache = new Map();

/** @param {object} spec a person spec (specs.js) @param {{ quality?: number, key?: string }} o quality 1 = hero, 0.7 = extras */
export function buildPersonData(spec, { quality = 1, key = null, crowd = false } = {}) {
  if (crowd) return buildCrowdData(spec);
  const ck = key ? `${key}@${quality}` : null;
  if (ck && cache.has(ck)) return cache.get(ck);
  const f = faceSpec(spec.face);
  const cell = 0.0058 / quality;
  const head = buildHead(f, { cell });
  const A = head.anchors;
  const rig = makeRig(A, BODY_SCALE);
  const ids = rig.ids;
  const H = rig.headPos;
  const skinFn = skinColor(f);
  const L = { skin: new MeshBuilder(), tee: new MeshBuilder(), jeans: new MeshBuilder(), shoes: new MeshBuilder(), hair: new MeshBuilder(), eyes: new MeshBuilder(), shine: new MeshBuilder(), frame: new MeshBuilder(), lens: new MeshBuilder(), metal: new MeshBuilder() };

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
  L.skin.add(hm, { offset: H });

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
  F.buildEyes(eyes, A, f, ids, spec.eyes?.iris);
  F.buildEyeShine(shine, A, ids);
  F.buildLids(lids, A, f, ids, skinFn);
  F.buildBrows(brows, A, f, ids, spec.brows?.color || spec.hair?.color || '#1a1210', spec.brows || {});
  if (spec.facialHair) F.buildFacialHair(fhair, A, f, ids, spec.facialHair, spec.facialHair.color || '#1a1210', skinFn);
  if (spec.glasses) F.buildGlasses(frame, lens, A, f, ids, spec.glasses);
  if (spec.hoop) F.buildHoop(hoop, A, f, ids, spec.hoop.color, spec.hoop.side || 1);
  L.eyes.add(eyes.finish(), { offset: H });
  L.shine.add(shine.finish(), { offset: H });
  L.skin.add(lids.finish(), { offset: H });
  L.hair.add(brows.finish(), { offset: H });
  L.hair.add(fhair.finish(), { offset: H });
  L.frame.add(frame.finish(), { offset: H });
  L.lens.add(lens.finish(), { offset: H });
  L.metal.add(hoop.finish(), { offset: H });
  if (spec.chain) L.metal.add(buildChain(rig, spec.chain.color), { scale: S });
  // hair (rigid to the hair bone, a bone that can jiggle a little)
  const hair = spec.hair && spec.hair.style !== 'bald' ? buildHair(spec.hair, A, { cell: 0.0072 / quality, seed: spec.seed || 7, quality }) : null;
  if (hair) { L.hair.add(hair.mesh, { offset: H, bone: ids.hair }); if (hair.curls) L.hair.add(hair.curls, { offset: H, bone: ids.hair }); }

  const layers = {};
  for (const [name, b] of Object.entries(L)) { const m = b.finish(); if (m.vertexCount) layers[name] = m; }
  // the mouth is rebuilt every frame from an expression (head frame, parented to the head bone)
  const lut = F.surfaceLUT(A.surface, -0.075, 0.075, -0.2, -0.03);
  const mouth = (m) => { const B = new MeshBuilder(); F.buildMouth(B, A, m, lut, f.lipColor, { head: ids.head }); return B.finish(); };
  const data = { spec, face: f, anchors: A, rig, layers, mouth, headPos: H };
  if (ck) cache.set(ck, data);
  return data;
}

/** Triangle counts per layer + the total (for the budget numbers). */
export function personStats(data) {
  const per = {};
  let tris = 0;
  for (const [k, m] of Object.entries(data.layers)) { per[k] = m.triangleCount; tris += m.triangleCount; }
  return { per, tris, layers: Object.keys(data.layers).length, bones: data.rig.bones.length };
}

/** The far crowd's version of a person: the same head, hair and body but meshed coarsely, with no face parts, hands or curls. */
function buildCrowdData(spec) {
  const f = faceSpec(spec.face);
  const head = buildHead(f, { cell: 0.022, ao: true });
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
  return { spec, face: f, anchors: A, rig, layers, headPos: H, crowd: true };
}
