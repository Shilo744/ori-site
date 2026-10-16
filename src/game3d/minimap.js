// NEON DRIFT — the minimap: the track's centre line drawn once into an offscreen canvas, the cars as dots on top.
const PAD = 14;

/** @param {HTMLCanvasElement} canvas the visible canvas (its width/height attributes set the resolution) */
export function createMinimap(canvas, track) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  // bounds → scale
  let x0 = Infinity; let x1 = -Infinity; let z0 = Infinity; let z1 = -Infinity;
  for (let i = 0; i < track.n; i++) { x0 = Math.min(x0, track.x[i]); x1 = Math.max(x1, track.x[i]); z0 = Math.min(z0, track.z[i]); z1 = Math.max(z1, track.z[i]); }
  const k = Math.min((w - PAD * 2) / (x1 - x0), (h - PAD * 2) / (z1 - z0));
  const ox = (w - (x1 - x0) * k) / 2 - x0 * k;
  const oz = (h - (z1 - z0) * k) / 2 - z0 * k;
  const px = (x) => x * k + ox;
  const pz = (z) => z * k + oz;
  // the static layer
  const base = document.createElement('canvas');
  base.width = w;
  base.height = h;
  const b = base.getContext('2d');
  b.lineCap = 'round';
  b.lineJoin = 'round';
  const trace = () => {
    b.beginPath();
    for (let i = 0; i <= track.n; i += 3) {
      const j = i % track.n;
      if (i === 0) b.moveTo(px(track.x[j]), pz(track.z[j])); else b.lineTo(px(track.x[j]), pz(track.z[j]));
    }
    b.closePath();
  };
  b.strokeStyle = 'rgba(0,0,0,0.55)';
  b.lineWidth = 9;
  trace(); b.stroke();
  b.strokeStyle = 'rgba(190,200,255,0.85)';
  b.lineWidth = 4.5;
  trace(); b.stroke();
  b.strokeStyle = 'rgba(25,227,255,0.9)';
  b.lineWidth = 1.4;
  trace(); b.stroke();
  // start line
  b.strokeStyle = '#fff';
  b.lineWidth = 3;
  const sx = px(track.x[0]); const sz = pz(track.z[0]);
  b.beginPath();
  b.moveTo(sx - track.tz[0] * 8, sz + track.tx[0] * 8);
  b.lineTo(sx + track.tz[0] * 8, sz - track.tx[0] * 8);
  b.stroke();

  return {
    /** dots = [{ x, z, color, you }] in world coordinates. */
    draw(dots) {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(base, 0, 0);
      // rivals first, the player on top
      const order = [...dots].sort((a, c) => (a.you ? 1 : 0) - (c.you ? 1 : 0));
      for (const d of order) {
        ctx.beginPath();
        ctx.arc(px(d.x), pz(d.z), d.you ? 6.5 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = d.color;
        ctx.fill();
        ctx.lineWidth = d.you ? 2.5 : 1.5;
        ctx.strokeStyle = d.you ? '#fff' : 'rgba(0,0,0,0.6)';
        ctx.stroke();
      }
    },
  };
}
