import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';

describe('Rate Limiter', () => {
  // Use a unique key per test to avoid cross-test pollution
  let keyCounter = 0;
  function uniqueKey() {
    return `test-user-${Date.now()}-${keyCounter++}`;
  }

  it('should allow requests within the limit', () => {
    const key = uniqueKey();
    const result = checkRateLimit(key, { limit: 5, windowSeconds: 60 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should decrement remaining on each request', () => {
    const key = uniqueKey();
    checkRateLimit(key, { limit: 3, windowSeconds: 60 });
    const r2 = checkRateLimit(key, { limit: 3, windowSeconds: 60 });
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit(key, { limit: 3, windowSeconds: 60 });
    expect(r3.remaining).toBe(0);
    expect(r3.allowed).toBe(true);
  });

  it('should deny requests over the limit', () => {
    const key = uniqueKey();
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, { limit: 3, windowSeconds: 60 });
    }
    const result = checkRateLimit(key, { limit: 3, windowSeconds: 60 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should include rate limit headers', () => {
    const key = uniqueKey();
    const result = checkRateLimit(key, { limit: 10, windowSeconds: 60 });
    expect(result.headers['X-RateLimit-Limit']).toBe('10');
    expect(result.headers['X-RateLimit-Remaining']).toBe('9');
    expect(result.headers['X-RateLimit-Reset']).toBeDefined();
  });

  it('should include Retry-After header when blocked', () => {
    const key = uniqueKey();
    checkRateLimit(key, { limit: 1, windowSeconds: 60 });
    const result = checkRateLimit(key, { limit: 1, windowSeconds: 60 });
    expect(result.allowed).toBe(false);
    expect(result.headers['Retry-After']).toBeDefined();
  });

  it('RATE_LIMITS presets should be defined', () => {
    expect(RATE_LIMITS.standard.limit).toBe(60);
    expect(RATE_LIMITS.ai.limit).toBe(20);
    expect(RATE_LIMITS.auth.limit).toBe(10);
    expect(RATE_LIMITS.read.limit).toBe(120);
  });
});
