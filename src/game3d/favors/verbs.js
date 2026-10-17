// "Ori, Can You...?" — the eight little actions Ori does for a favour (PURE state machines, seeded, no DOM): carry (keep it level), fix (hold and
// let go in the green), queue (take a number and sigh at the right moments), chat (three timed answers), shop (pick the right thing from the
// shelf), escort (walk someone and keep up), assemble (the right keys in order) and handle (stamp on the beat). Each lasts 5-25 seconds and
// ends with a quality 0..1 that the quest engine turns into points. The UI draws `view()`; the keys come in through press / release.
import { mulberry32, subSeed, clamp } from '../rng.js';

/** Controls: 'left' 'right' 'up' 'down' 'act' (Space / E) and 'c1' 'c2' 'c3' (answers 1-3). */
export const VERB_INFO = {
  carry: { title: 'Steady!', hint: '← → keep it level', keys: ['left', 'right'] },
  fix: { title: 'Hold… and let go in the green', hint: 'Hold Space, release in the green', keys: ['act'] },
  queue: { title: 'Wait. Politely.', hint: 'Space = sigh (not too much)', keys: ['act'] },
  chat: { title: 'Say the right thing', hint: '1 · 2 · 3 (or click)', keys: ['c1', 'c2', 'c3'] },
  shop: { title: 'Find it on the shelf', hint: 'Arrows move, Space picks', keys: ['left', 'right', 'up', 'down', 'act'] },
  escort: { title: 'Keep up', hint: 'Walk with them, stay close', keys: [] },
  assemble: { title: 'Follow the instructions', hint: 'Press the keys in order', keys: ['left', 'right', 'up', 'down', 'act'] },
  handle: { title: 'Stamp on the beat', hint: 'Space when it is in the middle', keys: ['act'] },
};
const TONE_D = { trivial: 0.85, absurd: 1, epic: 1.2 };
const ARROWS = ['left', 'up', 'right', 'down'];

/** What people say, by how they like to be spoken to. */
export const CHAT_BANK = {
  warm: ['Of course. Tell me everything.', 'I missed you too, you know.', 'You are right. As always.', 'Come here, sit, I have time.'],
  confident: ['I have it under control.', 'Leave it to me. Consider it done.', 'Yes. Next question.', 'I was just about to do that.'],
  polite: ['Excuse me, if I may...', 'Thank you so much for your patience.', 'Of course, by the book.', 'Would you be so kind?'],
  excited: ['Whoa, that is AMAZING!', 'No way! Show me, show me!', 'Best. Thing. Ever.', 'Wait, really?!'],
  evasive: ['Interesting! Anyway...', 'Let me check my calendar.', 'Is that the time?', 'I will get back to you. Tuesday.'],
  absurd: ['Have you tried turning it off and on again?', 'It is a feature, not a bug.', 'I read about this on a cereal box.', 'The moon is in the wrong place for that.'],
};
const TYPES = Object.keys(CHAT_BANK);
const BAD_OF = (liked) => (liked === 'evasive' ? 'confident' : 'evasive');
const NEUTRAL_OF = (liked) => TYPES.filter((t) => t !== liked && t !== BAD_OF(liked) && t !== 'absurd')[0];

/** The shelves: what you can find and what you are looking for. */
export const SHOP_BANK = {
  bread: { items: ['Challah', 'Rye bread', 'Pita', 'The other bread', 'Baguette', 'Rolls'], want: ['The other bread'] },
  flowers: { items: ['Roses', 'Sunflowers', 'Tulips', 'Plastic flowers', 'Daisies', 'A cactus'], want: ['Sunflowers'] },
  pizza: { items: ['Margherita x13', 'Vegan (x2)', 'Mushroom', 'Plain crust', 'Everything', 'Pineapple (no)'], want: ['Margherita x13', 'Vegan (x2)', 'Plain crust'] },
  coffee: { items: ['Oat flat white', 'Espresso', 'Cappuccino', 'Iced latte', 'Tea (why)', 'Decaf (no)'], want: ['Oat flat white'] },
  gift: { items: ['Chocolate', 'A mug', 'Socks', 'Gum (not gum)', 'A plant', 'A book'], want: ['A plant'] },
  milk: { items: ['Milk 3%', 'Eggs', 'A cake (for tomorrow)', 'Cheese', 'Yoghurt', 'Gum'], want: ['Milk 3%', 'Eggs', 'A cake (for tomorrow)'] },
  ball: { items: ['Basketball', 'Football', 'Tennis ball', 'Beach ball', 'Bowling ball', 'Yoga ball'], want: ['Basketball'] },
  salads: { items: ['Greek', 'Caesar', 'Tuna', 'Quinoa', 'Hummus plate', 'Mystery salad'], want: ['Greek', 'Caesar', 'Quinoa'] },
  default: { items: ['The thing', 'Another thing', 'A different thing', 'Something blue', 'Something round', 'Something else'], want: ['The thing'] },
};

