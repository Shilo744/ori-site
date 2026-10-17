// "Ori, Can You...?" — the painted signs of the neighbourhood on ONE canvas atlas: the named places and the ordinary shops (English on top, a little Hebrew
// underneath). `uv(id)` gives the four UV corners of a cell. Drawn once in code, released with the world.
import * as THREE from 'three';
import { canvasTexture } from './gfx.js';
import { PLACES } from './content.js';

const CELL = { w: 512, h: 128, cols: 4 };
const luminance = (hex) => { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };
const FONT = (size) => `800 ${size}px Inter, "SF Pro Display", system-ui, sans-serif`;

/** The signs of the ordinary shops along the streets. */
export const SHOP_SIGNS = [
  { id: 'shop-bread', sign: 'FRESH BREAD', sub: 'מאפייה', tone: '#c98a4b' },
  { id: 'shop-flowers', sign: 'FLOWERS', sub: 'פרחים', tone: '#d86c9a' },
  { id: 'shop-pharma', sign: 'PHARMA+', sub: 'בית מרקחת', tone: '#2f9e8f' },
  { id: 'shop-market', sign: 'MINI MARKET', sub: 'מכולת', tone: '#e0a22f' },
  { id: 'shop-falafel', sign: 'FALAFEL', sub: 'פלאפל', tone: '#d9772b' },
  { id: 'shop-barber', sign: 'BARBER', sub: 'מספרה', tone: '#3a5a8c' },
  { id: 'shop-shoes', sign: 'SHOE SHACK', sub: 'נעליים', tone: '#7a5ab8' },
  { id: 'shop-bikes', sign: 'BIKE FIX', sub: 'אופניים', tone: '#4a9ad0' },
  { id: 'shop-ice', sign: 'ICE CREAM', sub: 'גלידה', tone: '#e58aa8' },
  { id: 'shop-books', sign: 'BOOKS', sub: 'ספרים', tone: '#6b8f5e' },
];

export function signAtlas(aniso) {
  const entries = [...Object.keys(PLACES).map((id) => ({ id, sign: PLACES[id].sign, sub: '', tone: PLACES[id].tone })), ...SHOP_SIGNS];
  const ids = entries.map((e) => e.id);
  const rows = Math.ceil(ids.length / CELL.cols);
  const W = CELL.w * CELL.cols;
  const H = CELL.h * rows;
  const tex = canvasTexture(W, H, (g) => {
    g.clearRect(0, 0, W, H);
    entries.forEach((e, i) => {
      const x = (i % CELL.cols) * CELL.w;
      const y = Math.floor(i / CELL.cols) * CELL.h;
      g.fillStyle = e.tone;
      g.beginPath();
      g.roundRect(x + 6, y + 6, CELL.w - 12, CELL.h - 12, 22);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.14)';
      g.beginPath();
      g.roundRect(x + 6, y + 6, CELL.w - 12, (CELL.h - 12) / 2, 22);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.45)';
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(x + 13, y + 13, CELL.w - 26, CELL.h - 26, 17);
      g.stroke();
      g.fillStyle = luminance(e.tone) > 0.55 ? '#1d1d1f' : '#ffffff';
      let size = e.sub ? 52 : 64;
      g.font = FONT(size);
      while (g.measureText(e.sign).width > CELL.w - 60 && size > 22) { size -= 3; g.font = FONT(size); }
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(e.sign, x + CELL.w / 2, y + CELL.h / 2 + (e.sub ? -10 : 3));
      if (e.sub) {
        g.font = '600 26px "Segoe UI", Arial, sans-serif';
        g.globalAlpha = 0.85;
        g.fillText(e.sub, x + CELL.w / 2, y + CELL.h / 2 + 30);
        g.globalAlpha = 1;
      }
    });
  }, { aniso });
  const uv = (id) => {
    const i = ids.indexOf(id);
    const cx = (i % CELL.cols) * CELL.w;
    const cy = Math.floor(i / CELL.cols) * CELL.h;
    return [cx / W, 1 - (cy + CELL.h) / H, (cx + CELL.w) / W, 1 - cy / H]; // (canvas y runs down, texture v runs up)
  };
  return { tex, uv, ids };
}
