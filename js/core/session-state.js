// @ts-check

/** @typedef {import('./types.js').Palette} Palette */

export const SESSION_VERSION = 1;

/** @param {Palette} palette */
export function clonePalette(palette) {
  return palette.map((entry) => ({
    ...entry,
    color: { ...entry.color },
  }));
}

/**
 * @param {{ palette: Palette, sortOrder: string, selectedId:number|null, transparentId:number|null }} snapshot
 */
export function clonePaletteSnapshot(snapshot) {
  return {
    palette: clonePalette(snapshot.palette),
    sortOrder: snapshot.sortOrder,
    selectedId: snapshot.selectedId,
    transparentId: snapshot.transparentId,
  };
}

/**
 * @param {{ past: any[], future: any[] }} history
 */
export function cloneHistory(history) {
  return {
    past: history.past.map(clonePaletteSnapshot),
    future: history.future.map(clonePaletteSnapshot),
  };
}

/**
 * Validate the persisted record shape without trusting stored JSON.
 * @param {any} record
 * @returns {boolean}
 */
export function isValidSessionRecord(record) {
  if (!record || typeof record !== 'object') return false;
  if (record.version !== SESSION_VERSION) return false;
  if (!record.image || typeof record.image !== 'object') return false;
  if (!(record.image.blob instanceof Blob)) return false;
  if (typeof record.image.name !== 'string') return false;
  if (!record.state || typeof record.state !== 'object') return false;
  if (!record.state.settings || typeof record.state.settings !== 'object') return false;
  if (!Array.isArray(record.state.palette)) return false;
  if (!record.state.history || !Array.isArray(record.state.history.past)) return false;
  if (!Array.isArray(record.state.history.future)) return false;
  return true;
}
