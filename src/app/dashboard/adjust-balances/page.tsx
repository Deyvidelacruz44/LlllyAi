'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc, addDoc, Timestamp } from 'firebase/firestore';
import { ArrowLeft, AlertTriangle, CheckCircle, Loader2, Trash2, DollarSign, Plus, X } from 'lucide-react';
import Link from 'next/link';

interface BalanceEntry {
  id: string;
  account: string;
  description: string;
  amount: number;
}

const ACCOUNT_OPTIONS = [
  { value: 'banco', label: 'Banco' },
  { value: 'efectivo_yo', label: 'Efectivo (Yo)' },
  { value: 'efectivo_personal', label: 'Efectivo (Personal)' },
  { value: 'ahorro', label: 'Ahorro' },
  { value: 'tarjeta', label: 'Tarjeta' },
];

let nextId = 1;
const generateId = () => `entry-${nextId++}`;

export default function AdjustBalancesPage() {
  const { user } = useAuth();
  const [step, setStep] = useState<'configure' | 'confirm' | 'running' | 'done'>('configure');
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [entries, setEntries] = useState<BalanceEntry[]>([
    { id: generateId(), account: 'banco', description: 'Balance inicial - Banco', amount: 0 },
  ]);
  const [newAccount, setNewAccount] = useState('efectivo_yo');
  const [newDescription, setNewDescription] = useState('');
  const [newAmount, setNewAmount] = useState('');

  const total = entries.reduce((s, e) => s + e.amount, 0);

  const addEntry = () => {
    if (!newAmount || Number(newAmount) <= 0) return;
    const accountLabel = ACCOUNT_OPTIONS.find(a => a.value === newAccount)?.label || newAccount;
    setEntries(prev => [
      ...prev,
      {
        id: generateId(),
        account: newAccount,
        description: newDescription || `Balance inicial - ${accountLabel}`,
        amount: Number(newAmount),
      },
    ]);
    setNewDescription('');
    setNewAmount('');
  };

  const removeEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const updateEntryAmount = (id: string, amount: number) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, amount } : e));
  };

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  const runAdjustment = async () => {
    if (!user || entries.length === 0) return;
    setStep('running');
    setError('');

    try {
      // 1. Count existing transactions
      const ref = collection(db, 'transactions');
      const q = query(ref, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      addLog(`📊 Transacciones existentes: ${snapshot.size}`);

      // Show current balances
      const currentBalances: Record<string, number> = {};
      snapshot.docs.forEach(d => {
        const data = d.data();
        const acct = data.account || 'principal';
        if (!currentBalances[acct]) currentBalances[acct] = 0;
        if (data.type === 'income') currentBalances[acct] += data.amount;
        else if (data.type === 'expense') currentBalances[acct] -= data.amount;
      });

      for (const [acct, bal] of Object.entries(currentBalances)) {
        addLog(`   ${acct}: $${bal.toLocaleString()}`);
      }

      // 2. Delete all existing transactions
      addLog(`🗑️ Eliminando ${snapshot.size} transacciones...`);
      for (const d of snapshot.docs) {
        await deleteDoc(doc(db, 'transactions', d.id));
      }
      addLog(`✅ ${snapshot.size} transacciones eliminadas`);

      // 3. Create initial balance transactions
      addLog('💰 Creando balances iniciales...');
      const now = Timestamp.now();
      const dateTs = Timestamp.fromDate(new Date());

      for (const entry of entries) {
        await addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          type: 'income',
          category: 'salario',
          amount: entry.amount,
          description: entry.description,
          date: dateTs,
          account: entry.account,
          isRecurring: false,
          recurringFrequency: null,
          createdAt: now,
          updatedAt: now,
        });
        addLog(`   ✅ ${entry.description}: $${entry.amount.toLocaleString()}`);
      }

      addLog(`🎉 ¡Listo! Balance total: $${total.toLocaleString()}`);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setStep('confirm');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
      <Link href="/dashboard/finances" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a Finanzas
      </Link>

      <h1 className="text-xl font-bold text-gray-900 mb-1">Ajustar Balances</h1>
      <p className="text-sm text-gray-500 mb-6">
        Esta acción eliminará todas las transacciones existentes y creará los balances iniciales.
      </p>

      {/* Balance entries list */}
      <div className="bg-white rounded-xl border p-4 mb-4">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-600" />
          Balances a configurar
        </h3>

        {entries.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No hay entradas. Agrega al menos una para continuar.</p>
        ) : (
          <div className="space-y-2">
            {entries.map(b => (
              <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 gap-2">
                <span className="text-sm text-gray-700 flex-1 truncate">{b.description}</span>
                <input
                  type="number"
                  value={b.amount || ''}
                  onChange={(e) => updateEntryAmount(b.id, Number(e.target.value))}
                  className="w-28 px-2 py-1 text-sm text-right border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-blue font-bold text-green-600"
                  min={0}
                />
                <button onClick={() => removeEntry(b.id)} className="text-red-400 hover:text-red-600 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t-2 border-gray-200">
              <span className="text-sm font-bold text-gray-900">Total</span>
              <span className="text-base font-bold text-gray-900">${total.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Add new entry */}
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
          <p className="text-xs font-medium text-gray-500">Agregar cuenta</p>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newAccount}
              onChange={(e) => setNewAccount(e.target.value)}
              className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-blue"
            >
              {ACCOUNT_OPTIONS.map(a => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
            <input
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="Monto"
              min={0}
              className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-blue"
            />
          </div>
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Descripción (opcional)"
            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-blue"
          />
          <button
            onClick={addEntry}
            disabled={!newAmount || Number(newAmount) <= 0}
            className="w-full py-2 text-sm font-medium bg-brand-navy text-white rounded-lg hover:bg-[#1a1870] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Agregar
          </button>
        </div>
      </div>

      {/* Action / Status */}
      {step === 'configure' && entries.length > 0 && (
        <button
          onClick={() => setStep('confirm')}
          className="w-full py-3 bg-brand-navy hover:bg-[#1a1870] text-white rounded-xl font-medium text-sm transition-colors"
        >
          Continuar →
        </button>
      )}

      {step === 'confirm' && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">¡Atención!</p>
              <p className="text-xs text-amber-700 mt-1">
                Se eliminarán TODAS las transacciones existentes y se crearán {entries.length} nueva(s) transacción(es) de ingreso como balance inicial.
              </p>
            </div>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setStep('configure')}
              className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium text-sm transition-colors"
            >
              ← Volver
            </button>
            <button
              onClick={runAdjustment}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Confirmar
            </button>
          </div>
        </div>
      )}

      {step === 'running' && (
        <div className="flex items-center gap-2 text-sm text-blue-600 mb-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Procesando...
        </div>
      )}

      {step === 'done' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3 mb-4">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800">¡Balances configurados!</p>
            <p className="text-xs text-green-700 mt-1">
              Vuelve a la página de finanzas para ver los cambios.
            </p>
          </div>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-4 mt-4 max-h-60 overflow-y-auto">
          {logs.map((log, i) => (
            <p key={i} className="text-xs text-green-400 font-mono leading-relaxed">{log}</p>
          ))}
        </div>
      )}

      {step === 'done' && (
        <Link href="/dashboard/finances"
          className="mt-4 block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm text-center transition-colors">
          Ir a Finanzas →
        </Link>
      )}
    </div>
  );
}
