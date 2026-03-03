import { describe, it, expect, vi } from 'vitest';
import { parseJsonResponse, isGeminiAvailable, DEFAULT_MODEL } from '@/lib/gemini';

// Mock the Google Generative AI module
vi.mock('@google/generative-ai', () => {
  class MockGoogleAI {
    getGenerativeModel = vi.fn();
  }
  return {
    GoogleGenerativeAI: MockGoogleAI,
  };
});

describe('Gemini utilities', () => {
  describe('parseJsonResponse', () => {
    it('should parse direct JSON object', () => {
      const input = '{"action": "create_task", "message": "Tarea creada"}';
      const result = parseJsonResponse(input);
      expect(result).toEqual({ action: 'create_task', message: 'Tarea creada' });
    });

    it('should parse JSON from markdown code fence', () => {
      const input = '```json\n{"action": "none", "message": "Hola"}\n```';
      const result = parseJsonResponse(input);
      expect(result).toEqual({ action: 'none', message: 'Hola' });
    });

    it('should parse JSON from generic code fence', () => {
      const input = '```\n{"action": "none", "message": "Test"}\n```';
      const result = parseJsonResponse(input);
      expect(result).toEqual({ action: 'none', message: 'Test' });
    });

    it('should extract JSON object from surrounding text', () => {
      const input = 'Here is the response: {"action": "none", "message": "Hi"} and more text';
      const result = parseJsonResponse(input);
      expect(result).toEqual({ action: 'none', message: 'Hi' });
    });

    it('should return null for non-JSON text', () => {
      const result = parseJsonResponse('This is just plain text');
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const result = parseJsonResponse('{broken json}');
      expect(result).toBeNull();
    });

    it('should handle whitespace around JSON', () => {
      const input = '  \n  {"key": "value"}  \n  ';
      const result = parseJsonResponse(input);
      expect(result).toEqual({ key: 'value' });
    });

    it('should parse arrays', () => {
      const input = '[1, 2, 3]';
      const result = parseJsonResponse<number[]>(input);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle nested JSON objects', () => {
      const input = '{"action": "create_event", "data": {"title": "Meeting", "type": "work"}}';
      const result = parseJsonResponse(input);
      expect(result).toEqual({
        action: 'create_event',
        data: { title: 'Meeting', type: 'work' },
      });
    });
  });

  describe('isGeminiAvailable', () => {
    it('should return true when API key is set', () => {
      // Our test setup provides the key
      expect(isGeminiAvailable()).toBe(true);
    });
  });

  describe('DEFAULT_MODEL', () => {
    it('should be gemini-2.0-flash', () => {
      expect(DEFAULT_MODEL).toBe('gemini-2.0-flash');
    });
  });
});
