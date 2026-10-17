// The "Ori, Can You...?" hero widget on the desktop (2 x 2): a flat portrait of Ori, a little stack of tasks that cycles, and a big PLAY.
// Pure markup + CSS: the notifications cycle with CSS animation, which is paused whenever the screen is locked (the camera is away from it).
import './favors-widget.css';

/** A flat, friendly Ori: curls, black glasses, moustache and goatee, a silver hoop and chain, a black tee. */
export const ORI_PORTRAIT = `<svg class="oh-ori" viewBox="0 0 120 120" aria-hidden="true">
  <path d="M10 121c0-23 22-32 50-32s50 9 50 32z" fill="#16171b"/>
  <path d="M46 94c3 8 9 13 14 13s11-5 14-13" fill="none" stroke="#d5dae0" stroke-width="2" stroke-linecap="round"/>
  <path d="M52 76h16v15c-3 4-13 4-16 0z" fill="#b57e5d"/>
  <g fill="#3a2314">
    <circle cx="27" cy="52" r="9"/><circle cx="25" cy="39" r="9.5"/><circle cx="32" cy="27" r="10"/><circle cx="44" cy="19" r="10.5"/><circle cx="58" cy="15" r="11"/><circle cx="72" cy="18" r="10.5"/><circle cx="85" cy="25" r="10"/><circle cx="94" cy="37" r="9.5"/><circle cx="95" cy="51" r="9"/>
    <circle cx="38" cy="30" r="9"/><circle cx="52" cy="26" r="9"/><circle cx="66" cy="26" r="9"/><circle cx="80" cy="31" r="8.5"/>
  </g>
  <g fill="#4d2f1c"><circle cx="40" cy="22" r="5"/><circle cx="63" cy="19" r="5"/><circle cx="84" cy="30" r="4.5"/><circle cx="29" cy="44" r="4"/></g>
  <ellipse cx="60" cy="59" rx="30" ry="33" fill="#c98f6b"/>
  <ellipse cx="31" cy="62" rx="4.2" ry="7" fill="#c08764"/><ellipse cx="89" cy="62" rx="4.2" ry="7" fill="#c08764"/>
  <circle cx="90.5" cy="73" r="4.4" fill="none" stroke="#e6e9ee" stroke-width="1.7"/>
  <path d="M30 44c3-12 16-18 30-18s27 6 30 18c-6-7-16-10-30-10s-24 3-30 10z" fill="#3a2314"/>
  <g stroke="#101114" stroke-width="3" stroke-linejoin="round"><rect x="35" y="49" width="21" height="14" rx="4" fill="rgba(255,255,255,0.16)"/><rect x="64" y="49" width="21" height="14" rx="4" fill="rgba(255,255,255,0.16)"/></g>
  <path d="M56 54h8" stroke="#101114" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="46" cy="57" rx="2.8" ry="3.3" fill="#2a1a12"/><ellipse cx="74" cy="57" rx="2.8" ry="3.3" fill="#2a1a12"/>
  <path d="M36 45q9-5 19-1M65 44q10-4 19 1" fill="none" stroke="#2a1a12" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M59 62q-3 8 1 9h3" fill="none" stroke="#a96e4e" stroke-width="2" stroke-linecap="round"/>
  <path d="M44 77q8-6 16-3 8-3 16 3-8 3-16 1-8 2-16-1z" fill="#2a1a12"/>
  <path d="M50 83q10 7 20 0" fill="none" stroke="#7a3b2e" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M55 88q5 5 10 0-1 6-5 6t-5-6z" fill="#2a1a12"/>
  <path d="M62 52v0" />
</svg>`;

const STACK = [
  { who: 'Mum', text: '14 calls. All URGENT.', color: '#e07a8f' },
  { who: 'City Hall', text: 'Your number is 412. Now serving 17.', color: '#8d939c' },
  { who: 'Perach', text: 'Urgent (not really).', color: '#43b581' },
];

/** The widget's HTML (inserted into the desktop by shell.js). The PLAY button and the card carry `data-open="favors"`. */
export function favorsWidgetHTML() {
  return `
    <div class="wg-hero" data-open="favors" role="button" tabindex="0" aria-label="Play: Ori, Can You...?">
      <div class="oh-top">${ORI_PORTRAIT}<div class="oh-t"><b>Ori, Can You...?</b><span>The man who does everything</span></div></div>
      <ul class="oh-stack" aria-hidden="true">${STACK.map((s, i) => `<li style="--i:${i};--c:${s.color}"><i></i><div><b>${s.who}</b><span>${s.text}</span></div><em>now</em></li>`).join('')}</ul>
      <button class="oh-play" type="button" data-open="favors">Play</button>
    </div>`;
}
