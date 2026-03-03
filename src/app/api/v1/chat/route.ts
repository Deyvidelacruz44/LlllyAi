/**
 * REST API v1 — Chat endpoint
 * POST /api/v1/chat — Send a message and get AI response
 *
 * This is a thin proxy over the existing /api/chat route logic.
 * It adds auth verification, rate limiting, and v1 response format.
 */
import { NextResponse } from 'next/server';
import { verifyAuth, apiError, apiSuccess } from '@/lib/api-auth';
import { sendMessageSchema } from '@/lib/api-schemas';
import { sanitiseObject, verifyOrigin } from '@/lib/security';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/lib/rate-limiter';
import { isGeminiAvailable, getModel, parseJsonResponse } from '@/lib/gemini';
import { gatherIntegrationContext } from '@/lib/integrations';

export async function POST(request: Request) {
  const auth = await verifyAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (!verifyOrigin(request)) return apiError('Forbidden', 403);

  // AI calls have a stricter rate limit
  const rl = checkRateLimit(getRateLimitKey(request, auth.userId), RATE_LIMITS.ai);
  if (!rl.allowed) return apiError('Too many requests', 429);

  if (!isGeminiAvailable()) {
    return apiError('AI service not configured', 503);
  }

  try {
    const body = await request.json();
    const parsed = sendMessageSchema.safeParse(sanitiseObject(body));
    if (!parsed.success) {
      return apiError('Validation failed', 400, parsed.error.flatten());
    }

    const { content, agendaContext, userProfile, userIntegrations } = parsed.data;

    // Build integration context
    let integrationContext = '';
    if (userIntegrations) {
      try {
        integrationContext = await gatherIntegrationContext(userIntegrations);
      } catch {
        // Non-fatal: continue without integration data
      }
    }

    const model = getModel();
    const now = new Date();

    const systemPrompt = `Eres Lilly, asistente personal inteligente. Fecha actual: ${now.toISOString().split('T')[0]}.
Responde siempre en español de forma concisa y útil.
${agendaContext ? `\nCONTEXTO:\n${JSON.stringify(agendaContext)}` : ''}
${userProfile ? `\nPERFIL:\n${JSON.stringify(userProfile)}` : ''}
${integrationContext ? `\nINFORMACIÓN EXTERNA:\n${integrationContext}` : ''}

Responde en JSON: { "action": "none", "message": "tu respuesta" }`;

    const result = await model.generateContent(`${systemPrompt}\n\nUsuario: ${content}`);
    const text = result.response.text();
    const json = parseJsonResponse(text);

    return apiSuccess({
      response: json?.message || text,
      action: json?.action || 'none',
      data: json?.data || null,
      raw: text,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return apiError('AI processing failed', 500, message);
  }
}
