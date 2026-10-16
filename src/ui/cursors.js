// The macOS pointer inside the laptop screen, as REAL CSS cursors (T49): the hardware cursor has zero latency and is exactly where
// the hit-testing happens. Arrow, pointing hand and I-beam are SVG data URIs (1x and 2x via image-set, so they are crisp on hi-DPI);
// resize / drag shapes use the native keywords. The rules that pick a shape live in desktop.css and read these variables.
const ARROW = '<path d="M1.2 1.1v15.4l3.5-3.2 2.5 6 2.5-1.1-2.4-5.9h5L1.2 1.1z" fill="#000" stroke="#fff" stroke-width="1.15" stroke-linejoin="round"/>';
const HAND = '<path d="M7.4 1.2c-.9 0-1.6.7-1.6 1.6v8.2L4.6 9.8a1.7 1.7 0 0 0-2.5.1 1.6 1.6 0 0 0-.1 2.1l4 5.1c.8 1 1.9 1.6 3.2 1.6h4.1c1.8 0 3.2-1.4 3.2-3.2v-4.6c0-.8-.6-1.4-1.4-1.4-.3 0-.5.1-.7.2-.2-.5-.7-.8-1.3-.8-.4 0-.7.1-1 .4-.3-.4-.7-.6-1.2-.6-.2 0-.4 0-.6.1V2.8c0-.9-.7-1.6-1.6-1.6z" fill="#fff" stroke="#000" stroke-width="1" stroke-linejoin="round"/>';
const IBEAM = '<g stroke="#fff" stroke-width="3.2" stroke-linecap="round"><path d="M1.7 1.7h5.6M1.7 17.3h5.6M4.5 1.7v15.6"/></g><g stroke="#000" stroke-width="1.3" stroke-linecap="round"><path d="M1.7 1.7h5.6M1.7 17.3h5.6M4.5 1.7v15.6"/></g>';

/** name → { body, viewBox [w, h], size [css px], hot: [x, y] (css px, the tip) } */
export const SHAPES = {
  arrow: { body: ARROW, vb: [14, 21], size: [16, 24], hot: [1, 1] },
  hand: { body: HAND, vb: [20, 22], size: [19, 21], hot: [7, 1] },
  text: { body: IBEAM, vb: [9, 19], size: [10, 21], hot: [5, 10] },
};

const svgUri = (s, scale) => {
  const [w, h] = s.size;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${s.vb[0]} ${s.vb[1]}">${s.body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

/** The `cursor` value for one shape: image-set 1x/2x (prefixed or not, whichever this browser takes) + hot spot + fallback keyword. */
export function cursorValue(name, fallback = 'default') {
  const s = SHAPES[name];
  const set = (fn) => `${fn}(${svgUri(s, 1)} 1x, ${svgUri(s, 2)} 2x) ${s.hot[0]} ${s.hot[1]}, ${fallback}`;
  try {
    if (window.CSS && CSS.supports('cursor', set('image-set'))) return set('image-set');
    if (window.CSS && CSS.supports('cursor', set('-webkit-image-set'))) return set('-webkit-image-set');
  } catch { /* fall through */ }
  return `${svgUri(s, 1)} ${s.hot[0]} ${s.hot[1]}, ${fallback}`; // a plain 1x image works everywhere
}

let installed = false;
/** Defines `--cur-arrow / --cur-hand / --cur-text` on `.mac` (once). */
export function installCursors() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const st = document.createElement('style');
  st.id = 'mac-cursors';
  st.textContent = `.mac { --cur-arrow: ${cursorValue('arrow')}; --cur-hand: ${cursorValue('hand', 'pointer')}; --cur-text: ${cursorValue('text', 'text')}; }`;
  document.head.appendChild(st);
}
