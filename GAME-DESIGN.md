# Ori, Can You...? — Game Design (v3: Ori's life, the ring and the last boss)

> **TL;DR (עברית)** — המשחק עבר שינוי כיוון אחרי המשוב של שילה ("המשימות משעממות, אין פעולות מעניינות, הדיאלוגים גרועים, והמיליון הודעות בטלפון מציקות"). עכשיו אין טלפון ואין הודעות. החיים של אורי הם: **ברכות** (שלום ← בועת דיבור ← מד חיבה עולה), **המשרד** (שילה עובד שם, ועל המחשב יש משחקים: משחק בתוך משחק בתוך מחשב), **זירת אגרוף** אמיתית על המגרש (אגרוף, בלוק, דאש, פרי, התחמקות מושלמת, קומבו, רמות ומהלכים חדשים) עם סולם של חמישה יריבים מהשכונה, ואחרי האלוף מופיע **בוס סופי נסתר: שילה** שזז במהירות מוגזמת ועושה "גליץ'". מטרה אחת בכל רגע (שבב עם חץ וקרן אור), יומן ב-Tab, והכול נשמר.

## 0. The new core (v3)

**The fantasy:** Ori is a programmer and a boxer in a friendly neighbourhood. His day: say hello to everybody (they answer in speech bubbles; the neighbourhood's *love* grows), pop into the office (Shilo is there, the computer has games), and climb the ladder at The Ring. There is no phone, no message, no deadline.

**The things you DO (the verbs):** walk / sprint / drive (as before) + **say hello (H)** + in the ring **jab (J), cross (K), guard (hold L), dash (Space), peach fury (F)**; at the office computer **play blocks or 2048**.

**Moment to moment (30 s):** a hello (a wave, "Hi!", an answer with a heart) -> a goal chip tells what is next -> the ring: read the opponent's wind-up, dash through it (PERFECT: slow motion and a counter) or guard it at the last moment (PARRY), then hit back. A fight is 30-70 seconds.
**5 minutes:** one fight, XP, a level, a new move (Lv 2 hook finisher J,J,K - Lv 3 counter - Lv 4 uppercut J,J,J,K - Lv 6 Peach Fury), peaches for the garage (the quick car), love for the crowd (it grows round the ring).
**A day:** hellos for love, the office game for peaches, three or four fights; the day cycle rolls over at midnight (he sleeps; everything is kept).
**The point:** love opens the ladder (the champion needs love 30), the ladder ends with the champion, and then **somebody nobody knew about** steps into the ring: Shilo, the developer, with absurd speed (he runs at 7 m/s and *blinks* behind you), a "buffering" moment after a flurry that is the opening, and low-ish health you can only take down with the dash/parry game of a high level.

**Code map (v3):** `boxing.js` (pure fight sim + AI + tests), `boxer.js` (levels/moves), `fight-content.js` (the ladder, the boss, the gates), `fight3d.js` (the ring on the court, the crowd, the animations, camera, FX), `fight-ui.js` + `fight.css` (bars, big words, the cards), `fight-sfx.js` (synth), `greet.js` + `bubbles-ui.js` (hello and speech bubbles), `goals.js` (one goal at a time), `journal-ui.js` (Tab), `arcade.js` + `arcade-ui.js` (the office computer), `people/anim.js` (+ jab/cross/hook/upper/hit/dodge/taunt, the guard stance, southpaw mirroring), `people/specs.js` (SHILO_SPEC).

**Tests:** `test-favors-boxing.mjs` (rules, parry, perfect dodge, combos, ladder balance with scripted boxers, the boss), `test-favors-life.mjs` (goals, hello, arcade), `e2e-block.mjs favors-life` (the real keyboard: hello x5, journal, office, Shilo, computer, a real fight vs Moti, the hidden boss, the day rollover, a clean quit with no GPU leak), `favors-play` (the older favour missions through the real keys); `smoke.mjs` runs the life block where the old phone block used to be.

**What is NOT done / honest:** the feel (hit weight, difficulty, sound) must be judged by a person: the bots only prove the fights can be won and are not trivial. No touch controls in the ring. No training mini-game yet (speed bag). The favour missions of v2 (delivery, taxi, chase, ... see below) are still in the code and reachable (`quests.inject`), the street hails still appear when you drive; they are simply not the game any more. The long dialogue panel (T61) is only reachable through the dev API.

**Since T64 (Shilo played it):** a MAP so nothing is hard to find (M = the big map with every place and what it offers; the minimap shows the ring, the office computer, the garage, the cafe and his car; the goal "Find The Ring"; a glowing column over the ring; a line at every door), a car that can say hello and shows "ORI CAR" every time he steps out, a camera that stays behind the nose in a car, and a ring that FIGHTS better: a boxer's stance and footwork, a real block (forearms up; every punch can be blocked, the uppercut goes under a guard), blows that move the body, a KNOCK-DOWN with a count before the knock-out, and feints from the clever opponents. Details: TODO-ori.md, T64.

---

## 1. Why it is dull today (found by reading the code and playing it)

| Symptom the owner feels | Real cause in the code |
|---|---|
| "Missions are boring" | `useDoor()` in `game.js` calls `quests.complete(uid, 0.85)` the moment Space is pressed at the door. The eight mini-games in `verbs.js` (carry, fix, queue, chat, shop, escort, assemble, handle) are fully written and tested, but **nothing imports them**. |
| "Nothing happens" | The only events are tasks arriving on the phone. No incidents on the street, no weather that matters, no rival, no story beyond two `then:` chains. |
| "No point" | Score only drives a rank title. No money, nothing to buy, nothing unlocked, no end. Days are identical; a new day is a new seed and zero memory. |
| Cars have no purpose | Driving is never faster *in a way that matters*: tasks complete on a Space-press, so the quick peach-badge car, the afterburner, the traffic and the knock-about physics have **zero gameplay consequences**. |
| City too small | 290 x 300 m, 14 places, every task is "go to a door". Nothing to discover between the doors. |
| Failure is invisible | A missed deadline silently becomes a rain check; the player never feels the cost or the relief. |

The good news: the *expensive* parts exist (character, cars, traffic, physics, dialogue graph, interiors, phone, quest director). The game needs a **spine** and **verbs that use the world**.

## 2. Core fantasy

**"The man who does everything for everyone."** Ori cannot say no (he says "rain check!" with love). Tel-Aviv-ish neighbourhood, one hot day, a phone that never stops buzzing. Everyone's problem is small, absurd and urgent *to them*. The player's joy is **juggling**: choosing which favour, in which order, by which vehicle, and pulling off a delivery with one second to spare. The tone is a love letter: Mum, Auntie, the Inspector, Noam, Moti, the parrot guy. Nothing is cruel. The comedy comes from escalating absurdity and Ori's relentless niceness.

**The point:** *this week, the neighbourhood is going to throw Ori a surprise party on Friday night ("Sababa Night"). Who comes — and how big it gets — depends on everything you did this week.* The whole game is the answer to "who did I look after?"

## 3. The loop

### 30 seconds — "A favour in motion"
The phone buzzes → glance → accept (Y) or rain-check (N) → the **beam + edge arrow + route chip** point at the next stop → move (run, or jump in the car) → something *happens on the way* (traffic, a cat on the road, a hail from a stranger, rain) → arrive → do the **mission's own mechanic** (carry a fragile cargo to the door; hold-and-release the wrench in the green; catch the parrot) → peaches fly up, Mum texts "that's my boy".

### 5 minutes — "A route"
2-4 open favours at once. Route-planning is the skill: the cafe on the way to City Hall; the kiosk's milk *and* Roee's gift in one trip; the ice cream (melts in 11 minutes) before the sofa (no deadline). The phone's list shows urgency, pay and distance. A *street hail* can appear while driving: a pedestrian waves → optional taxi fare for quick peaches.

### One day (14 min real time, 06:00 → 24:00) — "Pressure and peaks"
- Opening hour (tutorial: Mum's "URGENT" remote, the coffee, the bread).
- Morning: City Hall errands (closes 15:00).
- Midday: **event** (see §7) — rain, the parade closes the main street, a blackout at night.
- 16:00: a **set piece** on days 3-5.
- Evening: the chaos meter peaks; Do Not Disturb and the mentors earn their keep.
- **Day summary**: peaches earned (per favour, tips, bonuses), hearts moved per relationship, golden peaches found, best moment; "Uzi's Garage has something you can afford".

### A week (5 days + the finale) — "The arc"
Wallet, upgrades, relationships and unlocked places **carry over**. Day N+1 is harder (higher task rate, more epic tasks, more simultaneous requests, stranger events) but *you* are also stronger. Day 5's evening ends in **Sababa Night**: a short interactive finale (a set-piece party delivery + the speech) and a warm end card showing who came.

## 4. Why it is fun (design pillars)

1. **Variety of hands.** No two favours feel the same: they use *driving, running, timing, observation, social reading, memory*. (§6)
2. **Juggling decisions with visible numbers.** Every task shows pay, deadline, distance; you choose.
3. **Speed is skill, and speed is rewarded.** Early arrival multiplies pay; the quick car and afterburner finally matter; fragile cargo punishes recklessness, so *fast-and-gentle* is the thrill.
4. **Always something to look at.** Golden peaches glint around corners, hails, weather, a rival courier, NPCs with barks.
5. **Soft stakes.** No "game over". A late favour = rain check: lose pay and a bit of that person's heart, and their *next* request is a make-up one with a bonus. (Positive framing, real consequences.)
6. **Spending is exciting.** Upgrades change *how you play* (boost tank, grip in the rain, cargo box, sneakers), not just numbers.
7. **A reason to come back tomorrow:** the party list, upgrades, the teaser line on the day card.

## 5. Stakes, consequences, difficulty (kept positive)

| Mechanic | What it costs / gives | Voice |
|---|---|---|
| Deadline passes | Pay lost, that relationship −N hearts, chaos +N, task becomes a *rain check* (re-offered later, +20% bonus, once). | "Auntie understands - gets a rain check!" |
| Poor quality (dropped dish, melted ice cream) | Lower pay + smaller heart gain, still "done". | "It is the thought that counts!" |
| Chaos meter high | Phone buzzes faster, Ori winded sooner, traffic jumpier; Do Not Disturb / Coffee reset it. | |
| Relationships (7) | Pay multipliers, discounts, who shows up Friday, which NPC offers a *story chain*. | |
| Rivals for your time | Double bookings (two places at once), fake-URGENT Mum calls, Noam's "one more thing". | |
| Escalating absurdity | Day 1: lemons, bread. Day 3: a parrot escape, a courier race. Day 5: the investor demo, the surprise party. | |
| Difficulty | Per-day rate x (0.7, 0.85, 1.0, 1.15, 1.3); epic tasks unlock on day 3+; boss days 3/4/5; deadline slack shrinks 5%/day; `chill / normal / hectic` still scales everything. | |

Never: lives, timers that end the game, shaming text. The persona lint (`test-favors-persona.mjs`) stays the guard.

## 6. Mission catalogue — 14 mechanics (what code each needs)

Legend: **[built]** = in the vertical slice (Phase 2). **[next]** = designed, needs the listed code.

| # | Mission type | Mechanic (what the player DOES) | Code needed |
|---|---|---|---|
| 1 | **Fix it** (Mum's bulb, Wi-Fi cable, the bike) **[built]** | Hold Space, release inside the green window, three stages, the window shrinks. | `verbs.js: fix` (exists) + `verb-ui.js` overlay |
| 2 | **Stamp on the beat** (forms, the banner, the launch button) **[built]** | A marker sweeps; Space in the middle zone x4-5, it speeds up on hits. | `verbs.js: handle` + overlay |
| 3 | **Queue / wait politely** (City Hall) **[built]** | Sigh with Space to speed the number up, but too many sighs annoy the clerk (stall). | `verbs.js: queue` + overlay |
| 4 | **Read the room** (Mum's phone lesson, Roee, speech, Auntie's photos) **[built]** | 3 timed prompts, pick the answer that matches how that person likes to be spoken to (warm / confident / polite / excited...). | `verbs.js: chat` + overlay; `likes` per template |
| 5 | **Shopping shelf** (bread, flowers, pizza, gift) **[built]** | A shelf grid, find the right items (the OTHER bread); 5 wrong picks ends it. | `verbs.js: shop` + overlay |
| 6 | **Assemble** (Moti's wardrobe, whiteboard, banner) **[built]** | Press the arrow/action sequence in order, per-step timer. | `verbs.js: assemble` + overlay |
| 7 | **Fragile delivery** (casserole, ice cream before it melts, Mum's sunscreen) **[built]** | Pick up at A, carry to B. A *cargo meter* drops with hard braking, car bumps, sprint-jostle and (ice cream) melting time. Drive gently or run carefully; cargo box upgrade helps. Quality = cargo left. | `missions.js: delivery`, cargo HUD meter, drive-hit hook (`veh.state.hit`), sprint check |
| 8 | **Taxi passengers with moods** **[built]** | Passenger waits at a stop; get them in (stop near), drive to their destination. *Rushed*: tip decays with time. *Nervous*: hits, boost and sharp turns drain mood. *Sightseer*: must pass a landmark first. Tip = mood x distance. Also appears as random **street hails**. | `missions.js: taxi`, passenger mesh, mood HUD, hail spawner |
| 9 | **Find the lost thing** (the cat Pishi/Yossi, Itay hiding, Yuval's homework) **[built]** | A hidden target in the park/beach. NPC clue narrows the zone; a **warm/cold meter + pinging sound** guides you; Space when close. | `missions.js: find`, warmth HUD, ping SFX, target mesh |
| 10 | **Chase and catch** (the Parrot Guy's parrot, the runaway ball) **[built]** | The target flees at 5-6 m/s with bursts and dodges; sprint burns stamina; coffee = free sprint. Corner it near walls. Catch inside 1.2 m. | `missions.js: chase` (flee AI on the collision world), bird mesh |
| 11 | **Shopping list across shops** (milk+eggs+cake; 13 pizzas; the team salads) **[built]** | 3-4 items spread over 3 shops; free order; one item is **sold out** at the first shop (a detour twist: "try the cafe!"). Par-time bonus for an efficient route. | `missions.js: list`, checklist HUD |
| 12 | **Race the rival courier** (set piece) **[built]** | Dov the bike courier races you through 5 checkpoints; he follows the street graph at a pace that scales with the day. Win = big bonus, he joins the party. Lose = a rain check and he buys you a coffee. | `missions.js: race`, checkpoint rings, rival mesh on graph path |
| 13 | **Gauntlet** (the Inspector's inspection, boss) **[built]** | 4 mini-games back to back (queue -> 17/18 form -> stamp -> chat with the Inspector), each harder, one shared quality bar. | `missions.js: gauntlet` over `verbs.js` |
| 14 | **Barista rush** (Cafe Sababa) **[next]** | Orders pile up; press keys for cup / shot / milk / lid per order in time. | new verb `barista` (pure state machine) + UI |
| 15 | **Escort** (cousin to the bus, Noga to the park, the tourist, an old lady) **[next]** | Walk someone along a route; they stop to look at things; stay within 6 m; do not rush. | `verbs.js: escort` (exists) + a followed NPC on a sidewalk path (needs `walkPath` in `map.js`) |
| 16 | **Collect signatures** (petition) **[next]** | Approach passers-by; each is a mini `chat` with a random liked tone; 5 signatures in 4 min. | crowd lookup + `chat` verb |
| 17 | **Party planning** (final week) **[next]** | List mission with 6 stops + a final assemble at the venue. | `list` + `assemble` |
| 18 | **Rescue the cat from the tree** **[next]** | `find` -> `fix` (hold/release ladder) -> `carry` back. | chained missions via `then:` |

The slice builds #1-13. Everything is deterministic from the seed, so it is testable with scripted input.

## 7. Events that interrupt a day (event director, `events.js`)

| Event | When | Effect | Code |
|---|---|---|---|
| **Rain shower** | seeded 1-2 per day (weather plan already exists) | Car grip -25% (tyre upgrade reduces it), cargo meters more fragile, *umbrella tips* (+20% pay on deliveries), chaos eases. | `weather.js` (exists) + `events.js` multipliers |
| **Parade closes the main street** | day 2+, 12:00-14:00 | Barrier colliders across the east-west street at the main crossing; traffic queues; the beam routes you around. Marchers (crowd). | `collide.js` dynamics + `traffic.js` others |
| **Rush hour** | 17:30 | Three tasks arrive at once with a "batch" bonus if all done. | `quests.js` burst already exists, add bonus |
| **Blackout** | night day 4 | Lights off; fog; *golden peaches glow*. | `daycycle.js` |
| **Street hail** | any time you drive, every ~90 game minutes | A walker waves; taxi mini-mission, optional. | `missions.js: taxi`, hail spawner |
| **Mum's surprise visit** | random | Mum shows up wherever you are with an URGENT ask. | director |

Slice: **rain shower**, **rush bonus**, **street hails**, **golden peaches**. Parade/blackout designed, next.

## 8. Collectibles and secrets
- **12 Golden Peaches** hidden around the map (rooftop-adjacent nooks, behind the park fountain, on the pier). They glint (a bobbing peach + sparkle) and hum when near; collecting pays 25 peaches and fills a *party-decoration* meter for the finale. Found state is saved.
- **Secret shortcuts:** the alley between Studio and Cafe (a gap in the building line), a beach boardwalk loop for the car (+boost pad).
- **Barks with secrets:** a stranger tells where one is if you talk (T) and compliment.
- **Cat photos** (day 5 gallery): 3 cats exist in the world already (`life3d.js`).

## 9. Progression and economy
Currency: **peaches** (the owner's logo is a peach). Hearts = the 7 relationships (0-100). Money and hearts are separate on purpose.

**Income per favour** = `base(tone) x quality x earliness x relationship bonus + tip`.
- base: trivial 14, absurd 28, epic 50. Quality 0.5-1.3 (0.7+0.6q). Earliness up to +30%.
- Mission tips: taxi up to +25, race win +120, gauntlet +150, golden peach +25.
- Target: ~320 peaches on a good day 1 rising to ~600 on day 5. Total week ~2200.

**Uzi's Garage** (the workshop, any time you stand at its door, press Space) — 12 upgrades with prices ~2.2k total (you cannot buy everything in one run: choices matter):

| Upgrade | Levels | Effect | Why it matters |
|---|---|---|---|
| Engine | I-III | top speed +9%/level, accel +12%/level | Beat the race; earn earliness bonus |
| Grip tyres | I-II | more grip, rain penalty halved | Rain days, fragile cargo |
| Afterburner tank | I-III | boost fuel 2.5 s -> 4 / 6 / 8 s | The flashy fun; escapes traffic |
| Sneakers | I-II | stamina drain -20%/level, sprint +6% | Chases, long errands on foot |
| Cargo box | I | cargo damage -35% | Deliveries, ice cream |
| Second phone | I | +1 mentor token (helpers take trivial jobs) | Juggling |

Later (design only): clothes (cosmetic + a +1 perk each, bought at "Tamar's"), a **home upgrade** (the desk phone: see tomorrow's first three tasks; a coffee machine = a free sprint each morning), **helpers** you hire (Roee runs errands), **new districts** (§10) unlocked by hearts.

## 10. Making the city feel bigger and denser (without breaking performance)
Today: 3 avenues x 3 streets, 14 places, 24 traffic cars, 40 walkers, ~450 draw calls, 73 fps on the RTX 3060 harness. Budget: <= 700 calls / 2.5M tris (enforced by the e2e test).

1. **Destinations that matter, not square metres.** Every place gets a *reason*: Garage (shop), Cafe (barista, coffee), Kiosk (shopping), Perach (events), City Hall (boss). In the slice the Garage and a pickup/dropoff set across the whole map make the *distances* matter (the quick car and boost finally pay).
2. **Grow the grid by one ring (next, high value):** `ROAD_X`/`ROAD_Z` are parametric in `map.js`. Adding a 4th avenue and 4th street grows the area ~70% (about 380x390 m). New named places: *Harbour Market* (north, a fish market, a pier with boats), *The Hill* (east, a school and a lookout), *The Roundabout Cafe*. Traffic lanes, street graph, slabs, minimap and the buildings generator all derive from the arrays; the buildings are already cut into frustum-culled chunks. Cost: more lots (draw calls scale with *visible* chunks), a longer far-plane fog. Needs tests for door reachability (already in `validateMap`).
3. **Shortcuts and risk/reward routes:** the park diagonal (foot only), the promenade (car boost pad), an alley.
4. **Density without cost:** more `crowd` walkers use instanced meshes (already), per-district `barks`, shop awnings, street vendors as non-colliding decor, more hails.
5. **Vertical:** interiors (T62) double the number of "places": the cafe/City Hall/Mum's flat become venues for mini-games.

## 11. Stories and recurring cast (multi-step chains)
Chains use `then: { id, delay }` plus a `needs` flag from the dialogue graph.

1. **The Casserole Saga** (Mum): deliver the casserole to Auntie *without spilling* -> Auntie's verdict (`chat`) -> Auntie asks for the recipe -> Mum's secret (dialogue) -> both ask you to settle it at the party. [built: delivery + verdict]
2. **Form 3B** (Maya + Shoshana): Perach form -> City Hall stamp (wrong colour) -> the Inspector's inspection (boss gauntlet). [built]
3. **The Parrot** (Parrot Guy): hold the parrot -> it escapes -> chase it through the park -> it lands on Moti's balcony -> Moti keeps it for the party. [built: hold + chase]
4. **Noam's Launch** (CEO): oat flat white -> "the thing is blue" fix -> the investor demo (`chat` with `excited`) -> Noam shows up Friday with a cake. [partial]
5. **Dov the Courier**: day 1 he passes you on a bike; day 3 he challenges you (race); day 5 he delivers the party cake. [built: race]
6. **Moti's Wardrobe** -> shelf -> the screws are in the pocket (a find + assemble). [next]

## 12. Set pieces (boss-like)
1. **The Great Courier Race** (day 3, 16:00) — rival vs. you; 5 checkpoints; scaling rival speed.
2. **The Inspector's Inspection** (day 4, City Hall) — four mini-games in a row, one shared quality bar.
3. **Sababa Night** (day 5, 21:00) — the finale: collect the cake (delivery), fix the lights (fix), welcome guests (chat), the speech; the end card lists who came.
4. Small spectacles: the investor demo, the parade, the ice-cream sprint.

## 13. Goal, ending, replay
- **Goal:** survive the week as a *Pillar of the Neighbourhood* (rank) and throw/attend Sababa Night.
- **Ending card:** "Who came": each relationship with >= 55 hearts sends guests (Mum, Auntie, Noam, the Inspector, Moti, Roee, Dov, the Parrot). A hearts total sets the party size and a closing line from Mum. Always warm; a small party is still "the nicest party".
- **Replay:** new week = new seed, upgrades reset (or "New Game+" keeps one), medal "Full house" (everyone came), "Speed demon" (all deliveries intact), "All 12 peaches".

## 14. What is built in Phase 2 (vertical slice) vs later

**Built now** (code in `src/game3d/favors/`): `economy.js` (peaches, upgrades, perks, save), `campaign.js` (week/day state, finale guests), `missions.js` (pure mission engine: delivery, taxi, find, chase, list, race, gauntlet), `mission-world.js` (3D markers/targets), `play-ui.js` + `play.css` (verb overlay for 8 verbs, mission panel, peaches counter, boost bar, garage shop, day summary), wiring in `game.js`; new templates and texts; tests `test-favors-missions.mjs`, `test-favors-economy.mjs` and a scripted-keyboard e2e.

**Next (designed, not built):** barista verb, escort NPC, petition, parade/blackout events, home/clothes, expansion ring + districts, more chains.

## 15. Risks and honesty
- Feel (pacing, difficulty, sounds) must be *played by a person*; the scripted bots prove completability, not fun.
- Day length is 14 real minutes; a 5-day week is ~70 minutes. Shorter days (`o.dayMinutes`) are supported by the clock.
- The interiors/characters/dialogue are being edited by other sessions; the slice is wired through small hooks so it merges cleanly.
