'use client';

import { useEffect, useState, useCallback } from 'react';
import { requestFCMToken, onForegroundMessage } from '@/lib/fcm';

type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

/**
 * Registers this device's FCM token so the server (cron / push API) can deliver
 * notifications even when the app is closed. Also surfaces foreground pushes as
 * OS notifications while the app is open.
 *
 * - If permission is already granted → registers the token silently on load.
 * - Exposes `enable()` to request permission via a user gesture (button).
 */
export function usePushRegistration(userId: string | undefined) {
  const [permission, setPermission] = useState<PushPermission>('default');

  // Detect current permission state
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as PushPermission);
  }, []);

  // Register token + foreground listener once permission is granted
  useEffect(() => {
    if (!userId || permission !== 'granted') return;
    let unsub: (() => void) | null = null;

    requestFCMToken(userId).catch((e) => console.error('[push] token registration failed:', e));

    onForegroundMessage(({ title, body, data }) => {
      // Show an OS notification even while the app is in the foreground
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title || 'Lilly AI', {
          body: body || '',
          icon: '/icon-192.png',
          data: { url: data?.url || '/dashboard' },
        });
      }
    }).then((fn) => { unsub = fn; });

    return () => { unsub?.(); };
  }, [userId, permission]);

  /** Request notification permission via a user gesture, then register. */
  const enable = useCallback(async (): Promise<PushPermission> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PushPermission);
      if (result === 'granted' && userId) {
        await requestFCMToken(userId);
      }
      return result as PushPermission;
    } catch {
      return Notification.permission as PushPermission;
    }
  }, [userId]);

  return { permission, enable };
}
