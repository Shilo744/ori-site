// "Ori, Can You...?" — the social layer of the street: who can Ori talk to right now (a resident at their door, a passer-by close by),
// the "T · Talk" hint, the barks people call out as he walks past, and what a conversation does to the game (hearts, chaos, gifts, tips).
// It owns the conversation panel (talk.js). The game calls update() every frame and key() for keystrokes.
import './talk.css';
import { CAST, REL } from './content.js';
import { speaker } from './dialogue/cast.js';
import { barkFor } from './dialogue/barks.js';
import { blipPitch } from './voices.js';
import { createTalk } from './talk.js';
import { replyFor, helloFor, loveFor, HELLO_COOLDOWN } from './greet.js';

const TALK_AT_DOOR = 5.5; // metres from a resident's door
const TALK_AT_WALKER = 3.4; // metres from a passer-by
const BARK_RANGE = 5.2;
const BARK_EVERY = 15; // seconds between barks

const GIFTS = { cookies: 'a box of cookies' };

/**
 * @param {{ overlay: HTMLElement, hud: object, sfx: object, map: object, crowd: object, tier: string,
 *           ctrl: () => object, quests: () => object, ori: () => object, hour: () => number, bubbles?: object, onHello?: (h: object) => void, getLove?: () => number, getClue?: (id: string) => string | null }} o
 */
