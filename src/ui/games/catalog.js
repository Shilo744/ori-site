// Catalogue of games for the Arcade (cover art, blurb, colour, score variants). The playable window itself is a normal
// registry app (`registerApp({ category: 'game' })`); this adds the storefront metadata.
//
//   registerGameInfo({
//     id: 'snake', name: 'Snake', tagline: 'Eat. Grow. Don’t bite yourself.',
//     accent: '#35f2ff',                     // card glow / hero colour
//     controls: 'Arrows / WASD',             // shown on the card
//     variants: [{ id: 'snake:wrap', label: 'Wrap' }],   // extra score tables (optional)
//     lowerIsBetter: false,                  // time-based games
//     drawCover(g, w, h) { … }               // procedural cover art, painted once into a canvas
//   });
const games = new Map();

export function registerGameInfo(info) {
  if (!info || !info.id || typeof info.drawCover !== 'function') throw new Error('registerGameInfo: { id, drawCover } required');
  games.set(info.id, { accent: '#35f2ff', tagline: '', controls: '', variants: [], lowerIsBetter: false, ...info });
}

export const listGames = () => [...games.values()];
export const getGameInfo = (id) => games.get(id) || null;

const coverCache = new Map();
/** The cover as an offscreen canvas (painted once, then reused by cards, hero and leaderboard thumbnails). */
export function coverOf(id, w = 400, h = 225) {
  const key = `${id}:${w}x${h}`;
  if (coverCache.has(key)) return coverCache.get(key);
  const info = games.get(id);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  if (info) {
    try { info.drawCover(c.getContext('2d'), w, h); } catch (e) { console.error(`[arcade] cover for ${id} failed`, e); }
  }
  coverCache.set(key, c);
  return c;
}
