/**
 * Smart Context Builder for Lilly AI
 * Builds rich, structured context from Firestore data for AI conversations.
 */
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs, limit, orderBy,
} from 'firebase/firestore';
import {
  startOfDay, endOfDay, addDays, startOfMonth, endOfMonth,
  isToday, isPast, isBefore, isAfter, format,
} from 'date-fns';
import { es } from 'date-fns/locale';

// ── Types ──────────────────────────────────────────────
export interface SmartContext {
  today: {
    date: string;
    dayName: string;
    time: string;
    greeting: string;
  };
  events: {
    today: ContextEvent[];
    tomorrow: ContextEvent[];
    thisWeek: ContextEvent[];
    total: number;
  };
  tasks: {
    overdue: ContextTask[];
    dueToday: ContextTask[];
    dueThisWeek: ContextTask[];
    urgent: ContextTask[];
    inProgress: ContextTask[];
    pending: number;
    completed: number;
    total: number;
  };
  finances: {
    monthIncome: number;
    monthExpenses: number;
    monthBalance: number;
    recentTransactions: ContextTransaction[];
    budgetAlerts: BudgetAlert[];
  };
  debts: {
    activeDebts: ContextDebt[];
    upcomingPayments: ContextDebt[];
    totalOwed: number;
  };
  receivables: {
    pending: ContextReceivable[];
    totalOwedToUser: number;
  };
  alerts: Alert[];
}

interface ContextEvent {
  id: string;
  title: string;
  type: string;
  startDate: string;
  endDate: string;
  location?: string;
}

interface ContextTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  category: string;
}

interface ContextTransaction {
  id: string;
  description: string;
  type: string;
  amount: number;
  category: string;
  date: string;
}

interface BudgetAlert {
  category: string;
  budgetAmount: number;
  spent: number;
  percentUsed: number;
}

interface ContextDebt {
  id: string;
  name: string;
  amount: number;
  totalDebt?: number;
  totalPaid?: number;
  nextDueDate?: string;
  status: string;
}

interface ContextReceivable {
  id: string;
  debtorName: string;
  totalAmount: number;
  amountPaid: number;
  remaining: number;
  dueDate?: string;
}

