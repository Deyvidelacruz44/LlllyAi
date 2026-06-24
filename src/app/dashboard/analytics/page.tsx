'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import {
  BarChart3, TrendingUp, TrendingDown, Calendar, CheckCircle, Clock,
  Loader2, Brain, AlertCircle, MessageSquare, RefreshCw, Target, Award,
  Activity, DollarSign, Wallet, PiggyBank, CreditCard, ArrowUpCircle,
  ArrowDownCircle, Users, Receipt, Banknote,
  Zap, ListTodo, HandCoins
} from 'lucide-react';
import {
  format, subDays, startOfDay, endOfDay, isToday, isPast, isFuture,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval,
  eachDayOfInterval, isSameDay
} from 'date-fns';
import { es } from 'date-fns/locale';
import ProductivityMeter from '@/components/ProductivityMeter';
import { formatMoney, txCurrency } from '@/lib/format';

// ===== INTERFACES =====
interface LocalStats {
  totalEvents: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  cancelledTasks: number;
  overdueTasks: number;
  totalConversations: number;
  actionsFromChat: number;
  eventsByType: Record<string, number>;
  tasksByPriority: Record<string, number>;
  tasksByStatus: Record<string, number>;
  recentActivity: Array<{ type: string; title: string; date: Date; icon: string }>;
  completionRate: number;
  todayEvents: number;
  thisWeekEvents: number;
  upcomingEvents: number;
}

interface FinanceStats {
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyIncomeUSD: number;     // gastos/ingresos en USD se llevan aparte (no se mezclan con DOP)
  monthlyExpensesUSD: number;
  obligationsUSD: number;       // gastos fijos + deudas en USD
  balance: number;
  savingsRate: number;
  transactionCount: number;
  topExpenseCategory: string;
  topExpenseAmount: number;
  expensesByCategory: Record<string, number>;
  incomeByCategory: Record<string, number>;
  dailySpending: Array<{ date: string; expense: number; income: number }>;
  totalMonthlyObligations: number;
  monthlyFixed: number;
  monthlyDebt: number;
  totalDebtRemaining: number;
  activeDebts: number;
  overdueDebts: number;
  totalPendingReceivables: number;
  totalCollected: number;
  collectionRate: number;
  activeReceivables: number;
  overdueReceivables: number;
  uniqueDebtors: number;
}

// Cache de análisis IA
const aiAnalyticsCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000;

const CATEGORY_LABELS: Record<string, string> = {
  salario: 'Salario', freelance: 'Freelance', inversiones: 'Inversiones',
  cobros_clientes: 'Cobros Clientes', alimentacion: 'Alimentación',
  transporte: 'Transporte', vivienda: 'Vivienda', servicios: 'Servicios',
  entretenimiento: 'Entretenimiento', salud: 'Salud', educacion: 'Educación',
  ropa: 'Ropa', tecnologia: 'Tecnología', ahorro: 'Ahorro', deuda: 'Deuda',
  regalo: 'Regalo', otro: 'Otro',
  alquiler: 'Alquiler', hipoteca: 'Hipoteca', servicios_basicos: 'Serv. Básicos',
  internet_telefono: 'Internet/Teléfono', seguro: 'Seguro', suscripcion: 'Suscripción',
  prestamo_personal: 'Préstamo Personal', tarjeta_credito: 'Tarjeta Crédito',
  prestamo_vehiculo: 'Prést. Vehículo', prestamo_estudiantil: 'Prést. Estudiantil',
  impuestos: 'Impuestos', mantenimiento: 'Mantenimiento', membresia: 'Membresía',
  otro_fijo: 'Otro Fijo',
};

const EXPENSE_COLORS: Record<string, string> = {
  alimentacion: '#f97316', transporte: '#eab308', vivienda: '#a855f7',
  servicios: '#6366f1', entretenimiento: '#ec4899', salud: '#ef4444',
  educacion: '#06b6d4', ropa: '#d946ef', tecnologia: '#64748b',
  deuda: '#f43f5e', ahorro: '#14b8a6', otro: '#9ca3af',
};

