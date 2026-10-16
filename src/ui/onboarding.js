// First-run onboarding (T16): the first time you enter the screen, a few friendly notifications arrive one by one.
// Runs once (persisted); Reset progress (Settings → General) brings it back.
import { storage } from '../core/storage.js';
import { notify } from '../core/notify.js';

/**
 * @param {object} o
 * @param {boolean} [o.fast]               shorter delays (tests)
 * @param {() => void} o.openSpotlight
 * @param {(id: string, args?: object) => void} o.open
 * @param {() => boolean} o.isLive         still on the screen? (skip the rest if the visitor left)
 */
export function startOnboarding({ fast = false, openSpotlight, open, isLive }) {
  if (storage.get('onboarded', false)) return false;
  storage.set('onboarded', true);
  const k = fast ? 0.12 : 1;
  const steps = [
    { at: 1800, title: 'Welcome to Ori’s MacBook', body: 'Everything here works — click around.', app: 'welcome' },
    { at: 7500, title: 'Press Ctrl + Space for Spotlight', body: 'Search apps, notes and projects from anywhere.', onClick: openSpotlight },
    { at: 13500, title: 'The Arcade is in the Dock', body: 'Snake, 2048, Tetris and Minesweeper. Beat your best.', app: 'arcade' },
    { at: 19500, title: 'Try the terminal', body: 'Open it and type help.', app: 'terminal' },
  ];
  steps.forEach((s) => setTimeout(() => { if (isLive()) notify({ title: s.title, body: s.body, app: s.app, onClick: s.onClick || (s.app ? () => open(s.app) : undefined) }); }, s.at * k));
  return true;
}
