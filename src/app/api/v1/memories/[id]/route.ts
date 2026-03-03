/**
 * REST API v1 — Single Memory operations
 * DELETE /api/v1/memories/[id] — Delete a memory
 */
import { NextResponse } from 'next/server';
import { verifyAuth, apiError, apiSuccess } from '@/lib/api-auth';
import { verifyOrigin } from '@/lib/security';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/lib/rate-limiter';
import { db } from '@/lib/firebase';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await verifyAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (!verifyOrigin(request)) return apiError('Forbidden', 403);

  const { id } = await context.params;

  const rl = checkRateLimit(getRateLimitKey(request, auth.userId), RATE_LIMITS.standard);
  if (!rl.allowed) return apiError('Too many requests', 429);

  try {
    const docSnap = await getDoc(doc(db, 'memories', id));
    if (!docSnap.exists()) return apiError('Memory not found', 404);
    if (docSnap.data().userId !== auth.userId) return apiError('Forbidden', 403);

    await deleteDoc(doc(db, 'memories', id));
    return apiSuccess({ id, deleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return apiError('Failed to delete memory', 500, message);
  }
}
