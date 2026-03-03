'use client';

import { useEffect, useState, useCallback } from 'react';
import { enqueueOp } from '@/lib/offline-queue';
import { initSyncManager, flushQueue, onSyncStatusChange, type SyncStatus } from '@/lib/sync-manager';

/**
 * Hook that provides offline awareness and write-queueing.
 *
 * Usage:
 *   const { isOnline, pendingOps, queueWrite } = useOffline();
 *   await queueWrite('tasks', 'create', null, taskData, userId);
 */
export function useOffline() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    syncing: false,
    pending: 0,
    lastSyncAt: null,
    errors: [],
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for background sync messages from SW
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BACKGROUND_SYNC_TRIGGERED') {
        flushQueue();
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleMessage);

    // Init the sync manager
    const cleanup = initSyncManager();
    const unsubscribe = onSyncStatusChange(setSyncStatus);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
      cleanup();
      unsubscribe();
    };
  }, []);

  /**
   * Queue a write operation. If online, it will be flushed immediately.
   * If offline, it's stored in IndexedDB and retried when connectivity returns.
   */
  const queueWrite = useCallback(
    async (
      collectionName: string,
      operation: 'create' | 'update' | 'delete',
      docId: string | null,
      data: Record<string, unknown>,
      userId: string,
    ) => {
      await enqueueOp({
        collection: collectionName,
        operation,
        docId,
        data,
        userId,
      });

      // If online, flush immediately
      if (navigator.onLine) {
        await flushQueue();
      }
    },
    [],
  );

  const manualSync = useCallback(() => flushQueue(), []);

  return {
    isOnline,
    syncStatus,
    pendingOps: syncStatus.pending,
    queueWrite,
    manualSync,
  };
}
