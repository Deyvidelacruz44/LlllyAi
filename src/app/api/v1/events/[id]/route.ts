/**
 * REST API v1 — Single Event operations
 * GET    /api/v1/events/[id]    — Get event by id
 * PATCH  /api/v1/events/[id]    — Update event
 * DELETE /api/v1/events/[id]    — Delete event
 */
import { NextResponse } from 'next/server';
import { verifyAuth, apiError, apiSuccess } from '@/lib/api-auth';
import { updateEventSchema } from '@/lib/api-schemas';
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
    const docSnap = await getDoc(doc(db, 'events', id));
    if (!docSnap.exists()) return apiError('Event not found', 404);

    const data = docSnap.data();
    if (data.userId !== auth.userId) return apiError('Forbidden', 403);

    return apiSuccess({
      id: docSnap.id,
      ...data,
      startDate: data.startDate?.toDate?.()?.toISOString() || null,
      endDate: data.endDate?.toDate?.()?.toISOString() || null,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return apiError('Failed to fetch event', 500, message);
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
    // Verify ownership
    const docSnap = await getDoc(doc(db, 'events', id));
    if (!docSnap.exists()) return apiError('Event not found', 404);
    if (docSnap.data().userId !== auth.userId) return apiError('Forbidden', 403);

    const body = await request.json();
    const parsed = updateEventSchema.safeParse(sanitiseObject(body));
    if (!parsed.success) {
      return apiError('Validation failed', 400, parsed.error.flatten());
    }

    const updates: Record<string, unknown> = { ...parsed.data, updatedAt: Timestamp.now() };
    if (parsed.data.startDate) updates.startDate = Timestamp.fromDate(new Date(parsed.data.startDate));
    if (parsed.data.endDate) updates.endDate = Timestamp.fromDate(new Date(parsed.data.endDate));

    await updateDoc(doc(db, 'events', id), updates);
    return apiSuccess({ id, ...parsed.data, updatedAt: new Date().toISOString() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return apiError('Failed to update event', 500, message);
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
    const docSnap = await getDoc(doc(db, 'events', id));
    if (!docSnap.exists()) return apiError('Event not found', 404);
    if (docSnap.data().userId !== auth.userId) return apiError('Forbidden', 403);

    await deleteDoc(doc(db, 'events', id));
    return apiSuccess({ id, deleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return apiError('Failed to delete event', 500, message);
  }
}
