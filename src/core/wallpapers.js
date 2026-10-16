// Procedural wallpapers (T11): pure Canvas-2D drawing, no DOM / THREE, so the macOS desktop, the 3D wall art, the
// settings thumbnails and the iPhone / iPad screens all paint the very same picture.
//   drawWallpaper(ctx, w, h, 'sunrise', hours)   hours only matters for 'dynamic'
export const WALLPAPERS = [
  { id: 'sunrise', name: 'Sunrise' },
  { id: 'aurora', name: 'Aurora' },
  { id: 'dunes', name: 'Dunes' },
  { id: 'ocean', name: 'Ocean' },
  { id: 'midnight', name: 'Midnight Peaks' },
  { id: 'mono', name: 'Mono Gradient' },
  { id: 'dynamic', name: 'Dynamic', dynamic: true },
];
export const WALLPAPER_IDS = WALLPAPERS.map((w) => w.id);
export const DEFAULT_WALLPAPER = 'sunrise';
export const wallpaperName = (id) => (WALLPAPERS.find((w) => w.id === id) || WALLPAPERS[0]).name;

// ── colour helpers ──
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const rgba = (c, a = 1) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };
/** Linear interpolation of two palettes with the same shape (numbers and '#rrggbb' strings, nested in arrays). */
export function lerpPalette(a, b, t) {
  if (Array.isArray(a)) return a.map((v, i) => lerpPalette(v, b[i], t));
  if (a && typeof a === 'object') return Object.fromEntries(Object.keys(a).map((k) => [k, lerpPalette(a[k], b[k], t)]));
  if (typeof a === 'number') return a + (b - a) * t;
  const ca = hex(a), cb = hex(b);
  return `#${ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
const smooth = (t) => t * t * (3 - 2 * t);
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ── ribbon style (Sunrise, Ocean, Dynamic): a gradient sky, two glows and four flowing bands ──
// palette = { bg: [4 stops], glow: [[colour, alpha] x2], r1: [[colour, alpha] x2], r2: [x3], r3: [x2], r4: [colour, alpha] }
const SUNRISE = {
  bg: ['#0d1646', '#3b2a96', '#b6389a', '#ff8f5e'], glow: [['#ffd1a0', 0.55], ['#3ad0ff', 0.32]],
  r1: [['#2e1c7a', 0.9], ['#7a2a9a', 0.7]], r2: [['#4ad0ff', 0.75], ['#7a6bff', 0.7], ['#ff7ad1', 0.7]], r3: [['#ffb36a', 0.75], ['#ff5e9c', 0.6]], r4: ['#0c0a2a', 0.45],
};
const OCEAN = {
  bg: ['#06222e', '#0f5a6b', '#27a3a0', '#b9f0c8'], glow: [['#c8ffe6', 0.45], ['#50c8ff', 0.3]],
  r1: [['#083c50', 0.9], ['#126e78', 0.7]], r2: [['#5ae6d2', 0.75], ['#3caaff', 0.7], ['#96ffbe', 0.7]], r3: [['#bef8c8', 0.75], ['#3cc8aa', 0.6]], r4: ['#041c28', 0.45],
};
// the Dynamic wallpaper walks through these key-frames with the time of day
const DYNAMIC = [
  { h: 0, p: { bg: ['#050a24', '#10206b', '#2a2a8a', '#4a3f9e'], glow: [['#9fb4ff', 0.3], ['#4a5bd0', 0.28]], r1: [['#0b1450', 0.9], ['#2a1a6a', 0.7]], r2: [['#3a6ad0', 0.55], ['#5a56d8', 0.55], ['#8a56c8', 0.55]], r3: [['#6a5ad0', 0.5], ['#a04ab0', 0.45]], r4: ['#03051a', 0.5] } },
  { h: 5, p: { bg: ['#0a1038', '#1c2a7a', '#3a3a9a', '#6a4a9e'], glow: [['#a0b0ff', 0.3], ['#5a6ae0', 0.28]], r1: [['#101a5a', 0.9], ['#33227a', 0.7]], r2: [['#4a76d8', 0.55], ['#6a62e0', 0.55], ['#9a60d0', 0.55]], r3: [['#7a68d8', 0.5], ['#b052b8', 0.45]], r4: ['#05081e', 0.5] } },
  { h: 6.5, p: { bg: ['#2a2a6e', '#8a4a9e', '#ff7a6a', '#ffc27a'], glow: [['#ffe0b0', 0.6], ['#ff9ab0', 0.35]], r1: [['#4a2a8a', 0.85], ['#9a3a8a', 0.7]], r2: [['#ffb0a0', 0.7], ['#ff8aa0', 0.7], ['#ffd08a', 0.7]], r3: [['#ffd08a', 0.75], ['#ff7a8a', 0.6]], r4: ['#2a1050', 0.4] } },
  { h: 10, p: { bg: ['#3a86e8', '#66b4ff', '#a9dcff', '#f4fbff'], glow: [['#ffffff', 0.55], ['#b0e0ff', 0.4]], r1: [['#4a8ee8', 0.8], ['#7aa8f0', 0.6]], r2: [['#e0f4ff', 0.75], ['#b0d8ff', 0.7], ['#ffffff', 0.7]], r3: [['#ffffff', 0.7], ['#c8e6ff', 0.6]], r4: ['#6a9ad8', 0.3] } },
  { h: 14, p: { bg: ['#2f7be0', '#5ab0ff', '#9fd4ff', '#eaf8ff'], glow: [['#ffffff', 0.6], ['#a0d8ff', 0.4]], r1: [['#3a80e0', 0.8], ['#6aa0f0', 0.6]], r2: [['#d8f0ff', 0.75], ['#a8d4ff', 0.7], ['#ffffff', 0.7]], r3: [['#ffffff', 0.7], ['#bee0ff', 0.6]], r4: ['#5a8ad0', 0.3] } },
  { h: 18, p: { bg: ['#3a3a8a', '#c0508a', '#ff8f4a', '#ffd27a'], glow: [['#ffe2a0', 0.6], ['#ff8a9a', 0.35]], r1: [['#5a2a8a', 0.85], ['#a83a8a', 0.7]], r2: [['#ffb070', 0.7], ['#ff7a9a', 0.7], ['#ffd27a', 0.7]], r3: [['#ffd27a', 0.75], ['#ff6a7a', 0.6]], r4: ['#2a0a40', 0.4] } },
  { h: 20, p: { bg: ['#1a1654', '#5a2a8a', '#d0457a', '#ff8a5e'], glow: [['#ffc0a0', 0.5], ['#8a7aff', 0.3]], r1: [['#2a1a6a', 0.9], ['#6a2a8a', 0.7]], r2: [['#7a7aff', 0.65], ['#c05ad0', 0.65], ['#ff7a9a', 0.65]], r3: [['#ff9a6a', 0.7], ['#d84a8a', 0.6]], r4: ['#10062a', 0.5] } },
  { h: 22, p: { bg: ['#070c2c', '#16287a', '#2e2e8e', '#4e409e'], glow: [['#9fb4ff', 0.3], ['#4a5bd0', 0.28]], r1: [['#0e1654', 0.9], ['#2a1c6e', 0.7]], r2: [['#3a6ad0', 0.55], ['#5a56d8', 0.55], ['#8a56c8', 0.55]], r3: [['#6a5ad0', 0.5], ['#a04ab0', 0.45]], r4: ['#03051a', 0.5] } },
  { h: 24, p: null }, // = h 0
];
DYNAMIC[DYNAMIC.length - 1].p = DYNAMIC[0].p;

export function dynamicPalette(hours) {
  const h = ((hours % 24) + 24) % 24;
  let i = 0;
  while (i < DYNAMIC.length - 2 && h >= DYNAMIC[i + 1].h) i++;
  const a = DYNAMIC[i], b = DYNAMIC[i + 1];
  return lerpPalette(a.p, b.p, smooth(Math.min(1, Math.max(0, (h - a.h) / (b.h - a.h)))));
}

function ribbons(g, w, h, P) {
  const sx = w / 1280, sy = h / 832;
  const bg = g.createLinearGradient(0, 0, w, h);
  [0, 0.42, 0.78, 1].forEach((o, i) => bg.addColorStop(o, P.bg[i]));
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const glow = (cx, cy, rad, [c, a]) => {
    const rg = g.createRadialGradient(cx * sx, cy * sy, 0, cx * sx, cy * sy, rad * sx);
    rg.addColorStop(0, rgba(c, a));
    rg.addColorStop(1, rgba(c, 0));
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
  };
  glow(1040, 170, 300, P.glow[0]);
  glow(180, 120, 340, P.glow[1]);
  const ribbon = (x0, y0, c1x, c1y, c2x, c2y, x1, y1, c4x, c4y, x2, y2, fill) => {
    g.beginPath();
    g.moveTo(x0 * sx, y0 * sy);
    g.bezierCurveTo(c1x * sx, c1y * sy, c2x * sx, c2y * sy, x1 * sx, y1 * sy);
    g.bezierCurveTo((2 * x1 - c2x) * sx, (2 * y1 - c2y) * sy, c4x * sx, c4y * sy, x2 * sx, y2 * sy);
    g.lineTo(1360 * sx, 900 * sy);
    g.lineTo(-60 * sx, 900 * sy);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  const hg = (stops) => {
    const lg = g.createLinearGradient(0, 0, w, 0);
    stops.forEach(([c, a], i) => lg.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), rgba(c, a)));
    return lg;
  };
  ribbon(-60, 560, 200, 360, 460, 720, 760, 520, 1180, 280, 1360, 430, hg(P.r1));
  ribbon(-60, 600, 220, 440, 520, 780, 820, 590, 1160, 400, 1360, 520, hg(P.r2));
  ribbon(-60, 700, 260, 580, 560, 820, 900, 690, 1180, 600, 1360, 690, hg(P.r3));
  ribbon(-60, 770, 300, 700, 620, 840, 960, 760, 1200, 730, 1360, 770, rgba(P.r4[0], P.r4[1]));
}

// ── Aurora: green / violet curtains over a starry sky and a dark ridge ──
function aurora(g, w, h) {
  const sx = w / 1280, sy = h / 832;
  const R = rng(7);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#02040f');
  sky.addColorStop(0.6, '#07142c');
  sky.addColorStop(1, '#0d2a3c');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) { // stars
    g.fillStyle = `rgba(255,255,255,${0.25 + R() * 0.6})`;
    const r = (0.4 + R() * 1.1) * sx;
    g.beginPath();
    g.arc(R() * w, R() * h * 0.7, r, 0, Math.PI * 2);
    g.fill();
  }
  const curtain = (base, amp, phase, c1, c2, topY) => {
    const N = 48;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * 1480 - 100;
      pts.push([x * sx, (base + Math.sin(i * 0.33 + phase) * amp + Math.sin(i * 0.8 + phase * 2) * amp * 0.35) * sy]);
    }
    const lg = g.createLinearGradient(0, topY * sy, 0, (base + amp) * sy);
    lg.addColorStop(0, rgba(c1, 0));
    lg.addColorStop(0.55, rgba(c1, 0.34));
    lg.addColorStop(1, rgba(c2, 0.62));
    g.beginPath();
    g.moveTo(pts[0][0], topY * sy);
    pts.forEach(([x, y]) => g.lineTo(x, y));
    g.lineTo(pts[N][0], topY * sy);
    g.closePath();
    g.fillStyle = lg;
    g.fill();
    // fine vertical rays along the lower edge
    g.lineWidth = 1.2 * sx;
    for (let i = 0; i < 90; i++) {
      const k = Math.floor(R() * N);
      const [x, y] = pts[k];
      const len = (60 + R() * 170) * sy;
      const rg = g.createLinearGradient(0, y - len, 0, y);
      rg.addColorStop(0, rgba(c1, 0));
      rg.addColorStop(1, rgba(c2, 0.28));
      g.strokeStyle = rg;
      g.beginPath();
      g.moveTo(x + (R() - 0.5) * 24 * sx, y - len);
      g.lineTo(x, y);
      g.stroke();
    }
  };
  curtain(430, 70, 0.4, '#38f2a8', '#7bffd0', 60);
  curtain(500, 55, 2.1, '#7b6bff', '#c58bff', 150);
  curtain(380, 60, 4.0, '#2ad4ff', '#7ff0ff', 40);
  // ridge
  g.beginPath();
  g.moveTo(0, h);
  for (let i = 0; i <= 40; i++) g.lineTo((i / 40) * w, (700 + Math.sin(i * 0.5) * 26 + Math.sin(i * 1.3 + 1) * 14) * sy);
  g.lineTo(w, h);
  g.closePath();
  const rg = g.createLinearGradient(0, 640 * sy, 0, h);
  rg.addColorStop(0, '#071a24');
  rg.addColorStop(1, '#02070c');
  g.fillStyle = rg;
  g.fill();
}

// ── Dunes: warm layered sand under a low sun ──
function dunes(g, w, h) {
  const sx = w / 1280, sy = h / 832;
  const sky = g.createLinearGradient(0, 0, 0, h * 0.8);
  [['0', '#2a1b3d'], ['0.35', '#8a3a5e'], ['0.7', '#e0734d'], ['1', '#ffc77a']].forEach(([o, c]) => sky.addColorStop(+o, c));
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  const sun = g.createRadialGradient(880 * sx, 400 * sy, 0, 880 * sx, 400 * sy, 360 * sx);
  sun.addColorStop(0, 'rgba(255,238,190,0.95)');
  sun.addColorStop(0.18, 'rgba(255,214,150,0.5)');
  sun.addColorStop(1, 'rgba(255,170,110,0)');
  g.fillStyle = sun;
  g.fillRect(0, 0, w, h);
  const layer = (y, amp, f, ph, top, bot) => {
    g.beginPath();
    g.moveTo(0, h);
    for (let i = 0; i <= 80; i++) {
      const x = (i / 80) * 1280;
      g.lineTo(x * sx, (y + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.1 + ph * 1.7) * amp * 0.28) * sy);
    }
    g.lineTo(w, h);
    g.closePath();
    const lg = g.createLinearGradient(0, (y - amp) * sy, 0, h);
    lg.addColorStop(0, top);
    lg.addColorStop(1, bot);
    g.fillStyle = lg;
    g.fill();
  };
  layer(470, 40, 0.0048, 0.4, '#f0a070', '#a8503e');
  layer(540, 56, 0.0042, 2.2, '#d9744e', '#7a3040');
  layer(620, 62, 0.0036, 4.1, '#a8483c', '#4a1c3a');
  layer(700, 54, 0.0044, 1.2, '#6a2a3a', '#220e2c');
  layer(770, 40, 0.005, 3.3, '#3a1630', '#120618');
}

// ── Midnight Peaks: layered mountain silhouettes under a moon ──
function midnight(g, w, h) {
  const sx = w / 1280, sy = h / 832;
  const R = rng(21);
  const sky = g.createLinearGradient(0, 0, 0, h);
  [['0', '#070b24'], ['0.5', '#1e1856'], ['1', '#5a3a8a']].forEach(([o, c]) => sky.addColorStop(+o, c));
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.5})`;
    g.beginPath();
    g.arc(R() * w, R() * h * 0.55, (0.4 + R()) * sx, 0, Math.PI * 2);
    g.fill();
  }
  const moon = g.createRadialGradient(300 * sx, 190 * sy, 0, 300 * sx, 190 * sy, 260 * sx);
  moon.addColorStop(0, 'rgba(230,236,255,0.55)');
  moon.addColorStop(0.2, 'rgba(170,185,255,0.22)');
  moon.addColorStop(1, 'rgba(120,130,255,0)');
  g.fillStyle = moon;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#f2f4ff';
  g.beginPath();
  g.arc(300 * sx, 190 * sy, 30 * sx, 0, Math.PI * 2);
  g.fill();
  const ridge = (base, amp, step, top, bot, seed) => {
    const r = rng(seed);
    g.beginPath();
    g.moveTo(0, h);
    let x = -40, up = true, y = base;
    g.lineTo(0, y * sy);
    while (x < 1340) {
      x += step * (0.6 + r() * 0.9);
      y = up ? base - amp * (0.35 + r() * 0.65) : base + amp * (0.1 + r() * 0.35);
      up = !up;
      g.lineTo(x * sx, y * sy);
    }
    g.lineTo(w, h);
    g.closePath();
    const lg = g.createLinearGradient(0, (base - amp) * sy, 0, h);
    lg.addColorStop(0, top);
    lg.addColorStop(1, bot);
    g.fillStyle = lg;
    g.fill();
  };
  ridge(520, 190, 120, '#4a3d8e', '#2a2468', 3);
  ridge(590, 170, 100, '#2f2a72', '#1a1650', 9);
  ridge(660, 150, 90, '#1c1a52', '#0d0c30', 15);
  ridge(740, 120, 80, '#0c0b2a', '#04041a', 27);
}

