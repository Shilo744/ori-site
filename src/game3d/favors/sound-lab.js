// "Ori, Can You...?" — the SOUND LAB: a page (public/soundlab.html, built by `npm run soundlab`) where every sound of the ring and the fight music can be played and judged by ear,
// with the very code the game runs (fight-sfx.js, fight-music.js). Buttons for every sound (grouped, with the loudness it is calibrated to), a scripted fight to hear the mix
// (whooshes that peak at the blow, ducking, slow motion, knock-down count, K.O. and sting), the music with an intensity slider that moves the layers live, the boss track,
// the crowd bed with a love slider, a master volume, a mute switch and a meter (peak, limiter reduction) so clipping is visible.
import { createFightSfx } from './fight-sfx.js';
import { createFightMusic, TRACKS } from './fight-music.js';
import { SOUNDS, STING_LIST, LOUD } from './sound-list.js';

const CSS = `
:root{color-scheme:dark}*{box-sizing:border-box}
body{margin:0;background:#12141c;color:#eef0f7;font:15px/1.4 Inter,system-ui,-apple-system,'Segoe UI',sans-serif}
main{max-width:980px;margin:0 auto;padding:18px 16px 90px}
h1{margin:0 0 2px;font-size:26px;letter-spacing:-.02em}p.sub{margin:0 0 16px;color:#9aa1b8}
h2{margin:26px 0 8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#ffb25b}
.bar{position:sticky;top:0;z-index:5;background:#12141ce6;backdrop-filter:blur(8px);padding:10px 0 12px;margin:0 0 8px;border-bottom:1px solid #2a2f40;display:flex;flex-wrap:wrap;gap:14px 22px;align-items:center}
.bar label{display:flex;gap:8px;align-items:center;color:#c7cce0;font-size:13px}.bar input[type=range]{width:150px}
.meter{position:relative;width:300px;height:14px;border-radius:7px;background:#232838;overflow:hidden}.meter i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#4fe39a,#ffd35b 75%,#ff6b6b)}.meter b{position:absolute;right:6px;top:-2px;font:700 10px/18px Inter,system-ui,sans-serif;color:#fff;white-space:nowrap;text-shadow:0 1px 2px #000}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}
button{font:600 14px Inter,system-ui,sans-serif;color:#fff;background:#252b3d;border:1px solid #343b52;border-radius:12px;padding:11px 12px;text-align:left;cursor:pointer;transition:background .12s,transform .06s}
button:hover{background:#2f3750}button:active{transform:scale(.97)}button small{display:block;color:#8c93ad;font-weight:500;font-size:11px;margin-top:2px}
button.go{background:linear-gradient(135deg,#ffb25b,#ff7a59);color:#20120a;border:0}button.go small{color:#5a2f12}button.on{outline:2px solid #4fe39a}
.row{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;margin:8px 0}.row span{color:#9aa1b8;font-size:13px}
.pill{display:inline-block;padding:3px 10px;border-radius:999px;background:#252b3d;color:#ffd9b0;font-size:12px;font-weight:700}
.note{color:#9aa1b8;font-size:13px;margin:6px 0 0}
`;

