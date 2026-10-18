// "Ori, Can You...?" — person specs: Ori himself (built from ORI.look in content.js and the selfie that stays in .duo/assets) and the parametric
// generator for everybody else. A spec is plain data; assemble.js turns it into geometry, person.js into a living, skinned character.
import { ORI } from '../content.js';
import { mulberry32 } from '../../rng.js';

const hex = (n) => (typeof n === 'number' ? `#${n.toString(16).padStart(6, '0')}` : n);

export const ORI_SPEC = (() => {
  const L = ORI.look;
  return {
    id: 'ori', seed: 2026,
    // olive-tan skin, a strong jaw, a prominent rounded nose, full lower lip, thick straight brows, relaxed eyes
    face: { skin: hex(L.skin), width: 1.03, jaw: 1.1, chinW: 1.12, cheek: 1.18, brow: 1.2, nose: { len: 0.82, width: 0.8, tip: 0.8, bridge: 0.85 }, lips: { upper: 1.05, lower: 1.2, width: 1.05 }, eyeSep: 1.02, eyeSize: 0.86, ear: 1.3, stubble: 0.85, blush: 0.1, lipColor: '#a85a4e' },
    eyes: { iris: '#3a2216' },
    brows: { color: '#17100d', thick: 1.1 },
    hair: { style: 'curly', color: hex(L.hair), highlight: '#4a3020', volume: 1 },
    facialHair: { moustache: true, goatee: true, color: '#17100d' },
    glasses: { frame: hex(L.glasses), frameW: 0.006, w: 0.074, h: 0.048, r: 0.014 },
    hoop: { color: hex(L.earring), side: 1 }, // his LEFT ear (+x, the model faces +z)
    chain: { color: hex(L.chain) },
    body: { build: 1.08, shoulders: 1.12, belly: 0.12, arms: 1.35, hands: 1.3 },
    outfit: { top: 'tee', sleeve: 1, topColor: hex(L.tee), bottom: 'jeans', bottomColor: hex(L.jeans), shoes: 'sneakers', shoeColor: hex(L.shoes), soleColor: '#d9d9d4', accent: '#e5625e', skin: hex(L.skin) },
  };
})();

// ── the parametric generator: any number of different neighbours from a seed ──
const SKINS = ['#f1cba5', '#e3b58c', '#cf9770', '#b57a53', '#8b5a3c', '#5e3a28'];
const HAIR_COLORS = ['#17100c', '#2b1a11', '#4a2f1d', '#6b4a2a', '#a8742f', '#c9a25b', '#8a3a22', '#b3b3b8', '#dcdcdf'];
const TOPS = ['#e5625e', '#4a90e2', '#f2c14e', '#43b581', '#f3efe7', '#b07ad8', '#ff9a62', '#2fb8d8', '#1f2a44', '#7d8f69', '#e8d5a8', '#c46a8a'];
const BOTTOMS = ['#2c3140', '#4a4f58', '#7a6a55', '#30425f', '#d9d3c4', '#6b4a35', '#2f5b4a', '#8a97b3'];
const SHOES = ['#f3f3f1', '#2a2a2e', '#c9a27a', '#e5625e', '#4a90e2'];

