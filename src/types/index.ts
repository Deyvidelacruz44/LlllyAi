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

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  description: string;
  date: Date;
  account?: string;
  tags?: string[];
  isRecurring?: boolean;
  recurringFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'yearly';
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
