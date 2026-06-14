/**
 * Real productivity metrics — computed from the user's tasks.
 * Replaces the meaningless "completed / total = 100%" number with measures
 * that actually reflect productivity over time.
 */
import type { Task } from '@/types';
import {
  startOfDay, startOfWeek, endOfWeek, subWeeks, isWithinInterval, isSameDay, subDays,
} from 'date-fns';

export interface ProductivityMetrics {
  /** Consecutive days (up to today/yesterday) with at least one completed task */
  streak: number;
  /** Best streak ever observed in the data */
  bestStreak: number;
  /** % of completed tasks (that had a due date) finished on or before the due date */
  onTimeRate: number | null;
  onTimeCount: number;
  completedWithDue: number;
  /** Tasks completed in the current week (Mon–Sun) */
  thisWeekCompleted: number;
  /** Tasks completed in the previous week */
  lastWeekCompleted: number;
  /** % change vs last week (null if last week had 0) */
  weekTrendPct: number | null;
  /** Tasks whose due date falls in the current week */
  plannedThisWeek: number;
  /** Of the planned-this-week tasks, how many are completed */
  doneThisWeek: number;
  /** Total completed tasks in the dataset */
  totalCompleted: number;
}

/** The moment a task was completed (falls back to updatedAt for legacy data). */
function completionDate(task: Task): Date | null {
  if (task.status !== 'completed') return null;
  return task.completedAt || task.updatedAt || null;
}

/** Build the set of day-timestamps (start-of-day ms) that have ≥1 completion. */
function completionDayset(tasks: Task[]): Set<number> {
  const days = new Set<number>();
  for (const t of tasks) {
    const d = completionDate(t);
    if (d) days.add(startOfDay(d).getTime());
  }
  return days;
}

function computeStreak(daySet: Set<number>, today: Date): number {
  // Allow the streak to stand if today has no completion yet but yesterday did.
  let cursor = startOfDay(today);
  if (!daySet.has(cursor.getTime())) {
    const yesterday = startOfDay(subDays(today, 1));
    if (daySet.has(yesterday.getTime())) cursor = yesterday;
    else return 0;
  }
  let streak = 0;
  while (daySet.has(cursor.getTime())) {
    streak++;
    cursor = startOfDay(subDays(cursor, 1));
  }
  return streak;
}

function computeBestStreak(daySet: Set<number>): number {
  if (daySet.size === 0) return 0;
  const sorted = Array.from(daySet).sort((a, b) => a - b);
  let best = 1;
  let current = 1;
  const DAY = 24 * 60 * 60 * 1000;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === DAY) {
      current++;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }
  return best;
}

export function computeProductivityMetrics(tasks: Task[], now: Date = new Date()): ProductivityMetrics {
  const daySet = completionDayset(tasks);

  // ── Streak ──
  const streak = computeStreak(daySet, now);
  const bestStreak = computeBestStreak(daySet);

  // ── On-time rate ──
  let onTimeCount = 0;
  let completedWithDue = 0;
  for (const t of tasks) {
    const done = completionDate(t);
    if (done && t.dueDate) {
      completedWithDue++;
      // On time if completed on or before the end of the due day
      const dueEnd = startOfDay(t.dueDate).getTime() + 24 * 60 * 60 * 1000 - 1;
      if (done.getTime() <= dueEnd) onTimeCount++;
    }
  }
  const onTimeRate = completedWithDue > 0 ? Math.round((onTimeCount / completedWithDue) * 100) : null;

  // ── Weekly completion trend ──
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

  let thisWeekCompleted = 0;
  let lastWeekCompleted = 0;
  let totalCompleted = 0;
  for (const t of tasks) {
    const done = completionDate(t);
    if (!done) continue;
    totalCompleted++;
    if (isWithinInterval(done, { start: thisWeekStart, end: thisWeekEnd })) thisWeekCompleted++;
    else if (isWithinInterval(done, { start: lastWeekStart, end: lastWeekEnd })) lastWeekCompleted++;
  }
  const weekTrendPct = lastWeekCompleted > 0
    ? Math.round(((thisWeekCompleted - lastWeekCompleted) / lastWeekCompleted) * 100)
    : null;

  // ── Planned vs done this week ──
  let plannedThisWeek = 0;
  let doneThisWeek = 0;
  for (const t of tasks) {
    if (t.dueDate && isWithinInterval(t.dueDate, { start: thisWeekStart, end: thisWeekEnd })) {
      plannedThisWeek++;
      if (t.status === 'completed') doneThisWeek++;
    }
  }

  return {
    streak,
    bestStreak,
    onTimeRate,
    onTimeCount,
    completedWithDue,
    thisWeekCompleted,
    lastWeekCompleted,
    weekTrendPct,
    plannedThisWeek,
    doneThisWeek,
    totalCompleted,
  };
}

// Re-export for tests
export const _internal = { completionDate, completionDayset, computeStreak, computeBestStreak, isSameDay };
