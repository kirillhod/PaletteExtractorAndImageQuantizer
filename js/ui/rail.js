// @ts-check
/**
 * Keep the right rail short: opening one section closes the others. The rail is a
 * stack of native <details> elements, so keyboard and screen-reader behavior stays
 * intact; this only manages which body is visible at a time.
 *
 * @returns {{ sections: HTMLDetailsElement[] }}
 */
export function initRailSections() {
  const sections = /** @type {HTMLDetailsElement[]} */ (
    [...document.querySelectorAll('.peiq-rail-section')]
  );
  let syncing = false;

  for (const section of sections) {
    section.addEventListener('toggle', () => {
      if (syncing || !section.open) return;
      syncing = true;
      for (const other of sections) {
        if (other !== section) other.open = false;
      }
      syncing = false;
    });
  }

  return { sections };
}
