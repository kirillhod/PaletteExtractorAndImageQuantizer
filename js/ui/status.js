// @ts-check
import { el } from './dom.js';

/**
 * @param {{ label?: string, value?: string|number }[]} items
 */
export function setStatus(items) {
  const host = document.getElementById('statusbar');
  if (!host) return;
  host.replaceChildren();
  for (const item of items) {
    const span = el('span', { className: 'peiq-statusbar__item' });
    if (item.value !== undefined) {
      span.append(el('strong', { text: String(item.value) }));
    }
    if (item.label) {
      span.append(document.createTextNode(item.label));
    }
    host.append(span);
  }
}

/**
 * @param {string} message
 */
export function setStatusMessage(message) {
  setStatus([{ label: message }]);
}

/**
 * @param {string} message
 * @param {'success'|'error'|''} [type]
 */
export function toast(message, type = '') {
  const host = document.getElementById('toast-host');
  if (!host) return;
  const node = el('div', {
    className: `peiq-toast${type ? ` peiq-toast--${type}` : ''}`,
    text: message,
  });
  node.setAttribute('role', 'status');
  host.append(node);
  window.setTimeout(() => {
    node.remove();
  }, 3400);
}
