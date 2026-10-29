// "Ori, Can You...?" — photo mode (DOM) [experimental]: the viewfinder (four corners, a hint, two buttons), the flash and the little polaroid that slides in; `take` draws the canvas onto a polaroid and hands it to the browser
// as a PNG download (only ever after a key press or a click). The numbers and the words are in photo.js (pure).
import './photo.css';
import { HINT, sizeFor, polaroid, captionOf, photoName } from './photo.js';

/**
 * @param {{ root: HTMLElement, source: () => HTMLCanvasElement, calm?: () => boolean, onShoot?: () => void, onClose?: () => void }} o
 *   `source` = the canvas of the game (it must have just been drawn); `calm` = reduced motion (no flash, no slide); `onShoot` = the shutter button was pressed; `onClose` = he came back
 */
export function createPhoto({ root, source, calm = () => false, onShoot = null, onClose = null }) {
  const el = document.createElement('div');
  el.className = 'ph';
  el.hidden = true;
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', 'Photo mode');
  el.innerHTML = `<div class="ph-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <p class="ph-hint" role="status">${HINT}</p>
    <div class="ph-btns"><button type="button" class="ph-btn shoot" data-act="shoot">Take the photo</button><button type="button" class="ph-btn" data-act="back">Back</button></div>
    <div class="ph-flash" aria-hidden="true"></div>
    <img class="ph-thumb" alt="The photo just taken" hidden>`;
  root.append(el);
  const flash = el.querySelector('.ph-flash');
  const thumb = el.querySelector('.ph-thumb');
  let on = false;
  let thumbTimer = 0;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'shoot') { if (onShoot) onShoot(); } else api.close();
  });

  /** The canvas on a polaroid, as a PNG data address. */
  function compose(src, meta) {
    const { w, h } = sizeFor(src.width, src.height);
    const g = polaroid(w, h);
    const cv = document.createElement('canvas');
    cv.width = g.width;
    cv.height = g.height;
    const c = cv.getContext('2d');
    c.fillStyle = '#f7f3ea';
    c.fillRect(0, 0, g.width, g.height);
    c.drawImage(src, 0, 0, src.width, src.height, g.x, g.y, g.picW, g.picH);
    const cap = captionOf(meta);
    c.fillStyle = '#2a2a33';
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    c.font = `700 ${g.fontTitle}px Inter, system-ui, sans-serif`;
    c.fillText(cap.title, g.textX, g.titleY, g.picW * 0.9);
    c.fillStyle = '#6a6672';
    c.font = `600 ${g.fontSub}px Inter, system-ui, sans-serif`;
    c.fillText(cap.sub, g.textX, g.subY);
    c.textAlign = 'right';
    c.font = `700 ${g.fontTag}px Inter, system-ui, sans-serif`;
    c.fillStyle = '#e08a3c';
    c.fillText(cap.tag, g.tagX, g.tagY);
    return { url: cv.toDataURL('image/png'), w: g.width, h: g.height };
  }

  const api = {
    get isOn() { return on; },
    open() { if (on) return; on = true; el.hidden = false; el.classList.toggle('calm', !!calm()); root.classList.add('fv-photo'); },
    close() { if (!on) return; on = false; el.hidden = true; root.classList.remove('fv-photo'); if (onClose) onClose(); },
    /** Takes the photo: a PNG download named after the day and the time, the flash, the thumbnail. @param {{ place?: string | null, day: number, label: string }} meta */
    take(meta) {
      const out = compose(source(), meta);
      const name = photoName(meta);
      const a = document.createElement('a');
      a.href = out.url;
      a.download = name;
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.append(a);
      a.click();
      a.remove();
      el.classList.toggle('calm', !!calm());
      flash.classList.remove('go');
      void flash.offsetWidth; // (so the flash can play again)
      flash.classList.add('go');
      thumb.src = out.url;
      thumb.hidden = false;
      thumb.classList.remove('in');
      void thumb.offsetWidth;
      thumb.classList.add('in');
      clearTimeout(thumbTimer);
      thumbTimer = setTimeout(() => { thumb.hidden = true; }, 3400);
      return { name, w: out.w, h: out.h };
    },
    dispose() { clearTimeout(thumbTimer); root.classList.remove('fv-photo'); el.remove(); },
  };
  return api;
}
