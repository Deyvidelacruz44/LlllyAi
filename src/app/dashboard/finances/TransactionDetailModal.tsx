'use client';

import { Transaction, TransactionCategory } from '@/types';
import { DollarSign, X, Calendar as CalendarIcon, Repeat, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CATEGORY_LABELS, CATEGORY_COLORS, CATEGORY_ACCENT, CATEGORY_ICONS, getAccountOption,
} from './constants';

interface TransactionDetailModalProps {
  transaction: Transaction;
  onClose: () => void;
  onEdit: (t: Transaction) => void;
  onDelete: (id: string) => void;
}

export default function TransactionDetailModal({
  transaction: t,
  onClose,
  onEdit,
  onDelete,
}: TransactionDetailModalProps) {
  const CatIcon = CATEGORY_ICONS[t.category] || DollarSign;
  const acctOpt = getAccountOption(t.account || 'principal');
  const AcctIcon = acctOpt.icon;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: CATEGORY_ACCENT[t.category] + '15' }}>
              <CatIcon className="w-6 h-6" style={{ color: CATEGORY_ACCENT[t.category] }} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[t.category]}`}>
                  {CATEGORY_LABELS[t.category]}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${t.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {t.type === 'income' ? 'Ingreso' : 'Gasto'}
                </span>
                {t.isRecurring && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand-navy/10 text-brand-navy flex items-center gap-0.5">
                    <Repeat className="w-3 h-3" /> {t.recurringFrequency || 'Recurrente'}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-gray-900">{t.description}</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center py-4 bg-gray-50 rounded-xl mb-4">
          <p className={`text-4xl font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
            {t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString()}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase mb-0.5">Fecha</p>
            <p className="text-sm text-gray-700 flex items-center gap-1">
              <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
              {format(t.date, 'dd MMM yyyy', { locale: es })}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-[10px] text-gray-400 uppercase mb-0.5">Cuenta</p>
            <p className="text-sm text-gray-700 flex items-center gap-1">
              <AcctIcon className="w-3.5 h-3.5" style={{ color: acctOpt.color }} />
              {acctOpt.label}
            </p>
          </div>
        </div>

        {t.createdAt && (
          <p className="text-[10px] text-gray-400 mb-4">
            Registrada: {format(t.createdAt, "dd MMM yyyy 'a las' HH:mm", { locale: es })}
          </p>
        )}

        <div className="flex gap-2 pt-3 border-t">
          <button onClick={() => { onEdit(t); onClose(); }}
            className="flex-1 flex items-center justify-center gap-2 bg-brand-navy text-white py-2 rounded-lg hover:bg-[#1a1870] transition-colors text-sm font-medium">
            <Edit2 className="w-4 h-4" /> Editar
          </button>
          <button onClick={() => { onClose(); onDelete(t.id); }}
            className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium">
            <Trash2 className="w-4 h-4" /> Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
