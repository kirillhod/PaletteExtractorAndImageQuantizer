// @ts-check
import { isValidPickedMarkerArray } from './picked-markers.js';

/** @typedef {import('./types.js').Palette} Palette */

export const SESSION_VERSION = 2;

/** @param {Palette} palette */
export function clonePalette(palette) {
  return palette.map((entry) => ({
    ...entry,
    color: { ...entry.color },
  }));
}

/**
 * @param {{ method:string, colors:number, space:string, dither:{ method:string, strength:number, serpentine:boolean, edgeStop:number }, alphaThreshold:number }} settings
 */
export function cloneSettings(settings) {
  return {
    method: settings.method,
    colors: settings.colors,
    space: settings.space,
    alphaThreshold: settings.alphaThreshold,
    dither: {
      method: settings.dither?.method,
      strength: settings.dither?.strength,
      serpentine: settings.dither?.serpentine,
      edgeStop: settings.dither?.edgeStop,
    },
  };
}

/**
 * @param {{ palette: Palette, sortOrder: string, selectedId:number|null, transparentId:number|null, markers?: {id:number,u:number,v:number}[], paletteEdited?:boolean, settings?:any }} snapshot
 */
export function clonePaletteSnapshot(snapshot) {
  return {
    palette: clonePalette(snapshot.palette),
    sortOrder: snapshot.sortOrder,
    selectedId: snapshot.selectedId,
    transparentId: snapshot.transparentId,
    ...(typeof snapshot.paletteEdited === 'boolean'
      ? { paletteEdited: snapshot.paletteEdited }
      : {}),
    markers: Array.isArray(snapshot.markers)
      ? snapshot.markers.map(({ id, u, v }) => ({ id, u, v }))
      : [],
    ...(snapshot.settings && typeof snapshot.settings === 'object'
      ? { settings: cloneSettings(snapshot.settings) }
      : {}),
  };
}

/**
 * The session keeps the palette name the UI shows. Startup fills the fixed-palette
 * name before any restore, so trusting that field alone would rename a restored
 * imported palette to the built-in selected at boot.
 *
 * @param {{ statusName?:string, fixedName?:string, importedName?:string }} names
 * @returns {string}
 */
export function sessionPaletteName(names) {
  return names.statusName || names.fixedName || names.importedName || '';
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
  if (record.version !== SESSION_VERSION && record.version !== 1) return false;
  if (!record.image || typeof record.image !== 'object') return false;
  if (record.version === SESSION_VERSION) {
    if (!(record.image.bytes instanceof ArrayBuffer)) return false;
    if (record.image.bytes.byteLength === 0) return false;
  } else {
    if (!(record.image.blob instanceof Blob)) return false;
    if (record.image.blob.size === 0) return false;
  }
  if (typeof record.image.name !== 'string') return false;
  if (!record.state || typeof record.state !== 'object') return false;
  if (!record.state.settings || typeof record.state.settings !== 'object') return false;
  if (!Array.isArray(record.state.palette)) return false;
  if (!isValidPickedMarkerArray(record.state.markers)) return false;
  if (!record.state.history || !Array.isArray(record.state.history.past)) return false;
  if (!Array.isArray(record.state.history.future)) return false;
  return true;
}
