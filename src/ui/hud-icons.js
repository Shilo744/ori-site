// The room HUD's icons (T47): one SF-like family — 24 px grid, 1.75 px round strokes, `currentColor`.
const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const SPEAKER = '<path d="M4 9.5v5h3.2L12 18.5v-13L7.2 9.5z"/>';

export const HUD_ICON = {
  soundOn: svg(`${SPEAKER}<path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.3 6.4a8 8 0 0 1 0 11.2"/>`),
  soundOff: svg(`${SPEAKER}<path d="M16 9.5l5 5M21 9.5l-5 5"/>`),
  view: svg('<path d="M4 8V6.5A2.5 2.5 0 0 1 6.5 4H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5V8M20 16v1.5a2.5 2.5 0 0 1-2.5 2.5H16M8 20H6.5A2.5 2.5 0 0 1 4 17.5V16"/><circle cx="12" cy="12" r="3"/>'),
  chevL: svg('<path d="M14.5 5.5L8 12l6.5 6.5"/>'),
  chevR: svg('<path d="M9.5 5.5L16 12l-6.5 6.5"/>'),
};

export const TIME_ICON = {
  auto: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/>'),
  day: svg('<circle cx="12" cy="12" r="4"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6"/>'),
  golden: svg('<path d="M6.5 16.5a5.5 5.5 0 0 1 11 0M3 19.5h18M12 6v2.2M5.2 9.2l1.6 1.4M18.8 9.2l-1.6 1.4"/>'),
  night: svg('<path d="M19.5 14.2A8 8 0 0 1 9.8 4.5a8 8 0 1 0 9.7 9.7z"/>'),
};
