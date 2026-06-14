/**
 * Cron endpoint — Scheduled reminders.
 * Triggered by a Netlify Scheduled Function every few minutes.
 *
 * Scans Firestore (via Admin SDK) for:
 *   - Events whose reminder time has arrived (reminderMinutes before start)
 *   - Tasks with a timed due date approaching (30 min before)
 *   - Tasks that just became overdue (once)
 * and sends an FCM push to the owner. A `reminders_sent` collection
 * deduplicates so each reminder fires only once.
 *
 * Protected by the CRON_SECRET header.
 */
import { NextResponse } from 'next/server';
import { getAdminDb, isAdminAvailable } from '@/lib/firebase-admin';
import { sendPushToUser } from '@/lib/fcm-server';
import { Timestamp } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_EVENT_REMINDER_MIN = 15;
const TASK_REMINDER_MIN = 30;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // Must be configured
  const header = request.headers.get('x-cron-secret') || request.headers.get('authorization');
  return header === secret || header === `Bearer ${secret}`;
}

/** Returns true if this reminder was already sent (and records it if not). */
async function alreadySent(db: FirebaseFirestore.Firestore, key: string): Promise<boolean> {
  const ref = db.collection('reminders_sent').doc(key);
  const snap = await ref.get();
  if (snap.exists) return true;
  await ref.set({
    sentAt: Timestamp.now(),
    // Auto-expire helper: store an expiry the cleanup can use later
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 3 * DAY_MS)),
  });
  return false;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminAvailable()) {
    return NextResponse.json({ error: 'Admin SDK not configured' }, { status: 503 });
  }

  const db = getAdminDb();
  const now = new Date();
  const summary = { eventsSent: 0, tasksSent: 0, overdueSent: 0, errors: 0 };

  // ── Event reminders ───────────────────────────────────────────────
  try {
    const eventsSnap = await db
      .collection('events')
      .where('startDate', '>=', Timestamp.fromDate(now))
      .where('startDate', '<=', Timestamp.fromDate(new Date(now.getTime() + DAY_MS)))
      .get();

    for (const doc of eventsSnap.docs) {
      const data = doc.data();
      const start = (data.startDate as Timestamp)?.toDate?.();
      if (!start || !data.userId) continue;

      const reminderMin = typeof data.reminderMinutes === 'number' ? data.reminderMinutes : DEFAULT_EVENT_REMINDER_MIN;
      const reminderTime = start.getTime() - reminderMin * 60 * 1000;

      // Fire once the reminder time has passed but the event hasn't started
      if (now.getTime() >= reminderTime && now.getTime() < start.getTime()) {
        const key = `evt_${doc.id}_${start.toISOString().slice(0, 16)}`;
        if (await alreadySent(db, key)) continue;

        const minsUntil = Math.max(1, Math.round((start.getTime() - now.getTime()) / 60000));
        const timeLabel = minsUntil <= 1 ? 'ahora' : `en ${minsUntil} min`;
        try {
          await sendPushToUser(data.userId, {
            title: `⏰ ${data.title || 'Evento'}`,
            body: `Comienza ${timeLabel}${data.location ? ` — ${data.location}` : ''}`,
            url: '/dashboard/calendar',
            type: 'event_reminder',
            referenceId: doc.id,
          });
          summary.eventsSent++;
        } catch { summary.errors++; }
      }
    }
  } catch (err) {
    console.error('[cron/reminders] events error:', err);
    summary.errors++;
  }

  // ── Task reminders (timed due date + overdue) ─────────────────────
  try {
    const tasksSnap = await db
      .collection('tasks')
      .where('dueDate', '>=', Timestamp.fromDate(new Date(now.getTime() - DAY_MS)))
      .where('dueDate', '<=', Timestamp.fromDate(new Date(now.getTime() + DAY_MS)))
      .get();

    for (const doc of tasksSnap.docs) {
      const data = doc.data();
      const due = (data.dueDate as Timestamp)?.toDate?.();
      if (!due || !data.userId) continue;
      if (data.status === 'completed' || data.status === 'cancelled') continue;

      const isMidnight = due.getHours() === 0 && due.getMinutes() === 0;

      // Overdue: fires once when the task passes its due time
      if (due.getTime() < now.getTime()) {
        const key = `taskover_${doc.id}_${due.toISOString().slice(0, 10)}`;
        if (await alreadySent(db, key)) continue;
        try {
          await sendPushToUser(data.userId, {
            title: `🔴 Tarea vencida: ${data.title || 'Tarea'}`,
            body: `Esta tarea ya pasó su fecha. Prioridad: ${data.priority || 'media'}`,
            url: '/dashboard/tasks',
            type: 'task_overdue',
            referenceId: doc.id,
          });
          summary.overdueSent++;
        } catch { summary.errors++; }
        continue;
      }

      // Timed due date approaching → remind TASK_REMINDER_MIN before.
      // Date-only (midnight) tasks are handled by the daily brief (Fase 2), skip here.
      if (!isMidnight) {
        const reminderTime = due.getTime() - TASK_REMINDER_MIN * 60 * 1000;
        if (now.getTime() >= reminderTime) {
          const key = `task_${doc.id}_${due.toISOString().slice(0, 16)}`;
          if (await alreadySent(db, key)) continue;
          const minsUntil = Math.max(1, Math.round((due.getTime() - now.getTime()) / 60000));
          try {
            await sendPushToUser(data.userId, {
              title: `📋 ${data.title || 'Tarea'}`,
              body: `Vence en ${minsUntil} min`,
              url: '/dashboard/tasks',
              type: 'task_due',
              referenceId: doc.id,
            });
            summary.tasksSent++;
          } catch { summary.errors++; }
        }
      }
    }
  } catch (err) {
    console.error('[cron/reminders] tasks error:', err);
    summary.errors++;
  }

  return NextResponse.json({ ok: true, ranAt: now.toISOString(), ...summary });
}