// ───────────────────────────── the verbs ─────────────────────────────
function carry(r, d) {
  const need = 6.5 * d;
  const zone = 0.4 / Math.sqrt(d);
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28];
  const f = [0.9 + r() * 0.5, 1.9 + r() * 0.8];
  const s = { pos: 0.15, vel: 0, inside: 0, out: 0, drops: 0, left: false, right: false };
  const maxT = need * 3.2;
  return {
    maxT,
    press(k) { if (k === 'left') s.left = true; if (k === 'right') s.right = true; },
    release(k) { if (k === 'left') s.left = false; if (k === 'right') s.right = false; },
    update(dt, t, fin) {
      const wob = (Math.sin(t * f[0] + ph[0]) * 1.0 + Math.sin(t * f[1] + ph[1]) * 0.7 + Math.sin(t * 0.37 + ph[2]) * 0.5) * 1.15 * d;
      const ctl = (s.right ? 1 : 0) - (s.left ? 1 : 0);
      s.vel += (wob + 1.7 * s.pos - 1.2 * s.vel + 5.6 * ctl) * dt;
      s.pos = clamp(s.pos + s.vel * dt, -1.3, 1.3);
      if (Math.abs(s.pos) < zone) { s.inside += dt; s.out = 0; } else {
        s.out += dt;
        if (s.out > 1.1) { s.drops++; s.out = 0; s.pos = 0; s.vel = 0; s.inside = Math.max(0, s.inside - 2.5); } // a dropped dish costs time
      }
      if (s.inside >= need) fin(clamp(need / Math.max(need, t) - s.drops * 0.2, 0.2, 1));
    },
    view: () => ({ pos: s.pos, zone, progress: clamp(s.inside / need, 0, 1), drops: s.drops, danger: s.out > 0.4 }),
    progress: () => clamp(s.inside / need, 0, 1),
    s,
  };
}

function fix(r, d) {
  const stages = 3;
  const wins = Array.from({ length: stages }, () => { const c = 0.5 + r() * 0.36; const w = 0.11 / d; return [c - w, c + w, c]; });
  const s = { stage: 0, bar: 0, hold: false, tries: 0, scores: [], slip: 0, hot: 0 };
  return {
    maxT: 30,
    press(k) { if (k === 'act' && !s.hold && s.hot <= 0) { s.hold = true; } },
    release(k) {
      if (k !== 'act' || !s.hold) return;
      s.hold = false;
      const [a, b, c] = wins[s.stage];
      if (s.bar >= a && s.bar <= b) { s.scores.push(1 - (Math.abs(s.bar - c) / ((b - a) / 2)) * 0.45); s.stage++; } else s.tries++;
      s.bar = 0;
    },
    update(dt, t, fin) {
      if (s.hot > 0) s.hot -= dt;
      if (s.hold) {
        s.bar += dt * 0.52 * d * (1 + 0.14 * s.stage);
        if (s.bar >= 1) { s.bar = 0; s.hold = false; s.tries++; s.hot = 0.6; } // it overheated: let go and start again
      }
      if (s.stage >= stages) fin(clamp(s.scores.reduce((a, v) => a + v, 0) / stages - 0.08 * s.tries, 0.2, 1));
    },
    view: () => ({ stage: s.stage, stages, bar: s.bar, window: wins[Math.min(s.stage, stages - 1)].slice(0, 2), holding: s.hold, tries: s.tries, hot: s.hot > 0 }),
    progress: () => s.stage / stages,
    s,
  };
}

