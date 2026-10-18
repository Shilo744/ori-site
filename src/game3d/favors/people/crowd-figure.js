// "Ori, Can You...?" — the far crowd's body shapes as plain typed arrays (PURE; the worker makes them off the main thread): one ARCHETYPE per
// hairstyle, built from the same sculpted parts as Ori but meshed coarsely, every colour white (so the vertex colour is just baked occlusion) and a
// code per vertex = colour slot + 10 * limb, which crowd3d's vertex shader uses to swing the arms and legs and to paint each instance.
import { computeCrowdData } from './assemble.js';
import { randomSpec } from './specs.js';
import { HEAD_SCALE } from './pose-apply.js';

export const CROWD_STYLES = ['short', 'curly', 'long', 'bun', 'wavy', 'bald'];
const SLOT = { tee: 0, jeans: 1, skin: 2, hair: 3, shoes: 4 };
const white = '#ffffff';

export function crowdArchetype(style) {
  const spec = randomSpec(11 + CROWD_STYLES.indexOf(style) * 7, { hair: style, gender: style === 'long' || style === 'bun' ? 'f' : 'm', age: 'adult' });
  spec.face = { ...spec.face, skin: white, blush: 0, stubble: 0, lipColor: white };
  spec.outfit = { ...spec.outfit, topColor: white, bottomColor: white, shoeColor: white, soleColor: white, accent: white, skin: white, sleeve: 1, bottom: 'jeans' };
  spec.hair = { ...spec.hair, color: white, highlight: white };
  spec.glasses = null; spec.facialHair = null; spec.hoop = null; spec.chain = null;
  spec.body = { ...spec.body, build: 1, belly: 0, shoulders: 1 };
  const data = computeCrowdData(spec);
  const names = data.rig.bones.map((b) => b.name);
  const limbOf = (bone) => { const n = names[bone]; if (/^(upperArm|lowerArm|hand|finger|thumb)L/.test(n)) return 3; if (/^(upperArm|lowerArm|hand|finger|thumb)R/.test(n)) return 4; if (/^(upLeg|lowLeg|foot|toe)L/.test(n)) return 1; if (/^(upLeg|lowLeg|foot|toe)R/.test(n)) return 2; return 0; };
  const A = data.anchors;
  const H = data.headPos;
  const eyes = [[A.eye.x, A.eye.y, A.eye.z], [-A.eye.x, A.eye.y, A.eye.z]].map((e) => [H[0] + e[0], H[1] + e[1], H[2] + e[2]]);
  let total = 0; let totalIdx = 0;
  for (const m of Object.values(data.layers)) { total += m.vertexCount; totalIdx += m.indices.length; }
  const position = new Float32Array(total * 3); const normal = new Float32Array(total * 3); const color = new Float32Array(total * 3); const code = new Float32Array(total);
  const index = new Uint32Array(totalIdx);
  let v = 0; let ii = 0;
  for (const [layer, m] of Object.entries(data.layers)) {
    for (let i = 0; i < m.vertexCount; i++, v++) {
      position[v * 3] = m.positions[i * 3]; position[v * 3 + 1] = m.positions[i * 3 + 1]; position[v * 3 + 2] = m.positions[i * 3 + 2];
      normal[v * 3] = m.normals[i * 3]; normal[v * 3 + 1] = m.normals[i * 3 + 1]; normal[v * 3 + 2] = m.normals[i * 3 + 2];
      const ao = Math.min(1, (m.colors[i * 3] + m.colors[i * 3 + 1] + m.colors[i * 3 + 2]) / 3);
      color[v * 3] = ao; color[v * 3 + 1] = ao; color[v * 3 + 2] = ao;
      let best = 0; let bw = 0;
      for (let k = 0; k < 4; k++) if (m.skinWeight[i * 4 + k] > bw) { bw = m.skinWeight[i * 4 + k]; best = m.skinIndex[i * 4 + k]; }
      let slot = SLOT[layer];
      if (layer === 'skin') {
        const px = m.positions[i * 3]; const py = m.positions[i * 3 + 1]; const pz = m.positions[i * 3 + 2];
        if (pz > H[2] + 0.02) { // only the face side of the head
          for (const e of eyes) {
            const ex = (px - e[0]) / 0.03; const ey = (py - e[1]) / 0.02;
            if (ex * ex + ey * ey < 1) slot = 4; // the eyes: a clear dark almond
            const bx = (px - e[0]) / 0.042; const by = (py - e[1] - 0.04) / 0.009;
            if (bx * bx + by * by < 1) slot = 4; // the brows
          }
          const mx = (px - H[0]) / 0.034; const my = (py - H[1] - A.mouth.y) / 0.006;
          if (mx * mx + my * my < 1) slot = 4; // a closed mouth
        }
      }
      code[v] = slot + 10 * limbOf(best);
      // the same slimmer head as the close-up people (pose-apply HEAD_SCALE), blended into the neck
      const u = Math.max(0, Math.min(1, (position[v * 3 + 1] - H[1] + 0.18) / 0.07));
      const k = 1 - (1 - HEAD_SCALE) * u * u * (3 - 2 * u);
      if (limbOf(best) === 0 && k < 1) { position[v * 3] = H[0] + (position[v * 3] - H[0]) * k; position[v * 3 + 1] = H[1] + (position[v * 3 + 1] - H[1]) * k; position[v * 3 + 2] = H[2] + (position[v * 3 + 2] - H[2]) * k; }
    }
  }
  let base = 0;
  for (const m of Object.values(data.layers)) { for (let i = 0; i < m.indices.length; i++) index[ii++] = m.indices[i] + base; base += m.vertexCount; }
  return { position, normal, color, code, index, vertexCount: total, triangleCount: totalIdx / 3 };
}
