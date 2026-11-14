// @ts-check
import { CREDITS, REFERENCE_GROUPS } from '../content/references.js';
import { t } from './i18n.js';

/**
 * @param {string} key
 * @param {string} fallback
 * @returns {string}
 */
function messageOr(key, fallback) {
  const value = t(key);
  return value === key ? fallback : value;
}

/**
 * @returns {{ toggle:() => void, close:() => void, isOpen:() => boolean }}
 */
export function initLearn() {
  renderHelpContent();

  const helpButton = /** @type {HTMLButtonElement|null} */ (document.getElementById('help-toggle'));
  const drawer = /** @type {HTMLElement|null} */ (document.getElementById('help-drawer'));
  const closeButton = /** @type {HTMLButtonElement|null} */ (document.getElementById('help-close'));
  if (!helpButton || !drawer || !closeButton) {
    return { toggle() {}, close() {}, isOpen: () => false };
  }

  /** @type {HTMLElement|null} */
  let lastFocus = null;

  /** @param {boolean} open */
  function setOpen(open) {
    drawer.setAttribute('data-open', String(open));
    drawer.setAttribute('aria-hidden', String(!open));
    helpButton.setAttribute('aria-expanded', String(open));
    helpButton.setAttribute('aria-label', open ? t('help.closeAria') : t('help.openAria'));
    if (open) {
      lastFocus = /** @type {HTMLElement|null} */ (document.activeElement);
      drawer.removeAttribute('inert');
      closeButton.focus();
    } else {
      drawer.setAttribute('inert', '');
      const target =
        lastFocus && lastFocus !== document.body && typeof lastFocus.focus === 'function'
          ? lastFocus
          : helpButton;
      target.focus();
      lastFocus = null;
    }
  }

  function isOpen() {
    return drawer.getAttribute('data-open') === 'true';
  }

  function toggle() {
    setOpen(!isOpen());
  }

  function close() {
    if (isOpen()) setOpen(false);
  }

  setOpen(false);
  helpButton.addEventListener('click', toggle);
  closeButton.addEventListener('click', close);

  document.addEventListener('click', (event) => {
    if (!isOpen()) return;
    const target = /** @type {Node} */ (event.target);
    if (drawer.contains(target) || helpButton.contains(target)) return;
    close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      event.preventDefault();
      close();
    }
  });

  window.addEventListener('peiqq:localechange', () => {
    renderHelpContent();
    helpButton.setAttribute('aria-label', isOpen() ? t('help.closeAria') : t('help.openAria'));
  });

  return { toggle, close, isOpen };
}

/**
 * Build the reference list and credits from static data. No innerHTML, no Markdown
 * parser, and external links open only on an explicit click.
 */
function renderHelpContent() {
  const references = document.getElementById('help-references');
  if (references) {
    references.replaceChildren();
    for (const group of REFERENCE_GROUPS) {
      const heading = document.createElement('h3');
      heading.className = 'peiq-reference-group';
      heading.textContent = messageOr(`references.group.${group.id}`, group.title);

      const list = document.createElement('ul');
      list.className = 'peiq-references';

      for (const reference of group.items) {
        const item = document.createElement('li');
        item.className = 'peiq-reference';

        const title = document.createElement(reference.url ? 'a' : 'span');
        title.textContent = reference.title;
        if (reference.url) {
          const link = /** @type {HTMLAnchorElement} */ (title);
          link.href = reference.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
        item.append(title);

        const meta = document.createElement('span');
        meta.className = 'peiq-reference-meta';
        const printNote = reference.url ? '' : t('references.printNote');
        meta.textContent = `${reference.authors} (${reference.year}) · ${reference.venue}${printNote}`;
        item.append(meta);
        list.append(item);
      }

      references.append(heading, list);
    }
  }

  const credits = document.getElementById('help-credits');
  if (credits) {
    credits.replaceChildren();
    for (const credit of CREDITS) {
      const term = document.createElement('dt');
      term.textContent = messageOr(`credits.${credit.id}.label`, credit.label);
      const detail = document.createElement('dd');
      detail.append(
        document.createTextNode(messageOr(`credits.${credit.id}.text`, credit.text)),
      );
      if (credit.link) {
        detail.append(document.createTextNode(' '));
        const link = document.createElement('a');
        link.href = credit.link.href;
        link.textContent = messageOr(`credits.${credit.id}.link`, credit.link.text);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        detail.append(link);
      }
      credits.append(term, detail);
    }
  }
}
