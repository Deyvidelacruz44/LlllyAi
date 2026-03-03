/**
 * Server-side Firebase Auth verification for API routes.
 * Verifies the Firebase ID token from the Authorization header.
 *
 * For browser clients: the token comes from firebase/auth getIdToken().
 * For device clients (Raspberry Pi, etc.): uses a static API token stored in Firestore.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

// Firebase Admin is required for token verification on the server.
// Since we're in a serverless environment without Firebase Admin SDK installed,
// we use a lightweight approach: verify the token via Google's tokeninfo endpoint.

interface AuthResult {
  userId: string;
  source: 'firebase' | 'api_token';
}

/**
 * Extracts and verifies the user identity from the request.
 * Supports:
 *   - Authorization: Bearer <firebase-id-token> (verified via Google tokeninfo)
 *   - X-API-Token: <static-token> (verified against Firestore api_tokens collection)
 */
export async function verifyAuth(request: Request): Promise<AuthResult | NextResponse> {
  // 1. Check for API token (device clients)
  const apiToken = request.headers.get('x-api-token');
  if (apiToken) {
    try {
      const tokensRef = collection(db, 'api_tokens');
      const q = query(tokensRef, where('token', '==', apiToken), where('active', '==', true));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const tokenDoc = snap.docs[0].data();
        return { userId: tokenDoc.userId, source: 'api_token' };
      }
    } catch {
      // Fall through to error
    }
    return NextResponse.json({ error: 'Invalid API token' }, { status: 401 });
  }

  // 2. Check for Bearer token
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const idToken = authHeader.slice(7);
    try {
      // Verify the Firebase ID token via Google's tokeninfo endpoint
      const res = await fetch(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${idToken}`,
      );
      if (res.ok) {
        const info = await res.json();
        // The 'sub' claim is the Firebase UID
        if (info.sub) {
          return { userId: info.sub, source: 'firebase' };
        }
      }
    } catch {
      // Fall through to error
    }
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  return NextResponse.json(
    { error: 'Authentication required. Provide x-api-token or Authorization: Bearer <token>' },
    { status: 401 },
  );
}

/** Helper to build a standardised JSON error response */
export function apiError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { success: false, error: message, ...(details ? { details } : {}) },
    { status },
  );
}

/** Helper to build a standardised JSON success response */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}
