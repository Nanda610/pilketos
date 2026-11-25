/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * IndexedDB persistent snapshot backup for E-Pilketos / E-Pilkosim Digital.
 * Complements localStorage (which has a ~5MB quota) so newly created periods,
 * DPT/PIN lists, candidate profiles/photos, logos, and videos remain durably
 * stored in the browser across reloads without truncation.
 */

import { ElectionStateSnapshot } from '../types';

const DB_NAME = 'epilketos_persistent_db_v1';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';
const LATEST_KEY = 'latest';

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveSnapshotToIndexedDb(snapshot: ElectionStateSnapshot): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(snapshot, LATEST_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function loadSnapshotFromIndexedDb(): Promise<ElectionStateSnapshot | null> {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(LATEST_KEY);
      req.onsuccess = () => {
        const val = req.result as ElectionStateSnapshot | undefined;
        db.close();
        if (val && val.school && Array.isArray(val.periods) && val.periods.length > 0) {
          resolve(val);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}
