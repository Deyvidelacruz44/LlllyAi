import { z } from 'zod';

// ─── Chat API ───
export const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1),
    }),
  ).min(1),
  agendaContext: z.any().optional(),
  userProfile: z.any().optional(),
  userIntegrations: z.any().optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

// ─── Dashboard Analysis API ───
export const dashboardAnalysisRequestSchema = z.object({
  userId: z.string().min(1, 'User ID required'),
  stats: z.object({
    todayEvents: z.number().default(0),
    thisWeekEvents: z.number().default(0),
    pendingTasks: z.number().default(0),
    urgentTasks: z.number().default(0),
    completedTasks: z.number().default(0),
    overdueTasks: z.number().default(0),
    totalEvents: z.number().default(0),
    totalTasks: z.number().default(0),
  }),
  events: z.array(z.any()).default([]),
  tasks: z.array(z.any()).default([]),
  currentDate: z.string().optional(),
});
export type DashboardAnalysisRequest = z.infer<typeof dashboardAnalysisRequestSchema>;

// ─── Analytics API ───
export const analyticsRequestSchema = z.object({
  events: z.array(z.any()).default([]),
  tasks: z.array(z.any()).default([]),
  finances: z.any().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
export type AnalyticsRequest = z.infer<typeof analyticsRequestSchema>;

// ─── Finance Analysis API ───
export const financeAnalysisRequestSchema = z.object({
  userId: z.string().min(1, 'User ID required'),
  stats: z.any().optional(),
  transactions: z.array(z.any()).default([]),
  budgets: z.array(z.any()).default([]),
  currentDate: z.string().optional(),
});
export type FinanceAnalysisRequest = z.infer<typeof financeAnalysisRequestSchema>;