interface Alert {
  type: 'overdue_task' | 'event_today' | 'budget_warning' | 'debt_due' | 'receivable_overdue';
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

// ── Greeting Generator ──────────────────────────────────
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'Buenas madrugadas';
  if (hour < 12) return 'Buenos días';
  if (hour < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

// ── Main Context Builder ────────────────────────────────
export async function buildSmartContext(userId: string): Promise<SmartContext> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrowStart = startOfDay(addDays(now, 1));
  const tomorrowEnd = endOfDay(addDays(now, 1));
  const weekEnd = endOfDay(addDays(now, 7));
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Parallel fetch all data
  const [eventsSnap, tasksSnap, txSnap, budgetsSnap, debtsSnap, receivablesSnap] = await Promise.all([
    getDocs(query(collection(db, 'events'), where('userId', '==', userId), limit(50))),
    getDocs(query(collection(db, 'tasks'), where('userId', '==', userId), limit(50))),
    getDocs(query(collection(db, 'transactions'), where('userId', '==', userId), limit(50))),
    getDocs(query(collection(db, 'budgets'), where('userId', '==', userId), limit(20))).catch(() => ({ docs: [] })),
    getDocs(query(collection(db, 'debts'), where('userId', '==', userId), limit(30))).catch(() => ({ docs: [] })),
    getDocs(query(collection(db, 'receivables'), where('userId', '==', userId), limit(30))).catch(() => ({ docs: [] })),
  ]);

  // ── Process Events ──
  const allEvents = eventsSnap.docs.map(d => {
    const data = d.data();
    const startDate = data.startDate?.toDate?.() || new Date();
    const endDate = data.endDate?.toDate?.() || new Date();
    return {
      id: d.id,
      title: data.title,
      type: data.type,
      startDate,
      endDate,
      location: data.location,
    };
  });

  const todayEvents = allEvents
    .filter(e => e.startDate >= todayStart && e.startDate <= todayEnd)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const tomorrowEvents = allEvents
    .filter(e => e.startDate >= tomorrowStart && e.startDate <= tomorrowEnd)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const thisWeekEvents = allEvents
    .filter(e => e.startDate >= todayStart && e.startDate <= weekEnd)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const formatEvent = (e: typeof allEvents[0]): ContextEvent => ({
    id: e.id,
    title: e.title,
    type: e.type,
    startDate: format(e.startDate, "yyyy-MM-dd HH:mm"),
    endDate: format(e.endDate, "yyyy-MM-dd HH:mm"),
    location: e.location,
  });

  // ── Process Tasks ──
  const allTasks = tasksSnap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title,
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate?.toDate?.() || null,
      category: data.category || 'general',
    };
  });

  const activeTasks = allTasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');

  const overdueTasks = activeTasks
    .filter(t => t.dueDate && isPast(t.dueDate) && !isToday(t.dueDate))
    .sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0));

  const dueTodayTasks = activeTasks
    .filter(t => t.dueDate && isToday(t.dueDate));

  const dueThisWeekTasks = activeTasks
    .filter(t => t.dueDate && isAfter(t.dueDate, todayEnd) && isBefore(t.dueDate, weekEnd));

  const urgentTasks = activeTasks
    .filter(t => t.priority === 'urgent' || t.priority === 'high');

  const inProgressTasks = activeTasks
    .filter(t => t.status === 'in-progress');

  const formatTask = (t: typeof allTasks[0]): ContextTask => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate ? format(t.dueDate, 'yyyy-MM-dd') : undefined,
    category: t.category,
  });

  // ── Process Finances ──
  const allTransactions = txSnap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      description: data.description,
      type: data.type,
      amount: data.amount || 0,
      category: data.category || 'otro',
      date: data.date?.toDate?.() || new Date(),
    };
  });

  const monthTransactions = allTransactions.filter(t =>
    t.date >= monthStart && t.date <= monthEnd
  );

  const monthIncome = monthTransactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  const monthExpenses = monthTransactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const recentTx = allTransactions
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 10)
    .map(t => ({
      id: t.id,
      description: t.description,
      type: t.type,
      amount: t.amount,
      category: t.category,
      date: format(t.date, 'yyyy-MM-dd'),
    }));

  // Budget alerts
  const budgetAlerts: BudgetAlert[] = [];
  const budgets = budgetsSnap.docs.map(d => d.data());
  for (const budget of budgets) {
    const cat = budget.category;
    const budgetAmount = budget.amount || 0;
    const spent = monthTransactions
      .filter(t => t.type === 'expense' && t.category === cat)
      .reduce((s, t) => s + t.amount, 0);
    const percentUsed = budgetAmount > 0 ? Math.round((spent / budgetAmount) * 100) : 0;
    if (percentUsed >= 80) {
      budgetAlerts.push({ category: cat, budgetAmount, spent, percentUsed });
    }
  }

  // ── Process Debts ──
  const allDebts = debtsSnap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      amount: data.amount || 0,
      totalDebt: data.totalDebt || null,
      totalPaid: data.totalPaid || 0,
      nextDueDate: data.nextDueDate?.toDate?.() || null,
      status: data.status || 'active',
      type: data.type,
    };
  });

  const activeDebts = allDebts.filter(d => d.status === 'active');
  const upcomingPayments = activeDebts
    .filter(d => d.nextDueDate && isBefore(d.nextDueDate, weekEnd))
    .sort((a, b) => (a.nextDueDate?.getTime() || 0) - (b.nextDueDate?.getTime() || 0));

  const totalOwed = activeDebts.reduce((s, d) => {
    if (d.totalDebt) return s + (d.totalDebt - d.totalPaid);
    return s + d.amount;
  }, 0);

  const formatDebt = (d: typeof allDebts[0]): ContextDebt => ({
    id: d.id,
    name: d.name,
    amount: d.amount,
    totalDebt: d.totalDebt || undefined,
    totalPaid: d.totalPaid || undefined,
    nextDueDate: d.nextDueDate ? format(d.nextDueDate, 'yyyy-MM-dd') : undefined,
    status: d.status,
  });

  // ── Process Receivables ──
  const allReceivables = receivablesSnap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      debtorName: data.debtorName,
      totalAmount: data.totalAmount || 0,
      amountPaid: data.amountPaid || 0,
      dueDate: data.dueDate?.toDate?.() || null,
      status: data.status || 'pending',
    };
  });

  const pendingReceivables = allReceivables
    .filter(r => r.status !== 'paid' && r.status !== 'cancelled');

  const totalOwedToUser = pendingReceivables
    .reduce((s, r) => s + (r.totalAmount - r.amountPaid), 0);

  const formatReceivable = (r: typeof allReceivables[0]): ContextReceivable => ({
    id: r.id,
    debtorName: r.debtorName,
    totalAmount: r.totalAmount,
    amountPaid: r.amountPaid,
    remaining: r.totalAmount - r.amountPaid,
    dueDate: r.dueDate ? format(r.dueDate, 'yyyy-MM-dd') : undefined,
  });

  // ── Build Alerts ──
  const alerts: Alert[] = [];

  if (overdueTasks.length > 0) {
    alerts.push({
      type: 'overdue_task',
      severity: 'critical',
      message: `Tienes ${overdueTasks.length} tarea(s) vencida(s): ${overdueTasks.slice(0, 3).map(t => t.title).join(', ')}`,
    });
  }

  if (todayEvents.length > 0) {
    alerts.push({
      type: 'event_today',
      severity: 'info',
      message: `Hoy tienes ${todayEvents.length} evento(s): ${todayEvents.map(e => `${e.title} a las ${format(e.startDate, 'HH:mm')}`).join(', ')}`,
    });
  }

  for (const ba of budgetAlerts) {
    alerts.push({
      type: 'budget_warning',
      severity: ba.percentUsed >= 100 ? 'critical' : 'warning',
      message: `Presupuesto de ${ba.category}: ${ba.percentUsed}% usado ($${ba.spent.toLocaleString()} de $${ba.budgetAmount.toLocaleString()})`,
    });
  }

  for (const debt of upcomingPayments) {
    if (debt.nextDueDate && isPast(debt.nextDueDate)) {
      alerts.push({
        type: 'debt_due',
        severity: 'critical',
        message: `Pago vencido: ${debt.name} - $${debt.amount.toLocaleString()}`,
      });
    } else {
      alerts.push({
        type: 'debt_due',
        severity: 'warning',
        message: `Pago próximo: ${debt.name} - $${debt.amount.toLocaleString()} (${debt.nextDueDate ? format(debt.nextDueDate, 'dd MMM', { locale: es }) : ''})`,
      });
    }
  }

  for (const recv of pendingReceivables) {
    if (recv.dueDate && isPast(recv.dueDate)) {
      alerts.push({
        type: 'receivable_overdue',
        severity: 'warning',
        message: `Cobro vencido: ${recv.debtorName} te debe $${(recv.totalAmount - recv.amountPaid).toLocaleString()}`,
      });
    }
  }

  return {
    today: {
      date: format(now, 'yyyy-MM-dd'),
      dayName: format(now, 'EEEE', { locale: es }),
      time: format(now, 'HH:mm'),
      greeting: getGreeting(),
    },
    events: {
      today: todayEvents.map(formatEvent),
      tomorrow: tomorrowEvents.map(formatEvent),
      thisWeek: thisWeekEvents.slice(0, 15).map(formatEvent),
      total: allEvents.length,
    },
    tasks: {
      overdue: overdueTasks.map(formatTask),
      dueToday: dueTodayTasks.map(formatTask),
      dueThisWeek: dueThisWeekTasks.map(formatTask),
      urgent: urgentTasks.map(formatTask),
      inProgress: inProgressTasks.map(formatTask),
      pending: activeTasks.filter(t => t.status === 'pending').length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      total: allTasks.length,
    },
    finances: {
      monthIncome: monthIncome,
      monthExpenses: monthExpenses,
      monthBalance: monthIncome - monthExpenses,
      recentTransactions: recentTx,
      budgetAlerts,
    },
    debts: {
      activeDebts: activeDebts.map(formatDebt),
      upcomingPayments: upcomingPayments.map(formatDebt),
      totalOwed,
    },
    receivables: {
      pending: pendingReceivables.map(formatReceivable),
      totalOwedToUser,
    },
    alerts,
  };
}

