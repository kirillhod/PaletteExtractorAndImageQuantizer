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
    if (locked) button.append(createLockBadge());
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

const SVG_NS = 'http://www.w3.org/2000/svg';

/** @returns {SVGSVGElement} */
function createLockBadge() {
  const badge = document.createElementNS(SVG_NS, 'svg');
  badge.setAttribute('viewBox', '0 0 24 24');
  badge.setAttribute('class', 'peiq-swatch__lock');
  badge.setAttribute('aria-hidden', 'true');

  const shackle = document.createElementNS(SVG_NS, 'path');
  shackle.setAttribute('d', 'M8 11V8a4 4 0 0 1 8 0v3');
  shackle.setAttribute('fill', 'none');
  shackle.setAttribute('stroke', 'currentColor');
  shackle.setAttribute('stroke-width', '3');
  shackle.setAttribute('stroke-linecap', 'round');

  const body = document.createElementNS(SVG_NS, 'rect');
  body.setAttribute('x', '5');
  body.setAttribute('y', '10');
  body.setAttribute('width', '14');
  body.setAttribute('height', '10');
  body.setAttribute('rx', '2');
  body.setAttribute('fill', 'currentColor');

  badge.append(shackle, body);
  return badge;
}
