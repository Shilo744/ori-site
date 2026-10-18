// "Ori, Can You...?" — the dialogue runner (PURE: no three, no DOM). A conversation is a plain-data graph:
//   { id, who, title, start, nodes: { key: { s: speaker id, e: emotion, t: 'line', next: 'key' | choices: [{ t, next, if, fx }] | end: true, fx } } }
//   s  = a speaker id from dialogue/cast.js ('ori' is the player)        e = an expression name from people/expressions.js
//   if = { flag: 'x' } | { noFlag: 'x' } | { rel: 70 } (the relationship with the speaker is at least that)
//   fx = { rel: +3, chaos: -2, flag: 'name', give: 'item', hint: 'a line for the phone' }   (the runner collects them, the game applies them)
// Strings stay in the graph files (nothing is built from pieces of words), so they can be translated.

/** Words Ori never says (the persona rule: always positive). Lines of every other speaker may be grumpy, Ori's never. */
export const BANNED = /\b(miss(ed|ing)?|fail(ed|s|ure|ing)?|sorry|can'?t|cannot|won'?t|not now|never|hate[sd]?|angry|annoy(ed|ing)?|stupid|useless|loser|lazy|too late|give up|ignore[ds]?|refuse[sd]?|terrible|awful|worst|shut up|boring)\b/i;

const EMOTIONS = new Set(['neutral', 'smile', 'grin', 'laugh', 'wink', 'surprised', 'flustered', 'sleepy', 'smirk', 'proud', 'love', 'talking']);
export const isEmotion = (e) => EMOTIONS.has(e);

/** Does a choice / node condition hold? `ctx` = { flags: Set | object, rel: number } */
export function holds(cond, ctx) {
  if (!cond) return true;
  const has = (f) => (ctx.flags instanceof Set ? ctx.flags.has(f) : !!(ctx.flags && ctx.flags[f]));
  if (cond.flag && !has(cond.flag)) return false;
  if (cond.noFlag && has(cond.noFlag)) return false;
  if (cond.rel != null && (ctx.rel ?? 60) < cond.rel) return false;
  return true;
}

/**
 * A running conversation. `ctx` = { flags: Set, rel: number }: the flags it sets are added to that same Set.
 * Typical use: `const r = createRunner(graph, ctx); r.line()` → show; `r.advance()` or `r.choose(i)`; until `r.done`.
 */
export function createRunner(graph, ctx = { flags: new Set(), rel: 60 }) {
  let key = graph.start;
  let done = false;
  const effects = [];
  const log = [];
  const apply = (fx) => {
    if (!fx) return;
    effects.push(fx);
    if (fx.flag) (ctx.flags instanceof Set ? ctx.flags.add(fx.flag) : (ctx.flags[fx.flag] = true));
    if (fx.rel) ctx.rel = (ctx.rel ?? 60) + fx.rel;
  };
  const enter = (k) => {
    key = k;
    const n = graph.nodes[k];
    if (!n) { done = true; return; }
    apply(n.fx);
    log.push(k);
  };
  enter(key);
  const api = {
    get done() { return done; },
    get key() { return key; },
    get effects() { return effects; },
    get log() { return log; },
    /** The current line: { speaker, emotion, text, choices: [{ index, text }] | null, last } */
    line() {
      if (done) return null;
      const n = graph.nodes[key];
      const choices = n.choices ? n.choices.map((c, index) => ({ index, text: c.t, ok: holds(c.if, ctx) })).filter((c) => c.ok) : null;
      return { speaker: n.s, emotion: n.e || 'neutral', text: n.t, choices, last: !!n.end && !n.choices };
    },
    /** Moves on after a line without choices. */
    advance() {
      if (done) return;
      const n = graph.nodes[key];
      if (n.choices) return; // a choice must be made
      if (n.end || !n.next) { done = true; return; }
      enter(n.next);
    },
    /** Picks one of the visible choices (by its `index` as given in line().choices). */
    choose(index) {
      if (done) return;
      const n = graph.nodes[key];
      const c = n.choices && n.choices[index];
      if (!c || !holds(c.if, ctx)) return;
      apply(c.fx);
      if (c.end || !c.next) { done = true; return; }
      enter(c.next);
    },
  };
  return api;
}

