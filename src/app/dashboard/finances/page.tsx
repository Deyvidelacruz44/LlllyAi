'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { Transaction, TransactionType, TransactionCategory, Budget } from '@/types';
import {
  Plus, Edit2, Trash2, X, Search, TrendingUp, TrendingDown,
  DollarSign, PiggyBank, Wallet, ArrowUpCircle, ArrowDownCircle,
  Filter, Brain, Loader2, RefreshCw, Target, AlertCircle, Award,
  Calendar as CalendarIcon, Download, Repeat, ChevronUp, ChevronDown,
  Zap, Coffee, ShoppingCart, Car, Home, Lightbulb, CreditCard,
  BarChart3, PieChart, Receipt, Banknote, ArrowRight, Info, HandCoins
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval, eachDayOfInterval, isSameDay, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { LucideIcon } from 'lucide-react';

type SortMode = 'date' | 'amount' | 'category';
type FilterPeriod = 'this-month' | 'last-month' | 'last-3-months' | 'all';
type ViewTab = 'overview' | 'transactions' | 'budgets';

const iconMap: Record<string, LucideIcon> = {
  TrendingUp, TrendingDown, AlertCircle, Target, Award, Wallet, PiggyBank,
};

const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  salario: 'Salario',
  freelance: 'Freelance',
  inversiones: 'Inversiones',
  cobros_clientes: 'Cobros Clientes',
  alimentacion: 'Alimentación',
  transporte: 'Transporte',
  vivienda: 'Vivienda',
  servicios: 'Servicios',
  entretenimiento: 'Entretenimiento',
  salud: 'Salud',
  educacion: 'Educación',
  ropa: 'Ropa',
  tecnologia: 'Tecnología',
  ahorro: 'Ahorro',
  deuda: 'Deuda',
  regalo: 'Regalo',
  otro: 'Otro',
};

const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  salario: 'bg-green-100 text-green-800 border-green-200',
  freelance: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  inversiones: 'bg-brand-blue/15 text-brand-navy border-brand-blue/30',
  cobros_clientes: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  alimentacion: 'bg-orange-100 text-orange-800 border-orange-200',
  transporte: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  vivienda: 'bg-brand-navy/10 text-brand-navy border-brand-navy/20',
  servicios: 'bg-brand-blue/20 text-brand-navy border-brand-blue/30',
  entretenimiento: 'bg-pink-100 text-pink-800 border-pink-200',
  salud: 'bg-red-100 text-red-800 border-red-200',
  educacion: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  ropa: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  tecnologia: 'bg-slate-100 text-slate-800 border-slate-200',
  ahorro: 'bg-teal-100 text-teal-800 border-teal-200',
  deuda: 'bg-rose-100 text-rose-800 border-rose-200',
  regalo: 'bg-amber-100 text-amber-800 border-amber-200',
  otro: 'bg-gray-100 text-gray-800 border-gray-200',
};

const CATEGORY_ACCENT: Record<TransactionCategory, string> = {
  salario: '#22c55e', freelance: '#10b981', inversiones: '#3b82f6',
  cobros_clientes: '#0891b2',
  alimentacion: '#f97316', transporte: '#eab308', vivienda: '#a855f7',
  servicios: '#6366f1', entretenimiento: '#ec4899', salud: '#ef4444',
  educacion: '#06b6d4', ropa: '#d946ef', tecnologia: '#64748b',
  ahorro: '#14b8a6', deuda: '#f43f5e', regalo: '#f59e0b', otro: '#6b7280',
};

const CATEGORY_ICONS: Partial<Record<TransactionCategory, LucideIcon>> = {
  alimentacion: Coffee, transporte: Car, vivienda: Home,
  servicios: Lightbulb, entretenimiento: Zap, salud: Target,
  tecnologia: CreditCard, salario: Banknote, deuda: Receipt,
  cobros_clientes: HandCoins,
};

const INCOME_CATEGORIES: TransactionCategory[] = ['salario', 'freelance', 'inversiones', 'cobros_clientes', 'regalo', 'otro'];
const EXPENSE_CATEGORIES: TransactionCategory[] = [
  'alimentacion', 'transporte', 'vivienda', 'servicios', 'entretenimiento',
  'salud', 'educacion', 'ropa', 'tecnologia', 'ahorro', 'deuda', 'regalo', 'otro',
];

const QUICK_ADD_ITEMS = [
  { label: 'Comida', category: 'alimentacion' as TransactionCategory, icon: Coffee, defaultAmount: '' },
  { label: 'Transporte', category: 'transporte' as TransactionCategory, icon: Car, defaultAmount: '' },
  { label: 'Servicios', category: 'servicios' as TransactionCategory, icon: Lightbulb, defaultAmount: '' },
  { label: 'Compras', category: 'ropa' as TransactionCategory, icon: ShoppingCart, defaultAmount: '' },
  { label: 'Entretenimiento', category: 'entretenimiento' as TransactionCategory, icon: Zap, defaultAmount: '' },
  { label: 'Salud', category: 'salud' as TransactionCategory, icon: Target, defaultAmount: '' },
];

interface AIInsight {
  type: 'success' | 'warning' | 'info' | 'alert';
  title: string;
  message: string;
  icon: string | LucideIcon;
}

interface AIAnalysis {
  summary: string;
  insights: AIInsight[];
  recommendations: string[];
  healthScore?: number;
}

