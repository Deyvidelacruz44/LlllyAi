import { describe, it, expect } from 'vitest';
import { sanitiseString, sanitiseObject, verifyOrigin } from '@/lib/security';

describe('Security utilities', () => {
  describe('sanitiseString', () => {
    it('should strip script tags', () => {
      const input = 'Hello <script>alert("xss")</script>world';
      expect(sanitiseString(input)).toBe('Hello world');
    });

    it('should strip HTML tags', () => {
      const input = '<b>Bold</b> and <i>italic</i>';
      expect(sanitiseString(input)).toBe('Bold and italic');
    });

    it('should strip javascript: protocol', () => {
      const input = 'javascript:alert(1)';
      expect(sanitiseString(input)).toBe('alert(1)');
    });

    it('should strip event handlers in HTML context', () => {
      const input = '<div onclick=doSomething()>something</div>';
      const result = sanitiseString(input);
      expect(result).not.toContain('onclick');
    });

    it('should trim whitespace', () => {
      expect(sanitiseString('  hello  ')).toBe('hello');
    });

    it('should pass through safe strings', () => {
      expect(sanitiseString('Hello World 123')).toBe('Hello World 123');
    });
  });

  describe('sanitiseObject', () => {
    it('should deep-sanitise string values', () => {
      const input = {
        name: '<b>John</b>',
        nested: {
          desc: '<script>alert(1)</script>Test',
        },
        tags: ['<i>tag1</i>', 'tag2'],
      };

      const result = sanitiseObject(input);
      expect(result.name).toBe('John');
      expect(result.nested.desc).toBe('Test');
      expect(result.tags[0]).toBe('tag1');
      expect(result.tags[1]).toBe('tag2');
    });

    it('should leave non-string values untouched', () => {
      const input = { count: 42, active: true, data: null };
      const result = sanitiseObject(input);
      expect(result.count).toBe(42);
      expect(result.active).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('verifyOrigin', () => {
    it('should allow requests in development', () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as Record<string, string>).NODE_ENV = 'development';

      const request = new Request('http://localhost:3000/api/test', {
        headers: { origin: 'http://evil.com' },
      });
      expect(verifyOrigin(request)).toBe(true);

      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    });

    it('should allow requests with api token header', () => {
      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          'x-api-token': 'some-token',
          origin: 'http://evil.com',
        },
      });
      expect(verifyOrigin(request)).toBe(true);
    });

    it('should allow requests without origin header', () => {
      const request = new Request('http://localhost:3000/api/test');
      expect(verifyOrigin(request)).toBe(true);
    });
  });
});