/**
 * Checks a graph: every node reachable, every target exists, no dead ends (a node has `next`, `choices` or `end`), every flag it asks for is
 * set somewhere (by the graph or by `known`), choices are never empty, Ori's lines are warm. Returns a list of problems (empty = fine).
 */
export function validateGraph(graph, { known = [], speakers = null } = {}) {
  const bad = [];
  const nodes = graph.nodes || {};
  if (!nodes[graph.start]) bad.push(`${graph.id}: start "${graph.start}" does not exist`);
  const setFlags = new Set(known);
  for (const n of Object.values(nodes)) {
    if (n.fx && n.fx.flag) setFlags.add(n.fx.flag);
    for (const c of n.choices || []) if (c.fx && c.fx.flag) setFlags.add(c.fx.flag);
  }
  const edges = (n) => [n.next, ...(n.choices || []).map((c) => c.next)].filter(Boolean);
  for (const [k, n] of Object.entries(nodes)) {
    const at = `${graph.id}.${k}`;
    if (!n.s) bad.push(`${at}: no speaker`);
    else if (speakers && !speakers.includes(n.s)) bad.push(`${at}: unknown speaker "${n.s}"`);
    if (n.e && !isEmotion(n.e)) bad.push(`${at}: unknown emotion "${n.e}"`);
    if (typeof n.t !== 'string' || !n.t.trim()) bad.push(`${at}: empty line`);
    const exits = (n.next ? 1 : 0) + (n.choices ? 1 : 0) + (n.end ? 1 : 0);
    if (!exits) bad.push(`${at}: dead end (needs next, choices or end)`);
    if (n.choices && !n.choices.length) bad.push(`${at}: empty choices`);
    if (n.choices) {
      if (!n.choices.some((c) => !c.if)) bad.push(`${at}: every choice has a condition (one must always be available)`);
      if (n.s !== 'ori' && n.choices.length > 4) bad.push(`${at}: more than 4 choices`);
    }
    for (const t of edges(n)) if (!nodes[t]) bad.push(`${at}: goes to missing node "${t}"`);
    for (const c of n.choices || []) {
      if (typeof c.t !== 'string' || !c.t.trim()) bad.push(`${at}: a choice has no text`);
      else if (BANNED.test(c.t)) bad.push(`${at}: negative choice text "${c.t}"`);
      if (!c.next && !c.end) bad.push(`${at}: choice "${c.t}" leads nowhere`);
      for (const f of [c.if].filter(Boolean)) for (const name of [f.flag, f.noFlag].filter(Boolean)) if (!setFlags.has(name)) bad.push(`${at}: asks for flag "${name}" that nothing sets`);
    }
    if (n.s === 'ori' && BANNED.test(n.t || '')) bad.push(`${at}: Ori says something negative: "${n.t}"`);
  }
  // reachability
  const seen = new Set();
  const todo = [graph.start];
  while (todo.length) {
    const k = todo.pop();
    if (seen.has(k) || !nodes[k]) continue;
    seen.add(k);
    todo.push(...edges(nodes[k]));
  }
  for (const k of Object.keys(nodes)) if (!seen.has(k)) bad.push(`${graph.id}.${k}: unreachable`);
  // can every path end? (a node that can reach an end)
  const canEnd = new Map();
  const reach = (k, stack = new Set()) => {
    if (canEnd.has(k)) return canEnd.get(k);
    if (stack.has(k)) return false;
    const n = nodes[k];
    if (!n) return false;
    stack.add(k);
    let ok = !!n.end || (n.choices || []).some((c) => c.end);
    if (!ok) ok = edges(n).some((t) => reach(t, stack));
    stack.delete(k);
    canEnd.set(k, ok);
    return ok;
  };
  for (const k of seen) if (!reach(k)) bad.push(`${graph.id}.${k}: cannot reach an end`);
  return bad;
}

/** Every path through a graph, ignoring conditions (for tests: no path may loop forever without a choice). Returns the number of nodes visited. */
export function walkAll(graph, { pick = 0, maxSteps = 400 } = {}) {
  const ctx = { flags: new Set(), rel: 100 };
  const r = createRunner(graph, ctx);
  let steps = 0;
  while (!r.done && steps++ < maxSteps) {
    const l = r.line();
    if (l.choices) r.choose(l.choices[Math.min(pick, l.choices.length - 1)].index); else r.advance();
  }
  return { steps, done: r.done, effects: r.effects };
}
