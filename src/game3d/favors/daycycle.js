// "Ori, Can You...?" — the game clock and the light of the day (PURE). The day runs from 06:00 to midnight in about 14 real minutes
// (configurable). `skyAt(hour)` returns every colour / intensity the 3D side needs as plain numbers, so it is testable without three.
// Colours are linear-ish sRGB triples in 0..1.
import { DAY } from './content.js';

const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Key-frames by hour. `win` = lit windows, `lamps` = street lights, `stars`, `exp` = exposure, `fog` = [colour, near, far]. */
const KEYS = [
  { h: 0, top: 0x060b22, mid: 0x0d1838, hor: 0x1a2650, below: 0x070a18, sun: 0xaabbff, key: 0x7f93ff, keyI: 0.35, hemiS: 0x2a3768, hemiG: 0x0e1020, hemiI: 0.55, fog: 0x0e1430, fogN: 40, fogF: 330, stars: 1, win: 1, lamps: 1, exp: 1.25, cloud: 0x1d2548 },
  { h: 4.8, top: 0x0b1433, mid: 0x1c2750, hor: 0x3d3a6a, below: 0x0a0d1c, sun: 0xb7c4ff, key: 0x8da0ff, keyI: 0.3, hemiS: 0x34417a, hemiG: 0x151a30, hemiI: 0.5, fog: 0x272c58, fogN: 40, fogF: 340, stars: 0.7, win: 0.9, lamps: 1, exp: 1.2, cloud: 0x2b3260 },
  { h: 6.0, top: 0x5b87c9, mid: 0xb8a3b8, hor: 0xffb98c, below: 0x6a5f66, sun: 0xffa56a, key: 0xffa76a, keyI: 1.0, hemiS: 0xffcfa6, hemiG: 0x8a7b72, hemiI: 0.5, fog: 0xf2c4a4, fogN: 50, fogF: 380, stars: 0, win: 0.35, lamps: 0.5, exp: 1.08, cloud: 0xffd1b0 },
  { h: 8.0, top: 0x5fa7ee, mid: 0xa9d0f5, hor: 0xe3f0fb, below: 0xb9bfc6, sun: 0xfff1d6, key: 0xffecd2, keyI: 2.2, hemiS: 0xe6edff, hemiG: 0xd9d3c9, hemiI: 0.7, fog: 0xd8e8f6, fogN: 70, fogF: 460, stars: 0, win: 0, lamps: 0, exp: 1.02, cloud: 0xffffff },
  { h: 13.0, top: 0x3f93ee, mid: 0x8cc4f5, hor: 0xd4eafb, below: 0xc9ced4, sun: 0xfff6dd, key: 0xfff0d9, keyI: 2.6, hemiS: 0xe6edff, hemiG: 0xdcd8d0, hemiI: 0.78, fog: 0xcfe6f8, fogN: 80, fogF: 520, stars: 0, win: 0, lamps: 0, exp: 1.0, cloud: 0xffffff },
  { h: 17.0, top: 0x5a9ae6, mid: 0xaec8e6, hor: 0xf3e3c8, below: 0xc2b9ad, sun: 0xffe8c8, key: 0xffe0b8, keyI: 2.2, hemiS: 0xefeaff, hemiG: 0xd6cdbf, hemiI: 0.7, fog: 0xecdcc4, fogN: 70, fogF: 470, stars: 0, win: 0.1, lamps: 0.1, exp: 1.0, cloud: 0xfff1de },
  { h: 18.6, top: 0x4d80c6, mid: 0xe2b99a, hor: 0xffb274, below: 0x8f7d70, sun: 0xffb562, key: 0xffb562, keyI: 1.7, hemiS: 0xffe4c4, hemiG: 0xb09a85, hemiI: 0.55, fog: 0xf0bf94, fogN: 55, fogF: 400, stars: 0, win: 0.45, lamps: 0.55, exp: 1.05, cloud: 0xffcf9e },
  { h: 19.8, top: 0x27377a, mid: 0x8a6a9c, hor: 0xff7456, below: 0x4a4258, sun: 0xff7b58, key: 0xff7b58, keyI: 0.7, hemiS: 0xb894b4, hemiG: 0x4a4258, hemiI: 0.5, fog: 0xb86a78, fogN: 45, fogF: 340, stars: 0.1, win: 0.85, lamps: 0.9, exp: 1.12, cloud: 0xe29a8e },
  { h: 21.2, top: 0x0b173f, mid: 0x25346a, hor: 0x2e3f75, below: 0x0c1022, sun: 0xb0c0ff, key: 0x8fa8ff, keyI: 0.38, hemiS: 0x4a5b9c, hemiG: 0x1c2038, hemiI: 0.52, fog: 0x1d2a58, fogN: 40, fogF: 330, stars: 0.85, win: 1, lamps: 1, exp: 1.2, cloud: 0x2a3566 },
  { h: 24, top: 0x060b22, mid: 0x0d1838, hor: 0x1a2650, below: 0x070a18, sun: 0xaabbff, key: 0x7f93ff, keyI: 0.35, hemiS: 0x2a3768, hemiG: 0x0e1020, hemiI: 0.55, fog: 0x0e1430, fogN: 40, fogF: 330, stars: 1, win: 1, lamps: 1, exp: 1.25, cloud: 0x1d2548 },
];
const COLOR_KEYS = ['top', 'mid', 'hor', 'below', 'sun', 'key', 'hemiS', 'hemiG', 'fog', 'cloud'];
const NUM_KEYS = ['keyI', 'hemiI', 'fogN', 'fogF', 'stars', 'win', 'lamps', 'exp'];

