/**
 * Security utilities for API routes.
 * - Input sanitisation (strip dangerous HTML/script content)
 * - CSRF-like origin checking for mutation requests
 */

/**
 * Sanitise a string by stripping HTML tags and common injection patterns.
 * This is a lightweight server-side guard — the real security layer is Zod validation.
 */
export function sanitiseString(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * Deep-sanitise all string values in an object.
 */
export function sanitiseObject<T>(obj: T): T {
  if (typeof obj === 'string') return sanitiseString(obj) as unknown as T;
  if (Array.isArray(obj)) return obj.map(sanitiseObject) as unknown as T;
  if (obj && typeof obj === 'object') {
    const result = {} as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitiseObject(value);
    }
    return result as T;
  }
  return obj;
}

/**
 * Verify that the request origin matches the app's origin.
 * This prevents cross-site request forgery from foreign origins.
 * API token requests (device clients) skip this check.
 */
export function verifyOrigin(request: Request): boolean {
  // Device clients using API tokens skip origin check
  if (request.headers.get('x-api-token')) return true;

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // In development, allow all origins
  if (process.env.NODE_ENV === 'development') return true;

  // For production, check that origin/referer matches our app
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const allowedHosts = [
    appUrl,
    'localhost',
    '127.0.0.1',
  ].filter(Boolean);

  // Also allow the Netlify subdomain if using a custom domain
  if (appUrl) {
    try {
      const parsed = new URL(appUrl);
      // Accept the raw hostname (e.g. "deyvidev.com")
      allowedHosts.push(parsed.hostname);
    } catch { /* ignore */ }
  }

  const checkUrl = origin || referer;
  if (!checkUrl) return true; // Same-origin requests may not send origin header

  try {
    const url = new URL(checkUrl);
    return allowedHosts.some((host) => url.hostname === host || url.origin === host);
  } catch {
    return false;
  }
}
