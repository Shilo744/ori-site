// "Ori, Can You...?" — who can speak: every character in content.js CAST plus Ori and the passers-by. Each speaker has a spec (people/specs.js),
// a voice (voices.js), a colour and a portrait pose. Specs are plain data, so a stranger the crowd produced can be rebuilt any time.
import { CAST } from '../content.js';
import { randomSpec, ORI_SPEC, SHILO_SPEC } from '../people/specs.js';
import { voiceFor } from '../voices.js';

const strHash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0; return h % 90000 + 100; };

/** Hand-made looks for the people in the sample conversations (everyone else comes from their id). */
const LOOKS = {
  ima: { seed: 4411, opts: { gender: 'f', age: 'elder', top: '#e07a8f', hair: 'bun' }, patch: { glasses: null, glass: false } },
  clerk: { seed: 2907, opts: { gender: 'f', age: 'adult', top: '#8d939c', hair: 'bun' }, patch: { glasses: { frame: '#7a4a2a', w: 0.083, h: 0.054, r: 0.011 } } },
  moti: { seed: 1203, opts: { gender: 'm', age: 'elder' } },
  roee: { seed: 8120, opts: { gender: 'm', age: 'adult', top: '#4a90e2' } },
  albert: { seed: 3331, opts: { gender: 'm', age: 'elder', top: '#f2c14e' } },
  maya: { seed: 5502, opts: { gender: 'f', age: 'adult', top: '#43b581' } },
  tourist: { seed: 777, opts: { gender: 'f', age: 'adult', top: '#b07ad8' } },
};

const cache = new Map();

/** The speaker record for an id: 'ori', a CAST key ('ima', 'clerk'...) or 'stranger:<n>' (a passer-by, n = the crowd walker's id). */
export function speaker(id) {
  if (cache.has(id)) return cache.get(id);
  let rec;
  if (id === 'ori') {
    rec = { id, name: 'Ori', role: 'You', color: '#ff9f43', spec: ORI_SPEC, voice: voiceFor('ori', { gender: 'm' }), ori: true };
  } else if (id.startsWith('stranger:')) {
    const n = +id.slice(9) || 0;
    const spec = randomSpec(7000 + n * 13);
    const NAMES = ['Dana', 'Eli', 'Shira', 'Tomer', 'Yael', 'Amit', 'Noa', 'Gal', 'Lior', 'Hila', 'Ben', 'Mor'];
    rec = { id, name: NAMES[n % NAMES.length], role: 'A neighbour', color: '#9aa4b2', spec, voice: voiceFor(id, spec), stranger: true };
  } else {
    const c = CAST[id];
    if (!c) throw new Error(`unknown speaker "${id}"`);
    const look = LOOKS[id] || { seed: strHash(id), opts: {} };
    const spec = id === 'shilo' ? JSON.parse(JSON.stringify(SHILO_SPEC)) : randomSpec(look.seed, look.opts); // (Shilo is hand-made from his own photos)
    spec.id = `cast-${id}`;
    if (look.patch) Object.assign(spec, look.patch);
    rec = { id, name: c.name, role: c.role || '', color: c.color, spec, voice: voiceFor(id, spec), rel: c.rel, home: c.home };
  }
  cache.set(id, rec);
  return rec;
}

/** Speaker ids that the dialogue graphs may use. */
export const SPEAKER_IDS = ['ori', ...Object.keys(CAST).filter((k) => k !== 'self'), 'stranger'];
