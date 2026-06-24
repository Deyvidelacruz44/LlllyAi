'use client';

import { DebtType, DebtCategory, DebtFrequency, DebtStatus, Currency } from '@/types';
import { X, Home, CreditCard, DollarSign } from 'lucide-react';
import { CURRENCY_SYMBOL } from '@/lib/format';
import {
  DEBT_CATEGORY_LABELS, DEBT_CATEGORY_ICONS, FREQUENCY_LABELS,
  FIXED_EXPENSE_CATEGORIES, DEBT_CATEGORIES,
} from './constants';

export interface DebtFormData {
  type: DebtType;
  category: DebtCategory;
  name: string;
  description: string;
  amount: string;
  currency: Currency;
  totalDebt: string;
  frequency: DebtFrequency;
  dueDay: string;
  startDate: string;
  endDate: string;
  creditor: string;
  interestRate: string;
  notes: string;
  status: DebtStatus;
}

interface DebtFormModalProps {
  isEditing: boolean;
  formData: DebtFormData;
  onFormChange: (data: DebtFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function DebtFormModal({
  isEditing,
  formData,
  onFormChange,
  onSubmit,
  onClose,
}: DebtFormModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            {isEditing ? 'Editar Registro' : 'Nueva Deuda / Gasto Fijo'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {/* Type Selector */}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onFormChange({ ...formData, type: 'fixed_expense', category: 'servicios_basicos' })}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-medium text-sm transition-all ${
                formData.type === 'fixed_expense' ? 'border-brand-navy bg-brand-navy/10 text-brand-navy' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
              <Home className="w-4 h-4" /> Gasto Fijo
            </button>
            <button type="button" onClick={() => onFormChange({ ...formData, type: 'debt', category: 'prestamo_personal' })}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-medium text-sm transition-all ${
                formData.type === 'debt' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
              <CreditCard className="w-4 h-4" /> Deuda
            </button>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
            <input type="text" value={formData.name}
              onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
              required placeholder={formData.type === 'fixed_expense' ? 'Ej: Alquiler departamento' : 'Ej: Préstamo banco'}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent text-sm" />
          </div>

          {/* Amount + Currency */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {formData.type === 'debt' ? 'Monto de Cuota' : 'Monto'}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">{CURRENCY_SYMBOL[formData.currency]}</span>
                <input type="number" step="0.01" min="0" value={formData.amount}
                  onChange={(e) => onFormChange({ ...formData, amount: e.target.value })}
                  required placeholder="0.00"
                  className="w-full pl-12 pr-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent text-lg font-bold" />
              </div>
              <div className="flex bg-gray-100 rounded-xl p-1">
                {(['DOP', 'USD'] as Currency[]).map((cur) => (
                  <button key={cur} type="button"
                    onClick={() => onFormChange({ ...formData, currency: cur })}
                    className={`px-3 rounded-lg text-xs font-bold transition-all ${
                      formData.currency === cur ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {CURRENCY_SYMBOL[cur]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Total Debt (only for debts) */}
          {formData.type === 'debt' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Deuda Total</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">{CURRENCY_SYMBOL[formData.currency]}</span>
                <input type="number" step="0.01" min="0" value={formData.totalDebt}
                  onChange={(e) => onFormChange({ ...formData, totalDebt: e.target.value })}
                  placeholder="Total de la deuda"
                  className="w-full pl-11 pr-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent text-sm" />
              </div>
            </div>
          )}

          {/* Category - Grid */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
            <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1">
              {(formData.type === 'fixed_expense' ? FIXED_EXPENSE_CATEGORIES : DEBT_CATEGORIES).map((cat) => {
                const CatIcon = DEBT_CATEGORY_ICONS[cat] || DollarSign;
                return (
                  <button key={cat} type="button" onClick={() => onFormChange({ ...formData, category: cat })}
                    className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border text-[10px] transition-all ${
                      formData.category === cat
                        ? 'border-rose-500 bg-rose-50 text-rose-700 font-medium'
                        : 'border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                    }`}>
                    <CatIcon className="w-4 h-4" />
                    {DEBT_CATEGORY_LABELS[cat]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Frequency & Due Day */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Frecuencia</label>
              <select value={formData.frequency}
                onChange={(e) => onFormChange({ ...formData, frequency: e.target.value as DebtFrequency })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 text-sm">
                {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Día de Vencimiento</label>
              <input type="number" min="1" max="31" value={formData.dueDay}
                onChange={(e) => onFormChange({ ...formData, dueDay: e.target.value })}
                placeholder="1-31"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 text-sm" />
            </div>
          </div>

          {/* Creditor & Interest */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Acreedor</label>
              <input type="text" value={formData.creditor}
                onChange={(e) => onFormChange({ ...formData, creditor: e.target.value })}
                placeholder="Banco, persona..."
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 text-sm" />
            </div>
            {formData.type === 'debt' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Interés (%)</label>
                <input type="number" step="0.01" min="0" value={formData.interestRate}
                  onChange={(e) => onFormChange({ ...formData, interestRate: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 text-sm" />
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha Inicio</label>
              <input type="date" value={formData.startDate}
                onChange={(e) => onFormChange({ ...formData, startDate: e.target.value })}
                required className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha Fin (opcional)</label>
              <input type="date" value={formData.endDate}
                onChange={(e) => onFormChange({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 text-sm" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción (opcional)</label>
            <input type="text" value={formData.description}
              onChange={(e) => onFormChange({ ...formData, description: e.target.value })}
              placeholder="Detalles adicionales..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 text-sm" />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notas (opcional)</label>
            <textarea value={formData.notes}
              onChange={(e) => onFormChange({ ...formData, notes: e.target.value })}
              placeholder="Notas..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 text-sm resize-none" />
          </div>

          {/* Status (when editing) */}
          {isEditing && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
              <select value={formData.status}
                onChange={(e) => onFormChange({ ...formData, status: e.target.value as DebtStatus })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 text-sm">
                <option value="active">Activo</option>
                <option value="paid">Pagado</option>
                <option value="paused">Pausado</option>
                <option value="overdue">Vencido</option>
              </select>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-2 pt-2">
            <button type="submit"
              className="flex-1 bg-rose-600 text-white py-2.5 rounded-xl hover:bg-rose-700 transition-colors font-medium text-sm">
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
