import { NextRequest, NextResponse } from 'next/server';
import { isGeminiAvailable, generateWithRetry, parseJsonResponse } from '@/lib/gemini';
import { dashboardAnalysisRequestSchema } from '@/lib/schemas';
import { verifyOrigin } from '@/lib/security';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/lib/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    // Security: verify same-origin
    if (!verifyOrigin(request)) {
      return NextResponse.json({ error: 'Origen no permitido', success: false }, { status: 403 });
    }

    // Rate limiting by IP
    const rlKey = getRateLimitKey(request);
    const rl = checkRateLimit(rlKey, RATE_LIMITS.ai);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta en un momento.', success: false, code: 'RATE_LIMITED' },
        { status: 429, headers: rl.headers },
      );
    }

    const body = await request.json();
    const parsed = dashboardAnalysisRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Solicitud inválida', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { stats, events, tasks, currentDate } = parsed.data;

    if (!isGeminiAvailable()) {
      console.warn('GEMINI_API_KEY not configured, using fallback analysis');
      return NextResponse.json({
        success: true,
        analysis: generateFallbackAnalysis(stats),
        source: 'fallback',
      });
    }

    // Construir el prompt para el análisis
    const prompt = `Eres un asistente de productividad inteligente. Analiza los siguientes datos del usuario y genera insights útiles y personalizados.

FECHA ACTUAL: ${currentDate}

ESTADÍSTICAS:
- Eventos hoy: ${stats.todayEvents}
- Eventos esta semana: ${stats.thisWeekEvents}
- Tareas pendientes: ${stats.pendingTasks}
- Tareas urgentes (alta prioridad): ${stats.urgentTasks}
- Tareas completadas: ${stats.completedTasks}
- Tareas vencidas: ${stats.overdueTasks}
- Total eventos: ${stats.totalEvents}
- Total tareas: ${stats.totalTasks}

PRÓXIMOS EVENTOS (resumen):
${events.length > 0 ? events.map((e: any) => `- ${e.title} (${e.type}) - ${e.date}${e.isToday ? ' [HOY]' : ''}${e.isTomorrow ? ' [MAÑANA]' : ''}`).join('\n') : 'Sin eventos próximos'}

TAREAS RECIENTES (resumen):
${tasks.length > 0 ? tasks.map((t: any) => `- ${t.title} [${t.priority}] - Status: ${t.status}${t.isOverdue ? ' [VENCIDA]' : ''}${t.dueDate ? ` - Vence: ${t.dueDate}` : ''}`).join('\n') : 'Sin tareas'}

Genera un análisis en formato JSON con:
1. "summary": Un resumen breve (2-3 oraciones) sobre el estado general de productividad del usuario
2. "insights": Array de 2-5 insights específicos. Cada insight debe tener:
   - "type": "success" | "warning" | "info" | "alert"
   - "title": Título corto del insight
   - "message": Mensaje descriptivo (1-2 oraciones)
   - "icon": uno de ["AlertCircle", "Zap", "CalendarClock", "Award", "Target", "Brain"]

Enfócate en:
- Prioridades inmediatas
- Patrones de productividad
- Recomendaciones prácticas
- Balance de carga de trabajo
- Identificar problemas (tareas vencidas, sobrecarga)

Responde SOLO con el JSON, sin texto adicional.`;

    try {
      const aiText = await generateWithRetry(prompt, { temperature: 0.7, maxOutputTokens: 1000 });

      let analysis: any;
      try {
        analysis = parseJsonResponse(aiText);
        if (!analysis) {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        analysis = generateFallbackAnalysis(stats);
      }

      // Mapear iconos de string a componentes válidos
      if (analysis.insights) {
        analysis.insights = analysis.insights.map((insight: any) => ({
          ...insight,
          icon: insight.icon || 'Brain',
        }));
      }

      return NextResponse.json({
        success: true,
        analysis,
        source: 'claude',
      });

    } catch (aiError) {
      console.error('AI generation error:', aiError);
      
      // Retornar análisis generado localmente
      const fallbackAnalysis = generateFallbackAnalysis(stats);
      
      return NextResponse.json({
        success: true,
        analysis: fallbackAnalysis,
        source: 'fallback',
        reason: aiError instanceof Error ? aiError.message : 'Unknown error',
      });
    }

  } catch (error) {
    console.error('Dashboard analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate analysis' },
      { status: 500 }
    );
  }
}