/** Consecutive seeds must give unrelated people: hash the seed before it starts the generator. */
function seeded(seed) {
  let h = ((seed >>> 0) ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  const r = mulberry32((h ^ (h >>> 16)) >>> 0);
  r(); r(); r();
  return r;
}
const pick = (rnd, a) => a[Math.floor(rnd() * a.length) % a.length];
const range = (rnd, a, b) => a + rnd() * (b - a);

/**
 * A believable random neighbour. `opts`: { gender: 'm'|'f'|null, age: 'kid'|'adult'|'elder'|null, hair, top, ... } force any piece.
 * Every spec is plain data (JSON-safe) so the dialogue system can store it with the character.
 */
export function randomSpec(seed, opts = {}) {
  const rnd = seeded(seed);
  const gender = opts.gender || (rnd() < 0.5 ? 'm' : 'f');
  const age = opts.age || (rnd() < 0.14 ? 'elder' : rnd() < 0.12 ? 'kid' : 'adult');
  const skin = opts.skin || pick(rnd, SKINS);
  const styles = gender === 'f' ? ['long', 'long', 'wavy', 'bun', 'short', 'curly'] : ['short', 'short', 'buzz', 'curly', 'wavy', 'bald'];
  let hairColor = opts.hairColor || pick(rnd, HAIR_COLORS.slice(0, 7));
  if (age === 'elder') hairColor = rnd() < 0.7 ? pick(rnd, ['#b3b3b8', '#dcdcdf']) : hairColor;
  const hairStyle = opts.hair || (age === 'kid' ? pick(rnd, ['short', 'curly', 'bun']) : age === 'elder' && gender === 'm' && rnd() < 0.4 ? 'bald' : pick(rnd, styles));
  const sleeve = rnd() < 0.1 ? 0 : rnd() < 0.7 ? 1 : 2;
  const bottom = opts.bottom || (gender === 'f' && rnd() < 0.3 ? 'skirt' : rnd() < 0.25 ? 'shorts' : 'jeans');
  const kid = age === 'kid';
  return {
    id: `npc-${seed}`, seed: (seed >>> 0) % 100000 || 1, gender, age,
    scale: kid ? 0.68 : range(rnd, 0.94, 1.06) * (gender === 'f' ? 0.97 : 1),
    face: {
      skin, width: range(rnd, 0.92, 1.1) * (kid ? 1.05 : 1), height: range(rnd, 0.94, 1.06), jaw: range(rnd, 0.9, 1.1) * (gender === 'f' ? 0.94 : 1.02), chinW: range(rnd, 0.85, 1.15), chinLen: range(rnd, 0.9, 1.1), cheek: range(rnd, 0.85, 1.2) * (kid ? 1.15 : 1), brow: range(rnd, 0.8, 1.2) * (gender === 'f' ? 0.85 : 1),
      nose: { len: range(rnd, 0.82, 1.15), width: range(rnd, 0.85, 1.2), tip: range(rnd, 0.85, 1.2), bridge: range(rnd, 0.8, 1.2) },
      lips: { upper: range(rnd, 0.85, 1.2), lower: range(rnd, 0.95, 1.35), width: range(rnd, 0.9, 1.1) },
      eyeSep: range(rnd, 0.92, 1.1), eyeSize: range(rnd, 0.8, 0.95) * (kid ? 1.1 : 1), eyeY: range(rnd, -0.004, 0.004), ear: range(rnd, 0.85, 1.2), earOut: range(rnd, 0.95, 1.08),
      blush: range(rnd, 0.2, 0.5), lipColor: gender === 'f' && rnd() < 0.5 ? '#b3485a' : '#b8665a', stubble: gender === 'm' && !kid && rnd() < 0.35 ? range(rnd, 0.2, 0.6) : 0,
    },
    eyes: { iris: pick(rnd, ['#3a2216', '#4a3322', '#2e4a5a', '#3f5a3a', '#6a4a22']) },
    brows: { color: hairColor, thick: gender === 'f' ? 0.75 : range(rnd, 0.85, 1.2) },
    hair: { style: hairStyle, color: hairColor, highlight: hairColor, volume: range(rnd, 0.92, 1.1), curlDensity: 0.7 },
    facialHair: gender === 'm' && !kid && rnd() < 0.3 ? { moustache: rnd() < 0.7, goatee: rnd() < 0.5, color: hairColor } : null,
    glasses: rnd() < (age === 'elder' ? 0.5 : 0.2) ? { frame: pick(rnd, ['#0d0e11', '#7a4a2a', '#c8a050', '#d8d8dc']), w: rnd() < 0.5 ? 0.083 : 0.07, h: rnd() < 0.5 ? 0.054 : 0.066, r: rnd() < 0.5 ? 0.011 : 0.03 } : null,
    hoop: rnd() < 0.12 ? { color: '#d9dde3', side: rnd() < 0.5 ? 1 : -1 } : null,
    chain: rnd() < 0.1 ? { color: '#d5dae0' } : null,
    body: { build: range(rnd, 0.88, 1.16) * (age === 'elder' ? 1.04 : 1) * (kid ? 0.95 : 1), shoulders: gender === 'f' ? range(rnd, 0.88, 1) : range(rnd, 0.98, 1.1), belly: age === 'elder' || rnd() < 0.2 ? range(rnd, 0.2, 0.9) : 0, hands: 1.18, arms: 1.1 },
    outfit: { top: 'tee', sleeve, topColor: opts.top || pick(rnd, TOPS), bottom, bottomColor: pick(rnd, BOTTOMS), shoes: 'sneakers', shoeColor: pick(rnd, SHOES), soleColor: '#d9d9d4', accent: pick(rnd, TOPS), skin },
  };
}
