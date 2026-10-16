// Procedural canvas textures — no external assets needed.
import * as THREE from 'three';
import { drawWallpaper } from '../core/wallpapers.js';

const rng = (seed) => {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { repeat, aniso = 8, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Oak / wood grain. `planks` > 0 gives floorboards that run along U. */
export function woodTexture({ base, dark, light, planks = 0, seed = 1, size = 1024, repeat, aniso }) {
  const [c, g] = canvas(size, size);
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);

  const plankH = planks ? size / planks : size;
  if (planks) {
    for (let p = 0; p < planks; p++) {
      g.globalAlpha = 0.18 + r() * 0.22;
      g.fillStyle = r() > 0.5 ? light : dark;
      g.fillRect(0, p * plankH, size, plankH);
    }
    g.globalAlpha = 1;
  }

  for (let i = 0; i < 1100; i++) {
    const x = r() * size, y = r() * size, len = 100 + r() * 560;
    const c1 = (r() - 0.5) * 4, c2 = (r() - 0.5) * 4, c3 = (r() - 0.5) * 3;
    g.globalAlpha = 0.03 + r() * 0.085;
    g.strokeStyle = r() > 0.45 ? dark : light;
    g.lineWidth = 0.6 + r() * 1.7;
    for (const dx of [0, -size]) {
      g.beginPath();
      g.moveTo(x + dx, y);
      g.bezierCurveTo(x + dx + len * 0.33, y + c1, x + dx + len * 0.66, y + c2, x + dx + len, y + c3);
      g.stroke();
    }
  }
  g.globalAlpha = 1;

  if (planks) {
    for (let p = 0; p < planks; p++) {
      const y0 = p * plankH;
      g.fillStyle = 'rgba(40,24,10,0.38)';
      g.fillRect(0, y0, size, 2);
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.fillRect(0, y0 + 2, size, 1.5);
      const joints = 1 + Math.floor(r() * 2);
      for (let j = 0; j < joints; j++) {
        const x = r() * size;
        g.fillStyle = 'rgba(40,24,10,0.32)';
        g.fillRect(x, y0, 2, plankH);
      }
    }
  }
  return toTexture(c, { repeat, aniso });
}

/** Soft elliptical contact shadow (RGBA, black). */
export function blobShadowTexture(opacity = 0.55) {
  const [c, g] = canvas(256, 256);
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, `rgba(0,0,0,${opacity})`);
  grd.addColorStop(0.45, `rgba(0,0,0,${opacity * 0.55})`);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return toTexture(c, { srgb: false });
}

/** Soft rounded-rect shadow. */
export function rectShadowTexture({ opacity = 0.5, inset = 0.2, radius = 0.05, blur = 0.12 } = {}) {
  const size = 256;
  const [c, g] = canvas(size, size);
  const off = size * 2;
  g.shadowColor = `rgba(0,0,0,${opacity})`;
  g.shadowBlur = size * blur;
  g.shadowOffsetX = off;
  g.fillStyle = '#000';
  roundRect(g, -off + size * inset, size * inset, size * (1 - 2 * inset), size * (1 - 2 * inset), size * radius);
  g.fill();
  return toTexture(c, { srgb: false });
}

/** Round wool rug: cream pile with a soft sage border. Maps planar onto a CircleGeometry. */
export function rugTexture() {
  const size = 1024;
  const [c, g] = canvas(size, size);
  const r = rng(7);
  g.fillStyle = '#e9e3d6';
  g.fillRect(0, 0, size, size);
  // pile: tiny strokes in two directions, light and dark
  for (let i = 0; i < 26000; i++) {
    const x = r() * size, y = r() * size, a = r() * Math.PI;
    g.strokeStyle = r() > 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(110,96,76,0.13)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * (3 + r() * 5), y + Math.sin(a) * (3 + r() * 5));
    g.stroke();
  }
  const ring = (rad, w, col) => {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.beginPath();
    g.arc(size / 2, size / 2, rad, 0, Math.PI * 2);
    g.stroke();
  };
  ring(size * 0.4, 46, 'rgba(147,160,140,0.55)');
  ring(size * 0.4, 34, 'rgba(160,172,152,0.7)');
  ring(size * 0.325, 4, 'rgba(120,108,88,0.45)');
  // soft clipping of the corners so the square texture never shows past the disc
  return toTexture(c);
}

/** Fine grey felt / acoustic panel. */
export function feltTexture({ aniso = 8 } = {}) {
  const size = 512;
  const [c, g] = canvas(size, size);
  const r = rng(31);
  g.fillStyle = '#e4e0d8';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 14000; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.28)' : 'rgba(90,80,66,0.10)';
    g.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2);
  }
  return toTexture(c, { aniso, repeat: [1, 1] });
}

