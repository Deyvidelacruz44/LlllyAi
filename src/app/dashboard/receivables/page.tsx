'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { Receivable, ReceivableStatus, ReceivablePaymentRecord } from '@/types';
import {
  Plus, Edit2, Trash2, X, Search, DollarSign, User, Phone,
  CheckCircle2, Clock, AlertCircle, Ban, ChevronDown,
  Loader2, Banknote, Users, CalendarDays, Bell,
  CircleDollarSign, MessageSquare, ArrowDownLeft, Filter,
  TrendingUp, FileText, HandCoins
} from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { es } from 'date-fns/locale';

// ==================== CONSTANTS ====================

type StatusFilter = 'all' | ReceivableStatus;

const STATUS_CONFIG: Record<ReceivableStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pending: { label: 'Pendiente', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', icon: Clock },
  partial: { label: 'Parcial', color: 'text-brand-navy', bgColor: 'bg-brand-blue/10 border-brand-blue/30', icon: ArrowDownLeft },
  paid: { label: 'Cobrado', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200', icon: CheckCircle2 },
  overdue: { label: 'Vencido', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', icon: AlertCircle },
  cancelled: { label: 'Cancelado', color: 'text-gray-500', bgColor: 'bg-gray-50 border-gray-200', icon: Ban },
};

const RECEIVABLE_CATEGORIES = [
  'Préstamo personal',
  'Trabajo/Servicio',
  'Venta',
  'Alquiler',
  'Negocio',
  'Familiar',
  'Otro',
];

// ==================== COMPONENT ====================

export default function ReceivablesPage() {
  const { user } = useAuth();
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentReceivable, setPaymentReceivable] = useState<Receivable | null>(null);
  const [editingReceivable, setEditingReceivable] = useState<Receivable | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  const [formData, setFormData] = useState({
    debtorName: '',
    debtorContact: '',
    description: '',
    totalAmount: '',
    dueDate: '',
    category: 'Préstamo personal',
    notes: '',
    status: 'pending' as ReceivableStatus,
  });

  useEffect(() => {
    if (user) loadReceivables();
  }, [user]);

  // ==================== DATA LOADING ====================

  const loadReceivables = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const ref = collection(db, 'receivables');
      const q = query(ref, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          ...raw,
          dueDate: raw.dueDate?.toDate(),
          createdAt: raw.createdAt?.toDate(),
          updatedAt: raw.updatedAt?.toDate(),
          payments: (raw.payments || []).map((p: Record<string, unknown>) => ({
            ...p,
            date: (p.date as { toDate: () => Date })?.toDate?.() || p.date,
          })),
          reminders: (raw.reminders || []).map((r: unknown) =>
            (r as { toDate: () => Date })?.toDate?.() || r
          ),
        } as Receivable;
      });
      // Overdue first, then pending/partial, then by due date
      data.sort((a, b) => {
        const priority: Record<string, number> = { overdue: 0, pending: 1, partial: 2, paid: 3, cancelled: 4 };
        const diff = (priority[a.status] ?? 5) - (priority[b.status] ?? 5);
        if (diff !== 0) return diff;
        const aDate = a.dueDate?.getTime() || Infinity;
        const bDate = b.dueDate?.getTime() || Infinity;
        return aDate - bDate;
      });
      setReceivables(data);
    } catch (error) {
      console.error('Error loading receivables:', error);
    } finally {
      setLoading(false);
    }
  };

  // ==================== CRUD ====================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const receivableData: Record<string, unknown> = {
        userId: user.uid,
        debtorName: formData.debtorName,
        debtorContact: formData.debtorContact || null,
        description: formData.description,
        totalAmount: parseFloat(formData.totalAmount),
        amountPaid: editingReceivable?.amountPaid || 0,
        dueDate: formData.dueDate ? Timestamp.fromDate(new Date(formData.dueDate + 'T12:00:00')) : null,
        status: formData.status,
        category: formData.category,
        notes: formData.notes || null,
        updatedAt: Timestamp.now(),
      };

      if (editingReceivable) {
        await updateDoc(doc(db, 'receivables', editingReceivable.id), receivableData);
      } else {
        await addDoc(collection(db, 'receivables'), {
          ...receivableData,
          amountPaid: 0,
          payments: [],
          reminders: [],
          createdAt: Timestamp.now(),
        });
      }

      resetForm();
      loadReceivables();
    } catch (error) {
      console.error('Error saving receivable:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este registro?')) return;
    try {
      await deleteDoc(doc(db, 'receivables', id));
      loadReceivables();
    } catch (error) {
      console.error('Error deleting receivable:', error);
    }
  };

  const handleEdit = (rec: Receivable) => {
    setEditingReceivable(rec);
    setFormData({
      debtorName: rec.debtorName,
      debtorContact: rec.debtorContact || '',
      description: rec.description,
      totalAmount: rec.totalAmount.toString(),
      dueDate: rec.dueDate ? format(rec.dueDate, 'yyyy-MM-dd') : '',
      category: rec.category || 'Otro',
      notes: rec.notes || '',
      status: rec.status,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      debtorName: '', debtorContact: '', description: '', totalAmount: '',
      dueDate: '', category: 'Préstamo personal', notes: '', status: 'pending',
    });
    setEditingReceivable(null);
    setShowModal(false);
  };

  // ==================== PAYMENT RECORDING ====================

  const openPaymentModal = (rec: Receivable) => {
    setPaymentReceivable(rec);
    const remaining = rec.totalAmount - (rec.amountPaid || 0);
    setPaymentAmount(remaining.toString());
    setPaymentNote('');
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async () => {
    if (!paymentReceivable || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);

    try {
      const newPayment = {
        id: Date.now().toString(),
        amount,
        date: Timestamp.now(),
        note: paymentNote || null,
      };

      const currentPayments = paymentReceivable.payments || [];
      const newAmountPaid = (paymentReceivable.amountPaid || 0) + amount;
      const isFullyPaid = newAmountPaid >= paymentReceivable.totalAmount;

      await updateDoc(doc(db, 'receivables', paymentReceivable.id), {
        payments: [...currentPayments.map(p => ({
          ...p,
          date: p.date instanceof Date ? Timestamp.fromDate(p.date) : p.date,
        })), newPayment],
        amountPaid: newAmountPaid,
        status: isFullyPaid ? 'paid' : 'partial',
        updatedAt: Timestamp.now(),
      });

      setShowPaymentModal(false);
      setPaymentReceivable(null);
      loadReceivables();
    } catch (error) {
      console.error('Error recording payment:', error);
    }
  };

  const markAsCancelled = async (rec: Receivable) => {
    if (!confirm('¿Marcar como cancelado? Esto indica que la deuda no se cobrará.')) return;
    try {
      await updateDoc(doc(db, 'receivables', rec.id), {
        status: 'cancelled',
        updatedAt: Timestamp.now(),
      });
      loadReceivables();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const recordReminder = async (rec: Receivable) => {
    try {
      const currentReminders = rec.reminders || [];
      await updateDoc(doc(db, 'receivables', rec.id), {
        reminders: [...currentReminders.map(r =>
          r instanceof Date ? Timestamp.fromDate(r) : r
        ), Timestamp.now()],
        updatedAt: Timestamp.now(),
      });
      loadReceivables();
    } catch (error) {
      console.error('Error recording reminder:', error);
    }
  };

  // ==================== FILTERING ====================

  const filteredReceivables = useMemo(() => {
    let filtered = [...receivables];

    if (statusFilter !== 'all') filtered = filtered.filter(r => r.status === statusFilter);
    if (searchQuery) {
      const term = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.debtorName.toLowerCase().includes(term) ||
        r.description.toLowerCase().includes(term) ||
        (r.category?.toLowerCase().includes(term)) ||
        (r.debtorContact?.toLowerCase().includes(term))
      );
    }

    return filtered;
  }, [receivables, statusFilter, searchQuery]);

  // ==================== STATS ====================

  const stats = useMemo(() => {
    const active = receivables.filter(r => r.status !== 'cancelled' && r.status !== 'paid');
    const totalPending = active.reduce((sum, r) => sum + (r.totalAmount - (r.amountPaid || 0)), 0);
    const totalCollected = receivables.reduce((sum, r) => sum + (r.amountPaid || 0), 0);
    const totalLent = receivables.filter(r => r.status !== 'cancelled').reduce((sum, r) => sum + r.totalAmount, 0);
    const overdueCount = active.filter(r => r.dueDate && isPast(r.dueDate)).length;
    const uniqueDebtors = new Set(active.map(r => r.debtorName.toLowerCase())).size;

    // Check and auto-mark overdue
    const overdueItems = active.filter(r =>
      r.status !== 'overdue' && r.dueDate && isPast(r.dueDate)
    );

    return {
      totalPending,
      totalCollected,
      totalLent,
      activeCount: active.length,
      overdueCount,
      uniqueDebtors,
      overdueItems,
      collectionRate: totalLent > 0 ? Math.round((totalCollected / totalLent) * 100) : 0,
    };
  }, [receivables]);

  // Auto-mark overdue
  useEffect(() => {
    stats.overdueItems.forEach(async (rec) => {
      try {
        await updateDoc(doc(db, 'receivables', rec.id), {
          status: 'overdue',
          updatedAt: Timestamp.now(),
        });
      } catch (e) { /* ignore */ }
    });
    if (stats.overdueItems.length > 0) {
      loadReceivables();
    }
  }, [stats.overdueItems.length]);

  // ==================== HELPERS ====================

  const getDaysInfo = (rec: Receivable): { text: string; color: string } | null => {
    if (!rec.dueDate) return null;
    const days = differenceInDays(rec.dueDate, new Date());
    if (days < 0) return { text: `Vencido hace ${Math.abs(days)} días`, color: 'text-red-500' };
    if (days === 0) return { text: 'Vence HOY', color: 'text-red-500' };
    if (days <= 7) return { text: `Vence en ${days} días`, color: 'text-amber-500' };
    return { text: format(rec.dueDate, 'dd MMM yyyy', { locale: es }), color: 'text-gray-400' };
  };

  const getProgressColor = (pct: number): string => {
    if (pct >= 100) return 'bg-green-500';
    if (pct >= 50) return 'bg-brand-blue';
    if (pct > 0) return 'bg-amber-500';
    return 'bg-gray-300';
  };

  // ==================== RENDER ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-navy animate-spin" />
          <p className="text-sm text-gray-500">Cargando cuentas por cobrar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ========== HEADER ========== */}
      <div className="bg-brand-navy rounded-xl px-4 py-3 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HandCoins className="w-6 h-6" />
            <div>
              <h1 className="text-xl font-bold">Cobros</h1>
              <p className="text-white/70 text-xs">
                {stats.activeCount} cuentas activas
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
              className="flex items-center gap-1.5 bg-white text-brand-navy px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-brand-blue/10 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nueva Cuenta</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========== STATS CARDS ========== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-brand-blue/20 rounded-lg"><HandCoins className="w-4 h-4 text-brand-navy" /></div>
            <p className="text-xs text-gray-500">Por Cobrar</p>
          </div>
          <p className="text-xl font-bold text-brand-navy">${Math.round(stats.totalPending).toLocaleString()}</p>
          <span className="text-[10px] text-gray-400">{stats.activeCount} cuentas activas</span>
        </div>
        <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-green-100 rounded-lg"><CheckCircle2 className="w-4 h-4 text-green-600" /></div>
            <p className="text-xs text-gray-500">Cobrado</p>
          </div>
          <p className="text-xl font-bold text-green-600">${Math.round(stats.totalCollected).toLocaleString()}</p>
          <span className="text-[10px] text-gray-400">Tasa: {stats.collectionRate}%</span>
        </div>
        <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-brand-blue/20 rounded-lg"><Users className="w-4 h-4 text-brand-navy" /></div>
            <p className="text-xs text-gray-500">Deudores</p>
          </div>
          <p className="text-xl font-bold text-brand-navy">{stats.uniqueDebtors}</p>
          <span className="text-[10px] text-gray-400">personas/entidades</span>
        </div>
        <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-red-100 rounded-lg"><AlertCircle className="w-4 h-4 text-red-600" /></div>
            <p className="text-xs text-gray-500">Vencidas</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{stats.overdueCount}</p>
          {stats.overdueCount > 0 ? (
            <span className="text-[10px] text-red-500 font-medium">Requieren atención</span>
          ) : (
            <span className="text-[10px] text-green-500">Todo al día</span>
          )}
        </div>
      </div>

      {/* ========== COLLECTION RATE BAR ========== */}
      {stats.totalLent > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-600" />
              <span className="text-xs font-bold text-gray-900">Tasa de Cobro General</span>
            </div>
            <span className="text-sm font-bold text-gray-900">{stats.collectionRate}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${getProgressColor(stats.collectionRate)}`}
              style={{ width: `${Math.min(stats.collectionRate, 100)}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400">
            <span>Cobrado: ${stats.totalCollected.toLocaleString()}</span>
            <span>Total prestado: ${stats.totalLent.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* ========== SEARCH BAR ========== */}
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, descripción..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent" />
        </div>
      )}

      {/* ========== TOOLBAR ========== */}
      <div className="flex flex-col gap-2">
        {/* Status filter */}
        <div className="flex gap-1 flex-wrap">
          {(['all', 'pending', 'partial', 'overdue', 'paid', 'cancelled'] as StatusFilter[]).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all ${
                statusFilter === s
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}>
              {s === 'all' ? 'Todos' : STATUS_CONFIG[s as ReceivableStatus].label}
              {s !== 'all' && ` (${receivables.filter(r => r.status === s).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* ========== RECEIVABLE LIST ========== */}
      {filteredReceivables.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
          <HandCoins className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-600 mb-1">No hay cuentas por cobrar</h3>
          <p className="text-xs text-gray-400 mb-4">
            Registra las deudas que te deben para llevar el control
          </p>
          <button onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-[#1a1870] transition-colors text-xs font-medium">
            <Plus className="w-4 h-4" /> Nueva Cuenta
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredReceivables.map((rec) => {
            const StatusIconComp = STATUS_CONFIG[rec.status].icon;
            const isExpanded = expandedId === rec.id;
            const paidPct = rec.totalAmount > 0 ? Math.round(((rec.amountPaid || 0) / rec.totalAmount) * 100) : 0;
            const remaining = rec.totalAmount - (rec.amountPaid || 0);
            const dueInfo = getDaysInfo(rec);

            return (
              <div key={rec.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                {/* Main Row */}
                <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : rec.id)}>
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-brand-navy flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-white font-bold text-sm">
                      {rec.debtorName.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-900 truncate">{rec.debtorName}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex items-center gap-0.5 ${STATUS_CONFIG[rec.status].bgColor} ${STATUS_CONFIG[rec.status].color}`}>
                        <StatusIconComp className="w-2.5 h-2.5" />
                        {STATUS_CONFIG[rec.status].label}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 truncate">{rec.description}</p>
                    {rec.category && (
                      <span className="text-[10px] text-gray-400">
                        {rec.category}
                      </span>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900">${remaining.toLocaleString()}</p>
                    {paidPct > 0 && paidPct < 100 && (
                      <p className="text-[10px] text-brand-navy font-medium">{paidPct}% cobrado</p>
                    )}
                    {paidPct >= 100 && (
                      <p className="text-[10px] text-green-500 font-medium">Cobrado ✓</p>
                    )}
                    {dueInfo && rec.status !== 'paid' && rec.status !== 'cancelled' && (
                      <p className={`text-[10px] ${dueInfo.color}`}>{dueInfo.text}</p>
                    )}
                  </div>

                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>

                {/* Progress Bar */}
                {paidPct > 0 && (
                  <div className="px-4 pb-2">
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${getProgressColor(paidPct)}`}
                        style={{ width: `${Math.min(paidPct, 100)}%` }} />
                    </div>
                  </div>
                )}

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t px-4 py-3 bg-gray-50 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-gray-400 text-[10px] uppercase">Monto Total</span>
                        <p className="text-gray-700 font-bold">${rec.totalAmount.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 text-[10px] uppercase">Pagado</span>
                        <p className="text-green-600 font-bold">${(rec.amountPaid || 0).toLocaleString()}</p>
                      </div>
                      {rec.debtorContact && (
                        <div>
                          <span className="text-gray-400 text-[10px] uppercase">Contacto</span>
                          <p className="text-gray-700 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {rec.debtorContact}
                          </p>
                        </div>
                      )}
                      {rec.dueDate && (
                        <div>
                          <span className="text-gray-400 text-[10px] uppercase">Vencimiento</span>
                          <p className="text-gray-700 flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" /> {format(rec.dueDate, 'dd MMM yyyy', { locale: es })}
                          </p>
                        </div>
                      )}
                      {rec.notes && (
                        <div className="col-span-2">
                          <span className="text-gray-400 text-[10px] uppercase">Notas</span>
                          <p className="text-gray-700">{rec.notes}</p>
                        </div>
                      )}
                      {rec.reminders && rec.reminders.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-gray-400 text-[10px] uppercase">Recordatorios Enviados</span>
                          <div className="flex gap-1 flex-wrap mt-1">
                            {rec.reminders.map((r, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded border border-amber-200">
                                {r instanceof Date ? format(r, 'dd/MM/yy', { locale: es }) : 'N/A'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Payment History */}
                    {rec.payments && rec.payments.length > 0 && (
                      <div>
                        <span className="text-gray-400 text-[10px] uppercase">Historial de Pagos</span>
                        <div className="mt-1 space-y-1">
                          {rec.payments.slice().reverse().map((p, i) => (
                            <div key={i} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg">
                              <div className="flex items-center gap-2">
                                <ArrowDownLeft className="w-3.5 h-3.5 text-green-500" />
                                <span className="text-gray-600">
                                  {p.date instanceof Date ? format(p.date, 'dd MMM yyyy', { locale: es }) : 'Fecha'}
                                </span>
                                {p.note && <span className="text-gray-400">— {p.note}</span>}
                              </div>
                              <span className="font-bold text-green-600">+${p.amount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Created date */}
                    {rec.createdAt && (
                      <p className="text-[10px] text-gray-400">
                        Registrado: {format(rec.createdAt, "dd MMM yyyy", { locale: es })}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1 flex-wrap">
                      {(rec.status === 'pending' || rec.status === 'partial' || rec.status === 'overdue') && (
                        <button onClick={(e) => { e.stopPropagation(); openPaymentModal(rec); }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium">
                          <DollarSign className="w-3.5 h-3.5" /> Registrar Cobro
                        </button>
                      )}
                      {(rec.status === 'pending' || rec.status === 'partial' || rec.status === 'overdue') && (
                        <button onClick={(e) => { e.stopPropagation(); recordReminder(rec); }}
                          className="px-3 py-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors text-xs font-medium flex items-center gap-1">
                          <Bell className="w-3.5 h-3.5" /> Recordar
                        </button>
                      )}
                      {rec.status !== 'cancelled' && rec.status !== 'paid' && (
                        <button onClick={(e) => { e.stopPropagation(); markAsCancelled(rec); }}
                          className="px-3 py-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors text-xs font-medium">
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(rec); }}
                        className="px-3 py-2 bg-brand-blue/10 text-brand-navy rounded-lg hover:bg-brand-blue/20 transition-colors text-xs font-medium">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(rec.id); }}
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

      {/* ========== DEBTORS SUMMARY ========== */}
      {receivables.filter(r => r.status !== 'cancelled' && r.status !== 'paid').length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-gray-600" />
            <h3 className="text-sm font-bold text-gray-900">Resumen por Deudor</h3>
          </div>
          <div className="space-y-2">
            {(() => {
              const debtorTotals: Record<string, { total: number; paid: number; count: number }> = {};
              receivables
                .filter(r => r.status !== 'cancelled' && r.status !== 'paid')
                .forEach(r => {
                  const name = r.debtorName;
                  if (!debtorTotals[name]) debtorTotals[name] = { total: 0, paid: 0, count: 0 };
                  debtorTotals[name].total += r.totalAmount;
                  debtorTotals[name].paid += (r.amountPaid || 0);
                  debtorTotals[name].count++;
                });
              const sorted = Object.entries(debtorTotals).sort(([, a], [, b]) =>
                (b.total - b.paid) - (a.total - a.paid)
              );

              return sorted.map(([name, data]) => {
                const remaining = data.total - data.paid;
                const pct = data.total > 0 ? Math.round((data.paid / data.total) * 100) : 0;
                return (
                  <div key={name} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-navy flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-[10px]">{name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-gray-700 font-medium">{name}</span>
                        <span className="text-xs font-bold text-gray-900">${remaining.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className={`h-full rounded-full transition-all duration-500 ${getProgressColor(pct)}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-gray-400">{data.count} cuenta{data.count > 1 ? 's' : ''}</span>
                        <span className="text-[10px] text-gray-400">{pct}% cobrado</span>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* ========== CREATE/EDIT MODAL ========== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={resetForm}>
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {editingReceivable ? 'Editar Cuenta' : 'Nueva Cuenta por Cobrar'}
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Debtor Name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">¿Quién te debe?</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={formData.debtorName}
                    onChange={(e) => setFormData({ ...formData, debtorName: e.target.value })}
                    required placeholder="Nombre de la persona/entidad"
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-transparent text-sm" />
                </div>
              </div>

              {/* Contact */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contacto (opcional)</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={formData.debtorContact}
                    onChange={(e) => setFormData({ ...formData, debtorContact: e.target.value })}
                    placeholder="Teléfono, email..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-transparent text-sm" />
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Monto Total</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">$</span>
                  <input type="number" step="0.01" min="0" value={formData.totalAmount}
                    onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                    required placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-transparent text-lg font-bold" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                <input type="text" value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required placeholder="Ej: Le presté para emergencia"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue focus:border-transparent text-sm" />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {RECEIVABLE_CATEGORIES.map((cat) => (
                    <button key={cat} type="button"
                      onClick={() => setFormData({ ...formData, category: cat })}
                      className={`py-1.5 px-2 rounded-lg border text-[10px] font-medium transition-all ${
                        formData.category === cat
                          ? 'border-brand-navy bg-brand-blue/10 text-brand-navy'
                          : 'border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                      }`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de Vencimiento (opcional)</label>
                <input type="date" value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue text-sm" />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notas (opcional)</label>
                <textarea value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notas adicionales..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue text-sm resize-none" />
              </div>

              {/* Status (when editing) */}
              {editingReceivable && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
                  <select value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ReceivableStatus })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue text-sm">
                    <option value="pending">Pendiente</option>
                    <option value="partial">Parcial</option>
                    <option value="paid">Cobrado</option>
                    <option value="overdue">Vencido</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
              )}

              {/* Submit */}
              <div className="flex gap-2 pt-2">
                <button type="submit"
                  className="flex-1 bg-brand-navy text-white py-2.5 rounded-xl hover:bg-[#1a1870] transition-colors font-medium text-sm">
                  {editingReceivable ? 'Actualizar' : 'Registrar'}
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

      {/* ========== PAYMENT MODAL ========== */}
      {showPaymentModal && paymentReceivable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Registrar Cobro</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="text-sm font-medium text-gray-900">{paymentReceivable.debtorName}</p>
              <p className="text-xs text-gray-500">{paymentReceivable.description}</p>
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-gray-500">Pendiente:</span>
                <span className="font-bold text-gray-900">
                  ${(paymentReceivable.totalAmount - (paymentReceivable.amountPaid || 0)).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Monto Cobrado</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">$</span>
                  <input type="number" step="0.01" min="0" value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg font-bold" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nota (opcional)</label>
                <input type="text" value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Ej: Pago parcial en efectivo"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 text-sm" />
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={handleRecordPayment}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-xl hover:bg-green-700 transition-colors font-medium text-sm">
                  <DollarSign className="w-4 h-4" /> Confirmar Cobro
                </button>
                <button onClick={() => setShowPaymentModal(false)}
                  className="px-5 bg-gray-100 text-gray-600 py-2.5 rounded-xl hover:bg-gray-200 transition-colors font-medium text-sm">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
