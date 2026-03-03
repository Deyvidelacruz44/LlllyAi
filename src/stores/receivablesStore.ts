import { create } from 'zustand';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc,
  doc, Timestamp,
} from 'firebase/firestore';
import { Receivable, ReceivablePaymentRecord } from '@/types';

function parseReceivableDoc(docSnap: any): Receivable {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    ...d,
    dueDate: d.dueDate?.toDate?.() || undefined,
    createdAt: d.createdAt?.toDate?.() || new Date(),
    updatedAt: d.updatedAt?.toDate?.() || new Date(),
    payments: (d.payments || []).map((p: any) => ({
      ...p,
      date: p.date?.toDate?.() || new Date(),
    })),
    reminders: (d.reminders || []).map((r: any) => r?.toDate?.() || new Date()),
  } as Receivable;
}

interface ReceivablesState {
  receivables: Receivable[];
  loading: boolean;
  error: string | null;
  _userId: string | null;

  load: (userId: string) => Promise<void>;
  create: (userId: string, data: Partial<Receivable>) => Promise<string>;
  update: (recId: string, data: Partial<Receivable>) => Promise<void>;
  remove: (recId: string) => Promise<void>;
  addPayment: (recId: string, payment: ReceivablePaymentRecord) => Promise<void>;
  reset: () => void;
}

export const useReceivablesStore = create<ReceivablesState>((set, get) => ({
  receivables: [],
  loading: true,
  error: null,
  _userId: null,

  load: async (userId) => {
    if (get()._userId === userId && get().receivables.length > 0) return;
    set({ loading: true, _userId: userId });
    try {
      const ref = collection(db, 'receivables');
      const q = query(ref, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      const receivables = snapshot.docs.map(parseReceivableDoc);
      set({ receivables, loading: false, error: null });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  create: async (userId, data) => {
    const newRec: any = {
      userId,
      debtorName: data.debtorName || '',
      debtorContact: data.debtorContact || '',
      description: data.description || '',
      totalAmount: data.totalAmount || 0,
      amountPaid: data.amountPaid || 0,
      dueDate: data.dueDate ? Timestamp.fromDate(data.dueDate) : null,
      status: data.status || 'pending',
      category: data.category || '',
      notes: data.notes || '',
      payments: [],
      reminders: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, 'receivables'), newRec);
    const created = { ...data, id: docRef.id, payments: [], reminders: [], createdAt: new Date(), updatedAt: new Date() } as Receivable;
    set((s) => ({ receivables: [...s.receivables, created] }));
    return docRef.id;
  },

  update: async (recId, data) => {
    const updateData: any = { ...data, updatedAt: Timestamp.now() };
    if (data.dueDate) updateData.dueDate = Timestamp.fromDate(data.dueDate);
    delete updateData.id;
    await updateDoc(doc(db, 'receivables', recId), updateData);
    set((s) => ({
      receivables: s.receivables.map((r) => (r.id === recId ? { ...r, ...data, updatedAt: new Date() } : r)),
    }));
  },

  remove: async (recId) => {
    await deleteDoc(doc(db, 'receivables', recId));
    set((s) => ({ receivables: s.receivables.filter((r) => r.id !== recId) }));
  },

  addPayment: async (recId, payment) => {
    const rec = get().receivables.find((r) => r.id === recId);
    if (!rec) return;
    const payments = [...(rec.payments || []), payment];
    const amountPaid = (rec.amountPaid || 0) + payment.amount;
    const status = amountPaid >= rec.totalAmount ? 'paid' : 'partial';
    const updateData: any = {
      payments: payments.map((p) => ({
        ...p,
        date: p.date instanceof Date ? Timestamp.fromDate(p.date) : p.date,
      })),
      amountPaid,
      status,
      updatedAt: Timestamp.now(),
    };
    await updateDoc(doc(db, 'receivables', recId), updateData);
    set((s) => ({
      receivables: s.receivables.map((r) =>
        r.id === recId ? { ...r, payments, amountPaid, status, updatedAt: new Date() } : r,
      ),
    }));
  },

  reset: () => {
    set({ receivables: [], loading: true, error: null, _userId: null });
  },
}));
