import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY no configurada. El análisis IA no funcionará.');
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

export async function POST(request: Request) {
  try {
    // Validar que la API key esté configurada
    if (!genAI) {
      return NextResponse.json(
        { 
          error: 'El servicio de IA no está configurado.', 
          success: false 
        },
        { status: 503 }
      );
    }

    const { events, tasks, finances, startDate, endDate } = await request.json();

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 3000,
      }
    });

    // Crear un resumen conciso de los datos para reducir tokens
    const eventsSummary = {
      total: events.length,
      byType: events.reduce((acc: any, e: any) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      }, {}),
    };

    const tasksSummary = {
      total: tasks.length,
      completed: tasks.filter((t: any) => t.status === 'completed').length,
      pending: tasks.filter((t: any) => t.status === 'pending').length,
      inProgress: tasks.filter((t: any) => t.status === 'in-progress').length,
      byPriority: tasks.reduce((acc: any, t: any) => {
        acc[t.priority] = (acc[t.priority] || 0) + 1;
        return acc;
      }, {}),
    };

    // Build finance section for prompt
    let financeSection = '';
    if (finances) {
      financeSection = `

RESUMEN FINANCIERO (mes actual):
- Ingresos mensuales: ${finances.monthlyIncome}
- Gastos mensuales: ${finances.monthlyExpenses}
- Balance: ${finances.balance}
- Tasa de ahorro: ${finances.savingsRate}%
- Obligaciones mensuales (fijos + deudas): ${finances.totalMonthlyObligations}
- Deuda total pendiente: ${finances.totalDebtRemaining}
- Cuentas por cobrar pendientes: ${finances.totalPendingReceivables}
- Tasa de cobro: ${finances.collectionRate}%
- Mayor categoría de gasto: ${finances.topExpenseCategory}
- Gastos por categoría: ${JSON.stringify(finances.expensesByCategory)}`;
    }

    const prompt = `Analiza la productividad y situación financiera del usuario basándote en estos datos del ${startDate} al ${endDate}:

RESUMEN DE EVENTOS:
- Total: ${eventsSummary.total}
- Por tipo: ${JSON.stringify(eventsSummary.byType)}

RESUMEN DE TAREAS:
- Total: ${tasksSummary.total}
- Completadas: ${tasksSummary.completed}
- Pendientes: ${tasksSummary.pending}
- En progreso: ${tasksSummary.inProgress}
- Por prioridad: ${JSON.stringify(tasksSummary.byPriority)}${financeSection}

Genera un análisis JSON con esta estructura EXACTA (responde SOLO con JSON válido):
{
  "productivityScore": <número del 0-100 basado en completación, balance y finanzas>,
  "summary": "<resumen breve en 1-2 líneas que incluya tanto productividad como finanzas>",
  "insights": [
    "<insight breve 1>",
    "<insight breve 2>",
    "<insight breve 3>"
  ],
  "recommendations": [
    "<recomendación práctica 1>",
    "<recomendación práctica 2>",
    "<recomendación práctica 3>"
  ],
  "patterns": [
    "<patrón identificado 1>",
    "<patrón identificado 2>"
  ]${finances ? `,
  "financialInsights": [
    "<observación financiera 1>",
    "<observación financiera 2>",
    "<recomendación financiera práctica>"
  ]` : ''}
}

Criterios:
- Puntuación basada en: tasa de completación (30%), balance trabajo/personal (20%), gestión de prioridades (20%), salud financiera (30% si hay datos financieros, 0% si no)
- Insights: observaciones específicas sobre los datos de productividad
- Recomendaciones: acciones concretas y alcanzables combinando productividad y finanzas
- Patrones: tendencias detectadas en la actividad
${finances ? '- financialInsights: análisis específico de la situación financiera (gastos, ahorro, deudas, cobros)' : ''}

Responde SOLO con el JSON, sin texto adicional ni markdown.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Intentar parsear el JSON de la respuesta
    let analytics;
    try {
      // Limpiar markdown code blocks si existen
      const cleanedResponse = response
        .replace(/```json\n?|\n?```/g, '')
        .replace(/```\n?|\n?```/g, '')
        .trim();
      analytics = JSON.parse(cleanedResponse);
      
      // Validar estructura básica
      if (!analytics.productivityScore || !analytics.summary) {
        throw new Error('Estructura de respuesta inválida');
      }
      
      // Asegurar que arrays existan
      analytics.insights = analytics.insights || [];
      analytics.recommendations = analytics.recommendations || [];
      analytics.patterns = analytics.patterns || [];
      analytics.financialInsights = analytics.financialInsights || [];
      
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Raw response:', response);
      
      // Fallback: generar análisis básico
      const completionRate = Math.round((tasksSummary.completed / Math.max(tasksSummary.total, 1)) * 100);
      analytics = {
        productivityScore: completionRate,
        summary: `Has completado ${tasksSummary.completed} de ${tasksSummary.total} tareas y tienes ${eventsSummary.total} eventos.${finances ? ` Balance: ${finances.balance >= 0 ? '+' : ''}${finances.balance}` : ''}`,
        insights: [
          `Tasa de completación: ${completionRate}%`,
          `Total de eventos: ${eventsSummary.total}`,
          `Tareas pendientes: ${tasksSummary.pending}`,
        ],
        recommendations: [
          'Mantén un balance entre trabajo y vida personal',
          'Prioriza las tareas más urgentes',
          'Programa tiempo para planificación semanal',
        ],
        patterns: [
          `Tienes ${eventsSummary.total} eventos programados`,
          `${tasksSummary.completed} tareas completadas de ${tasksSummary.total}`,
        ],
        financialInsights: finances ? [
          `Tasa de ahorro: ${finances.savingsRate}%`,
          `Obligaciones mensuales: ${finances.totalMonthlyObligations}`,
          finances.totalPendingReceivables > 0 ? `Cuentas por cobrar pendientes: ${finances.totalPendingReceivables}` : 'Sin cuentas pendientes por cobrar',
        ] : [],
      };
    }

    return NextResponse.json({ 
      analytics,
      success: true 
    });

  } catch (error: any) {
    console.error('Error in analytics API:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Error al generar análisis', 
        success: false 
      },
      { status: 500 }
    );
  }
}
