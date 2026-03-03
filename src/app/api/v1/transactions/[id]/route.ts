/**
 * REST API v1 — Single Transaction operations
 * GET    /api/v1/transactions/[id]    — Get transaction
 * PATCH  /api/v1/transactions/[id]    — Update transaction
 * DELETE /api/v1/transactions/[id]    — Delete transaction
 */
import { NextResponse } from 'next/server';
import { verifyAuth, apiError, apiSuccess } from '@/lib/api-auth';
import { updateTransactionSchema } from '@/lib/api-schemas';
import { sanitiseObject, verifyOrigin } from '@/lib/security';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/lib/rate-limiter';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await verifyAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  const rl = checkRateLimit(getRateLimitKey(request, auth.userId), RATE_LIMITS.read);
  if (!rl.allowed) return apiError('Too many requests', 429);

  try {
    const docSnap = await getDoc(doc(db, 'transactions', id));
    if (!docSnap.exists()) return apiError('Transaction not found', 404);
    if (docSnap.data().userId !== auth.userId) return apiError('Forbidden', 403);

    const data = docSnap.data();
    return apiSuccess({
      id: docSnap.id,
      ...data,
      date: data.date?.toDate?.()?.toISOString() || null,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return apiError('Failed to fetch transaction', 500, message);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await verifyAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (!verifyOrigin(request)) return apiError('Forbidden', 403);

  const { id } = await context.params;

  const rl = checkRateLimit(getRateLimitKey(request, auth.userId), RATE_LIMITS.standard);
  if (!rl.allowed) return apiError('Too many requests', 429);

  try {
    const docSnap = await getDoc(doc(db, 'transactions', id));
    if (!docSnap.exists()) return apiError('Transaction not found', 404);
    if (docSnap.data().userId !== auth.userId) return apiError('Forbidden', 403);

    const body = await request.json();
    const parsed = updateTransactionSchema.safeParse(sanitiseObject(body));
    if (!parsed.success) {
      return apiError('Validation failed', 400, parsed.error.flatten());
    }

    const updates: Record<string, unknown> = { ...parsed.data, updatedAt: Timestamp.now() };
    if (parsed.data.date) updates.date = Timestamp.fromDate(new Date(parsed.data.date));

    await updateDoc(doc(db, 'transactions', id), updates);
    return apiSuccess({ id, ...parsed.data, updatedAt: new Date().toISOString() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return apiError('Failed to update transaction', 500, message);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await verifyAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (!verifyOrigin(request)) return apiError('Forbidden', 403);

  const { id } = await context.params;

  const rl = checkRateLimit(getRateLimitKey(request, auth.userId), RATE_LIMITS.standard);
  if (!rl.allowed) return apiError('Too many requests', 429);

  try {
    const docSnap = await getDoc(doc(db, 'transactions', id));
    if (!docSnap.exists()) return apiError('Transaction not found', 404);
    if (docSnap.data().userId !== auth.userId) return apiError('Forbidden', 403);

    await deleteDoc(doc(db, 'transactions', id));
    return apiSuccess({ id, deleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return apiError('Failed to delete transaction', 500, message);
  }
}