// ── Generate Smart Greeting ─────────────────────────────
export function generateSmartGreeting(context: SmartContext, userName?: string): string {
  const { today, events, tasks, finances, alerts } = context;
  const name = userName ? `, ${userName}` : '';
  let greeting = `¡${today.greeting}${name}! 👋\n\n`;

  // Today's overview
  const parts: string[] = [];

  if (events.today.length > 0) {
    parts.push(`📅 **${events.today.length} evento(s) hoy**: ${events.today.map(e => e.title).join(', ')}`);
  } else {
    parts.push('📅 No tienes eventos para hoy');
  }

  if (tasks.overdue.length > 0) {
    parts.push(`🔴 **${tasks.overdue.length} tarea(s) vencida(s)** que necesitan atención`);
  }

  if (tasks.dueToday.length > 0) {
    parts.push(`⏰ **${tasks.dueToday.length} tarea(s) vence(n) hoy**`);
  }

  if (tasks.urgent.length > 0) {
    parts.push(`⚡ ${tasks.urgent.length} tarea(s) urgente(s) pendiente(s)`);
  }

  if (alerts.some(a => a.type === 'budget_warning')) {
    const budgetAlerts = alerts.filter(a => a.type === 'budget_warning');
    parts.push(`💰 ${budgetAlerts.length} alerta(s) de presupuesto`);
  }

  if (alerts.some(a => a.type === 'debt_due')) {
    const debtAlerts = alerts.filter(a => a.type === 'debt_due');
    parts.push(`💳 ${debtAlerts.length} pago(s) próximo(s)/vencido(s)`);
  }

  if (finances.monthBalance !== 0) {
    const sign = finances.monthBalance >= 0 ? '+' : '';
    parts.push(`📊 Balance del mes: ${sign}$${finances.monthBalance.toLocaleString()}`);
  }

  greeting += parts.join('\n');
  greeting += '\n\n¿En qué te puedo ayudar?';

  return greeting;
}

