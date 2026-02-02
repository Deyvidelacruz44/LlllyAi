'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  Timestamp,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
  QueryConstraint
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Event, Task } from '@/types';

// Cache simple en memoria
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}

function invalidateCache(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

// Hook para eventos
export function useEvents(selectedDate?: Date) {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const loadEvents = useCallback(async (useCache = true) => {
    if (!user) return;
    
    const cacheKey = `events-${user.uid}`;
    
    if (useCache) {
      const cached = getCached<Event[]>(cacheKey);
      if (cached) {
        setEvents(cached);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const eventsRef = collection(db, 'events');
      const constraints: QueryConstraint[] = [
        where('userId', '==', user.uid),
        orderBy('startDate', 'asc'),
      ];
      
      const q = query(eventsRef, ...constraints);
      const snapshot = await getDocs(q);
      
      const eventsData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startDate: data.startDate.toDate(),
          endDate: data.endDate.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as Event;
      });
      
      setEvents(eventsData);
      setCache(cacheKey, eventsData);
      setError(null);
    } catch (err: any) {
      console.error('Error loading events:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Suscripción en tiempo real
  const subscribeToEvents = useCallback(() => {
    if (!user) return;

    const eventsRef = collection(db, 'events');
    const q = query(
      eventsRef,
      where('userId', '==', user.uid),
      orderBy('startDate', 'asc')
    );

    unsubscribeRef.current = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startDate: data.startDate.toDate(),
          endDate: data.endDate.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as Event;
      });
      
      setEvents(eventsData);
      setCache(`events-${user.uid}`, eventsData);
      setLoading(false);
    }, (err) => {
      console.error('Error in events subscription:', err);
      setError(err.message);
    });
  }, [user]);

  useEffect(() => {
    loadEvents();
    
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [loadEvents]);

  const createEvent = useCallback(async (eventData: Partial<Event>) => {
    if (!user) throw new Error('Usuario no autenticado');

    const newEvent = {
      userId: user.uid,
      title: eventData.title || '',
      description: eventData.description || '',
      type: eventData.type || 'personal',
      startDate: Timestamp.fromDate(eventData.startDate || new Date()),
      endDate: Timestamp.fromDate(eventData.endDate || new Date()),
      location: eventData.location || '',
      category: eventData.category || 'general',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'events'), newEvent);
    invalidateCache(`events-${user.uid}`);
    await loadEvents(false);
    return docRef.id;
  }, [user, loadEvents]);

  const updateEvent = useCallback(async (eventId: string, eventData: Partial<Event>) => {
    if (!user) throw new Error('Usuario no autenticado');

    const updateData: any = {
      ...eventData,
      updatedAt: Timestamp.now(),
    };

    if (eventData.startDate) {
      updateData.startDate = Timestamp.fromDate(eventData.startDate);
    }
    if (eventData.endDate) {
      updateData.endDate = Timestamp.fromDate(eventData.endDate);
    }

    await updateDoc(doc(db, 'events', eventId), updateData);
    invalidateCache(`events-${user.uid}`);
    await loadEvents(false);
  }, [user, loadEvents]);

  const deleteEvent = useCallback(async (eventId: string) => {
    if (!user) throw new Error('Usuario no autenticado');

    await deleteDoc(doc(db, 'events', eventId));
    invalidateCache(`events-${user.uid}`);
    await loadEvents(false);
  }, [user, loadEvents]);

  return {
    events,
    loading,
    error,
    loadEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    subscribeToEvents,
  };
}

// Hook para tareas
export function useTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async (useCache = true) => {
    if (!user) return;

    const cacheKey = `tasks-${user.uid}`;

    if (useCache) {
      const cached = getCached<Task[]>(cacheKey);
      if (cached) {
        setTasks(cached);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      const tasksRef = collection(db, 'tasks');
      const q = query(
        tasksRef,
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const tasksData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dueDate: data.dueDate?.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
          completedAt: data.completedAt?.toDate(),
        } as Task;
      });

      setTasks(tasksData);
      setCache(cacheKey, tasksData);
      setError(null);
    } catch (err: any) {
      console.error('Error loading tasks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const createTask = useCallback(async (taskData: Partial<Task>) => {
    if (!user) throw new Error('Usuario no autenticado');

    const newTask = {
      userId: user.uid,
      title: taskData.title || '',
      description: taskData.description || '',
      status: taskData.status || 'pending',
      priority: taskData.priority || 'medium',
      category: taskData.category || 'general',
      dueDate: taskData.dueDate ? Timestamp.fromDate(taskData.dueDate) : null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'tasks'), newTask);
    invalidateCache(`tasks-${user.uid}`);
    await loadTasks(false);
    return docRef.id;
  }, [user, loadTasks]);

  const updateTask = useCallback(async (taskId: string, taskData: Partial<Task>) => {
    if (!user) throw new Error('Usuario no autenticado');

    const updateData: any = {
      ...taskData,
      updatedAt: Timestamp.now(),
    };

    if (taskData.dueDate) {
      updateData.dueDate = Timestamp.fromDate(taskData.dueDate);
    }
    if (taskData.status === 'completed') {
      updateData.completedAt = Timestamp.now();
    }

    await updateDoc(doc(db, 'tasks', taskId), updateData);
    invalidateCache(`tasks-${user.uid}`);
    await loadTasks(false);
  }, [user, loadTasks]);

  const deleteTask = useCallback(async (taskId: string) => {
    if (!user) throw new Error('Usuario no autenticado');

    await deleteDoc(doc(db, 'tasks', taskId));
    invalidateCache(`tasks-${user.uid}`);
    await loadTasks(false);
  }, [user, loadTasks]);

  const toggleTaskStatus = useCallback(async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await updateTask(task.id, { status: newStatus });
  }, [updateTask]);

  // Estadísticas
  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    inProgress: tasks.filter((t) => t.status === 'in-progress').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    urgent: tasks.filter((t) => t.priority === 'urgent' && t.status !== 'completed').length,
  };

  return {
    tasks,
    loading,
    error,
    stats,
    loadTasks,
    createTask,
    updateTask,
    deleteTask,
    toggleTaskStatus,
  };
}

// Hook para búsqueda global
export function useSearch() {
  const { user } = useAuth();
  const [results, setResults] = useState<{ events: Event[]; tasks: Task[] }>({ events: [], tasks: [] });
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (searchTerm: string) => {
    if (!user || !searchTerm.trim()) {
      setResults({ events: [], tasks: [] });
      return;
    }

    setLoading(true);
    try {
      const term = searchTerm.toLowerCase();

      // Buscar en caché primero
      const cachedEvents = getCached<Event[]>(`events-${user.uid}`) || [];
      const cachedTasks = getCached<Task[]>(`tasks-${user.uid}`) || [];

      const filteredEvents = cachedEvents.filter(
        (e) =>
          e.title.toLowerCase().includes(term) ||
          e.description?.toLowerCase().includes(term) ||
          e.location?.toLowerCase().includes(term)
      );

      const filteredTasks = cachedTasks.filter(
        (t) =>
          t.title.toLowerCase().includes(term) ||
          t.description?.toLowerCase().includes(term)
      );

      setResults({ events: filteredEvents, tasks: filteredTasks });
    } catch (err) {
      console.error('Error searching:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  return { results, loading, search };
}
