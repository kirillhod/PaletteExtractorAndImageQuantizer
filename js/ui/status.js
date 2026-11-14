// @ts-check
import { el } from './dom.js';
import { t, tp } from './i18n.js';

/**
 * @typedef {{ value?: string|number, valueKey?: string, label?: string, labelKey?: string, count?: number, params?: Record<string, unknown> }} StatusItem
 */

/** @type {{ kind: 'empty' } | { kind: 'items', items: StatusItem[] } | { kind: 'message', key: string, params: Record<string, unknown> }} */
let lastStatus = { kind: 'empty' };

/**
 * @param {StatusItem[]} items
 */
export function setStatus(items) {
  lastStatus = { kind: 'items', items: items.map((item) => ({ ...item })) };
  renderStatus();
}

/**
 * Set a localized status message by key. Parameters are interpolated when rendered.
 * @param {string} key
 * @param {Record<string, unknown>} [params]
 */
export function setStatusMessage(key, params = {}) {
  lastStatus = { kind: 'message', key, params: { ...params } };
  renderStatus();
}

/**
 * Re-render the last status after a locale change.
 */
export function refreshStatus() {
  renderStatus();
}

/**
 * @returns {typeof lastStatus}
 */
export function getLastStatus() {
  return lastStatus;
}

function renderStatus() {
  const host = document.getElementById('statusbar');
  if (!host) return;
  host.replaceChildren();

  if (lastStatus.kind === 'empty') return;
  if (lastStatus.kind === 'message') {
    host.append(el('span', { className: 'peiq-statusbar__item', text: t(lastStatus.key, lastStatus.params) }));
    return;
  }

  for (const item of lastStatus.items) {
    const span = el('span', { className: 'peiq-statusbar__item' });
    const value = item.valueKey ? t(item.valueKey, item.params) : item.value;
    if (value !== undefined) {
      span.append(el('strong', { text: String(value) }));
    }
    const label = item.labelKey
      ? item.count !== undefined
        ? tp(item.labelKey, item.count, item.params)
        : t(item.labelKey, item.params)
      : item.label;
    if (label) {
      span.append(document.createTextNode(label));
    }
    host.append(span);
  }
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

/**
 * @param {string} key
 * @param {Record<string, unknown>} [params]
 * @param {'success'|'error'|''} [type]
 */
export function toastKey(key, params = {}, type = '') {
  toast(t(key, params), type);
}
