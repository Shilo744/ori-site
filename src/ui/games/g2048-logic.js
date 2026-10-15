// 2048 rules — pure functions (no DOM), so they can be unit-tested in node (scripts/test-2048.mjs).
// A board is an array of 16 cells (row-major); a cell is null or a tile { id, v }. Tiles keep their id while they slide so the
// UI can animate them; a merge creates a NEW tile (new id) at the destination.
export const SIZE = 4;
export const CELLS = SIZE * SIZE;

export const idGen = (start = 1) => { let n = start; return () => n++; };

/** Cell indices of line `k` in the direction of travel, nearest-to-the-wall first. */
export function lineIndices(dir, k) {
  const out = [];
  for (let i = 0; i < SIZE; i++) {
    out.push(dir === 'left' ? k * SIZE + i : dir === 'right' ? k * SIZE + (SIZE - 1 - i) : dir === 'up' ? i * SIZE + k : (SIZE - 1 - i) * SIZE + k);
  }
  return out;
}

export const emptyBoard = () => Array(CELLS).fill(null);

export function fromValues(values, nextId = idGen()) {
  return values.map((v) => (v ? { id: nextId(), v } : null));
}
export const toValues = (cells) => cells.map((c) => (c ? c.v : 0));

/**
 * Slides every line towards `dir`, merging equal neighbours once per move.
 * Returns { cells, moved, gained, travel: [{ id, from, to }], merged: [{ id, to, v, from: [idA, idB] }] }.
 * `travel` has an entry for every tile that existed before (including the two that merge away).
 */
export function move(cells, dir, nextId = idGen(1000)) {
  const out = emptyBoard();
  const travel = [];
  const merged = [];
  let gained = 0;
  let moved = false;
  for (let k = 0; k < SIZE; k++) {
    const idx = lineIndices(dir, k);
    const line = [];
    idx.forEach((ci) => { if (cells[ci]) line.push({ tile: cells[ci], from: ci }); });
    const placed = []; // { tile, mergedNow }
    line.forEach(({ tile, from }) => {
      const last = placed[placed.length - 1];
      if (last && !last.mergedNow && last.tile.v === tile.v) {
        const to = idx[placed.length - 1];
        const nt = { id: nextId(), v: tile.v * 2 };
        travel.push({ id: tile.id, from, to });
        travel.push({ id: last.tile.id, from: last.from, to });
        merged.push({ id: nt.id, to, v: nt.v, from: [last.tile.id, tile.id] });
        // the earlier tile (already placed) is replaced by the merged one
        last.tile = nt;
        last.mergedNow = true;
        gained += nt.v;
        moved = true;
      } else {
        placed.push({ tile, from, mergedNow: false });
      }
    });
    placed.forEach((p, i) => {
      const to = idx[i];
      out[to] = p.tile;
      if (!p.mergedNow) {
        travel.push({ id: p.tile.id, from: p.from, to });
        if (p.from !== to) moved = true;
      }
    });
  }
  return { cells: out, moved, gained, travel, merged };
}

/** Adds a 2 (90%) or 4 (10%) on a random empty cell. Returns { cells, spawned: { id, idx, v } } or null if the board is full. */
export function spawn(cells, rng = Math.random, nextId = idGen(5000)) {
  const empty = [];
  cells.forEach((c, i) => { if (!c) empty.push(i); });
  if (!empty.length) return null;
  const idx = empty[Math.floor(rng() * empty.length) % empty.length];
  const v = rng() < 0.9 ? 2 : 4;
  const next = cells.slice();
  next[idx] = { id: nextId(), v };
  return { cells: next, spawned: { id: next[idx].id, idx, v } };
}

export function canMove(cells) {
  for (let i = 0; i < CELLS; i++) {
    const c = cells[i];
    if (!c) return true;
    const r = Math.floor(i / SIZE), col = i % SIZE;
    if (col < SIZE - 1 && cells[i + 1] && cells[i + 1].v === c.v) return true;
    if (r < SIZE - 1 && cells[i + SIZE] && cells[i + SIZE].v === c.v) return true;
  }
  return false;
}

export const maxTile = (cells) => cells.reduce((m, c) => (c && c.v > m ? c.v : m), 0);

/** Rising pitch for a merge: +3 semitones per doubling, starting at A3. */
export function mergeFreq(v) {
  const steps = Math.max(1, Math.log2(v) - 1);
  return Math.min(2093, 220 * Math.pow(2, (steps * 3) / 12));
}
