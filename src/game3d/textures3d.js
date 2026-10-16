// NEON DRIFT — procedural textures. The canvases are painted ONCE per page (CPU side, cached by key); every session gets its own
// THREE textures from them (cheap upload) and disposes them on quit, so a quit leaves no GPU memory behind.
import * as THREE from 'three';
import { mulberry32 } from './rng.js';

const canvases = new Map();
function paintOnce(key, w, h, draw) {
  let c = canvases.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    canvases.set(key, c);
  }
  return c;
}

function makeTexture(canvas, { srgb = true, repeat = true, aniso = 1, mip = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.generateMipmaps = mip;
  t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  return t;
}

/** Wrap-around blob so a texture tiles: draws the shape at the 9 offsets that can touch the tile. */
function wrapDraw(w, h, x, y, r, fn) {
  for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
    if (x + ox + r < 0 || x + ox - r > w || y + oy + r < 0 || y + oy - r > h) continue;
    fn(x + ox, y + oy);
  }
}

function grain(ctx, w, h, amount, rnd) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// ── asphalt: grey with grain, soft blotches, patches, cracks, bright aggregate ──
function paintAsphalt(ctx, w, h) {
  const rnd = mulberry32(1337);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 30 + rnd() * 90;
    const dark = rnd() < 0.55;
    wrapDraw(w, h, x, y, r, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, dark ? 'rgba(40,40,40,0.22)' : 'rgba(200,200,200,0.16)');
      g.addColorStop(1, 'rgba(128,128,128,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
  for (let i = 0; i < 14; i++) { // repaired patches
    const x = rnd() * w;
    const y = rnd() * h;
    const pw = 40 + rnd() * 110;
    const ph = 16 + rnd() * 60;
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? '60,60,60' : '170,170,170'},0.14)`;
    ctx.fillRect(x, y, pw, ph);
  }
  grain(ctx, w, h, 46, rnd);
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) { // cracks
    let x = rnd() * w;
    let y = rnd() * h;
    ctx.strokeStyle = `rgba(20,20,20,${0.25 + rnd() * 0.3})`;
    ctx.lineWidth = 0.6 + rnd() * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    let a = rnd() * 6.28;
    for (let k = 0; k < 14; k++) {
      a += (rnd() - 0.5) * 1.1;
      x += Math.cos(a) * (6 + rnd() * 10);
      y += Math.sin(a) * (6 + rnd() * 10);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 700; i++) { // pale chips
    ctx.fillStyle = `rgba(255,255,255,${0.1 + rnd() * 0.25})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.4, 1 + rnd() * 1.4);
  }
}
export const asphaltTexture = (aniso) => makeTexture(paintOnce('asphalt', 512, 512, paintAsphalt), { aniso });

// ── building windows: an 8x8 grid of cells, ~40 % lit ──
function paintWindows(ctx, w, h) {
  const rnd = mulberry32(77);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  const cell = w / 8;
  for (let cy = 0; cy < 8; cy++) {
    for (let cx = 0; cx < 8; cx++) {
      const lit = rnd() < 0.3;
      const v = lit ? 110 + rnd() * 120 : 3 + rnd() * 6;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(cx * cell + cell * 0.2, cy * cell + cell * 0.22, cell * 0.6, cell * 0.5);
    }
  }
}
export const windowTexture = (aniso) => makeTexture(paintOnce('windows', 128, 128, paintWindows), { aniso, srgb: false });

// ── neon signs: 4x2 atlas of 128 px cells ──
const SIGNS = [
  ['NEON', '#19e3ff'], ['DRIFT', '#ff3ea5'], ['OPEN', '#ffd84a'], ['HOTEL', '#8f7bff'],
  ['RAMEN', '#ff6a3d'], ['ARCADE', '#3effa8'], ['24H', '#ff3ea5'], ['SYNTH', '#19e3ff'],
];
function paintSigns(ctx, w, h) {
  ctx.fillStyle = '#05030c';
  ctx.fillRect(0, 0, w, h);
  SIGNS.forEach(([text, color], i) => {
    const x = (i % 4) * 128;
    const y = Math.floor(i / 4) * 128;
    ctx.save();
    ctx.translate(x + 64, y + 64);
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(-54, -34, 108, 68);
    ctx.fillStyle = '#fff';
    ctx.font = '800 italic 30px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 2);
    ctx.shadowBlur = 24;
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 2);
    ctx.restore();
  });
}
export const signTexture = (aniso) => makeTexture(paintOnce('signs', 512, 256, paintSigns), { aniso, repeat: false });

// ── ground tiles ──
function paintGrid(ctx, w, h) {
  ctx.fillStyle = '#0b0720';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
  ctx.stroke();
}
export const gridTexture = (aniso) => makeTexture(paintOnce('grid', 256, 256, paintGrid), { aniso });

function paintSand(ctx, w, h) {
  const rnd = mulberry32(404);
  ctx.fillStyle = '#b0b0b0';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 40 + rnd() * 120;
    const dark = rnd() < 0.5;
    wrapDraw(w, h, x, y, r, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, dark ? 'rgba(90,90,90,0.25)' : 'rgba(255,255,255,0.25)');
      g.addColorStop(1, 'rgba(176,176,176,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - r, py - r, r * 2, r * 2);
    });
  }
  ctx.strokeStyle = 'rgba(80,60,40,0.12)'; // wind ripples
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 80; i++) {
    const y = rnd() * h;
    const x = rnd() * w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 30, y - 6, x + 60, y + 6, x + 90, y);
    ctx.stroke();
  }
  grain(ctx, w, h, 30, rnd);
}
export const sandTexture = (aniso) => makeTexture(paintOnce('sand', 512, 512, paintSand), { aniso });

/** A soft radial sprite (white centre -> transparent) used for glows, headlight pools and shadows. */
export function glowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.25)') {
  const key = `glow:${inner}:${mid}`;
  const c = paintOnce(key, 128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
    g.addColorStop(0, inner);
    g.addColorStop(0.35, mid);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
  return makeTexture(c, { repeat: false, mip: false });
}

/** A vertical gradient strip (alpha fades towards the end): the volume of a headlight beam. */
export function beamTexture() {
  const c = paintOnce('beam', 16, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  return makeTexture(c, { repeat: false, mip: false });
}

export const SIGN_COUNT = SIGNS.length;
