'use client';

import { Debt } from '@/types';
import { X, CheckCircle2 } from 'lucide-react';
import { formatMoney, CURRENCY_SYMBOL } from '@/lib/format';

interface PaymentModalProps {
  debt: Debt;
  paymentAmount: string;
  paymentNote: string;
  onAmountChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export default function PaymentModal({
  debt,
  paymentAmount,
  paymentNote,
  onAmountChange,
  onNoteChange,
  onConfirm,
  onClose,
}: PaymentModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Registrar Pago</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-4">
          <p className="text-sm font-medium text-gray-900">{debt.name}</p>
          <p className="text-xs text-gray-500">Cuota: {formatMoney(debt.amount, debt.currency || 'DOP')}</p>
          {debt.totalDebt && (
            <p className="text-xs text-gray-500">
              Pendiente: {formatMoney((debt.totalDebt || 0) - (debt.totalPaid || 0), debt.currency || 'DOP')}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Monto del Pago</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">{CURRENCY_SYMBOL[debt.currency || 'DOP']}</span>
              <input type="number" step="0.01" min="0" value={paymentAmount}
                onChange={(e) => onAmountChange(e.target.value)}
                className="w-full pl-12 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg font-bold" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nota (opcional)</label>
            <input type="text" value={paymentNote}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Ej: Pago mensual"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 text-sm" />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onConfirm}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-xl hover:bg-green-700 transition-colors font-medium text-sm">
              <CheckCircle2 className="w-4 h-4" /> Confirmar Pago
            </button>
            <button onClick={onClose}
              className="px-5 bg-gray-100 text-gray-600 py-2.5 rounded-xl hover:bg-gray-200 transition-colors font-medium text-sm">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
