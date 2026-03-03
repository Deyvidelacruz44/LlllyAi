'use client';

import { TransactionCategory } from '@/types';
import { X, Plus } from 'lucide-react';
import { CATEGORY_LABELS, EXPENSE_CATEGORIES } from './constants';

export interface BudgetFormData {
  category: TransactionCategory;
  amount: string;
  period: 'weekly' | 'monthly' | 'yearly';
}

interface BudgetModalProps {
  isEditing: boolean;
  formData: BudgetFormData;
  onFormChange: (data: BudgetFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function BudgetModal({
  isEditing,
  formData,
  onFormChange,
  onSubmit,
  onClose,
}: BudgetModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            {isEditing ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
            <select value={formData.category}
              onChange={(e) => onFormChange({ ...formData, category: e.target.value as TransactionCategory })}
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
              <input type="number" step="0.01" min="0" value={formData.amount}
                onChange={(e) => onFormChange({ ...formData, amount: e.target.value })}
                required placeholder="0.00"
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue text-sm font-bold" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Período</label>
            <select value={formData.period}
              onChange={(e) => onFormChange({ ...formData, period: e.target.value as BudgetFormData['period'] })}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-blue text-sm">
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensual</option>
              <option value="yearly">Anual</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit"
              className="flex-1 bg-brand-navy text-white py-2.5 rounded-xl hover:bg-[#1a1870] transition-colors font-medium text-sm">
              {isEditing ? 'Actualizar' : 'Crear'}
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
