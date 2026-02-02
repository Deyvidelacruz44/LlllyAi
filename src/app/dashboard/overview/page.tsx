'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { 
  Calendar, ListTodo, CheckCircle, Clock, AlertCircle,
  BarChart3, ArrowRight, Sparkles, CalendarClock, Loader2, Brain,
  Zap, Award, Target, LucideIcon
} from 'lucide-react';
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
      case 'work': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'personal': return 'bg-green-100 text-green-700 border-green-200';
      case 'meeting': return 'bg-purple-100 text-purple-700 border-purple-200';
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
      case 'info': return 'bg-blue-50 border-blue-200 text-blue-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
        <p className="text-gray-600 font-medium">Cargando tu panel de control...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-8 h-8 animate-pulse" />
          <h1 className="text-3xl font-bold">Panel de Control</h1>
        </div>
        <p className="text-blue-100">
          Bienvenido de nuevo, {user?.displayName || 'Usuario'}
        </p>
        <p className="text-sm text-blue-200 mt-1">
          {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
        </p>
      </div>

      {/* AI Analysis Section */}
      {(aiAnalyzing || aiSummary || aiInsights.length > 0) && (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border-2 border-purple-200 shadow-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-purple-600 p-2 rounded-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Análisis Inteligente</h2>
            {aiAnalyzing && <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />}
          </div>

          {aiAnalyzing && !aiSummary && (
            <div className="flex items-center gap-3 text-purple-700">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p className="text-sm">Generando insights personalizados con IA...</p>
            </div>
          )}

          {aiSummary && (
            <div className="bg-white rounded-lg p-4 mb-4 border border-purple-200">
              <p className="text-gray-700 leading-relaxed">{aiSummary}</p>
            </div>
          )}

          {aiInsights.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {aiInsights.map((insight, index) => {
                const IconComponent = typeof insight.icon === 'string' 
                  ? iconMap[insight.icon] || Brain 
                  : insight.icon;
                return (
                  <div 
                    key={index}
                    className={`rounded-lg p-4 border-2 ${getInsightColor(insight.type)} transition-all hover:shadow-md`}
                  >
                    <div className="flex items-start gap-3">
                      <IconComponent className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold mb-1">{insight.title}</h3>
                        <p className="text-sm opacity-90">{insight.message}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Eventos Hoy</p>
              <p className="text-3xl font-bold text-blue-600">{stats.todayEvents}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <CalendarClock className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Esta Semana</p>
              <p className="text-3xl font-bold text-purple-600">{stats.thisWeekEvents}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Tareas Pendientes</p>
              <p className="text-3xl font-bold text-orange-600">{stats.pendingTasks}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Completadas</p>
              <p className="text-3xl font-bold text-green-600">{stats.completedTasks}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Tareas Urgentes</p>
              <p className="text-3xl font-bold text-red-600">{stats.urgentTasks}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <Zap className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Tareas Vencidas</p>
              <p className="text-3xl font-bold text-rose-600">{stats.overdueTasks}</p>
            </div>
            <div className="bg-rose-100 p-3 rounded-lg">
              <AlertCircle className="w-6 h-6 text-rose-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Eventos</p>
              <p className="text-3xl font-bold text-indigo-600">{stats.totalEvents}</p>
            </div>
            <div className="bg-indigo-100 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Tareas</p>
              <p className="text-3xl font-bold text-teal-600">{stats.totalTasks}</p>
            </div>
            <div className="bg-teal-100 p-3 rounded-lg">
              <ListTodo className="w-6 h-6 text-teal-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Próximos Eventos */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Próximos Eventos</h2>
              </div>
              <Link 
                href="/dashboard/calendar"
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
              >
                Ver todos
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <div className="p-5">
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No hay eventos próximos</p>
                <Link 
                  href="/dashboard/calendar"
                  className="text-blue-600 hover:text-blue-700 text-sm mt-2 inline-block"
                >
                  Crear evento
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <div 
                    key={event.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                  >
                    <div className="mt-1">
                      <Calendar className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{event.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <p className="text-sm text-gray-600">
                          {format(event.startDate, "d MMM, HH:mm", { locale: es })}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getEventTypeColor(event.type)}`}>
                          {getEventTypeName(event.type)}
                        </span>
                        {isToday(event.startDate) && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600 text-white font-medium">
                            HOY
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tareas Prioritarias */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-900">Tareas Prioritarias</h2>
              </div>
              <Link 
                href="/dashboard/tasks"
                className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1 font-medium"
              >
                Ver todas
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <div className="p-5">
            {priorityTasks.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">¡No hay tareas pendientes!</p>
                <Link 
                  href="/dashboard/tasks"
                  className="text-purple-600 hover:text-purple-700 text-sm mt-2 inline-block"
                >
                  Crear tarea
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {priorityTasks.map((task) => (
                  <div 
                    key={task.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                  >
                    <div className="mt-1">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        task.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-gray-300'
                      }`}>
                        {task.status === 'completed' && (
                          <CheckCircle className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${
                        task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'
                      }`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {task.dueDate && (
                          <p className={`text-sm ${
                            task.dueDate && isPast(task.dueDate) && !isToday(task.dueDate) && task.status !== 'completed'
                              ? 'text-red-600 font-medium'
                              : 'text-gray-600'
                          }`}>
                            {format(task.dueDate, "d MMM", { locale: es })}
                          </p>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getPriorityColor(task.priority)}`}>
                          {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Media' : 'Baja'}
                        </span>
                        {task.dueDate && isPast(task.dueDate) && !isToday(task.dueDate) && task.status !== 'completed' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-600 text-white font-medium">
                            VENCIDA
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link 
          href="/dashboard/calendar"
          className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-6 hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg group"
        >
          <Calendar className="w-8 h-8 mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold text-lg mb-1">Calendario</h3>
          <p className="text-sm text-blue-100">Ver todos tus eventos</p>
        </Link>

        <Link 
          href="/dashboard/tasks"
          className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-6 hover:from-purple-600 hover:to-purple-700 transition-all shadow-md hover:shadow-lg group"
        >
          <ListTodo className="w-8 h-8 mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold text-lg mb-1">Tareas</h3>
          <p className="text-sm text-purple-100">Gestiona tus tareas</p>
        </Link>

        <Link 
          href="/dashboard/analytics"
          className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg p-6 hover:from-orange-600 hover:to-orange-700 transition-all shadow-md hover:shadow-lg group"
        >
          <BarChart3 className="w-8 h-8 mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold text-lg mb-1">Métricas IA</h3>
          <p className="text-sm text-orange-100">Análisis inteligente</p>
        </Link>
      </div>
    </div>
  );
}
