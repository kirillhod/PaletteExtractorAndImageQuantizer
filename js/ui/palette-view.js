// @ts-check
import { copyText, el } from './dom.js';
import { toast } from './status.js';

/**
 * @param {{ hex:string }[]} palette
 * @param {HTMLElement|null} host
 */
export function renderPalette(palette, host) {
  if (!host) return;
  host.replaceChildren();

  for (const entry of palette) {
    const button = el('button', {
      className: 'peiq-swatch',
      attrs: {
        type: 'button',
        title: `${entry.hex} — click to copy`,
        'aria-label': `Copy ${entry.hex}`,
      },
    });
    button.style.setProperty('--swatch', entry.hex);
    button.addEventListener('click', () => {
      copyText(entry.hex)
        .then(() => toast(`Copied ${entry.hex}`, 'success'))
        .catch(() => toast('Clipboard is unavailable', 'error'));
    });
    host.append(button);
  }
}
