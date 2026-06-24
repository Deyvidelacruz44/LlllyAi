import { create } from 'zustand';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs, addDoc, updateDoc, deleteDoc,
  doc, Timestamp,
} from 'firebase/firestore';
import { Transaction, TransactionType, TransactionCategory, Budget } from '@/types';

// ─── Helpers ───
function parseTxDoc(docSnap: any): Transaction {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    ...d,
    date: d.date?.toDate?.() || new Date(),
    createdAt: d.createdAt?.toDate?.() || new Date(),
    updatedAt: d.updatedAt?.toDate?.() || new Date(),
  } as Transaction;
}

function parseBudgetDoc(docSnap: any): Budget {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    ...d,
    startDate: d.startDate?.toDate?.() || new Date(),
    endDate: d.endDate?.toDate?.() || undefined,
    createdAt: d.createdAt?.toDate?.() || new Date(),
    updatedAt: d.updatedAt?.toDate?.() || new Date(),
  } as Budget;
}

// ─── Store ───
interface FinancesState {
  transactions: Transaction[];
  budgets: Budget[];
  loading: boolean;
  error: string | null;
  _userId: string | null;

  loadTransactions: (userId: string) => Promise<void>;
  loadBudgets: (userId: string) => Promise<void>;
  loadAll: (userId: string) => Promise<void>;

  createTransaction: (userId: string, data: Partial<Transaction>) => Promise<string>;
  updateTransaction: (txId: string, data: Partial<Transaction>) => Promise<void>;
  removeTransaction: (txId: string) => Promise<void>;

  createBudget: (userId: string, data: Partial<Budget>) => Promise<string>;
  updateBudget: (budgetId: string, data: Partial<Budget>) => Promise<void>;
  removeBudget: (budgetId: string) => Promise<void>;

  reset: () => void;
}

export const useFinancesStore = create<FinancesState>((set, get) => ({
  transactions: [],
  budgets: [],
  loading: true,
  error: null,
  _userId: null,

  loadTransactions: async (userId) => {
    set({ loading: true, _userId: userId });
    try {
      const ref = collection(db, 'transactions');
      const q = query(ref, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      const transactions = snapshot.docs.map(parseTxDoc).filter(t => !t.archived);
      transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
      set({ transactions, loading: false, error: null });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  loadBudgets: async (userId) => {
    try {
      const ref = collection(db, 'budgets');
      const q = query(ref, where('userId', '==', userId));
      const snapshot = await getDocs(q);
      const budgets = snapshot.docs.map(parseBudgetDoc);
      set({ budgets });
    } catch (err: any) {
      console.error('Error loading budgets:', err);
    }
  },

  loadAll: async (userId) => {
    if (get()._userId === userId && get().transactions.length > 0) return;
    set({ loading: true, _userId: userId });
    await Promise.all([get().loadTransactions(userId), get().loadBudgets(userId)]);
  },

  // ── Transactions ──
  createTransaction: async (userId, data) => {
    const newTx = {
      userId,
      type: data.type || 'expense',
      category: data.category || 'otro',
      amount: data.amount || 0,
      currency: data.currency || 'DOP',
      description: data.description || '',
      date: data.date ? Timestamp.fromDate(data.date) : Timestamp.now(),
      account: data.account || '',
      tags: data.tags || [],
      isRecurring: data.isRecurring || false,
      recurringFrequency: data.recurringFrequency || 'monthly',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, 'transactions'), newTx);
    const created: Transaction = {
      ...newTx,
      id: docRef.id,
      date: data.date || new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Transaction;
    set((s) => ({ transactions: [created, ...s.transactions] }));
    return docRef.id;
  },

  updateTransaction: async (txId, data) => {
    const updateData: any = { ...data, updatedAt: Timestamp.now() };
    if (data.date) updateData.date = Timestamp.fromDate(data.date);
    delete updateData.id;
    await updateDoc(doc(db, 'transactions', txId), updateData);
    set((s) => ({
      transactions: s.transactions.map((t) =>
        t.id === txId ? { ...t, ...data, updatedAt: new Date() } : t,
      ),
    }));
  },

  removeTransaction: async (txId) => {
    await deleteDoc(doc(db, 'transactions', txId));
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== txId) }));
  },

  // ── Budgets ──
  createBudget: async (userId, data) => {
    const newBudget = {
      userId,
      category: data.category || 'otro',
      amount: data.amount || 0,
      period: data.period || 'monthly',
      startDate: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    const docRef = await addDoc(collection(db, 'budgets'), newBudget);
    const created: Budget = {
      ...newBudget,
      id: docRef.id,
      startDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Budget;
    set((s) => ({ budgets: [...s.budgets, created] }));
    return docRef.id;
  },

  updateBudget: async (budgetId, data) => {
    const updateData: any = { ...data, updatedAt: Timestamp.now() };
    delete updateData.id;
    await updateDoc(doc(db, 'budgets', budgetId), updateData);
    set((s) => ({
      budgets: s.budgets.map((b) =>
        b.id === budgetId ? { ...b, ...data, updatedAt: new Date() } : b,
      ),
    }));
  },

  removeBudget: async (budgetId) => {
    await deleteDoc(doc(db, 'budgets', budgetId));
    set((s) => ({ budgets: s.budgets.filter((b) => b.id !== budgetId) }));
  },

  reset: () => {
    set({ transactions: [], budgets: [], loading: true, error: null, _userId: null });
  },
}));
