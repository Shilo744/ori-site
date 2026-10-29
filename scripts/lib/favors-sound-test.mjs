// "Ori, Can You...?" browser check of the SOUND of the ring, in the real game with the real keyboard: the fight music plays while a bout is on (a tap on the master measures it:
// not silent, never clipping), builds when somebody is hurt, goes down to a whisper in a knock-down count and comes back at the get-up, stops on the K.O.; the sounds come and go
// without leaving a node behind; a paused game goes quiet; leaving the ring stops everything; quitting closes the audio.   node scripts/e2e-block.mjs favors-sound
import { sleep } from './harness.mjs';

export async function runFavorsSound(session, { ok, fail }) {
  const { page } = session;
  const check = (cond, msg) => (cond ? ok(`sound: ${msg}`) : fail(`sound: ${msg}`));
  const g = (fn, arg) => page.evaluate(fn, arg);
  const press = async (k, ms = 40) => { await page.keyboard.down(k); await sleep(ms); await page.keyboard.up(k); };
  const F = 'window.__ori.game3d.game.fight';

  await g(() => window.__ori.game3d.launch('favors', { quick: true }));
  await page.waitForFunction(() => window.__ori.game3d.running && window.__ori.game3d.state() && window.__ori.game3d.state().phase === 'play', null, { timeout: 60000 });
  await g(() => { const x = window.__ori.game3d; x.setHour(15); x.game.setWeather({ rain: 0, wet: 0, overcast: 0 }); });
  await g(() => { const gm = window.__ori.game3d.game; gm.campaign.state.boxer.level = 6; gm.campaign.state.love = 50; gm.fight.setCrowd(50); const p = gm.fight.apron(); window.__ori.game3d.teleport({ x: p.x, z: p.z }, Math.PI); });
  await sleep(700);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.menuOpen, null, { timeout: 5000 });
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.phase === 'intro', null, { timeout: 15000 });
  await sleep(600);
  check(await g(() => !window.__ori.game3d.game.fight.music.playing), 'the music waits for the bell: nothing plays in the intro');
  // a spy on the calls the fight makes (the events of the sim -> the sounds)
  await g(() => {
    const f = window.__ori.game3d.game.fight; window.__calls = [];
    for (const m of ['thud', 'whoosh', 'block', 'parry', 'knockdown', 'count', 'getup', 'ko', 'cheer', 'bell']) { const o = f.sfx[m]; f.sfx[m] = (...a) => { window.__calls.push([m, ...a.map((x) => (x && typeof x === 'object' ? { dmg: x.dmg, heavy: x.heavy, counter: x.counter, target: x.target } : x))]); return o(...a); }; }
    const ms = f.music.sting; f.music.sting = (...a) => { window.__calls.push(['sting', ...a]); return ms(...a); };
  });
  await page.waitForFunction(() => window.__ori.game3d.game.fight.phase === 'fight', null, { timeout: 15000 });
  await sleep(1200);
  check(await g(() => window.__ori.game3d.game.fight.sfx.audio.ctx && window.__ori.game3d.game.fight.sfx.audio.ctx.state === 'running'), 'the AudioContext is running (the game was opened by a key press)');

  /** Listens to the master for `ms`: { peak, rms } of what is going to the speakers. */
  const listen = (ms) => g((ms) => new Promise((resolve) => {
    const an = window.__ori.game3d.game.fight.sfx.audio.analyser();
    const buf = new Float32Array(an.fftSize); let peak = 0; let sum = 0; let n = 0; const t0 = performance.now();
    const id = setInterval(() => { an.getFloatTimeDomainData(buf); for (const v of buf) { const a = Math.abs(v); if (a > peak) peak = a; sum += v * v; n++; } if (performance.now() - t0 > ms) { clearInterval(id); resolve({ peak, rms: Math.sqrt(sum / n) }); } }, 30);
  }), ms);
  const L = await listen(1200);
  const db = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
  check(await g(() => window.__ori.game3d.game.fight.music.playing), 'FIGHT! starts the music');
  check(L.rms > 0.004 && L.peak < 0.98, `what reaches the speakers is not silent and does not clip (rms ${db(L.rms).toFixed(1)} dBFS, peak ${db(L.peak).toFixed(1)} dBFS)`);
  const st0 = await g(() => window.__ori.game3d.game.fight.music.stats());
  check(st0.track === 'fight' && st0.bpm === 128 && st0.step > 8, `the fight track (${st0.bpm} bpm, step ${st0.step}, layer ${st0.level})`);

  // a punch is a sound: nodes appear and are all gone a few seconds later
  await g(() => { const b = window.__ori.game3d.game.fight.bout; b.P.x = 0; b.P.z = 0.5; b.O.x = 0; b.O.z = -0.85; b.O.hp = b.O.maxHp; });
  await g(() => { window.__calls.length = 0; });
  await press('KeyJ'); await sleep(450);
  const calls1 = await g(() => window.__calls.slice());
  const iw = calls1.findIndex((c) => c[0] === 'whoosh' && c[3] === true); const ih = calls1.findIndex((c, i) => i > iw && c[0] === 'thud' && c[1].target === 'opp');
  check(iw >= 0 && ih > iw && calls1[iw][1] > 0.05 && calls1[ih][1].dmg > 3, `a jab: the whoosh (wind-up ${iw >= 0 ? calls1[iw][1].toFixed(2) : '?'} s, Ori's own) comes first, then the thud (${ih >= 0 ? Math.round(calls1[ih][1].dmg) : '?'} damage on the opponent)`);

  // the music builds when somebody is hurt (on a bar line: give it a few bars)
  await g(() => { const b = window.__ori.game3d.game.fight.bout; b.O.hp = b.O.maxHp * 0.12; b.O.x = 0; b.O.z = -2.6; });
  let lvl = 0;
  for (let i = 0; i < 50 && lvl < 3; i++) { await sleep(300); lvl = await g(() => window.__ori.game3d.game.fight.music.level); }
  check(lvl >= 2, `the music builds as the opponent is hurt: layer ${lvl} (of 3)`);

  // slow motion dulls the mix and lets go again
  await g(() => { window.__ori.game3d.game.fight.bout.slow = 0.4; });
  await sleep(150);
  const slowOn = await g(() => window.__ori.game3d.game.fight.sfx.audio.slow);
  await sleep(700);
  const slowOff = await g(() => window.__ori.game3d.game.fight.sfx.audio.slow);
  check(slowOn && !slowOff, 'slow motion dulls the mix for as long as it lasts');

  // a paused game goes quiet, a running one is back on a bar line
  await g(() => window.__ori.game3d.game.pause());
  await sleep(1300);
  const gp = await g(() => window.__ori.game3d.game.fight.music.stats().gate);
  await g(() => window.__ori.game3d.game.resume());
  await sleep(1500);
  const gr = await g(() => window.__ori.game3d.game.fight.music.stats().gate);
  check(gp < 0.02 && gr > 0.9, `pausing the game silences the music (gate ${gp.toFixed(3)}), resuming brings it back (${gr.toFixed(2)})`);

  // knock-down: the music is a whisper for the count, back at the get-up; the K.O. stops it
  let sawDown = false; let whisper = 1; let back = 0; let koDone = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 60000 && !koDone) {
    const s = await g(() => ({ f: window.__ori.game3d.game.fight.snapshot(), gate: window.__ori.game3d.game.fight.music.stats().gate, playing: window.__ori.game3d.game.fight.music.playing }));
    if (!s.f.O) break;
    if (s.f.O.state === 'down') { sawDown = true; whisper = Math.min(whisper, s.gate); }
    else if (sawDown && s.f.O.state === 'idle') back = Math.max(back, s.gate);
    if (s.f.over || s.f.phase === 'result' || s.f.O.state === 'ko') { koDone = true; break; }
    if (s.f.O.state === 'idle' || s.f.O.state === 'attack') await g(() => { const b = window.__ori.game3d.game.fight.bout; b.P.hp = b.P.maxHp; b.P.st = b.P.maxSt; b.O.hp = Math.min(b.O.hp, 2); b.O.x = b.P.x; b.O.z = b.P.z - 1.2; });
    await press('KeyJ'); await sleep(240);
  }
  check(sawDown && whisper < 0.2 && back > 0.7, `the knock-down count: the music drops to ${whisper.toFixed(2)} and is back at ${back.toFixed(2)} when he gets up`);
  await sleep(700);
  check(await g(() => !window.__ori.game3d.game.fight.music.playing), 'the K.O. is silence: the music has stopped');
  const seq = await g(() => window.__calls.map((c) => c[0]));
  const at = (name, from = 0) => seq.indexOf(name, from);
  const kd = at('knockdown'); const cnt = at('count', kd); const gu = at('getup', cnt); const ko = at('ko', gu); const st = at('sting', ko);
  check(kd >= 0 && cnt > kd && gu > cnt && ko > gu && st > ko, `the sim's events make their sounds in order: knock-down, the count, the get-up, the K.O., the sting (${[kd, cnt, gu, ko, st].join(' < ')})`);
  check(seq.includes('cheer') && (await g(() => window.__calls.find((c) => c[0] === 'sting')[1])) === 'win', 'and the crowd cheers and the win sting is chosen');
  await page.waitForFunction(() => window.__ori.game3d.game.fight.ui.cardOpen, null, { timeout: 15000 });
  await sleep(2500);
  const L2 = await listen(500);
  check(L2.peak < 0.98, `the sting and the cheer never clip (peak ${db(L2.peak).toFixed(1)} dBFS)`);
  await page.click('.fi-btn:not(.primary)');
  await page.waitForFunction(() => !window.__ori.game3d.game.fight.active, null, { timeout: 10000 });
  await sleep(4500);
  const left = await g(() => ({ playing: window.__ori.game3d.game.fight.music.playing, alive: window.__ori.game3d.game.fight.sfx.audio.alive }));
  check(!left.playing && left.alive === 0, `leaving the ring leaves nothing playing (${left.alive} voices alive)`);

  // quitting closes the audio
  const ctxRef = await g(() => { window.__ctx = window.__ori.game3d.game.fight.sfx.audio.ctx; return window.__ctx.state; });
  await g(() => window.__ori.game3d.quit());
  await page.waitForFunction(() => !window.__ori.game3d.running, null, { timeout: 8000 });
  await sleep(300);
  check(ctxRef === 'running' && (await g(() => window.__ctx.state)) === 'closed', 'quitting closes the AudioContext');
}
