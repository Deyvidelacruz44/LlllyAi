export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';
export type EventType = 'personal' | 'work' | 'meeting' | 'reminder' | 'other';

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  category: string;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  tags?: string[];
}

export interface Event {
  id: string;
  userId: string;
  title: string;
  description?: string;
  type: EventType;
  startDate: Date;
  endDate: Date;
  location?: string;
  category: string;
  reminderMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  category: string;
  status: 'active' | 'completed' | 'archived';
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  taskIds: string[];
}

export interface ChatMessage {
  id: string;
  chatId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    action?: string;
    actionExecuted?: boolean;
    actionType?: 'event' | 'task';
    relatedItems?: string[];
  };
}

export interface Chat {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  lastMessage?: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  // Información básica
  name?: string;
  preferredLanguage: string;
  timezone?: string;
  // Preferencias de productividad
  workHoursStart?: string;
  workHoursEnd?: string;
  preferredTaskPriority?: Priority;
  defaultEventDuration?: number; // en minutos
  // Memoria de la IA - patrones aprendidos
  patterns: {
    frequentEventTypes?: string[];
    commonTaskCategories?: string[];
    preferredMeetingTimes?: string[];
    productivityPeakHours?: string[];
  };
  // Historial resumido para contexto
  summary: {
    totalEventsCreated: number;
    totalTasksCompleted: number;
    totalConversations: number;
    lastInteraction?: Date;
    commonRequests?: string[]; // Top solicitudes frecuentes
  };
  // Notas personales que la IA recuerda
  notes: string[];
  // Configuración de voz
  voiceSettings?: {
    autoRead: boolean;
    speed: number;
    pitch: number;
    enabled: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Analytics {
  id: string;
  userId: string;
  date: Date;
  metrics: {
    tasksCompleted: number;
    tasksCreated: number;
    eventsAttended: number;
    productivityScore: number;
    workHours: number;
    personalHours: number;
    topCategories: { category: string; count: number }[];
  };
  insights?: string[];
  recommendations?: string[];
  generatedAt: Date;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon?: string;
  type: 'work' | 'personal' | 'both';
}

// ========================================
// Finanzas
// ========================================

export type TransactionType = 'income' | 'expense' | 'transfer';

export type TransactionCategory =
  | 'salario'
  | 'freelance'
  | 'inversiones'
  | 'cobros_clientes'
  | 'alimentacion'
  | 'transporte'
  | 'vivienda'
  | 'servicios'
  | 'entretenimiento'
  | 'salud'
  | 'educacion'
  | 'ropa'
  | 'tecnologia'
  | 'ahorro'
  | 'deuda'
  | 'regalo'
  | 'otro';

/** Monedas soportadas. Por defecto todo es DOP (peso dominicano). */
export type Currency = 'DOP' | 'USD';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  currency?: Currency;      // default 'DOP' si no está presente
  description: string;
  date: Date;
  account?: string;
  tags?: string[];
  isRecurring?: boolean;
  recurringFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'yearly';
  archived?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Budget {
  id: string;
  userId: string;
  category: TransactionCategory;
  amount: number;
  period: 'weekly' | 'monthly' | 'yearly';
  startDate: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ========================================
// Deudas y Gastos Fijos
// ========================================

export type DebtType = 'fixed_expense' | 'debt';
export type DebtFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'one_time';
export type DebtStatus = 'active' | 'paid' | 'overdue' | 'paused';

export type DebtCategory =
  | 'alquiler'
  | 'hipoteca'
  | 'servicios_basicos'
  | 'internet_telefono'
  | 'seguro'
  | 'suscripcion'
  | 'prestamo_personal'
  | 'tarjeta_credito'
  | 'prestamo_vehiculo'
  | 'prestamo_estudiantil'
  | 'impuestos'
  | 'mantenimiento'
  | 'membresia'
  | 'otro_fijo';

export interface Debt {
  id: string;
  userId: string;
  type: DebtType;
  category: DebtCategory;
  name: string;
  description?: string;
  amount: number;           // Monto del pago periódico
  currency?: Currency;      // Moneda del monto — default 'DOP'
  totalDebt?: number;       // Deuda total (solo para type=debt)
  totalPaid?: number;       // Total ya pagado
  frequency: DebtFrequency;
  dueDay?: number;          // Día del mes en que vence (1-31)
  nextDueDate?: Date;
  startDate: Date;
  endDate?: Date;           // Fecha fin (para deudas con plazo)
  status: DebtStatus;
  creditor?: string;        // A quién se le debe
  interestRate?: number;    // Tasa de interés anual (%)
  notes?: string;
  lastPaidDate?: Date;
  payments?: DebtPayment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DebtPayment {
  id: string;
  amount: number;
  date: Date;
  note?: string;
}

// ========================================
// Cuentas por Cobrar
// ========================================

export type ReceivableStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';

export interface Receivable {
  id: string;
  userId: string;
  debtorName: string;
  debtorContact?: string;   // Teléfono o email del deudor
  description: string;
  totalAmount: number;       // Monto total que deben
  amountPaid: number;        // Cuánto han pagado
  currency?: Currency;       // Moneda del cobro — default 'DOP'
  dueDate?: Date;
  status: ReceivableStatus;
  category?: string;
  notes?: string;
  payments?: ReceivablePaymentRecord[];
  reminders?: Date[];        // Fechas de recordatorios enviados
  createdAt: Date;
  updatedAt: Date;
}

export interface ReceivablePaymentRecord {
  id: string;
  amount: number;
  date: Date;
  note?: string;
}
