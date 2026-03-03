/**
 * REST API v1 — Memories CRUD
 * GET    /api/v1/memories       — List user memories
 * POST   /api/v1/memories       — Create a new memory
 * DELETE /api/v1/memories/[id]  is handled in /api/v1/memories/[id]/route.ts
 */
import { NextResponse } from 'next/server';
import { verifyAuth, apiError, apiSuccess } from '@/lib/api-auth';
import { createMemorySchema, paginationSchema } from '@/lib/api-schemas';
import { sanitiseObject, verifyOrigin } from '@/lib/security';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/lib/rate-limiter';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs, addDoc, Timestamp, limit as firestoreLimit, orderBy,
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

  const typeFilter = url.searchParams.get('type');

  try {
    const ref = collection(db, 'memories');
    const constraints: QueryConstraint[] = [where('userId', '==', auth.userId)];
    if (typeFilter && ['fact', 'preference', 'pattern', 'goal'].includes(typeFilter)) {
      constraints.push(where('type', '==', typeFilter));
    }
    constraints.push(orderBy('createdAt', 'desc'), firestoreLimit(pageLimit + offset));

    const q = query(ref, ...constraints);
    const snapshot = await getDocs(q);

    const memories = snapshot.docs.slice(offset).map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        ...d,
        createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
        lastReferencedAt: d.lastReferencedAt?.toDate?.()?.toISOString() || null,
      };
    });

    return apiSuccess({ memories, count: memories.length, offset, limit: pageLimit });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return apiError('Failed to fetch memories', 500, message);
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
    const parsed = createMemorySchema.safeParse(sanitiseObject(body));
    if (!parsed.success) {
      return apiError('Validation failed', 400, parsed.error.flatten());
    }

    const data = parsed.data;
    const newMemory = {
      userId: auth.userId,
      type: data.type,
      content: data.content,
      tags: data.tags,
      source: data.source,
      confidence: data.confidence,
      createdAt: Timestamp.now(),
      lastReferencedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'memories'), newMemory);

    return apiSuccess(
      { id: docRef.id, ...data, userId: auth.userId, createdAt: new Date().toISOString() },
      201,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return apiError('Failed to create memory', 500, message);
  }
}
