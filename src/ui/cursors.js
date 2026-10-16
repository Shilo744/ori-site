// ONE pointer for the whole site (T49, T57): arrow, pointing hand, I-beam, open / closed hand and the four macOS resize shapes, as REAL CSS
// cursors (zero latency, exactly where the hit-testing happens). SVG data URIs, 1x and 2x via image-set so they are crisp on hi-DPI.
// installCursors() defines `--cur-<name>` on :root; cursors.css reads them for the whole page (room, HUD, intro, the laptop screen, the
// game overlays) and nothing else sets a `cursor` — change a shape here and it changes everywhere.
import './cursors.css';

// black body, white outline (the macOS look); one path each so the outline is a single clean ring
const ARROW = '<path d="M1.2 1.1v15.4l3.5-3.2 2.5 6 2.5-1.1-2.4-5.9h5L1.2 1.1z" fill="#000" stroke="#fff" stroke-width="1.15" stroke-linejoin="round"/>';
const HAND = '<path d="M7.4 1.2c-.9 0-1.6.7-1.6 1.6v8.2L4.6 9.8a1.7 1.7 0 0 0-2.5.1 1.6 1.6 0 0 0-.1 2.1l4 5.1c.8 1 1.9 1.6 3.2 1.6h4.1c1.8 0 3.2-1.4 3.2-3.2v-4.6c0-.8-.6-1.4-1.4-1.4-.3 0-.5.1-.7.2-.2-.5-.7-.8-1.3-.8-.4 0-.7.1-1 .4-.3-.4-.7-.6-1.2-.6-.2 0-.4 0-.6.1V2.8c0-.9-.7-1.6-1.6-1.6z" fill="#fff" stroke="#000" stroke-width="1" stroke-linejoin="round"/>';
const IBEAM = '<g stroke="#fff" stroke-width="3.2" stroke-linecap="round"><path d="M1.7 1.7h5.6M1.7 17.3h5.6M4.5 1.7v15.6"/></g><g stroke="#000" stroke-width="1.3" stroke-linecap="round"><path d="M1.7 1.7h5.6M1.7 17.3h5.6M4.5 1.7v15.6"/></g>';

// The resize shapes: two arrow heads with the shaft, and — for an edge — the bar that stands for "the edge" (the macOS window-edge
// cursor). Drawn horizontally around (11, 11); the other three are the same path turned.
const EDGE = 'M1.2 11L6.2 6.2V10H10V4.8H12V10H15.8V6.2L20.8 11L15.8 15.8V12H12V17.2H10V12H6.2V15.8Z';
const CORNER = 'M0.9 11L6.1 5.8V10H15.9V5.8L21.1 11L15.9 16.2V12H6.1V16.2Z';
const resize = (d, deg) => `<path d="${d}" transform="rotate(${deg} 11 11)" fill="#000" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>`;

// The hands are white with a black ring: the shapes are painted twice (a fat black stroke under, the white fill over) so touching
// fingers keep a fine black line between them and the whole thing has one outline.
const hand = (shapes) => `<g fill="#000" stroke="#000" stroke-width="2.2" stroke-linejoin="round">${shapes}</g><g fill="#fff">${shapes}</g>`;
const fingers = (ys, hs, y0 = 0) => [4.6, 8.6, 12.6, 16.6].map((x, i) => `<rect x="${x}" y="${ys[i] + y0}" width="3.2" height="${hs[i]}" rx="1.6"/>`).join('');
const OPEN = hand(
  `${fingers([4.8, 2.6, 3.4, 5.8], [9.2, 10.8, 10, 7.6])}<rect x="4.6" y="10" width="15.2" height="8" rx="3.6"/>` +
  '<rect x="1.3" y="9.6" width="3.4" height="7.2" rx="1.7" transform="rotate(-34 3 13.2)"/>');
const CLOSED = hand(
  `${fingers([7.4, 6.6, 6.8, 7.8], [6, 6, 6, 6])}<rect x="4.6" y="10.4" width="15.2" height="7.6" rx="3.6"/>` +
  '<rect x="1.9" y="11.4" width="3.6" height="5.4" rx="1.8"/>');

/** name → { body, vb [w, h], size [css px], hot [x, y] (css px, the point that clicks), fallback keyword for browsers without image cursors } */
export const SHAPES = {
  arrow: { body: ARROW, vb: [14, 21], size: [16, 24], hot: [1, 1], fallback: 'default' },
  hand: { body: HAND, vb: [20, 22], size: [19, 21], hot: [7, 1], fallback: 'pointer' },
  text: { body: IBEAM, vb: [9, 19], size: [10, 21], hot: [5, 10], fallback: 'text' },
  grab: { body: OPEN, vb: [22, 22], size: [22, 22], hot: [11, 11], fallback: 'grab' },
  grabbing: { body: CLOSED, vb: [22, 22], size: [22, 22], hot: [11, 11], fallback: 'grabbing' },
  ew: { body: resize(EDGE, 0), vb: [22, 22], size: [22, 22], hot: [11, 11], fallback: 'ew-resize' },
  ns: { body: resize(EDGE, 90), vb: [22, 22], size: [22, 22], hot: [11, 11], fallback: 'ns-resize' },
  nwse: { body: resize(CORNER, 45), vb: [22, 22], size: [22, 22], hot: [11, 11], fallback: 'nwse-resize' },
  nesw: { body: resize(CORNER, -45), vb: [22, 22], size: [22, 22], hot: [11, 11], fallback: 'nesw-resize' },
};

const svgUri = (s, scale) => {
  const [w, h] = s.size;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${s.vb[0]} ${s.vb[1]}">${s.body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

/** The `cursor` value for one shape: image-set 1x/2x (prefixed or not, whichever this browser takes) + hot spot + fallback keyword. */
export function cursorValue(name) {
  const s = SHAPES[name];
  const set = (fn) => `${fn}(${svgUri(s, 1)} 1x, ${svgUri(s, 2)} 2x) ${s.hot[0]} ${s.hot[1]}, ${s.fallback}`;
  try {
    if (window.CSS && CSS.supports('cursor', set('image-set'))) return set('image-set');
    if (window.CSS && CSS.supports('cursor', set('-webkit-image-set'))) return set('-webkit-image-set');
  } catch { /* fall through */ }
  return `${svgUri(s, 1)} ${s.hot[0]} ${s.hot[1]}, ${s.fallback}`; // a plain 1x image works everywhere
}

let installed = false;
/** Defines `--cur-arrow / -hand / -text / -grab / -grabbing / -ew / -ns / -nwse / -nesw` on :root (once). */
export function installCursors() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const st = document.createElement('style');
  st.id = 'ori-cursors';
  st.textContent = `:root { ${Object.keys(SHAPES).map((n) => `--cur-${n}: ${cursorValue(n)};`).join(' ')} }`;
  document.head.appendChild(st);
}
