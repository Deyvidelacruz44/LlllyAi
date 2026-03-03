import {
  Home, Wifi, Shield, CreditCard, GraduationCap, Car, Wrench,
  Receipt, DollarSign, Clock, CheckCircle2, Pause, AlertCircle,
  Banknote, Repeat, FileText, Zap,
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { DebtCategory, DebtFrequency, DebtStatus } from '@/types';

export const DEBT_CATEGORY_LABELS: Record<DebtCategory, string> = {
  alquiler: 'Alquiler',
  hipoteca: 'Hipoteca',
  servicios_basicos: 'Servicios Básicos',
  internet_telefono: 'Internet/Teléfono',
  seguro: 'Seguros',
  suscripcion: 'Suscripciones',
  prestamo_personal: 'Préstamo Personal',
  tarjeta_credito: 'Tarjeta de Crédito',
  prestamo_vehiculo: 'Préstamo Vehículo',
  prestamo_estudiantil: 'Préstamo Estudiantil',
  impuestos: 'Impuestos',
  mantenimiento: 'Mantenimiento',
  membresia: 'Membresía',
  otro_fijo: 'Otro',
};

export const DEBT_CATEGORY_ICONS: Record<DebtCategory, LucideIcon> = {
  alquiler: Home,
  hipoteca: Home,
  servicios_basicos: Zap,
  internet_telefono: Wifi,
  seguro: Shield,
  suscripcion: Repeat,
  prestamo_personal: Banknote,
  tarjeta_credito: CreditCard,
  prestamo_vehiculo: Car,
  prestamo_estudiantil: GraduationCap,
  impuestos: FileText,
  mantenimiento: Wrench,
  membresia: Receipt,
  otro_fijo: DollarSign,
};

export const DEBT_CATEGORY_COLORS: Record<DebtCategory, string> = {
  alquiler: '#8b5cf6',
  hipoteca: '#7c3aed',
  servicios_basicos: '#f59e0b',
  internet_telefono: '#3b82f6',
  seguro: '#06b6d4',
  suscripcion: '#ec4899',
  prestamo_personal: '#ef4444',
  tarjeta_credito: '#f43f5e',
  prestamo_vehiculo: '#f97316',
  prestamo_estudiantil: '#8b5cf6',
  impuestos: '#64748b',
  mantenimiento: '#14b8a6',
  membresia: '#a855f7',
  otro_fijo: '#6b7280',
};

export const FREQUENCY_LABELS: Record<DebtFrequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  yearly: 'Anual',
  one_time: 'Único',
};

export const STATUS_CONFIG: Record<DebtStatus, { label: string; color: string; bgColor: string; icon: LucideIcon }> = {
  active: { label: 'Activo', color: 'text-brand-navy', bgColor: 'bg-brand-blue/10 border-brand-blue/30', icon: Clock },
  paid: { label: 'Pagado', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200', icon: CheckCircle2 },
  overdue: { label: 'Vencido', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', icon: AlertCircle },
  paused: { label: 'Pausado', color: 'text-gray-600', bgColor: 'bg-gray-50 border-gray-200', icon: Pause },
};

export const FIXED_EXPENSE_CATEGORIES: DebtCategory[] = [
  'alquiler', 'hipoteca', 'servicios_basicos', 'internet_telefono',
  'seguro', 'suscripcion', 'impuestos', 'mantenimiento', 'membresia', 'otro_fijo',
];

export const DEBT_CATEGORIES: DebtCategory[] = [
  'prestamo_personal', 'tarjeta_credito', 'prestamo_vehiculo',
  'prestamo_estudiantil', 'otro_fijo',
];