function queue(r, d) {
  const mine = 400 + Math.floor(r() * 90);
  const gap = Math.round(8 + d * 3);
  const s = { serving: mine - gap, acc: 0, annoy: 0, boost: 0, stall: 0, mistakes: 0, sighs: 0, joke: false };
  const rate = 0.85;
  return {
    maxT: 45,
    press(k) { if (k === 'act' && s.stall <= 0) { s.sighs++; s.boost = 0.9; s.annoy += 0.36; } },
    release() {},
    update(dt, t, fin) {
      s.annoy = Math.max(0, s.annoy - 0.22 * dt);
      if (s.annoy >= 1) { s.mistakes++; s.stall = 2.4; s.annoy = 0.3; s.boost = 0; }
      if (s.stall > 0) { s.stall -= dt; return; }
      if (s.boost > 0) s.boost -= dt;
      s.acc += dt * rate * (s.boost > 0 ? 2.1 : 1);
      while (s.acc >= 1) {
        s.acc -= 1;
        s.serving++;
        if (s.serving === mine - 2 && !s.joke) { s.joke = true; s.stall = 1.2; } // "number 412?" - "no, that was a different 412"
      }
      if (s.serving >= mine) { const ideal = gap / (rate * 1.6); fin(clamp(1 - 0.22 * s.mistakes - clamp((t - ideal) / ideal, 0, 1) * 0.5, 0.2, 1)); }
    },
    view: () => ({ mine, serving: s.serving, annoy: clamp(s.annoy, 0, 1), stalled: s.stall > 0, joke: s.joke && s.serving < mine - 1 }),
    progress: () => clamp(1 - (mine - s.serving) / gap, 0, 1),
    s,
  };
}

function chat(r, d, p) {
  const rounds = 3;
  const liked = p.likes || 'warm';
  const prompts = p.prompts && p.prompts.length ? p.prompts : ['So... what do you think?', 'Well?', 'Say something.'];
  const time = 5.2 / Math.sqrt(d);
  const make = (i) => {
    const kinds = [liked, BAD_OF(liked), NEUTRAL_OF(liked)];
    for (let k = kinds.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [kinds[k], kinds[j]] = [kinds[j], kinds[k]]; }
    return { prompt: prompts[i % prompts.length], options: kinds.map((t) => ({ type: t, text: CHAT_BANK[t][Math.floor(r() * CHAT_BANK[t].length)] })) };
  };
  const s = { round: 0, cur: make(0), left: time, scores: [], picked: null, flash: 0 };
  const next = (score, fin) => {
    s.scores.push(score);
    s.round++;
    if (s.round >= rounds) { fin(clamp(s.scores.reduce((a, v) => a + v, 0) / rounds, 0.15, 1)); return; }
    s.cur = make(s.round);
    s.left = time;
  };
  let finish = null;
  return {
    maxT: rounds * (time + 1.2),
    press(k) {
      const i = k === 'c1' ? 0 : k === 'c2' ? 1 : k === 'c3' ? 2 : -1;
      if (i < 0 || !finish || s.round >= rounds) return;
      const t = s.cur.options[i].type;
      s.picked = i;
      next(t === liked ? 1 : t === BAD_OF(liked) ? 0 : 0.5, finish);
    },
    release() {},
    update(dt, t, fin) {
      finish = fin;
      s.left -= dt;
      if (s.left <= 0) next(0, fin);
    },
    view: () => ({ round: Math.min(s.round + 1, rounds), rounds, prompt: s.cur.prompt, options: s.cur.options.map((o) => o.text), timeLeft: Math.max(0, s.left / time), liked, rapport: s.scores.length ? s.scores.reduce((a, v) => a + v, 0) / rounds : 0 }),
    progress: () => s.round / rounds,
    s,
    liked,
  };
}

function shop(r, d, p) {
  const bank = SHOP_BANK[p.aisle] || SHOP_BANK.default;
  const items = bank.items.slice();
  for (let k = items.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [items[k], items[j]] = [items[j], items[k]]; }
  const wantCount = Math.min(bank.want.length, d > 1.1 ? 3 : d > 0.9 ? 2 : 1);
  const want = bank.want.slice(0, wantCount);
  const s = { cursor: 0, got: [], wrong: new Set(), mistakes: 0 };
  const cols = 3;
  const move = (dx, dy) => { const x = (s.cursor % cols + dx + cols) % cols; const y = (Math.floor(s.cursor / cols) + dy + 2) % 2; s.cursor = y * cols + x; };
  return {
    maxT: 26,
    press(k) {
      if (k === 'left') move(-1, 0); else if (k === 'right') move(1, 0); else if (k === 'up') move(0, -1); else if (k === 'down') move(0, 1);
      else if (k === 'act') {
        const name = items[s.cursor];
        if (s.got.includes(name)) return;
        if (want.includes(name)) s.got.push(name); else { s.mistakes++; s.wrong.add(s.cursor); }
      }
    },
    release() {},
    update(dt, t, fin) {
      if (s.got.length >= want.length) fin(clamp(1 - 0.17 * s.mistakes - Math.max(0, t - 6) * 0.01, 0.2, 1));
      else if (s.mistakes >= 5) fin(0.2);
    },
    view: () => ({ items, cursor: s.cursor, want, got: s.got.slice(), wrong: [...s.wrong], cols }),
    progress: () => s.got.length / want.length,
    s,
    items,
    want,
  };
}

