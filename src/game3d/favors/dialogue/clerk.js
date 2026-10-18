// Conversation 2 — Shoshana, the City Hall clerk. Form 17 needs form 18; form 18 needs a stamp from the kiosk. Kindness works better than a number.
export default {
  id: 'clerk', who: 'clerk', title: 'Form 17', start: 'hi',
  nodes: {
    hi: { s: 'clerk', e: 'neutral', t: 'Number?', choices: [
      { t: 'Good afternoon, Shoshana! I have number 84, a smile, and form 17.', next: 'f17' },
      { t: 'I only have a smile today. Could it work as a number?', next: 'smile', fx: { rel: 1 } },
    ] },
    smile: { s: 'clerk', e: 'smirk', t: 'In thirty years, nobody has tried that. No. But it was a good attempt.', next: 'f17' },
    f17: { s: 'clerk', e: 'neutral', t: 'Form 17 is only valid with form 18. Form 18 needs a stamp. The stamp lives at the kiosk. The kiosk closes at some point.', choices: [
      { t: "That's a clear route. Thank you for walking me through it.", next: 'warm', fx: { rel: 2 } },
      { t: 'Shoshana, your glasses are wonderful. Are those new?', next: 'glasses', fx: { flag: 'clerk.glasses', rel: 3 } },
      { t: 'Could the stamp come to us, just this once? I would owe you a coffee.', next: 'coffee' },
    ] },
    warm: { s: 'clerk', e: 'smile', t: 'Hm. Polite people. I should write that down somewhere.', next: 'tip' },
    glasses: { s: 'clerk', e: 'surprised', t: "My glasses? My sister chose them. She said they were 'a lot'.", fx: { chaos: -2 }, next: 'glasses2' },
    glasses2: { s: 'ori', e: 'smile', t: "They're exactly enough. They look like somebody who knows where every form lives.", next: 'thaw' },
    thaw: { s: 'clerk', e: 'proud', t: '...I do. Come closer, I will tell you something. Between us.', fx: { flag: 'clerk.thawed' }, next: 'tip' },
    coffee: { s: 'clerk', e: 'smirk', t: 'A stamp does not travel. A coffee, though, is noted.', fx: { flag: 'clerk.coffee' }, next: 'tip' },
    tip: { s: 'clerk', e: 'talking', t: 'The kiosk man stamps form 18 before three, never after. Say Shoshana sent you.', fx: { hint: 'Shoshana: the kiosk stamps form 18 before 15:00. Say she sent you.' }, next: 'extra' },
    extra: { s: 'clerk', e: 'smile', t: 'And when you come back, take number 85. I will pretend the queue is shorter.', choices: [
      { t: "Shoshana, you're the best part of City Hall.", if: { flag: 'clerk.thawed' }, next: 'best', fx: { rel: 3, chaos: -2 } },
      { t: 'I will be back before three, number in hand!', next: 'bye' },
    ] },
    best: { s: 'clerk', e: 'love', t: 'Go. Before I change my mind about the pretending.', next: 'bye' },
    bye: { s: 'ori', e: 'grin', t: 'Kiosk, stamp, form 18, form 17, done. See you soon!', end: true },
  },
};
