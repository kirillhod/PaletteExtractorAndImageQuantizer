// @ts-check
import { copyText, el } from './dom.js';
import { toast } from './status.js';

/**
 * @param {{ id:number, hex:string, locked?:boolean }[]} palette
 * @param {HTMLElement|null} host
 * @param {{
 *   editMode?: boolean,
 *   selectedId?: number|null,
 *   onActivate?: (entry:any) => void,
 * }} [options]
 */
export function renderPalette(palette, host, options = {}) {
  if (!host) return;
  const { editMode = false, selectedId = null, onActivate = null } = options;
  host.replaceChildren();

  for (const entry of palette) {
    const selected = editMode && entry.id === selectedId;
    const locked = entry.locked === true;
    const action = editMode ? 'Edit' : 'Copy';
    const suffix = locked ? ' (locked)' : '';
    const button = el('button', {
      className: [
        'peiq-swatch',
        selected ? 'is-selected' : '',
        locked ? 'is-locked' : '',
      ].filter(Boolean).join(' '),
      attrs: {
        type: 'button',
        title: `${action} ${entry.hex}${suffix}`,
        'aria-label': `${action} ${entry.hex}${suffix}`,
        ...(editMode ? { 'aria-pressed': String(selected) } : {}),
      },
    });
    button.style.setProperty('--swatch', entry.hex);
    button.addEventListener('click', () => {
      if (onActivate) {
        onActivate(entry);
        return;
      }
      copyText(entry.hex)
        .then(() => toast(`Copied ${entry.hex}`, 'success'))
        .catch(() => toast('Clipboard is unavailable', 'error'));
    });
    host.append(button);
  }
}
