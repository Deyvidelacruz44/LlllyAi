'use client';

import { useEffect, useRef } from 'react';
import { useNotificationsStore } from '@/stores/notificationsStore';
import { useEventsStore } from '@/stores/eventsStore';
import { useTasksStore } from '@/stores/tasksStore';
import { useServiceWorker } from '@/hooks/useServiceWorker';

/**
 * Automatically generates notifications for:
 * - Events starting within the next 15 minutes
 * - Tasks due today that are still pending
 * - Tasks that are overdue
 * 
 * Also triggers browser-native notifications via Service Worker.
 * 
 * Runs a check every 60 seconds.
 */
export function useNotificationScheduler(userId: string | undefined) {
  const { add } = useNotificationsStore();
  const { events } = useEventsStore();
  const { tasks } = useTasksStore();
  const { showLocalNotification, isSupported } = useServiceWorker();
  const processedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!userId) return;
    const uid = userId;

    function checkAndNotify() {
      const now = new Date();
      const processed = processedRef.current;

      // ─── Event Reminders (15 min before) ─────────────
      events.forEach((event) => {
        const reminderMinutes = event.reminderMinutes ?? 15;
        const startTime = event.startDate.getTime();
        const reminderTime = startTime - reminderMinutes * 60 * 1000;
        const diff = reminderTime - now.getTime();

        // If reminder time is within the next 60s window (or just passed within last 30s)
        const key = `event_${event.id}_${event.startDate.toISOString().slice(0, 16)}`;
        if (diff > -30_000 && diff < 60_000 && !processed.has(key)) {
          processed.add(key);

          const minutesUntil = Math.round((startTime - now.getTime()) / 60_000);
          const timeLabel = minutesUntil <= 1 ? 'ahora' : `en ${minutesUntil} minutos`;
          const title = `⏰ ${event.title}`;
          const body = `Comienza ${timeLabel}${event.location ? ` — ${event.location}` : ''}`;

          // Save to Firestore
          add(uid, {
            type: 'event_reminder',
            title,
            body,
            actionUrl: '/dashboard/calendar',
            referenceId: event.id,
          });

          // Native browser notification
          if (isSupported) {
            showLocalNotification({
              title,
              body,
              url: '/dashboard/calendar',
            });
          }
        }
      });

      // ─── Tasks Due Today ─────────────────────────────
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

      tasks.forEach((task) => {
        if (!task.dueDate || task.status === 'completed' || task.status === 'cancelled') return;

        const dueTime = task.dueDate.getTime();
        const key = `task_${task.id}_${task.dueDate.toISOString().slice(0, 10)}`;

        // Task is overdue (due date passed)
        if (dueTime < todayStart.getTime() && !processed.has(`overdue_${key}`)) {
          processed.add(`overdue_${key}`);

          add(uid, {
            type: 'task_overdue',
            title: `🔴 Tarea vencida: ${task.title}`,
            body: `Esta tarea venció hace ${Math.ceil((now.getTime() - dueTime) / (1000 * 60 * 60 * 24))} día(s). Prioridad: ${task.priority}`,
            actionUrl: '/dashboard/tasks',
            referenceId: task.id,
          });
        }

        // Task is due today and it's after 9 AM (notify once per day)
        if (dueTime >= todayStart.getTime() && dueTime < todayEnd.getTime() && now.getHours() >= 9 && !processed.has(key)) {
          processed.add(key);

          add(uid, {
            type: 'task_due',
            title: `📋 Tarea para hoy: ${task.title}`,
            body: task.priority === 'urgent' || task.priority === 'high'
              ? `Prioridad ${task.priority === 'urgent' ? 'urgente' : 'alta'} — no la dejes para después`
              : `Recuerda completar esta tarea hoy`,
            actionUrl: '/dashboard/tasks',
            referenceId: task.id,
          });

          // Native notification for high/urgent tasks
          if (isSupported && (task.priority === 'urgent' || task.priority === 'high')) {
            showLocalNotification({
              title: `📋 Tarea para hoy: ${task.title}`,
              body: `Prioridad ${task.priority === 'urgent' ? 'urgente' : 'alta'}`,
              url: '/dashboard/tasks',
            });
          }
        }
      });

      // Clean old keys from processed (older than 24h)
      // Simple cleanup: reset processed set every 24h
      if (processed.size > 500) {
        processed.clear();
      }
    }

    // Initial check
    checkAndNotify();

    // Run every 60 seconds
    const interval = setInterval(checkAndNotify, 60_000);

    return () => clearInterval(interval);
  }, [userId, events, tasks, add, showLocalNotification, isSupported]);
}