function generateFallbackAnalysis(stats: any) {
  const insights = [];
  let summaryParts = [];

  // Generar resumen
  if (stats.overdueTasks > 0) {
    summaryParts.push(`Tienes ${stats.overdueTasks} tarea${stats.overdueTasks > 1 ? 's' : ''} vencida${stats.overdueTasks > 1 ? 's' : ''}`);
  }
  
  if (stats.todayEvents > 0) {
    summaryParts.push(`${stats.todayEvents} evento${stats.todayEvents > 1 ? 's' : ''} hoy`);
  }
  
  if (stats.urgentTasks > 0) {
    summaryParts.push(`${stats.urgentTasks} tarea${stats.urgentTasks > 1 ? 's' : ''} urgente${stats.urgentTasks > 1 ? 's' : ''}`);
  }

  const summary = summaryParts.length > 0
    ? `Tu agenda muestra ${summaryParts.join(', ')}. Organiza tus prioridades para mantener el control.`
    : `Tu agenda está bajo control con ${stats.completedTasks} tareas completadas. ¡Excelente trabajo!`;

  // Tareas vencidas - prioridad máxima
  if (stats.overdueTasks > 0) {
    insights.push({
      type: 'alert',
      title: '⚠️ Tareas Vencidas',
      message: `Tienes ${stats.overdueTasks} tarea${stats.overdueTasks > 1 ? 's' : ''} vencida${stats.overdueTasks > 1 ? 's' : ''}. Revísalas y reprograma o completa las que puedas hoy.`,
      icon: 'AlertCircle',
    });
  }

  // Tareas urgentes
  if (stats.urgentTasks > 0) {
    insights.push({
      type: 'warning',
      title: '🔥 Tareas Urgentes',
      message: `Hay ${stats.urgentTasks} tarea${stats.urgentTasks > 1 ? 's' : ''} de alta prioridad esperando tu atención. Considera dedicarles tiempo hoy.`,
      icon: 'Zap',
    });
  }

  // Eventos de hoy
  if (stats.todayEvents > 0) {
    insights.push({
      type: 'info',
      title: '📅 Agenda de Hoy',
      message: `Tienes ${stats.todayEvents} evento${stats.todayEvents > 1 ? 's' : ''} programado${stats.todayEvents > 1 ? 's' : ''} para hoy. Revisa tus horarios para estar preparado.`,
      icon: 'CalendarClock',
    });
  }

  // Progreso positivo
  if (stats.completedTasks > stats.pendingTasks && stats.completedTasks > 0) {
    insights.push({
      type: 'success',
      title: '🏆 Excelente Progreso',
      message: `Has completado ${stats.completedTasks} tareas. Tu productividad está en un nivel alto. ¡Sigue así!`,
      icon: 'Award',
    });
  }

  // Semana ocupada
  if (stats.thisWeekEvents > 5) {
    insights.push({
      type: 'info',
      title: '🎯 Semana Intensa',
      message: `Tienes ${stats.thisWeekEvents} eventos esta semana. Planifica bien tu tiempo y asegura descansos entre actividades.`,
      icon: 'Target',
    });
  }

  // Si no hay mucho que reportar
  if (insights.length === 0) {
    insights.push({
      type: 'success',
      title: '✨ Todo en Orden',
      message: 'Tu agenda está bien organizada. Es un buen momento para planificar nuevos objetivos o adelantar tareas futuras.',
      icon: 'Brain',
    });
  }

  return {
    summary,
    insights: insights.slice(0, 5), // Máximo 5 insights
  };
}
