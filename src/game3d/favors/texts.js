// "Ori, Can You...?" — every word the game says in its own voice (the HUD, the toasts, the phone's empty states, the end-of-day lines),
// in one place: easy to translate, and `scripts/test-favors-persona.mjs` reads it to check the PERSONA. Ori is ALWAYS positive, warm and
// kind: he never snaps, never sulks, never says "missed" or "failed"; when he cannot do something he says so lovingly; humour comes from the
// absurd day and from his relentless niceness. (What other people say to him — the task texts in content.js — is theirs, not his.)

const pick = (list, n) => list[Math.abs(n) % list.length];

export const TEXT = {
  // a task ran out of time: a rain check, never a failure
  nextTime: ['Next time!', 'Rain check!', 'I owe you one!', 'Soon, I promise!'],
  rainCheck: (giver, title) => `${giver} understands - "${title}" gets a rain check!`,
  mentorsTried: (title) => `The mentors gave it their best - "${title}" waits for a better day.`,
  mentorsOnIt: 'The mentors are on it. You are the best.',
  coffee: 'Coffee! Free sprinting for a few seconds',
  focusOn: 'Do Not Disturb: a little quiet for me',
  focusOff: (n) => (n ? `Back online - ${n} lovely ${n === 1 ? 'person is' : 'people are'} waiting` : 'Back online - everyone is lovely'),
  nothingHere: 'Nothing to do here right now - the phone knows the next stop',
  nobodyAsked: (place) => `${place}: all good here, nobody needs anything right now`,
  // the phone
  allCaught: 'All caught up. Lovely!',
  noMessages: 'No messages yet.',
  nothingToHand: 'Nothing the mentors can take right now.',
  tasksTitle: 'Tasks',
  following: 'Following',
  follow: 'Follow',
  askMentors: 'Ask the mentors',
  handOver: 'Hand over',
  mentorsBlurb: (pct) => `They take the easy favours off you: ${pct}% of the time they get it right, for 60% of the reward.`,
  dndTitle: 'Do Not Disturb',
  dndOn: (left) => `On for ${left} more. The tasks wait for you - and arrive together when it ends.`,
  dndRest: (left) => `Resting for ${left}.`,
  dndIdle: (min, hours) => `Quiet for up to an hour (${min} min). Then ${hours} h before you can again.`,
  mapHint: 'Tap a pin to follow it. The blue arrow is you.',
  peekMore: (n) => (n > 1 ? `+${n - 1} more` : ''),
  keysHint: '1-9 pick · F follow · Y yes · L later · N rain check · [ ] tabs · Tab hides',
  // the end of the day
  dayOver: 'The day is over',
  reportLines: (helped, aunts, mumCalls, fake) => [
    `You helped ${helped} ${helped === 1 ? 'person' : 'people'}.`,
    `You gave ${aunts} ${aunts === 1 ? 'aunt' : 'aunts'} a rain check.`,
    `Mum called ${mumCalls} times (${fake} of them URGENT).`,
    'You slept 0 hours.',
  ],
  anotherDay: 'Another day',
  backToDesktop: 'Back to the desktop',
  pausedHint: 'Esc resumes · the day waits for you',
};

/** A different warm line each time, but always the same for the same task. */
export const nextTimeFor = (uid) => pick(TEXT.nextTime, uid);