function escort(r, d, p) {
  const L = (p.length || 20) + r() * 6;
  const speed = 2.4;
  const pauses = [0.3 + r() * 0.15, 0.62 + r() * 0.15].map((x) => x * L);
  const s = { s: 0, lost: 0, pauseLeft: 0, paused: 0, next: 0, near: true };
  return {
    maxT: 70,
    length: L,
    press() {},
    release() {},
    update(dt, t, fin, ctx = {}) {
      const dist = ctx.dist ?? 99;
      s.near = dist <= 6.5;
      if (s.pauseLeft > 0) { s.pauseLeft -= dt; return; }
      if (!s.near) { s.lost += dt; return; }
      s.s += speed * dt * (dist < 1.2 ? 0.7 : 1);
      if (s.next < pauses.length && s.s >= pauses[s.next]) { s.next++; s.pauseLeft = 1.3; s.paused++; }
      if (s.s >= L) fin(clamp(1 - (s.lost / (L / speed)) * 1.1, 0.2, 1));
    },
    view: () => ({ progress: clamp(s.s / L, 0, 1), near: s.near, pausing: s.pauseLeft > 0, lost: s.lost }),
    progress: () => clamp(s.s / L, 0, 1),
    s,
  };
}

function assemble(r, d) {
  const len = d > 1.1 ? 6 : d > 0.9 ? 5 : 4;
  const steps = Array.from({ length: len }, () => (r() < 0.18 ? 'act' : ARROWS[Math.floor(r() * 4)]));
  const per = 3.6 / Math.sqrt(d);
  const s = { idx: 0, mistakes: 0, timeouts: 0, left: per, shake: 0 };
  return {
    maxT: len * per + 4,
    press(k) {
      if (!VERB_INFO.assemble.keys.includes(k) || s.idx >= len) return;
      if (k === steps[s.idx]) { s.idx++; s.left = per; } else { s.mistakes++; s.shake = 0.3; }
    },
    release() {},
    update(dt, t, fin) {
      s.shake = Math.max(0, s.shake - dt);
      s.left -= dt;
      if (s.left <= 0 && s.idx < len) { s.timeouts++; s.mistakes++; s.left = per; }
      if (s.idx >= len) fin(clamp(1 - 0.13 * s.mistakes, 0.2, 1));
    },
    view: () => ({ steps, idx: s.idx, shake: s.shake > 0, timeLeft: clamp(s.left / per, 0, 1) }),
    progress: () => s.idx / len,
    s,
    steps,
  };
}

function handle(r, d) {
  const need = d > 1.1 ? 5 : 4;
  const w = 0.13 / d;
  const s = { phase: r(), hits: 0, miss: 0, quality: [], speed: 0.75 * d, cool: 0 };
  const marker = () => { const x = (s.phase % 1); return x < 0.5 ? x * 2 : 2 - x * 2; };
  return {
    maxT: 26,
    press(k) {
      if (k !== 'act' || s.cool > 0) return;
      const m = marker();
      if (Math.abs(m - 0.5) <= w) { s.hits++; s.quality.push(1 - (Math.abs(m - 0.5) / w) * 0.4); s.speed *= 1.06; } else { s.miss++; s.cool = 0.35; }
    },
    release() {},
    update(dt, t, fin) {
      if (s.cool > 0) s.cool -= dt;
      s.phase += dt * s.speed;
      if (s.hits >= need) fin(clamp((s.quality.reduce((a, v) => a + v, 0) / need) * (1 - 0.1 * s.miss), 0.2, 1));
    },
    view: () => ({ marker: marker(), zone: [0.5 - w, 0.5 + w], hits: s.hits, need, cooling: s.cool > 0 }),
    progress: () => s.hits / need,
    s,
    marker,
    w,
  };
}

