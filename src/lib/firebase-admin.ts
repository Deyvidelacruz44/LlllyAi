/**
 * Firebase Admin SDK — server-side only.
 * Used by cron jobs and server routes to read Firestore across all users
 * (bypassing security rules) and to send FCM push via the modern HTTP v1 API.
 *
 * Configure with the FIREBASE_SERVICE_ACCOUNT env var: paste the full JSON
 * from Firebase Console → Project Settings → Service accounts → Generate key.
 */
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

let adminApp: App | null = null;

function parseServiceAccount(): Record<string, string> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;

  try {
    // Support both raw JSON and base64-encoded JSON
    const json = raw.trim().startsWith('{')
      ? raw
      : Buffer.from(raw, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    // Normalise escaped newlines in the private key (common when stored in env vars)
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch (err) {
    console.error('[firebase-admin] Failed to parse FIREBASE_SERVICE_ACCOUNT:', err);
    return null;
  }
}

/** Returns the initialised Admin app, or null if the service account is not configured. */
export function getAdminApp(): App | null {
  if (adminApp) return adminApp;
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) {
    console.warn('[firebase-admin] FIREBASE_SERVICE_ACCOUNT not set — admin features disabled');
    return null;
  }

  adminApp = initializeApp({
    credential: cert(serviceAccount as Parameters<typeof cert>[0]),
  });
  return adminApp;
}

/** Whether the Admin SDK is available (service account configured). */
export function isAdminAvailable(): boolean {
  return getAdminApp() !== null;
}

export function getAdminDb(): Firestore {
  const app = getAdminApp();
  if (!app) throw new Error('Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT missing)');
  return getFirestore(app);
}

export function getAdminMessaging(): Messaging {
  const app = getAdminApp();
  if (!app) throw new Error('Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT missing)');
  return getMessaging(app);
}
