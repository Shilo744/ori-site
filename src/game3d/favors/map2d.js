// "Ori, Can You...?" — the map on the phone: the neighbourhood drawn flat on a canvas (the street layer once, the pins and Ori per frame).
import { ROAD_X, ROAD_Z, ROAD_W, BOUNDS } from './map.js';
import { PLACES } from './content.js';

const SEA = '#bfe3ee';
const SAND = '#efe3c2';
const BLOCK = '#f1eee8';
const ROAD = '#ffffff';
const LOT = '#d9d4ca';

export const ICON_NAMES = ['ring', 'arcade', 'garage', 'coffee', 'car', 'event', 'flag'];
/** A round badge with a white picture in it: the stars of the map (places-guide.js LANDMARKS). */
function badge(g, icon, x, y, r, color) {
  g.save();
  g.translate(x, y);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, r + 1.6, 0, 7); g.fill();
  g.fillStyle = color; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = Math.max(1.3, r * 0.17); g.lineCap = 'round'; g.lineJoin = 'round';
  const u = r * 0.58;
  if (icon === 'ring') { // a boxing glove: the round fist, the thumb on the side, the cuff with a stripe
    g.beginPath(); g.arc(-u * 0.12, -u * 0.3, u * 0.82, 0, 7); g.fill();
    g.beginPath(); g.ellipse(u * 0.72, u * 0.05, u * 0.3, u * 0.5, -0.35, 0, 7); g.fill();
    g.fillRect(-u * 0.66, u * 0.42, u * 1.1, u * 0.62);
    g.fillStyle = color; g.fillRect(-u * 0.66, u * 0.66, u * 1.1, u * 0.12); g.fillStyle = '#fff';
  } else if (icon === 'arcade') { // a monitor on a little stand
    g.strokeRect(-u, -u * 0.85, u * 2, u * 1.45);
    g.beginPath(); g.moveTo(0, u * 0.6); g.lineTo(0, u * 1.0); g.moveTo(-u * 0.6, u * 1.0); g.lineTo(u * 0.6, u * 1.0); g.stroke();
    g.fillRect(-u * 0.45, -u * 0.35, u * 0.9, u * 0.5);
  } else if (icon === 'garage') { // a spanner
    g.beginPath(); g.moveTo(-u * 0.75, u * 0.75); g.lineTo(u * 0.35, -u * 0.35); g.stroke();
    g.beginPath(); g.arc(u * 0.45, -u * 0.45, u * 0.55, 0.9, 5.4); g.stroke();
  } else if (icon === 'car') { // a car from above: the body, the windscreen and the rear window
    g.beginPath(); g.roundRect(-u * 0.62, -u * 1.05, u * 1.24, u * 2.1, u * 0.4); g.stroke();
    g.beginPath(); g.moveTo(-u * 0.42, -u * 0.38); g.lineTo(u * 0.42, -u * 0.38); g.moveTo(-u * 0.42, u * 0.5); g.lineTo(u * 0.42, u * 0.5); g.stroke();
    g.fillRect(-u * 0.9, -u * 0.8, u * 0.22, u * 0.5); g.fillRect(u * 0.68, -u * 0.8, u * 0.22, u * 0.5); g.fillRect(-u * 0.9, u * 0.35, u * 0.22, u * 0.5); g.fillRect(u * 0.68, u * 0.35, u * 0.22, u * 0.5);
  } else if (icon === 'event') { // a star: something is on in the city right now
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? u * 0.5 : u * 1.12; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr + u * 0.05); }
    g.closePath(); g.fill();
  } else if (icon === 'flag') { // a chequered flag on a pole: where the races start
    g.beginPath(); g.moveTo(-u * 0.8, u * 1.0); g.lineTo(-u * 0.8, -u * 1.0); g.stroke();
    g.strokeRect(-u * 0.8, -u * 1.0, u * 1.8, u * 1.1);
    g.fillRect(-u * 0.8, -u * 1.0, u * 0.6, u * 0.55); g.fillRect(u * 0.4, -u * 1.0, u * 0.6, u * 0.55); g.fillRect(-u * 0.2, -u * 0.45, u * 0.6, u * 0.55);
  } else if (icon === 'coffee') { // a cup with steam
    g.beginPath(); g.moveTo(-u * 0.75, -u * 0.1); g.lineTo(-u * 0.55, u * 0.85); g.lineTo(u * 0.55, u * 0.85); g.lineTo(u * 0.75, -u * 0.1); g.closePath(); g.fill();
    g.beginPath(); g.arc(u * 0.95, u * 0.3, u * 0.38, -1.4, 1.4); g.stroke();
    g.beginPath(); g.moveTo(-u * 0.25, -u * 0.35); g.quadraticCurveTo(-u * 0.5, -u * 0.7, -u * 0.2, -u * 0.95); g.moveTo(u * 0.25, -u * 0.35); g.quadraticCurveTo(0, -u * 0.7, u * 0.3, -u * 0.95); g.stroke();
  }
  g.restore();
}
/** Text with a white halo, readable on any colour of the map. */
function haloText(g, text, x, y, size, color = '#26303f') {
  g.font = `800 ${size}px Inter, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = Math.max(3, size * 0.32); g.strokeStyle = 'rgba(255,255,255,0.92)'; g.strokeText(text, x, y);
  g.fillStyle = color; g.fillText(text, x, y);
}
/** Paints a badge on a small canvas (the list of the big map). */
export function paintBadge(canvas, icon, color) {
  const k = window.devicePixelRatio > 1 ? 2 : 1;
  canvas.width = 30 * k; canvas.height = 30 * k;
  const g = canvas.getContext('2d');
  g.scale(k, k);
  badge(g, icon, 15, 15, 12, color);
}

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
     * @param {{ player: {x:number,z:number,heading:number}, pins: {id:string, color:string, label:string, count?:number, active?:boolean}[], points?: object[], goal?: {x:number,z:number}, landmarks?: {place:string, x:number, z:number, icon:string, color:string, short?:string, big?:boolean, pulse?:boolean}[], labels?: {id?:string, x:number, z:number, text:string, size?:number, dy?:number, color?:string}[], time?: number }} s
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
      // extra points that are not places (the runaway parrot, the rival, a checkpoint): { x, z, color, label, ring }
      for (const q of s.points || []) {
        const x = X(q.x);
        const z = Z(q.z);
        if (q.ring) { g.strokeStyle = q.color; g.lineWidth = 2.5; g.beginPath(); g.arc(x, z, pinR + 3, 0, 7); g.stroke(); }
        g.fillStyle = q.color;
        g.beginPath();
        g.arc(x, z, q.ring ? pinR - 2 : pinR - 1, 0, 7);
        g.fill();
        g.strokeStyle = '#fff';
        g.lineWidth = 1.5;
        g.stroke();
        if (q.label) { g.fillStyle = '#fff'; g.font = `700 ${Math.round(pinR)}px Inter, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(q.label, x, z + 0.5); }
      }
      // the goal of the moment: a pulsing orange ring (the beam in the street, the ring on the map)
      if (s.goal) { const gx = X(s.goal.x); const gz = Z(s.goal.z); const k2 = 0.5 + 0.5 * Math.sin((s.time || 0) * 5); g.strokeStyle = `rgba(255,140,40,${(0.55 + 0.4 * k2).toFixed(2)})`; g.lineWidth = 3; g.beginPath(); g.arc(gx, gz, pinR + 5 + k2 * 4, 0, 7); g.stroke(); }
      // names (the big map) and the stars of the map (badges with a short word under them)
      // (a label that would sit on another label or on a badge steps up or down until it does not)
      const placed = [];
      const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
      for (const m of s.landmarks || []) { const r = m.big ? pinR + 4 : pinR + 1; placed.push({ x0: X(m.x) - r - 2, x1: X(m.x) + r + 2, y0: Z(m.z) - r - 2, y1: Z(m.z) + r + 16 }); }
      for (const l of s.labels || []) {
        const size = l.size || 10;
        g.font = `800 ${size}px Inter, system-ui, sans-serif`;
        const w = g.measureText(l.text).width + 4;
        const x = Math.max(w / 2 + 2, Math.min(W - w / 2 - 2, X(l.x)));
        const z0 = Z(l.z) + (l.dy || 0);
        let z = z0;
        for (const off of [0, 13, -13, 26, -26, 39]) { z = z0 + off; const b = { x0: x - w / 2, x1: x + w / 2, y0: z - size / 2 - 1, y1: z + size / 2 + 1 }; if (!placed.some((q) => overlap(q, b)) || off === 39) { placed.push(b); break; } }
        haloText(g, l.text, x, z, size, l.color);
        if (l.id) pins.push({ id: l.id, x, z });
      }
      for (const m of s.landmarks || []) {
        const x = X(m.x); const z = Z(m.z); const r = m.big ? pinR + 4 : pinR + 1;
        if (m.pulse) { const k3 = 0.5 + 0.5 * Math.sin((s.time || 0) * 3); g.fillStyle = m.color; g.globalAlpha = 0.22 + 0.2 * k3; g.beginPath(); g.arc(x, z, r + 5 + k3 * 5, 0, 7); g.fill(); g.globalAlpha = 1; }
        badge(g, m.icon, x, z, r, m.color);
        if (m.short) haloText(g, m.short, x, z + r + 8, Math.max(8, Math.round(pinR * 0.95)));
        pins.push({ id: m.place, x, z });
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
