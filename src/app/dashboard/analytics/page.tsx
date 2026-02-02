'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import { BarChart3, TrendingUp, Calendar, CheckCircle, Clock, Zap, Loader2, Brain, AlertCircle, MessageSquare, ListTodo, RefreshCw, Target, Award, TrendingDown, Activity } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, differenceInMinutes, isToday, isPast, isFuture, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

interface LocalStats {
  totalEvents: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  cancelledTasks: number;
  overdueTasks: number;
  totalConversations: number;
  actionsFromChat: number;
  eventsByType: Record<string, number>;
  tasksByPriority: Record<string, number>;
  tasksByStatus: Record<string, number>;
  recentActivity: Array<{ type: string; title: string; date: Date }>;
  completionRate: number;
  todayEvents: number;
  thisWeekEvents: number;
  upcomingEvents: number;
}

// Cache de análisis IA
const aiAnalyticsCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [localStats, setLocalStats] = useState<LocalStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(7);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);

  useEffect(() => {
    if (user) {
      loadLocalStats();
    }
  }, [user, dateRange]);

  // Cargar estadísticas locales (sin IA) - OPTIMIZADO
  const loadLocalStats = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    
    try {
      const startDate = startOfDay(subDays(new Date(), dateRange));
      const endDate = endOfDay(new Date());
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      // Obtener datos con queries optimizadas
      const [eventsSnapshot, tasksSnapshot, conversationsSnapshot] = await Promise.all([
        getDocs(query(
          collection(db, 'events'),
          where('userId', '==', user.uid)
        )),
        getDocs(query(
          collection(db, 'tasks'),
          where('userId', '==', user.uid)
        )),
        getDocs(query(
          collection(db, 'ai_conversations'),
          where('userId', '==', user.uid),
          orderBy('timestamp', 'desc'),
          limit(50)
        )),
      ]);

      // Procesar eventos de forma eficiente
      const events = eventsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          type: data.type || 'other',
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date(),
        };
      });

      // Filtrar y calcular en una sola pasada
      const periodEvents = events.filter(e => 
        e.startDate >= startDate && e.startDate <= endDate
      );

      const todayEvents = events.filter(e => isToday(e.startDate)).length;
      const thisWeekEvents = events.filter(e => 
        e.startDate >= weekStart && e.startDate <= weekEnd
      ).length;
      const upcomingEvents = events.filter(e => isFuture(e.startDate)).length;

      // Procesar tareas eficientemente
      const tasks = tasksSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          status: data.status,
          priority: data.priority || 'medium',
          createdAt: data.createdAt?.toDate() || new Date(),
          completedAt: data.completedAt?.toDate(),
          dueDate: data.dueDate?.toDate(),
        };
      });

      // Calcular estadísticas de tareas en una pasada
      let completedTasks = 0;
      let pendingTasks = 0;
      let inProgressTasks = 0;
      let cancelledTasks = 0;
      let overdueTasks = 0;
      const tasksByPriority: Record<string, number> = {};
      const tasksByStatus: Record<string, number> = {};

      tasks.forEach(t => {
        // Contadores de estado
        if (t.status === 'completed') completedTasks++;
        else if (t.status === 'pending') pendingTasks++;
        else if (t.status === 'in-progress') inProgressTasks++;
        else if (t.status === 'cancelled') cancelledTasks++;

        // Tareas vencidas
        if (t.dueDate && isPast(t.dueDate) && t.status !== 'completed' && t.status !== 'cancelled') {
          overdueTasks++;
        }

        // Por prioridad
        tasksByPriority[t.priority] = (tasksByPriority[t.priority] || 0) + 1;
        
        // Por estado
        tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1;
      });

      // Procesar conversaciones
      const conversations = conversationsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          role: data.role,
          content: data.content,
          timestamp: data.timestamp?.toDate() || new Date(),
        };
      });

      const actionsFromChat = conversations.filter(c => 
        c.role === 'assistant' && 
        (c.content.includes('✅') || c.content.includes('Evento creado') || c.content.includes('Tarea creada'))
      ).length;

      // Calcular eventos por tipo
      const eventsByType: Record<string, number> = {};
      periodEvents.forEach(e => {
        eventsByType[e.type] = (eventsByType[e.type] || 0) + 1;
      });

      // Actividad reciente (solo las últimas 10)
      const recentActivity = [
        ...periodEvents.slice(0, 5).map(e => ({ type: 'event', title: e.title, date: e.startDate })),
        ...tasks.filter(t => t.createdAt >= startDate).slice(0, 5).map(t => ({ type: 'task', title: t.title, date: t.createdAt })),
      ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);

      const stats: LocalStats = {
        totalEvents: periodEvents.length,
        totalTasks: tasks.length,
        completedTasks,
        pendingTasks,
        inProgressTasks,
        cancelledTasks,
        overdueTasks,
        totalConversations: conversations.length,
        actionsFromChat,
        eventsByType,
        tasksByPriority,
        tasksByStatus,
        recentActivity,
        completionRate: tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0,
        todayEvents,
        thisWeekEvents,
        upcomingEvents,
      };

      setLocalStats(stats);

    } catch (err: any) {
      console.error('Error loading stats:', err);
      setError('Error al cargar las estadísticas. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  }, [user, dateRange]);

  const generateAIAnalytics = useCallback(async () => {
    if (!user || !localStats) return;
    
    setAiLoading(true);
    setShowAIAnalysis(true);
    
    try {
      // Verificar cache
      const cacheKey = `${user.uid}-${dateRange}`;
      const cached = aiAnalyticsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setAnalytics(cached.data);
        setAiLoading(false);
        return;
      }

      const startDate = startOfDay(subDays(new Date(), dateRange));
      const endDate = endOfDay(new Date());

      // Obtener solo los datos necesarios para la IA
      const [eventsSnapshot, tasksSnapshot] = await Promise.all([
        getDocs(query(
          collection(db, 'events'),
          where('userId', '==', user.uid)
        )),
        getDocs(query(
          collection(db, 'tasks'),
          where('userId', '==', user.uid)
        )),
      ]);

      const events = eventsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          title: data.title,
          type: data.type,
          startDate: data.startDate?.toDate(),
          endDate: data.endDate?.toDate(),
        };
      }).filter(e => e.startDate >= startDate && e.startDate <= endDate);

      const tasks = tasksSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          title: data.title,
          status: data.status,
          priority: data.priority,
          createdAt: data.createdAt?.toDate(),
          completedAt: data.completedAt?.toDate(),
          dueDate: data.dueDate?.toDate(),
        };
      });

      const response = await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: events.map(e => ({
            ...e,
            startDate: e.startDate?.toISOString(),
            endDate: e.endDate?.toISOString(),
          })),
          tasks: tasks.map(t => ({
            ...t,
            createdAt: t.createdAt?.toISOString(),
            completedAt: t.completedAt?.toISOString(),
            dueDate: t.dueDate?.toISOString(),
          })),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAnalytics(data.analytics);
        // Guardar en cache
        aiAnalyticsCache.set(cacheKey, { data: data.analytics, timestamp: Date.now() });
      } else {
        throw new Error(data.error || 'Error al generar análisis');
      }
    } catch (err: any) {
      console.error('Error generating AI analytics:', err);
      setError('No se pudo generar el análisis con IA. Intenta más tarde.');
    } finally {
      setAiLoading(false);
    }
  }, [user, localStats, dateRange]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-40 bg-gray-200 rounded animate-pulse" />
        </div>
        {/* Stats Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !localStats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error al cargar métricas</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={loadLocalStats}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="bg-gradient-to-br from-purple-500 to-blue-600 p-2 rounded-xl">
              <Brain className="w-7 h-7 text-white" />
            </div>
            Métricas y Análisis
          </h2>
          <p className="text-gray-600 mt-2">
            Análisis detallado de los últimos <span className="font-semibold text-blue-600">{dateRange} días</span> de actividad
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value={7}>Últimos 7 días</option>
            <option value={14}>Últimos 14 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>
          <button
            onClick={loadLocalStats}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Actualizar métricas"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <Calendar className="w-10 h-10 opacity-90" />
            <span className="text-4xl font-bold">{localStats?.totalEvents || 0}</span>
          </div>
          <p className="text-blue-100 text-sm font-medium">Eventos del período</p>
          <div className="mt-3 pt-3 border-t border-blue-400 text-xs text-blue-100 space-y-1">
            <div className="flex justify-between">
              <span>Hoy:</span>
              <span className="font-semibold">{localStats?.todayEvents || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Esta semana:</span>
              <span className="font-semibold">{localStats?.thisWeekEvents || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <Award className="w-10 h-10 opacity-90" />
            <span className="text-4xl font-bold">{localStats?.completionRate || 0}%</span>
          </div>
          <p className="text-green-100 text-sm font-medium">Tasa de completación</p>
          <div className="mt-3 pt-3 border-t border-green-400 text-xs text-green-100">
            <div className="flex justify-between">
              <span>Completadas:</span>
              <span className="font-semibold">{localStats?.completedTasks || 0} / {localStats?.totalTasks || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <MessageSquare className="w-10 h-10 opacity-90" />
            <span className="text-4xl font-bold">{localStats?.totalConversations || 0}</span>
          </div>
          <p className="text-purple-100 text-sm font-medium">Interacciones con IA</p>
          <div className="mt-3 pt-3 border-t border-purple-400 text-xs text-purple-100">
            <div className="flex justify-between">
              <span>Acciones ejecutadas:</span>
              <span className="font-semibold">{localStats?.actionsFromChat || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <AlertCircle className="w-10 h-10 opacity-90" />
            <span className="text-4xl font-bold">{localStats?.overdueTasks || 0}</span>
          </div>
          <p className="text-orange-100 text-sm font-medium">Tareas vencidas</p>
          <div className="mt-3 pt-3 border-t border-orange-400 text-xs text-orange-100">
            <div className="flex justify-between">
              <span>Próximos eventos:</span>
              <span className="font-semibold">{localStats?.upcomingEvents || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Estado de tareas y Eventos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estado de tareas */}
        <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Distribución de Tareas
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Completadas
                </span>
                <span className="font-semibold text-green-600">{localStats?.completedTasks || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${localStats?.totalTasks ? (localStats.completedTasks / localStats.totalTasks) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 flex items-center gap-1">
                  <Clock className="w-4 h-4 text-blue-600" />
                  En progreso
                </span>
                <span className="font-semibold text-blue-600">{localStats?.inProgressTasks || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${localStats?.totalTasks ? (localStats.inProgressTasks / localStats.totalTasks) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600 flex items-center gap-1">
                  <Activity className="w-4 h-4 text-orange-600" />
                  Pendientes
                </span>
                <span className="font-semibold text-orange-600">{localStats?.pendingTasks || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-orange-500 to-orange-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${localStats?.totalTasks ? (localStats.pendingTasks / localStats.totalTasks) * 100 : 0}%` }}
                />
              </div>
            </div>
            {localStats && localStats.overdueTasks > 0 && (
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    Vencidas
                  </span>
                  <span className="font-semibold text-red-600">{localStats.overdueTasks}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-red-500 to-red-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${localStats.totalTasks ? (localStats.overdueTasks / localStats.totalTasks) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="mt-6 pt-4 border-t">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total de tareas:</span>
              <span className="text-2xl font-bold text-gray-900">{localStats?.totalTasks || 0}</span>
            </div>
          </div>
        </div>

        {/* Eventos por tipo */}
        <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            Eventos por Tipo
          </h3>
          {localStats?.eventsByType && Object.keys(localStats.eventsByType).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(localStats.eventsByType)
                .sort(([,a], [,b]) => b - a)
                .map(([type, count]) => {
                  const total = localStats.totalEvents || 1;
                  const percentage = Math.round((count / total) * 100);
                  const colors: Record<string, { gradient: string; text: string }> = {
                    work: { gradient: 'from-blue-500 to-blue-600', text: 'text-blue-700' },
                    personal: { gradient: 'from-green-500 to-green-600', text: 'text-green-700' },
                    meeting: { gradient: 'from-purple-500 to-purple-600', text: 'text-purple-700' },
                    reminder: { gradient: 'from-yellow-500 to-yellow-600', text: 'text-yellow-700' },
                    other: { gradient: 'from-gray-500 to-gray-600', text: 'text-gray-700' },
                  };
                  const labels: Record<string, string> = {
                    work: '💼 Trabajo',
                    personal: '🏠 Personal',
                    meeting: '👥 Reunión',
                    reminder: '🔔 Recordatorio',
                    other: '📌 Otro',
                  };
                  const color = colors[type] || colors.other;
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-sm mb-2">
                        <span className={`font-medium ${color.text}`}>{labels[type] || type}</span>
                        <span className="font-bold text-gray-900">{count} <span className="text-gray-500 font-normal">({percentage}%)</span></span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`bg-gradient-to-r ${color.gradient} h-2.5 rounded-full transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No hay eventos en este período</p>
            </div>
          )}
        </div>
      </div>

      {/* Tareas por prioridad */}
      <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600" />
          Tareas por Prioridad
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { key: 'urgent', label: 'Urgente', icon: '🔴', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
            { key: 'high', label: 'Alta', icon: '🟠', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
            { key: 'medium', label: 'Media', icon: '🟡', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
            { key: 'low', label: 'Baja', icon: '🟢', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
          ].map(({ key, label, icon, bg, border, text }) => {
            const count = localStats?.tasksByPriority[key] || 0;
            return (
              <div
                key={key}
                className={`${bg} ${border} border-2 p-4 rounded-lg text-center hover:shadow-md transition-shadow`}
              >
                <div className="text-3xl mb-2">{icon}</div>
                <p className="text-3xl font-bold mb-1">{count}</p>
                <p className={`text-sm font-medium ${text}`}>{label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actividad reciente */}
      <div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-teal-600" />
          Actividad Reciente
        </h3>
        {localStats?.recentActivity && localStats.recentActivity.length > 0 ? (
          <div className="space-y-2">
            {localStats.recentActivity.map((activity, index) => (
              <div 
                key={index} 
                className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  activity.type === 'event' 
                    ? 'bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700' 
                    : 'bg-gradient-to-br from-green-100 to-green-200 text-green-700'
                }`}>
                  {activity.type === 'event' ? <Calendar className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{activity.title}</p>
                  <p className="text-xs text-gray-500">
                    {format(activity.date, "d MMM 'a las' HH:mm", { locale: es })}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  activity.type === 'event' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                  {activity.type === 'event' ? 'Evento' : 'Tarea'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Activity className="w-16 h-16 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No hay actividad reciente</p>
          </div>
        )}
      </div>

      {/* Sección de Análisis IA */}
      {!showAIAnalysis && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 p-8 rounded-xl text-center">
          <div className="max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-purple-500 to-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Análisis Inteligente con IA</h3>
            <p className="text-gray-600 mb-6">
              Obtén insights personalizados, patrones de productividad y recomendaciones basadas en tus datos usando inteligencia artificial.
            </p>
            <button
              onClick={generateAIAnalytics}
              disabled={aiLoading}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-3 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generando análisis...
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5" />
                  Generar Análisis con IA
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Loading de análisis IA */}
      {aiLoading && showAIAnalysis && (
        <div className="bg-purple-50 border border-purple-200 p-8 rounded-xl">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
            <div className="text-center">
              <p className="text-lg font-semibold text-purple-900 mb-1">Generando análisis con IA...</p>
              <p className="text-sm text-purple-700">Esto puede tomar unos segundos</p>
            </div>
          </div>
        </div>
      )}

      {/* Resultados del análisis IA */}
      {analytics && showAIAnalysis && !aiLoading && (
        <div className="space-y-6">
          {/* Puntuación de productividad */}
          <div className="bg-gradient-to-r from-purple-500 via-purple-600 to-blue-600 text-white p-8 rounded-xl shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Award className="w-8 h-8" />
                  <h3 className="text-2xl font-bold">Puntuación de Productividad</h3>
                </div>
                <p className="text-purple-100 text-lg">{analytics.summary}</p>
              </div>
              <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-2xl p-6 min-w-[120px] text-center">
                <div className="text-6xl font-bold">{analytics.productivityScore}</div>
                <div className="text-sm text-purple-100 mt-1">de 100</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Insights de IA */}
            {analytics.insights && analytics.insights.length > 0 && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 p-6 rounded-xl">
                <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  💡 Insights Detectados
                </h3>
                <ul className="space-y-3">
                  {analytics.insights.map((insight: string, index: number) => (
                    <li key={index} className="flex items-start gap-3 text-blue-900">
                      <span className="text-blue-600 text-xl flex-shrink-0">•</span>
                      <span className="text-sm leading-relaxed">{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recomendaciones */}
            {analytics.recommendations && analytics.recommendations.length > 0 && (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 p-6 rounded-xl">
                <h3 className="text-lg font-bold text-green-900 mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  🎯 Recomendaciones
                </h3>
                <ul className="space-y-3">
                  {analytics.recommendations.map((rec: string, index: number) => (
                    <li key={index} className="flex items-start gap-3 text-green-900">
                      <span className="text-green-600 text-xl flex-shrink-0">•</span>
                      <span className="text-sm leading-relaxed">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Patrones identificados */}
          {analytics.patterns && analytics.patterns.length > 0 && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 p-6 rounded-xl">
              <h3 className="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2">
                <TrendingDown className="w-5 h-5" />
                📊 Patrones Identificados
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analytics.patterns.map((pattern: string, index: number) => (
                  <div key={index} className="flex items-start gap-3 bg-white bg-opacity-50 p-3 rounded-lg">
                    <span className="text-amber-600 text-xl flex-shrink-0">▸</span>
                    <span className="text-sm text-amber-900 leading-relaxed">{pattern}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botón regenerar */}
          <div className="flex justify-center pt-4">
            <button
              onClick={generateAIAnalytics}
              disabled={aiLoading}
              className="flex items-center gap-2 bg-white border-2 border-purple-300 text-purple-700 px-6 py-3 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50 font-medium"
            >
              <RefreshCw className="w-5 h-5" />
              Regenerar Análisis
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
