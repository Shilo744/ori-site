// The conversations of "Ori, Can You...?": three fully written ones (Mum, the City Hall clerk, a stranger) and a small warm chat for everybody else.
import { CAST } from '../content.js';
import mum from './mum.js';
import clerk from './clerk.js';
import stranger from './stranger.js';

export const GRAPHS = { mum, clerk, stranger };

/** The graph for a speaker id ('ima', 'clerk', 'stranger:7' ...). */
export function graphFor(id) {
  if (id === 'ima') return GRAPHS.mum;
  if (id === 'clerk') return GRAPHS.clerk;
  if (id.startsWith('stranger')) return GRAPHS.stranger;
  return genericGraph(id);
}

const ROLE_LINES = {
  work: ['Ori! The deadline moved again. Only by a day, but a day is a lot.', 'Perfect timing. Everything is on fire, politely.'],
  city: ['Number?', 'Please take a seat. Not that one. The other one.'],
  perach: ['Ori! The kids asked about you all week.', 'The whiteboard is full of ideas. Half are good!'],
  friends: ['Ori! What a day, hey? Tell me everything.', 'You look like you need a coffee. I will not take no.'],
  hobbies: ['Ori! Ready for a round?', 'Perfect, you came. I saved the best spot for you.'],
  family: ['Ori, habibi! Come in, come in.', 'You came! Are you hungry? You must be hungry.'],
  strangers: ['Oh, hello! Lovely day for it.', 'Hi there! Good timing, I was about to ask somebody something.'],
};

/** A short, friendly chat for any other character: a hello, a choice (small talk / a favour offer), a goodbye. */
export function genericGraph(id) {
  const c = CAST[id];
  if (!c) throw new Error(`no conversation for "${id}"`);
  const pool = ROLE_LINES[c.rel] || ROLE_LINES.strangers;
  const hi = pool[(id.length + c.name.length) % pool.length];
  return {
    id: `chat-${id}`, who: id, title: c.name, start: 'hi',
    nodes: {
      hi: { s: id, e: 'smile', t: hi, choices: [
        { t: 'Lovely to see you! How is your day going?', next: 'day', fx: { rel: 2 } },
        { t: 'Anything I can do for you today? I would be happy to.', next: 'offer', fx: { rel: 1, flag: `${id}.offered` } },
        { t: 'Just saying hello. You make this street better!', next: 'warm', fx: { rel: 3 } },
      ] },
      day: { s: id, e: 'laugh', t: 'Busy, busy, but better now that you are here.', next: 'bye' },
      offer: { s: id, e: 'proud', t: 'You are a good one, Ori. Check your phone later. I might have something.', next: 'bye' },
      warm: { s: id, e: 'love', t: 'Oh! Stop it. ...No, keep going. Thank you, Ori.', fx: { chaos: -1 }, next: 'bye' },
      bye: { s: 'ori', e: 'grin', t: 'See you soon!', end: true },
    },
  };
}

/** Every flag the games set outside the graphs (none yet) — the validator may treat them as known. */
export const KNOWN_FLAGS = [];
