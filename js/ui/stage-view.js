// @ts-check
import { nextStageView } from '../core/stage-view.js';

/**
 * @typedef {'normal'|'max'|'hidden'} StageView
 */

/**
 * Owns the three workspace stage states and the buttons that switch them. The state
 * lives on `<html data-stage>`, so the layout rules stay in CSS. Nothing is stored: a
 * reload starts in the normal frame.
 *
 * @param {{
 *   root: HTMLElement,
 *   maximize: HTMLButtonElement|null,
 *   hide: HTMLButtonElement|null,
 *   exit: HTMLButtonElement|null,
 *   onChange?: (view: StageView) => void,
 * }} deps
 */
export function createStageView(deps) {
  /** @type {StageView} */
  let current = 'normal';

  /**
   * The full-screen view has its own exit button, so focus follows the state instead of
   * staying on a control the overlay covers.
   *
   * @param {StageView} view
   * @param {HTMLElement|null} opener
   */
  function apply(view, opener) {
    current = view;
    deps.root.dataset.stage = view;
    deps.maximize?.setAttribute('aria-pressed', String(view === 'max'));
    deps.hide?.setAttribute('aria-pressed', String(view === 'hidden'));
    if (deps.onChange) deps.onChange(view);
    // A tooltip belongs to a control that may just have been hidden; drop it rather than
    // leaving it pinned to the old position.
    window.dispatchEvent(new Event('peiqq:stagechange'));
    if (view === 'max') {
      deps.exit?.focus();
    } else if (opener) {
      opener.focus();
    }
  }

  /**
   * @param {'max'|'hidden'|'restore'} action
   * @param {HTMLElement|null} opener
   */
  function run(action, opener) {
    const view = nextStageView(current, action);
    if (view === current) return;
    apply(view, opener);
  }

  /** An open dialog, the palette preview, or the Help drawer keeps `Esc` for itself. */
  function overlayOpen() {
    if (document.querySelector('dialog[open]')) return true;
    const preview = document.getElementById('palette-preview');
    if (preview && preview.hidden === false) return true;
    const help = document.getElementById('help-drawer');
    return help?.dataset.open === 'true';
  }

  deps.maximize?.addEventListener('click', () => {
    run('max', deps.maximize);
  });
  deps.hide?.addEventListener('click', () => {
    run('hidden', deps.hide);
  });
  deps.exit?.addEventListener('click', () => {
    const wasMax = current === 'max';
    run('restore', wasMax ? deps.maximize : deps.hide);
  });

  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || current === 'normal' || overlayOpen()) return;
      event.preventDefault();
      event.stopPropagation();
      run('restore', current === 'max' ? deps.maximize : deps.hide);
    },
    { capture: true },
  );

  return {
    /** @returns {StageView} */
    get: () => current,
    restore: () => {
      run('restore', null);
    },
  };
}
