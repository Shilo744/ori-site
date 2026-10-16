// More procedural textures for the props (T12): leaf veins, HomePod mesh fabric, photo prints, lamp glow, a richer rug.
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
function tex(c, { srgb = true, repeat, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

/** Greyscale leaf: pale midrib + side veins on white (tinted by the material colour). UV: u across, v from stem (0) to tip (1). */
export function leafTexture() {
  const W = 128, H = 256;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#f4f4f4';
  g.fillRect(0, 0, W, H);
  g.lineCap = 'round';
  // midrib
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 5;
  g.beginPath(); g.moveTo(W / 2, H); g.lineTo(W / 2, 14); g.stroke();
  // side veins
  g.strokeStyle = 'rgba(205,215,205,0.95)';
  g.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const y = H - 22 - i * 18;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(W / 2, y);
      g.quadraticCurveTo(W / 2 + s * 24, y - 12, W / 2 + s * 52, y - 30);
      g.stroke();
    }
  }
  // soft darker edge
  const grd = g.createRadialGradient(W / 2, H / 2, W * 0.18, W / 2, H / 2, H * 0.62);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(60,70,60,0.28)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  return tex(c);
}

/** HomePod mesh fabric: a fine knit grid (colour + bump in one — also used as the bump map). */
export function meshFabricTexture() {
  const S = 256;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#e9e9ec';
  g.fillRect(0, 0, S, S);
  const n = 32, p = S / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const cx = (x + 0.5 + (y % 2) * 0.5) * p, cy = (y + 0.5) * p;
      g.fillStyle = 'rgba(70,72,80,0.55)';
      g.beginPath();
      g.ellipse(cx, cy, p * 0.2, p * 0.2, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.beginPath();
      g.ellipse(cx - p * 0.12, cy - p * 0.12, p * 0.1, p * 0.1, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = tex(c, { repeat: [12, 6] });
  return t;
}

/** A small abstract "photograph" (soft gradient scene) for the picture frame. */
export function photoTexture(kind = 0) {
  const W = 256, H = 192;
  const [c, g] = canvas(W, H);
  const palettes = [
    ['#f6c89a', '#e98f7a', '#5a4a7a', '#1d2342'],
    ['#cfe3f2', '#8fb8d6', '#4d7aa0', '#27425e'],
  ];
  const p = palettes[kind % palettes.length];
  const sky = g.createLinearGradient(0, 0, 0, H * 0.7);
  sky.addColorStop(0, p[0]);
  sky.addColorStop(1, p[1]);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.beginPath(); g.arc(W * 0.7, H * 0.36, 17, 0, Math.PI * 2); g.fill();
  g.fillStyle = p[2];
  g.beginPath(); g.moveTo(0, H * 0.66); g.bezierCurveTo(W * 0.25, H * 0.46, W * 0.5, H * 0.78, W, H * 0.52); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
  g.fillStyle = p[3];
  g.beginPath(); g.moveTo(0, H * 0.8); g.bezierCurveTo(W * 0.3, H * 0.7, W * 0.6, H * 0.9, W, H * 0.76); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
  return tex(c);
}

/** Radial glow for the lamp globe: bright core, softly dimmer rim (used as the emissive map). */
export function lampGlowTexture() {
  const S = 128;
  const [c, g] = canvas(S, S);
  const grd = g.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(0.55, '#f2e8d8');
  grd.addColorStop(1, '#a89c8a');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  return tex(c);
}

/** Round rug: wool pile, sage double border, fine inner rings and a stitched edge. */
export function rugTexture2() {
  const size = 1024;
  const [c, g] = canvas(size, size);
  const r = rng(7);
  g.fillStyle = '#e9e3d6';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 34000; i++) {
    const x = r() * size, y = r() * size, a = r() * Math.PI;
    g.strokeStyle = r() > 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(110,96,76,0.14)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * (3 + r() * 5), y + Math.sin(a) * (3 + r() * 5));
    g.stroke();
  }
  const ring = (rad, w, col, dash) => {
    g.strokeStyle = col;
    g.lineWidth = w;
    g.setLineDash(dash || []);
    g.beginPath();
    g.arc(size / 2, size / 2, rad, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
  };
  ring(size * 0.4, 46, 'rgba(147,160,140,0.55)');
  ring(size * 0.4, 34, 'rgba(160,172,152,0.7)');
  ring(size * 0.325, 4, 'rgba(120,108,88,0.45)');
  ring(size * 0.305, 2, 'rgba(120,108,88,0.3)');
  ring(size * 0.46, 3, 'rgba(110,100,84,0.5)', [10, 9]); // stitched edge
  ring(size * 0.235, 3, 'rgba(147,160,140,0.5)', [2, 14]); // dotted inner ring
  ring(size * 0.16, 2, 'rgba(147,160,140,0.35)');
  // a few soft tonal blotches so the pile does not look printed
  for (let i = 0; i < 40; i++) {
    const x = r() * size, y = r() * size, rr = 40 + r() * 90;
    const grd = g.createRadialGradient(x, y, 0, x, y, rr);
    grd.addColorStop(0, r() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(110,96,76,0.06)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  return tex(c);
}

/** Matte pebbles / bark noise used as a bump map (greyscale). */
export function noiseBump(seed = 5, S = 128) {
  const [c, g] = canvas(S, S);
  const r = rng(seed);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < S * S * 0.6; i++) {
    const v = 90 + r() * 90;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2);
  }
  return tex(c, { srgb: false, repeat: [4, 4] });
}
