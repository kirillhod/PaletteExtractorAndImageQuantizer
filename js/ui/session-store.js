// @ts-check

const DB_NAME = 'peiq-session';
const DB_VERSION = 1;
const STORE = 'session';
const KEY = 'current';

/** @type {Promise<IDBDatabase>|null} */
let dbPromise = null;

/**
 * @returns {Promise<IDBDatabase>}
 */
function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open session storage'));
    request.onblocked = () => reject(new Error('Session storage is blocked'));
  });
  return dbPromise;
}

/**
 * @param {IDBDatabase} db
 * @param {IDBTransactionMode} mode
 * @param {(store: IDBObjectStore) => void} run
 * @returns {Promise<void>}
 */
function withStore(db, mode, run) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    run(tx.objectStore(STORE));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Session storage transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('Session storage transaction aborted'));
  });
}

/**
 * @returns {Promise<object|null>}
 */
export async function loadSession() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error ?? new Error('Could not read saved session'));
  });
}

/**
 * @param {object} record
 * @returns {Promise<void>}
 */
export async function saveSession(record) {
  const db = await openDatabase();
  await withStore(db, 'readwrite', (store) => {
    store.put(record, KEY);
  });
}

/** @returns {Promise<void>} */
export async function clearSession() {
  const db = await openDatabase();
  await withStore(db, 'readwrite', (store) => {
    store.delete(KEY);
  });
}
