import { NextRequest, NextResponse } from 'next/server';
import { isGeminiAvailable, generateWithRetry, parseJsonResponse } from '@/lib/gemini';
import { financeAnalysisRequestSchema } from '@/lib/schemas';
import { verifyOrigin } from '@/lib/security';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/lib/rate-limiter';

interface TransactionSummary {
  type: string;
  category: string;
  amount: number;
  description: string;
  date: string;
}

function generateFallbackAnalysis(stats: Record<string, number>) {
  const balance = (stats.totalIncome || 0) - (stats.totalExpenses || 0);
  const savingsRate = stats.totalIncome > 0 
    ? Math.round(((stats.totalIncome - stats.totalExpenses) / stats.totalIncome) * 100) 
    : 0;

  return {
    summary: `Tu balance actual es ${balance >= 0 ? 'positivo' : 'negativo'}: $${Math.abs(balance).toLocaleString()}. ` +
      `Tienes ${stats.transactionCount || 0} transacciones registradas.`,
    insights: [
      {
        type: balance >= 0 ? 'success' : 'alert',
        title: balance >= 0 ? 'Balance Positivo' : 'Balance Negativo',
        message: balance >= 0 
          ? `Llevas un buen control. Tu tasa de ahorro es del ${savingsRate}%.`
          : 'Tus gastos superan tus ingresos. Revisa tus categorías de gasto.',
        icon: balance >= 0 ? 'TrendingUp' : 'AlertCircle',
      },
      {
        type: 'info',
        title: 'Registro de Gastos',
        message: `Has registrado ${stats.expenseCount || 0} gastos y ${stats.incomeCount || 0} ingresos.`,
        icon: 'Wallet',
      },
    ],
    recommendations: [
      'Registra todas tus transacciones diariamente para un mejor seguimiento.',
      'Establece presupuestos mensuales por categoría.',
    ],
    source: 'fallback',
  };
}

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
    const parsed = financeAnalysisRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Solicitud inválida', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { stats, transactions, budgets, currentDate } = parsed.data;

    if (!isGeminiAvailable()) {
      return NextResponse.json({
        success: true,
        analysis: generateFallbackAnalysis(stats || {}),
        source: 'fallback',
      });
    }

    const transactionsList = (transactions || []) as TransactionSummary[];
    const budgetsList = (budgets || []) as Array<{ category: string; amount: number; spent: number }>;

    const prompt = `Eres un asesor financiero personal inteligente. Analiza los siguientes datos financieros del usuario y genera insights útiles y personalizados.

FECHA ACTUAL: ${currentDate}

RESUMEN FINANCIERO:
- Ingresos totales del período: $${stats?.totalIncome?.toLocaleString() || 0}
- Gastos totales del período: $${stats?.totalExpenses?.toLocaleString() || 0}
- Balance: $${((stats?.totalIncome || 0) - (stats?.totalExpenses || 0)).toLocaleString()}
- Número de transacciones: ${stats?.transactionCount || 0}
- Tasa de ahorro: ${stats?.totalIncome > 0 ? Math.round(((stats.totalIncome - (stats?.totalExpenses || 0)) / stats.totalIncome) * 100) : 0}%

GASTOS POR CATEGORÍA:
${stats?.expensesByCategory ? Object.entries(stats.expensesByCategory).map(([cat, amount]) => `- ${cat}: $${(amount as number).toLocaleString()}`).join('\n') : 'Sin datos'}

ÚLTIMAS TRANSACCIONES:
${transactionsList.length > 0 ? transactionsList.slice(0, 15).map(t => `- ${t.type === 'income' ? '📈' : '📉'} ${t.description} ($${t.amount}) [${t.category}] - ${t.date}`).join('\n') : 'Sin transacciones'}

PRESUPUESTOS:
${budgetsList.length > 0 ? budgetsList.map(b => `- ${b.category}: $${b.spent}/$${b.amount} (${Math.round((b.spent / b.amount) * 100)}%)`).join('\n') : 'Sin presupuestos definidos'}

Genera un análisis en formato JSON con:
1. "summary": Resumen breve (2-3 oraciones) sobre la salud financiera del usuario
2. "insights": Array de 3-5 insights específicos. Cada insight debe tener:
   - "type": "success" | "warning" | "info" | "alert"
   - "title": Título corto del insight
   - "message": Mensaje descriptivo (1-2 oraciones)
   - "icon": uno de ["TrendingUp", "TrendingDown", "AlertCircle", "Target", "Award", "Wallet", "PiggyBank"]
3. "recommendations": Array de 2-4 recomendaciones prácticas (strings)
4. "healthScore": Puntuación de salud financiera de 0 a 100

Enfócate en:
- Patrones de gasto excesivo
- Oportunidades de ahorro
- Categorías con mayor gasto
- Presupuestos que se están excediendo
- Tendencias positivas o negativas
- Consejos personalizados y accionables

Responde SOLO con el JSON, sin texto adicional ni bloques de código.`;

    try {
      const aiText = await generateWithRetry(prompt, { temperature: 0.7, maxOutputTokens: 2048 });

      if (!aiText) {
        return NextResponse.json({
          success: true,
          analysis: generateFallbackAnalysis(stats || {}),
          source: 'fallback',
        });
      }

      const analysis = parseJsonResponse(aiText);
      if (!analysis) {
        return NextResponse.json({
          success: true,
          analysis: generateFallbackAnalysis(stats || {}),
          source: 'fallback',
        });
      }

      return NextResponse.json({ success: true, analysis, source: 'ai' });
    } catch (aiError) {
      console.error('AI analysis error:', aiError);
      return NextResponse.json({
        success: true,
        analysis: generateFallbackAnalysis(stats || {}),
        source: 'fallback',
      });
    }
  } catch (error) {
    console.error('Finance analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al analizar finanzas' },
      { status: 500 }
    );
  }
}