type ActiveTab = 'general' | 'finanzas';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [localStats, setLocalStats] = useState<LocalStats | null>(null);
  const [financeStats, setFinanceStats] = useState<FinanceStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(30);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('general');

  useEffect(() => {
    if (user) {
      loadAllStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dateRange]);

  const loadAllStats = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadLocalStats(), loadFinanceStats()]);
    } catch (err: any) {
      console.error('Error loading stats:', err);
      setError('Error al cargar las estadísticas.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dateRange]);

  // ===== ESTADÍSTICAS GENERALES =====
  const loadLocalStats = useCallback(async () => {
    if (!user) return;
    const startDate = startOfDay(subDays(new Date(), dateRange));
    const endDate = endOfDay(new Date());
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const [eventsSnapshot, tasksSnapshot, conversationsSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'events'), where('userId', '==', user.uid))),
      getDocs(query(collection(db, 'tasks'), where('userId', '==', user.uid))),
      getDocs(query(collection(db, 'ai_conversations'), where('userId', '==', user.uid), orderBy('timestamp', 'desc'), limit(50))),
    ]);

    const events = eventsSnapshot.docs.map((doc) => {
      const d = doc.data();
      return { id: doc.id, title: d.title, type: d.type || 'other', startDate: d.startDate?.toDate() || new Date(), endDate: d.endDate?.toDate() || new Date() };
    });
    const periodEvents = events.filter(e => e.startDate >= startDate && e.startDate <= endDate);
    const todayEvents = events.filter(e => isToday(e.startDate)).length;
    const thisWeekEvents = events.filter(e => e.startDate >= weekStart && e.startDate <= weekEnd).length;
    const upcomingEvents = events.filter(e => isFuture(e.startDate)).length;

    const tasks = tasksSnapshot.docs.map((doc) => {
      const d = doc.data();
      return { id: doc.id, title: d.title, status: d.status, priority: d.priority || 'medium', createdAt: d.createdAt?.toDate() || new Date(), completedAt: d.completedAt?.toDate(), dueDate: d.dueDate?.toDate() };
    });

    let completedTasks = 0, pendingTasks = 0, inProgressTasks = 0, cancelledTasks = 0, overdueTasks = 0;
    const tasksByPriority: Record<string, number> = {};
    const tasksByStatus: Record<string, number> = {};
    tasks.forEach(t => {
      if (t.status === 'completed') completedTasks++;
      else if (t.status === 'pending') pendingTasks++;
      else if (t.status === 'in-progress') inProgressTasks++;
      else if (t.status === 'cancelled') cancelledTasks++;
      if (t.dueDate && isPast(t.dueDate) && t.status !== 'completed' && t.status !== 'cancelled') overdueTasks++;
      tasksByPriority[t.priority] = (tasksByPriority[t.priority] || 0) + 1;
      tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1;
    });

    const conversations = conversationsSnapshot.docs.map((doc) => {
      const d = doc.data();
      return { role: d.role, content: d.content, timestamp: d.timestamp?.toDate() || new Date() };
    });
    const actionsFromChat = conversations.filter(c =>
      c.role === 'assistant' && (c.content.includes('✅') || c.content.includes('Evento creado') || c.content.includes('Tarea creada'))
    ).length;

    const eventsByType: Record<string, number> = {};
    periodEvents.forEach(e => { eventsByType[e.type] = (eventsByType[e.type] || 0) + 1; });

    const recentActivity = [
      ...periodEvents.slice(0, 5).map(e => ({ type: 'event', title: e.title, date: e.startDate, icon: '📅' })),
      ...tasks.filter(t => t.createdAt >= startDate).slice(0, 5).map(t => ({
        type: 'task', title: t.title, date: t.createdAt, icon: t.status === 'completed' ? '✅' : '📋'
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);

    setLocalStats({
      totalEvents: periodEvents.length, totalTasks: tasks.length, completedTasks, pendingTasks,
      inProgressTasks, cancelledTasks, overdueTasks, totalConversations: conversations.length,
      actionsFromChat, eventsByType, tasksByPriority, tasksByStatus, recentActivity,
      completionRate: tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0,
      todayEvents, thisWeekEvents, upcomingEvents,
    });
  }, [user, dateRange]);

  // ===== ESTADÍSTICAS FINANCIERAS =====
  const loadFinanceStats = useCallback(async () => {
    if (!user) return;
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const [transactionsSnap, debtsSnap, receivablesSnap] = await Promise.all([
      getDocs(query(collection(db, 'transactions'), where('userId', '==', user.uid))),
      getDocs(query(collection(db, 'debts'), where('userId', '==', user.uid))),
      getDocs(query(collection(db, 'receivables'), where('userId', '==', user.uid))),
    ]);

    // --- Transactions ---
    const transactions = transactionsSnap.docs.map(doc => {
      const d = doc.data();
      return { type: d.type as string, category: d.category as string, amount: d.amount as number, currency: txCurrency(d as { currency?: 'DOP' | 'USD'; tags?: string[] }), date: d.date?.toDate() || new Date() };
    });
    const monthlyTx = transactions.filter(t => isWithinInterval(t.date, { start: monthStart, end: monthEnd }));

    // Métricas en DOP (moneda dominante). El gasto/ingreso en USD se acumula aparte.
    let monthlyIncome = 0, monthlyExpenses = 0, monthlyIncomeUSD = 0, monthlyExpensesUSD = 0;
    const expensesByCategory: Record<string, number> = {};
    const incomeByCategory: Record<string, number> = {};
    monthlyTx.forEach(t => {
      const isUSD = t.currency === 'USD';
      if (t.type === 'income') {
        if (isUSD) { monthlyIncomeUSD += t.amount; return; }
        monthlyIncome += t.amount;
        incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
      } else if (t.type === 'expense') {
        if (isUSD) { monthlyExpensesUSD += t.amount; return; }
        monthlyExpenses += t.amount;
        expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.amount;
      }
    });

    const balance = monthlyIncome - monthlyExpenses;
    const savingsRate = monthlyIncome > 0 ? Math.round(((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100) : 0;

    let topExpenseCategory = '', topExpenseAmount = 0;
    Object.entries(expensesByCategory).forEach(([cat, amt]) => {
      if (amt > topExpenseAmount) { topExpenseCategory = cat; topExpenseAmount = amt; }
    });

    const days = eachDayOfInterval({ start: monthStart, end: now > monthEnd ? monthEnd : now });
    const dailySpending = days.map(day => {
      let dayExpense = 0, dayIncome = 0;
      monthlyTx.forEach(t => {
        if (isSameDay(t.date, day) && t.currency === 'DOP') {
          if (t.type === 'expense') dayExpense += t.amount;
          else if (t.type === 'income') dayIncome += t.amount;
        }
      });
      return { date: format(day, 'dd', { locale: es }), expense: dayExpense, income: dayIncome };
    });

    // --- Debts ---
    const debts = debtsSnap.docs.map(doc => {
      const d = doc.data();
      return { type: d.type as string, amount: d.amount as number, currency: (d.currency === 'USD' ? 'USD' : 'DOP') as 'DOP' | 'USD', totalDebt: d.totalDebt as number | undefined, totalPaid: (d.totalPaid as number) || 0, frequency: d.frequency as string, status: d.status as string };
    });

    const normalizeToMonthly = (amount: number, freq: string) => {
      switch (freq) {
        case 'weekly': return amount * 4.33;
        case 'biweekly': return amount * 2.17;
        case 'monthly': return amount;
        case 'quarterly': return amount / 3;
        case 'yearly': return amount / 12;
        case 'one_time': return 0;
        default: return amount;
      }
    };

    let monthlyFixed = 0, monthlyDebt = 0, obligationsUSD = 0, totalDebtRemaining = 0, activeDebts = 0, overdueDebts = 0;
    debts.forEach(d => {
      if (d.status === 'active' || d.status === 'overdue') {
        activeDebts++;
        if (d.status === 'overdue') overdueDebts++;
        const monthly = normalizeToMonthly(d.amount, d.frequency);
        if (d.currency === 'USD') {
          obligationsUSD += monthly;          // obligaciones en USD aparte (no se suman a DOP)
        } else if (d.type === 'fixed_expense') {
          monthlyFixed += monthly;
        } else {
          monthlyDebt += monthly;
        }
        if (d.type === 'debt' && d.currency !== 'USD' && d.totalDebt) totalDebtRemaining += d.totalDebt - d.totalPaid;
      }
    });

    // --- Receivables ---
    const receivables = receivablesSnap.docs.map(doc => {
      const d = doc.data();
      return { debtorName: d.debtorName as string, totalAmount: d.totalAmount as number, amountPaid: (d.amountPaid as number) || 0, status: d.status as string, dueDate: d.dueDate?.toDate() };
    });

    let totalPendingReceivables = 0, totalCollected = 0, totalLent = 0, activeReceivables = 0, overdueReceivables = 0;
    const debtorSet = new Set<string>();
    receivables.forEach(r => {
      totalCollected += r.amountPaid;
      if (r.status !== 'cancelled') totalLent += r.totalAmount;
      if (r.status !== 'cancelled' && r.status !== 'paid') {
        activeReceivables++;
        totalPendingReceivables += r.totalAmount - r.amountPaid;
        debtorSet.add(r.debtorName.toLowerCase());
        if (r.dueDate && isPast(r.dueDate)) overdueReceivables++;
      }
    });
    const collectionRate = totalLent > 0 ? Math.round((totalCollected / totalLent) * 100) : 0;

    setFinanceStats({
      monthlyIncome, monthlyExpenses, monthlyIncomeUSD, monthlyExpensesUSD, obligationsUSD,
      balance, savingsRate, transactionCount: monthlyTx.length,
      topExpenseCategory, topExpenseAmount, expensesByCategory, incomeByCategory, dailySpending,
      totalMonthlyObligations: monthlyFixed + monthlyDebt, monthlyFixed, monthlyDebt,
      totalDebtRemaining, activeDebts, overdueDebts,
      totalPendingReceivables, totalCollected, collectionRate, activeReceivables,
      overdueReceivables, uniqueDebtors: debtorSet.size,
    });
  }, [user]);

  // ===== ANÁLISIS IA =====
  const generateAIAnalytics = useCallback(async () => {
    if (!user || !localStats) return;
    setAiLoading(true);
    setShowAIAnalysis(true);

    try {
      const cacheKey = `${user.uid}-${dateRange}-v2`;
      const cached = aiAnalyticsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setAnalytics(cached.data);
        setAiLoading(false);
        return;
      }

      const startDate = startOfDay(subDays(new Date(), dateRange));
      const endDate = endOfDay(new Date());

      const [eventsSnapshot, tasksSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'events'), where('userId', '==', user.uid))),
        getDocs(query(collection(db, 'tasks'), where('userId', '==', user.uid))),
      ]);

      const events = eventsSnapshot.docs.map((doc) => {
        const d = doc.data();
        return { title: d.title, type: d.type, startDate: d.startDate?.toDate(), endDate: d.endDate?.toDate() };
      }).filter(e => e.startDate >= startDate && e.startDate <= endDate);

      const tasks = tasksSnapshot.docs.map((doc) => {
        const d = doc.data();
        return { title: d.title, status: d.status, priority: d.priority, createdAt: d.createdAt?.toDate(), completedAt: d.completedAt?.toDate(), dueDate: d.dueDate?.toDate() };
      });

      const response = await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: events.map(e => ({ ...e, startDate: e.startDate?.toISOString(), endDate: e.endDate?.toISOString() })),
          tasks: tasks.map(t => ({ ...t, createdAt: t.createdAt?.toISOString(), completedAt: t.completedAt?.toISOString(), dueDate: t.dueDate?.toISOString() })),
          finances: financeStats ? {
            monthlyIncome: financeStats.monthlyIncome,
            monthlyExpenses: financeStats.monthlyExpenses,
            balance: financeStats.balance,
            savingsRate: financeStats.savingsRate,
            topExpenseCategory: financeStats.topExpenseCategory,
            totalMonthlyObligations: financeStats.totalMonthlyObligations,
            totalDebtRemaining: financeStats.totalDebtRemaining,
            totalPendingReceivables: financeStats.totalPendingReceivables,
            collectionRate: financeStats.collectionRate,
            expensesByCategory: financeStats.expensesByCategory,
          } : null,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setAnalytics(data.analytics);
        aiAnalyticsCache.set(cacheKey, { data: data.analytics, timestamp: Date.now() });
      } else {
        throw new Error(data.error || 'Error al generar análisis');
      }
    } catch (err: any) {
      console.error('Error generating AI analytics:', err);
      setError('No se pudo generar el análisis con IA.');
    } finally {
      setAiLoading(false);
    }
  }, [user, localStats, financeStats, dateRange]);

  // ===== HELPERS =====
  const getMaxBarValue = (data: Array<{ expense: number; income: number }>) => {
    return Math.max(...data.map(d => Math.max(d.expense, d.income)), 1);
  };

  // ===== RENDER =====
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-36 bg-brand-navy rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error && !localStats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error al cargar métricas</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={loadAllStats} className="px-6 py-3 bg-brand-navy text-white rounded-lg hover:bg-[#1a1870] transition-colors">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const maxBar = financeStats?.dailySpending ? getMaxBarValue(financeStats.dailySpending) : 1;

  return (
    <div className="space-y-4">
      {/* ===== GRADIENT HEADER ===== */}
      <div className="bg-brand-navy rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm p-2 rounded-xl">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Métricas IA</h1>
              <p className="text-white/70 text-sm">Visión integral de tu productividad y finanzas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(Number(e.target.value))}
              className="text-xs px-2 py-1.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-white focus:ring-2 focus:ring-white/50"
            >
              <option value={7} className="text-gray-900">7 días</option>
              <option value={14} className="text-gray-900">14 días</option>
              <option value={30} className="text-gray-900">30 días</option>
              <option value={90} className="text-gray-900">90 días</option>
            </select>
            <button
              onClick={loadAllStats}
              disabled={loading}
              className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Header quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-300" />
              <span className="text-xs text-white/70">Productividad</span>
            </div>
            <p className="text-2xl font-bold">{localStats?.completionRate || 0}%</p>
            <p className="text-[10px] text-white/60">{localStats?.completedTasks || 0}/{localStats?.totalTasks || 0} tareas</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-emerald-300" />
              <span className="text-xs text-white/70">Balance mes</span>
            </div>
            <p className={`text-2xl font-bold ${(financeStats?.balance || 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {formatMoney(financeStats?.balance || 0)}
            </p>
            <p className="text-[10px] text-white/60">Ahorro: {financeStats?.savingsRate || 0}%</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-brand-blue" />
              <span className="text-xs text-white/70">Eventos</span>
            </div>
            <p className="text-2xl font-bold">{localStats?.totalEvents || 0}</p>
            <p className="text-[10px] text-white/60">Hoy: {localStats?.todayEvents || 0} · Semana: {localStats?.thisWeekEvents || 0}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-orange-300" />
              <span className="text-xs text-white/70">Alertas</span>
            </div>
            <p className="text-2xl font-bold text-orange-300">
              {(localStats?.overdueTasks || 0) + (financeStats?.overdueDebts || 0) + (financeStats?.overdueReceivables || 0)}
            </p>
            <p className="text-[10px] text-white/60">
              Tareas: {localStats?.overdueTasks || 0} · Deudas: {financeStats?.overdueDebts || 0}
            </p>
          </div>
        </div>
      </div>

      {/* ===== TAB SELECTOR ===== */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'general' ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <ListTodo className="w-4 h-4" />
          Productividad
        </button>
        <button
          onClick={() => setActiveTab('finanzas')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'finanzas' ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Wallet className="w-4 h-4" />
          Finanzas
        </button>
      </div>

      {/* ===== GENERAL TAB ===== */}
      {activeTab === 'general' && (
        <div className="space-y-3">
          {/* Real productivity metrics (streak, on-time, weekly trend) */}
          <ProductivityMeter />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Tasks breakdown */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <div className="bg-brand-blue/20 p-1 rounded-lg"><Target className="w-4 h-4 text-brand-navy" /></div>
                Estado de Tareas
              </h3>
              <div className="space-y-2.5">
                {[
                  { label: 'Completadas', count: localStats?.completedTasks || 0, bg: 'bg-emerald-500' },
                  { label: 'En progreso', count: localStats?.inProgressTasks || 0, bg: 'bg-brand-blue' },
                  { label: 'Pendientes', count: localStats?.pendingTasks || 0, bg: 'bg-amber-500' },
                  { label: 'Vencidas', count: localStats?.overdueTasks || 0, bg: 'bg-red-500' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${item.bg}`}></div>
                    <span className="text-xs text-gray-600 flex-1">{item.label}</span>
                    <span className="text-xs font-bold text-gray-900">{item.count}</span>
                    <div className="w-20 bg-gray-100 rounded-full h-2">
                      <div className={`${item.bg} h-2 rounded-full transition-all`} style={{ width: `${localStats?.totalTasks ? Math.min((item.count / localStats.totalTasks) * 100, 100) : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs flex justify-between">
                <span className="text-gray-500">Total tareas</span>
                <span className="font-bold text-gray-900">{localStats?.totalTasks || 0}</span>
              </div>
            </div>

            {/* Events by type */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <div className="bg-brand-blue/20 p-1 rounded-lg"><Calendar className="w-4 h-4 text-brand-navy" /></div>
                Eventos por Tipo
              </h3>
              {localStats?.eventsByType && Object.keys(localStats.eventsByType).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(localStats.eventsByType).sort(([,a], [,b]) => b - a).map(([type, count]) => {
                    const labels: Record<string, { icon: string; label: string }> = {
                      work: { icon: '💼', label: 'Trabajo' }, personal: { icon: '🏠', label: 'Personal' },
                      meeting: { icon: '👥', label: 'Reunión' }, reminder: { icon: '🔔', label: 'Recordatorio' },
                      other: { icon: '📌', label: 'Otro' },
                    };
                    const info = labels[type] || { icon: '📌', label: type };
                    const pct = localStats.totalEvents ? Math.round((count / localStats.totalEvents) * 100) : 0;
                    return (
                      <div key={type} className="flex items-center gap-2 text-xs">
                        <span className="text-base">{info.icon}</span>
                        <span className="flex-1 text-gray-600">{info.label}</span>
                        <span className="font-bold text-gray-900">{count}</span>
                        <span className="text-gray-400 w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-20 text-gray-400 text-xs">Sin eventos en este período</div>
              )}
              <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs">
                <span className="text-gray-500">Próximos</span>
                <span className="font-bold text-brand-navy">{localStats?.upcomingEvents || 0}</span>
              </div>
            </div>

            {/* Priority */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <div className="bg-brand-navy/10 p-1 rounded-lg"><BarChart3 className="w-4 h-4 text-brand-navy" /></div>
                Prioridad de Tareas
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'urgent', icon: '🔴', label: 'Urgente' },
                  { key: 'high', icon: '🟠', label: 'Alta' },
                  { key: 'medium', icon: '🟡', label: 'Media' },
                  { key: 'low', icon: '🟢', label: 'Baja' },
                ].map(({ key, icon, label }) => (
                  <div key={key} className="text-center p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="text-lg mb-0.5">{icon}</div>
                    <p className="text-xl font-bold text-gray-900">{localStats?.tasksByPriority[key] || 0}</p>
                    <p className="text-[10px] text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs flex items-center gap-2">
                <MessageSquare className="w-3 h-3 text-brand-navy" />
                <span className="text-gray-500 flex-1">Chats IA</span>
                <span className="font-bold">{localStats?.totalConversations || 0}</span>
                <span className="text-gray-400">({localStats?.actionsFromChat || 0} acciones)</span>
              </div>
            </div>
          </div>

          {/* Recent activity */}
          {localStats?.recentActivity && localStats.recentActivity.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <div className="bg-amber-100 p-1 rounded-lg"><Clock className="w-4 h-4 text-amber-600" /></div>
                Actividad Reciente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {localStats.recentActivity.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs py-1.5 px-2 bg-gray-50 rounded-lg">
                    <span>{item.icon}</span>
                    <span className="flex-1 truncate text-gray-700">{item.title}</span>
                    <span className="text-gray-400 whitespace-nowrap">{format(item.date, 'dd MMM', { locale: es })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== FINANCE TAB ===== */}
      {activeTab === 'finanzas' && (
        <div className="space-y-3">
          {/* Income vs Expenses cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-emerald-100 p-1.5 rounded-lg"><ArrowUpCircle className="w-4 h-4 text-emerald-600" /></div>
                <span className="text-xs text-gray-500">Ingresos</span>
              </div>
              <p className="text-lg font-bold text-emerald-600">{formatMoney(financeStats?.monthlyIncome || 0)}</p>
              {(financeStats?.monthlyIncomeUSD || 0) > 0
                ? <p className="text-[10px] text-emerald-500 font-medium mt-1">+ {formatMoney(financeStats!.monthlyIncomeUSD, 'USD')}</p>
                : <p className="text-[10px] text-gray-400 mt-1">Este mes</p>}
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-red-100 p-1.5 rounded-lg"><ArrowDownCircle className="w-4 h-4 text-red-600" /></div>
                <span className="text-xs text-gray-500">Gastos</span>
              </div>
              <p className="text-lg font-bold text-red-600">{formatMoney(financeStats?.monthlyExpenses || 0)}</p>
              {(financeStats?.monthlyExpensesUSD || 0) > 0
                ? <p className="text-[10px] text-red-500 font-medium mt-1">+ {formatMoney(financeStats!.monthlyExpensesUSD, 'USD')}</p>
                : <p className="text-[10px] text-gray-400 mt-1">Este mes</p>}
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-brand-navy/10 p-1.5 rounded-lg"><CreditCard className="w-4 h-4 text-brand-navy" /></div>
                <span className="text-xs text-gray-500">Obligaciones</span>
              </div>
              <p className="text-lg font-bold text-brand-navy">{formatMoney(financeStats?.totalMonthlyObligations || 0)}</p>
              {(financeStats?.obligationsUSD || 0) > 0
                ? <p className="text-[10px] text-brand-navy font-medium mt-1">+ {formatMoney(financeStats!.obligationsUSD, 'USD')}/mes</p>
                : <p className="text-[10px] text-gray-400 mt-1">Fijos + Deudas/mes</p>}
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-brand-blue/20 p-1.5 rounded-lg"><HandCoins className="w-4 h-4 text-brand-navy" /></div>
                <span className="text-xs text-gray-500">Por cobrar</span>
              </div>
              <p className="text-lg font-bold text-brand-navy">{formatMoney(financeStats?.totalPendingReceivables || 0)}</p>
              <p className="text-[10px] text-gray-400 mt-1">{financeStats?.activeReceivables || 0} activas</p>
            </div>
          </div>

          {/* Financial health overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Savings & Balance */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <div className="bg-emerald-100 p-1 rounded-lg"><PiggyBank className="w-4 h-4 text-emerald-600" /></div>
                Salud Financiera
              </h3>
              <div className="space-y-3">
                <div className="text-center">
                  <div className="relative w-24 h-24 mx-auto">
                    <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                      <circle
                        cx="50" cy="50" r="40" fill="none"
                        stroke={
                          (financeStats?.savingsRate || 0) >= 20 ? '#10b981' :
                          (financeStats?.savingsRate || 0) >= 0 ? '#f59e0b' : '#ef4444'
                        }
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${Math.max(0, Math.min(100, financeStats?.savingsRate || 0)) * 2.51} 251`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold text-gray-900">{financeStats?.savingsRate || 0}%</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Tasa de ahorro</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Balance neto</span>
                    <span className={`font-bold ${(financeStats?.balance || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatMoney(financeStats?.balance || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Disponible real</span>
                    <span className={`font-bold ${((financeStats?.balance || 0) - (financeStats?.totalMonthlyObligations || 0)) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatMoney((financeStats?.balance || 0) - (financeStats?.totalMonthlyObligations || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Transacciones</span>
                    <span className="font-bold text-gray-700">{financeStats?.transactionCount || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Expenses by category */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <div className="bg-red-100 p-1 rounded-lg"><Receipt className="w-4 h-4 text-red-600" /></div>
                Gastos por Categoría
              </h3>
              {financeStats?.expensesByCategory && Object.keys(financeStats.expensesByCategory).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(financeStats.expensesByCategory).sort(([,a], [,b]) => b - a).slice(0, 6).map(([cat, amt]) => {
                    const pct = financeStats.monthlyExpenses > 0 ? Math.round((amt / financeStats.monthlyExpenses) * 100) : 0;
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="text-gray-600">{CATEGORY_LABELS[cat] || cat}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{formatMoney(amt)}</span>
                            <span className="text-gray-400 w-8 text-right">{pct}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: EXPENSE_COLORS[cat] || '#9ca3af' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 text-gray-400 text-xs">Sin gastos este mes</div>
              )}
              {financeStats?.topExpenseCategory && (
                <div className="mt-3 pt-3 border-t border-gray-100 text-xs flex justify-between">
                  <span className="text-gray-500">Mayor gasto</span>
                  <span className="font-bold text-red-600">{CATEGORY_LABELS[financeStats.topExpenseCategory] || financeStats.topExpenseCategory}</span>
                </div>
              )}
            </div>

            {/* Debts & Receivables */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <div className="bg-orange-100 p-1 rounded-lg"><Banknote className="w-4 h-4 text-orange-600" /></div>
                Deudas y Cobros
              </h3>
              <div className="space-y-3">
                <div className="bg-rose-50 rounded-lg p-2.5 border border-rose-100">
                  <p className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider mb-1.5">Deudas / Gastos Fijos</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Gastos fijos/mes</span>
                      <span className="font-bold text-gray-900">{formatMoney(financeStats?.monthlyFixed || 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Pagos deuda/mes</span>
                      <span className="font-bold text-gray-900">{formatMoney(financeStats?.monthlyDebt || 0)}</span>
                    </div>
                    {(financeStats?.totalDebtRemaining || 0) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Deuda restante</span>
                        <span className="font-bold text-rose-600">{formatMoney(financeStats?.totalDebtRemaining || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs pt-1">
                      <span className="text-gray-500">Activas: {financeStats?.activeDebts || 0}</span>
                      {(financeStats?.overdueDebts || 0) > 0 && (
                        <span className="text-red-600 font-semibold">{financeStats?.overdueDebts} vencidas</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-brand-blue/10 rounded-lg p-2.5 border border-brand-blue/20">
                  <p className="text-[10px] font-semibold text-brand-navy uppercase tracking-wider mb-1.5">Cuentas por Cobrar</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Pendiente</span>
                      <span className="font-bold text-brand-navy">{formatMoney(financeStats?.totalPendingReceivables || 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Cobrado total</span>
                      <span className="font-bold text-emerald-600">{formatMoney(financeStats?.totalCollected || 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Tasa cobro</span>
                      <span className="font-bold text-gray-900">{financeStats?.collectionRate || 0}%</span>
                    </div>
                    <div className="flex justify-between text-xs pt-1">
                      <span className="text-gray-500">Deudores: {financeStats?.uniqueDebtors || 0}</span>
                      {(financeStats?.overdueReceivables || 0) > 0 && (
                        <span className="text-red-600 font-semibold">{financeStats?.overdueReceivables} vencidas</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Daily spending chart */}
          {financeStats?.dailySpending && financeStats.dailySpending.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <div className="bg-brand-navy/10 p-1 rounded-lg"><BarChart3 className="w-4 h-4 text-brand-navy" /></div>
                Gasto e Ingreso Diario
                <span className="text-xs font-normal text-gray-400 ml-auto">{format(new Date(), 'MMMM yyyy', { locale: es })}</span>
              </h3>
              <div className="flex items-end gap-[2px] h-28">
                {financeStats.dailySpending.map((day, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-[1px] group relative">
                    <div
                      className="w-full bg-emerald-400 rounded-t-sm opacity-60 min-h-[1px] transition-all group-hover:opacity-100"
                      style={{ height: `${maxBar > 0 ? (day.income / maxBar) * 100 : 0}%` }}
                    />
                    <div
                      className="w-full bg-red-400 rounded-b-sm opacity-60 min-h-[1px] transition-all group-hover:opacity-100"
                      style={{ height: `${maxBar > 0 ? (day.expense / maxBar) * 100 : 0}%` }}
                    />
                    <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                      <p>Día {day.date}</p>
                      {day.income > 0 && <p className="text-emerald-300">+{formatMoney(day.income)}</p>}
                      {day.expense > 0 && <p className="text-red-300">-{formatMoney(day.expense)}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-[9px] text-gray-400">
                <span>1</span>
                <span>{financeStats.dailySpending.length}</span>
              </div>
              <div className="flex items-center gap-4 mt-2 justify-center">
                <div className="flex items-center gap-1 text-[10px]">
                  <div className="w-2 h-2 bg-emerald-400 rounded-sm"></div>
                  <span className="text-gray-500">Ingreso</span>
                </div>
                <div className="flex items-center gap-1 text-[10px]">
                  <div className="w-2 h-2 bg-red-400 rounded-sm"></div>
                  <span className="text-gray-500">Gasto</span>
                </div>
              </div>
            </div>
          )}

          {/* Income breakdown */}
          {financeStats?.incomeByCategory && Object.keys(financeStats.incomeByCategory).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <div className="bg-emerald-100 p-1 rounded-lg"><TrendingUp className="w-4 h-4 text-emerald-600" /></div>
                Fuentes de Ingreso
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(financeStats.incomeByCategory).sort(([,a], [,b]) => b - a).map(([cat, amt]) => {
                  const pct = financeStats.monthlyIncome > 0 ? Math.round((amt / financeStats.monthlyIncome) * 100) : 0;
                  return (
                    <div key={cat} className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-emerald-600 font-medium">{CATEGORY_LABELS[cat] || cat}</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{formatMoney(amt)}</p>
                      <p className="text-[10px] text-gray-400">{pct}%</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== AI ANALYSIS (both tabs) ===== */}
      {!showAIAnalysis && (
        <div className="bg-brand-navy/5 border border-brand-blue/30 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-brand-navy/10 p-2 rounded-xl">
              <Brain className="w-5 h-5 text-brand-navy" />
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">Análisis Inteligente</span>
              <p className="text-xs text-gray-500">Productividad + finanzas con IA</p>
            </div>
          </div>
          <button
            onClick={generateAIAnalytics}
            disabled={aiLoading}
            className="text-xs bg-brand-navy text-white px-4 py-2 rounded-lg hover:from-[#1a1870] hover:to-[#7bb8f0] transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
          >
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
            {aiLoading ? 'Analizando...' : 'Generar Análisis'}
          </button>
        </div>
      )}

      {aiLoading && showAIAnalysis && (
        <div className="bg-brand-navy/5 border border-brand-blue/30 p-6 rounded-xl flex items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-brand-navy" />
          <span className="text-sm text-brand-navy">Analizando productividad y finanzas...</span>
        </div>
      )}

      {analytics && showAIAnalysis && !aiLoading && (
        <div className="space-y-3">
          {/* Score */}
          <div className="bg-brand-navy text-white p-4 rounded-xl shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 backdrop-blur-sm p-2 rounded-xl">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-white/70">Puntuación General</p>
                  <p className="text-sm text-white/80 max-w-md">{analytics.summary}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold">{analytics.productivityScore}</p>
                <p className="text-[10px] text-white/70">/ 100</p>
              </div>
            </div>
          </div>

          {/* Insights, Recommendations, Patterns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {analytics.insights?.length > 0 && (
              <div className="bg-brand-blue/10 border border-brand-blue/30 p-3 rounded-xl">
                <p className="text-xs font-semibold text-brand-navy mb-2 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> Insights
                </p>
                <ul className="text-xs text-brand-navy/80 space-y-1.5">
                  {analytics.insights.map((i: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-brand-blue mt-0.5">•</span>
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analytics.recommendations?.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                <p className="text-xs font-semibold text-emerald-800 mb-2 flex items-center gap-1">
                  <Target className="w-3.5 h-3.5" /> Recomendaciones
                </p>
                <ul className="text-xs text-emerald-700 space-y-1.5">
                  {analytics.recommendations.map((r: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analytics.patterns?.length > 0 && (
              <div className="bg-brand-orange/10 border border-brand-orange/20 p-3 rounded-xl">
                <p className="text-xs font-semibold text-brand-navy mb-2 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" /> Patrones
                </p>
                <ul className="text-xs text-brand-navy/80 space-y-1.5">
                  {analytics.patterns.map((p: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-brand-orange mt-0.5">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Financial insights */}
          {analytics.financialInsights && analytics.financialInsights.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
              <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" /> Análisis Financiero
              </p>
              <ul className="text-xs text-amber-700 space-y-1.5">
                {analytics.financialInsights.map((f: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-400 mt-0.5">•</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button onClick={generateAIAnalytics} disabled={aiLoading} className="text-xs text-brand-navy hover:underline flex items-center gap-1 mx-auto py-1">
            <RefreshCw className="w-3 h-3" /> Regenerar análisis
          </button>
        </div>
      )}
    </div>
  );
}