// ── Mono Gradient: soft graphite light ──
function mono(g, w, h) {
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#5a5e68');
  bg.addColorStop(0.5, '#2a2c32');
  bg.addColorStop(1, '#0c0d10');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const hi = g.createRadialGradient(w * 0.82, h * 0.1, 0, w * 0.82, h * 0.1, w * 0.62);
  hi.addColorStop(0, 'rgba(255,255,255,0.28)');
  hi.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hi;
  g.fillRect(0, 0, w, h);
  const lo = g.createRadialGradient(w * 0.12, h * 0.95, 0, w * 0.12, h * 0.95, w * 0.5);
  lo.addColorStop(0, 'rgba(120,130,170,0.22)');
  lo.addColorStop(1, 'rgba(120,130,170,0)');
  g.fillStyle = lo;
  g.fillRect(0, 0, w, h);
}

/** Paints wallpaper `id` over the whole `w × h` canvas. `hours` (0–24) drives the Dynamic wallpaper. */
export function drawWallpaper(g, w, h, id = DEFAULT_WALLPAPER, hours = 12) {
  switch (id) {
    case 'aurora': return aurora(g, w, h);
    case 'dunes': return dunes(g, w, h);
    case 'ocean': return ribbons(g, w, h, OCEAN);
    case 'midnight': return midnight(g, w, h);
    case 'mono': return mono(g, w, h);
    case 'dynamic': return ribbons(g, w, h, dynamicPalette(hours));
    default: return ribbons(g, w, h, SUNRISE);
  }
}
