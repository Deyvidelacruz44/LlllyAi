/**
 * REST API v1 — Push Notifications
 * POST /api/v1/push — Send a push notification to a user's devices
 *
 * Note: This endpoint uses the FCM REST API directly (not Firebase Admin SDK)
 * to send messages. Requires FIREBASE_SERVER_KEY or FCM_API_KEY env var.
 */
import { NextResponse } from 'next/server';
import { verifyAuth, apiError, apiSuccess } from '@/lib/api-auth';
import { verifyOrigin } from '@/lib/security';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/lib/rate-limiter';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { z } from 'zod';

const pushSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  url: z.string().max(500).optional().default('/dashboard'),
  targetUserId: z.string().min(1).optional(), // If omitted, send to self
});

export async function POST(request: Request) {
  const auth = await verifyAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (!verifyOrigin(request)) return apiError('Forbidden', 403);

  const rl = checkRateLimit(getRateLimitKey(request, auth.userId), RATE_LIMITS.standard);
  if (!rl.allowed) return apiError('Too many requests', 429);

  const fcmKey = process.env.FIREBASE_SERVER_KEY || process.env.FCM_API_KEY;
  if (!fcmKey) {
    return apiError('Push notifications not configured on server', 503);
  }

  try {
    const body = await request.json();
    const parsed = pushSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Validation failed', 400, parsed.error.flatten());
    }

    const { title, body: msgBody, url, targetUserId } = parsed.data;
    const userId = targetUserId || auth.userId;

    // Only allow sending to self (prevent abuse)
    if (userId !== auth.userId) {
      return apiError('Can only send push to own devices', 403);
    }

    // Get all active FCM tokens for this user
    const tokensRef = collection(db, 'fcm_tokens');
    const q = query(tokensRef, where('userId', '==', userId), where('active', '==', true));
    const snap = await getDocs(q);

    if (snap.empty) {
      return apiError('No registered devices found', 404);
    }

    const tokens = snap.docs.map((d) => d.data().token);
    let successCount = 0;

    // Send to each token via FCM REST API
    for (const token of tokens) {
      try {
        const res = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `key=${fcmKey}`,
          },
          body: JSON.stringify({
            to: token,
            notification: { title, body: msgBody },
            data: { title, body: msgBody, url },
            webpush: {
              notification: {
                title,
                body: msgBody,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
              },
              fcm_options: { link: url },
            },
          }),
        });

        if (res.ok) successCount++;
      } catch {
        // Individual token failure — continue with others
      }
    }

    return apiSuccess({
      sent: successCount,
      total: tokens.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return apiError('Failed to send push notification', 500, message);
  }
}
