import { describe, it, expect, vi } from 'vitest';
import { parseJsonResponse, isGeminiAvailable, DEFAULT_MODEL } from '@/lib/gemini';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'mock response' }],
      }),
    };
  }
  return { default: MockAnthropic };
});

describe('AI utilities (Claude)', () => {
  describe('parseJsonResponse', () => {
    it('should parse direct JSON object', () => {
      const result = parseJsonResponse('{"action": "create_task", "message": "Tarea creada"}');
      expect(result).toEqual({ action: 'create_task', message: 'Tarea creada' });
    });

    it('should parse JSON from markdown code fence', () => {
      const result = parseJsonResponse('```json\n{"action": "none", "message": "Hola"}\n```');
      expect(result).toEqual({ action: 'none', message: 'Hola' });
    });

    it('should parse JSON from generic code fence', () => {
      const result = parseJsonResponse('```\n{"action": "none", "message": "Test"}\n```');
      expect(result).toEqual({ action: 'none', message: 'Test' });
    });

    it('should extract JSON object from surrounding text', () => {
      const result = parseJsonResponse('Here is: {"action": "none", "message": "Hi"} and more');
      expect(result).toEqual({ action: 'none', message: 'Hi' });
    });

    it('should return null for non-JSON text', () => {
      expect(parseJsonResponse('This is just plain text')).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      expect(parseJsonResponse('{broken json}')).toBeNull();
    });

    it('should handle whitespace around JSON', () => {
      const result = parseJsonResponse('  \n  {"key": "value"}  \n  ');
      expect(result).toEqual({ key: 'value' });
    });

    it('should parse arrays', () => {
      const result = parseJsonResponse<number[]>('[1, 2, 3]');
      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle nested JSON objects', () => {
      const result = parseJsonResponse('{"action": "create_event", "data": {"title": "Meeting", "type": "work"}}');
      expect(result).toEqual({ action: 'create_event', data: { title: 'Meeting', type: 'work' } });
    });
  });

  describe('isGeminiAvailable', () => {
    it('should return true when API key is set', () => {
      expect(isGeminiAvailable()).toBe(true);
    });
  });

  describe('DEFAULT_MODEL', () => {
    it('should be a Claude Haiku model', () => {
      expect(DEFAULT_MODEL).toBe('claude-haiku-4-5-20251001');
    });
  });
});
