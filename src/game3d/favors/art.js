// "Ori, Can You...?" — the street art of the neighbourhood, painted once on a canvas: four wall MURALS on the side walls of the blocks (sunset with palms, a pop
// collage, a school of fish, bubble letters) and eight little POSTERS for the shop walls (a gig, a lost cat, a yoga session...). One atlas, no files. Always cheerful.
import { mulberry32 } from '../rng.js';
import { canvasTexture } from './gfx.js';

const W = 2048;
const H = 1024;
export const MURAL_COUNT = 4;
export const POSTER_COUNT = 8;
const MW = 1024; const MH = 256; // a mural cell (4:1)
const PW = 256; const PH = 512; // a poster cell

const PALETTE = ['#ff6b6b', '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#8338ec', '#ff9f1c', '#2ec4b6', '#f72585', '#4cc9f0'];

function bubble(g, text, x, y, size, fill, stroke) {
  g.font = `900 ${size}px "Arial Black", Impact, system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = size * 0.22; g.strokeStyle = stroke; g.strokeText(text, x, y);
  g.fillStyle = fill; g.fillText(text, x, y);
}

function murals(g) {
  const rnd = mulberry32(77);
  // 0: sunset with palms
  g.save(); g.translate(0, 0); g.beginPath(); g.rect(0, 0, MW, MH); g.clip();
  const sky = g.createLinearGradient(0, 0, 0, MH); sky.addColorStop(0, '#5b2a86'); sky.addColorStop(0.45, '#ff5e7e'); sky.addColorStop(0.8, '#ffb347'); sky.addColorStop(1, '#ffe29a');
  g.fillStyle = sky; g.fillRect(0, 0, MW, MH);
  g.fillStyle = '#fff1b8'; g.beginPath(); g.arc(MW * 0.62, MH * 0.62, 78, 0, 6.283); g.fill();
  g.fillStyle = 'rgba(255,94,126,0.8)'; for (let i = 0; i < 6; i++) g.fillRect(MW * 0.62 - 90, MH * 0.62 + 6 + i * 11, 180, 3 + i);
  g.fillStyle = '#1d3b5e'; g.fillRect(0, MH * 0.8, MW, MH * 0.2);
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 3; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(i * 120 + 10, MH * 0.86); g.quadraticCurveTo(i * 120 + 40, MH * 0.82, i * 120 + 70, MH * 0.86); g.stroke(); }
  g.fillStyle = '#141a30';
  for (const px of [90, 250, 850, 960]) { g.fillRect(px - 5, MH * 0.35, 10, MH * 0.5); for (let k = 0; k < 7; k++) { const a = -2.7 + k * 0.45; g.beginPath(); g.moveTo(px, MH * 0.35); g.quadraticCurveTo(px + Math.cos(a) * 60, MH * 0.35 + Math.sin(a) * 40 - 30, px + Math.cos(a) * 95, MH * 0.35 + Math.sin(a) * 60 + 18); g.lineWidth = 7; g.strokeStyle = '#141a30'; g.stroke(); } }
  g.restore();
  // 1: pop collage
  g.save(); g.translate(MW, 0); g.beginPath(); g.rect(0, 0, MW, MH); g.clip();
  g.fillStyle = '#fff4d6'; g.fillRect(0, 0, MW, MH);
  for (let i = 0; i < 22; i++) {
    g.fillStyle = PALETTE[Math.floor(rnd() * PALETTE.length)];
    const x = rnd() * MW; const y = rnd() * MH; const s = 30 + rnd() * 90;
    g.beginPath();
    const k = Math.floor(rnd() * 3);
    if (k === 0) g.arc(x, y, s / 2, 0, 6.283); else if (k === 1) g.roundRect(x - s / 2, y - s / 3, s, s * 0.66, 14); else { g.moveTo(x, y - s / 2); g.lineTo(x + s / 2, y + s / 2); g.lineTo(x - s / 2, y + s / 2); g.closePath(); }
    g.fill(); g.lineWidth = 5; g.strokeStyle = '#1b1b2f'; g.stroke();
  }
    for (const [ex, ey] of [[260, 120], [700, 100]]) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, ey, 46, 30, 0, 0, 6.283); g.fill(); g.lineWidth = 6; g.strokeStyle = '#1b1b2f'; g.stroke(); g.fillStyle = '#1b1b2f'; g.beginPath(); g.arc(ex + 8, ey, 14, 0, 6.283); g.fill(); }
  g.restore();
  // 2: a school of fish
  g.save(); g.translate(0, MH); g.beginPath(); g.rect(0, 0, MW, MH); g.clip();
  const sea = g.createLinearGradient(0, 0, 0, MH); sea.addColorStop(0, '#2ec4b6'); sea.addColorStop(1, '#0b3d6b');
  g.fillStyle = sea; g.fillRect(0, 0, MW, MH);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * MW; const y = 20 + rnd() * (MH - 40); const s = 24 + rnd() * 50; const c = PALETTE[Math.floor(rnd() * PALETTE.length)];
    g.fillStyle = c; g.beginPath(); g.ellipse(x, y, s, s * 0.5, 0, 0, 6.283); g.fill();
    g.beginPath(); g.moveTo(x - s * 0.8, y); g.lineTo(x - s * 1.5, y - s * 0.5); g.lineTo(x - s * 1.5, y + s * 0.5); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x + s * 0.45, y - s * 0.1, s * 0.12, 0, 6.283); g.fill(); g.fillStyle = '#10213a'; g.beginPath(); g.arc(x + s * 0.48, y - s * 0.1, s * 0.06, 0, 6.283); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 2; for (let b = 0; b < 3; b++) { g.beginPath(); g.arc(x + s + b * 9, y - 14 - b * 16, 3 + b, 0, 6.283); g.stroke(); }
  }
  g.restore();
  // 3: bubble letters
  g.save(); g.translate(MW, MH); g.beginPath(); g.rect(0, 0, MW, MH); g.clip();
  const bg = g.createLinearGradient(0, 0, MW, MH); bg.addColorStop(0, '#ffd1dc'); bg.addColorStop(0.5, '#fff0b3'); bg.addColorStop(1, '#bde8ff');
  g.fillStyle = bg; g.fillRect(0, 0, MW, MH);
  for (let i = 0; i < 24; i++) { g.fillStyle = PALETTE[Math.floor(rnd() * PALETTE.length)]; g.beginPath(); g.arc(rnd() * MW, rnd() * MH, 6 + rnd() * 14, 0, 6.283); g.fill(); }
  bubble(g, 'SABABA!', MW / 2 + 5, MH / 2 + 8, 168, '#1b1b2f', '#1b1b2f');
  bubble(g, 'SABABA!', MW / 2, MH / 2, 168, '#ff6b6b', '#ffffff');
  g.restore();
}

function posters(g) {
  const y0 = 512;
  const cell = (i, draw) => { g.save(); g.translate(i * PW, y0); g.beginPath(); g.rect(0, 0, PW, PH); g.clip(); draw(); g.restore(); };
  const frame = () => { g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 6; g.strokeRect(3, 3, PW - 6, PH - 6); };
  const title = (t, y, s, c = '#fff') => { g.font = `900 ${s}px "Arial Black", Impact, sans-serif`; g.textAlign = 'center'; g.fillStyle = c; g.fillText(t, PW / 2, y); };
  const small = (t, y, s = 20, c = '#fff') => { g.font = `700 ${s}px Inter, system-ui, sans-serif`; g.textAlign = 'center'; g.fillStyle = c; g.fillText(t, PW / 2, y); };
  const grad = (a, b) => { const gr = g.createLinearGradient(0, 0, 0, PH); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, PW, PH); };
  cell(0, () => { grad('#8338ec', '#f72585'); g.fillStyle = '#ffd166'; g.beginPath(); g.arc(PW / 2, 190, 90, 0, 6.283); g.fill(); title('LIVE', 340, 70); small('SATURDAY NIGHT', 380); small('ON THE ROOF', 410); small('free · bring a friend', 470, 16, '#ffe'); frame(); });
  cell(1, () => { grad('#fff7d6', '#ffe08a'); g.fillStyle = '#ff9f1c'; g.beginPath(); g.ellipse(PW / 2, 190, 70, 62, 0, 0, 6.283); g.fill(); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(PW / 2 + s * 40, 140); g.lineTo(PW / 2 + s * 66, 80); g.lineTo(PW / 2 + s * 78, 150); g.fill(); } g.fillStyle = '#1b1b2f'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(PW / 2 + s * 26, 185, 9, 12, 0, 0, 6.283); g.fill(); } title('HAVE YOU', 330, 36, '#1b1b2f'); title('SEEN ME?', 372, 36, '#1b1b2f'); small('Mitzi, very fluffy,', 420, 17, '#1b1b2f'); small('answers to snacks.', 444, 17, '#1b1b2f'); frame(); });
  cell(2, () => { grad('#06d6a0', '#118ab2'); g.fillStyle = '#fff'; g.beginPath(); g.arc(PW / 2, 170, 70, 0, 6.283); g.fill(); g.strokeStyle = '#06d6a0'; g.lineWidth = 10; g.beginPath(); g.arc(PW / 2, 170, 40, 0.2, 2.9); g.stroke(); title('YOGA', 320, 62); title('AT SUNSET', 366, 30); small('the beach · 18:30', 420, 20); small('mats provided', 450, 16, '#eff'); frame(); });
  cell(3, () => { grad('#ff6b6b', '#ffd166'); title('SALE', 190, 96, '#fff'); title('50%', 300, 90, '#1b1b2f'); small('everything. mostly.', 360, 20, '#1b1b2f'); frame(); });
  cell(4, () => { grad('#1b1b2f', '#3a0ca3'); for (let i = 0; i < 22; i++) { g.fillStyle = PALETTE[i % PALETTE.length]; g.fillRect(20 + i * 10, 300 - (10 + (i * 37) % 120), 7, 10 + (i * 37) % 120); } title('JAZZ', 100, 70, '#ffd166'); title('NIGHT', 160, 50); small('Thursdays', 340, 24); small('doors 21:00', 372, 18, '#cdf'); frame(); });
  cell(5, () => { grad('#4cc9f0', '#4361ee'); g.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(70 + i * 40, 90 + (i % 2) * 20, 22, 0, 6.283); g.fill(); } title('TLV', 250, 100); title('10K', 340, 92, '#ffd166'); small('run with us!', 400, 24); frame(); });
  cell(6, () => { grad('#ffd1dc', '#ff6b9d'); for (let i = 0; i < 6; i++) { g.fillStyle = PALETTE[i]; g.fillRect(0, 70 + i * 24, PW, 24); } title('LOVE', 300, 76, '#fff'); title('WINS', 366, 66, '#1b1b2f'); small('every day', 420, 22, '#fff'); frame(); });
  cell(7, () => { grad('#f3ede0', '#d9c9a3'); g.fillStyle = '#c0392b'; g.fillRect(40, 70, PW - 80, 120); title('FALAFEL', 150, 46); title('פלאפל', 260, 56, '#1b1b2f'); small('10 NIS · best in town', 330, 18, '#1b1b2f'); small('(Ori approves)', 360, 16, '#6b4f2a'); frame(); });
}

/** The atlas texture + `uvMural(i)` / `uvPoster(i)` → [u0, v0, u1, v1] (v up). */
export function artAtlas(aniso) {
  const tex = canvasTexture(W, H, (g) => { g.clearRect(0, 0, W, H); murals(g); posters(g); }, { aniso });
  const cellUv = (x, y, w, h) => [x / W, 1 - (y + h) / H, (x + w) / W, 1 - y / H];
  return {
    tex,
    uvMural: (i) => cellUv((i % 2) * MW, Math.floor(i / 2) * MH, MW, MH),
    uvPoster: (i) => cellUv(i * PW, 512, PW, PH),
  };
}
