'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { Debt, DebtType, DebtCategory, DebtFrequency, DebtStatus, Currency } from '@/types';
import { formatMoney, formatMoneyMulti, sumByCurrency } from '@/lib/format';
import {
  Plus, Edit2, Trash2, Search, TrendingDown, DollarSign,
  Home, CreditCard, Receipt, CheckCircle2, Pause, Clock, CalendarDays,
  ChevronDown, BarChart3, Loader2, AlertTriangle, CircleDollarSign
} from 'lucide-react';
import { format, differenceInDays, addMonths, addWeeks, addYears } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  DEBT_CATEGORY_LABELS, DEBT_CATEGORY_ICONS, DEBT_CATEGORY_COLORS,
  FREQUENCY_LABELS, STATUS_CONFIG,
} from './constants';
import DebtFormModal, { type DebtFormData } from './DebtFormModal';
import PaymentModal from './PaymentModal';

type ViewMode = 'all' | 'fixed_expense' | 'debt';
type StatusFilter = 'all' | DebtStatus;

export default function DebtsPage() {
  const { user } = useAuth();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  const [formData, setFormData] = useState<DebtFormData>({
    type: 'fixed_expense',
    category: 'servicios_basicos',
    name: '',
    description: '',
    amount: '',
    currency: 'DOP',
    totalDebt: '',
    frequency: 'monthly',
    dueDay: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: '',
    creditor: '',
    interestRate: '',
    notes: '',
    status: 'active',
  });

  useEffect(() => {
    if (user) loadDebts();
  }, [user]);

  // ==================== DATA LOADING ====================

  const loadDebts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const ref = collection(db, 'debts');
      const q = query(ref, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          ...raw,
          startDate: raw.startDate?.toDate(),
          endDate: raw.endDate?.toDate(),
          nextDueDate: raw.nextDueDate?.toDate(),
          lastPaidDate: raw.lastPaidDate?.toDate(),
          createdAt: raw.createdAt?.toDate(),
          updatedAt: raw.updatedAt?.toDate(),
          payments: (raw.payments || []).map((p: Record<string, unknown>) => ({
            ...p,
            date: (p.date as { toDate: () => Date })?.toDate?.() || p.date,
          })),
        } as Debt;
      });
      data.sort((a, b) => {
        // Overdue first, then by next due date
        if (a.status === 'overdue' && b.status !== 'overdue') return -1;
        if (b.status === 'overdue' && a.status !== 'overdue') return 1;
        const aDate = a.nextDueDate?.getTime() || 0;
        const bDate = b.nextDueDate?.getTime() || 0;
        return aDate - bDate;
      });
      setDebts(data);
    } catch (error) {
      console.error('Error loading debts:', error);
    } finally {
      setLoading(false);
    }
  };

  // ==================== CRUD ====================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const nextDue = calculateNextDueDate(
        new Date(formData.startDate + 'T12:00:00'),
        formData.frequency,
        formData.dueDay ? parseInt(formData.dueDay) : undefined
      );

      const debtData: Record<string, unknown> = {
        userId: user.uid,
        type: formData.type,
        category: formData.category,
        name: formData.name,
        description: formData.description || null,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        totalDebt: formData.totalDebt ? parseFloat(formData.totalDebt) : null,
        totalPaid: editingDebt?.totalPaid || 0,
        frequency: formData.frequency,
        dueDay: formData.dueDay ? parseInt(formData.dueDay) : null,
        nextDueDate: nextDue ? Timestamp.fromDate(nextDue) : null,
        startDate: Timestamp.fromDate(new Date(formData.startDate + 'T12:00:00')),
        endDate: formData.endDate ? Timestamp.fromDate(new Date(formData.endDate + 'T12:00:00')) : null,
        status: formData.status,
        creditor: formData.creditor || null,
        interestRate: formData.interestRate ? parseFloat(formData.interestRate) : null,
        notes: formData.notes || null,
        updatedAt: Timestamp.now(),
      };

      if (editingDebt) {
        await updateDoc(doc(db, 'debts', editingDebt.id), debtData);
      } else {
        await addDoc(collection(db, 'debts'), {
          ...debtData,
          totalPaid: 0,
          payments: [],
          createdAt: Timestamp.now(),
        });
      }

      resetForm();
      loadDebts();
    } catch (error) {
      console.error('Error saving debt:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este registro?')) return;
    try {
      await deleteDoc(doc(db, 'debts', id));
      loadDebts();
    } catch (error) {
      console.error('Error deleting debt:', error);
    }
  };

  const handleEdit = (debt: Debt) => {
    setEditingDebt(debt);
    setFormData({
      type: debt.type,
      category: debt.category,
      name: debt.name,
      description: debt.description || '',
      amount: debt.amount.toString(),
      currency: debt.currency || 'DOP',
      totalDebt: debt.totalDebt?.toString() || '',
      frequency: debt.frequency,
      dueDay: debt.dueDay?.toString() || '',
      startDate: format(debt.startDate, 'yyyy-MM-dd'),
      endDate: debt.endDate ? format(debt.endDate, 'yyyy-MM-dd') : '',
      creditor: debt.creditor || '',
      interestRate: debt.interestRate?.toString() || '',
      notes: debt.notes || '',
      status: debt.status,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      type: 'fixed_expense', category: 'servicios_basicos', name: '', description: '',
      amount: '', currency: 'DOP', totalDebt: '', frequency: 'monthly', dueDay: '',
      startDate: format(new Date(), 'yyyy-MM-dd'), endDate: '',
      creditor: '', interestRate: '', notes: '', status: 'active',
    });
    setEditingDebt(null);
    setShowModal(false);
  };

  // ==================== PAYMENT RECORDING ====================

  const openPaymentModal = (debt: Debt) => {
    setPaymentDebt(debt);
    setPaymentAmount(debt.amount.toString());
    setPaymentNote('');
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async () => {
    if (!paymentDebt || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);

    try {
      const newPayment = {
        id: Date.now().toString(),
        amount,
        date: Timestamp.now(),
        note: paymentNote || null,
      };

      const currentPayments = paymentDebt.payments || [];
      const newTotalPaid = (paymentDebt.totalPaid || 0) + amount;
      const nextDue = calculateNextDueDate(
        new Date(),
        paymentDebt.frequency,
        paymentDebt.dueDay
      );

      const isDebtPaidOff = paymentDebt.type === 'debt' &&
        paymentDebt.totalDebt &&
        newTotalPaid >= paymentDebt.totalDebt;

      await updateDoc(doc(db, 'debts', paymentDebt.id), {
        payments: [...currentPayments.map(p => ({
          ...p,
          date: p.date instanceof Date ? Timestamp.fromDate(p.date) : p.date,
        })), newPayment],
        totalPaid: newTotalPaid,
        lastPaidDate: Timestamp.now(),
        nextDueDate: nextDue ? Timestamp.fromDate(nextDue) : null,
        status: isDebtPaidOff ? 'paid' : 'active',
        updatedAt: Timestamp.now(),
      });

      setShowPaymentModal(false);
      setPaymentDebt(null);
      loadDebts();
    } catch (error) {
      console.error('Error recording payment:', error);
    }
  };

  const toggleStatus = async (debt: Debt, newStatus: DebtStatus) => {
    try {
      await updateDoc(doc(db, 'debts', debt.id), {
        status: newStatus,
        updatedAt: Timestamp.now(),
      });
      loadDebts();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // ==================== HELPERS ====================

  const calculateNextDueDate = (
    fromDate: Date,
    frequency: DebtFrequency,
    dueDay?: number
  ): Date | null => {
    if (frequency === 'one_time') return null;
    const now = new Date();
    let next = fromDate;

    while (next <= now) {
      switch (frequency) {
        case 'weekly': next = addWeeks(next, 1); break;
        case 'biweekly': next = addWeeks(next, 2); break;
        case 'monthly': next = addMonths(next, 1); break;
        case 'quarterly': next = addMonths(next, 3); break;
        case 'yearly': next = addYears(next, 1); break;
      }
    }

    if (dueDay && (frequency === 'monthly' || frequency === 'quarterly')) {
      const d = new Date(next);
      d.setDate(Math.min(dueDay, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
      return d;
    }

    return next;
  };

  const getDaysUntilDue = (debt: Debt): number | null => {
    if (!debt.nextDueDate) return null;
    return differenceInDays(debt.nextDueDate, new Date());
  };

  const getDueStatus = (debt: Debt): 'ok' | 'soon' | 'due' | 'overdue' => {
    const days = getDaysUntilDue(debt);
    if (days === null) return 'ok';
    if (days < 0) return 'overdue';
    if (days === 0) return 'due';
    if (days <= 5) return 'soon';
    return 'ok';
  };

  // ==================== FILTERING ====================

  const filteredDebts = useMemo(() => {
    let filtered = [...debts];

    if (viewMode !== 'all') filtered = filtered.filter(d => d.type === viewMode);
    if (statusFilter !== 'all') filtered = filtered.filter(d => d.status === statusFilter);
    if (searchQuery) {
      const term = searchQuery.toLowerCase();
      filtered = filtered.filter(d =>
        d.name.toLowerCase().includes(term) ||
        (d.creditor?.toLowerCase().includes(term)) ||
        (d.description?.toLowerCase().includes(term)) ||
        DEBT_CATEGORY_LABELS[d.category].toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [debts, viewMode, statusFilter, searchQuery]);

  // ==================== STATS ====================

  const stats = useMemo(() => {
    const active = debts.filter(d => d.status === 'active' || d.status === 'overdue');
    const fixedExpenses = active.filter(d => d.type === 'fixed_expense');
    const debtItems = active.filter(d => d.type === 'debt');
    const overdue = active.filter(d => d.status === 'overdue');

    // Monto periódico normalizado a mensual. one_time: cuenta 0 para gastos
    // fijos (no es recurrente) pero su monto completo para deudas.
    const monthlyAmount = (d: Debt, oneTimeFull: boolean): number => {
      switch (d.frequency) {
        case 'weekly': return d.amount * 4.33;
        case 'biweekly': return d.amount * 2.17;
        case 'monthly': return d.amount;
        case 'quarterly': return d.amount / 3;
        case 'yearly': return d.amount / 12;
        default: return oneTimeFull ? d.amount : 0;
      }
    };
    const curOf = (d: Debt): Currency => d.currency || 'DOP';

    const monthlyFixed = sumByCurrency(fixedExpenses, (d) => monthlyAmount(d, false), curOf);
    const monthlyDebt = sumByCurrency(debtItems, (d) => monthlyAmount(d, true), curOf);
    const totalMonthly: Record<Currency, number> = {
      DOP: monthlyFixed.DOP + monthlyDebt.DOP,
      USD: monthlyFixed.USD + monthlyDebt.USD,
    };
    const totalDebtRemaining = sumByCurrency(
      debtItems.filter(d => d.totalDebt),
      (d) => (d.totalDebt! - (d.totalPaid || 0)),
      curOf,
    );

    const upcomingDue = active.filter(d => {
      const days = getDaysUntilDue(d);
      return days !== null && days >= 0 && days <= 7;
    });

    return {
      totalMonthly,
      monthlyFixed,
      monthlyDebt,
      totalDebtRemaining,
      activeCount: active.length,
      overdueCount: overdue.length,
      fixedCount: fixedExpenses.length,
      debtCount: debtItems.length,
      upcomingDue,
    };
  }, [debts]);

  // ==================== RENDER ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
          <p className="text-sm text-gray-500">Cargando deudas y gastos fijos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ========== HEADER ========== */}
      <div className="bg-gradient-to-r from-rose-600 via-red-600 to-orange-600 rounded-xl px-4 py-3 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-6 h-6" />
            <div>
              <h1 className="text-xl font-bold">Deudas</h1>
              <p className="text-rose-100 text-xs">
                {stats.activeCount} obligaciones activas
                {stats.overdueCount > 0
                  ? <span className="ml-1">• {stats.overdueCount} vencidas</span>
                  : <span className="ml-1">• Todo al día</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSearch(!showSearch)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors" title="Buscar">
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 bg-white text-rose-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-rose-50 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Agregar</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========== STATS CARDS ========== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-rose-100 rounded-lg"><TrendingDown className="w-4 h-4 text-rose-600" /></div>
            <p className="text-xs text-gray-500">Total Mensual</p>
          </div>
          <p className="text-lg font-bold text-rose-600 leading-tight">{formatMoneyMulti(stats.totalMonthly)}</p>
          <span className="text-[10px] text-gray-400">{stats.activeCount} obligaciones activas</span>
        </div>
        <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-brand-navy/10 rounded-lg"><Home className="w-4 h-4 text-brand-navy" /></div>
            <p className="text-xs text-gray-500">Gastos Fijos</p>
          </div>
          <p className="text-lg font-bold text-brand-navy leading-tight">{formatMoneyMulti(stats.monthlyFixed)}</p>
          <span className="text-[10px] text-gray-400">{stats.fixedCount} gastos fijos</span>
        </div>
        <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-red-100 rounded-lg"><CreditCard className="w-4 h-4 text-red-600" /></div>
            <p className="text-xs text-gray-500">Cuotas Deuda</p>
          </div>
          <p className="text-lg font-bold text-red-600 leading-tight">{formatMoneyMulti(stats.monthlyDebt)}</p>
          <span className="text-[10px] text-gray-400">{stats.debtCount} deudas</span>
        </div>
        <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-amber-100 rounded-lg"><AlertTriangle className="w-4 h-4 text-amber-600" /></div>
            <p className="text-xs text-gray-500">Deuda Total</p>
          </div>
          <p className="text-lg font-bold text-gray-900 leading-tight">{formatMoneyMulti(stats.totalDebtRemaining)}</p>
          {stats.overdueCount > 0 ? (
            <span className="text-[10px] text-red-500 font-medium">{stats.overdueCount} vencidas</span>
          ) : (
            <span className="text-[10px] text-green-500">Todo al día</span>
          )}
        </div>
      </div>

      {/* ========== UPCOMING DUE ALERT ========== */}
      {stats.upcomingDue.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-amber-800">Próximos Vencimientos (7 días)</span>
          </div>
          <div className="space-y-1">
            {stats.upcomingDue.map(d => {
              const days = getDaysUntilDue(d);
              return (
                <div key={d.id} className="flex items-center justify-between text-xs">
                  <span className="text-amber-700">{d.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-800">{formatMoney(d.amount, d.currency || 'DOP')}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      days === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {days === 0 ? 'HOY' : `${days} días`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========== SEARCH BAR ========== */}
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, acreedor..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-transparent" />
        </div>
      )}

      {/* ========== TOOLBAR ========== */}
      <div className="flex flex-col gap-2">
        {/* Type filter */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {([
            { value: 'all' as ViewMode, label: 'Todos' },
            { value: 'fixed_expense' as ViewMode, label: 'Gastos Fijos' },
            { value: 'debt' as ViewMode, label: 'Deudas' },
          ]).map((tab) => (
            <button
              key={tab.value}
              onClick={() => setViewMode(tab.value)}
              className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${
                viewMode === tab.value
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1 flex-wrap">
          {(['all', 'active', 'overdue', 'paid', 'paused'] as StatusFilter[]).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all ${
                statusFilter === s
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}>
              {s === 'all' ? 'Todos' : STATUS_CONFIG[s as DebtStatus].label}
              {s !== 'all' && ` (${debts.filter(d => d.status === s).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* ========== DEBT LIST ========== */}
      {filteredDebts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
          <CircleDollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-600 mb-1">No hay registros</h3>
          <p className="text-xs text-gray-400 mb-4">
            {viewMode === 'fixed_expense' ? 'Agrega tus gastos fijos mensuales' :
             viewMode === 'debt' ? 'Registra tus deudas para llevar el control' :
             'Comienza agregando deudas o gastos fijos'}
          </p>
          <button onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors text-xs font-medium">
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDebts.map((debt) => {
            const CatIcon = DEBT_CATEGORY_ICONS[debt.category] || DollarSign;
            const catColor = DEBT_CATEGORY_COLORS[debt.category];
            const dueStatus = getDueStatus(debt);
            const daysLeft = getDaysUntilDue(debt);
            const debtProgress = debt.type === 'debt' && debt.totalDebt
              ? Math.round(((debt.totalPaid || 0) / debt.totalDebt) * 100)
              : null;
            const isExpanded = expandedId === debt.id;
            const StatusIcon = STATUS_CONFIG[debt.status].icon;

            return (
              <div key={debt.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                {/* Main Row */}
                <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : debt.id)}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: catColor + '15' }}>
                    <CatIcon className="w-5 h-5" style={{ color: catColor }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-900 truncate">{debt.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex items-center gap-0.5 ${STATUS_CONFIG[debt.status].bgColor} ${STATUS_CONFIG[debt.status].color}`}>
                        <StatusIcon className="w-2.5 h-2.5" />
                        {STATUS_CONFIG[debt.status].label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <span>{DEBT_CATEGORY_LABELS[debt.category]}</span>
                      <span>•</span>
                      <span>{FREQUENCY_LABELS[debt.frequency]}</span>
                      {debt.creditor && (
                        <>
                          <span>•</span>
                          <span>{debt.creditor}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">{formatMoney(debt.amount, debt.currency || 'DOP')}</p>
                    {debt.nextDueDate && debt.status === 'active' && (
                      <p className={`text-[10px] font-medium ${
                        dueStatus === 'overdue' ? 'text-red-500' :
                        dueStatus === 'due' ? 'text-red-500' :
                        dueStatus === 'soon' ? 'text-amber-500' : 'text-gray-400'
                      }`}>
                        {dueStatus === 'overdue' ? `Vencido hace ${Math.abs(daysLeft!)} días` :
                         dueStatus === 'due' ? 'Vence HOY' :
                         dueStatus === 'soon' ? `En ${daysLeft} días` :
                         format(debt.nextDueDate, 'dd MMM', { locale: es })}
                      </p>
                    )}
                  </div>

                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>

                {/* Debt Progress Bar */}
                {debtProgress !== null && (
                  <div className="px-4 pb-2">
                    <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                      <span>Pagado: {formatMoney(debt.totalPaid || 0, debt.currency || 'DOP')}</span>
                      <span>Total: {formatMoney(debt.totalDebt || 0, debt.currency || 'DOP')}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${
                        debtProgress >= 100 ? 'bg-green-500' : debtProgress >= 75 ? 'bg-brand-blue' : 'bg-rose-500'
                      }`} style={{ width: `${Math.min(debtProgress, 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-right mt-0.5 font-medium" style={{ color: catColor }}>
                      {debtProgress}% completado
                    </p>
                  </div>
                )}

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t px-4 py-3 bg-gray-50 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {debt.description && (
                        <div className="col-span-2">
                          <span className="text-gray-400 text-[10px] uppercase">Descripción</span>
                          <p className="text-gray-700">{debt.description}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-400 text-[10px] uppercase">Inicio</span>
                        <p className="text-gray-700">{format(debt.startDate, 'dd MMM yyyy', { locale: es })}</p>
                      </div>
                      {debt.endDate && (
                        <div>
                          <span className="text-gray-400 text-[10px] uppercase">Fin</span>
                          <p className="text-gray-700">{format(debt.endDate, 'dd MMM yyyy', { locale: es })}</p>
                        </div>
                      )}
                      {debt.interestRate && (
                        <div>
                          <span className="text-gray-400 text-[10px] uppercase">Tasa de Interés</span>
                          <p className="text-gray-700">{debt.interestRate}% anual</p>
                        </div>
                      )}
                      {debt.dueDay && (
                        <div>
                          <span className="text-gray-400 text-[10px] uppercase">Día de Vencimiento</span>
                          <p className="text-gray-700">Día {debt.dueDay} de cada mes</p>
                        </div>
                      )}
                      {debt.notes && (
                        <div className="col-span-2">
                          <span className="text-gray-400 text-[10px] uppercase">Notas</span>
                          <p className="text-gray-700">{debt.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Recent Payments */}
                    {debt.payments && debt.payments.length > 0 && (
                      <div>
                        <span className="text-gray-400 text-[10px] uppercase">Últimos Pagos</span>
                        <div className="mt-1 space-y-1">
                          {debt.payments.slice(-3).reverse().map((p, i) => (
                            <div key={i} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                <span className="text-gray-600">
                                  {p.date instanceof Date ? format(p.date, 'dd MMM yyyy', { locale: es }) : 'Fecha'}
                                </span>
                              </div>
                              <span className="font-bold text-green-600">{formatMoney(p.amount, debt.currency || 'DOP')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      {debt.status === 'active' && (
                        <button onClick={(e) => { e.stopPropagation(); openPaymentModal(debt); }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Registrar Pago
                        </button>
                      )}
                      {debt.status === 'active' && (
                        <button onClick={(e) => { e.stopPropagation(); toggleStatus(debt, 'paused'); }}
                          className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-xs font-medium">
                          <Pause className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {debt.status === 'paused' && (
                        <button onClick={(e) => { e.stopPropagation(); toggleStatus(debt, 'active'); }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-brand-navy text-white rounded-lg hover:bg-[#1a1870] transition-colors text-xs font-medium">
                          <Clock className="w-3.5 h-3.5" /> Reactivar
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(debt); }}
                        className="px-3 py-2 bg-brand-blue/10 text-brand-navy rounded-lg hover:bg-brand-blue/20 transition-colors text-xs font-medium">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(debt.id); }}
                        className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-xs font-medium">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========== MONTHLY BREAKDOWN ========== */}
      {debts.filter(d => d.status === 'active').length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-gray-600" />
            <h3 className="text-sm font-bold text-gray-900">Desglose Mensual por Categoría</h3>
          </div>
          <div className="space-y-2">
            {(() => {
              const monthlyOf = (d: Debt): number => {
                switch (d.frequency) {
                  case 'weekly': return d.amount * 4.33;
                  case 'biweekly': return d.amount * 2.17;
                  case 'quarterly': return d.amount / 3;
                  case 'yearly': return d.amount / 12;
                  default: return d.amount;
                }
              };
              const categoryTotals: Record<string, { totals: Record<Currency, number>; count: number }> = {};
              debts.filter(d => d.status === 'active').forEach(d => {
                const cur: Currency = d.currency || 'DOP';
                if (!categoryTotals[d.category]) categoryTotals[d.category] = { totals: { DOP: 0, USD: 0 }, count: 0 };
                categoryTotals[d.category].totals[cur] += monthlyOf(d);
                categoryTotals[d.category].count++;
              });
              // Orden y ancho de barra por el monto en DOP (moneda dominante); USD desempata.
              const sorted = Object.entries(categoryTotals).sort(
                ([, a], [, b]) => (b.totals.DOP - a.totals.DOP) || (b.totals.USD - a.totals.USD),
              );
              const maxAmount = sorted.reduce((m, [, d]) => Math.max(m, d.totals.DOP, d.totals.USD), 1);

              return sorted.map(([cat, data]) => {
                const CatIcon = DEBT_CATEGORY_ICONS[cat as DebtCategory] || DollarSign;
                const color = DEBT_CATEGORY_COLORS[cat as DebtCategory] || '#6b7280';
                const barBase = data.totals.DOP || data.totals.USD;
                const pct = Math.round((barBase / maxAmount) * 100);
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: color + '15' }}>
                      <CatIcon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-gray-700">{DEBT_CATEGORY_LABELS[cat as DebtCategory]}</span>
                        <span className="text-xs font-bold text-gray-900">{formatMoneyMulti(data.totals)}/mes</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          <div className="mt-3 pt-3 border-t flex items-center justify-between">
            <span className="text-xs text-gray-500">Total mensual estimado</span>
            <span className="text-sm font-bold text-gray-900">{formatMoneyMulti(stats.totalMonthly)}</span>
          </div>
        </div>
      )}

      {/* ========== CREATE/EDIT MODAL ========== */}
      {showModal && (
        <DebtFormModal
          isEditing={!!editingDebt}
          formData={formData}
          onFormChange={setFormData}
          onSubmit={handleSubmit}
          onClose={resetForm}
        />
      )}

      {/* ========== PAYMENT MODAL ========== */}
      {showPaymentModal && paymentDebt && (
        <PaymentModal
          debt={paymentDebt}
          paymentAmount={paymentAmount}
          paymentNote={paymentNote}
          onAmountChange={setPaymentAmount}
          onNoteChange={setPaymentNote}
          onConfirm={handleRecordPayment}
          onClose={() => setShowPaymentModal(false)}
        />
      )}
    </div>
  );
}
