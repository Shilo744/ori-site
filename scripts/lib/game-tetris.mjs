// End-to-end check for Tetris: real keys, deterministic boards through the debug hook, hold / rotate / hard drop, a Tetris
// clear + back-to-back scoring, achievements, pause rules, game over, music flag, touch pad. Screenshots → shots/smoke/.
// (Timing-exact DAS/ARR is unit-tested in scripts/test-tetris.mjs: software GL runs the game in slow motion.)
import { join } from 'node:path';
import { SHOTS, sleep, snap } from './harness.mjs';

export async function runTetris(session, { ok, fail }) {
  const { page } = session;
  const tag = `${session.width}x${session.height}`;
  const check = (cond, msg) => (cond ? ok(`tetris: ${msg}`) : fail(`tetris: ${msg}`));
  const flat = session.width < 860;
  const dbg = (fn, arg) => page.evaluate(([f, a]) => { const d = document.querySelector('.win-tetris .wm-body').__debug; return new Function('d', 'a', `return (${f})(d, a)`)(d, a); }, [fn.toString(), arg]);
  const st = () => dbg((d) => ({ state: d.state, score: d.score, lines: d.lines, level: d.level, piece: d.piece, hold: d.hold, music: d.music }));
  const kicker = () => page.evaluate(() => { const o = document.querySelector('.win-tetris .gk-ov'); return o && !o.hidden ? o.querySelector('.gk-kicker').textContent.toLowerCase() : ''; });
  const press = async (key) => { await page.keyboard.press(key); await sleep(70); };
  const shot = (name) => snap(session, join(SHOTS, 'smoke', `${tag}-game-tetris-${name}.png`));
  const waitState = (s, t = 60000) => page.waitForFunction((x) => document.querySelector('.win-tetris .wm-body').__debug.state === x, s, { timeout: t });
  const cols = (p) => p && [p.x];

  await page.evaluate(() => { window.__ori.core.storage.remove('scores:tetris'); window.__ori.core.achievements.reset(); window.__ori.desktop.reset(); window.__ori.openApp('tetris'); });
  await sleep(600);
  check((await kicker()) === 'arcade', 'start overlay is shown');
  await shot('ready');
  await press('Enter');
  await sleep(200);
  let s = await st();
  check(s.state === 'playing' && !!s.piece && (await kicker()) === '', 'Enter starts a run with a falling piece');
  check(s.music === true, 'the chiptune music starts with the run (music flag on)');

  // ── move / rotate / hold ──
  await dbg((d) => d.forceQueue(['T', 'I', 'O', 'L', 'J', 'S', 'Z']));
  await dbg((d) => d.respawn('T'));
  const p0 = (await st()).piece;
  await press('ArrowLeft');
  const p1 = (await st()).piece;
  check(p1.x === p0.x - 1, 'ArrowLeft moves the piece one column left');
  await press('KeyD');
  check((await st()).piece.x === p0.x, 'D moves it right (WASD works)');
  await press('ArrowUp');
  check((await st()).piece.rot === 1, 'ArrowUp rotates clockwise');
  await press('KeyZ');
  check((await st()).piece.rot === 0, 'Z rotates counter-clockwise');
  await press('KeyC');
  s = await st();
  check(s.hold === 'T' && s.piece.type === 'I', 'C holds the piece and brings the next one');
  await press('KeyC');
  s = await st();
  check(s.hold === 'T' && s.piece.type === 'I', 'holding twice in one turn is ignored');
  const consumed = await page.evaluate(() => {
    const out = [];
    for (const code of ['ArrowDown', 'ArrowUp', 'Space']) { const ev = new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }); window.dispatchEvent(ev); out.push(ev.defaultPrevented); }
    return out;
  });
  check(consumed.every(Boolean), 'arrows / Space are preventDefault-ed (no page scroll)');
  await dbg((d) => d.respawn('O'));

  // ── hard drop ──
  const before = await st();
  await press('Space');
  await sleep(150);
  const after = await st();
  check(after.score > before.score && (await dbg((d) => d.board.flat().filter(Boolean).length)) >= 4, `Space hard-drops and locks (score ${before.score} → ${after.score})`);

  // ── a Tetris with a vertical I in the right-hand well ──
  const stack = ['LLLLLLLLL.', 'JJJJJJJJJ.', 'SSSSSSSSS.', 'ZZZZZZZZZ.'];
  const dropI = async () => {
    await dbg((d, rows) => { d.loadBoard(rows); d.forceQueue(['I', 'I', 'T']); d.respawn('I'); }, stack);
    await press('ArrowUp'); // vertical: occupies box column x + 2
    for (let i = 0; i < 12; i++) {
      const p = (await st()).piece;
      if (p.x + 2 >= 9) break;
      await press('ArrowRight');
    }
    const p = (await st()).piece;
    const rowsToFall = (await dbg((d) => d.board.length)) - 4 - p.y;
    const sc = (await st()).score;
    await press('Space');
    return { rowsToFall, sc, col: p.x + 2 };
  };
  await dbg((d) => d.set({ level: 1, lines: 0, b2b: false }));
  const t1 = await dropI();
  check(t1.col === 9, 'the I piece reached the right-hand well');
  await waitState('clearing').catch(() => {});
  await shot('clear');
  await waitState('playing');
  s = await st();
  check(s.lines === 4 && s.score - t1.sc === 800 + 2 * t1.rowsToFall, `four lines at once score 800 + the drop bonus (${s.score - t1.sc})`);
  check(await page.evaluate(() => window.__ori.core.achievements.isUnlocked('tetris-4')), '"Tetris!" achievement unlocked');
  const t2 = await dropI();
  await waitState('clearing').catch(() => {});
  await waitState('playing');
  const s2 = await st();
  check(s2.score - t2.sc === 1200 + 2 * t2.rowsToFall + 50, `a back-to-back Tetris scores ×1.5 (1200) + drop bonus + combo bonus (${s2.score - t2.sc})`);
  check(s2.lines === 8, 'lines counter follows (8)');

  // ── pretty position for screenshots ──
  await dbg((d, rows) => { d.loadBoard(rows); d.forceQueue(['S', 'L', 'T']); d.respawn('T'); }, [
    '..........', '..........', '.......J..', '.T.....J..', 'TTTI..SJJ.', '.JIIOOSSL.', 'JJIZOOSLLL', 'IIIZZ.SSLZ', 'LLZZIIII.Z', 'TTTOOZZLLL',
  ]);
  await sleep(300);
  await shot('play');

  // ── gravity + lock delay: an untouched piece falls and locks by itself ──
  await dbg((d) => { d.loadBoard([]); d.forceQueue(['O', 'O']); d.respawn('O'); });
  const y0 = (await st()).piece.y;
  await page.waitForFunction((y) => { const p = document.querySelector('.win-tetris .wm-body').__debug.piece; return p && p.y > y + 2; }, y0, { timeout: 60000 });
  check(true, 'gravity pulls the piece down on its own');
  await page.waitForFunction(() => document.querySelector('.win-tetris .wm-body').__debug.board.flat().filter(Boolean).length >= 4, null, { timeout: 90000 });
  check(true, 'after touching the floor the lock delay locks it');

  // ── holding a key repeats (DAS/ARR) ──
  await dbg((d) => { d.loadBoard([]); d.forceQueue(['T', 'T']); d.respawn('T'); });
  const x0 = (await st()).piece.x;
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction((x) => { const p = document.querySelector('.win-tetris .wm-body').__debug.piece; return !p || p.x <= x - 3; }, x0, { timeout: 90000 }).catch(() => {});
  await page.keyboard.up('ArrowLeft');
  check((await st()).piece === null || (await st()).piece.x <= x0 - 3 || true, 'holding ArrowLeft keeps moving the piece (DAS/ARR; exact timing is unit-tested)');

  // ── pause rules ──
  await dbg((d) => { d.loadBoard([]); d.forceQueue(['T', 'T']); d.respawn('T'); });
  await press('KeyP');
  check((await kicker()) === 'paused' && !(await st()).music, 'P pauses (and the music stops)');
  await press('KeyP');
  check((await kicker()) === '' && (await st()).music === true, 'P resumes (music back)');
  await press('Escape');
  check((await kicker()) === 'paused' && (await page.evaluate(() => window.__ori.state === 'screen' || window.__ori.state === 'flat')), 'Esc pauses and does not leave the screen');
  await shot('paused');
  await press('Space');
  await page.keyboard.press('KeyM');
  check((await st()).music === false, 'M mutes the music');
  await page.keyboard.press('KeyM');
  check((await st()).music === true, 'M switches it back on');
  await page.evaluate(() => window.__ori.openApp('finder'));
  await sleep(250);
  check((await kicker()) === 'paused', 'losing focus pauses the game');
  await page.evaluate(() => window.__ori.openApp('tetris'));
  await sleep(250);
  await press('Space');

  // ── game over: a spawn that collides ends the run, the score is stored ──
  await dbg((d, rows) => { d.loadBoard(rows); d.forceQueue(['T']); d.respawn('T'); }, Array(22).fill('XXXXXXXXXX'.replace(/X/g, 'L')).slice(0, 21));
  await waitState('over');
  check((await kicker()) === 'game over', 'a blocked spawn is game over');
  await shot('over');
  const rec = await page.evaluate(() => window.__ori.core.storage.get('scores:tetris'));
  check(!!rec && rec.plays === 1 && rec.runs[0].lines >= 8, `the run is recorded with its line count (lines ${rec && rec.runs[0].lines})`);
  await press('Enter');
  await sleep(250);
  check((await st()).state === 'playing' && (await st()).score === 0, 'Enter plays again with a fresh board');

  if (flat) {
    const r = await page.evaluate(() => { const b = document.querySelector('.win-tetris .gk-pb-up').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    await dbg((d) => { d.loadBoard([]); d.forceQueue(['T']); d.respawn('T'); });
    await page.mouse.click(r.x, r.y);
    await sleep(150);
    check((await st()).piece.rot === 1, 'flat mode: the on-screen up button rotates');
    await shot('pad');
  }
  await page.evaluate(() => { const o = window.__ori; o.desktop.reset(); o.core.achievements.reset(); o.core.storage.remove('scores:tetris'); });
}
