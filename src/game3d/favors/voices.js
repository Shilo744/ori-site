// "Ori, Can You...?" — synthesised 'voices' (PURE data; sfx.js plays them): every character has a pitch, a rhythm and a timbre, so a line of text
// sounds like mumbling in their own voice (an Animal-Crossing-style blip per letter). Deterministic from the id.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

/**
 * @param {string} id the speaker's id
 * @param {{ gender?: 'm'|'f', age?: 'kid'|'adult'|'elder' }} who
 * @returns {{ base: number, rate: number, wave: OscillatorType, wobble: number, bright: number }}
 *   base = pitch in Hz, rate = seconds between blips, wobble = how much the pitch moves between letters (0..1)
 */
export function voiceFor(id, { gender = 'm', age = 'adult' } = {}) {
  const a = hash(id);
  const b = hash(id + '#');
  const c = hash(id + '##');
  let base = gender === 'f' ? 235 : 135;
  if (age === 'kid') base = 330;
  else if (age === 'elder') base *= gender === 'f' ? 0.92 : 0.88;
  base *= 0.88 + a * 0.26;
  return {
    base: Math.round(base),
    rate: 0.052 + b * 0.034 + (age === 'elder' ? 0.016 : 0) - (age === 'kid' ? 0.008 : 0),
    wave: c < 0.4 ? 'triangle' : c < 0.75 ? 'square' : 'sawtooth',
    wobble: 0.18 + hash(id + '###') * 0.4,
    bright: 0.5 + a * 0.5,
  };
}

/** The pitch of the blip for one letter: vowels ring higher, spaces and punctuation are silent. Returns Hz, or 0 for no sound. */
export function blipPitch(voice, ch, i = 0) {
  if (!ch || /[\s.,;:!?'"()\-—…]/.test(ch)) return 0;
  const l = ch.toLowerCase();
  const code = l.charCodeAt(0);
  const vowel = 'aeiou'.includes(l);
  const step = ((code * 7 + i * 3) % 7) / 7; // 0..1, the same letter always sounds the same here
  return voice.base * (vowel ? 1.18 : 0.92) * (1 + (step - 0.5) * voice.wobble);
}
