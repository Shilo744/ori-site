// The site-wide achievements (T16). Games and the room define their own (Snake, 2048, Tetris, Minesweeper, room
// interactions); this adds the "using the computer" ones. Progress is driven by ui/trackers.js.
import { achievements } from './achievements.js';

const ico = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const ICONS = {
  step: ico('<path d="M5 19c0-3 2-4 4-4s3 1 3 3M12 12c0-3 2-5 5-5 2 0 3 1 3 3s-2 4-5 4"/><circle cx="8" cy="9" r="2"/>'),
  grid: ico('<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>'),
  pad: ico('<path d="M7 9h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.200 2L15 15H9l-.8 1A3 3 0 0 1 3 14v-1a4 4 0 0 1 4-4zM8 11v3M6.500 12.500h3"/>'),
  star: ico('<path d="M12 3l2.600 5.400 5.900.8-4.300 4.100 1 5.900L12 16.400 6.800 19.200l1-5.900L3.500 9.200l5.900-.8z"/>'),
  moon: ico('<path d="M20 14.600A8.400 8.400 0 0 1 9.400 4 8.600 8.600 0 1 0 20 14.600z"/>'),
  sun: ico('<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.600 5.600L7 7M17 17l1.400 1.400M5.600 18.400L7 17M17 7l1.400-1.400"/>'),
  gamepad: ico('<rect x="3" y="7" width="18" height="11" rx="5"/><path d="M8 10.500v4M6 12.500h4M15.500 11.500h.1M17.500 13.500h.1"/>'),
  terminal: ico('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9l3 3-3 3M12 15h5"/>'),
  palette: ico('<path d="M12 3a9 9 0 1 0 0 18c1.500 0 2-1 1.500-2-.5-1.200.200-2.500 1.500-2.500H17a4 4 0 0 0 4-4C21 6.600 17 3 12 3z"/><circle cx="8" cy="11" r="1"/><circle cx="12" cy="7.500" r="1"/><circle cx="16" cy="11" r="1"/>'),
  dark: ico('<circle cx="12" cy="12" r="8.500"/><path d="M12 3.500a8.500 8.500 0 0 1 0 17z" fill="currentColor"/>'),
  swatch: ico('<path d="M5 20c3 0 4-2 4-4V6a2 2 0 0 1 4 0v10c0 2 1 4 4 4"/><path d="M5 20h14"/>'),
  clock: ico('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  stack: ico('<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3"/>'),
  search: ico('<circle cx="11" cy="11" r="6.500"/><path d="M16 16l4.500 4.500"/>'),
  bell: ico('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/><path d="M4 4l16 16"/>'),
  crown: ico('<path d="M4 8l4 4 4-7 4 7 4-4-2 11H6z"/>'),
  book: ico('<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10"/>'),
  calendar: ico('<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
  joystick: ico('<circle cx="12" cy="7" r="3"/><path d="M12 10v5M6 20h12M8 20v-2a4 4 0 0 1 8 0v2"/>'),
  key: ico('<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15 12v2"/>'),
};

/** Registers the catalogue. `counts` = { apps, games } so "open every app / play every game" know their goals. */
export function defineCatalog({ apps = 8, games = 4 } = {}) {
  achievements.define([
    { id: 'first-steps', name: 'First steps', desc: 'Walk up to the MacBook and open it', icon: ICONS.step, rarity: 'common' },
    { id: 'app-hopper', name: 'Window shopper', desc: 'Open every app on the Mac', icon: ICONS.grid, rarity: 'rare', goal: apps },
    { id: 'game-night', name: 'Game night', desc: 'Play every game in the Arcade', icon: ICONS.pad, rarity: 'rare', goal: games },
    { id: 'high-roller', name: 'High roller', desc: 'Set a score in 3 different games', icon: ICONS.star, rarity: 'rare', goal: 3 },
    { id: 'night-owl', name: 'Night owl', desc: 'Use the Mac after dark', icon: ICONS.moon, rarity: 'common' },
    { id: 'early-bird', name: 'Early bird', desc: 'Use the Mac in the early morning', icon: ICONS.sun, rarity: 'common' },
    { id: 'konami', name: 'Old school', desc: 'Enter a famous cheat code', icon: ICONS.joystick, rarity: 'epic', secret: true },
    { id: 'sudo', name: 'With great power…', desc: 'Try sudo in the terminal', icon: ICONS.terminal, rarity: 'rare', secret: true },
    { id: 'wallpaper-changer', name: 'Interior designer', desc: 'Change the wallpaper 3 times', icon: ICONS.palette, rarity: 'common', goal: 3 },
    { id: 'dark-side', name: 'The dark side', desc: 'Switch to Dark Mode', icon: ICONS.dark, rarity: 'common' },
    { id: 'accent-artist', name: 'Colour me', desc: 'Try 4 different accent colours', icon: ICONS.swatch, rarity: 'common', goal: 4 },
    { id: 'time-traveller', name: 'Time traveller', desc: 'See the room at every time of day', icon: ICONS.clock, rarity: 'rare', goal: 4 },
    { id: 'multitasker', name: 'Multitasker', desc: 'Have 5 windows open at once', icon: ICONS.stack, rarity: 'common' },
    { id: 'spotlight-pro', name: 'Spotlight on', desc: 'Open something with Spotlight', icon: ICONS.search, rarity: 'common' },
    { id: 'quiet-please', name: 'Quiet, please', desc: 'Turn on Do Not Disturb', icon: ICONS.bell, rarity: 'common' },
    { id: 'bookworm', name: 'Bookworm', desc: 'Read every note about Ori', icon: ICONS.book, rarity: 'common', goal: 3 },
    { id: 'regular', name: 'Regular', desc: 'Come back on another day', icon: ICONS.calendar, rarity: 'rare' },
    { id: 'completionist', name: 'Completionist', desc: 'Unlock every other achievement', icon: ICONS.crown, rarity: 'legendary', goal: 1 },
  ]);
}
export const ACHIEVEMENT_ICONS = ICONS;
