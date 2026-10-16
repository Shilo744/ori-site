// Minesweeper rules (pure, no DOM): board model, first-click-safe mine placement, flood-fill reveal with BFS depth (for the
// ripple animation), flags, chording, win test. Unit-tested in scripts/test-minesweeper.mjs.
export const DIFFICULTIES = {
  beginner: { id: 'beginner', name: 'Beginner', cols: 9, rows: 9, mines: 10 },
  intermediate: { id: 'intermediate', name: 'Intermediate', cols: 16, rows: 16, mines: 40 },
  expert: { id: 'expert', name: 'Expert', cols: 30, rows: 16, mines: 99 },
};
export const DIFFICULTY_IDS = Object.keys(DIFFICULTIES);

export const HIDDEN = 0, OPEN = 1, FLAG = 2;

/** Small deterministic PRNG (tests, seeds). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An empty board; mines are placed on the first reveal so the first click is always safe. */
export function createBoard(cols, rows, mines) {
  const n = cols * rows;
  const nb = new Array(n);
  for (let i = 0; i < n; i++) {
    const x = i % cols, y = (i - x) / cols, list = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) list.push(ny * cols + nx);
    }
    nb[i] = list;
  }
  return {
    cols, rows, n, nb, minesTotal: Math.max(0, Math.min(mines, n - 1)),
    mine: new Uint8Array(n), count: new Uint8Array(n), st: new Uint8Array(n),
    placed: false, opened: 0, flags: 0,
  };
}

export const boardFor = (difficulty) => {
  const d = typeof difficulty === 'string' ? DIFFICULTIES[difficulty] : difficulty;
  return createBoard(d.cols, d.rows, d.mines);
};

function recount(b) {
  for (let i = 0; i < b.n; i++) { let c = 0; for (const j of b.nb[i]) c += b.mine[j]; b.count[i] = c; }
}

/** Puts `board.minesTotal` mines everywhere except around `safeIndex` (the clicked cell and its neighbours when there is room). */
export function placeMines(b, safeIndex, rng = Math.random) {
  const blocked = new Set([safeIndex]);
  if (b.n - 9 >= b.minesTotal) b.nb[safeIndex].forEach((j) => blocked.add(j));
  const pool = [];
  for (let i = 0; i < b.n; i++) if (!blocked.has(i)) pool.push(i);
  if (pool.length < b.minesTotal) throw new Error('too many mines');
  for (let k = 0; k < b.minesTotal; k++) { // partial Fisher–Yates
    const r = k + Math.floor(rng() * (pool.length - k));
    [pool[k], pool[r]] = [pool[r], pool[k]];
    b.mine[pool[k]] = 1;
  }
  b.placed = true;
  recount(b);
}

/** Loads a fixed layout (tests, the e2e harness): `mineIndices` become the mines; flags / open cells are cleared. */
export function loadMines(b, mineIndices) {
  b.mine.fill(0);
  b.st.fill(HIDDEN);
  b.opened = 0;
  b.flags = 0;
  mineIndices.forEach((i) => { b.mine[i] = 1; });
  b.minesTotal = mineIndices.length;
  b.placed = true;
  recount(b);
}

function floodFrom(b, starts, out) {
  let frontier = [];
  starts.forEach((s) => {
    if (b.st[s] === HIDDEN) { b.st[s] = OPEN; b.opened++; out.opened.push({ i: s, d: 0 }); frontier.push(s); }
  });
  let d = 0;
  while (frontier.length) {
    d++;
    const next = [];
    for (const c of frontier) {
      if (b.count[c] !== 0) continue; // numbers stop the flood
      for (const j of b.nb[c]) {
        if (b.st[j] !== HIDDEN) continue; // flags and open cells are left alone
        b.st[j] = OPEN;
        b.opened++;
        out.opened.push({ i: j, d });
        next.push(j);
      }
    }
    frontier = next;
  }
}

/**
 * Reveals cell `i` (flood-filling zeros). Returns { opened: [{ i, d }], mine } — `d` is the BFS depth from `i`
 * (drives the ripple), `mine` is the index of the mine that was hit or -1.
 */
export function reveal(b, i, rng = Math.random) {
  const out = { opened: [], mine: -1 };
  if (b.st[i] !== HIDDEN) return out;
  if (!b.placed) placeMines(b, i, rng);
  if (b.mine[i]) { b.st[i] = OPEN; out.mine = i; out.opened.push({ i, d: 0 }); return out; }
  floodFrom(b, [i], out);
  return out;
}

/** Toggles a flag on a hidden cell. Returns true if something changed. */
export function toggleFlag(b, i) {
  if (b.st[i] === HIDDEN) { b.st[i] = FLAG; b.flags++; return true; }
  if (b.st[i] === FLAG) { b.st[i] = HIDDEN; b.flags--; return true; }
  return false;
}

export const flaggedAround = (b, i) => b.nb[i].reduce((n, j) => n + (b.st[j] === FLAG ? 1 : 0), 0);

/** Chording: on an open number whose flag count matches, reveal every other neighbour. { opened, mine, hits } */
export function chord(b, i) {
  const out = { opened: [], mine: -1, hits: [] };
  if (b.st[i] !== OPEN || b.count[i] === 0 || flaggedAround(b, i) !== b.count[i]) return out;
  const targets = b.nb[i].filter((j) => b.st[j] === HIDDEN);
  for (const j of targets) {
    if (b.mine[j]) {
      b.st[j] = OPEN;
      out.hits.push(j);
      out.opened.push({ i: j, d: 0 });
      if (out.mine < 0) out.mine = j;
    }
  }
  floodFrom(b, targets.filter((j) => !b.mine[j]), out);
  return out;
}

/** Every safe cell is open. */
export const isWon = (b) => b.placed && b.opened === b.n - b.minesTotal;
export const minesLeft = (b) => b.minesTotal - b.flags;
export const minesAt = (b) => { const r = []; for (let i = 0; i < b.n; i++) if (b.mine[i]) r.push(i); return r; };
/** Flags on cells that are not mines (shown crossed out after an explosion). */
export const wrongFlags = (b) => { const r = []; for (let i = 0; i < b.n; i++) if (b.st[i] === FLAG && !b.mine[i]) r.push(i); return r; };
export const indexOf = (b, x, y) => y * b.cols + x;
export const xyOf = (b, i) => [i % b.cols, Math.floor(i / b.cols)];

/** Seconds → "m:ss.t" for the leaderboard. */
export function formatTime(s) {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return m ? `${m}:${r.toFixed(1).padStart(4, '0')}` : `${r.toFixed(1)}s`;
}
