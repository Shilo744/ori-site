// "Ori, Can You...?" — the map on the phone: the neighbourhood drawn flat on a canvas (the street layer once, the pins and Ori per frame).
import { ROAD_X, ROAD_Z, ROAD_W, BOUNDS } from './map.js';
import { PLACES } from './content.js';

const SEA = '#bfe3ee';
const SAND = '#efe3c2';
const BLOCK = '#f1eee8';
const ROAD = '#ffffff';
const LOT = '#d9d4ca';

/** @param {HTMLCanvasElement} canvas @param {object} map from buildMap */
export function createMap2d(canvas, map) {
  const W = canvas.width;
  const H = canvas.height;
  const pad = 8;
  const x0 = BOUNDS.x0 - 12;
  const z0 = BOUNDS.z0;
  const sx = (W - pad * 2) / (BOUNDS.x1 - x0);
  const sz = (H - pad * 2) / (BOUNDS.z1 - z0);
  const k = Math.min(sx, sz);
  const ox = pad + (W - pad * 2 - (BOUNDS.x1 - x0) * k) / 2;
  const oz = pad + (H - pad * 2 - (BOUNDS.z1 - z0) * k) / 2;
  const X = (x) => ox + (x - x0) * k;
  const Z = (z) => oz + (z - z0) * k;

  const base = document.createElement('canvas');
  base.width = W;
  base.height = H;
  {
    const g = base.getContext('2d');
    g.fillStyle = SEA;
    g.fillRect(0, 0, W, H);
    g.fillStyle = SAND;
    g.fillRect(X(BOUNDS.x0 - 8), Z(BOUNDS.z0), (-124 - (BOUNDS.x0 - 8)) * k, (BOUNDS.z1 - BOUNDS.z0) * k);
    g.fillStyle = BLOCK;
    g.beginPath();
    for (const s of map.slabs) g.roundRect(X(s.x0), Z(s.z0), (s.x1 - s.x0) * k, (s.z1 - s.z0) * k, 3);
    g.fill();
    g.fillStyle = ROAD;
    for (const z of ROAD_Z) g.fillRect(X(-124), Z(z - ROAD_W / 2), (BOUNDS.x1 + 10 - -124) * k, ROAD_W * k);
    for (const x of ROAD_X) g.fillRect(X(x - ROAD_W / 2), Z(BOUNDS.z0), ROAD_W * k, (BOUNDS.z1 - BOUNDS.z0) * k);
    const p = map.zones.park;
    g.fillStyle = '#cfe8bf';
    g.fillRect(X(p.x0), Z(p.z0), (p.x1 - p.x0) * k, (p.z1 - p.z0) * k);
    const c = map.zones.court;
    g.fillStyle = '#f1c3a8';
    g.fillRect(X(c.x0), Z(c.z0), (c.x1 - c.x0) * k, (c.z1 - c.z0) * k);
    for (const l of map.lots) {
      g.fillStyle = l.named ? PLACES[l.id].tone : LOT;
      g.globalAlpha = l.named ? 0.85 : 1;
      g.fillRect(X(l.rect.x0), Z(l.rect.z0), (l.rect.x1 - l.rect.x0) * k, (l.rect.z1 - l.rect.z0) * k);
      g.globalAlpha = 1;
    }
  }

  const pinR = Math.max(7, 9 * Math.min(1, W / 320));
  const pins = [];
  return {
    /** Canvas pixel → world, and back. */
    toCanvas: (x, z) => [X(x), Z(z)],
    /**
     * @param {{ player: {x:number,z:number,heading:number}, pins: {id:string, color:string, label:string, count?:number, active?:boolean}[] }} s
     */
    draw(s) {
      const g = canvas.getContext('2d');
      g.clearRect(0, 0, W, H);
      g.drawImage(base, 0, 0);
      pins.length = 0;
      for (const p of s.pins) {
        const pl = map.places[p.id];
        const x = X(pl.door.x);
        const z = Z(pl.door.z);
        pins.push({ id: p.id, x, z });
        if (p.active) { g.strokeStyle = 'rgba(255,159,67,0.9)'; g.lineWidth = 3; g.beginPath(); g.arc(x, z, pinR + 5, 0, 7); g.stroke(); }
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(x, z, pinR, 0, 7);
        g.fill();
        g.strokeStyle = '#fff';
        g.lineWidth = 2;
        g.stroke();
        g.fillStyle = '#fff';
        g.font = `700 ${Math.round(pinR * 1.15)}px Inter, system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(p.label, x, z + 0.5);
        if (p.count > 1) {
          g.fillStyle = '#ff3b30';
          g.beginPath(); g.arc(x + pinR * 0.9, z - pinR * 0.9, 6, 0, 7); g.fill();
          g.fillStyle = '#fff';
          g.font = '700 9px Inter, system-ui, sans-serif';
          g.fillText(String(p.count), x + pinR * 0.9, z - pinR * 0.9 + 0.5);
        }
      }
      // Ori: a blue dot with a pointer
      const px = X(s.player.x);
      const pz = Z(s.player.z);
      g.save();
      g.translate(px, pz);
      g.rotate(-s.player.heading + Math.PI);
      g.fillStyle = '#0a84ff';
      g.strokeStyle = '#fff';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(0, -9);
      g.lineTo(6.5, 6);
      g.lineTo(0, 2.5);
      g.lineTo(-6.5, 6);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    },
    /** Which place pin (if any) is under a canvas point. */
    hit(cx, cz) {
      let best = null;
      let bd = pinR + 6;
      for (const p of pins) { const d = Math.hypot(p.x - cx, p.z - cz); if (d < bd) { bd = d; best = p.id; } }
      return best;
    },
  };
}
