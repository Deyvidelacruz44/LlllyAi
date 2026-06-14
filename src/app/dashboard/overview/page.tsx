'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { 
  Calendar, ListTodo, CheckCircle, Clock, AlertCircle,
  BarChart3, ArrowRight, Sparkles, CalendarClock, Loader2, Brain,
  Zap, Award, Target, LucideIcon, Wallet, ArrowUpCircle, ArrowDownCircle, TrendingUp, RefreshCw
} from 'lucide-react';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { format, isToday, isTomorrow, isPast, isThisWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

interface Event {
  id: string;
  title: string;
  type: string;
  startDate: Date;
  endDate: Date;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
}

interface AIInsight {
  type: 'success' | 'warning' | 'info' | 'alert';
  title: string;
  message: string;
  icon: string | LucideIcon;
}

// Mapeador de iconos de string a componentes
const iconMap: Record<string, LucideIcon> = {
  'AlertCircle': AlertCircle,
  'Zap': Zap,
  'CalendarClock': CalendarClock,
  'Award': Award,
  'Target': Target,
  'Brain': Brain,
  'Clock': Clock,
  'CheckCircle': CheckCircle,
};

export default function OverviewPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [stats, setStats] = useState({
    todayEvents: 0,
    tomorrowEvents: 0,
    thisWeekEvents: 0,
    pendingTasks: 0,
    urgentTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    totalEvents: 0,
    totalTasks: 0,
  });
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [priorityTasks, setPriorityTasks] = useState<Task[]>([]);
  const [financeStats, setFinanceStats] = useState({ income: 0, expenses: 0, balance: 0, count: 0 });
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [aiSummary, setAiSummary] = useState<string>('');

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async (forceAnalysis = false) => {
    if (!user) return;

    setLoading(true);
    try {
      const now = new Date();

      // Cargar eventos - Query optimizada sin orderBy múltiple
      const eventsRef = collection(db, 'events');
      const eventsQuery = query(
        eventsRef,
        where('userId', '==', user.uid),
        limit(100)
      );
      const eventsSnapshot = await getDocs(eventsQuery);
      
      const events = eventsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          type: data.type,
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date(),
        };
      }).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

      // Cargar tareas - Query optimizada
      const tasksRef = collection(db, 'tasks');
      const tasksQuery = query(
        tasksRef,
        where('userId', '==', user.uid),
        limit(100)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      
      const tasks = tasksSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          status: data.status,
          priority: data.priority,
          dueDate: data.dueDate?.toDate() || null,
        };
      });

      // Calcular estadísticas
      const todayEventsCount = events.filter(e => isToday(e.startDate)).length;
      const tomorrowEventsCount = events.filter(e => isTomorrow(e.startDate)).length;
      const thisWeekEventsCount = events.filter(e => isThisWeek(e.startDate, { weekStartsOn: 1 })).length;
      const pendingTasksCount = tasks.filter(t => t.status === 'pending').length;
      const urgentTasksCount = tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length;
      const completedTasksCount = tasks.filter(t => t.status === 'completed').length;
      const overdueTasksCount = tasks.filter(t => 
        t.status !== 'completed' && t.dueDate && isPast(t.dueDate) && !isToday(t.dueDate)
      ).length;

      setStats({
        todayEvents: todayEventsCount,
        tomorrowEvents: tomorrowEventsCount,
        thisWeekEvents: thisWeekEventsCount,
        pendingTasks: pendingTasksCount,
        urgentTasks: urgentTasksCount,
        completedTasks: completedTasksCount,
        overdueTasks: overdueTasksCount,
        totalEvents: events.length,
        totalTasks: tasks.length,
      });

      // Load finance stats for current month
      try {
        const txRef = collection(db, 'transactions');
        const txQuery = query(txRef, where('userId', '==', user.uid));
        const txSnapshot = await getDocs(txQuery);
        const now = new Date();
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        let monthIncome = 0, monthExpenses = 0, monthCount = 0;
        txSnapshot.docs.forEach((d) => {
          const raw = d.data();
          const date = raw.date?.toDate();
          if (date && isWithinInterval(date, { start: monthStart, end: monthEnd })) {
            monthCount++;
            if (raw.type === 'income') monthIncome += raw.amount || 0;
            else if (raw.type === 'expense') monthExpenses += raw.amount || 0;
          }
        });
        setFinanceStats({ income: monthIncome, expenses: monthExpenses, balance: monthIncome - monthExpenses, count: monthCount });
      } catch (err) {
        console.error('Error loading finance stats:', err);
      }

      // Próximos 5 eventos
      const upcoming = events
        .filter(e => e.startDate >= now)
        .slice(0, 5);
      setUpcomingEvents(upcoming);

      // Top 5 tareas prioritarias
      const priority = tasks
        .filter(t => t.status !== 'completed')
        .sort((a, b) => {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
        })
        .slice(0, 5);
      setPriorityTasks(priority);

      setLoading(false);

      // Generar análisis con IA (cacheado — no se regenera en cada visita)
      await generateAIAnalysis(events, tasks, {
        todayEvents: todayEventsCount,
        tomorrowEvents: tomorrowEventsCount,
        thisWeekEvents: thisWeekEventsCount,
        pendingTasks: pendingTasksCount,
        urgentTasks: urgentTasksCount,
        completedTasks: completedTasksCount,
        overdueTasks: overdueTasksCount,
        totalEvents: events.length,
        totalTasks: tasks.length,
      }, forceAnalysis);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setLoading(false);
    }
  };

  // Reusa el análisis durante 6h. Solo se regenera si pasó la ventana o si el
  // usuario lo pide explícitamente (botón). Así no se gasta IA en cada visita.
  const ANALYSIS_TTL_MS = 6 * 60 * 60 * 1000;

  const generateAIAnalysis = async (events: Event[], tasks: Task[], statistics: any, force = false) => {
    const cacheKey = user ? `lilly-analysis-${user.uid}` : null;

    // Intentar usar el análisis cacheado si sigue fresco
    if (!force && cacheKey && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const cached = JSON.parse(raw) as { summary: string; insights: AIInsight[]; generatedAt: number };
          if (cached.generatedAt && Date.now() - cached.generatedAt < ANALYSIS_TTL_MS) {
            setAiSummary(cached.summary || '');
            setAiInsights(cached.insights || []);
            return; // No regenerar — usamos el cache
          }
        }
      } catch { /* cache corrupto — regenerar */ }
    }

    setAiAnalyzing(true);

    try {
      // Preparar datos resumidos para la IA
      const eventsSummary = events.slice(0, 20).map(e => ({
        title: e.title,
        type: e.type,
        date: format(e.startDate, 'yyyy-MM-dd'),
        isToday: isToday(e.startDate),
        isTomorrow: isTomorrow(e.startDate),
      }));

      const tasksSummary = tasks.slice(0, 20).map(t => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate ? format(t.dueDate, 'yyyy-MM-dd') : null,
        isOverdue: t.dueDate ? isPast(t.dueDate) && !isToday(t.dueDate) : false,
      }));

      const response = await fetch('/api/dashboard-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid,
          stats: statistics,
          events: eventsSummary,
          tasks: tasksSummary,
          currentDate: format(new Date(), 'yyyy-MM-dd'),
        }),
      });

      const data = await response.json();

      if (data.success && data.analysis) {
        const summary = data.analysis.summary || '';
        const insights = data.analysis.insights || [];
        setAiSummary(summary);
        setAiInsights(insights);
        // Cachear (las insights de la IA traen icon como string → serializable)
        if (cacheKey && typeof window !== 'undefined') {
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ summary, insights, generatedAt: Date.now() }));
          } catch { /* localStorage lleno o no disponible */ }
        }
      } else {
        // Insights generados localmente como fallback (no se cachean)
        generateLocalInsights(statistics);
      }
    } catch (error) {
      console.error('Error generating AI analysis:', error);
      generateLocalInsights(statistics);
    } finally {
      setAiAnalyzing(false);
    }
  };

  const generateLocalInsights = (stats: any) => {
    const insights: AIInsight[] = [];

    if (stats.overdueTasks > 0) {
      insights.push({
        type: 'alert',
        title: 'Tareas Vencidas',
        message: `Tienes ${stats.overdueTasks} tarea${stats.overdueTasks > 1 ? 's' : ''} vencida${stats.overdueTasks > 1 ? 's' : ''}. Considera reprogramarlas o completarlas pronto.`,
        icon: AlertCircle,
      });
    }

    if (stats.urgentTasks > 0) {
      insights.push({
        type: 'warning',
        title: 'Tareas Urgentes',
        message: `Hay ${stats.urgentTasks} tarea${stats.urgentTasks > 1 ? 's' : ''} de alta prioridad pendiente${stats.urgentTasks > 1 ? 's' : ''}. Prioriza su completación.`,
        icon: Zap,
      });
    }

    if (stats.todayEvents > 0) {
      insights.push({
        type: 'info',
        title: 'Agenda de Hoy',
        message: `Tienes ${stats.todayEvents} evento${stats.todayEvents > 1 ? 's' : ''} programado${stats.todayEvents > 1 ? 's' : ''} para hoy. Revisa tu calendario.`,
        icon: CalendarClock,
      });
    }

    if (stats.completedTasks > stats.pendingTasks && stats.completedTasks > 0) {
      insights.push({
        type: 'success',
        title: '¡Excelente Progreso!',
        message: `Has completado ${stats.completedTasks} tareas. ¡Sigue así!`,
        icon: Award,
      });
    }

    if (stats.thisWeekEvents > 5) {
      insights.push({
        type: 'info',
        title: 'Semana Ocupada',
        message: `Tienes ${stats.thisWeekEvents} eventos esta semana. Organiza bien tu tiempo.`,
        icon: Target,
      });
    }

    setAiInsights(insights);
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'work': return 'bg-brand-blue/20 text-brand-navy border-brand-blue/30';
      case 'personal': return 'bg-green-100 text-green-700 border-green-200';
      case 'meeting': return 'bg-brand-orange/15 text-brand-orange border-brand-orange/25';
      case 'reminder': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getEventTypeName = (type: string) => {
    switch (type) {
      case 'work': return 'Trabajo';
      case 'personal': return 'Personal';
      case 'meeting': return 'Reunión';
      case 'reminder': return 'Recordatorio';
      default: return type;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-50 border-green-200 text-green-800';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'alert': return 'bg-red-50 border-red-200 text-red-800';
      case 'info': return 'bg-brand-blue/10 border-brand-blue/30 text-brand-navy';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-36 bg-brand-navy rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-200 dark:bg-surface-secondary rounded-xl animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-gray-200 dark:bg-surface-secondary rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ===== HEADER ===== */}
      <div className="bg-brand-navy rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm p-2 rounded-xl">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Panel de Control</h1>
              <p className="text-white/70 text-sm">Resumen de tu productividad y agenda</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-white/90">{user?.displayName || 'Usuario'}</p>
            <p className="text-xs text-white/60">{format(new Date(), "d MMM yyyy", { locale: es })}</p>
          </div>
        </div>

        {/* Header quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock className="w-4 h-4 text-green-300" />
              <span className="text-xs text-white/70">Hoy</span>
            </div>
            <p className="text-2xl font-bold">{stats.todayEvents}</p>
            <p className="text-[10px] text-white/60">evento{stats.todayEvents !== 1 ? 's' : ''} · {stats.pendingTasks} tarea{stats.pendingTasks !== 1 ? 's' : ''} pendiente{stats.pendingTasks !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-emerald-300" />
              <span className="text-xs text-white/70">Productividad</span>
            </div>
            <p className="text-2xl font-bold">
              {stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%
            </p>
            <p className="text-[10px] text-white/60">{stats.completedTasks}/{stats.totalTasks} tareas</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-brand-blue" />
              <span className="text-xs text-white/70">Semana</span>
            </div>
            <p className="text-2xl font-bold">{stats.thisWeekEvents}</p>
            <p className="text-[10px] text-white/60">evento{stats.thisWeekEvents !== 1 ? 's' : ''} esta semana</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-orange-300" />
              <span className="text-xs text-white/70">Alertas</span>
            </div>
            <p className="text-2xl font-bold text-orange-300">{stats.overdueTasks + stats.urgentTasks}</p>
            <p className="text-[10px] text-white/60">
              {stats.overdueTasks > 0 ? `${stats.overdueTasks} vencida${stats.overdueTasks !== 1 ? 's' : ''}` : ''}
              {stats.overdueTasks > 0 && stats.urgentTasks > 0 ? ' · ' : ''}
              {stats.urgentTasks > 0 ? `${stats.urgentTasks} urgente${stats.urgentTasks !== 1 ? 's' : ''}` : ''}
              {stats.overdueTasks === 0 && stats.urgentTasks === 0 ? 'Todo al día' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* ===== AI ANALYSIS ===== */}
      {(aiAnalyzing || aiSummary || aiInsights.length > 0) && (
        <div className="bg-white dark:bg-surface border border-gray-200 dark:border-border-custom rounded-xl p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-brand-navy/10 dark:bg-brand-blue/10 p-1.5 rounded-lg">
              <Brain className="w-4 h-4 text-brand-navy dark:text-brand-blue" />
            </div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-foreground">Análisis Inteligente</h2>
            {aiAnalyzing && <Loader2 className="w-3.5 h-3.5 text-brand-navy dark:text-brand-blue animate-spin" />}
            <button
              onClick={() => loadDashboardData(true)}
              disabled={aiAnalyzing}
              title="Regenerar análisis"
              className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-brand-navy dark:hover:text-brand-blue disabled:opacity-40 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${aiAnalyzing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Regenerar</span>
            </button>
          </div>

          {aiAnalyzing && !aiSummary && (
            <div className="flex items-center gap-2 text-brand-navy dark:text-brand-blue">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <p className="text-xs">Analizando tu actividad...</p>
            </div>
          )}

          {aiSummary && (
            <p className="text-xs text-gray-600 dark:text-text-secondary mb-3 leading-relaxed">{aiSummary}</p>
          )}

          {aiInsights.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
              {aiInsights.map((insight, index) => {
                const IconComponent = typeof insight.icon === 'string' 
                  ? iconMap[insight.icon] || Brain 
                  : insight.icon;
                return (
                  <div 
                    key={index}
                    className={`rounded-lg px-3 py-2 border ${getInsightColor(insight.type)}`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <IconComponent className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="font-semibold text-xs truncate">{insight.title}</span>
                    </div>
                    <p className="text-[10px] opacity-80 line-clamp-2">{insight.message}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== BENTO GRID ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-min">
        {/* Próximos Eventos — spans 1 col, 2 rows on large */}
        <div className="bg-white dark:bg-surface border border-gray-200 dark:border-border-custom rounded-xl p-4 hover-lift lg:row-span-2 animate-card-enter" style={{ animationDelay: '0.05s' }}>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground mb-3 flex items-center gap-2">
            <div className="bg-brand-navy/10 dark:bg-brand-blue/10 p-1 rounded-lg"><Calendar className="w-4 h-4 text-brand-navy dark:text-brand-blue" /></div>
            <span className="flex-1">Próximos Eventos</span>
            <Link href="/dashboard/calendar" className="text-xs text-brand-navy dark:text-brand-blue hover:text-brand-blue flex items-center gap-0.5 font-normal">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </h3>
          {upcomingEvents.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-gray-400 dark:text-text-tertiary text-xs">
              <div className="text-center">
                <Calendar className="w-6 h-6 text-gray-300 dark:text-text-tertiary mx-auto mb-1" />
                <p>Sin eventos próximos</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.slice(0, 5).map((event) => (
                <div 
                  key={event.id}
                  className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-secondary transition-colors"
                >
                  <div className={`w-1.5 h-10 rounded-full flex-shrink-0 ${
                    event.type === 'work' ? 'bg-brand-navy' : 
                    event.type === 'personal' ? 'bg-green-500' : 
                    event.type === 'meeting' ? 'bg-brand-orange' : 'bg-yellow-500'
                  }`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-foreground truncate">{event.title}</p>
                    <p className="text-xs text-gray-500 dark:text-text-secondary">{format(event.startDate, "d MMM, HH:mm", { locale: es })}</p>
                  </div>
                  {isToday(event.startDate) && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-navy text-white font-medium">HOY</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-border-custom text-xs flex justify-between">
            <span className="text-gray-500 dark:text-text-tertiary">Total eventos</span>
            <span className="font-bold text-gray-900 dark:text-foreground">{stats.totalEvents}</span>
          </div>
        </div>

        {/* Tareas Prioritarias */}
        <div className="bg-white dark:bg-surface border border-gray-200 dark:border-border-custom rounded-xl p-4 hover-lift animate-card-enter" style={{ animationDelay: '0.15s' }}>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground mb-3 flex items-center gap-2">
            <div className="bg-brand-orange/10 p-1 rounded-lg"><ListTodo className="w-4 h-4 text-brand-orange" /></div>
            <span className="flex-1">Tareas Prioritarias</span>
            <Link href="/dashboard/tasks" className="text-xs text-brand-orange hover:text-[#e69200] flex items-center gap-0.5 font-normal">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </h3>
          {priorityTasks.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-gray-400 dark:text-text-tertiary text-xs">
              <div className="text-center">
                <CheckCircle className="w-6 h-6 text-gray-300 dark:text-text-tertiary mx-auto mb-1" />
                <p>¡Sin tareas pendientes!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {priorityTasks.slice(0, 5).map((task) => (
                <div 
                  key={task.id}
                  className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-secondary transition-colors"
                >
                  <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                    task.status === 'completed' ? 'bg-green-500 border-green-500' : 
                    task.priority === 'high' ? 'border-red-400' : 
                    task.priority === 'medium' ? 'border-yellow-400' : 'border-gray-300 dark:border-gray-600'
                  }`}></div>
                  <p className={`text-sm flex-1 truncate ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-foreground'}`}>
                    {task.title}
                  </p>
                  {task.dueDate && isPast(task.dueDate) && !isToday(task.dueDate) && task.status !== 'completed' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500 text-white font-medium">!</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-border-custom text-xs flex justify-between">
            <span className="text-gray-500 dark:text-text-tertiary">Completadas</span>
            <span className="font-bold text-green-600">{stats.completedTasks} de {stats.totalTasks}</span>
          </div>
        </div>

        {/* Finanzas del Mes */}
        <div className="bg-white dark:bg-surface border border-gray-200 dark:border-border-custom rounded-xl p-4 hover-lift animate-card-enter" style={{ animationDelay: '0.25s' }}>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground mb-3 flex items-center gap-2">
            <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1 rounded-lg"><Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /></div>
            <span className="flex-1">Finanzas del Mes</span>
            <Link href="/dashboard/finances" className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-0.5 font-normal">
              Ver detalle <ArrowRight className="w-3 h-3" />
            </Link>
          </h3>
          {financeStats.count > 0 || financeStats.income > 0 || financeStats.expenses > 0 ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowUpCircle className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-xs text-gray-600 dark:text-text-secondary">Ingresos</span>
                  </div>
                  <span className="text-sm font-bold text-green-600">${financeStats.income.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowDownCircle className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-xs text-gray-600 dark:text-text-secondary">Gastos</span>
                  </div>
                  <span className="text-sm font-bold text-red-600">${financeStats.expenses.toLocaleString()}</span>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-surface-secondary rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-500 dark:text-text-tertiary mb-0.5">Balance neto</p>
                <p className={`text-xl font-bold ${financeStats.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  ${financeStats.balance.toLocaleString()}
                </p>
                {financeStats.income > 0 && (
                  <p className="text-[10px] text-gray-400 dark:text-text-tertiary mt-0.5">
                    Ahorro: {Math.round(((financeStats.income - financeStats.expenses) / financeStats.income) * 100)}%
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-24 text-gray-400 dark:text-text-tertiary text-xs">
              <div className="text-center">
                <Wallet className="w-6 h-6 text-gray-300 dark:text-text-tertiary mx-auto mb-1" />
                <p>Sin transacciones este mes</p>
              </div>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-border-custom text-xs flex justify-between">
            <span className="text-gray-500 dark:text-text-tertiary">Transacciones</span>
            <span className="font-bold text-gray-900 dark:text-foreground">{financeStats.count}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
