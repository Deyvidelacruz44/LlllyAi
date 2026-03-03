import { describe, it, expect } from 'vitest';
import {
  createEventSchema,
  createTaskSchema,
  createTransactionSchema,
  createMemorySchema,
  paginationSchema,
} from '@/lib/api-schemas';

describe('API Schemas', () => {
  describe('createEventSchema', () => {
    it('should validate a complete event', () => {
      const input = {
        title: 'Meeting',
        startDate: '2026-03-02T10:00:00.000Z',
        endDate: '2026-03-02T11:00:00.000Z',
        type: 'meeting',
        description: 'Team standup',
      };
      const result = createEventSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject missing title', () => {
      const input = {
        startDate: '2026-03-02T10:00:00.000Z',
        endDate: '2026-03-02T11:00:00.000Z',
      };
      const result = createEventSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid dates', () => {
      const input = {
        title: 'Test',
        startDate: 'not-a-date',
        endDate: '2026-03-02T10:00:00.000Z',
      };
      const result = createEventSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should apply defaults for optional fields', () => {
      const input = {
        title: 'Test Event',
        startDate: '2026-03-02T10:00:00.000Z',
        endDate: '2026-03-02T11:00:00.000Z',
      };
      const result = createEventSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('personal');
        expect(result.data.description).toBe('');
        expect(result.data.tags).toEqual([]);
      }
    });
  });

  describe('createTaskSchema', () => {
    it('should validate a complete task', () => {
      const result = createTaskSchema.safeParse({
        title: 'Fix bug',
        priority: 'high',
        dueDate: '2026-03-05T00:00:00.000Z',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid priority', () => {
      const result = createTaskSchema.safeParse({
        title: 'Test',
        priority: 'super-high',
      });
      expect(result.success).toBe(false);
    });

    it('should allow null dueDate', () => {
      const result = createTaskSchema.safeParse({
        title: 'Task without due date',
        dueDate: null,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('createTransactionSchema', () => {
    it('should validate an income transaction', () => {
      const result = createTransactionSchema.safeParse({
        type: 'income',
        category: 'salario',
        amount: 50000,
        description: 'Monthly salary',
      });
      expect(result.success).toBe(true);
    });

    it('should reject negative amounts', () => {
      const result = createTransactionSchema.safeParse({
        type: 'expense',
        category: 'alimentacion',
        amount: -100,
      });
      expect(result.success).toBe(false);
    });

    it('should reject zero amount', () => {
      const result = createTransactionSchema.safeParse({
        type: 'expense',
        category: 'otro',
        amount: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createMemorySchema', () => {
    it('should validate a memory', () => {
      const result = createMemorySchema.safeParse({
        type: 'fact',
        content: 'User prefers morning meetings',
        tags: ['preference', 'schedule'],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty content', () => {
      const result = createMemorySchema.safeParse({
        type: 'fact',
        content: '',
      });
      expect(result.success).toBe(false);
    });

    it('should apply default confidence', () => {
      const result = createMemorySchema.safeParse({
        content: 'Some fact',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.confidence).toBe(1);
        expect(result.data.type).toBe('fact');
        expect(result.data.source).toBe('explicit');
      }
    });
  });

  describe('paginationSchema', () => {
    it('should parse valid pagination', () => {
      const result = paginationSchema.safeParse({ limit: '25', offset: '10' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(25);
        expect(result.data.offset).toBe(10);
      }
    });

    it('should apply defaults for missing values', () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it('should clamp limit to max 100', () => {
      const result = paginationSchema.safeParse({ limit: '500' });
      expect(result.success).toBe(false);
    });
  });
});
