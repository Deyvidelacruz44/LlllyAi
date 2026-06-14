import { describe, it, expect } from 'vitest';
import { computeProductivityMetrics } from '@/lib/productivity';
import type { Task } from '@/types';

// Fixed reference: Wednesday, June 10 2026, 12:00.
// Week (Mon-start): 2026-06-08 .. 2026-06-14. Last week: 2026-06-01 .. 2026-06-07.
const NOW = new Date(2026, 5, 10, 12, 0, 0);

function task(partial: Partial<Task>): Task {
  return ({
    id: Math.random().toString(36).slice(2),
    title: 't',
    status: 'pending',
    priority: 'medium',
    category: 'general',
    createdAt: new Date(2026, 5, 1),
    updatedAt: new Date(2026, 5, 1),
    ...partial,
  } as unknown) as Task;
}

function completed(date: Date, due?: Date): Task {
  return task({ status: 'completed', completedAt: date, updatedAt: date, dueDate: due });
}

describe('computeProductivityMetrics', () => {
  it('returns zeros/null for empty task list', () => {
    const m = computeProductivityMetrics([], NOW);
    expect(m.streak).toBe(0);
    expect(m.bestStreak).toBe(0);
    expect(m.onTimeRate).toBeNull();
    expect(m.totalCompleted).toBe(0);
    expect(m.weekTrendPct).toBeNull();
  });

  describe('streak', () => {
    it('counts consecutive days ending today', () => {
      const tasks = [
        completed(new Date(2026, 5, 10, 9)),
        completed(new Date(2026, 5, 9, 9)),
        completed(new Date(2026, 5, 8, 9)),
        completed(new Date(2026, 5, 6, 9)), // gap on the 7th
      ];
      const m = computeProductivityMetrics(tasks, NOW);
      expect(m.streak).toBe(3);
      expect(m.bestStreak).toBe(3);
    });

    it('still counts when today has no completion but yesterday does', () => {
      const tasks = [completed(new Date(2026, 5, 9, 9)), completed(new Date(2026, 5, 8, 9))];
      expect(computeProductivityMetrics(tasks, NOW).streak).toBe(2);
    });

    it('is zero when the last completion is 2+ days ago', () => {
      const tasks = [completed(new Date(2026, 5, 7, 9))];
      expect(computeProductivityMetrics(tasks, NOW).streak).toBe(0);
    });

    it('counts multiple completions on the same day as one streak day', () => {
      const tasks = [
        completed(new Date(2026, 5, 10, 9)),
        completed(new Date(2026, 5, 10, 14)),
      ];
      expect(computeProductivityMetrics(tasks, NOW).streak).toBe(1);
    });
  });

  describe('on-time rate', () => {
    it('counts completions on or before the end of the due day as on time', () => {
      const tasks = [
        completed(new Date(2026, 5, 10, 9), new Date(2026, 5, 10)), // due today → on time
        completed(new Date(2026, 5, 10, 9), new Date(2026, 5, 9)),  // due yesterday → late
        completed(new Date(2026, 5, 10, 9), new Date(2026, 5, 11)), // due tomorrow → on time (early)
      ];
      const m = computeProductivityMetrics(tasks, NOW);
      expect(m.completedWithDue).toBe(3);
      expect(m.onTimeCount).toBe(2);
      expect(m.onTimeRate).toBe(67);
    });

    it('is null when no completed task had a due date', () => {
      const tasks = [completed(new Date(2026, 5, 10, 9))];
      expect(computeProductivityMetrics(tasks, NOW).onTimeRate).toBeNull();
    });
  });

  describe('weekly trend', () => {
    it('computes this week vs last week completions and percent change', () => {
      const tasks = [
        completed(new Date(2026, 5, 9)),  // this week
        completed(new Date(2026, 5, 10)), // this week
        completed(new Date(2026, 5, 3)),  // last week
      ];
      const m = computeProductivityMetrics(tasks, NOW);
      expect(m.thisWeekCompleted).toBe(2);
      expect(m.lastWeekCompleted).toBe(1);
      expect(m.weekTrendPct).toBe(100);
    });
  });

  describe('planned vs done this week', () => {
    it('counts tasks due this week and how many are completed', () => {
      const tasks = [
        task({ dueDate: new Date(2026, 5, 9), status: 'completed', completedAt: new Date(2026, 5, 9) }),
        task({ dueDate: new Date(2026, 5, 11), status: 'pending' }),
        task({ dueDate: new Date(2026, 5, 3), status: 'completed', completedAt: new Date(2026, 5, 3) }), // last week
      ];
      const m = computeProductivityMetrics(tasks, NOW);
      expect(m.plannedThisWeek).toBe(2);
      expect(m.doneThisWeek).toBe(1);
    });
  });
});
