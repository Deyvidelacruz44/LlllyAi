/**
 * REST API v1 — Events CRUD
 * GET    /api/v1/events         — List user events (with pagination)
 * POST   /api/v1/events         — Create a new event
 */
import { NextResponse } from 'next/server';
import { verifyAuth, apiError, apiSuccess } from '@/lib/api-auth';
import { createEventSchema, paginationSchema } from '@/lib/api-schemas';
import { sanitiseObject, verifyOrigin } from '@/lib/security';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/lib/rate-limiter';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs, addDoc, orderBy, Timestamp, limit as firestoreLimit,
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

  try {
    const ref = collection(db, 'events');
    const q = query(
      ref,
      where('userId', '==', auth.userId),
      orderBy('startDate', 'asc'),
      firestoreLimit(pageLimit + offset),
    );
    const snapshot = await getDocs(q);

    const events = snapshot.docs.slice(offset).map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        ...d,
        startDate: d.startDate?.toDate?.()?.toISOString() || null,
        endDate: d.endDate?.toDate?.()?.toISOString() || null,
        createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: d.updatedAt?.toDate?.()?.toISOString() || null,
      };
    });

    return apiSuccess({ events, count: events.length, offset, limit: pageLimit });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return apiError('Failed to fetch events', 500, message);
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
    const parsed = createEventSchema.safeParse(sanitiseObject(body));
    if (!parsed.success) {
      return apiError('Validation failed', 400, parsed.error.flatten());
    }

    const data = parsed.data;
    const newEvent = {
      userId: auth.userId,
      title: data.title,
      description: data.description,
      type: data.type,
      startDate: Timestamp.fromDate(new Date(data.startDate)),
      endDate: Timestamp.fromDate(new Date(data.endDate)),
      location: data.location,
      category: data.category,
      reminderMinutes: data.reminderMinutes ?? null,
      tags: data.tags,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'events'), newEvent);

    return apiSuccess(
      { id: docRef.id, ...data, userId: auth.userId, createdAt: new Date().toISOString() },
      201,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return apiError('Failed to create event', 500, message);
  }
}
