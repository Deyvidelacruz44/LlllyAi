import {
  TrendingUp, TrendingDown, AlertCircle, Target, Award, Wallet, PiggyBank,
  Coffee, Car, Home, Lightbulb, Zap, CreditCard, Banknote, Receipt, HandCoins,
  ShoppingCart,
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { TransactionCategory } from '@/types';

export const iconMap: Record<string, LucideIcon> = {
  TrendingUp, TrendingDown, AlertCircle, Target, Award, Wallet, PiggyBank,
};

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
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

export const CATEGORY_COLORS: Record<TransactionCategory, string> = {
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

export const CATEGORY_ACCENT: Record<TransactionCategory, string> = {
  salario: '#22c55e', freelance: '#10b981', inversiones: '#3b82f6',
  cobros_clientes: '#0891b2',
  alimentacion: '#f97316', transporte: '#eab308', vivienda: '#a855f7',
  servicios: '#6366f1', entretenimiento: '#ec4899', salud: '#ef4444',
  educacion: '#06b6d4', ropa: '#d946ef', tecnologia: '#64748b',
  ahorro: '#14b8a6', deuda: '#f43f5e', regalo: '#f59e0b', otro: '#6b7280',
};

export const CATEGORY_ICONS: Partial<Record<TransactionCategory, LucideIcon>> = {
  alimentacion: Coffee, transporte: Car, vivienda: Home,
  servicios: Lightbulb, entretenimiento: Zap, salud: Target,
  tecnologia: CreditCard, salario: Banknote, deuda: Receipt,
  cobros_clientes: HandCoins,
};

export const INCOME_CATEGORIES: TransactionCategory[] = ['salario', 'freelance', 'inversiones', 'cobros_clientes', 'regalo', 'otro'];
export const EXPENSE_CATEGORIES: TransactionCategory[] = [
  'alimentacion', 'transporte', 'vivienda', 'servicios', 'entretenimiento',
  'salud', 'educacion', 'ropa', 'tecnologia', 'ahorro', 'deuda', 'regalo', 'otro',
];

export const QUICK_ADD_ITEMS = [
  { label: 'Comida', category: 'alimentacion' as TransactionCategory, icon: Coffee, defaultAmount: '' },
  { label: 'Transporte', category: 'transporte' as TransactionCategory, icon: Car, defaultAmount: '' },
  { label: 'Servicios', category: 'servicios' as TransactionCategory, icon: Lightbulb, defaultAmount: '' },
  { label: 'Compras', category: 'ropa' as TransactionCategory, icon: ShoppingCart, defaultAmount: '' },
  { label: 'Entretenimiento', category: 'entretenimiento' as TransactionCategory, icon: Zap, defaultAmount: '' },
  { label: 'Salud', category: 'salud' as TransactionCategory, icon: Target, defaultAmount: '' },
];

// ==================== ACCOUNT OPTIONS ====================

export interface AccountOption {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

export const ACCOUNT_OPTIONS: AccountOption[] = [
  { value: 'banco', label: 'Banco', icon: CreditCard, color: '#3b82f6', bgColor: '#dbeafe' },
  { value: 'efectivo_tio_nano', label: 'Efectivo (Tío Nano)', icon: Banknote, color: '#22c55e', bgColor: '#dcfce7' },
  { value: 'efectivo_mami', label: 'Efectivo (Mami)', icon: Banknote, color: '#8b5cf6', bgColor: '#ede9fe' },
  { value: 'efectivo_yo', label: 'Efectivo (Yo)', icon: Wallet, color: '#f97316', bgColor: '#ffedd5' },
  { value: 'tarjeta_credito', label: 'Tarjeta Crédito', icon: CreditCard, color: '#ef4444', bgColor: '#fee2e2' },
  { value: 'inversiones', label: 'Inversiones', icon: TrendingUp, color: '#0891b2', bgColor: '#cffafe' },
];

export const getAccountOption = (value: string): AccountOption => {
  const found = ACCOUNT_OPTIONS.find(a => a.value === value);
  if (found) return found;
  if (!value || value === 'principal' || value === 'Principal' || value === 'banco_principal' || value === 'efectivo') {
    return ACCOUNT_OPTIONS[0];
  }
  return { value, label: value, icon: Wallet, color: '#6b7280', bgColor: '#f3f4f6' };
};
