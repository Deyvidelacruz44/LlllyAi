'use client';

import { TransactionType, TransactionCategory } from '@/types';
import { X, ArrowUpCircle, ArrowDownCircle, DollarSign, Repeat } from 'lucide-react';
import {
  CATEGORY_LABELS, CATEGORY_ICONS, INCOME_CATEGORIES, EXPENSE_CATEGORIES, ACCOUNT_OPTIONS,
} from './constants';

export interface TransactionFormData {
  type: TransactionType;
  category: TransactionCategory;
  amount: string;
  description: string;
  date: string;
  account: string;
  isRecurring: boolean;
  recurringFrequency: 'weekly' | 'biweekly' | 'monthly' | 'yearly';
}

interface TransactionModalProps {
  isEditing: boolean;
  formData: TransactionFormData;
  onFormChange: (data: TransactionFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function TransactionModal({
  isEditing,
  formData,
  onFormChange,
  onSubmit,
  onClose,
}: TransactionModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            {isEditing ? 'Editar Transacción' : 'Nueva Transacción'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          {/* Type selector */}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onFormChange({ ...formData, type: 'income', category: 'salario' })}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-medium text-sm transition-all ${
                formData.type === 'income' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
              <ArrowUpCircle className="w-4 h-4" /> Ingreso
            </button>
            <button type="button" onClick={() => onFormChange({ ...formData, type: 'expense', category: 'otro' })}
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
                onChange={(e) => onFormChange({ ...formData, amount: e.target.value })}
                required placeholder="0.00"
                className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-lg font-bold" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
            <input type="text" value={formData.description}
              onChange={(e) => onFormChange({ ...formData, description: e.target.value })}
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
                  <button key={cat} type="button" onClick={() => onFormChange({ ...formData, category: cat })}
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
                onChange={(e) => onFormChange({ ...formData, date: e.target.value })}
                required className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cuenta / Ubicación</label>
              <select value={ACCOUNT_OPTIONS.some(a => a.value === formData.account) ? formData.account : (formData.account ? '__custom__' : 'banco_principal')}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    onFormChange({ ...formData, account: '' });
                  } else {
                    onFormChange({ ...formData, account: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm">
                {ACCOUNT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
                <option value="__custom__">Otra cuenta...</option>
              </select>
              {formData.account !== '' && !ACCOUNT_OPTIONS.some(a => a.value === formData.account) && (
                <input type="text" value={formData.account}
                  onChange={(e) => onFormChange({ ...formData, account: e.target.value })}
                  placeholder="Nombre de la cuenta"
                  className="w-full mt-1.5 px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm"
                  autoFocus />
              )}
            </div>
          </div>

          {/* Recurring Toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-brand-navy" />
              <span className="text-sm text-gray-700">Transacción recurrente</span>
            </div>
            <button type="button"
              onClick={() => onFormChange({ ...formData, isRecurring: !formData.isRecurring })}
              className={`relative w-10 h-5 rounded-full transition-colors ${formData.isRecurring ? 'bg-brand-navy' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${formData.isRecurring ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {formData.isRecurring && (
            <select value={formData.recurringFrequency}
              onChange={(e) => onFormChange({ ...formData, recurringFrequency: e.target.value as TransactionFormData['recurringFrequency'] })}
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
              {isEditing ? 'Actualizar' : 'Registrar'}
            </button>
            <button type="button" onClick={onClose}
              className="px-5 bg-gray-100 text-gray-600 py-2.5 rounded-xl hover:bg-gray-200 transition-colors font-medium text-sm">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
