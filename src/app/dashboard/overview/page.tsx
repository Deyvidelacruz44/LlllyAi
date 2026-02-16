'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { 
  Calendar, ListTodo, CheckCircle, Clock, AlertCircle,
  BarChart3, ArrowRight, Sparkles, CalendarClock, Loader2, Brain,
  Zap, Award, Target, LucideIcon, Wallet, ArrowUpCircle, ArrowDownCircle, TrendingUp
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

  const loadDashboardData = async () => {
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

      // Generar análisis con IA
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
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setLoading(false);
    }
  };

  const generateAIAnalysis = async (events: Event[], tasks: Task[], statistics: any) => {
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
        setAiSummary(data.analysis.summary || '');
        setAiInsights(data.analysis.insights || []);
      } else {
        // Insights generados localmente como fallback
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
      <div className="space-y-6 animate-pulse">
        {/* Header skeleton */}
        <div className="bg-gradient-to-r from-gray-200 to-gray-300 rounded-xl p-6 h-32"></div>
        
        {/* Stats skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-5 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-gray-200 rounded"></div>
                  <div className="h-8 w-16 bg-gray-300 rounded"></div>
                </div>
                <div className="h-12 w-12 bg-gray-200 rounded-lg"></div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-80"></div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-80"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-navy via-[#1a1870] to-brand-blue rounded-xl px-4 py-3 text-white shadow-lg animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6" />
            <h1 className="text-xl font-bold">Panel de Control</h1>
          </div>
          <div className="text-right text-sm">
            <p className="text-white/80">{user?.displayName || 'Usuario'}</p>
            <p className="text-xs text-white/60">{format(new Date(), "d MMM yyyy", { locale: es })}</p>
          </div>
        </div>
      </div>

      {/* AI Analysis Section */}
      {(aiAnalyzing || aiSummary || aiInsights.length > 0) && (
        <div className="bg-gradient-to-br from-brand-navy/5 to-brand-blue/10 rounded-lg p-3 border border-brand-blue/30">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-brand-navy p-1 rounded">
              <Brain className="w-3.5 h-3.5 text-white" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">Análisis Inteligente</h2>
            {aiAnalyzing && <Loader2 className="w-3 h-3 text-brand-navy animate-spin" />}
          </div>

          {aiAnalyzing && !aiSummary && (
            <div className="flex items-center gap-2 text-brand-navy">
              <Loader2 className="w-3 h-3 animate-spin" />
              <p className="text-xs">Analizando...</p>
            </div>
          )}

          {aiSummary && (
            <p className="text-xs text-gray-600 mb-2 line-clamp-1">{aiSummary}</p>
          )}

          {aiInsights.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
              {aiInsights.map((insight, index) => {
                const IconComponent = typeof insight.icon === 'string' 
                  ? iconMap[insight.icon] || Brain 
                  : insight.icon;
                return (
                  <div 
                    key={index}
                    className={`rounded px-2 py-1.5 border ${getInsightColor(insight.type)}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <IconComponent className="w-3 h-3 flex-shrink-0" />
                      <span className="font-medium text-xs truncate">{insight.title}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
        {[
          { label: 'Hoy', value: stats.todayEvents, icon: CalendarClock, color: 'brand-navy' },
          { label: 'Semana', value: stats.thisWeekEvents, icon: Calendar, color: 'brand-blue' },
          { label: 'Pendientes', value: stats.pendingTasks, icon: Clock, color: 'orange' },
          { label: 'Listas', value: stats.completedTasks, icon: CheckCircle, color: 'green' },
          { label: 'Urgentes', value: stats.urgentTasks, icon: Zap, color: 'red' },
          { label: 'Vencidas', value: stats.overdueTasks, icon: AlertCircle, color: 'rose' },
          { label: 'Eventos', value: stats.totalEvents, icon: Calendar, color: 'brand-orange' },
          { label: 'Tareas', value: stats.totalTasks, icon: ListTodo, color: 'teal' },
        ].map((stat) => {
          const Icon = stat.icon;
          const colorClasses: Record<string, string> = {
            blue: 'text-brand-navy bg-brand-blue/15',
            purple: 'text-brand-navy bg-brand-navy/10',
            orange: 'text-orange-600 bg-orange-50',
            green: 'text-green-600 bg-green-50',
            red: 'text-red-600 bg-red-50',
            rose: 'text-rose-600 bg-rose-50',
            indigo: 'text-brand-navy bg-brand-blue/10',
            teal: 'text-teal-600 bg-teal-50',
            'brand-navy': 'text-brand-navy bg-brand-navy/10',
            'brand-blue': 'text-brand-navy bg-brand-blue/15',
            'brand-orange': 'text-brand-orange bg-brand-orange/10',
          };
          const textColor = colorClasses[stat.color].split(' ')[0];
          const bgColor = colorClasses[stat.color].split(' ')[1];
          
          return (
            <div 
              key={stat.label}
              className={`${bgColor} rounded-lg p-2 text-center border border-gray-100 hover:shadow-sm transition-all`}
            >
              <Icon className={`w-4 h-4 ${textColor} mx-auto mb-1`} />
              <p className={`text-lg font-bold ${textColor}`}>{stat.value}</p>
              <p className="text-[10px] text-gray-500 truncate">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Finance Widget */}
      {(financeStats.count > 0 || financeStats.income > 0 || financeStats.expenses > 0) && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-gray-900">Finanzas del Mes</h2>
            </div>
            <Link href="/dashboard/finances" className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5">
              Ver detalle <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/70 rounded-lg p-2 text-center">
              <ArrowUpCircle className="w-4 h-4 text-green-500 mx-auto mb-0.5" />
              <p className="text-sm font-bold text-green-600">${financeStats.income.toLocaleString()}</p>
              <p className="text-[10px] text-gray-500">Ingresos</p>
            </div>
            <div className="bg-white/70 rounded-lg p-2 text-center">
              <ArrowDownCircle className="w-4 h-4 text-red-500 mx-auto mb-0.5" />
              <p className="text-sm font-bold text-red-600">${financeStats.expenses.toLocaleString()}</p>
              <p className="text-[10px] text-gray-500">Gastos</p>
            </div>
            <div className="bg-white/70 rounded-lg p-2 text-center">
              <TrendingUp className="w-4 h-4 text-brand-blue mx-auto mb-0.5" />
              <p className={`text-sm font-bold ${financeStats.balance >= 0 ? 'text-brand-navy' : 'text-red-600'}`}>${financeStats.balance.toLocaleString()}</p>
              <p className="text-[10px] text-gray-500">Balance</p>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1">
        {/* Próximos Eventos */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
          <div className="px-3 py-2 border-b border-gray-100 bg-gradient-to-r from-brand-navy/5 to-brand-blue/10 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-brand-navy" />
              <h2 className="text-sm font-semibold text-gray-900">Próximos Eventos</h2>
            </div>
            <Link href="/dashboard/calendar" className="text-xs text-brand-navy hover:text-brand-blue flex items-center gap-0.5">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-2 flex-1 overflow-auto max-h-[180px]">
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-6">
                <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-xs">No hay eventos</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {upcomingEvents.slice(0, 4).map((event) => (
                  <div 
                    key={event.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 transition-colors"
                  >
                    <div className={`w-1.5 h-8 rounded-full ${event.type === 'work' ? 'bg-brand-navy' : event.type === 'personal' ? 'bg-green-500' : event.type === 'meeting' ? 'bg-brand-orange' : 'bg-yellow-500'}`}></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
                      <p className="text-xs text-gray-500">{format(event.startDate, "d MMM, HH:mm", { locale: es })}</p>
                    </div>
                    {isToday(event.startDate) && <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-navy text-white">HOY</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tareas Prioritarias */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
          <div className="px-3 py-2 border-b border-gray-100 bg-gradient-to-r from-brand-orange/10 to-brand-orange/5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ListTodo className="w-4 h-4 text-brand-orange" />
              <h2 className="text-sm font-semibold text-gray-900">Tareas Prioritarias</h2>
            </div>
            <Link href="/dashboard/tasks" className="text-xs text-brand-orange hover:text-[#e69200] flex items-center gap-0.5">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-2 flex-1 overflow-auto max-h-[180px]">
            {priorityTasks.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-xs">¡Sin tareas pendientes!</p>
              </div>
            ) : (
              <div className="space-y-1">
                {priorityTasks.slice(0, 4).map((task) => (
                  <div 
                    key={task.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 transition-colors"
                  >
                    <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                      task.status === 'completed' ? 'bg-green-500 border-green-500' : 
                      task.priority === 'high' ? 'border-red-400' : 
                      task.priority === 'medium' ? 'border-yellow-400' : 'border-gray-300'
                    }`}></div>
                    <p className={`text-sm flex-1 truncate ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {task.title}
                    </p>
                    {task.dueDate && isPast(task.dueDate) && !isToday(task.dueDate) && task.status !== 'completed' && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-red-500 text-white">!</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