export function mountSoundLab(root) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  let muted = false; let vol = 0.9; let labActive = true;
  const sfx = createFightSfx({ isMuted: () => muted, volume: () => vol });
  const music = createFightMusic({ audio: sfx.audio, active: () => labActive });
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const main = el('main'); root.append(main);
  main.append(el('h1', '', 'The Ring — sound lab'), el('p', 'sub', 'Every sound and the fight music, played by the same code as the game. Press anything to start the audio. Numbers under a button: how loud it is calibrated to feel (dBFS, A-weighted).'));

  // ── the bar: volume, mute, slow motion, the meter ──
  const bar = el('div', 'bar');
  const volIn = el('input'); volIn.type = 'range'; volIn.min = 0; volIn.max = 1; volIn.step = 0.01; volIn.value = vol;
  volIn.addEventListener('input', () => { vol = +volIn.value; sfx.audio.ready(); });
  const muteBtn = el('button', '', 'Mute'); muteBtn.addEventListener('click', () => { muted = !muted; muteBtn.classList.toggle('on', muted); muteBtn.firstChild.textContent = muted ? 'Muted' : 'Mute'; sfx.audio.ready(); });
  const slowBtn = el('button', '', 'Slow motion'); let slow = false; slowBtn.addEventListener('click', () => { slow = !slow; slowBtn.classList.toggle('on', slow); sfx.setSlow(slow); });
  const pauseBtn = el('button', '', 'Pause the game'); pauseBtn.addEventListener('click', () => { labActive = !labActive; pauseBtn.classList.toggle('on', !labActive); });
  const meter = el('div', 'meter', '<i></i><b></b>');
  const volLab = el('label', '', 'Volume '); volLab.append(volIn);
  bar.append(volLab, muteBtn, slowBtn, pauseBtn, meter);
  main.append(bar);
  const mi = meter.firstChild; const mb = meter.lastChild;
  let hold = 0;
  const buf = new Float32Array(2048);
  (function loop() {
    const an = sfx.audio.analyser();
    if (an) { an.getFloatTimeDomainData(buf); let p = 0; for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > p) p = a; } hold = Math.max(p, hold * 0.93); mi.style.width = `${Math.min(100, hold * 100)}%`; mb.textContent = `${hold > 0.001 ? (20 * Math.log10(hold)).toFixed(1) : '-∞'} dB  · limiter ${Math.abs(sfx.audio.reduction()).toFixed(1)} dB`; }
    requestAnimationFrame(loop);
  })();

  // ── every sound ──
  const groups = [...new Set(SOUNDS.map((s) => s.group))];
  for (const g of groups) {
    main.append(el('h2', '', g));
    const grid = el('div', 'grid');
    for (const s of SOUNDS.filter((x) => x.group === g)) {
      const b = el('button', '', `${s.label}<small>${s.id} · ${LOUD[s.id] != null ? `${LOUD[s.id]} dBA` : ''}</small>`);
      b.addEventListener('click', () => { sfx.audio.ready(); s.play(sfx); if (s.id.startsWith('crowd')) { b.classList.toggle('on'); if (!b.classList.contains('on')) sfx.crowdStop(); } });
      grid.append(b);
    }
    main.append(grid);
  }

  // ── a whole fight, scripted ──
  main.append(el('h2', '', 'A fight, scripted'));
  const fightRow = el('div', 'row');
  let timers = [];
  const at = (t, fn) => timers.push(setTimeout(fn, t * 1000));
  const clearFight = () => { timers.forEach(clearTimeout); timers = []; music.stop({ now: true }); sfx.crowdStop(); sfx.setSlow(false); slow = false; slowBtn.classList.remove('on'); };
  const punch = (t, who, move, dmg, o = {}) => {
    const wind = { jab: 0.12, cross: 0.2, hook: 0.26, upper: 0.3 }[move] * (who === 'opp' ? 1.9 : 1);
    const w = { jab: 0.45, cross: 0.8, hook: 0.95, upper: 1 }[move];
    at(t, () => sfx.whoosh(wind, w, who === 'player'));
    at(t + wind, () => { if (o.block) sfx.block(dmg * 0.14 + 0.5); else if (o.parry) { sfx.parry(); sfx.setSlow(true); at(0.5, () => sfx.setSlow(false)); } else sfx.thud({ dmg, heavy: dmg >= 13, combo: o.combo || 1, counter: !!o.counter, target: who === 'player' ? 'opp' : 'player' }); if (!o.block && !o.parry && dmg >= 13) sfx.gasp(0.6); });
  };
  const fightA = el('button', 'go', 'Fight night: Ori vs Moti<small>bell · music builds · hits, block, parry, perfect dodge · knock-down and count · K.O. · cheer · sting</small>');
  fightA.addEventListener('click', () => {
    clearFight(); sfx.audio.ready();
    sfx.crowdStart(55); sfx.bell(1);
    at(1.8, () => { sfx.bell(2); music.start({ boss: false, intensity: 0.25 }); });
    punch(2.6, 'player', 'jab', 8); punch(3.1, 'player', 'jab', 8, { combo: 2 }); punch(3.6, 'player', 'cross', 17, { combo: 3 });
    punch(4.6, 'opp', 'jab', 7, { block: true }); punch(5.8, 'opp', 'cross', 15);
    at(6.4, () => music.setIntensity(0.5));
    punch(7.0, 'player', 'cross', 17); punch(8.0, 'opp', 'hook', 20, { parry: true });
    at(8.5, () => sfx.thud({ dmg: 34, heavy: true, counter: true, combo: 2, target: 'opp' }));
    at(8.6, () => { sfx.perfect(); music.setIntensity(0.75); });
    punch(9.6, 'player', 'upper', 31, { combo: 4 });
    at(10.6, () => { sfx.knockdown('opp'); music.pause(true); sfx.gasp(1); });
    at(11.6, () => sfx.count(1)); at(12.6, () => sfx.count(2)); at(13.4, () => { sfx.getup('opp'); music.pause(false); });
    punch(14.4, 'player', 'cross', 17); punch(15.0, 'player', 'upper', 33, { combo: 3, counter: true });
    at(15.6, () => { sfx.ko('opp'); music.stop({ fade: 0.08 }); music.sting('win', 1.6); sfx.cheer(1.4, 1.0); });
    at(20, () => sfx.crowdStop());
  });
  const fightB = el('button', 'go', 'Boss: Ori vs Shilo<small>the "???" lights, glitch blink, the boss track, buffering, the boss falls</small>');
  fightB.addEventListener('click', () => {
    clearFight(); sfx.audio.ready();
    sfx.crowdStart(70); sfx.blink();
    at(2.0, () => { sfx.bell(2); music.start({ boss: true, intensity: 0.5 }); });
    punch(3.0, 'player', 'jab', 8); at(4.0, () => sfx.blink()); punch(4.4, 'opp', 'jab', 9); punch(4.7, 'opp', 'jab', 9, { block: true }); punch(5.0, 'opp', 'cross', 16);
    at(6.6, () => sfx.lag()); punch(7.2, 'player', 'cross', 17, { combo: 2 }); punch(7.8, 'player', 'hook', 22, { combo: 3 });
    at(8.8, () => sfx.blink()); punch(9.4, 'player', 'upper', 33, { combo: 4, counter: true });
    at(10.2, () => { sfx.ko('opp'); music.stop({ fade: 0.08 }); music.sting('boss', 1.6); sfx.cheer(1.4, 1.0); });
    at(15, () => sfx.crowdStop());
  });
  const stopFight = el('button', '', 'Stop everything'); stopFight.addEventListener('click', clearFight);
  fightRow.append(fightA, fightB, stopFight);
  main.append(fightRow);

  // ── the music ──
  main.append(el('h2', '', 'The fight music'));
  const mrow = el('div', 'row');
  const status = el('span', 'pill', 'stopped');
  const inten = el('input'); inten.type = 'range'; inten.min = 0; inten.max = 1; inten.step = 0.01; inten.value = 0.3;
  inten.addEventListener('input', () => music.setIntensity(+inten.value));
  const mk = (label, fn, cls = '') => { const b = el('button', cls, label); b.addEventListener('click', () => { sfx.audio.ready(); fn(); }); return b; };
  mrow.append(
    mk(`Fight track<small>E minor · ${TRACKS.fight.bpm} bpm</small>`, () => { music.start({ boss: false, intensity: +inten.value }); }, 'go'),
    mk(`Boss track<small>C# phrygian · ${TRACKS.boss.bpm} bpm · bit-crushed</small>`, () => { music.start({ boss: true, intensity: Math.max(0.5, +inten.value) }); }, 'go'),
    mk('Stop (fade)', () => music.stop({ fade: 0.3 })),
    mk('Knock-down: whisper', () => music.pause(true)), mk('Get up: back', () => music.pause(false)),
  );
  const irow = el('div', 'row'); const il = el('label', '', 'Intensity '); il.append(inten); irow.append(il, status, el('span', '', 'layers: 0 kick, hats, bass · 1 snare, open hats, stabs · 2 arps, crash · 3 lead, fills, riser (they change on a bar line)'));
  main.append(mrow, irow);
  setInterval(() => { const s = music.stats(); status.textContent = music.playing ? `${s.track} · layer ${s.level} · step ${s.step} · ${s.alive} voices` : 'stopped'; }, 150);
  const srow = el('div', 'row');
  for (const t of STING_LIST) srow.append(mk(`${t.label}`, () => music.sting(t.kind, 0)));
  main.append(el('h2', '', 'Stings'), srow);

  // ── the crowd ──
  main.append(el('h2', '', 'The crowd bed'));
  const crow = el('div', 'row'); const love = el('input'); love.type = 'range'; love.min = 0; love.max = 100; love.value = 40;
  love.addEventListener('input', () => sfx.crowd(+love.value));
  const ll = el('label', '', 'Love of the neighbourhood '); ll.append(love);
  crow.append(mk('Start murmur', () => sfx.crowdStart(+love.value)), mk('Stop murmur', () => sfx.crowdStop()), ll);
  main.append(crow, el('p', 'note', 'A calm check list: every punch should be a little different; the whoosh should peak exactly when the hit lands; a block should sound softer and duller than a hit; the music should duck under big hits and go almost silent during the count; slow motion should dull everything; the bell should ring for seconds.'));
  return { sfx, music, dispose() { clearFight(); music.dispose(); sfx.dispose(); } };
}
