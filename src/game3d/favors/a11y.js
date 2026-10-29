// "Ori, Can You...?" — small helpers so the game's overlays behave like proper modal dialogs for keyboard and screen-reader users: the focus goes in when one opens, Tab / Shift+Tab
// walk round inside it (the game's input layer swallows the keys, so the walking is done here), and the focus is given back when it closes.
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]';
const usable = (n) => !n.disabled && !n.hidden && n.tabIndex >= 0 && !n.closest('[hidden]') && n.getClientRects().length > 0;

/** The things in `root` the keyboard can reach, in page order. */
export const focusables = (root) => [...root.querySelectorAll(FOCUSABLE)].filter(usable);

/** Tab / Shift+Tab walk round inside `root`. Returns true when `e` was a Tab (the caller then claims the key). */
export function trapTab(e, root) {
  if (e.code !== 'Tab') return false;
  const list = focusables(root);
  if (!list.length) { root.tabIndex = -1; root.focus({ preventScroll: true }); return true; }
  const i = list.indexOf(document.activeElement);
  const next = e.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : (i < 0 || i === list.length - 1 ? 0 : i + 1);
  list[next].focus({ preventScroll: true });
  return true;
}

/**
 * The focus of a modal dialog: `enter()` remembers who had it and moves it inside (to `first`, or the first thing it can reach, or the dialog itself) and marks the dialog modal;
 * `leave()` gives it back (to whoever had it, if they are still there).
 * @param {HTMLElement} root the dialog
 * @param {string} [first] a selector for what gets the focus first
 * @param {boolean} [self] the dialog itself takes the focus (for a card that is drawn again and again: nothing inside it would keep it)
 */
export function modalFocus(root, first = null, self = false) {
  let prev = null;
  return {
    enter() {
      const a = document.activeElement;
      if (!root.contains(a)) prev = a && a !== document.body ? a : null;
      root.setAttribute('aria-modal', 'true');
      const target = self ? null : (first && root.querySelector(first)) || focusables(root)[0];
      if (target) target.focus({ preventScroll: true });
      else { root.tabIndex = -1; root.focus({ preventScroll: true }); }
    },
    leave() {
      const p = prev;
      prev = null;
      if (p && p.isConnected && typeof p.focus === 'function') p.focus({ preventScroll: true });
      else if (document.activeElement && document.activeElement !== document.body && root.contains(document.activeElement)) document.activeElement.blur();
    },
  };
}
