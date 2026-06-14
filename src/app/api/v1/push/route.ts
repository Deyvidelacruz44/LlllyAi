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
import { isAdminAvailable } from '@/lib/firebase-admin';
import { sendPushToUser } from '@/lib/fcm-server';
import { z } from 'zod';

export const runtime = 'nodejs';

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

  if (!isAdminAvailable()) {
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

    const result = await sendPushToUser(userId, { title, body: msgBody, url, type: 'system' });

    if (result.total === 0) {
      return apiError('No registered devices found', 404);
    }

    return apiSuccess(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return apiError('Failed to send push notification', 500, message);
  }
}
