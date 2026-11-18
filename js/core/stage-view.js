// @ts-check
/**
 * The workspace stage has three states. `normal` is the editor frame, `max` fills the
 * viewport with the canvas, and `hidden` removes the canvas so the palette keeps the
 * room. The state is deliberately not persisted: a reload starts in the normal frame.
 */

/** @typedef {'normal'|'max'|'hidden'} StageView */

/** @type {StageView[]} */
export const STAGE_VIEWS = ['normal', 'max', 'hidden'];

/**
 * @param {unknown} value
 * @returns {StageView}
 */
export function normalizeStageView(value) {
  return value === 'max' || value === 'hidden' ? value : 'normal';
}

/**
 * Resolve the next stage for a toolbar action. Pressing the active action again returns
 * to the normal frame; the two views never combine.
 *
 * @param {StageView} current
 * @param {'max'|'hidden'|'restore'} action
 * @returns {StageView}
 */
export function nextStageView(current, action) {
  const view = normalizeStageView(current);
  if (action === 'restore') return 'normal';
  if (action === 'max') return view === 'max' ? 'normal' : 'max';
  if (action === 'hidden') return view === 'hidden' ? 'normal' : 'hidden';
  return view;
}
