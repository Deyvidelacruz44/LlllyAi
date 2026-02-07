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
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-purple-500 to-blue-600 p-1.5 rounded-lg">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Métricas</h2>
          <span className="text-xs text-gray-500">({dateRange} días)</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
            className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value={7}>7 días</option>
            <option value={14}>14 días</option>
            <option value={30}>30 días</option>
          </select>
          <button
            onClick={loadLocalStats}
            disabled={loading}
            className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Estadísticas principales - Compactas */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-3 rounded-lg">
          <div className="flex items-center justify-between">
            <Calendar className="w-5 h-5 opacity-80" />
            <span className="text-2xl font-bold">{localStats?.totalEvents || 0}</span>
          </div>
          <p className="text-blue-100 text-xs mt-1">Eventos</p>
          <div className="text-[10px] text-blue-200 mt-1 flex justify-between">
            <span>Hoy: {localStats?.todayEvents || 0}</span>
            <span>Semana: {localStats?.thisWeekEvents || 0}</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-3 rounded-lg">
          <div className="flex items-center justify-between">
            <Award className="w-5 h-5 opacity-80" />
            <span className="text-2xl font-bold">{localStats?.completionRate || 0}%</span>
          </div>
          <p className="text-green-100 text-xs mt-1">Completación</p>
          <div className="text-[10px] text-green-200 mt-1">
            {localStats?.completedTasks || 0}/{localStats?.totalTasks || 0} tareas
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-3 rounded-lg">
          <div className="flex items-center justify-between">
            <MessageSquare className="w-5 h-5 opacity-80" />
            <span className="text-2xl font-bold">{localStats?.totalConversations || 0}</span>
          </div>
          <p className="text-purple-100 text-xs mt-1">Chats IA</p>
          <div className="text-[10px] text-purple-200 mt-1">
            {localStats?.actionsFromChat || 0} acciones
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-3 rounded-lg">
          <div className="flex items-center justify-between">
            <AlertCircle className="w-5 h-5 opacity-80" />
            <span className="text-2xl font-bold">{localStats?.overdueTasks || 0}</span>
          </div>
          <p className="text-orange-100 text-xs mt-1">Vencidas</p>
          <div className="text-[10px] text-orange-200 mt-1">
            {localStats?.upcomingEvents || 0} próximos
          </div>
        </div>
      </div>

      {/* Estado de tareas y Eventos - Compacto */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Estado de tareas */}
        <div className="bg-white border border-gray-200 p-3 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1">
            <Target className="w-4 h-4 text-blue-600" />
            Tareas
          </h3>
          <div className="space-y-2">
            {[
              { label: 'Completadas', count: localStats?.completedTasks || 0, color: 'green' },
              { label: 'En progreso', count: localStats?.inProgressTasks || 0, color: 'blue' },
              { label: 'Pendientes', count: localStats?.pendingTasks || 0, color: 'orange' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full bg-${item.color}-500`}></div>
                <span className="text-xs text-gray-600 flex-1">{item.label}</span>
                <span className={`text-xs font-bold text-${item.color}-600`}>{item.count}</span>
                <div className="w-16 bg-gray-200 rounded-full h-1.5">
                  <div className={`bg-${item.color}-500 h-1.5 rounded-full`} style={{ width: `${localStats?.totalTasks ? (item.count / localStats.totalTasks) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t text-xs flex justify-between">
            <span className="text-gray-500">Total:</span>
            <span className="font-bold">{localStats?.totalTasks || 0}</span>
          </div>
        </div>

        {/* Eventos por tipo */}
        <div className="bg-white border border-gray-200 p-3 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1">
            <Calendar className="w-4 h-4 text-purple-600" />
            Eventos
          </h3>
          {localStats?.eventsByType && Object.keys(localStats.eventsByType).length > 0 ? (
            <div className="space-y-1.5">
              {Object.entries(localStats.eventsByType).sort(([,a], [,b]) => b - a).slice(0, 4).map(([type, count]) => {
                const labels: Record<string, string> = { work: '💼', personal: '🏠', meeting: '👥', reminder: '🔔', other: '📌' };
                return (
                  <div key={type} className="flex items-center gap-2 text-xs">
                    <span>{labels[type] || '📌'}</span>
                    <span className="flex-1 text-gray-600 capitalize">{type}</span>
                    <span className="font-bold">{count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-400 text-xs text-center py-4">Sin eventos</p>
          )}
        </div>

        {/* Prioridad */}
        <div className="bg-white border border-gray-200 p-3 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            Prioridad
          </h3>
          <div className="grid grid-cols-4 gap-1">
            {[
              { key: 'urgent', icon: '🔴' },
              { key: 'high', icon: '🟠' },
              { key: 'medium', icon: '🟡' },
              { key: 'low', icon: '🟢' },
            ].map(({ key, icon }) => (
              <div key={key} className="text-center p-1.5 bg-gray-50 rounded">
                <div className="text-sm">{icon}</div>
                <p className="text-lg font-bold">{localStats?.tasksByPriority[key] || 0}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Botón de Análisis IA - Compacto */}
      {!showAIAnalysis && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 p-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Análisis con IA</span>
          </div>
          <button
            onClick={generateAIAnalytics}
            disabled={aiLoading}
            className="text-xs bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 py-1.5 rounded hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 flex items-center gap-1"
          >
            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
            {aiLoading ? 'Analizando...' : 'Generar'}
          </button>
        </div>
      )}

      {/* Loading y resultados IA - Compactos */}
      {aiLoading && showAIAnalysis && (
        <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
          <span className="text-sm text-purple-700">Generando análisis...</span>
        </div>
      )}

      {analytics && showAIAnalysis && !aiLoading && (
        <div className="space-y-3">
          {/* Score */}
          <div className="bg-gradient-to-r from-purple-500 to-blue-600 text-white p-3 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              <span className="text-sm">Productividad</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-purple-100 max-w-xs truncate">{analytics.summary}</span>
              <span className="text-2xl font-bold">{analytics.productivityScore}</span>
            </div>
          </div>

          {/* Insights y Recomendaciones en grid */}
          <div className="grid grid-cols-2 gap-2">
            {analytics.insights?.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 p-2 rounded-lg">
                <p className="text-xs font-semibold text-blue-800 mb-1">💡 Insights</p>
                <ul className="text-xs text-blue-700 space-y-0.5">
                  {analytics.insights.slice(0, 3).map((i: string, idx: number) => (
                    <li key={idx} className="truncate">• {i}</li>
                  ))}
                </ul>
              </div>
            )}
            {analytics.recommendations?.length > 0 && (
              <div className="bg-green-50 border border-green-200 p-2 rounded-lg">
                <p className="text-xs font-semibold text-green-800 mb-1">🎯 Acciones</p>
                <ul className="text-xs text-green-700 space-y-0.5">
                  {analytics.recommendations.slice(0, 3).map((r: string, idx: number) => (
                    <li key={idx} className="truncate">• {r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <button onClick={generateAIAnalytics} disabled={aiLoading} className="text-xs text-purple-600 hover:underline flex items-center gap-1 mx-auto">
            <RefreshCw className="w-3 h-3" /> Regenerar
          </button>
        </div>
      )}
    </div>
  );
}
