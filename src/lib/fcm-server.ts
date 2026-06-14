/**
 * Server-side FCM push sender — uses Firebase Admin (FCM HTTP v1 API).
 * Replaces the deprecated legacy `fcm.googleapis.com/fcm/send` endpoint
 * (shut down by Google in 2024).
 *
 * Also writes an in-app notification document so the message appears in the
 * NotificationCenter even if the OS push is missed.
 */
import { getAdminDb, getAdminMessaging, isAdminAvailable } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { NotificationType } from '@/stores/notificationsStore';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  /** Notification type for the in-app notification doc */
  type?: NotificationType;
  /** Related entity id (eventId / taskId) for dedup + deep-linking */
  referenceId?: string;
}

export interface SendResult {
  sent: number;
  total: number;
  invalidTokens: number;
}

/**
 * Send a push notification to every active device registered for a user.
 * Deactivates tokens that FCM reports as invalid/unregistered.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<SendResult> {
  if (!isAdminAvailable()) {
    throw new Error('Firebase Admin not configured');
  }

  const db = getAdminDb();
  const messaging = getAdminMessaging();

  const tokensSnap = await db
    .collection('fcm_tokens')
    .where('userId', '==', userId)
    .where('active', '==', true)
    .get();

  let sent = 0;
  let invalidTokens = 0;

  for (const tokenDoc of tokensSnap.docs) {
    const token = tokenDoc.data().token as string;
    if (!token) continue;

    try {
      await messaging.send({
        token,
        notification: { title: payload.title, body: payload.body },
        data: {
          title: payload.title,
          body: payload.body,
          url: payload.url || '/dashboard',
        },
        webpush: {
          notification: {
            title: payload.title,
            body: payload.body,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
          },
          fcmOptions: { link: payload.url || '/dashboard' },
        },
      });
      sent++;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      // Token no longer valid → mark inactive so we stop trying
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/invalid-argument'
      ) {
        invalidTokens++;
        await tokenDoc.ref.update({ active: false }).catch(() => {});
      }
    }
  }

  // Persist an in-app notification so it shows in the NotificationCenter too
  if (payload.type) {
    await db.collection('notifications').add({
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      actionUrl: payload.url || '/dashboard',
      ...(payload.referenceId ? { referenceId: payload.referenceId } : {}),
      read: false,
      createdAt: Timestamp.now(),
    });
  }

  return { sent, total: tokensSnap.size, invalidTokens };
}