const SUNRISE = 5.9;
const SUNSET = 19.6;

/** The sun (or, at night, the moon) as a unit vector: x east, y up, z south. The sun rises in the east and sets over the sea in the west. */
export function sunVector(hour) {
  const h = ((hour % 24) + 24) % 24;
  const day = h >= SUNRISE && h <= SUNSET;
  const t = day ? (h - SUNRISE) / (SUNSET - SUNRISE) : ((h < SUNRISE ? h + 24 : h) - SUNSET) / (24 - SUNSET + SUNRISE); // 0..1 across the arc
  const el = Math.sin(Math.PI * t) * (day ? 1.15 : 0.8); // radians above the horizon (the moon arcs lower)
  const az = Math.PI / 2 + Math.PI * t; // from the east (90°) through the south (180°) to the west (270°)
  const c = Math.cos(el);
  return { x: Math.sin(az) * c, y: Math.sin(el), z: -Math.cos(az) * c, day, elevation: el };
}

/** Everything the renderer needs for a game hour (0..24). Pure and cheap. */
export function skyAt(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && h >= KEYS[i + 1].h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = smooth(0, 1, (h - a.h) / (b.h - a.h));
  const out = { hour: h };
  for (const k of COLOR_KEYS) out[k] = mix3(hex(a[k]), hex(b[k]), t);
  for (const k of NUM_KEYS) out[k] = mix(a[k], b[k], t);
  const sun = sunVector(h);
  out.sunDir = [sun.x, sun.y, sun.z];
  out.isDay = sun.day;
  // the disc and its glow fade just below the horizon; at night the "sun" is the pale moon
  out.sunVis = smooth(-0.06, 0.05, sun.y);
  out.night = h >= 12 ? smooth(18.5, 20.4, h) : 1 - smooth(4.6, 6.3, h); // 0 by day, 1 at night
  return out;
}

/** A game clock: hours advance with real time. `scale` = game hours per real second. */
export function createClock({ startHour = DAY.startHour, endHour = DAY.endHour, realMinutes = DAY.realMinutes } = {}) {
  const perSecond = (endHour - startHour) / (realMinutes * 60);
  let hour = startHour;
  return {
    startHour, endHour, perSecond,
    get hour() { return hour; },
    get done() { return hour >= endHour; },
    /** 0 at the start of the day, 1 at the end. */
    get progress() { return (hour - startHour) / (endHour - startHour); },
    tick(dt, speed = 1) { hour = Math.min(endHour, hour + dt * perSecond * speed); return hour; },
    set(h) { hour = Math.min(endHour, Math.max(startHour, h)); return hour; },
    /** "07:05" */
    label(h = hour) { const m = Math.floor(h * 60 + 1e-6); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; },
  };
}

/**
 * The colour grade of a game hour (PURE): a tint, saturation, contrast, vignette, how strong the light shafts are, and how much the ambient occlusion
 * shows. `s` is what skyAt(hour) returned. Warm gold when the sun is low, cool blue at night, clean white at noon.
 */
export function gradeAt(s) {
  const up = Math.max(0, s.sunDir[1]);
  const golden = s.isDay ? s.sunVis * (1 - smooth(0.08, 0.5, up)) : 0;
  const night = s.night;
  const mixC = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
  let tint = mixC([1, 1, 1], [1.09, 0.97, 0.84], golden);
  tint = mixC(tint, [0.88, 0.96, 1.12], night);
  return {
    tint,
    sat: 1.07 + 0.12 * golden - 0.14 * night,
    contrast: 1.05 + 0.05 * golden + 0.02 * night,
    vignette: 0.2 + 0.07 * golden + 0.1 * night,
    shafts: golden * 0.95 + (s.isDay ? 0.06 * s.sunVis : 0),
    ao: 1 - 0.25 * night,
    bloom: 0.3 + 0.28 * golden + 0.25 * night,
    golden,
  };
}
