// First-run onboarding (T16, calmed in T50): the first time you enter the screen ONE quiet tip arrives, a few seconds in. The Welcome
// window already introduces the Dock and the apps. Runs once (persisted); Reset progress (Settings → General) brings it back.
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
    { at: 8000, title: 'Tip: press Ctrl + Space for Spotlight', body: 'Search apps, notes and projects from anywhere.', onClick: openSpotlight },
  ];
  steps.forEach((s) => setTimeout(() => { if (isLive()) notify({ title: s.title, body: s.body, app: s.app, onClick: s.onClick || (s.app ? () => open(s.app) : undefined) }); }, s.at * k));
  return true;
}