export default function FinancesPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [periodFilter, setPeriodFilter] = useState<FilterPeriod>('this-month');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [showSearch, setShowSearch] = useState(false);
  const [showDetail, setShowDetail] = useState<Transaction | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>('overview');

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);

  const [formData, setFormData] = useState({
    type: 'expense' as TransactionType,
    category: 'otro' as TransactionCategory,
    amount: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    account: '',
    isRecurring: false,
    recurringFrequency: 'monthly' as 'weekly' | 'biweekly' | 'monthly' | 'yearly',
  });

  const [budgetFormData, setBudgetFormData] = useState({
    category: 'alimentacion' as TransactionCategory,
    amount: '',
    period: 'monthly' as 'weekly' | 'monthly' | 'yearly',
  });

  useEffect(() => {
    if (user) {
      loadTransactions();
      loadBudgets();
    }
  }, [user]);

  // ==================== DATA LOADING ====================

  const loadTransactions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const ref = collection(db, 'transactions');
      const q = query(ref, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          ...raw,
          date: raw.date?.toDate(),
          createdAt: raw.createdAt?.toDate(),
          updatedAt: raw.updatedAt?.toDate(),
        } as Transaction;
      });
      data.sort((a, b) => b.date.getTime() - a.date.getTime());
      setTransactions(data);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBudgets = async () => {
    if (!user) return;
    try {
      const ref = collection(db, 'budgets');
      const q = query(ref, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          ...raw,
          startDate: raw.startDate?.toDate(),
          endDate: raw.endDate?.toDate(),
          createdAt: raw.createdAt?.toDate(),
          updatedAt: raw.updatedAt?.toDate(),
        } as Budget;
      });
      setBudgets(data);
    } catch (error) {
      console.error('Error loading budgets:', error);
    }
  };

  // ==================== TRANSACTION CRUD ====================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const transactionData = {
        userId: user.uid,
        type: formData.type,
        category: formData.category,
        amount: parseFloat(formData.amount),
        description: formData.description,
        date: Timestamp.fromDate(new Date(formData.date + 'T12:00:00')),
        account: formData.account || 'principal',
        isRecurring: formData.isRecurring,
        recurringFrequency: formData.isRecurring ? formData.recurringFrequency : null,
        updatedAt: Timestamp.now(),
      };

      if (editingTransaction) {
        await updateDoc(doc(db, 'transactions', editingTransaction.id), transactionData);
      } else {
        await addDoc(collection(db, 'transactions'), {
          ...transactionData,
          createdAt: Timestamp.now(),
        });
      }

      resetForm();
      loadTransactions();
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta transacción?')) return;
    try {
      await deleteDoc(doc(db, 'transactions', id));
      loadTransactions();
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  };

  const handleEdit = (t: Transaction) => {
    setEditingTransaction(t);
    setFormData({
      type: t.type,
      category: t.category,
      amount: t.amount.toString(),
      description: t.description,
      date: format(t.date, 'yyyy-MM-dd'),
      account: t.account || '',
      isRecurring: t.isRecurring || false,
      recurringFrequency: t.recurringFrequency || 'monthly',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      type: 'expense', category: 'otro', amount: '', description: '',
      date: format(new Date(), 'yyyy-MM-dd'), account: '',
      isRecurring: false, recurringFrequency: 'monthly',
    });
    setEditingTransaction(null);
    setShowModal(false);
  };

  const openQuickAdd = (item: typeof QUICK_ADD_ITEMS[0]) => {
    setFormData({
      type: 'expense',
      category: item.category,
      amount: item.defaultAmount,
      description: item.label,
      date: format(new Date(), 'yyyy-MM-dd'),
      account: '',
      isRecurring: false,
      recurringFrequency: 'monthly',
    });
    setShowModal(true);
  };

  // ==================== BUDGET CRUD ====================

  const handleBudgetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const data = {
        userId: user.uid,
        category: budgetFormData.category,
        amount: parseFloat(budgetFormData.amount),
        period: budgetFormData.period,
        startDate: Timestamp.fromDate(startOfMonth(new Date())),
        updatedAt: Timestamp.now(),
      };

      if (editingBudget) {
        await updateDoc(doc(db, 'budgets', editingBudget.id), data);
      } else {
        await addDoc(collection(db, 'budgets'), { ...data, createdAt: Timestamp.now() });
      }

      resetBudgetForm();
      loadBudgets();
    } catch (error) {
      console.error('Error saving budget:', error);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!confirm('¿Eliminar este presupuesto?')) return;
    try {
      await deleteDoc(doc(db, 'budgets', id));
      loadBudgets();
    } catch (error) {
      console.error('Error deleting budget:', error);
    }
  };

  const resetBudgetForm = () => {
    setBudgetFormData({ category: 'alimentacion', amount: '', period: 'monthly' });
    setEditingBudget(null);
    setShowBudgetModal(false);
  };

  // ==================== FILTERING & SORTING ====================

  const getFilteredTransactions = useCallback(() => {
    let filtered = [...transactions];
    const now = new Date();

    switch (periodFilter) {
      case 'this-month':
        filtered = filtered.filter(t => isWithinInterval(t.date, { start: startOfMonth(now), end: endOfMonth(now) }));
        break;
      case 'last-month': {
        const lastMonth = subMonths(now, 1);
        filtered = filtered.filter(t => isWithinInterval(t.date, { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) }));
        break;
      }
      case 'last-3-months': {
        const threeMonthsAgo = subMonths(now, 3);
        filtered = filtered.filter(t => isWithinInterval(t.date, { start: startOfMonth(threeMonthsAgo), end: endOfMonth(now) }));
        break;
      }
    }

    if (typeFilter !== 'all') filtered = filtered.filter(t => t.type === typeFilter);

    if (searchQuery) {
      const term = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.description.toLowerCase().includes(term) ||
        CATEGORY_LABELS[t.category].toLowerCase().includes(term) ||
        t.amount.toString().includes(term)
      );
    }

    switch (sortMode) {
      case 'amount': filtered.sort((a, b) => b.amount - a.amount); break;
      case 'category': filtered.sort((a, b) => a.category.localeCompare(b.category)); break;
      default: filtered.sort((a, b) => b.date.getTime() - a.date.getTime());
    }

    return filtered;
  }, [transactions, periodFilter, typeFilter, searchQuery, sortMode]);

  const filteredTransactions = getFilteredTransactions();

  // ==================== STATS CALCULATIONS ====================

  const getPeriodTransactions = useCallback((period: FilterPeriod) => {
    const now = new Date();
    let filtered = [...transactions];
    switch (period) {
      case 'this-month':
        filtered = filtered.filter(t => isWithinInterval(t.date, { start: startOfMonth(now), end: endOfMonth(now) }));
        break;
      case 'last-month': {
        const last = subMonths(now, 1);
        filtered = filtered.filter(t => isWithinInterval(t.date, { start: startOfMonth(last), end: endOfMonth(last) }));
        break;
      }
      case 'last-3-months': {
        const ago = subMonths(now, 3);
        filtered = filtered.filter(t => isWithinInterval(t.date, { start: startOfMonth(ago), end: endOfMonth(now) }));
        break;
      }
    }
    return filtered;
  }, [transactions]);

  const stats = useMemo(() => {
    const periodTx = getPeriodTransactions(periodFilter);
    const income = periodTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = periodTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = income - expenses;
    const savingsRate = income > 0 ? Math.round(((income - expenses) / income) * 100) : 0;

    const expensesByCategory: Record<string, number> = {};
    periodTx.filter(t => t.type === 'expense').forEach(t => {
      expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
    });

    const incomeByCategory: Record<string, number> = {};
    periodTx.filter(t => t.type === 'income').forEach(t => {
      incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
    });

    const topExpenseCategory = Object.entries(expensesByCategory).sort(([, a], [, b]) => b - a)[0];

    return {
      income, expenses, balance, savingsRate,
      transactionCount: periodTx.length,
      incomeCount: periodTx.filter(t => t.type === 'income').length,
      expenseCount: periodTx.filter(t => t.type === 'expense').length,
      expensesByCategory, incomeByCategory,
      topCategory: topExpenseCategory
        ? { name: CATEGORY_LABELS[topExpenseCategory[0] as TransactionCategory] || topExpenseCategory[0], amount: topExpenseCategory[1] }
        : null,
      avgDailyExpense: expenses > 0 ? (() => {
        const now = new Date();
        const monthStart = startOfMonth(now);
        const daysElapsed = Math.max(1, differenceInDays(now, monthStart) + 1);
        return Math.round(expenses / daysElapsed);
      })() : 0,
    };
  }, [transactions, periodFilter, getPeriodTransactions]);

  // Previous period comparison
  const prevStats = useMemo(() => {
    if (periodFilter !== 'this-month') return null;
    const prevTx = getPeriodTransactions('last-month');
    const income = prevTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = prevTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expenses, balance: income - expenses };
  }, [transactions, periodFilter, getPeriodTransactions]);

  const getDelta = (current: number, previous: number | undefined) => {
    if (!previous || previous === 0) return null;
    const pct = Math.round(((current - previous) / previous) * 100);
    return pct;
  };

  // ==================== DAILY SPENDING CHART DATA ====================

  const dailySpendingData = useMemo(() => {
    if (periodFilter !== 'this-month' && periodFilter !== 'last-month') return [];
    const now = new Date();
    const target = periodFilter === 'last-month' ? subMonths(now, 1) : now;
    const start = startOfMonth(target);
    const end = periodFilter === 'this-month' ? now : endOfMonth(target);
    const days = eachDayOfInterval({ start, end });

    return days.map(day => {
      const dayExpenses = transactions
        .filter(t => t.type === 'expense' && isSameDay(t.date, day))
        .reduce((s, t) => s + t.amount, 0);
      const dayIncome = transactions
        .filter(t => t.type === 'income' && isSameDay(t.date, day))
        .reduce((s, t) => s + t.amount, 0);
      return { date: day, expenses: dayExpenses, income: dayIncome };
    });
  }, [transactions, periodFilter]);

  // ==================== BUDGET PROGRESS ====================

  const budgetProgress = useMemo(() => {
    return budgets.map(b => {
      const spent = stats.expensesByCategory[b.category] || 0;
      const pct = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
      return { ...b, spent, percentage: pct, remaining: b.amount - spent };
    });
  }, [budgets, stats.expensesByCategory]);

  // ==================== CSV EXPORT ====================

  const exportCSV = () => {
    const headers = ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto', 'Cuenta', 'Recurrente'];
    const rows = filteredTransactions.map(t => [
      format(t.date, 'yyyy-MM-dd'),
      t.type === 'income' ? 'Ingreso' : 'Gasto',
      CATEGORY_LABELS[t.category],
      t.description,
      t.amount.toString(),
      t.account || '',
      t.isRecurring ? 'Sí' : 'No',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finanzas_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ==================== AI ANALYSIS ====================

  const requestAIAnalysis = async () => {
    if (!user) return;
    setAiLoading(true);
    setShowAIPanel(true);

    try {
      const transactionSummary = filteredTransactions.slice(0, 30).map(t => ({
        type: t.type, category: t.category, amount: t.amount,
        description: t.description, date: format(t.date, 'yyyy-MM-dd'),
      }));

      const response = await fetch('/api/finance-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          stats: {
            totalIncome: stats.income, totalExpenses: stats.expenses,
            transactionCount: stats.transactionCount,
            incomeCount: stats.incomeCount, expenseCount: stats.expenseCount,
            expensesByCategory: stats.expensesByCategory,
            avgDailyExpense: stats.avgDailyExpense,
          },
          transactions: transactionSummary,
          budgets: budgetProgress.map(b => ({
            category: b.category, limit: b.amount, spent: b.spent, percentage: b.percentage,
          })),
          currentDate: format(new Date(), 'yyyy-MM-dd'),
        }),
      });

      const data = await response.json();
      if (data.success && data.analysis) {
        setAiAnalysis(data.analysis);
      }
    } catch (error) {
      console.error('Error getting AI analysis:', error);
    } finally {
      setAiLoading(false);
    }
  };

  // ==================== RENDER HELPERS ====================

  const DeltaBadge = ({ current, previous, invertColors = false }: { current: number; previous?: number; invertColors?: boolean }) => {
    const delta = getDelta(current, previous);
    if (delta === null) return null;
    const isPositive = delta > 0;
    const isGood = invertColors ? !isPositive : isPositive;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${
        isGood ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}>
        {isPositive ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {Math.abs(delta)}%
      </span>
    );
  };

  // ==================== RENDER ====================

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="bg-gradient-to-r from-emerald-200 to-teal-200 rounded-xl h-20" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border p-4 h-24" />
          ))}
        </div>
        <div className="bg-white rounded-xl border h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ========== HEADER ========== */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-xl px-4 py-3 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-6 h-6" />
            <div>
              <h1 className="text-xl font-bold">Finanzas</h1>
              <p className="text-emerald-100 text-xs">
                {stats.transactionCount} transacciones
                {stats.balance >= 0
                  ? <span className="ml-1">• Balance positivo</span>
                  : <span className="ml-1">• Balance negativo</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="p-2 hover:bg-white/20 rounded-lg transition-colors" title="Exportar CSV">
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={requestAIAnalysis}
              disabled={aiLoading}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              <span className="hidden sm:inline">IA</span>
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 bg-white text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-emerald-50 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nueva</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========== STATS CARDS ========== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-green-100 rounded-lg"><ArrowUpCircle className="w-4 h-4 text-green-600" /></div>
            <p className="text-xs text-gray-500">Ingresos</p>
          </div>
          <p className="text-xl font-bold text-green-600">${stats.income.toLocaleString()}</p>
          {prevStats && <DeltaBadge current={stats.income} previous={prevStats.income} />}
        </div>
        <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-red-100 rounded-lg"><ArrowDownCircle className="w-4 h-4 text-red-600" /></div>
            <p className="text-xs text-gray-500">Gastos</p>
          </div>
          <p className="text-xl font-bold text-red-600">${stats.expenses.toLocaleString()}</p>
          {prevStats && <DeltaBadge current={stats.expenses} previous={prevStats.expenses} invertColors />}
        </div>
        <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-brand-blue/20 rounded-lg"><Wallet className="w-4 h-4 text-brand-navy" /></div>
            <p className="text-xs text-gray-500">Balance</p>
          </div>
          <p className={`text-xl font-bold ${stats.balance >= 0 ? 'text-brand-navy' : 'text-red-600'}`}>
            ${stats.balance.toLocaleString()}
          </p>
          {prevStats && <DeltaBadge current={stats.balance} previous={prevStats.balance} />}
        </div>
        <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-brand-navy/10 rounded-lg"><PiggyBank className="w-4 h-4 text-brand-navy" /></div>
            <p className="text-xs text-gray-500">Tasa Ahorro</p>
          </div>
          <p className={`text-xl font-bold ${stats.savingsRate >= 20 ? 'text-green-600' : stats.savingsRate >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
            {stats.savingsRate}%
          </p>
          {stats.avgDailyExpense > 0 && (
            <span className="text-[10px] text-gray-400">${stats.avgDailyExpense.toLocaleString()}/día</span>
          )}
        </div>
      </div>

      {/* ========== QUICK ADD BUTTONS ========== */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {QUICK_ADD_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => openQuickAdd(item)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all whitespace-nowrap flex-shrink-0"
            >
              <Icon className="w-3.5 h-3.5 text-gray-500" />
              + {item.label}
            </button>
          );
        })}
      </div>

      {/* ========== AI ANALYSIS PANEL ========== */}
      {showAIPanel && (
        <div className="bg-brand-navy/5 border border-brand-blue/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-brand-navy" />
              <h3 className="text-sm font-bold text-gray-900">Análisis Financiero IA</h3>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={requestAIAnalysis} disabled={aiLoading} className="p-1.5 hover:bg-white/50 rounded-lg transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 text-brand-navy ${aiLoading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => setShowAIPanel(false)} className="p-1.5 hover:bg-white/50 rounded-lg transition-colors">
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>
          </div>

          {aiLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 text-brand-navy animate-spin" />
              <span className="ml-2 text-sm text-gray-600">Analizando tus finanzas...</span>
            </div>
          ) : aiAnalysis ? (
            <div className="space-y-3">
              {aiAnalysis.healthScore !== undefined && (
                <div className="flex items-center gap-3 p-3 bg-white/60 rounded-xl">
                  <div className="relative w-14 h-14">
                    <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                      <circle cx="28" cy="28" r="24" fill="none"
                        stroke={aiAnalysis.healthScore >= 75 ? '#22c55e' : aiAnalysis.healthScore >= 50 ? '#eab308' : '#ef4444'}
                        strokeWidth="4" strokeLinecap="round"
                        strokeDasharray={`${(aiAnalysis.healthScore / 100) * 150.8} 150.8`} />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${
                      aiAnalysis.healthScore >= 75 ? 'text-green-600' : aiAnalysis.healthScore >= 50 ? 'text-yellow-600' : 'text-red-600'
                    }`}>{aiAnalysis.healthScore}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">Salud Financiera</p>
                    <p className="text-xs text-gray-600 line-clamp-2">{aiAnalysis.summary}</p>
                  </div>
                </div>
              )}

              {!aiAnalysis.healthScore && aiAnalysis.summary && (
                <p className="text-xs text-gray-700 bg-white/60 p-3 rounded-xl">{aiAnalysis.summary}</p>
              )}

              {aiAnalysis.insights && aiAnalysis.insights.length > 0 && (
                <div className="grid gap-2 md:grid-cols-2">
                  {aiAnalysis.insights.map((insight, i) => {
                    const IconComponent = typeof insight.icon === 'string' ? iconMap[insight.icon] || AlertCircle : insight.icon;
                    return (
                      <div key={i} className={`p-3 rounded-lg border text-xs ${
                        insight.type === 'success' ? 'bg-green-50 border-green-200' :
                        insight.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                        insight.type === 'alert' ? 'bg-red-50 border-red-200' :
                        'bg-brand-blue/10 border-brand-blue/20'
                      }`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <IconComponent className={`w-3.5 h-3.5 ${
                            insight.type === 'success' ? 'text-green-600' : insight.type === 'warning' ? 'text-yellow-600' :
                            insight.type === 'alert' ? 'text-red-600' : 'text-brand-navy'
                          }`} />
                          <span className="font-semibold">{insight.title}</span>
                        </div>
                        <p className="text-gray-700">{insight.message}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {aiAnalysis.recommendations && aiAnalysis.recommendations.length > 0 && (
                <div className="bg-white/60 p-3 rounded-xl">
                  <h4 className="font-semibold text-gray-900 text-xs mb-2">💡 Recomendaciones</h4>
                  <ul className="space-y-1">
                    {aiAnalysis.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                        <span className="text-brand-navy font-bold mt-0.5">•</span>{rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4 text-xs">Haz clic en actualizar para obtener análisis.</p>
          )}
        </div>
      )}

      {/* ========== TAB NAVIGATION ========== */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        {([
          { value: 'overview' as ViewTab, label: 'Resumen', icon: PieChart },
          { value: 'transactions' as ViewTab, label: 'Transacciones', icon: Receipt },
          { value: 'budgets' as ViewTab, label: 'Presupuestos', icon: Target },
        ]).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${
                activeTab === tab.value
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ========== OVERVIEW TAB ========== */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Daily Spending Chart */}
          {dailySpendingData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-gray-600" />
                  <h3 className="text-sm font-bold text-gray-900">Gasto Diario</h3>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Gastos</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> Ingresos</span>
                </div>
              </div>
              <div className="flex items-end gap-[2px] h-28 overflow-x-auto scrollbar-hide">
                {dailySpendingData.map((day, i) => {
                  const maxVal = Math.max(...dailySpendingData.map(d => Math.max(d.expenses, d.income)), 1);
                  const expH = (day.expenses / maxVal) * 100;
                  const incH = (day.income / maxVal) * 100;
                  const dayIsToday = isSameDay(day.date, new Date());
                  return (
                    <div key={i} className="flex flex-col items-center flex-1 min-w-[8px] group relative">
                      <div className="flex-1 w-full flex flex-col justify-end items-center gap-[1px]">
                        {day.income > 0 && (
                          <div
                            className="w-full bg-green-400 rounded-t-sm min-h-[2px] transition-all group-hover:bg-green-500"
                            style={{ height: `${Math.max(incH, 2)}%` }}
                          />
                        )}
                        {day.expenses > 0 && (
                          <div
                            className={`w-full rounded-t-sm min-h-[2px] transition-all ${dayIsToday ? 'bg-red-500' : 'bg-red-300 group-hover:bg-red-400'}`}
                            style={{ height: `${Math.max(expH, 2)}%` }}
                          />
                        )}
                        {day.expenses === 0 && day.income === 0 && (
                          <div className="w-full bg-gray-100 rounded-t-sm" style={{ height: '2%' }} />
                        )}
                      </div>
                      {(i === 0 || i === dailySpendingData.length - 1 || dayIsToday || i % 5 === 0) && (
                        <span className={`text-[8px] mt-0.5 ${dayIsToday ? 'text-brand-navy font-bold' : 'text-gray-400'}`}>
                          {format(day.date, 'd')}
                        </span>
                      )}
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
                        <div className="bg-gray-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap">
                          <p className="font-medium">{format(day.date, 'd MMM', { locale: es })}</p>
                          {day.expenses > 0 && <p className="text-red-300">-${day.expenses.toLocaleString()}</p>}
                          {day.income > 0 && <p className="text-green-300">+${day.income.toLocaleString()}</p>}
                          {day.expenses === 0 && day.income === 0 && <p className="text-gray-400">Sin movimientos</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Category Breakdown - Two columns */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Expense Categories */}
            {Object.keys(stats.expensesByCategory).length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                  <ArrowDownCircle className="w-4 h-4 text-red-500" /> Gastos por Categoría
                </h3>
                <div className="space-y-2.5">
                  {Object.entries(stats.expensesByCategory)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 8)
                    .map(([category, amount]) => {
                      const maxAmount = Math.max(...Object.values(stats.expensesByCategory));
                      const pct = stats.expenses > 0 ? Math.round((amount / stats.expenses) * 100) : 0;
                      const CatIcon = CATEGORY_ICONS[category as TransactionCategory];
                      return (
                        <div key={category} className="flex items-center gap-2 text-xs">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: CATEGORY_ACCENT[category as TransactionCategory] + '20' }}>
                            {CatIcon
                              ? <CatIcon className="w-3.5 h-3.5" style={{ color: CATEGORY_ACCENT[category as TransactionCategory] }} />
                              : <DollarSign className="w-3.5 h-3.5" style={{ color: CATEGORY_ACCENT[category as TransactionCategory] }} />
                            }
                          </div>
                          <span className="w-20 truncate text-gray-700 font-medium">{CATEGORY_LABELS[category as TransactionCategory] || category}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max((amount / maxAmount) * 100, 3)}%`, backgroundColor: CATEGORY_ACCENT[category as TransactionCategory] }} />
                          </div>
                          <span className="w-10 text-right text-gray-400">{pct}%</span>
                          <span className="w-20 text-right font-semibold text-gray-900">${amount.toLocaleString()}</span>
                        </div>
                      );
                    })}
                </div>
                {stats.topCategory && (
                  <p className="text-[10px] text-gray-400 mt-3 pt-2 border-t">
                    Mayor gasto: {stats.topCategory.name} (${stats.topCategory.amount.toLocaleString()})
                  </p>
                )}
              </div>
            )}

            {/* Income Categories */}
            {Object.keys(stats.incomeByCategory).length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                  <ArrowUpCircle className="w-4 h-4 text-green-500" /> Ingresos por Fuente
                </h3>
                <div className="space-y-2.5">
                  {Object.entries(stats.incomeByCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, amount]) => {
                      const maxAmount = Math.max(...Object.values(stats.incomeByCategory));
                      const pct = stats.income > 0 ? Math.round((amount / stats.income) * 100) : 0;
                      return (
                        <div key={category} className="flex items-center gap-2 text-xs">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center bg-green-50">
                            <Banknote className="w-3.5 h-3.5 text-green-600" />
                          </div>
                          <span className="w-20 truncate text-gray-700 font-medium">{CATEGORY_LABELS[category as TransactionCategory] || category}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.max((amount / maxAmount) * 100, 3)}%` }} />
                          </div>
                          <span className="w-10 text-right text-gray-400">{pct}%</span>
                          <span className="w-20 text-right font-semibold text-gray-900">${amount.toLocaleString()}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-col items-center justify-center text-center">
                <TrendingUp className="w-10 h-10 text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">No hay ingresos registrados</p>
                <p className="text-xs text-gray-300 mt-1">Registra tus ingresos para ver el desglose</p>
              </div>
            )}
          </div>

          {/* Budget Progress Summary */}
          {budgetProgress.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-brand-navy" /> Presupuestos
                </h3>
                <button onClick={() => setActiveTab('budgets')} className="text-xs text-brand-navy hover:text-brand-blue flex items-center gap-0.5">
                  Ver todos <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {budgetProgress.slice(0, 4).map((b) => (
                  <div key={b.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700 truncate">{CATEGORY_LABELS[b.category]}</span>
                        <span className={`text-xs font-bold ${b.percentage >= 100 ? 'text-red-600' : b.percentage >= 80 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {b.percentage}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${
                          b.percentage >= 100 ? 'bg-red-500' : b.percentage >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                        }`} style={{ width: `${Math.min(b.percentage, 100)}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">${b.spent.toLocaleString()} / ${b.amount.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {stats.transactionCount === 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
              <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                <Wallet className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Comienza a rastrear tus finanzas</h3>
              <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
                Registra tus ingresos y gastos para obtener análisis inteligentes,
                visualizar tendencias y recibir recomendaciones personalizadas con IA.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  onClick={() => { setFormData(f => ({ ...f, type: 'income' })); setShowModal(true); }}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                  <ArrowUpCircle className="w-4 h-4" /> Registrar Ingreso
                </button>
                <button
                  onClick={() => { setFormData(f => ({ ...f, type: 'expense' })); setShowModal(true); }}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  <ArrowDownCircle className="w-4 h-4" /> Registrar Gasto
                </button>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center max-w-sm mx-auto">
                <div className="p-2">
                  <BarChart3 className="w-5 h-5 text-brand-blue mx-auto mb-1" />
                  <p className="text-[10px] text-gray-400">Gráficas diarias</p>
                </div>
                <div className="p-2">
                  <Brain className="w-5 h-5 text-brand-navy/40 mx-auto mb-1" />
                  <p className="text-[10px] text-gray-400">Análisis IA</p>
                </div>
                <div className="p-2">
                  <Target className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                  <p className="text-[10px] text-gray-400">Presupuestos</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== TRANSACTIONS TAB ========== */}
      {activeTab === 'transactions' && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border p-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex gap-1 items-center">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                {([
                  { value: 'this-month', label: 'Este Mes' },
                  { value: 'last-month', label: 'Anterior' },
                  { value: 'last-3-months', label: '3 Meses' },
                  { value: 'all', label: 'Todo' },
                ] as const).map((p) => (
                  <button key={p.value} onClick={() => setPeriodFilter(p.value)}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                      periodFilter === p.value ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="h-4 w-px bg-gray-200" />
              <div className="flex gap-1">
                {([
                  { value: 'all' as const, label: 'Todos' },
                  { value: 'income' as const, label: 'Ingresos' },
                  { value: 'expense' as const, label: 'Gastos' },
                ]).map((t) => (
                  <button key={t.value} onClick={() => setTypeFilter(t.value)}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                      typeFilter === t.value ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              <div className="flex gap-1">
                <button onClick={() => setShowSearch(!showSearch)}
                  className={`p-1.5 rounded-md transition-colors ${showSearch ? 'bg-emerald-100 text-emerald-600' : 'text-gray-400 hover:bg-gray-100'}`}>
                  <Search className="w-3.5 h-3.5" />
                </button>
                <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-600 focus:ring-1 focus:ring-emerald-500">
                  <option value="date">Fecha</option>
                  <option value="amount">Monto</option>
                  <option value="category">Categoría</option>
                </select>
              </div>
            </div>
            {showSearch && (
              <div className="mt-2 pt-2 border-t">
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar descripción, categoría o monto..."
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  autoFocus />
              </div>
            )}
          </div>

          {/* Transaction List */}
          {filteredTransactions.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
              <Receipt className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm mb-2">No hay transacciones en este período</p>
              <button onClick={() => setShowModal(true)}
                className="text-emerald-600 hover:text-emerald-700 text-sm font-medium">
                + Registrar transacción
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
                <p className="text-xs text-gray-500">{filteredTransactions.length} transacciones</p>
                <button onClick={exportCSV} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <Download className="w-3 h-3" /> CSV
                </button>
              </div>
              <div className="divide-y max-h-[500px] overflow-y-auto">
                {filteredTransactions.map((t) => {
                  const CatIcon = CATEGORY_ICONS[t.category] || DollarSign;
                  return (
                    <div key={t.id}
                      className="px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-3 group"
                      onClick={() => setShowDetail(t)}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: CATEGORY_ACCENT[t.category] + '15' }}>
                        <CatIcon className="w-4 h-4" style={{ color: CATEGORY_ACCENT[t.category] }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-medium text-gray-900 truncate">{t.description}</h4>
                          {t.isRecurring && (
                            <Repeat className="w-3 h-3 text-brand-navy/40 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${CATEGORY_COLORS[t.category]}`}>
                            {CATEGORY_LABELS[t.category]}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {format(t.date, 'd MMM', { locale: es })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-sm font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                          {t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString()}
                        </span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); handleEdit(t); }}
                            className="p-1.5 text-gray-400 hover:text-brand-navy hover:bg-brand-blue/10 rounded-md transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== BUDGETS TAB ========== */}
      {activeTab === 'budgets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Presupuestos Mensuales</h3>
              <p className="text-xs text-gray-500">Establece límites por categoría para controlar tus gastos</p>
            </div>
            <button onClick={() => setShowBudgetModal(true)}
              className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Nuevo Presupuesto
            </button>
          </div>

          {budgetProgress.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
              <div className="mx-auto w-14 h-14 bg-brand-navy/5 rounded-full flex items-center justify-center mb-3">
                <Target className="w-7 h-7 text-brand-navy/30" />
              </div>
              <h4 className="text-sm font-bold text-gray-900 mb-1">Sin presupuestos definidos</h4>
              <p className="text-xs text-gray-500 mb-4 max-w-sm mx-auto">
                Define presupuestos mensuales por categoría para recibir alertas cuando estés cerca del límite.
              </p>
              <button onClick={() => setShowBudgetModal(true)}
                className="text-sm text-brand-navy hover:text-brand-blue font-medium">
                + Crear primer presupuesto
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Budget Overview Card */}
              <div className="bg-brand-navy/5 border border-brand-blue/20 rounded-xl p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-brand-navy">
                      ${budgetProgress.reduce((s, b) => s + b.amount, 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-500">Total Presupuestado</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-600">
                      ${budgetProgress.reduce((s, b) => s + b.spent, 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-500">Total Gastado</p>
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${
                      budgetProgress.reduce((s, b) => s + b.remaining, 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${budgetProgress.reduce((s, b) => s + b.remaining, 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-500">Disponible</p>
                  </div>
                </div>
              </div>

              {/* Budget Items */}
              <div className="space-y-2">
                {budgetProgress.map((b) => {
                  const CatIcon = CATEGORY_ICONS[b.category] || DollarSign;
                  const statusColor = b.percentage >= 100 ? 'red' : b.percentage >= 80 ? 'yellow' : 'green';
                  return (
                    <div key={b.id} className="bg-white rounded-xl shadow-sm border p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: CATEGORY_ACCENT[b.category] + '15' }}>
                          <CatIcon className="w-5 h-5" style={{ color: CATEGORY_ACCENT[b.category] }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900">{CATEGORY_LABELS[b.category]}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${
                                statusColor === 'red' ? 'text-red-600' : statusColor === 'yellow' ? 'text-yellow-600' : 'text-green-600'
                              }`}>
                                {b.percentage}%
                              </span>
                              {b.percentage >= 100 && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                              {b.percentage >= 80 && b.percentage < 100 && <Info className="w-3.5 h-3.5 text-yellow-500" />}
                            </div>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden mb-1">
                            <div className={`h-full rounded-full transition-all duration-700 ${
                              statusColor === 'red' ? 'bg-red-500' : statusColor === 'yellow' ? 'bg-yellow-500' : 'bg-green-500'
                            }`} style={{ width: `${Math.min(b.percentage, 100)}%` }} />
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Gastado: ${b.spent.toLocaleString()}</span>
                            <span>Límite: ${b.amount.toLocaleString()}</span>
                          </div>
                          {b.remaining < 0 && (
                            <p className="text-[10px] text-red-500 mt-1 font-medium">
                              Excedido por ${Math.abs(b.remaining).toLocaleString()}
                            </p>
                          )}
                          {b.remaining > 0 && b.percentage >= 80 && (
                            <p className="text-[10px] text-yellow-600 mt-1">
                              Quedan ${b.remaining.toLocaleString()} disponibles
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button onClick={() => {
                            setEditingBudget(b);
                            setBudgetFormData({ category: b.category, amount: b.amount.toString(), period: b.period });
                            setShowBudgetModal(true);
                          }} className="p-1.5 text-gray-400 hover:text-brand-navy hover:bg-brand-blue/10 rounded-md transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteBudget(b.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== TRANSACTION DETAIL MODAL ========== */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetail(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: CATEGORY_ACCENT[showDetail.category] + '15' }}>
                  {(() => {
                    const CatIcon = CATEGORY_ICONS[showDetail.category] || DollarSign;
                    return <CatIcon className="w-6 h-6" style={{ color: CATEGORY_ACCENT[showDetail.category] }} />;
                  })()}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[showDetail.category]}`}>
                      {CATEGORY_LABELS[showDetail.category]}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${showDetail.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {showDetail.type === 'income' ? 'Ingreso' : 'Gasto'}
                    </span>
                    {showDetail.isRecurring && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-brand-navy/10 text-brand-navy flex items-center gap-0.5">
                        <Repeat className="w-3 h-3" /> {showDetail.recurringFrequency || 'Recurrente'}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">{showDetail.description}</h3>
                </div>
              </div>
              <button onClick={() => setShowDetail(null)} className="text-gray-400 hover:text-gray-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center py-4 bg-gray-50 rounded-xl mb-4">
              <p className={`text-4xl font-bold ${showDetail.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                {showDetail.type === 'income' ? '+' : '-'}${showDetail.amount.toLocaleString()}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase mb-0.5">Fecha</p>
                <p className="text-sm text-gray-700 flex items-center gap-1">
                  <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
                  {format(showDetail.date, 'dd MMM yyyy', { locale: es })}
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400 uppercase mb-0.5">Cuenta</p>
                <p className="text-sm text-gray-700 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                  {showDetail.account || 'Principal'}
                </p>
              </div>
            </div>

            {showDetail.createdAt && (
              <p className="text-[10px] text-gray-400 mb-4">
                Registrada: {format(showDetail.createdAt, "dd MMM yyyy 'a las' HH:mm", { locale: es })}
              </p>
            )}

            <div className="flex gap-2 pt-3 border-t">
              <button onClick={() => { handleEdit(showDetail); setShowDetail(null); }}
                className="flex-1 flex items-center justify-center gap-2 bg-brand-navy text-white py-2 rounded-lg hover:bg-[#1a1870] transition-colors text-sm font-medium">
                <Edit2 className="w-4 h-4" /> Editar
              </button>
              <button onClick={() => { setShowDetail(null); handleDelete(showDetail.id); }}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium">
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== CREATE/EDIT TRANSACTION MODAL ========== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={resetForm}>
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {editingTransaction ? 'Editar Transacción' : 'Nueva Transacción'}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Type selector */}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setFormData({ ...formData, type: 'income', category: 'salario' })}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-medium text-sm transition-all ${
                    formData.type === 'income' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  <ArrowUpCircle className="w-4 h-4" /> Ingreso
                </button>
                <button type="button" onClick={() => setFormData({ ...formData, type: 'expense', category: 'otro' })}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-medium text-sm transition-all ${
                    formData.type === 'expense' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  <ArrowDownCircle className="w-4 h-4" /> Gasto
                </button>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Monto</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">$</span>
                  <input type="number" step="0.01" min="0" value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg font-bold" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                <input type="text" value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required placeholder="Ej: Compra supermercado"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm" />
              </div>

              {/* Category - Grid */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
                <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto p-1">
                  {(formData.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => {
                    const CatIcon = CATEGORY_ICONS[cat] || DollarSign;
                    return (
                      <button key={cat} type="button" onClick={() => setFormData({ ...formData, category: cat })}
                        className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border text-[10px] transition-all ${
                          formData.category === cat
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                            : 'border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                        }`}>
                        <CatIcon className="w-4 h-4" />
                        {CATEGORY_LABELS[cat]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date & Account */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                  <input type="date" value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cuenta</label>
                  <input type="text" value={formData.account}
                    onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                    placeholder="Principal"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm" />
                </div>
              </div>

              {/* Recurring Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-brand-navy" />
                  <span className="text-sm text-gray-700">Transacción recurrente</span>
                </div>
                <button type="button"
                  onClick={() => setFormData({ ...formData, isRecurring: !formData.isRecurring })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${formData.isRecurring ? 'bg-brand-navy' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${formData.isRecurring ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {formData.isRecurring && (
                <select value={formData.recurringFrequency}
                  onChange={(e) => setFormData({ ...formData, recurringFrequency: e.target.value as typeof formData.recurringFrequency })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue text-sm">
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quincenal</option>
                  <option value="monthly">Mensual</option>
                  <option value="yearly">Anual</option>
                </select>
              )}

              {/* Submit */}
              <div className="flex gap-2 pt-2">
                <button type="submit"
                  className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl hover:bg-emerald-700 transition-colors font-medium text-sm">
                  {editingTransaction ? 'Actualizar' : 'Registrar'}
                </button>
                <button type="button" onClick={resetForm}
                  className="px-5 bg-gray-100 text-gray-600 py-2.5 rounded-xl hover:bg-gray-200 transition-colors font-medium text-sm">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== BUDGET MODAL ========== */}
      {showBudgetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={resetBudgetForm}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {editingBudget ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}
              </h3>
              <button onClick={resetBudgetForm} className="text-gray-400 hover:text-gray-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleBudgetSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
                <select value={budgetFormData.category}
                  onChange={(e) => setBudgetFormData({ ...budgetFormData, category: e.target.value as TransactionCategory })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue text-sm">
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Límite</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                  <input type="number" step="0.01" min="0" value={budgetFormData.amount}
                    onChange={(e) => setBudgetFormData({ ...budgetFormData, amount: e.target.value })}
                    required placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue text-sm font-bold" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Período</label>
                <select value={budgetFormData.period}
                  onChange={(e) => setBudgetFormData({ ...budgetFormData, period: e.target.value as typeof budgetFormData.period })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue text-sm">
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit"
                  className="flex-1 bg-brand-navy text-white py-2.5 rounded-xl hover:bg-[#1a1870] transition-colors font-medium text-sm">
                  {editingBudget ? 'Actualizar' : 'Crear'}
                </button>
                <button type="button" onClick={resetBudgetForm}
                  className="px-5 bg-gray-100 text-gray-600 py-2.5 rounded-xl hover:bg-gray-200 transition-colors font-medium text-sm">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
