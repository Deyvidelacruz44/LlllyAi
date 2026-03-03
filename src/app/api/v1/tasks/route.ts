/**
 * REST API v1 — Tasks CRUD
 * GET    /api/v1/tasks         — List user tasks
 * POST   /api/v1/tasks         — Create a new task
 */
import { NextResponse } from 'next/server';
import { verifyAuth, apiError, apiSuccess } from '@/lib/api-auth';
import { createTaskSchema, paginationSchema } from '@/lib/api-schemas';
import { sanitiseObject, verifyOrigin } from '@/lib/security';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/lib/rate-limiter';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs, addDoc, orderBy, Timestamp, limit as firestoreLimit,
  type QueryConstraint,
} from 'firebase/firestore';

export async function GET(request: Request) {
  const auth = await verifyAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rl = checkRateLimit(getRateLimitKey(request, auth.userId), RATE_LIMITS.read);
  if (!rl.allowed) return apiError('Too many requests', 429);

  const url = new URL(request.url);
  const params = paginationSchema.safeParse({
    limit: url.searchParams.get('limit'),
    offset: url.searchParams.get('offset'),
  });
  const { limit: pageLimit, offset } = params.success ? params.data : { limit: 50, offset: 0 };

  // Optional filter by status
  const statusFilter = url.searchParams.get('status');

  try {
    const ref = collection(db, 'tasks');
    const constraints: QueryConstraint[] = [where('userId', '==', auth.userId)];
    if (statusFilter && ['pending', 'in-progress', 'completed', 'cancelled'].includes(statusFilter)) {
      constraints.push(where('status', '==', statusFilter));
    }
    constraints.push(orderBy('createdAt', 'desc'), firestoreLimit(pageLimit + offset));

    const q = query(ref, ...constraints);
    const snapshot = await getDocs(q);

    const tasks = snapshot.docs.slice(offset).map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        ...d,
        dueDate: d.dueDate?.toDate?.()?.toISOString() || null,
        createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: d.updatedAt?.toDate?.()?.toISOString() || null,
        completedAt: d.completedAt?.toDate?.()?.toISOString() || null,
      };
    });

    return apiSuccess({ tasks, count: tasks.length, offset, limit: pageLimit });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return apiError('Failed to fetch tasks', 500, message);
  }
}

export async function POST(request: Request) {
  const auth = await verifyAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (!verifyOrigin(request)) return apiError('Forbidden', 403);

  const rl = checkRateLimit(getRateLimitKey(request, auth.userId), RATE_LIMITS.standard);
  if (!rl.allowed) return apiError('Too many requests', 429);

  try {
    const body = await request.json();
    const parsed = createTaskSchema.safeParse(sanitiseObject(body));
    if (!parsed.success) {
      return apiError('Validation failed', 400, parsed.error.flatten());
    }

    const data = parsed.data;
    const newTask = {
      userId: auth.userId,
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      category: data.category,
      dueDate: data.dueDate ? Timestamp.fromDate(new Date(data.dueDate)) : null,
      tags: data.tags,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'tasks'), newTask);

    return apiSuccess(
      { id: docRef.id, ...data, userId: auth.userId, createdAt: new Date().toISOString() },
      201,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return apiError('Failed to create task', 500, message);
  }
}
