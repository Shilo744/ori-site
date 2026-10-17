// "Ori, Can You...?" — facade geometry helpers. A facade is described in its own little frame: `s` runs along the wall (left to right as seen from
// the street), `y` up, and `e` out of the wall (negative = into the wall). The four faces of a lot share one description (FACES).
export const FLOOR = 3.1;
export const RC = 0.3; // how far the windows are set back from the face of the wall (the reveal)

export const FACES = {
  S: { key: 'S', o: (r) => [r.x0, r.z1], t: [1, 0], n: [0, 1], len: (r) => r.x1 - r.x0 },
  N: { key: 'N', o: (r) => [r.x1, r.z0], t: [-1, 0], n: [0, -1], len: (r) => r.x1 - r.x0 },
  E: { key: 'E', o: (r) => [r.x1, r.z1], t: [0, -1], n: [1, 0], len: (r) => r.z1 - r.z0 },
  W: { key: 'W', o: (r) => [r.x0, r.z0], t: [0, 1], n: [-1, 0], len: (r) => r.z1 - r.z0 },
};

/** World position of (s, y, e) on a face of rect r. */
export const P = (f, r, s, y, e) => { const o = f.o(r); return [o[0] + f.t[0] * s + f.n[0] * e, y, o[1] + f.t[1] * s + f.n[1] * e]; };

/** A quad lying on a facade between along-positions s0..s1 and heights y0..y1, pushed out by e (counter-clockwise seen from the street). */
export function faceQuad(B, f, r, s0, s1, y0, y1, e, uv) {
  return B.quad(P(f, r, s0, y0, e), P(f, r, s1, y0, e), P(f, r, s1, y1, e), P(f, r, s0, y1, e), f.n[0], 0, f.n[1], uv);
}

/** A box on a facade: along s0..s1, heights y0..y1, from e = d0 out to e = d. */
export function faceBox(B, f, r, s0, s1, y0, y1, d, d0 = 0, opts) {
  const a = P(f, r, s0, y0, d0);
  const b = P(f, r, s1, y1, d);
  const skip = { ...(opts && opts.skip), [INNER[f.key]]: true }; // (the side that sits against the wall is never seen)
  B.box(Math.min(a[0], b[0]), y0, Math.min(a[2], b[2]), Math.max(a[0], b[0]), y1, Math.max(a[2], b[2]), { ...opts, skip });
}
const INNER = { S: 'back', N: 'front', E: 'left', W: 'right' };

/**
 * A wall piece with a real thickness (the skin of the wall, RC deep): its outer face gets texture coordinates in metres (so the stucco runs on
 * unbroken over the piers and the strips), its sides are the reveals of the openings next to it.
 */
export function skinPiece(B, f, r, s0, s1, y0, y1, uOff = 0) {
  if (s1 - s0 < 0.01 || y1 - y0 < 0.01) return;
  const U = (s) => (s + uOff) / 4;
  const V = (y) => y / 4;
  faceQuad(B, f, r, s0, s1, y0, y1, 0, [U(s0), V(y0), U(s1), V(y0), U(s1), V(y1), U(s0), V(y1)]);
  const n = f.n; const t = f.t;
  const sideUv = (w, h) => [0, 0, w / 4, 0, w / 4, h / 4, 0, h / 4];
  const h = y1 - y0;
  // left reveal (normal -t)
  B.quad(P(f, r, s0, y0, -RC), P(f, r, s0, y0, 0), P(f, r, s0, y1, 0), P(f, r, s0, y1, -RC), -t[0], 0, -t[1], sideUv(RC, h));
  // right reveal (normal +t)
  B.quad(P(f, r, s1, y0, 0), P(f, r, s1, y0, -RC), P(f, r, s1, y1, -RC), P(f, r, s1, y1, 0), t[0], 0, t[1], sideUv(RC, h));
  // soffit (the underside, facing down) and the top
  B.quad(P(f, r, s0, y0, -RC), P(f, r, s1, y0, -RC), P(f, r, s1, y0, 0), P(f, r, s0, y0, 0), 0, -1, 0, sideUv(s1 - s0, RC));
  B.quad(P(f, r, s0, y1, 0), P(f, r, s1, y1, 0), P(f, r, s1, y1, -RC), P(f, r, s0, y1, -RC), 0, 1, 0, sideUv(s1 - s0, RC));
  void n;
}

/**
 * The wall of a face as bands (from the ground up): each band is { y0, y1, openings: [[s0, s1], ...] } and is built from wall pieces around its
 * openings (the openings are real holes: you see the reveal and the glass set back behind them).
 */
export function wallBands(B, f, r, len, bands, uOff = 0, margin = 0) {
  for (const b of bands) {
    const ops = [...b.openings].sort((p, q) => p[0] - q[0]);
    let cur = margin;
    for (const [a, c] of ops) { skinPiece(B, f, r, cur, a, b.y0, b.y1, uOff); cur = c; }
    skinPiece(B, f, r, cur, len - margin, b.y0, b.y1, uOff);
  }
}

/** A tiny stable hash 0..1 of a few numbers (per-window variety that does not depend on the order of the random calls). */
export function hash01(a, b = 0, c = 0) {
  let h = Math.imul(a * 374761393 + b * 668265263 + c * 2147483647 + 1013904223, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A quad with a wind weight per corner (0 = pinned, 1 = free): awnings, washing, flags. */
export function quadW(B, a, b, c, d, nx, ny, nz, w, uv = [0, 0, 1, 0, 1, 1, 0, 1]) {
  const i0 = B.count;
  const pts = [a, b, c, d];
  for (let k = 0; k < 4; k++) { B.attr2 = w[k]; B.vert(pts[k][0], pts[k][1], pts[k][2], nx, ny, nz, uv[k * 2], uv[k * 2 + 1]); }
  B.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
  B.attr2 = 0;
}

/** A sloping strip from the wall (yTop at e = eTop) down and out to (yBot at e = eBot), between along-positions s0..s1. Faces up and out. */
export function slopeStrip(B, f, r, s0, s1, yTop, eTop, yBot, eBot, w = [0, 0, 1, 1]) {
  const dy = yTop - yBot;
  const de = eBot - eTop;
  const l = Math.hypot(dy, de) || 1;
  const nx = f.n[0] * dy / l;
  const ny = de / l;
  const nz = f.n[1] * dy / l;
  // corners in the order that faces up-and-out: top-left, bottom-left, bottom-right, top-right
  quadW(B, P(f, r, s0, yTop, eTop), P(f, r, s0, yBot, eBot), P(f, r, s1, yBot, eBot), P(f, r, s1, yTop, eTop), nx, ny, nz, [w[0], w[2], w[3], w[1]]);
}
