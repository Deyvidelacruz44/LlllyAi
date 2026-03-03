import { create } from 'zustand';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc,
  doc, Timestamp, orderBy,
} from 'firebase/firestore';
import { Task } from '@/types';

interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  _userId: string | null;

  load: (userId: string) => Promise<void>;
  create: (userId: string, data: Partial<Task>) => Promise<string>;
  update: (taskId: string, data: Partial<Task>) => Promise<void>;
  remove: (taskId: string) => Promise<void>;
  toggleStatus: (task: Task) => Promise<void>;
  reset: () => void;
}

function parseTaskDoc(docSnap: any): Task {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    dueDate: data.dueDate?.toDate?.() || undefined,
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
    completedAt: data.completedAt?.toDate?.() || undefined,
  } as Task;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  loading: true,
  error: null,
  _userId: null,

  load: async (userId) => {
    if (get()._userId === userId && get().tasks.length > 0) return;
    set({ loading: true, _userId: userId });
    try {
      const ref = collection(db, 'tasks');
      const q = query(ref, where('userId', '==', userId), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const tasks = snapshot.docs.map(parseTaskDoc);
      set({ tasks, loading: false, error: null });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  create: async (userId, data) => {
    const newTask = {
      userId,
      title: data.title || '',
      description: data.description || '',
      status: data.status || 'pending',
      priority: data.priority || 'medium',
      category: data.category || 'general',
      dueDate: data.dueDate ? Timestamp.fromDate(data.dueDate) : null,
      tags: data.tags || [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, 'tasks'), newTask);
    const created: Task = {
      ...newTask,
      id: docRef.id,
      dueDate: data.dueDate,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Task;
    set((s) => ({ tasks: [created, ...s.tasks] }));
    return docRef.id;
  },

  update: async (taskId, data) => {
    const updateData: any = { ...data, updatedAt: Timestamp.now() };
    if (data.dueDate) updateData.dueDate = Timestamp.fromDate(data.dueDate);
    if (data.status === 'completed') updateData.completedAt = Timestamp.now();
    delete updateData.id;
    await updateDoc(doc(db, 'tasks', taskId), updateData);
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? { ...t, ...data, updatedAt: new Date(), ...(data.status === 'completed' ? { completedAt: new Date() } : {}) }
          : t,
      ),
    }));
  },

  remove: async (taskId) => {
    await deleteDoc(doc(db, 'tasks', taskId));
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) }));
  },

  toggleStatus: async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await get().update(task.id, { status: newStatus });
  },

  reset: () => {
    set({ tasks: [], loading: true, error: null, _userId: null });
  },
}));
