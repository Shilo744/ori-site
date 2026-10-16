// "Ori, Can You...?" — the canvas textures of the neighbourhood: stucco, asphalt, paving, lawn, sand and the shop-sign atlas.
// Everything is drawn once with a seeded generator (no files, no network) and released with the world.
import * as THREE from 'three';
import { mulberry32 } from '../rng.js';
import { canvasTexture, noiseFill } from './gfx.js';
import { PLACES } from './content.js';

/** Off-white stucco with a faint floor-slab line; one tile = 4 m x 3.1 m of wall. */
export function wallTexture(aniso) {
  const r = mulberry32(11);
  return canvasTexture(256, 256, (g, w, h) => {
    noiseFill(g, w, h, '#ffffff', 0.12, r, 2);
    g.fillStyle = 'rgba(70,60,50,0.16)';
    g.fillRect(0, h - 5, w, 3); // the slab edge between floors
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(0, h - 2, w, 2);
    for (let i = 0; i < 14; i++) { // faint rain streaks
      g.fillStyle = `rgba(80,70,60,${0.015 + r() * 0.02})`;
      g.fillRect(Math.floor(r() * w), 0, 1 + Math.floor(r() * 2), h);
    }
  }, { repeat: true, aniso });
}

/** Dark asphalt; one tile = 8 m. */
export function asphaltTexture(aniso) {
  const r = mulberry32(12);
  return canvasTexture(256, 256, (g, w, h) => {
    noiseFill(g, w, h, '#ffffff', 0.5, r, 1);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${0.06 + r() * 0.08})`; g.fillRect(r() * w, r() * h, 8 + r() * 30, 1); }
  }, { repeat: true, aniso });
}

/** Paving slabs; one tile = 4 m (2 x 2 slabs). */
export function pavingTexture(aniso) {
  const r = mulberry32(13);
  return canvasTexture(256, 256, (g, w, h) => {
    noiseFill(g, w, h, '#ffffff', 0.18, r, 2);
    g.fillStyle = 'rgba(60,55,50,0.22)';
    g.fillRect(0, 0, w, 3);
    g.fillRect(0, h / 2, w, 2);
    g.fillRect(0, 0, 3, h);
    g.fillRect(w / 2, 0, 2, h);
  }, { repeat: true, aniso });
}

/** Boardwalk planks running along the texture's x; one tile = 4 m. */
export function woodTexture(aniso) {
  const r = mulberry32(16);
  return canvasTexture(256, 256, (g, w, h) => {
    const rows = 8;
    for (let i = 0; i < rows; i++) {
      const v = 0.78 + r() * 0.22;
      g.fillStyle = `rgb(${Math.round(206 * v)},${Math.round(168 * v)},${Math.round(122 * v)})`;
      g.fillRect(0, (i * h) / rows, w, h / rows - 1);
      for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(90,60,30,${0.05 + r() * 0.06})`; g.fillRect(r() * w, (i * h) / rows + r() * (h / rows), 20 + r() * 60, 1); }
      g.fillStyle = 'rgba(60,40,20,0.35)';
      g.fillRect(Math.floor(r() * w), (i * h) / rows, 2, h / rows);
    }
  }, { repeat: true, aniso });
}

export function lawnTexture(aniso) {
  const r = mulberry32(14);
  return canvasTexture(256, 256, (g, w, h) => {
    noiseFill(g, w, h, '#ffffff', 0.45, r, 2);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(30,70,20,${0.08 + r() * 0.1})`; g.fillRect(r() * w, r() * h, 1, 2 + r() * 3); }
  }, { repeat: true, aniso });
}

export function sandTexture(aniso) {
  const r = mulberry32(15);
  return canvasTexture(256, 256, (g, w, h) => {
    noiseFill(g, w, h, '#ffffff', 0.3, r, 1);
    for (let i = 0; i < 18; i++) { g.strokeStyle = `rgba(120,95,50,${0.05 + r() * 0.05})`; g.beginPath(); g.moveTo(r() * w, r() * h); g.bezierCurveTo(r() * w, r() * h, r() * w, r() * h, r() * w, r() * h); g.stroke(); }
  }, { repeat: true, aniso });
}

const CELL = { w: 512, h: 128, cols: 4 };
const luminance = (hex) => { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };

/** One atlas with every place's shop sign: `uv(id)` gives the four UV corners [u0, v0, u1, v1] of its cell. */
export function signAtlas(aniso) {
  const ids = Object.keys(PLACES);
  const rows = Math.ceil(ids.length / CELL.cols);
  const W = CELL.w * CELL.cols;
  const H = CELL.h * rows;
  const tex = canvasTexture(W, H, (g) => {
    g.clearRect(0, 0, W, H);
    ids.forEach((id, i) => {
      const x = (i % CELL.cols) * CELL.w;
      const y = Math.floor(i / CELL.cols) * CELL.h;
      const tone = PLACES[id].tone;
      g.fillStyle = tone;
      g.beginPath();
      g.roundRect(x + 6, y + 6, CELL.w - 12, CELL.h - 12, 22);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.beginPath();
      g.roundRect(x + 6, y + 6, CELL.w - 12, (CELL.h - 12) / 2, 22);
      g.fill();
      g.fillStyle = luminance(tone) > 0.55 ? '#1d1d1f' : '#ffffff';
      let size = 64;
      g.font = `800 ${size}px Inter, "SF Pro Display", system-ui, sans-serif`;
      const text = PLACES[id].sign;
      while (g.measureText(text).width > CELL.w - 60 && size > 22) { size -= 3; g.font = `800 ${size}px Inter, "SF Pro Display", system-ui, sans-serif`; }
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, x + CELL.w / 2, y + CELL.h / 2 + 3);
    });
  }, { aniso });
  const uv = (id) => {
    const i = ids.indexOf(id);
    const cx = (i % CELL.cols) * CELL.w;
    const cy = Math.floor(i / CELL.cols) * CELL.h;
    // canvas y runs down, texture v runs up
    return [cx / W, 1 - (cy + CELL.h) / H, (cx + CELL.w) / W, 1 - cy / H];
  };
  return { tex, uv, ids };
}