// ── Build prompt context string from SmartContext ────────
export function contextToPromptString(ctx: SmartContext): string {
  const sections: string[] = [];

  // Alerts (highest priority)
  if (ctx.alerts.length > 0) {
    sections.push('⚠️ ALERTAS ACTIVAS:');
    for (const alert of ctx.alerts) {
      const icon = alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : '🔵';
      sections.push(`${icon} ${alert.message}`);
    }
    sections.push('');
  }

  // Events
  sections.push('📅 EVENTOS:');
  if (ctx.events.today.length > 0) {
    sections.push(`Hoy (${ctx.events.today.length}):`);
    for (const e of ctx.events.today) {
      sections.push(`  - ${e.title} (${e.startDate.split(' ')[1]} - ${e.endDate.split(' ')[1]}) [${e.type}]${e.location ? ` en ${e.location}` : ''}`);
    }
  } else {
    sections.push('Hoy: Sin eventos');
  }
  if (ctx.events.tomorrow.length > 0) {
    sections.push(`Mañana (${ctx.events.tomorrow.length}):`);
    for (const e of ctx.events.tomorrow) {
      sections.push(`  - ${e.title} (${e.startDate.split(' ')[1]}) [${e.type}]`);
    }
  }
  if (ctx.events.thisWeek.length > ctx.events.today.length + ctx.events.tomorrow.length) {
    sections.push(`Esta semana: ${ctx.events.thisWeek.length} eventos total`);
  }
  sections.push('');

  // Tasks
  sections.push('📋 TAREAS:');
  sections.push(`  Total: ${ctx.tasks.total} | Pendientes: ${ctx.tasks.pending} | Completadas: ${ctx.tasks.completed}`);
  if (ctx.tasks.overdue.length > 0) {
    sections.push(`  🔴 VENCIDAS (${ctx.tasks.overdue.length}):`);
    for (const t of ctx.tasks.overdue.slice(0, 5)) {
      sections.push(`    - [${t.id}] ${t.title} (vencida: ${t.dueDate}) [${t.priority}]`);
    }
  }
  if (ctx.tasks.dueToday.length > 0) {
    sections.push(`  ⏰ Vencen hoy (${ctx.tasks.dueToday.length}):`);
    for (const t of ctx.tasks.dueToday) {
      sections.push(`    - [${t.id}] ${t.title} [${t.priority}]`);
    }
  }
  if (ctx.tasks.urgent.length > 0) {
    sections.push(`  ⚡ Urgentes (${ctx.tasks.urgent.length}):`);
    for (const t of ctx.tasks.urgent.slice(0, 5)) {
      sections.push(`    - [${t.id}] ${t.title} (${t.status}) ${t.dueDate ? `vence: ${t.dueDate}` : ''}`);
    }
  }
  if (ctx.tasks.inProgress.length > 0) {
    sections.push(`  🔄 En progreso (${ctx.tasks.inProgress.length}):`);
    for (const t of ctx.tasks.inProgress.slice(0, 5)) {
      sections.push(`    - [${t.id}] ${t.title}`);
    }
  }
  sections.push('');

  // Finances
  sections.push('💰 FINANZAS (este mes):');
  sections.push(`  Ingresos: $${ctx.finances.monthIncome.toLocaleString()}`);
  sections.push(`  Gastos: $${ctx.finances.monthExpenses.toLocaleString()}`);
  sections.push(`  Balance: $${ctx.finances.monthBalance.toLocaleString()}`);
  if (ctx.finances.budgetAlerts.length > 0) {
    sections.push('  ⚠️ Alertas de presupuesto:');
    for (const ba of ctx.finances.budgetAlerts) {
      sections.push(`    - ${ba.category}: ${ba.percentUsed}% usado`);
    }
  }
  if (ctx.finances.recentTransactions.length > 0) {
    sections.push(`  Últimas transacciones:`);
    for (const t of ctx.finances.recentTransactions.slice(0, 5)) {
      sections.push(`    - ${t.type === 'income' ? '+' : '-'}$${t.amount.toLocaleString()} ${t.description} (${t.category}, ${t.date})`);
    }
  }
  sections.push('');

  // Debts
  if (ctx.debts.activeDebts.length > 0) {
    sections.push('💳 DEUDAS / GASTOS FIJOS:');
    sections.push(`  Total adeudado: $${ctx.debts.totalOwed.toLocaleString()}`);
    for (const d of ctx.debts.activeDebts.slice(0, 5)) {
      sections.push(`    - ${d.name}: $${d.amount.toLocaleString()}/pago${d.nextDueDate ? ` (próximo: ${d.nextDueDate})` : ''}`);
    }
    sections.push('');
  }

  // Receivables
  if (ctx.receivables.pending.length > 0) {
    sections.push('📥 CUENTAS POR COBRAR:');
    sections.push(`  Total por cobrar: $${ctx.receivables.totalOwedToUser.toLocaleString()}`);
    for (const r of ctx.receivables.pending.slice(0, 5)) {
      sections.push(`    - ${r.debtorName}: $${r.remaining.toLocaleString()} pendiente`);
    }
    sections.push('');
  }

  return sections.join('\n');
}
