/**
 * Offline queue using IndexedDB.
 * When the browser is offline, write operations (create/update/delete) are
 * queued in IndexedDB. When connectivity is restored, the queue is flushed
 * and each pending operation is replayed against Firestore.
 *
 * Works alongside the existing service worker for cache-first reads.
 */

const DB_NAME = 'lilly-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending_ops';

export type OfflineOp = {
  id?: number; // auto-incremented IDB key
  /** Firestore collection name */
  collection: string;
  /** Operation type */
  operation: 'create' | 'update' | 'delete';
  /** Document ID (null for creates — will be assigned on sync) */
  docId: string | null;
  /** The data payload */
  data: Record<string, unknown>;
  /** User ID */
  userId: string;
  /** Timestamp of when the op was queued */
  queuedAt: number;
};

/** Open (or create) the IndexedDB database */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Enqueue a pending operation */
export async function enqueueOp(op: Omit<OfflineOp, 'id' | 'queuedAt'>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.add({ ...op, queuedAt: Date.now() });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Get all pending operations (ordered by queuedAt) */
export async function getPendingOps(): Promise<OfflineOp[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      db.close();
      const ops = (request.result as OfflineOp[]).sort((a, b) => a.queuedAt - b.queuedAt);
      resolve(ops);
    };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

/** Remove a specific operation after successful sync */
export async function removeOp(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Clear all pending operations */
export async function clearAllOps(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Get number of pending operations */
export async function getPendingCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.count();
    request.onsuccess = () => { db.close(); resolve(request.result); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}