/**
 * Painted plaster with baked ambient occlusion: darker toward the floor, toward the inner
 * corner (left edge when `corner === 'left'`, right edge otherwise) and a touch under the ceiling.
 */
export function wallTexture({ corner = 'left', aniso = 8 } = {}) {
  const W = 1024, H = 540;
  const [c, g] = canvas(W, H);
  const r = rng(corner === 'left' ? 5 : 11);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  // large soft mottling
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = r() * H, rad = 60 + r() * 200;
    const rg = g.createRadialGradient(x, y, 0, x, y, rad);
    rg.addColorStop(0, `rgba(${r() > 0.5 ? '255,250,240' : '170,170,180'},${0.025 + r() * 0.035})`);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // grain
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(110,100,92,0.05)';
    g.fillRect(r() * W, r() * H, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  // floor AO (canvas bottom = wall base)
  const fl = g.createLinearGradient(0, H, 0, H - H * 0.26);
  fl.addColorStop(0, 'rgba(70,62,54,0.22)');
  fl.addColorStop(1, 'rgba(70,62,54,0)');
  g.fillStyle = fl;
  g.fillRect(0, H * 0.7, W, H * 0.3);
  // ceiling AO
  const ce = g.createLinearGradient(0, 0, 0, H * 0.14);
  ce.addColorStop(0, 'rgba(70,62,54,0.16)');
  ce.addColorStop(1, 'rgba(70,62,54,0)');
  g.fillStyle = ce;
  g.fillRect(0, 0, W, H * 0.14);
  // corner AO
  const x0 = corner === 'left' ? 0 : W, x1 = corner === 'left' ? W * 0.14 : W * 0.86;
  const co = g.createLinearGradient(x0, 0, x1, 0);
  co.addColorStop(0, 'rgba(70,62,54,0.22)');
  co.addColorStop(1, 'rgba(70,62,54,0)');
  g.fillStyle = co;
  g.fillRect(corner === 'left' ? 0 : W * 0.86, 0, W * 0.14, H);
  return toTexture(c, { aniso });
}

/** Abstract poster artwork. kind: 0 | 1 | 2 */
export function posterTexture(kind = 0) {
  const w = 512, h = 700;
  const [c, g] = canvas(w, h);
  const pal = [
    ['#f1e8da', '#c4673f', '#2c3e50', '#e7b86a'],
    ['#e9ecef', '#1f2a36', '#d86b4b', '#9bb59a'],
    ['#f6efe4', '#7a9a86', '#e4a87a', '#35424f'],
  ][kind % 3];
  g.fillStyle = pal[0];
  g.fillRect(0, 0, w, h);
  if (kind % 3 === 0) {
    g.fillStyle = pal[1];
    g.beginPath(); g.arc(w / 2, 300, 150, Math.PI, 0); g.lineTo(w / 2 + 150, 520); g.lineTo(w / 2 - 150, 520); g.closePath(); g.fill();
    g.fillStyle = pal[3];
    g.beginPath(); g.arc(w / 2, 250, 70, 0, Math.PI * 2); g.fill();
    g.fillStyle = pal[2];
    g.fillRect(70, 560, w - 140, 14);
  } else if (kind % 3 === 1) {
    g.fillStyle = pal[3];
    g.fillRect(0, 380, w, 320);
    g.fillStyle = pal[2];
    g.beginPath(); g.arc(150, 250, 110, 0, Math.PI * 2); g.fill();
    g.fillStyle = pal[1];
    g.fillRect(250, 120, 160, 420);
    g.fillStyle = pal[0];
    g.beginPath(); g.arc(330, 220, 48, 0, Math.PI * 2); g.fill();
  } else {
    for (let i = 0; i < 5; i++) {
      g.fillStyle = [pal[1], pal[2], pal[3], pal[1], pal[2]][i];
      g.globalAlpha = 0.9;
      g.beginPath();
      g.arc(120 + i * 70, 140 + i * 95, 90 - i * 8, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  return toTexture(c);
}

/* ───────── Apple-store style materials & device screens ───────── */

/** Pale large-format stone floor, 60 × 120 cm tiles in a running bond. One texture = 120 × 120 cm. */
export function stoneTexture({ repeat, aniso = 8 } = {}) {
  const size = 1024;
  const [c, g] = canvas(size, size);
  const r = rng(77);
  g.fillStyle = '#e7e3db';
  g.fillRect(0, 0, size, size);

  // per-tile tint: column 0 = one 60×120 tile, column 1 = two 60×60 halves (offset)
  const tiles = [
    [0, 0, size / 2, size],
    [size / 2, 0, size / 2, size / 2],
    [size / 2, size / 2, size / 2, size / 2],
  ];
  tiles.forEach(([x, y, w, h]) => {
    const v = 0.5 + r() * 0.5;
    g.fillStyle = `rgba(${v > 0.75 ? '255,255,255' : '90,90,100'},${0.03 + r() * 0.05})`;
    g.fillRect(x, y, w, h);
  });
  // fine speckle
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(60,60,70,0.06)';
    g.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2);
  }
  // seams
  g.fillStyle = 'rgba(120,120,128,0.55)';
  g.fillRect(0, 0, 2, size);                 // column 0 left edge
  g.fillRect(size / 2 - 1, 0, 2, size);      // column seam
  g.fillRect(size / 2, 0, size / 2, 2);      // col 1 top
  g.fillRect(size / 2, size / 2 - 1, size / 2, 2); // col 1 middle
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(2, 0, 1.5, size);
  g.fillRect(size / 2 + 1, 0, 1.5, size);
  return toTexture(c, { repeat, aniso });
}

/** The macOS wallpaper as a framed art piece for the wall. */
export function wallArtTexture(id = 'sunrise', hours = 12) {
  const [c, g] = canvas(1280, 832);
  drawWallpaper(g, 1280, 832, id, hours);
  return toTexture(c);
}

/** iPhone lock screen (alpha-cut rounded rect so it matches the frame). 7.15 × 14.67 cm */
export function phoneScreenTexture() {
  const W = 512, H = Math.round(512 * 14.67 / 7.15);
  const [c, g] = canvas(W, H);
  g.fillStyle = '#050506';
  roundRect(g, 0, 0, W, H, 66);
  g.fill();
  g.save();
  roundRect(g, 14, 14, W - 28, H - 28, 54);
  g.clip();
  drawWallpaper(g, W, H);
  g.restore();
  g.textAlign = 'center';
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.font = '600 30px Inter, Arial, sans-serif';
  g.fillText('Thursday, October 15', W / 2, 190);
  g.fillStyle = '#fff';
  g.font = '600 168px Inter, Arial, sans-serif';
  g.fillText('9:41', W / 2, 340);
  // dynamic island + home indicator + lock-screen buttons
  g.fillStyle = '#000';
  roundRect(g, W / 2 - 62, 34, 124, 38, 19);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)';
  roundRect(g, W / 2 - 70, H - 36, 140, 6, 3);
  g.fill();
  g.fillStyle = 'rgba(20,20,30,0.45)';
  g.beginPath(); g.arc(70, H - 100, 34, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(W - 70, H - 100, 34, 0, Math.PI * 2); g.fill();
  return toTexture(c);
}

/** iPad home screen. 24.76 × 17.85 cm (landscape). */
export function padScreenTexture() {
  const W = 1024, H = Math.round(1024 * 17.85 / 24.76);
  const [c, g] = canvas(W, H);
  g.fillStyle = '#050506';
  roundRect(g, 0, 0, W, H, 30);
  g.fill();
  g.save();
  roundRect(g, 20, 20, W - 40, H - 40, 16);
  g.clip();
  drawWallpaper(g, W, H);
  // app icons
  const cols = 6, rows = 4, s = 82, gx = (W - 40 - cols * s) / (cols + 1), top = 120;
  const hues = [210, 4, 130, 45, 280, 190, 25, 330, 160, 230, 60, 350, 100, 300, 15, 200, 140, 40, 260, 180, 0, 90, 320, 220];
  for (let r2 = 0; r2 < rows; r2++) {
    for (let c2 = 0; c2 < cols; c2++) {
      const x = 20 + gx + c2 * (s + gx), y = top + r2 * (s + 54);
      const hue = hues[r2 * cols + c2];
      const lg = g.createLinearGradient(0, y, 0, y + s);
      lg.addColorStop(0, `hsl(${hue} 85% 66%)`);
      lg.addColorStop(1, `hsl(${hue} 80% 48%)`);
      g.fillStyle = lg;
      roundRect(g, x, y, s, s, s * 0.225);
      g.fill();
    }
  }
  // dock
  g.fillStyle = 'rgba(255,255,255,0.22)';
  roundRect(g, W / 2 - 220, H - 130, 440, 96, 30);
  g.fill();
  for (let i = 0; i < 5; i++) {
    g.fillStyle = `hsl(${[210, 130, 45, 4, 280][i]} 80% 58%)`;
    roundRect(g, W / 2 - 200 + i * 82 + 8, H - 118, 66, 66, 15);
    g.fill();
  }
  g.restore();
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.font = '600 20px Inter, Arial, sans-serif';
  g.textAlign = 'left';
  g.fillText('9:41', 56, 52);
  return toTexture(c);
}
