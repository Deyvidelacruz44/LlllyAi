import { create } from 'zustand';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc,
  doc, Timestamp, orderBy, limit, onSnapshot, writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';

// ─── Types ───────────────────────────────────────────────────

export type NotificationType = 'event_reminder' | 'task_due' | 'task_overdue' | 'finance_alert' | 'system' | 'ai_insight';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  icon?: string;
  read: boolean;
  /** Route to navigate to when clicked */
  actionUrl?: string;
  /** Related entity ID (eventId, taskId, etc.) */
  referenceId?: string;
  createdAt: Date;
}

interface NotificationsState {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  _userId: string | null;
  _unsubscribe: Unsubscribe | null;

  /** Subscribe to real-time notifications from Firestore */
  subscribe: (userId: string) => void;
  /** Unsubscribe */
  unsubscribe: () => void;
  /** Add a notification (saves to Firestore) */
  add: (userId: string, notification: Omit<AppNotification, 'id' | 'userId' | 'read' | 'createdAt'>) => Promise<string>;
  /** Mark one notification as read */
  markRead: (notificationId: string) => Promise<void>;
  /** Mark all notifications as read */
  markAllRead: () => Promise<void>;
  /** Delete a single notification */
  remove: (notificationId: string) => Promise<void>;
  /** Clear all read notifications */
  clearRead: () => Promise<void>;
  /** Reset store (on logout) */
  reset: () => void;
}

function parseNotificationDoc(docSnap: { id: string; data: () => Record<string, unknown> }): AppNotification {
  const data = docSnap.data() as Record<string, unknown>;
  return {
    id: docSnap.id,
    userId: data.userId as string,
    type: data.type as NotificationType,
    title: data.title as string,
    body: data.body as string,
    icon: data.icon as string | undefined,
    read: data.read as boolean,
    actionUrl: data.actionUrl as string | undefined,
    referenceId: data.referenceId as string | undefined,
    createdAt: (data.createdAt as Timestamp)?.toDate?.() || new Date(),
  };
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: true,
  _userId: null,
  _unsubscribe: null,

  subscribe(userId: string) {
    const current = get();
    // Already subscribed for this user
    if (current._userId === userId && current._unsubscribe) return;
    // Clean up previous
    current._unsubscribe?.();

    const ref = collection(db, 'notifications');
    const q = query(
      ref,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(100),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(parseNotificationDoc);
      const unreadCount = notifications.filter((n) => !n.read).length;
      set({ notifications, unreadCount, loading: false });
    }, (error) => {
      console.error('[NotificationsStore] Snapshot error:', error);
      set({ loading: false });
    });

    set({ _userId: userId, _unsubscribe: unsubscribe });
  },

  unsubscribe() {
    get()._unsubscribe?.();
    set({ _unsubscribe: null, _userId: null });
  },

  async add(userId, notification) {
    // Deduplicate: skip if same referenceId + type exists within last 5 minutes
    if (notification.referenceId) {
      const existing = get().notifications.find(
        (n) =>
          n.referenceId === notification.referenceId &&
          n.type === notification.type &&
          Date.now() - n.createdAt.getTime() < 5 * 60 * 1000,
      );
      if (existing) return existing.id;
    }

    const docRef = await addDoc(collection(db, 'notifications'), {
      userId,
      ...notification,
      read: false,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  async markRead(notificationId) {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  },

  async markAllRead() {
    const unread = get().notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.forEach((n) => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  },

  async remove(notificationId) {
    await deleteDoc(doc(db, 'notifications', notificationId));
  },

  async clearRead() {
    const read = get().notifications.filter((n) => n.read);
    if (read.length === 0) return;

    const batch = writeBatch(db);
    read.forEach((n) => {
      batch.delete(doc(db, 'notifications', n.id));
    });
    await batch.commit();
  },

  reset() {
    get()._unsubscribe?.();
    set({
      notifications: [],
      unreadCount: 0,
      loading: true,
      _userId: null,
      _unsubscribe: null,
    });
  },
}));
