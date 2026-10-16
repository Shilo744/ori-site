// NEON DRIFT — the data behind the look of each track: sky "looks" (Night / Sunset / Dawn / Noon) and the three biomes
// (Neon City, Desert Canyon, Alpine Coast). Pure data, no three import: colours are hex numbers.

/** Sky + light + atmosphere. Elevation/azimuth in degrees; the azimuth is relative to the start direction of the track. */
export const LOOKS = {
  night: {
    name: 'Night',
    top: 0x02010f, mid: 0x140a48, horizon: 0x5b2390, below: 0x120a2a,
    sun: { el: 22, az: 28, color: 0xbcd0ff, size: 0.018, glow: 0.35, power: 1.4 },
    stars: 1, cloud: { cover: 0.42, lit: 0x6a5ab0, shade: 0x0c0624, speed: 0.004 },
    fog: { color: 0x2a1458, near: 140, far: 2300 },
    hemi: { sky: 0x6a5cff, ground: 0x180a30, intensity: 1.15 },
    light: { color: 0x9db4ff, intensity: 0.9 },
    exposure: 1.12, envIntensity: 0.9,
    bloom: { strength: 0.6, radius: 0.5, threshold: 0.9 },
  },
  sunset: {
    name: 'Sunset',
    top: 0x1a0b50, mid: 0x8a2a78, horizon: 0xff7a3c, below: 0x3a1030,
    sun: { el: 5, az: 0, color: 0xffa860, size: 0.035, glow: 1.0, power: 3.2 },
    stars: 0.12, cloud: { cover: 0.5, lit: 0xff9a5a, shade: 0x5a1a5a, speed: 0.006 },
    fog: { color: 0xb9556a, near: 170, far: 2600 },
    hemi: { sky: 0xffa88a, ground: 0x6a3040, intensity: 1.35 },
    light: { color: 0xffa060, intensity: 3.0 },
    exposure: 1.05, envIntensity: 1.1,
    bloom: { strength: 0.55, radius: 0.6, threshold: 0.9 },
  },
  dawn: {
    name: 'Dawn',
    top: 0x23407f, mid: 0x7fa0d4, horizon: 0xffcfa6, below: 0x4a5a7a,
    sun: { el: 9, az: -14, color: 0xffe0b8, size: 0.03, glow: 0.8, power: 2.6 },
    stars: 0, cloud: { cover: 0.55, lit: 0xffe2d0, shade: 0x6a7aa8, speed: 0.005 },
    fog: { color: 0xb9c6de, near: 140, far: 2300 },
    hemi: { sky: 0xbdd0ff, ground: 0x5a6a50, intensity: 1.5 },
    light: { color: 0xffd9b0, intensity: 2.8 },
    exposure: 1.0, envIntensity: 1.2,
    bloom: { strength: 0.4, radius: 0.5, threshold: 0.95 },
  },
  noon: {
    name: 'Noon',
    top: 0x1f6fe0, mid: 0x6fb4f5, horizon: 0xcfe8ff, below: 0x6a8aa0,
    sun: { el: 58, az: 20, color: 0xfff6e0, size: 0.03, glow: 0.5, power: 3.0 },
    stars: 0, cloud: { cover: 0.5, lit: 0xffffff, shade: 0x8aa4cc, speed: 0.006 },
    fog: { color: 0xbcdcf5, near: 220, far: 3000 },
    hemi: { sky: 0xcfe6ff, ground: 0x7a8a60, intensity: 1.6 },
    light: { color: 0xfff1d6, intensity: 3.4 },
    exposure: 0.95, envIntensity: 1.3,
    bloom: { strength: 0.25, radius: 0.4, threshold: 1.0 },
  },
};

/** Biomes: a seeded track + a look + the world dressing. */
export const BIOMES = {
  city: {
    id: 'city', name: 'Neon City', seed: 7, look: 'night', laps: 3,
    road: { asphalt: 0x3a3a48, runoff: 0x2a2540, kerbA: 0xff2d6f, kerbB: 0xf2eefc, line: 0xf4f0ff, neonL: 0x19e3ff, neonR: 0xff3ea5, wet: 0.85 },
    wall: { a: 0x4a4668, b: 0x5a5680 },
    ground: { kind: 'grid', color: 0x0c0820, line: 0xff3ea5, line2: 0x19e3ff },
    embank: 'viaduct', embankColor: 0x2c2848, horizon: { kind: 'skyline', color: 0x0a0618, haze: 0x3a1a70, windows: [0xffc87a, 0x8ff0ff, 0xff7ad0] },
    props: { towers: 210, lamps: true, signs: true },
    tunnels: 1, bridges: 1,
  },
  desert: {
    id: 'desert', name: 'Desert Canyon', seed: 8, look: 'sunset', laps: 3,
    road: { asphalt: 0x4a423e, runoff: 0xc48a52, kerbA: 0xe8541a, kerbB: 0xfff0dc, line: 0xfff4e0, neonL: 0xffc04a, neonR: 0xff5a2a, wet: 0.06 },
    wall: { a: 0xb06a3c, b: 0xc47a46 },
    ground: { kind: 'sand', color: 0xd9a066 },
    embank: 'slope', embankColor: 0xb97c46, horizon: { kind: 'mesas', color: 0x7a3a3a, haze: 0xd0705a, windows: [] },
    props: { cacti: 260, rocks: 220, mesas: 16, poles: true },
    tunnels: 1, bridges: 1,
  },
  coast: {
    id: 'coast', name: 'Alpine Coast', seed: 27, look: 'dawn', laps: 3,
    road: { asphalt: 0x474a52, runoff: 0x587a58, kerbA: 0x2f6fe0, kerbB: 0xf4f8ff, line: 0xf6fbff, neonL: 0x3ee8d0, neonR: 0xff7a7a, wet: 0.3 },
    wall: { a: 0x7a8498, b: 0x8a94a8 },
    ground: { kind: 'water', color: 0x0a3550 },
    embank: 'slope', embankColor: 0x66805a, horizon: { kind: 'mountains', color: 0x5a6e98, haze: 0xcfd8ec, windows: [] },
    props: { pines: 340, rocks: 160, lighthouse: true },
    tunnels: 1, bridges: 1,
  },
};

export const BIOME_IDS = Object.keys(BIOMES);
export const LOOK_IDS = Object.keys(LOOKS);
