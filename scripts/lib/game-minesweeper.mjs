// End-to-end check for Minesweeper with a REAL mouse: first click safe, flood fill, right-click flag (no context menu),
// chording, flag mode, keyboard, explosion → game over, win → best time + achievement, pause, levels, touch long-press.
// The board is replaced by fixed layouts through the debug hook so the checks are deterministic.
import { join } from 'node:path';
import { SHOTS, sleep, snap } from './harness.mjs';
import * as M from '../../src/ui/games/minesweeper-logic.js';

export async function runMinesweeper(session, { ok, fail }) {
  const { page } = session;
  const tag = `${session.width}x${session.height}`;
  const check = (cond, msg) => (cond ? ok(`minesweeper: ${msg}`) : fail(`minesweeper: ${msg}`));
  const flat = session.width < 860;
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const dbg = (fn, arg) => page.evaluate(([f, a]) => { const d = document.querySelector('.win-minesweeper .wm-body').__debug; return new Function('d', 'a', `return (${f})(d, a)`)(d, a); }, [fn.toString(), arg]);
  const until = (fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout }).then(() => true).catch(() => false);
  const shot = (name) => snap(session, join(SHOTS, 'smoke', `${tag}-game-minesweeper-${name}.png`));
  const kicker = () => ev(() => { const o = document.querySelector('.win-minesweeper .gk-ov'); return o && !o.hidden ? o.querySelector('.gk-kicker').textContent.toLowerCase() : ''; });
  const press = async (key) => { await page.keyboard.press(key); await sleep(60); };
  const pill = (id) => ev((i) => document.querySelector(`.win-minesweeper .gk-pill[data-id="${i}"] b`).textContent, id);

  /** Moves the real mouse until the game reports the pointer is over cell `i` (the screen is a perspective-projected plane). */
  async function aim(i) {
    let p = await dbg((d) => { const c = document.querySelector('.win-minesweeper canvas'); const r = c.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
    const px = await dbg((d) => d.cellPx());
    const [cx, cy] = await dbg((d, k) => d.cellCenter(k), i);
    let x = p.l + (cx * p.w) / px.W, y = p.t + (cy * p.h) / px.H;
    for (let n = 0; n < 8; n++) {
      await page.mouse.move(x - 2, y - 2);
      await page.mouse.move(x, y);
      const h = await dbg((d) => d.hover);
      if (h === i) return { x, y };
      if (h >= 0) {
        const [hx, hy] = await dbg((d, k) => d.cellCenter(k), h);
        x += ((cx - hx) * p.w) / px.W;
        y += ((cy - hy) * p.h) / px.H;
      } else { x += 3; y += 3; }
    }
    throw new Error(`could not aim at cell ${i}`);
  }
  const click = async (i, button = 'left') => { const { x, y } = await aim(i); await page.mouse.click(x, y, { button }); await sleep(40); };

  // ── a clean slate ──
  await ev(() => { const o = window.__ori; o.core.storage.clear('scores:minesweeper'); o.core.storage.remove('minesweeper:level'); o.core.achievements.reset(); o.desktop.reset(); o.openApp('minesweeper'); });
  await until(() => document.querySelector('.win-minesweeper .wm-body')?.__debug, null);
  await sleep(350);
  check((await kicker()) === 'arcade', 'the start card is shown');
  await shot('ready');
  if (flat) { await press('Enter'); check((await dbg((d) => d.phase)) === 'playing', 'flat: Enter starts'); return finish(); }

  // ── levels: Beginner 9×9/10 → Intermediate 16×16/40 → Expert 30×16/99 ──
  await ev(() => document.querySelector('.win-minesweeper .gk-pill[data-id="level"]').click());
  check((await dbg((d) => `${d.cols}x${d.rows}`)) === '16x16' && (await dbg((d) => d.diff)) === 'intermediate', 'the Level button switches to Intermediate (16×16)');
  await ev(() => document.querySelector('.win-minesweeper .gk-pill[data-id="level"]').click());
  check((await dbg((d) => `${d.cols}x${d.rows}`)) === '30x16', 'then to Expert (30×16)');
  await press('Enter');
  check((await dbg((d) => d.phase)) === 'playing' && (await pill('mines')) === '099', 'Enter starts Expert with 099 mines on the counter');
  const kExpert = await ev(() => +document.querySelector('.win-minesweeper .gk-fit').dataset.k);
  const fitsExpert = await ev(() => { const f = document.querySelector('.win-minesweeper .gk-fit').getBoundingClientRect(); const b = document.querySelector('.win-minesweeper .wm-body').getBoundingClientRect(); return f.width <= b.width + 1 && f.height <= b.height + 1; });
  check(fitsExpert && kExpert > 0.3, `the Expert board is scaled to fit the window (×${kExpert.toFixed(2)})`);
  await ev(() => document.querySelector('.win-minesweeper .gk-pill[data-id="level"]').click());
  await press('Enter');
  check((await dbg((d) => d.diff)) === 'beginner' && (await pill('mines')) === '010', 'cycling round gets back to Beginner (010 mines)');

  // ── first click is always safe (real clicks at a corner, an edge and the middle) ──
  let safe = true;
  for (const cell of [0, 8, 80, 40, 4]) {
    await press('KeyN');
    await click(cell);
    const r = await dbg((d, k) => ({ mines: d.mines, opened: d.opened, phase: d.phase, st: d.st[k] }), cell);
    if (r.mines.includes(cell) || r.phase !== 'playing' || r.st !== 1 || r.opened < 4) { safe = false; fail(`minesweeper: first click on ${cell} → ${JSON.stringify({ phase: r.phase, mine: r.mines.includes(cell), opened: r.opened })}`); }
  }
  check(safe, 'the first click (corner / edge / centre) is never a mine and opens an area');
  check((await dbg((d) => d.started)) === true && (await until(() => document.querySelector('.win-minesweeper')?.querySelector('.wm-body').__debug.time > 0.2, null)), 'the timer starts with the first reveal');

  // ── a fixed layout: column 4 is a wall of mines, plus the top-left corner ──
  const MINES = [0, 4, 13, 22, 31, 40, 49, 58, 67, 76];
  await dbg((d, m) => d.load('beginner', m), MINES);
  const mirror = M.boardFor('beginner');
  M.loadMines(mirror, MINES);
  const flood = M.reveal(mirror, 80);
  await click(80);
  const opened1 = await dbg((d) => d.opened);
  check(opened1 === flood.opened.length && opened1 > 10, `a click in the open field flood-fills ${opened1} cells (matches the rules engine)`);
  check((await dbg((d) => d.st[40])) === 0 && (await dbg((d) => d.st[39])) === 0, 'the walled-off half stays closed');
  await shot('flood');

  // ── right-click flags (and the browser context menu never opens) ──
  const menuPrevented = await ev(() => { const c = document.querySelector('.win-minesweeper canvas'); const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); c.dispatchEvent(e); return e.defaultPrevented; });
  check(menuPrevented, 'contextmenu is cancelled inside the game');
  await click(31, 'right');
  check((await dbg((d) => d.st[31])) === 2 && (await pill('mines')) === '009', 'right-click plants a flag (counter 009)');
  await click(31, 'right');
  check((await dbg((d) => d.st[31])) === 0 && (await pill('mines')) === '010', 'right-click again removes it');

  // ── chording: reveal the 3 at (3,4), flag its three neighbours, click it again ──
  await click(39);
  check((await dbg((d) => d.count[39])) === 3 && (await dbg((d) => d.st[39])) === 1, 'the number 3 next to the wall is revealed');
  for (const f of [31, 40, 49]) await click(f, 'right');
  const before = await dbg((d) => d.opened);
  await click(39);
  const after = await dbg((d) => d.opened);
  check(after > before + 5, `clicking the satisfied number chords: ${before} → ${after} cells open`);
  const ph = await dbg((d) => d.phase);
  check(ph === 'won', `no mine was hit - the chord finished the board (phase ${ph})`);
  await ev(() => { window.__ori.core.storage.clear('scores:minesweeper'); window.__ori.core.achievements.reset(); }); // the final win below must be the only recorded one

  // ── flag mode (for touch) + keyboard ──
  await ev(() => document.querySelector('.win-minesweeper .gk-pill[data-id="flag"]').click());
  check((await dbg((d) => d.flagMode)) === true, 'the Flag button turns flag mode on');
  await click(58);
  check((await dbg((d) => d.st[58])) === 2, 'in flag mode a plain click flags');
  await click(58);
  await ev(() => document.querySelector('.win-minesweeper .gk-pill[data-id="flag"]').click());
  await dbg((d) => d.load('beginner', [0, 4, 13, 22, 31, 40, 49, 58, 67, 76]));
  const c0 = await dbg((d) => d.cursor);
  await press('ArrowRight'); await press('ArrowDown');
  check((await dbg((d) => d.cursor)) === c0 + 1 + 9, 'arrow keys move the keyboard cursor');
  await press('KeyF');
  check((await dbg((d, c) => d.st[c], c0 + 10)) === 2, 'F flags the cell under the cursor');
  await press('KeyF');
  await press('Space');
  check((await dbg((d, c) => d.st[c], c0 + 10)) === 1, 'Space reveals it');

  // ── touch: a long press flags, a short tap reveals (synthetic pointer events) ──
  await dbg((d, m) => d.load('beginner', m), MINES);
  const t1 = await aim(66);
  const touch = (type, pos) => ev(({ type: ty, x, y }) => { const c = document.querySelector('.win-minesweeper canvas'); c.dispatchEvent(new PointerEvent(ty, { bubbles: true, pointerType: 'touch', pointerId: 7, isPrimary: true, clientX: x, clientY: y, button: 0, buttons: ty === 'pointerup' ? 0 : 1 })); }, { type, ...pos });
  await touch('pointerdown', t1);
  await sleep(620);
  await touch('pointerup', t1);
  check((await dbg((d) => d.st[66])) === 2 && (await dbg((d) => d.opened)) === 0, 'touch: a long press plants a flag and does not reveal');
  const t2 = await aim(78);
  await touch('pointerdown', t2);
  await sleep(80);
  await touch('pointerup', t2);
  check((await dbg((d) => d.st[78])) === 1, 'touch: a short tap reveals');

  // ── explosion → game over ──
  await dbg((d, m) => d.load('beginner', m), MINES);
  await click(0); // a corner mine
  check((await dbg((d) => d.phase)) === 'exploding' && (await dbg((d) => d.face)) === 'dead', 'clicking a mine explodes (dead face)');
  await sleep(450);
  await shot('boom');
  check(await until(() => { const o = document.querySelector('.win-minesweeper .gk-ov'); return o && !o.hidden && o.querySelector('.gk-kicker').textContent.toLowerCase() === 'boom'; }, null, 20000), 'the game-over card appears after the mines have been revealed');
  check((await dbg((d) => d.phase)) === 'lost', 'phase = lost');
  await press('Enter');
  check((await dbg((d) => d.phase)) === 'playing' && (await dbg((d) => d.opened)) === 0 && (await dbg((d) => d.placed)) === false, 'Enter plays again on a fresh board');

  // ── pause freezes the timer ──
  await click(40);
  await sleep(300);
  await press('KeyP');
  check((await kicker()) === 'paused', 'P pauses (the board is hidden behind the card)');
  const tp = await dbg((d) => d.time);
  await sleep(500);
  check(Math.abs((await dbg((d) => d.time)) - tp) < 0.01, 'the timer stands still while paused');
  await press('KeyP');
  check((await kicker()) === '' && (await dbg((d) => d.phase)) === 'playing', 'P resumes');
  await press('Escape');
  check((await kicker()) === 'paused' && (await ev(() => window.__ori.state === 'screen')), 'Esc pauses and does not leave the screen');
  await press('Space');

  // ── a win: best time, achievement, leaderboard entry ──
  await dbg((d) => d.load('beginner', [10]));
  await dbg((d) => d.setTime(21.4));
  await dbg((d) => { for (let i = 0; i < 81; i++) if (i !== 10) d.reveal(i); });
  check(await until(() => document.querySelector('.win-minesweeper .wm-body').__debug.phase === 'won', null), 'revealing every safe cell wins');
  check(await until(() => { const o = document.querySelector('.win-minesweeper .gk-ov'); return o && !o.hidden && o.querySelector('.gk-kicker').textContent.toLowerCase() === 'cleared'; }, null, 8000), 'the "Cleared" card shows');
  await shot('win');
  const rec = await ev(() => window.__ori.core.storage.get('scores:minesweeper'));
  check(!!rec && rec.lowerIsBetter === true && rec.best >= 21.4 && rec.best < 23 && rec.plays === 1, `the time is stored as a best (lower is better): ${rec && rec.best}s`);
  check(await ev(() => window.__ori.core.achievements.isUnlocked('sweeper')), '"Sweeper" unlocked (Beginner under 60 s)');
  check((await pill('best')).includes('s'), `the Best pill shows the time (${await pill('best')})`);
  check((await dbg((d) => d.face)) === 'cool', 'sunglasses on a win');

  return finish();

  async function finish() {
    await ev(() => { const o = window.__ori; o.desktop.reset(); o.core.achievements.reset(); o.core.storage.clear('scores:minesweeper'); o.core.storage.remove('minesweeper:level'); });
  }
}
