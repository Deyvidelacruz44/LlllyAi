import { create } from 'zustand';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc,
  doc, Timestamp,
} from 'firebase/firestore';
import { Debt, DebtPayment } from '@/types';

function parseDebtDoc(docSnap: any): Debt {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    ...d,
    startDate: d.startDate?.toDate?.() || new Date(),
    endDate: d.endDate?.toDate?.() || undefined,
    nextDueDate: d.nextDueDate?.toDate?.() || undefined,
    lastPaidDate: d.lastPaidDate?.toDate?.() || undefined,
    createdAt: d.createdAt?.toDate?.() || new Date(),
    updatedAt: d.updatedAt?.toDate?.() || new Date(),
    payments: (d.payments || []).map((p: any) => ({
      ...p,
      date: p.date?.toDate?.() || new Date(),
    })),
  } as Debt;
}

interface DebtsState {
  debts: Debt[];
  loading: boolean;
  error: string | null;
  _userId: string | null;

  load: (userId: string) => Promise<void>;
  create: (userId: string, data: Partial<Debt>) => Promise<string>;
  update: (debtId: string, data: Partial<Debt>) => Promise<void>;
  remove: (debtId: string) => Promise<void>;
  addPayment: (debtId: string, payment: DebtPayment) => Promise<void>;
  reset: () => void;
}

export const useDebtsStore = create<DebtsState>((set, get) => ({
  debts: [],
  loading: true,
  error: null,
  _userId: null,

  load: async (userId) => {
    if (get()._userId === userId && get().debts.length > 0) return;
    set({ loading: true, _userId: userId });
    try {
      const ref = collection(db, 'debts');
      const q = query(ref, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      const debts = snapshot.docs.map(parseDebtDoc);
      set({ debts, loading: false, error: null });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  create: async (userId, data) => {
    const newDebt: any = {
      userId,
      type: data.type || 'debt',
      category: data.category || 'otro_fijo',
      name: data.name || '',
      description: data.description || '',
      amount: data.amount || 0,
      totalDebt: data.totalDebt || 0,
      totalPaid: data.totalPaid || 0,
      frequency: data.frequency || 'monthly',
      dueDay: data.dueDay || null,
      nextDueDate: data.nextDueDate ? Timestamp.fromDate(data.nextDueDate) : null,
      startDate: data.startDate ? Timestamp.fromDate(data.startDate) : Timestamp.now(),
      endDate: data.endDate ? Timestamp.fromDate(data.endDate) : null,
      status: data.status || 'active',
      creditor: data.creditor || '',
      interestRate: data.interestRate || null,
      notes: data.notes || '',
      lastPaidDate: null,
      payments: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, 'debts'), newDebt);
    const created = { ...data, id: docRef.id, payments: [], createdAt: new Date(), updatedAt: new Date() } as Debt;
    set((s) => ({ debts: [...s.debts, created] }));
    return docRef.id;
  },

  update: async (debtId, data) => {
    const updateData: any = { ...data, updatedAt: Timestamp.now() };
    if (data.startDate) updateData.startDate = Timestamp.fromDate(data.startDate);
    if (data.endDate) updateData.endDate = Timestamp.fromDate(data.endDate);
    if (data.nextDueDate) updateData.nextDueDate = Timestamp.fromDate(data.nextDueDate);
    if (data.lastPaidDate) updateData.lastPaidDate = Timestamp.fromDate(data.lastPaidDate);
    delete updateData.id;
    await updateDoc(doc(db, 'debts', debtId), updateData);
    set((s) => ({
      debts: s.debts.map((d) => (d.id === debtId ? { ...d, ...data, updatedAt: new Date() } : d)),
    }));
  },

  remove: async (debtId) => {
    await deleteDoc(doc(db, 'debts', debtId));
    set((s) => ({ debts: s.debts.filter((d) => d.id !== debtId) }));
  },

  addPayment: async (debtId, payment) => {
    const debt = get().debts.find((d) => d.id === debtId);
    if (!debt) return;
    const payments = [...(debt.payments || []), payment];
    const totalPaid = (debt.totalPaid || 0) + payment.amount;
    const updateData: any = {
      payments: payments.map((p) => ({
        ...p,
        date: p.date instanceof Date ? Timestamp.fromDate(p.date) : p.date,
      })),
      totalPaid,
      lastPaidDate: Timestamp.fromDate(payment.date),
      updatedAt: Timestamp.now(),
    };
    await updateDoc(doc(db, 'debts', debtId), updateData);
    set((s) => ({
      debts: s.debts.map((d) =>
        d.id === debtId ? { ...d, payments, totalPaid, lastPaidDate: payment.date, updatedAt: new Date() } : d,
      ),
    }));
  },

  reset: () => {
    set({ debts: [], loading: true, error: null, _userId: null });
  },
}));
