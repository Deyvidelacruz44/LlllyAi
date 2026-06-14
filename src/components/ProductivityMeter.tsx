'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTasksStore } from '@/stores/tasksStore';
import { computeProductivityMetrics } from '@/lib/productivity';
import { Flame, CheckCircle2, CalendarCheck, TrendingUp, TrendingDown, Minus, Gauge } from 'lucide-react';

export default function ProductivityMeter() {
  const { user } = useAuth();
  const { tasks, load } = useTasksStore();

  useEffect(() => {
    if (user) load(user.uid);
  }, [user, load]);

  const m = computeProductivityMetrics(tasks);

  const trendIcon = m.weekTrendPct === null
    ? <Minus className="w-4 h-4" />
    : m.weekTrendPct > 0
      ? <TrendingUp className="w-4 h-4" />
      : m.weekTrendPct < 0
        ? <TrendingDown className="w-4 h-4" />
        : <Minus className="w-4 h-4" />;

  const trendColor = m.weekTrendPct === null || m.weekTrendPct === 0
    ? 'text-gray-500 dark:text-gray-400'
    : m.weekTrendPct > 0
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-500 dark:text-red-400';

  const trendLabel = m.weekTrendPct === null
    ? 'Sin datos de la semana pasada'
    : m.weekTrendPct === 0
      ? 'Igual que la semana pasada'
      : `${m.weekTrendPct > 0 ? '+' : ''}${m.weekTrendPct}% vs semana pasada`;

  const cards = [
    {
      icon: <Flame className="w-5 h-5" />,
      tint: 'bg-brand-orange/10 text-brand-orange',
      value: `${m.streak}`,
      unit: m.streak === 1 ? 'día' : 'días',
      label: 'Racha',
      sub: m.bestStreak > m.streak ? `Mejor racha: ${m.bestStreak} días` : '¡Tu mejor racha!',
    },
    {
      icon: <CheckCircle2 className="w-5 h-5" />,
      tint: 'bg-green-500/10 text-green-600 dark:text-green-400',
      value: m.onTimeRate === null ? '—' : `${m.onTimeRate}%`,
      unit: m.onTimeRate === null ? '' : 'a tiempo',
      label: 'Cumplimiento',
      sub: m.completedWithDue > 0
        ? `${m.onTimeCount} de ${m.completedWithDue} con fecha`
        : 'Aún sin tareas con fecha',
    },
    {
      icon: <CalendarCheck className="w-5 h-5" />,
      tint: 'bg-brand-blue/10 text-brand-navy dark:text-brand-blue',
      value: `${m.doneThisWeek}`,
      unit: `/ ${m.plannedThisWeek} planeadas`,
      label: 'Esta semana',
      sub: `${m.thisWeekCompleted} tarea(s) completada(s) en total`,
    },
    {
      icon: trendIcon,
      tint: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      value: m.weekTrendPct === null ? '—' : `${m.weekTrendPct > 0 ? '+' : ''}${m.weekTrendPct}%`,
      unit: '',
      label: 'Tendencia',
      sub: trendLabel,
      valueColor: trendColor,
    },
  ];

  return (
    <div className="bg-white dark:bg-surface border border-gray-200 dark:border-border-custom rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="bg-brand-navy/10 dark:bg-brand-blue/10 p-1.5 rounded-lg">
          <Gauge className="w-4 h-4 text-brand-navy dark:text-brand-blue" />
        </div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-foreground">Productividad Real</h2>
        <span className="text-[10px] text-gray-400 dark:text-text-tertiary ml-auto">Basado en tus tareas completadas</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {cards.map((c, i) => (
          <div key={i} className="rounded-lg border border-gray-100 dark:border-border-custom p-3 bg-gray-50/50 dark:bg-surface-secondary/40">
            <div className={`inline-flex p-1.5 rounded-lg ${c.tint} mb-2`}>{c.icon}</div>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-bold ${c.valueColor || 'text-gray-900 dark:text-foreground'}`}>{c.value}</span>
              {c.unit && <span className="text-[11px] text-gray-500 dark:text-text-tertiary">{c.unit}</span>}
            </div>
            <p className="text-xs font-medium text-gray-700 dark:text-text-secondary mt-0.5">{c.label}</p>
            <p className="text-[10px] text-gray-400 dark:text-text-tertiary mt-0.5 leading-tight">{c.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
