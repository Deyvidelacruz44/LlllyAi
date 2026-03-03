/**
 * Firebase Cloud Messaging (FCM) client-side setup.
 * Handles:
 * - Requesting notification permission
 * - Getting the FCM token
 * - Storing the token in Firestore (per user/device)
 * - Listening for foreground messages
 *
 * The FCM VAPID key must be set in NEXT_PUBLIC_FIREBASE_VAPID_KEY.
 */

import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';
import { app, db } from '@/lib/firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

let messaging: Messaging | null = null;

/**
 * Lazy-init FCM messaging (only in browser, only if supported).
 */
async function getMessagingInstance(): Promise<Messaging | null> {
  if (messaging) return messaging;
  if (typeof window === 'undefined') return null;

  const supported = await isSupported();
  if (!supported) {
    console.warn('[FCM] Messaging not supported in this browser');
    return null;
  }

  messaging = getMessaging(app);
  return messaging;
}

/**
 * Request notification permission and get the FCM token.
 * Stores the token in Firestore under `fcm_tokens/{userId}_{fingerprint}`.
 */
export async function requestFCMToken(userId: string): Promise<string | null> {
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn('[FCM] NEXT_PUBLIC_FIREBASE_VAPID_KEY not set — push notifications disabled');
    return null;
  }

  const msg = await getMessagingInstance();
  if (!msg) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return null;
    }

    // Get registration from existing SW
    const registration = await navigator.serviceWorker.ready;

    const token = await getToken(msg, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      // Store token in Firestore for server-side sending
      const fingerprint = token.slice(-8);
      await setDoc(doc(db, 'fcm_tokens', `${userId}_${fingerprint}`), {
        userId,
        token,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        userAgent: navigator.userAgent,
        active: true,
      });

      return token;
    }

    return null;
  } catch (err) {
    console.error('[FCM] Failed to get token:', err);
    return null;
  }
}

/**
 * Listen for foreground push messages and show them as in-app notifications.
 * Returns an unsubscribe function.
 */
export async function onForegroundMessage(
  callback: (payload: { title?: string; body?: string; data?: Record<string, string> }) => void,
): Promise<(() => void) | null> {
  const msg = await getMessagingInstance();
  if (!msg) return null;

  const unsubscribe = onMessage(msg, (payload) => {
    callback({
      title: payload.notification?.title || payload.data?.title,
      body: payload.notification?.body || payload.data?.body,
      data: payload.data,
    });
  });

  return unsubscribe;
}
