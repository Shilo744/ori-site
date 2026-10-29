// "Ori, Can You...?" — the office computer: a little CRT monitor over the street (DOM + a canvas), a boot screen, a menu of games and the games themselves
// (arcade.js). A game inside the game, inside a computer. Esc leaves. The score pays peaches (the game calls `onDone`).
import './arcade.css';
import { GAMES, createTetrisRun, createRun2048, createSnakeRun, peachesFor, SNAKE } from './arcade.js';
import { createKeyPad } from './key-pad.js';
import { arcadePad } from './touch.js';

const TETRIS_COLORS = ['#000', '#37e0f0', '#f2d33a', '#b06af0', '#5fd45f', '#f05f5f', '#4f7ff0', '#f09a3a'];
const TILE = { 0: '#2a2c36', 2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563', 32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72', 256: '#edcc61', 512: '#edc850', 1024: '#edc53f', 2048: '#edc22e' };

export function createArcade({ root, sfx }) {
  const el = document.createElement('div');
  el.className = 'ar';
  el.hidden = true;
  el.innerHTML = '<div class="ar-mon"><div class="ar-screen"><canvas width="360" height="440"></canvas><div class="ar-scan"></div></div><div class="ar-base"><i></i><b>ORI-OS</b><small>Esc: back to work</small></div></div>';
  root.append(el);
  const cv = el.querySelector('canvas');
  const g = cv.getContext('2d');
  const pad = createKeyPad({ root: el, label: 'Computer controls' }); // (on a touch device: big buttons that send the same keys the keyboard would)
  const K = (keys, touch) => (pad.visible ? touch : keys); // (the hint line on the screen: keys or buttons)
  let padOver = false;
  let mode = 'off'; // off | boot | menu | tetris | 2048 | snake
  let t = 0;
  let game = null;
  let cb = null;
  let sel = 0;
  let raf = 0;
  let lastTs = 0;
  let das = { dir: 0, t: 0, acc: 0 };
  let overT = 0;
  let result = null;
  let best = { tetris: 0, '2048': 0, snake: 0 };

  const text = (str, x, y, size = 16, color = '#7fffb0', align = 'left') => { g.font = `700 ${size}px ui-monospace, 'Cascadia Mono', Consolas, monospace`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'top'; g.fillText(str, x, y); };
  const bg = () => { g.fillStyle = '#06100c'; g.fillRect(0, 0, 360, 440); };

  function drawBoot() {
    bg();
    const lines = ['ORI-OS 1.0 (c) the startup', 'checking coffee........ OK', 'loading games.......... OK', 'warming up a world inside a world...', '', 'Welcome back, Ori.'];
    const n = Math.min(lines.length, Math.floor(t / 0.35) + 1);
    for (let i = 0; i < n; i++) text(lines[i], 16, 24 + i * 24, 15);
    if (t > 2.6) setMode('menu');
  }
  function drawMenu() {
    bg();
    text('GAMES', 180, 26, 26, '#7fffb0', 'center');
    GAMES.forEach((gm, i) => {
      const y = 90 + i * 74;
      g.fillStyle = i === sel ? '#12301f' : '#0a1812'; g.fillRect(24, y, 312, 60);
      g.strokeStyle = i === sel ? '#7fffb0' : '#1f4a33'; g.lineWidth = 2; g.strokeRect(24, y, 312, 60);
      text(`${i + 1}. ${gm.name}`, 40, y + 10, 22, i === sel ? '#d6ffe6' : '#7fffb0');
      text(gm.blurb, 40, y + 38, 12, '#4fa57a');
      text(`best ${best[gm.id] || 0}`, 330, y + 10, 12, '#4fa57a', 'right');
      if (gm.fresh) text('NEW', 330, y + 38, 12, '#f2d33a', 'right');
    });
    text(K(`W/S or 1-${GAMES.length} choose · Space plays`, 'Up / Down choose · Play starts it'), 180, 380, 12, '#4fa57a', 'center');
    text(K('Esc: back to work', 'Back: back to work'), 180, 402, 12, '#4fa57a', 'center');
  }
  function drawTetris() {
    const v = game.view();
    bg();
    const cell = 18; const ox = 20; const oy = 16;
    g.fillStyle = '#0c1a14'; g.fillRect(ox - 4, oy - 4, 10 * cell + 8, 20 * cell + 8);
    g.strokeStyle = '#1f4a33'; g.lineWidth = 1;
    for (let y = 0; y < 20; y++) for (let x = 0; x < 10; x++) { g.strokeRect(ox + x * cell + 0.5, oy + y * cell + 0.5, cell - 1, cell - 1); }
    for (let y = 0; y < v.rows.length; y++) for (let x = 0; x < 10; x++) { const c = v.rows[y][x]; if (c) { g.fillStyle = TETRIS_COLORS[c]; g.fillRect(ox + x * cell + 1, oy + y * cell + 1, cell - 2, cell - 2); } }
    for (const [x, y] of v.ghost) { g.strokeStyle = 'rgba(127,255,176,0.55)'; g.strokeRect(ox + x * cell + 1.5, oy + y * cell + 1.5, cell - 3, cell - 3); }
    const col = TETRIS_COLORS[['I', 'O', 'T', 'S', 'Z', 'J', 'L'].indexOf(v.type) + 1];
    for (const [x, y] of v.piece) { g.fillStyle = col; g.fillRect(ox + x * cell + 1, oy + y * cell + 1, cell - 2, cell - 2); }
    text('SCORE', 240, 24, 13, '#4fa57a'); text(String(v.score), 240, 42, 22);
    text('LINES', 240, 84, 13, '#4fa57a'); text(String(v.lines), 240, 102, 22);
    text('LEVEL', 240, 144, 13, '#4fa57a'); text(String(v.level), 240, 162, 22);
    text('NEXT', 240, 206, 13, '#4fa57a');
    v.next.forEach((tp, i) => { g.fillStyle = TETRIS_COLORS[['I', 'O', 'T', 'S', 'Z', 'J', 'L'].indexOf(tp) + 1]; g.fillRect(244, 228 + i * 30, 52, 16); text(tp, 306, 226 + i * 30, 14); });
    text(K('A D move · W turn · S drop', 'Slide · Turn · Drop'), 180, 392, 11, '#4fa57a', 'center');
    text(K('Space: slam · Esc: leave', 'Slam drops it · Back: leave'), 180, 410, 11, '#4fa57a', 'center');
    if (v.over) overlay('GAME OVER', `${v.score} points`);
  }
  function draw2048() {
    const v = game.view();
    bg();
    text('2048', 24, 20, 30);
    text(`SCORE ${v.score}`, 336, 28, 16, '#7fffb0', 'right');
    const size = 76; const gap = 8; const ox = 24; const oy = 80;
    g.fillStyle = '#12301f'; g.fillRect(ox - 6, oy - 6, 4 * size + 3 * gap + 12, 4 * size + 3 * gap + 12);
    v.values.forEach((val, i) => {
      const x = ox + (i % 4) * (size + gap); const y = oy + Math.floor(i / 4) * (size + gap);
      g.fillStyle = TILE[val] || '#3c3a32'; g.fillRect(x, y, size, size);
      if (val) text(String(val), x + size / 2, y + size / 2 - (val > 1000 ? 9 : 12), val > 1000 ? 20 : val > 100 ? 24 : 28, val <= 4 ? '#6a5e50' : '#fff', 'center');
    });
    text(K('A D W S slide · Esc: leave', 'Arrows slide · Back: leave'), 180, 410, 12, '#4fa57a', 'center');
    if (v.over) overlay(v.won ? 'YOU MADE 2048!' : 'NO MOVES LEFT', `${v.score} points`);
  }
  function drawSnake() {
    const v = game.view();
    bg();
    const cell = 18; const ox = 18; const oy = 40;
    text('SNAKE', 18, 10, 22);
    text(`SCORE ${v.score}`, 342, 12, 16, '#7fffb0', 'right');
    g.fillStyle = '#0c1a14'; g.fillRect(ox - 3, oy - 3, SNAKE.cols * cell + 6, SNAKE.rows * cell + 6);
    g.strokeStyle = '#13291e'; g.lineWidth = 1;
    for (let x = 0; x <= SNAKE.cols; x++) { g.beginPath(); g.moveTo(ox + x * cell + 0.5, oy); g.lineTo(ox + x * cell + 0.5, oy + SNAKE.rows * cell); g.stroke(); }
    for (let y = 0; y <= SNAKE.rows; y++) { g.beginPath(); g.moveTo(ox, oy + y * cell + 0.5); g.lineTo(ox + SNAKE.cols * cell, oy + y * cell + 0.5); g.stroke(); }
    if (v.food) { const fx = ox + v.food[0] * cell + cell / 2; const fy = oy + v.food[1] * cell + cell / 2; g.fillStyle = '#ff9d6e'; g.beginPath(); g.arc(fx, fy + 1, cell / 2 - 2, 0, Math.PI * 2); g.fill(); g.fillStyle = '#5fd45f'; g.fillRect(fx - 1, fy - cell / 2 + 1, 4, 3); }
    v.snake.forEach(([x, y], i) => { g.fillStyle = i === 0 ? '#d6ffe6' : i % 2 ? '#37c871' : '#2fb866'; g.fillRect(ox + x * cell + 1, oy + y * cell + 1, cell - 2, cell - 2); });
    text(`LENGTH ${v.length} · LEVEL ${v.level}`, 180, 408, 12, '#4fa57a', 'center');
    text(K('A D W S steer · Esc: leave', 'Arrows steer · Back: leave'), 180, 424, 11, '#4fa57a', 'center');
    if (v.over) overlay(v.won ? 'THE WHOLE BOARD!' : 'GAME OVER', `${v.score} points`);
  }
  function overlay(a, b) {
    g.fillStyle = 'rgba(2,10,6,0.78)'; g.fillRect(0, 140, 360, 140);
    text(a, 180, 160, 26, '#d6ffe6', 'center'); text(b, 180, 198, 18, '#7fffb0', 'center');
    text(K('Space: back to the menu', 'Menu: back to the games'), 180, 240, 13, '#4fa57a', 'center');
  }

  function setMode(m) { mode = m; t = 0; overT = 0; syncPad(); }
  /** The touch pad follows the screen: boot, menu, a game, or a finished run (every one of them has a way out). */
  function syncPad() {
    padOver = !!((mode === 'tetris' || mode === '2048' || mode === 'snake') && game && game.view().over);
    pad.set(mode === 'off' ? null : arcadePad(mode, padOver));
    el.classList.toggle('kp-on', pad.visible);
  }
  function finishRun() {
    if (!game || result) return;
    const id = mode;
    const v = game.view();
    const score = v.score;
    best[id] = Math.max(best[id], score);
    result = { game: id, score, peaches: peachesFor(id, score) };
    if (cb && cb.done) cb.done(result);
  }
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    t += dt;
    if (mode === 'boot') drawBoot();
    else if (mode === 'menu') drawMenu();
    else if (mode === 'tetris') {
      if (game.view().over) { overT += dt; if (overT > 0.01) finishRun(); } else {
        if (das.dir) { das.t += dt; if (das.t > 0.16) { das.acc += dt; while (das.acc > 0.045) { das.acc -= 0.045; game.move(das.dir); } } }
        game.update(dt);
      }
      drawTetris();
    } else if (mode === '2048') { draw2048(); if (game.view().over) finishRun(); }
    else if (mode === 'snake') { if (game.view().over) { overT += dt; if (overT > 0.01) finishRun(); } else game.update(dt); drawSnake(); }
    if ((mode === 'tetris' || mode === '2048' || mode === 'snake') && game && game.view().over !== padOver) syncPad();
  }

  function start(id, seed) {
    result = null; das = { dir: 0, t: 0, acc: 0 };
    game = id === 'tetris' ? createTetrisRun({ seed }) : id === 'snake' ? createSnakeRun({ seed }) : createRun2048({ seed });
    setMode(id);
    sfx.tap();
  }
  const held = new Set();
  const onUp = (e) => {
    held.delete(e.code);
    if (mode === 'tetris') { if ((e.code === 'KeyA' || e.code === 'ArrowLeft') && das.dir === -1) das = { dir: 0, t: 0, acc: 0 }; if ((e.code === 'KeyD' || e.code === 'ArrowRight') && das.dir === 1) das = { dir: 0, t: 0, acc: 0 }; if (e.code === 'KeyS' || e.code === 'ArrowDown') game.soft(false); }
  };
  window.addEventListener('keyup', onUp, true);
  // a tap on the screen itself: the boot screen starts, the menu picks the game under the finger (the rows are the ones drawMenu draws: y = 90 + 74 i, 60 high)
  cv.addEventListener('pointerdown', (e) => {
    if (mode === 'boot') { setMode('menu'); return; }
    if (mode !== 'menu') return;
    const r = cv.getBoundingClientRect();
    const y = (e.clientY - r.top) * (440 / r.height);
    const i = Math.floor((y - 90) / 74);
    if (i >= 0 && i < GAMES.length && y - (90 + i * 74) <= 60) { sel = i; start(GAMES[i].id, Math.floor(performance.now())); }
  });

  return {
    get isOpen() { return mode !== 'off'; },
    get mode() { return mode; },
    /** Opens the computer. `callbacks.done({ game, score, peaches })` when a run ends; `callbacks.close()` when it is switched off. */
    open(callbacks = {}, best0 = {}) { cb = callbacks; best = { ...best, ...best0 }; el.hidden = false; setMode('boot'); sel = 0; lastTs = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); sfx.tap(); },
    close() { if (mode === 'off') return; mode = 'off'; syncPad(); el.hidden = true; cancelAnimationFrame(raf); const c = cb; cb = null; game = null; if (c && c.close) c.close(); },
    /** Keys: true when used (everything is, while the computer is on). */
    key(e) {
      if (mode === 'off') return false;
      if (e.code === 'Escape') { if (mode === 'tetris' || mode === '2048' || mode === 'snake') { setMode('menu'); game = null; } else this.close(); return true; }
      if (e.repeat && mode === 'tetris' && !['KeyS', 'ArrowDown'].includes(e.code)) return true;
      held.add(e.code);
      if (mode === 'boot') { if (e.code === 'Space' || e.code === 'Enter') setMode('menu'); return true; }
      if (mode === 'menu') {
        if (e.code === 'KeyW' || e.code === 'ArrowUp') sel = (sel + GAMES.length - 1) % GAMES.length;
        else if (e.code === 'KeyS' || e.code === 'ArrowDown') sel = (sel + 1) % GAMES.length;
        else if (/^Digit[1-9]$/.test(e.code) && Number(e.code.slice(5)) <= GAMES.length) { sel = Number(e.code.slice(5)) - 1; start(GAMES[sel].id, Math.floor(performance.now())); } else if (e.code === 'Space' || e.code === 'Enter') start(GAMES[sel].id, Math.floor(performance.now()));
        return true;
      }
      if (mode === 'tetris') {
        if (game.view().over) { if (e.code === 'Space' || e.code === 'Enter') { setMode('menu'); game = null; } return true; }
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') { game.move(-1); das = { dir: -1, t: 0, acc: 0 }; } else if (e.code === 'KeyD' || e.code === 'ArrowRight') { game.move(1); das = { dir: 1, t: 0, acc: 0 }; } else if (e.code === 'KeyS' || e.code === 'ArrowDown') game.soft(true);
        else if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'KeyX') game.rotate(1); else if (e.code === 'KeyZ') game.rotate(-1); else if (e.code === 'Space') { game.hardDrop(); sfx.pop(); }
        return true;
      }
      if (mode === 'snake') {
        if (game.view().over) { if (e.code === 'Space' || e.code === 'Enter') { setMode('menu'); game = null; } return true; }
        const d = { KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down' }[e.code];
        if (d && game.turn(d)) sfx.tap();
        return true;
      }
      if (mode === '2048') {
        if (game.view().over) { if (e.code === 'Space' || e.code === 'Enter') { setMode('menu'); game = null; } return true; }
        const d = { KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down' }[e.code];
        if (d && game.move(d)) sfx.tap();
        return true;
      }
      return true;
    },
    /** Dev / tests: the run in hand (to play it by script). */
    get run() { return game; },
    startGame: start,
    dispose() { cancelAnimationFrame(raf); window.removeEventListener('keyup', onUp, true); pad.dispose(); el.remove(); },
  };
}
