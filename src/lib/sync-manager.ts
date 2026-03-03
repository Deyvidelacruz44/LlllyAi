/**
 * Offline Sync Manager
 * Listens for online/offline events and flushes the IndexedDB pending ops queue
 * when connectivity is restored. Also registers for Background Sync if available.
 */

import { getPendingOps, removeOp, type OfflineOp } from '@/lib/offline-queue';
import { db } from '@/lib/firebase';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, Timestamp,
} from 'firebase/firestore';

let isSyncing = false;
const syncListeners: Array<(status: SyncStatus) => void> = [];

export type SyncStatus = {
  syncing: boolean;
  pending: number;
  lastSyncAt: number | null;
  errors: string[];
};

let lastSyncAt: number | null = null;
const syncErrors: string[] = [];

/**
 * Convert plain date strings back to Firestore Timestamps in the data payload.
 */
function prepareFirestoreData(data: Record<string, unknown>): Record<string, unknown> {
  const prepared = { ...data };
  const dateFields = ['startDate', 'endDate', 'dueDate', 'date', 'nextDueDate', 'lastPaidDate', 'startDate', 'completedAt'];

  for (const field of dateFields) {
    if (prepared[field] && typeof prepared[field] === 'string') {
      prepared[field] = Timestamp.fromDate(new Date(prepared[field] as string));
    }
  }

  // Always update the updatedAt timestamp
  prepared.updatedAt = Timestamp.now();
  if (!prepared.createdAt) {
    prepared.createdAt = Timestamp.now();
  } else if (typeof prepared.createdAt === 'string') {
    prepared.createdAt = Timestamp.fromDate(new Date(prepared.createdAt as string));
  }

  return prepared;
}

/**
 * Execute a single offline operation against Firestore.
 */
async function executeOp(op: OfflineOp): Promise<void> {
  const firestoreData = prepareFirestoreData(op.data);

  switch (op.operation) {
    case 'create': {
      await addDoc(collection(db, op.collection), {
        ...firestoreData,
        userId: op.userId,
      });
      break;
    }
    case 'update': {
      if (!op.docId) throw new Error('docId required for update');
      const { userId: _uid, ...updateData } = firestoreData;
      await updateDoc(doc(db, op.collection, op.docId), updateData);
      break;
    }
    case 'delete': {
      if (!op.docId) throw new Error('docId required for delete');
      await deleteDoc(doc(db, op.collection, op.docId));
      break;
    }
  }
}

/**
 * Flush all pending ops from the IndexedDB queue to Firestore.
 */
export async function flushQueue(): Promise<SyncStatus> {
  if (isSyncing) {
    return getStatus(await getPendingCount());
  }

  isSyncing = true;
  syncErrors.length = 0;
  notify();

  try {
    const ops = await getPendingOps();

    for (const op of ops) {
      try {
        await executeOp(op);
        if (op.id !== undefined) {
          await removeOp(op.id);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown sync error';
        syncErrors.push(`${op.collection}/${op.operation}: ${message}`);
        console.error('[SyncManager] Failed to sync op:', op, err);
        // Don't remove — will retry next time
      }
    }

    lastSyncAt = Date.now();
  } finally {
    isSyncing = false;
    notify();
  }

  const remaining = await getPendingCount();
  return getStatus(remaining);
}

async function getPendingCount(): Promise<number> {
  try {
    const ops = await getPendingOps();
    return ops.length;
  } catch {
    return 0;
  }
}

function getStatus(pending: number): SyncStatus {
  return {
    syncing: isSyncing,
    pending,
    lastSyncAt,
    errors: [...syncErrors],
  };
}

function notify() {
  getPendingCount().then((pending) => {
    const status = getStatus(pending);
    for (const listener of syncListeners) {
      try { listener(status); } catch { /* ignore */ }
    }
  });
}

/**
 * Subscribe to sync status changes.
 */
export function onSyncStatusChange(listener: (status: SyncStatus) => void): () => void {
  syncListeners.push(listener);
  return () => {
    const idx = syncListeners.indexOf(listener);
    if (idx >= 0) syncListeners.splice(idx, 1);
  };
}

/**
 * Initialise the sync manager: listen for online events, periodic checks,
 * and register Background Sync if supported.
 */
export function initSyncManager(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => {
    flushQueue();
  };

  window.addEventListener('online', handleOnline);

  // Register for Background Sync (progressive enhancement)
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then((registration) => {
      (registration as any).sync?.register?.('sync-agenda').catch(() => {
        // Background Sync not supported — that's OK
      });
    });
  }

  // Periodic check every 30 seconds if online
  const interval = setInterval(() => {
    if (navigator.onLine) {
      getPendingCount().then((count) => {
        if (count > 0) flushQueue();
      });
    }
  }, 30_000);

  // Initial flush if online
  if (navigator.onLine) {
    setTimeout(() => flushQueue(), 2000);
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    clearInterval(interval);
  };
}
