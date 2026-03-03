/**
 * REST API v1 — Single Task operations
 * GET    /api/v1/tasks/[id]    — Get task by id
 * PATCH  /api/v1/tasks/[id]    — Update task
 * DELETE /api/v1/tasks/[id]    — Delete task
 */
import { NextResponse } from 'next/server';
import { verifyAuth, apiError, apiSuccess } from '@/lib/api-auth';
import { updateTaskSchema } from '@/lib/api-schemas';
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
    const docSnap = await getDoc(doc(db, 'tasks', id));
    if (!docSnap.exists()) return apiError('Task not found', 404);
    if (docSnap.data().userId !== auth.userId) return apiError('Forbidden', 403);

    const data = docSnap.data();
    return apiSuccess({
      id: docSnap.id,
      ...data,
      dueDate: data.dueDate?.toDate?.()?.toISOString() || null,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
      completedAt: data.completedAt?.toDate?.()?.toISOString() || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return apiError('Failed to fetch task', 500, message);
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
    const docSnap = await getDoc(doc(db, 'tasks', id));
    if (!docSnap.exists()) return apiError('Task not found', 404);
    if (docSnap.data().userId !== auth.userId) return apiError('Forbidden', 403);

    const body = await request.json();
    const parsed = updateTaskSchema.safeParse(sanitiseObject(body));
    if (!parsed.success) {
      return apiError('Validation failed', 400, parsed.error.flatten());
    }

    const updates: Record<string, unknown> = { ...parsed.data, updatedAt: Timestamp.now() };
    if (parsed.data.dueDate) updates.dueDate = Timestamp.fromDate(new Date(parsed.data.dueDate));
    if (parsed.data.status === 'completed') updates.completedAt = Timestamp.now();

    await updateDoc(doc(db, 'tasks', id), updates);
    return apiSuccess({ id, ...parsed.data, updatedAt: new Date().toISOString() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return apiError('Failed to update task', 500, message);
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
    const docSnap = await getDoc(doc(db, 'tasks', id));
    if (!docSnap.exists()) return apiError('Task not found', 404);
    if (docSnap.data().userId !== auth.userId) return apiError('Forbidden', 403);

    await deleteDoc(doc(db, 'tasks', id));
    return apiSuccess({ id, deleted: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return apiError('Failed to delete task', 500, message);
  }
}
