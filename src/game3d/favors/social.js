// "Ori, Can You...?" — the social layer of the street: who can Ori talk to right now (a resident at their door, a passer-by close by),
// the "T · Talk" hint, the barks people call out as he walks past, and what a conversation does to the game (hearts, chaos, gifts, tips).
// It owns the conversation panel (talk.js). The game calls update() every frame and key() for keystrokes.
import './talk.css';
import { CAST, REL } from './content.js';
import { speaker } from './dialogue/cast.js';
import { barkFor } from './dialogue/barks.js';
import { blipPitch } from './voices.js';
import { createTalk } from './talk.js';

const TALK_AT_DOOR = 5.5; // metres from a resident's door
const TALK_AT_WALKER = 3.4; // metres from a passer-by
const BARK_RANGE = 5.2;
const BARK_EVERY = 15; // seconds between barks

const GIFTS = { cookies: 'a box of cookies' };

/**
 * @param {{ overlay: HTMLElement, hud: object, sfx: object, map: object, crowd: object, tier: string,
 *           ctrl: () => object, quests: () => object, ori: () => object, hour: () => number }} o
 */
export function createSocial({ overlay, hud, sfx, map, crowd, tier, ctrl, quests, ori, hour }) {
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
  let talking = null; // the walker / door being talked to
  let barkIn = 6;
  let barkOff = 0;
  let barkTimer = 0;
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
    let best = null;
    let bd = Infinity;
    // a resident at their door
    for (const [pid, ids] of residents) {
      const p = map.places[pid];
      if (!p) continue;
      const d = Math.hypot(p.door.x - c.x, p.door.z - c.z);
      if (d > TALK_AT_DOOR || d >= bd) continue;
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
      if (d > TALK_AT_WALKER || d >= bd - 0.5) continue;
      const id = `stranger:${w.id}`;
      best = { id, name: speaker(id).name, x: w.x, z: w.z, walker: w };
      bd = d;
    }
    return best;
  }

  function start(id, o = {}) {
    if (talk.isOpen) return false;
    const c = ctrl().state;
    const w = id.startsWith('stranger') ? crowd.walkers.find((x) => `stranger:${x.id}` === id) : null;
    talking = w ? { walker: w } : { door: true };
    let fx = o.x ?? (w ? w.x : null);
    let fz = o.z ?? (w ? w.z : null);
    if (fx == null && CAST[id] && map.places[CAST[id].home]) { fx = map.places[CAST[id].home].door.x; fz = map.places[CAST[id].home].door.z; }
    if (w) { w.stop = 600; w.heading = Math.atan2(c.x - w.x, c.z - w.z); } // he stops and turns to Ori
    if (fx != null && Math.hypot(fx - c.x, fz - c.z) > 0.4) c.heading = Math.atan2(fx - c.x, fz - c.z); // Ori turns to them
    hint.classList.remove('on');
    return talk.start(id, { seed: w ? w.id + 1 : id.length, from: o.from || 'world' });
  }

  function trigger() {
    if (talk.isOpen) return false;
    if (!target) { hud.toast('Nobody to talk to here. Walk up to a door or a neighbour!', 1800); return false; }
    return start(target.id, { x: target.x, z: target.z, from: 'key' });
  }
  hint.addEventListener('click', trigger);

  function showBark(w, dt) {
    void dt;
    const id = `stranger:${w.id}`;
    const sp = speaker(id);
    const rel = w.id % 5 === 0 ? 'friends' : w.id % 7 === 0 ? 'family' : null;
    const text = barkFor({ rel, hour: hour(), seed: w.id * 977 + Math.floor(hour() * 60) });
    bark.innerHTML = `<b>${sp.name}</b>${text.replace(/[<>&]/g, '')}`;
    bark.classList.add('on');
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
    closeTalk() { talk.close(); },
    state() { return { open: talk.isOpen, who: talk.speaker, line: talk.line, target: target ? { id: target.id, name: target.name } : null, flags: [...flags], gifts: gifts.slice() }; },
    /** The talk panel's keys; returns true when it used the key. */
    key(e) {
      if (talk.isOpen) return talk.key(e);
      if (e.code === 'KeyT') { trigger(); return true; }
      return false;
    },
    update(dt, { blocked = false } = {}) {
      talk.update(dt);
      if (talk.isOpen) { barkTimer = 0; bark.classList.remove('on'); hint.classList.remove('on'); return; }
      target = blocked ? null : findTarget();
      if (target) {
        const label = `<kbd>T</kbd> Talk to ${target.name.replace(/[<>&]/g, '')}`;
        if (hint.dataset.l !== label) { hint.dataset.l = label; hint.innerHTML = label; }
        hint.classList.add('on');
      } else hint.classList.remove('on');
      if (barkTimer > 0) { barkTimer -= dt; if (barkTimer <= 0) bark.classList.remove('on'); }
      // barks: somebody calls out as he walks by
      barkIn -= dt;
      if (barkIn <= 0 && !blocked) {
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
