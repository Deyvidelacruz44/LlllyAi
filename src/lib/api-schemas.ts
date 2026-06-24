/**
 * Zod schemas for REST API /api/v1/ validation.
 * Reuses the types from @/types but adds runtime validation.
 */
import { z } from 'zod';

// ─── Shared ───
const isoDateString = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Must be a valid ISO date string' },
);

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── Events ───
export const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(''),
  type: z.enum(['personal', 'work', 'meeting', 'reminder', 'other']).default('personal'),
  startDate: isoDateString,
  endDate: isoDateString,
  location: z.string().max(500).optional().default(''),
  category: z.string().max(100).optional().default('general'),
  reminderMinutes: z.number().int().min(0).max(10080).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = createEventSchema.partial();
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

// ─── Tasks ───
export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(''),
  status: z.enum(['pending', 'in-progress', 'completed', 'cancelled']).default('pending'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  category: z.string().max(100).optional().default('general'),
  dueDate: isoDateString.optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema.partial();
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

// ─── Transactions ───
export const createTransactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']).default('expense'),
  category: z.string().min(1).max(100),
  amount: z.number().positive(),
  currency: z.enum(['DOP', 'USD']).optional().default('DOP'),
  description: z.string().max(500).optional().default(''),
  date: isoDateString.optional(),
  account: z.string().max(100).optional().default(''),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  isRecurring: z.boolean().optional().default(false),
  recurringFrequency: z.enum(['weekly', 'biweekly', 'monthly', 'yearly']).optional(),
});
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = createTransactionSchema.partial();
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

// ─── Chat ───
export const createChatSchema = z.object({
  title: z.string().min(1).max(200).optional().default('Nuevo Chat'),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  agendaContext: z.any().optional(),
  userProfile: z.any().optional(),
  userIntegrations: z.any().optional(),
});

// ─── Memories ───
export const createMemorySchema = z.object({
  type: z.enum(['fact', 'preference', 'pattern', 'goal']).default('fact'),
  content: z.string().min(1).max(2000),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  source: z.enum(['explicit', 'inferred']).default('explicit'),
  confidence: z.number().min(0).max(1).optional().default(1),
});
export type CreateMemoryInput = z.infer<typeof createMemorySchema>;

// ─── Query params ───
export { paginationSchema };
