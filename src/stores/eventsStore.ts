import { create } from 'zustand';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc,
  doc, Timestamp, orderBy, onSnapshot, Unsubscribe,
} from 'firebase/firestore';
import { Event } from '@/types';

interface EventsState {
  events: Event[];
  loading: boolean;
  error: string | null;
  _userId: string | null;
  _unsubscribe: Unsubscribe | null;

  /** Load all events for the given user (with optional cache) */
  load: (userId: string) => Promise<void>;
  /** Subscribe to real-time changes */
  subscribe: (userId: string) => void;
  /** Unsubscribe from real-time changes */
  unsubscribe: () => void;
  /** Create a new event */
  create: (userId: string, data: Partial<Event>) => Promise<string>;
  /** Update an existing event */
  update: (eventId: string, data: Partial<Event>) => Promise<void>;
  /** Delete an event */
  remove: (eventId: string) => Promise<void>;
  /** Reset store (on logout) */
  reset: () => void;
}

function parseEventDoc(docSnap: any): Event {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    startDate: data.startDate?.toDate?.() || new Date(),
    endDate: data.endDate?.toDate?.() || new Date(),
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
  } as Event;
}

export const useEventsStore = create<EventsState>((set, get) => ({
  events: [],
  loading: true,
  error: null,
  _userId: null,
  _unsubscribe: null,

  load: async (userId) => {
    if (get()._userId === userId && get().events.length > 0) {
      return; // Already loaded
    }
    set({ loading: true, _userId: userId });
    try {
      const ref = collection(db, 'events');
      const q = query(ref, where('userId', '==', userId), orderBy('startDate', 'asc'));
      const snapshot = await getDocs(q);
      const events = snapshot.docs.map(parseEventDoc);
      set({ events, loading: false, error: null });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  subscribe: (userId) => {
    const state = get();
    if (state._unsubscribe) state._unsubscribe();

    const ref = collection(db, 'events');
    const q = query(ref, where('userId', '==', userId), orderBy('startDate', 'asc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const events = snapshot.docs.map(parseEventDoc);
        set({ events, loading: false, error: null, _userId: userId });
      },
      (err) => set({ error: err.message }),
    );
    set({ _unsubscribe: unsub, _userId: userId });
  },

  unsubscribe: () => {
    const unsub = get()._unsubscribe;
    if (unsub) unsub();
    set({ _unsubscribe: null });
  },

  create: async (userId, data) => {
    const newEvent = {
      userId,
      title: data.title || '',
      description: data.description || '',
      type: data.type || 'personal',
      startDate: Timestamp.fromDate(data.startDate || new Date()),
      endDate: Timestamp.fromDate(data.endDate || new Date()),
      location: data.location || '',
      category: data.category || 'general',
      reminderMinutes: data.reminderMinutes || null,
      tags: data.tags || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, 'events'), newEvent);
    // Optimistic: add to local state
    const created: Event = {
      ...newEvent,
      id: docRef.id,
      startDate: data.startDate || new Date(),
      endDate: data.endDate || new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Event;
    set((s) => ({ events: [...s.events, created].sort((a, b) => a.startDate.getTime() - b.startDate.getTime()) }));
    return docRef.id;
  },

  update: async (eventId, data) => {
    const updateData: any = { ...data, updatedAt: Timestamp.now() };
    if (data.startDate) updateData.startDate = Timestamp.fromDate(data.startDate);
    if (data.endDate) updateData.endDate = Timestamp.fromDate(data.endDate);
    delete updateData.id;
    await updateDoc(doc(db, 'events', eventId), updateData);
    set((s) => ({
      events: s.events.map((e) =>
        e.id === eventId ? { ...e, ...data, updatedAt: new Date() } : e,
      ),
    }));
  },

  remove: async (eventId) => {
    await deleteDoc(doc(db, 'events', eventId));
    set((s) => ({ events: s.events.filter((e) => e.id !== eventId) }));
  },

  reset: () => {
    const unsub = get()._unsubscribe;
    if (unsub) unsub();
    set({ events: [], loading: true, error: null, _userId: null, _unsubscribe: null });
  },
}));
