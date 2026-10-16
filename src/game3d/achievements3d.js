// NEON DRIFT — its achievements, registered with the site-wide catalogue (core/achievements). The game unlocks them from game.js.
const ico = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const ICONS = {
  flag: ico('<path d="M5 21V4M5 5h11l-2 3.500 2 3.500H5"/>'),
  podium: ico('<path d="M3 21h18M4 21v-7h5v7M9.500 21V9h5v12M15 21v-5h5v5"/>'),
  trophy: ico('<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a2 2 0 0 0 2 4M16 6h3a2 2 0 0 1-2 4M12 13v4M8.500 20h7M10 17h4"/>'),
  bolt: ico('<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>'),
  swirl: ico('<path d="M4 16c3 4 11 4 14-1 2-3-1-7-5-6-3 .8-3.500 5 0 5 2 0 3-1.500 2-3"/>'),
  medal: ico('<path d="M8 2h3l1 5M16 2h-3l-1 5"/><circle cx="12" cy="15" r="6"/><path d="M12 12l1 2.100 2.300.3-1.700 1.600.4 2.300-2-1.100-2 1.100.4-2.300-1.700-1.600 2.300-.3z"/>'),
  ghost: ico('<path d="M6 21V11a6 6 0 0 1 12 0v10l-2.500-2-1.800 2-1.700-2-1.700 2-1.800-2z"/><circle cx="10" cy="11" r="1"/><circle cx="14" cy="11" r="1"/>'),
  speed: ico('<path d="M4 18a8 8 0 1 1 16 0M12 18l4-6"/><circle cx="12" cy="18" r="1.200"/>'),
};

/** Registers the NEON DRIFT achievements (call once at start-up, before the first race). */
export function defineDriftAchievements(achievements) {
  achievements.define([
    { id: 'drift-first', name: 'Lights out', desc: 'Finish a NEON DRIFT race', icon: ICONS.flag, rarity: 'common' },
    { id: 'drift-podium', name: 'On the podium', desc: 'Finish a race in the top 3', icon: ICONS.podium, rarity: 'common' },
    { id: 'drift-win', name: 'Chequered flag', desc: 'Win a NEON DRIFT race', icon: ICONS.trophy, rarity: 'rare' },
    { id: 'drift-hard', name: 'No mercy', desc: 'Win a race against the Hard rivals', icon: ICONS.bolt, rarity: 'epic' },
    { id: 'drift-long', name: 'Sideways for ever', desc: 'Hold a single drift for 10 seconds', icon: ICONS.swirl, rarity: 'rare' },
    { id: 'drift-gold', name: 'Gold rush', desc: 'Earn a gold medal on all three tracks', icon: ICONS.medal, rarity: 'legendary', goal: 3 },
    { id: 'drift-ghost', name: 'Beat yourself', desc: 'Beat your own ghost in a time trial', icon: ICONS.ghost, rarity: 'rare' },
    { id: 'drift-speed', name: 'Redline', desc: 'Reach 300 km/h', icon: ICONS.speed, rarity: 'rare' },
  ]);
}
