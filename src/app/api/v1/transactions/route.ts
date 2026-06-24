/**
 * REST API v1 — Transactions CRUD
 * GET    /api/v1/transactions         — List user transactions
 * POST   /api/v1/transactions         — Create a new transaction
 */
import { NextResponse } from 'next/server';
import { verifyAuth, apiError, apiSuccess } from '@/lib/api-auth';
import { createTransactionSchema, paginationSchema } from '@/lib/api-schemas';
import { sanitiseObject, verifyOrigin } from '@/lib/security';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/lib/rate-limiter';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs, addDoc, Timestamp, limit as firestoreLimit,
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
    const ref = collection(db, 'transactions');
    const constraints: QueryConstraint[] = [where('userId', '==', auth.userId)];
    if (typeFilter && ['income', 'expense', 'transfer'].includes(typeFilter)) {
      constraints.push(where('type', '==', typeFilter));
    }
    constraints.push(firestoreLimit(pageLimit + offset));

    const q = query(ref, ...constraints);
    const snapshot = await getDocs(q);

    const transactions = snapshot.docs.slice(offset).map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        ...d,
        date: d.date?.toDate?.()?.toISOString() || null,
        createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: d.updatedAt?.toDate?.()?.toISOString() || null,
      };
    });

    // Sort by date descending
    transactions.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });

    return apiSuccess({ transactions, count: transactions.length, offset, limit: pageLimit });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return apiError('Failed to fetch transactions', 500, message);
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
    const parsed = createTransactionSchema.safeParse(sanitiseObject(body));
    if (!parsed.success) {
      return apiError('Validation failed', 400, parsed.error.flatten());
    }

    const data = parsed.data;
    const newTx = {
      userId: auth.userId,
      type: data.type,
      category: data.category,
      amount: data.amount,
      currency: data.currency,
      description: data.description,
      date: data.date ? Timestamp.fromDate(new Date(data.date)) : Timestamp.now(),
      account: data.account,
      tags: data.tags,
      isRecurring: data.isRecurring,
      recurringFrequency: data.recurringFrequency || 'monthly',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'transactions'), newTx);

    return apiSuccess(
      { id: docRef.id, ...data, userId: auth.userId, createdAt: new Date().toISOString() },
      201,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return apiError('Failed to create transaction', 500, message);
  }
}
