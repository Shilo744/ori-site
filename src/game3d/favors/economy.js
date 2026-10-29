// "Ori, Can You...?" — the money (PURE). Peaches come from favours, tips and golden peaches; they are spent at Uzi's Garage on upgrades that change
// HOW Ori plays (a quicker car, a bigger afterburner, springier sneakers, a padded cargo box, one more helper). Nothing is ever taken away.
import { ECON, UPGRADES } from './play-content.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** What the upgrades add up to. Multipliers are 1 with nothing bought. */
export function perksFor(owned = {}) {
  const lv = (id) => Math.max(0, Math.min(owned[id] || 0, (UPGRADES.find((u) => u.id === id) || { levels: [] }).levels.length));
  const e = lv('engine');
  const t = lv('tyres');
  const k = lv('tank');
  const s = lv('sneakers');
  return {
    top: 1 + 0.09 * e,
    accel: 1 + 0.12 * e,
    grip: 1 + 0.16 * t,
    rainGrip: 0.25 * (1 - 0.5 * t), // how much of the grip a soaked road takes away (the tyres halve it, then nearly remove it)
    tank: 2.5 + [0, 1.5, 3.5, 5.5][k], // seconds of afterburner
    drain: 1 - 0.2 * s, // sprint stamina drain
    sprint: 1 + 0.06 * s,
    cargo: lv('box') ? 0.65 : 1, // cargo damage taken
    mentors: lv('phone2') ? 1 : 0,
  };
}

/** What a favour pays: { total, base, quality, early, rel } (whole peaches). */
export function payFor(task, quality, { rel = 60, boost = 1 } = {}) {
  const tone = task.tone in ECON.base ? task.tone : 'trivial';
  const base = ECON.base[tone] * (task.boost || 1) * boost;
  const q = ECON.qualityLow + ECON.qualitySpan * clamp(quality, 0, 1);
  const left = Math.max(0, task.deadline - (task.doneAt ?? task.at ?? 0));
  const early = clamp(left / Math.max(1, task.window || 1), 0, 1);
  const r = 1 + clamp((rel - 60) / 400, -0.1, 0.1);
  const total = Math.max(1, Math.round(base * q * (1 + ECON.earlyBonus * early) * r));
  return { total, base: Math.round(base), quality: q, early, rel: r };
}

/**
 * The wallet and the garage. `today` lists what came in since the day began (for the summary card).
 * @param {{ peaches?: number, owned?: Record<string, number>, lifetime?: number }} [saved]
 */
export function createEconomy(saved) {
  saved = saved || {};
  const s = { peaches: saved.peaches ?? ECON.start, owned: { ...(saved.owned || {}) }, lifetime: saved.lifetime ?? 0, spent: saved.spent ?? 0 };
  let today = [];
  return {
    state: s,
    get peaches() { return s.peaches; },
    get today() { return today; },
    get todayTotal() { return today.reduce((a, e) => a + e.n, 0); },
    perks() { return perksFor(s.owned); },
    level(id) { return s.owned[id] || 0; },
    /** The next level of an upgrade: { id, name, level, cost, desc } or null when maxed. */
    next(id) {
      const u = UPGRADES.find((x) => x.id === id);
      if (!u) return null;
      const lvl = s.owned[id] || 0;
      const nx = u.levels[lvl];
      return nx ? { id, name: u.name, level: lvl + 1, of: u.levels.length, cost: nx.cost, desc: nx.desc } : null;
    },
    earn(n, tag = 'favour') {
      n = Math.max(0, Math.round(n));
      if (!n) return 0;
      s.peaches += n;
      s.lifetime += n;
      today.push({ n, tag });
      return n;
    },
    canBuy(id) { const nx = this.next(id); return !!nx && s.peaches >= nx.cost; },
    buy(id) {
      const nx = this.next(id);
      if (!nx) return { ok: false, why: 'maxed' };
      if (s.peaches < nx.cost) return { ok: false, why: 'poor', need: nx.cost - s.peaches };
      s.peaches -= nx.cost;
      s.spent += nx.cost;
      s.owned[id] = nx.level;
      return { ok: true, level: nx.level, cost: nx.cost };
    },
    /** Something the player can afford right now (for the day card): { id, name, cost } or null. */
    affordable() { for (const u of UPGRADES) { const nx = this.next(u.id); if (nx && nx.cost <= s.peaches) return nx; } return null; },
    newDay() { today = []; },
    breakdown() { const by = {}; for (const e of today) by[e.tag] = (by[e.tag] || 0) + e.n; return by; },
    snapshot() { return JSON.parse(JSON.stringify(s)); },
    restore(v) { Object.assign(s, JSON.parse(JSON.stringify(v))); },
  };
}
