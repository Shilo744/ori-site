// "Ori, Can You...?" — the cafe job "Coffee Rush" on the screen (DOM) [experimental]: the customer's ticket with the drinks they want, a patience bar, the clock and the score, the three keys.
// J / K / L serve; Esc leaves. The rules are in coffee.js (pure). When the clock runs out the card says how it went and `done({ served, score, peaches ... })` pays it.
import './coffee.css';
import { DRINKS, createCoffeeRun, peachesFor, SECONDS } from './coffee.js';
import { modalFocus } from './a11y.js';
import { createKeyPad } from './key-pad.js';
import { coffeePad } from './touch.js';

const mmss = (t) => `0:${String(Math.ceil(t)).padStart(2, '0')}`;

/** @param {{ root: HTMLElement, sfx: object }} o */
export function createCoffee({ root, sfx }) {
  const el = document.createElement('div');
  el.className = 'fi-overlay cf';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Coffee Rush');
  root.append(el);
  const focus = modalFocus(el, null, true);
  let run = null;
  let cb = null;
  let raf = 0;
  let last = 0;
  let lunch = false;
  let finished = false;
  let flashT = 0;
  let drawn = '';
  let pad = null; // the touch keys (three drinks and Back), made with each shift
  const q = (k) => el.querySelector(`[data-k="${k}"]`);

  function build() {
    el.innerHTML = `<div class="fi-card fv-glass cf-card">
      <header><div class="g3d-kicker">THE CAFE · ROEE NEEDS A HAND</div><h2>Coffee Rush</h2></header>
      <div class="cf-stats"><span><small>TIME</small><b data-k="time">0:45</b></span><span><small>SERVED</small><b data-k="served">0</b></span><span><small>SCORE</small><b data-k="score">0</b></span><span><small>STREAK</small><b data-k="streak">0</b></span></div>
      <div class="cf-ticket" data-k="ticket" aria-live="polite"></div>
      <div class="cf-patience" aria-hidden="true"><i data-k="patience"></i></div>
      <div class="cf-keys">${DRINKS.map((d) => `<span class="cf-key"><kbd>${d.key}</kbd><i class="cf-cup" style="--c:${d.color}"></i>${d.name}</span>`).join('')}</div>
      <p class="cf-msg" data-k="msg" role="status" aria-live="polite">Match the order, key by key. A wrong key starts it again.</p>
      <footer><small>${lunch ? 'LUNCH RUSH: the tips are bigger today! · ' : ''}Esc: back to the cafe</small></footer></div>`;
    drawn = '';
  }
  function draw() {
    const v = run.view();
    q('time').textContent = mmss(v.time);
    q('served').textContent = String(v.served);
    q('score').textContent = String(v.score);
    q('streak').textContent = v.streak ? `x${v.streak}` : '-';
    q('patience').style.width = `${Math.round(v.patience * 100)}%`;
    q('patience').classList.toggle('low', v.patience < 0.3);
    const sig = `${v.order.items.join()}|${v.order.i}`;
    if (sig !== drawn) {
      drawn = sig;
      q('ticket').innerHTML = v.order.items.map((id, i) => { const d = DRINKS.find((x) => x.id === id); return `<span class="cf-order${i < v.order.i ? ' got' : i === v.order.i ? ' now' : ''}"><i class="cf-cup" style="--c:${d.color}"></i><kbd>${d.key}</kbd><small>${d.name}</small></span>`; }).join('');
    }
    if (flashT > 0) { flashT -= 1; if (flashT <= 0) el.classList.remove('good', 'bad'); }
  }
  function finish() {
    if (finished) return;
    finished = true;
    const v = run.view();
    const peaches = peachesFor(v.score, lunch);
    const result = { served: v.served, left: v.left, wrong: v.wrong, score: v.score, bestStreak: v.bestStreak, peaches, lunch };
    q('msg').textContent = `${v.served} customers served${v.left ? `, ${v.left} left waiting` : ''}. Roee: "${v.served >= 12 ? 'You are a natural!' : v.served >= 6 ? 'You saved my lunch!' : 'Every cup counts!'}"  +${peaches} peaches. ${pad && pad.enabled ? 'Tap Done.' : 'Press Space.'}`;
    if (pad) pad.set(coffeePad(true));
    q('msg').classList.add('end');
    sfx.ding();
    if (cb && cb.done) cb.done(result);
  }
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    if (!run.view().over) run.update(dt);
    draw();
    if (run.view().over) finish();
  }

  const api = {
    get isOpen() { return !el.hidden; },
    get run() { return run; },
    /** Starts a shift. `o.done(result)` when the clock runs out, `o.close()` when the card is left, `o.lunch` = the lunch rush bonus, `o.seed` for tests. */
    open(o = {}) {
      cb = o; lunch = !!o.lunch; finished = false; flashT = 0;
      run = createCoffeeRun({ seed: o.seed != null ? o.seed : Math.floor(performance.now()), seconds: SECONDS });
      build();
      if (pad) pad.dispose();
      pad = createKeyPad({ root: el.querySelector('.cf-card'), label: 'Cafe controls' });
      pad.set('coffee');
      if (pad.enabled) { const f = el.querySelector('footer small'); if (f) f.textContent = f.textContent.replace('Esc: back to the cafe', 'Back: return to the cafe'); }
      el.hidden = false;
      focus.enter();
      draw();
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
      sfx.tap();
    },
    close() {
      if (el.hidden) return;
      cancelAnimationFrame(raf);
      focus.leave();
      el.hidden = true; el.innerHTML = '';
      if (pad) { pad.dispose(); pad = null; }
      const c = cb; cb = null; run = null;
      if (c && c.close) c.close();
    },
    /** Keys while it is open (always true: the card owns the keyboard). */
    key(e) {
      if (el.hidden) return false;
      if (e.code === 'Escape') { api.close(); return true; }
      if (run && run.view().over) { if (e.code === 'Space' || e.code === 'Enter') api.close(); return true; }
      const d = DRINKS.find((x) => x.code === e.code);
      if (d && !e.repeat && run) {
        const r = run.press(d.key);
        el.classList.remove('good', 'bad');
        if (r === 'done') { el.classList.add('good'); sfx.ding(); q('msg').textContent = 'Served! Next customer.'; flashT = 8; } else if (r === 'ok') { sfx.tap(); } else if (r === 'wrong') { el.classList.add('bad'); sfx.soft(); q('msg').textContent = 'Wrong cup: the order starts again.'; flashT = 8; }
      }
      return true;
    },
    dispose() { cancelAnimationFrame(raf); if (pad) pad.dispose(); el.remove(); },
  };
  return api;
}
