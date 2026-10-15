// Procedural textures for the MacBook: brushed aluminium, the deck (speaker grilles) and the keycap legend atlas.
import * as THREE from 'three';

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

/** Fine horizontal brush strokes (grey). Drawn wrapped so the texture tiles seamlessly along U. */
function paintBrushed(g, w, h, seed, strength = 1) {
  const r = rng(seed);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, w, h);
  const n = Math.round((w * h) / 150);
  for (let i = 0; i < n; i++) {
    const y = r() * h;
    const x = r() * w;
    const len = 30 + r() * w * 0.7;
    const light = r() > 0.5;
    g.strokeStyle = light ? `rgba(255,255,255,${(0.04 + r() * 0.1) * strength})` : `rgba(0,0,0,${(0.05 + r() * 0.11) * strength})`;
    g.lineWidth = 0.5 + r() * 0.9;
    for (const dx of [0, -w]) {
      g.beginPath();
      g.moveTo(x + dx, y);
      g.lineTo(x + dx + len, y + (r() - 0.5) * 0.6);
      g.stroke();
    }
  }
}

/** One grey texture used as roughnessMap + bumpMap on the aluminium shell (tiles; set `repeat` per mesh). */
export function brushedTexture({ seed = 7, aniso = 8 } = {}) {
  const [c, g] = canvas(512, 512);
  paintBrushed(g, 512, 512, seed);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

/** Deck plate maps: silver colour + a bump map; speaker grilles (tiny holes) in the margins either side of the keyboard. */
export function deckTextures({ w, d, kbHalfW, kbTop, kbBottom, aniso = 8 }) {
  const PX = 34; // px per cm
  const W = Math.round(w * PX), H = Math.round(d * PX);
  const [cc, g] = canvas(W, H);
  const [bc, b] = canvas(W, H);

  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#d9dbe0');
  grd.addColorStop(1, '#ccced3');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  paintBrushed(b, W, H, 21, 0.9);

  // grilles: 3 columns of holes each side, z range along the keyboard, in deck coordinates (0,0 = plate centre)
  const px = (x) => (x + w / 2) * PX, pz = (z) => (z + d / 2) * PX;
  const cols = [0.30, 0.62, 0.94];
  const pitch = 0.2;
  for (const side of [-1, 1]) {
    for (let ci = 0; ci < cols.length; ci++) {
      const x = side * (kbHalfW + cols[ci]);
      const off = ci % 2 ? pitch / 2 : 0;
      for (let z = kbTop + 0.2 + off; z < kbBottom - 0.2; z += pitch) {
        g.fillStyle = '#26282c';
        g.beginPath();
        g.arc(px(x), pz(z), 0.062 * PX, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.beginPath();
        g.arc(px(x), pz(z) + 0.05 * PX, 0.04 * PX, 0, Math.PI * 2);
        g.fill();
        b.fillStyle = '#000';
        b.beginPath();
        b.arc(px(x), pz(z), 0.075 * PX, 0, Math.PI * 2);
        b.fill();
      }
    }
  }

  const map = new THREE.CanvasTexture(cc);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = aniso;
  const bump = new THREE.CanvasTexture(bc);
  bump.anisotropy = aniso;
  return { map, bump };
}

// ───────────────────────── keycap legends ─────────────────────────
const KEY_BG = '#17181b';
const FG = '#eceef3';
const FONT = 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif';

/** Draws one key's legend into the cell (x, y, w, h) of the atlas. */
function drawLegend(g, k, x, y, w, h) {
  g.fillStyle = KEY_BG;
  g.fillRect(x, y, w, h);
  const L = k.legend || {};
  g.fillStyle = FG;
  g.strokeStyle = FG;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const cx = x + w / 2, cy = y + h / 2;
  const f = (px, wgt = 500) => { g.font = `${wgt} ${Math.round(px)}px ${FONT}`; };

  if (L.arrow) {
    const s = h * 0.17;
    g.beginPath();
    const [dx, dy] = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[L.arrow];
    g.moveTo(cx + dx * s * 1.1, cy + dy * s * 1.1);
    g.lineTo(cx - dx * s * 0.9 + dy * s * 1.1, cy - dy * s * 0.9 + dx * s * 1.1);
    g.lineTo(cx - dx * s * 0.9 - dy * s * 1.1, cy - dy * s * 0.9 - dx * s * 1.1);
    g.closePath();
    g.fill();
    return;
  }
  if (L.touchId) {
    g.lineWidth = Math.max(1.5, h * 0.045);
    g.beginPath();
    g.arc(cx, cy, h * 0.27, 0, Math.PI * 2);
    g.stroke();
    return;
  }
  if (L.mod) {
    // modifier: symbol on top, word below (command ⌘ / option ⌥ / control ⌃ / fn 🌐 drawn as text)
    f(h * 0.3, 400);
    g.fillText(L.sym, cx, cy - h * 0.14);
    f(h * 0.17, 500);
    g.fillText(L.mod, cx, cy + h * 0.24);
    return;
  }
  if (L.word) {
    // wide word keys: left- or right-aligned small caption in the lower corner (tab, caps lock, delete, return, shift)
    f(h * 0.2, 500);
    g.textAlign = L.align === 'right' ? 'right' : 'left';
    const pad = h * 0.14;
    g.fillText(L.word, L.align === 'right' ? x + w - pad : x + pad, y + h - h * 0.24);
    if (L.dot) {
      g.beginPath();
      g.arc(x + pad + h * 0.04, y + h * 0.26, h * 0.045, 0, Math.PI * 2);
      g.fill();
    }
    return;
  }
  if (L.fn) {
    f(h * 0.23, 500);
    g.fillText(L.fn, cx, cy);
    return;
  }
  if (L.top) {
    f(h * 0.31, 500);
    g.fillText(L.top, cx, cy - h * 0.21);
    f(h * 0.34, 500);
    g.fillText(L.main, cx, cy + h * 0.2);
    return;
  }
  f(h * (L.main && L.main.length > 1 ? 0.22 : 0.42), 500);
  g.fillText(L.main || '', cx, cy + h * 0.02);
}

/**
 * Packs one cell per key (sized to the key's flat top) into a single atlas and paints the legends.
 * Returns { texture, rect(i) → [u0, v0, du, dv] for key i, black → [u, v] of a plain black pixel, redraw() }.
 */
export function legendAtlas(keys, { inset = 0.17, pxPerCm = 60, aniso = 8 } = {}) {
  const AW = 1024, AH = 1024, PAD = 3;
  const [c, g] = canvas(AW, AH);
  const cells = [];
  let x = PAD, y = PAD, rowH = 0;
  keys.forEach((k, i) => {
    // the cell matches the key's flat top (cap size minus the rounded-over edge on both sides)
    const w = Math.max(16, Math.round((k.w - inset) * pxPerCm));
    const h = Math.max(16, Math.round((k.d - inset) * pxPerCm));
    if (x + w + PAD > AW) { x = PAD; y += rowH + PAD; rowH = 0; }
    cells[i] = { x, y, w, h };
    x += w + PAD;
    rowH = Math.max(rowH, h);
  });
  if (y + rowH + PAD > AH - 8) console.warn('[macbook] legend atlas is full');
  const rects = cells.map((cl) => [cl.x / AW, 1 - (cl.y + cl.h) / AH, cl.w / AW, cl.h / AH]);

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = aniso;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;

  const paint = () => {
    g.fillStyle = KEY_BG;
    g.fillRect(0, 0, AW, AH);
    keys.forEach((k, i) => drawLegend(g, k, cells[i].x, cells[i].y, cells[i].w, cells[i].h));
    texture.needsUpdate = true;
  };
  paint();
  // web fonts load asynchronously: repaint once Inter is available so the legends use it
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('500 24px Inter'), document.fonts.load('400 24px Inter')]).then(paint).catch(() => {});
  }
  return { texture, rects, black: [0.5, 0.004], redraw: paint };
}
