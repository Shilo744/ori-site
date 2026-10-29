// "Ori, Can You...?" — the little events of the city by the hour (PURE) [experimental]: fresh bread at the kiosk in the morning, the lunch rush at the cafe, a street band in the park at golden
// hour, pizza in the office at night. Each one is announced when it starts, shows on the maps, and pays a little (once a day) if Ori goes and enjoys it for a few seconds.
// This file has the schedule, how far away is "there", how loud the band is, and the tracker that decides when to announce and when to pay.

/**
 * `from` / `to` = the hours it is on (to is open). `place` = a place of the city; `stay` = seconds he has to be close to enjoy it; `reward` = peaches and love, once a day.
 * `short` / `color` = its badge on the map; `sign` = the word on its beam of light.
 */
export const EVENTS = [
  { id: 'bakery', name: 'Fresh bread', place: 'kiosk', from: 7, to: 9, stay: 6, toast: "The baker has been: fresh bread at Albert's kiosk!", enjoyed: 'Warm bread, still crackling.', reward: { peaches: 5, love: 1 }, short: 'BREAD', sign: 'FRESH BREAD', color: '#f2b45b' },
  { id: 'lunch', name: 'Lunch rush', place: 'cafe', from: 12, to: 14, stay: 8, toast: 'Lunch rush at the cafe! Roee saved you a table.', enjoyed: 'Roee squeezed you in between two orders.', reward: { peaches: 6, love: 1 }, short: 'LUNCH', sign: 'LUNCH RUSH', color: '#ff8a5b' },
  { id: 'band', name: 'Street band', place: 'park', from: 17.5, to: 19.25, stay: 12, music: true, toast: 'A street band is playing in the park!', enjoyed: 'The whole park was clapping along.', reward: { peaches: 4, love: 3 }, short: 'BAND', sign: 'LIVE BAND', color: '#7de3ff' },
  { id: 'pizza', name: 'Office pizza', place: 'startup', from: 20, to: 22, stay: 8, toast: 'Pizza night at The Startup: Shilo ordered too many.', enjoyed: 'Shilo insisted on the last slice for you.', reward: { peaches: 5, love: 2 }, short: 'PIZZA', sign: 'PIZZA NIGHT', color: '#ff6b6b' },
];

export const byId = (id) => EVENTS.find((e) => e.id === id) || null;
/** The events on at this hour (0..24). */
export const activeAt = (hour) => EVENTS.filter((e) => hour >= e.from && hour < e.to);
/** How near is "there": the distance in metres at which a place's event counts as enjoyed. */
export const NEAR = 14;

/** How loud the band is for somebody `dist` metres from the park: full close by, a whisper at the far end of the street, nothing beyond. */
export const bandLevel = (dist) => (!Number.isFinite(dist) || dist >= 48 ? 0 : dist <= 8 ? 1 : (1 - (dist - 8) / 40) ** 2);

/**
 * The tracker. `update(dt, { day, hour, dist(placeId) })` -> [{ type: 'start' | 'reward', ev }]: 'start' when an event comes on (once a day, if he has not been to it),
 * 'reward' when he has stayed near it long enough (once a day). `snapshot()` = what to save: { day, done: [ids] }.
 * @param {{ day?: number, done?: string[] }} [saved]
 */
export function createEventTracker(saved = {}) {
  let day = Number.isFinite(saved.day) ? saved.day : 0;
  let done = new Set(Array.isArray(saved.done) ? saved.done : []);
  const announced = new Set();
  const stay = new Map();
  return {
    get day() { return day; },
    has(id) { return done.has(id); },
    /** The events that are on now and still waiting for him (the ones to show on the maps and with a beam). */
    open(hour) { return activeAt(hour).filter((e) => !done.has(e.id)); },
    update(dt, { day: d, hour, dist }) {
      if (d !== day) { day = d; done = new Set(); announced.clear(); stay.clear(); } // (a new day: everything is on offer again)
      const out = [];
      for (const ev of EVENTS) {
        const on = hour >= ev.from && hour < ev.to;
        if (!on || done.has(ev.id)) { stay.delete(ev.id); continue; }
        if (!announced.has(ev.id)) { announced.add(ev.id); out.push({ type: 'start', ev }); }
        if (dist(ev.place) <= NEAR) {
          const t = (stay.get(ev.id) || 0) + dt;
          stay.set(ev.id, t);
          if (t >= ev.stay) { done.add(ev.id); stay.delete(ev.id); out.push({ type: 'reward', ev }); }
        } else stay.set(ev.id, Math.max(0, (stay.get(ev.id) || 0) - dt * 0.5)); // (going away loses the time slowly: a step out of the door does not start it over)
      }
      return out;
    },
    snapshot() { return { day, done: [...done] }; },
  };
}