const BUILDERS = { carry, fix, queue, chat, shop, escort, assemble, handle };

/**
 * One little action. `params`: chat { likes, prompts }, shop { aisle }, escort { length }.
 * Drive it with update(dt[, ctx]) (ctx.dist = how far Ori is from the person he escorts) and press / release; read view().
 */
export function createVerb(kind, { seed = 1, tone = 'trivial', params = {} } = {}) {
  const build = BUILDERS[kind];
  if (!build) throw new Error(`unknown verb ${kind}`);
  const r = mulberry32(subSeed(seed, 77));
  const d = TONE_D[tone] || 1;
  const core = build(r, d, params);
  let t = 0;
  let quality = null;
  let timedOut = false;
  const fin = (q) => { if (quality == null) quality = Math.round(q * 1000) / 1000; };
  return {
    kind,
    info: VERB_INFO[kind],
    core,
    get t() { return t; },
    get done() { return quality != null; },
    get quality() { return quality; },
    get timedOut() { return timedOut; },
    get maxT() { return core.maxT; },
    get progress() { return core.progress(); },
    press(k) { if (quality == null) core.press(k); },
    release(k) { if (quality == null) core.release(k); },
    update(dt, ctx) {
      if (quality != null) return;
      t += dt;
      core.update(dt, t, fin, ctx);
      if (quality == null && t >= core.maxT) { timedOut = true; fin(Math.max(0.2, core.progress() * 0.6)); }
    },
    view: () => core.view(),
  };
}

/**
 * A scripted player (tests, the browser test, autoplay): presses what a good player would. `react` = seconds a person needs between one action
 * and the next (0 = a machine). Call once per frame BEFORE verb.update(dt).
 */
export function autoplay(verb, dt, { react = 0 } = {}) {
  const c = verb.core;
  const k = verb.kind;
  const lag = react;
  const a = (verb._ap ||= { cd: react, held: new Set(), step: 0 });
  a.cd -= dt;
  const hold = (key, on) => { if (on && !a.held.has(key)) { a.held.add(key); verb.press(key); } else if (!on && a.held.has(key)) { a.held.delete(key); verb.release(key); } };
  if (k === 'carry') {
    const u = -(2.4 * c.s.pos + 1.7 * c.s.vel);
    hold('left', u < -0.12);
    hold('right', u > 0.12);
  } else if (k === 'fix') {
    const v = c.view();
    const mid = (v.window[0] + v.window[1]) / 2;
    if (!v.holding && !v.hot && a.cd <= 0) { hold('act', true); }
    else if (v.holding && v.bar >= mid - 0.015) { hold('act', false); a.cd = 0.15 + lag; }
  } else if (k === 'queue') {
    const v = c.view();
    if (a.cd <= 0 && v.annoy < 0.58 && !v.stalled) { verb.press('act'); a.cd = 0.5 + lag * 0.4; }
  } else if (k === 'chat') {
    if (a.cd <= 0 && c.s.round < 3) {
      const opts = c.s.cur.options;
      const i = opts.findIndex((o) => o.type === c.liked);
      verb.press(`c${i + 1}`);
      a.cd = 0.5 + lag * 1.6;
    }
  } else if (k === 'shop') {
    if (a.cd <= 0) {
      const target = c.items.findIndex((n) => c.want.includes(n) && !c.s.got.includes(n));
      if (target >= 0) {
        const cols = 3;
        const cx = c.s.cursor % cols;
        const cy = Math.floor(c.s.cursor / cols);
        const tx = target % cols;
        const ty = Math.floor(target / cols);
        if (cx !== tx) verb.press(((tx - cx + cols) % cols) <= 1 ? 'right' : 'left');
        else if (cy !== ty) verb.press('down');
        else verb.press('act');
        a.cd = 0.16 + lag * 0.7;
      }
    }
  } else if (k === 'assemble') {
    if (a.cd <= 0 && c.s.idx < c.steps.length) { verb.press(c.steps[c.s.idx]); a.cd = 0.22 + lag * 0.9; }
  } else if (k === 'handle') {
    if (a.cd <= 0 && Math.abs(c.marker() - 0.5) < c.w * 0.35) { verb.press('act'); a.cd = 0.3 + lag * 0.5; }
  }
}
