// Conversation 3 — a passer-by who has been looking for Bus 5 for a while. "The stranger" is whoever Ori stopped (the game fills in the face and name).
export default {
  id: 'stranger', who: 'stranger', title: 'A stranger asks', start: 'hi',
  nodes: {
    hi: { s: 'stranger', e: 'flustered', t: "Excuse me! Do you know where Bus 5 stops? I think I've walked around the same fountain twice.", choices: [
      { t: 'I do! Straight toward the sea, then left at the palms.', next: 'dirs', fx: { rel: 3 } },
      { t: "I'm heading that way. Walk with me?", next: 'walk', fx: { rel: 5, flag: 'stranger.walked' } },
      { t: 'That fountain is a famous trap. Everyone does a lap. Welcome to the club!', next: 'club', fx: { rel: 2 } },
    ] },
    dirs: { s: 'stranger', e: 'smile', t: "Toward the sea, left at the palms. Wonderful. You've saved my afternoon.", next: 'bag' },
    club: { s: 'stranger', e: 'laugh', t: 'A club! Do we get a badge?', next: 'club2' },
    club2: { s: 'ori', e: 'wink', t: 'You get the smell of fresh coffee on the corner. Close enough. Palms, then left.', next: 'bag' },
    walk: { s: 'stranger', e: 'love', t: "You would? Everyone here is so kind. Back home, nobody even looks up.", next: 'walk2' },
    walk2: { s: 'ori', e: 'smile', t: 'Looking up is half of this neighbourhood. The other half is the bakery.', next: 'bag' },
    bag: { s: 'stranger', e: 'talking', t: 'Your timing is perfect. This bag is heavy. Do people here always carry so much?', choices: [
      { t: 'Only the lucky ones. What do you have in there?', next: 'bagq' },
      { t: 'I love your jacket, by the way. Great colour.', next: 'jacket', fx: { rel: 2, flag: 'stranger.complimented' } },
      { t: 'Let me carry it to the stop. I am quite strong with boxes.', next: 'carry', fx: { rel: 4, flag: 'stranger.carry' } },
    ] },
    bagq: { s: 'stranger', e: 'proud', t: 'Tahini. Six jars, for the whole family. They never believe me that it is better here.', fx: { hint: 'The stranger loves tahini. A jar makes a good thank-you.' }, next: 'bye' },
    jacket: { s: 'stranger', e: 'proud', t: 'Thank you! I bought it for exactly this trip, and nobody has said a word. You made my day.', next: 'bye' },
    carry: { s: 'stranger', e: 'love', t: "I'll never forget this. What is your name? I'll tell them about you.", next: 'name' },
    name: { s: 'ori', e: 'grin', t: "Ori! If they ask: the one with the curls and the glasses. I'm easy to find.", next: 'bye' },
    bye: { s: 'stranger', e: 'smile', t: 'Thank you, Ori. Shalom, and enjoy the day!', end: true },
  },
};
