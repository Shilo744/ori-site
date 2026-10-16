// Applies the system preferences (core/system.js) to the desktop and the audio engine (T11): volume / mute, brightness,
// Night Shift, Reduce motion, Do Not Disturb, Wi‑Fi / Bluetooth state classes for the menubar.
import * as sound from '../audio.js';
import { system } from '../core/system.js';
import { notifications } from '../core/notify.js';

/**
 * @param {object} o
 * @param {HTMLElement} o.root                the `.mac` desktop root
 * @param {(on: boolean) => void} [o.onSound] the host's speaker icon (on = audible)
 */
export function createSystemFx({ root, onSound }) {
  const dim = root.querySelector('.dimmer');

  function apply(key) {
    const v = system.get(key);
    switch (key) {
      case 'volume': sound.setVolume(v / 100); if (onSound) onSound(!system.get('muted') && v > 0); break;
      case 'muted': sound.setEnabled(!v); if (onSound) onSound(!v && system.get('volume') > 0); break;
      case 'brightness': dim.hidden = v >= 100; dim.style.opacity = String(((100 - v) / 100) * 0.75); break;
      case 'nightShift': root.classList.toggle('night-shift', !!v); break;
      case 'reduceMotion':
        root.classList.toggle('reduce-motion', !!v);
        document.documentElement.classList.toggle('reduce-motion', !!v);
        break;
      case 'dnd': notifications.setDoNotDisturb(!!v); break;
      case 'wifi': case 'bluetooth': case 'airdrop': root.classList.toggle(`${key}-off`, !v); break;
      default: break;
    }
  }
  Object.keys(system.all()).forEach(apply);
  system.on(({ key }) => apply(key));
}