export function createSocial({ overlay, hud, sfx, map, crowd, tier, ctrl, quests, ori, hour, bubbles = null, onHello = null, getLove = () => 0, getClue = null }) {
  const flags = new Set();
  const residents = new Map(); // place id -> [cast ids]
  for (const [id, c] of Object.entries(CAST)) {
    if (id === 'self' || !c.home) continue;
    if (!residents.has(c.home)) residents.set(c.home, []);
    residents.get(c.home).push(id);
  }
  const relOf = (id) => { const k = id.startsWith('stranger') ? 'strangers' : CAST[id] && CAST[id].rel; const q = quests(); return k && q && q.state.rel[k] != null ? q.state.rel[k] : 60; };

  const hint = document.createElement('button');
  hint.type = 'button';
  hint.className = 'fv-talkhint fv-glass';
  overlay.append(hint);
  const bark = document.createElement('div');
  bark.className = 'fv-bark fv-glass';
  bark.setAttribute('aria-live', 'polite');
  overlay.append(bark);

  let target = null; // { id, name, x, z, walker? }
  let inside = null; // the people in the room Ori is in: [{ id, name, x, z }] (null = outdoors)
  let talking = null; // the walker / door being talked to
  let barkIn = 6;
  let barkOff = 0;
  let barkTimer = 0;
  let driving = false; // he is in a car: people are found from further away, a toot of the horn is the wave, no barks
  const gifts = [];

  const talk = createTalk(overlay, {
    tier, sfx,
    getRel: relOf,
    getFlags: () => flags,
    onEffects(fx, who) {
      const q = quests();
      const rel = who.startsWith('stranger') ? 'strangers' : CAST[who] && CAST[who].rel;
      if (q && (fx.rel || fx.chaos)) q.nudge(rel, fx.rel || 0, fx.chaos || 0);
      if (fx.give) { gifts.push(fx.give); hud.toast(`${speaker(who).name} gave you ${GIFTS[fx.give] || fx.give}!`, 2600); sfx.pop(); }
      if (fx.hint) hud.toast(fx.hint, 4600);
    },
    onOpen() { sfx.tap(); },
    onClose() {
      if (talking && talking.walker) { talking.walker.stop = 0.4; }
      talking = null;
      const o = ori();
      if (o) o.play('wave');
      sfx.pop();
    },
  });

  function findTarget() {
    const c = ctrl().state;
    if (inside) {
      let near = null;
      let nd = TALK_AT_WALKER + 0.4;
      for (const n of inside) { const d = Math.hypot(n.x - c.x, n.z - c.z); if (d < nd) { nd = d; near = { id: n.id, name: n.name, x: n.x, z: n.z }; } }
      return near;
    }
    let best = null;
    let bd = Infinity;
    // a resident at their door
    for (const [pid, ids] of residents) {
      const p = map.places[pid];
      if (!p) continue;
      const d = Math.hypot(p.door.x - c.x, p.door.z - c.z);
      if (d > TALK_AT_DOOR * (driving ? 1.5 : 1) || d >= bd) continue;
      const q = quests();
      const open = q ? q.open().filter((t) => t.at === pid) : [];
      const giver = open.length ? open.sort((a, b) => a.deadline - b.deadline)[0].giver : null;
      const id = giver && ids.includes(giver) ? giver : ids[0];
      best = { id, name: CAST[id].name, x: p.door.x, z: p.door.z, door: p };
      bd = d;
    }
    // a passer-by close enough
    for (const w of crowd.walkers) {
      const d = Math.hypot(w.x - c.x, w.z - c.z);
      if (d > TALK_AT_WALKER * (driving ? 2 : 1) || d >= bd - 0.5) continue;
      const id = `stranger:${w.id}`;
      best = { id, name: speaker(id).name, x: w.x, z: w.z, walker: w };
      bd = d;
    }
    return best;
  }

  function start(id, o = {}) {
    if (talk.isOpen) return false;
    const c = ctrl().state;
    const w = id.startsWith('stranger') && !inside ? crowd.walkers.find((x) => `stranger:${x.id}` === id) : null;
    talking = w ? { walker: w } : { door: true };
    let fx = o.x ?? (w ? w.x : null);
    let fz = o.z ?? (w ? w.z : null);
    if (fx == null && !inside && CAST[id] && map.places[CAST[id].home]) { fx = map.places[CAST[id].home].door.x; fz = map.places[CAST[id].home].door.z; }
    if (w) { w.stop = 600; w.heading = Math.atan2(c.x - w.x, c.z - w.z); } // he stops and turns to Ori
    if (fx != null && Math.hypot(fx - c.x, fz - c.z) > 0.4) c.heading = Math.atan2(fx - c.x, fz - c.z); // Ori turns to them
    hint.classList.remove('on');
    return talk.start(id, { seed: w ? w.id + 1 : id.length, from: o.from || 'world' });
  }

  // ── hello: a wave, a word, an answer in a speech bubble, the love goes up a little (no conversation panel) ──
  const lastHello = new Map(); // person id -> seconds (performance.now) of the last hello
  let helloCount = 0;
  function hello(tg) {
    const now = performance.now() / 1000;
    const last = lastHello.get(tg.id);
    const first = last == null || now - last > HELLO_COOLDOWN;
    lastHello.set(tg.id, now);
    const c = ctrl().state;
    const o = driving ? null : ori();
    if (o) o.play('wave'); else if (driving) sfx.honk();
    if (tg.walker) { tg.walker.stop = 3.2; tg.walker.heading = Math.atan2(c.x - tg.walker.x, c.z - tg.walker.z); }
    if (!driving && tg.x != null && Math.hypot(tg.x - c.x, tg.z - c.z) > 0.4) c.heading = Math.atan2(tg.x - c.x, tg.z - c.z);
    const seed = ++helloCount * 7 + (tg.walker ? tg.walker.id * 13 : tg.id.length * 5);
    const sp = speaker(tg.id);
    const clue = getClue ? getClue(tg.id) : null; // (the story: the next person in it says the clue instead of the usual line)
    const line = clue || replyFor(tg.id, { hour: hour(), seed: seed * 3 + 1, first, rel: relOf(tg.id), love: getLove() });
    if (bubbles) {
      bubbles.say(() => ({ x: ctrl().state.x, y: driving ? 2.3 : (o ? o.height : 1.85) + 0.15, z: ctrl().state.z }), helloFor(seed), { kind: 'ori', ms: 1500, key: 'ori', dx: -95 });
      const pos = () => (tg.walker ? { x: tg.walker.x, y: 1.95, z: tg.walker.z } : { x: tg.x, y: 1.95, z: tg.z });
      setTimeout(() => {
        bubbles.say(pos, line, { name: sp.name, kind: tg.id === 'shilo' ? 'boss' : 'them', ms: clue ? 5600 : 2800, key: `them:${tg.id}`, dx: 95 });
        if (first) bubbles.heart(pos);
      }, 520);
    } else hud.toast(`${sp.name}: ${line}`, clue ? 5200 : 2200);
    sfx.pop();
    const love = loveFor(tg.id, first);
    if (onHello) onHello({ id: tg.id, name: sp.name, first, love, stranger: tg.id.startsWith('stranger') });
    return true;
  }
  function trigger() {
    if (talk.isOpen) return false;
    if (!target) { hud.toast('Nobody here to say hi to. Walk up to someone!', 1800); return false; }
    return hello(target);
  }
  hint.addEventListener('click', trigger);

  function showBark(w, dt) {
    void dt;
    const id = `stranger:${w.id}`;
    const sp = speaker(id);
    const rel = w.id % 5 === 0 ? 'friends' : w.id % 7 === 0 ? 'family' : null;
    const text = barkFor({ rel, hour: hour(), seed: w.id * 977 + Math.floor(hour() * 60) });
    if (bubbles) bubbles.say(() => ({ x: w.x, y: 1.95, z: w.z }), text.replace(/[<>&]/g, ''), { name: sp.name, kind: 'them', ms: 3000, key: `bark:${w.id}` });
    else { bark.innerHTML = `<b>${sp.name}</b>${text.replace(/[<>&]/g, '')}`; bark.classList.add('on'); }
    barkTimer = 3.2;
    // three blips in their voice
    const v = sp.voice;
    [0, 1, 2, 3].forEach((i) => setTimeout(() => sfx.blip(v, blipPitch(v, 'aeoi'[i], i)), i * v.rate * 1000 * 1.6));
    const o = ori();
    const st = ctrl().state;
    if (o && st.speed < 2.2) o.play('wave');
  }

  return {
    get isTalking() { return talk.isOpen; },
    get target() { return target; },
    get gifts() { return gifts.slice(); },
    flags,
    start,
    trigger,
    hello,
    closeTalk() { talk.close(); },
    /** The people of the room Ori walked into (null when he is back outside). */
    setInside(list) { inside = list; target = null; hint.classList.remove('on'); bark.classList.remove('on'); barkTimer = 0; },
    state() { return { open: talk.isOpen, who: talk.speaker, line: talk.line, target: target ? { id: target.id, name: target.name } : null, flags: [...flags], gifts: gifts.slice() }; },
    /** The talk panel's keys; returns true when it used the key. */
    key(e) {
      if (talk.isOpen) return talk.key(e);
      if (e.code === 'KeyH' || e.code === 'KeyT') { trigger(); return true; }
      return false;
    },
    update(dt, { blocked = false, driving: drv = false } = {}) {
      driving = !!drv;
      talk.update(dt);
      if (talk.isOpen) { barkTimer = 0; bark.classList.remove('on'); hint.classList.remove('on'); return; }
      target = blocked ? null : findTarget();
      if (target) {
        const label = `<kbd>H</kbd> Say hi to ${target.name.replace(/[<>&]/g, '')}`;
        if (hint.dataset.l !== label) { hint.dataset.l = label; hint.innerHTML = label; }
        hint.classList.add('on');
      } else hint.classList.remove('on');
      if (barkTimer > 0) { barkTimer -= dt; if (barkTimer <= 0) bark.classList.remove('on'); }
      // barks: somebody calls out as he walks by
      barkIn -= dt;
      if (barkIn <= 0 && !blocked && !inside && !driving) {
        barkIn = BARK_EVERY * (0.8 + 0.5 * ((barkOff++ * 0.37) % 1));
        const c = ctrl().state;
        let pick = null;
        let bd = BARK_RANGE;
        for (const w of crowd.walkers) { const d = Math.hypot(w.x - c.x, w.z - c.z); if (d < bd) { bd = d; pick = w; } }
        if (pick) showBark(pick, dt);
        else barkIn = 3;
      }
    },
    reset() { flags.clear(); gifts.length = 0; talk.close(); },
    dispose() { talk.dispose(); hint.remove(); bark.remove(); },
  };
}

void REL;
