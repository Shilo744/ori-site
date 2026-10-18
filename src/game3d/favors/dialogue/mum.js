// Conversation 1 — Mum, at her door. The soup comes first; the light bulb comes second. (TODO(real fact): swap in what Mum really says.)
export default {
  id: 'mum', who: 'ima', title: "Mum's soup", start: 'hi',
  nodes: {
    hi: { s: 'ima', e: 'love', t: 'Ori! Habibi! Look at you, so thin. Sit, sit. Have you eaten?', choices: [
      { t: "Mum, I'd love to. What are we having?", next: 'soup' },
      { t: "I ate! But I'm always ready for your soup.", next: 'soup', fx: { rel: 1 } },
      { t: 'Mum, you look wonderful today.', next: 'blush', fx: { rel: 3, flag: 'ima.complimented' } },
    ] },
    blush: { s: 'ima', e: 'proud', t: "Stop it. It's the new hairdresser. Seven shekels more, and worth every one.", next: 'soup' },
    soup: { s: 'ima', e: 'smile', t: 'Chicken soup. And kubbeh. And a little salad. Small. Just so you have tasted something.', next: 'soup2' },
    soup2: { s: 'ori', e: 'grin', t: "That's the 'little' I love most.", next: 'bulb' },
    bulb: { s: 'ima', e: 'talking', t: 'Now, one tiny thing. The light bulb in the hall. Higher than me, higher than the ladder. It is a miracle it ever worked.', choices: [
      { t: 'On it, Mum. Consider the hall glowing.', next: 'promise', fx: { rel: 4, flag: 'ima.bulb' } },
      { t: "After the soup, if that's alright? I'd love a second bowl first.", next: 'later', fx: { rel: 2, flag: 'ima.later' } },
      { t: 'What if I change the bulbs for the whole building?', next: 'big', fx: { flag: 'ima.bigplan' } },
    ] },
    promise: { s: 'ima', e: 'love', t: 'My hero. Take a box of cookies for the road. No, take two.', fx: { give: 'cookies', chaos: -2 }, next: 'bye' },
    later: { s: 'ima', e: 'laugh', t: 'A second bowl, he asks for! Eat, eat. The bulb waits, the soup does not.', next: 'bye' },
    big: { s: 'ima', e: 'surprised', t: 'The whole building? Mrs. Cohen will cry. She will also give you opinions. About bulbs.', choices: [
      { t: 'I would love her opinions. I mean it.', next: 'bigok', fx: { rel: 3 } },
      { t: "Mum, you're the reason I try to help everyone.", if: { rel: 70 }, next: 'heart', fx: { rel: 4, flag: 'ima.heart' } },
      { t: "Let's start with your hall and see where the day goes.", next: 'promise' },
    ] },
    bigok: { s: 'ima', e: 'proud', t: 'Such a good boy. Take cookies. Take two.', fx: { give: 'cookies', chaos: -1 }, next: 'bye' },
    heart: { s: 'ima', e: 'love', t: "Oy, now I'm crying into the soup. Come here, come here.", fx: { chaos: -4 }, next: 'bye' },
    bye: { s: 'ori', e: 'love', t: "Love you, Mum. I'll text you the second the hall is bright.", end: true },
  },
};
