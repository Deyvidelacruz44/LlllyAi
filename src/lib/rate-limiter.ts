/**
 * In-memory rate limiter for API routes.
 * Uses a sliding-window counter per IP/user.
 *
 * In a serverless environment (Netlify Functions), each cold start resets the store.
 * This provides best-effort protection; for stronger guarantees use a Redis-backed solution.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number; // Timestamp (ms)
}

const store = new Map<string, RateLimitEntry>();

// Periodically clean up expired entries (every 60s)
if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, 60_000);
}

interface RateLimitConfig {
  /** Maximum requests per window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  headers: Record<string, string>;
}

/**
 * Check rate limit for the given key (typically IP or userId).
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    // New window
    const resetAt = now + config.windowSeconds * 1000;
    store.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: config.limit - 1,
      resetAt,
      headers: {
        'X-RateLimit-Limit': String(config.limit),
        'X-RateLimit-Remaining': String(config.limit - 1),
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
      },
    };
  }

  entry.count += 1;
  const remaining = Math.max(0, config.limit - entry.count);
  const allowed = entry.count <= config.limit;

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
    headers: {
      'X-RateLimit-Limit': String(config.limit),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
      ...(allowed ? {} : { 'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)) }),
    },
  };
}

/**
 * Extracts a rate-limit key from the request (IP + optional userId).
 */
export function getRateLimitKey(request: Request, userId?: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  return userId ? `${userId}:${ip}` : ip;
}

// Preset configurations for different endpoint types
export const RATE_LIMITS = {
  /** Standard CRUD operations */
  standard: { limit: 60, windowSeconds: 60 } as RateLimitConfig,
  /** AI / Gemini calls (more expensive) */
  ai: { limit: 20, windowSeconds: 60 } as RateLimitConfig,
  /** Auth / token operations */
  auth: { limit: 10, windowSeconds: 60 } as RateLimitConfig,
  /** Read-heavy endpoints */
  read: { limit: 120, windowSeconds: 60 } as RateLimitConfig,
} as const;
