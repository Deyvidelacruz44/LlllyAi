import { NextResponse } from 'next/server';
import { z } from 'zod';
import { executeIntegration } from '@/lib/integrations';
import type { UserIntegrations } from '@/lib/integrations';
import { verifyOrigin } from '@/lib/security';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/lib/rate-limiter';

const integrationRequestSchema = z.object({
  integrationId: z.string().min(1),
  params: z.record(z.string(), z.unknown()).default({}),
  userIntegrations: z.any(),
});

export async function POST(request: Request) {
  try {
    // Security: verify same-origin
    if (!verifyOrigin(request)) {
      return NextResponse.json({ error: 'Origen no permitido', success: false }, { status: 403 });
    }

    // Rate limiting by IP
    const rlKey = getRateLimitKey(request);
    const rl = checkRateLimit(rlKey, RATE_LIMITS.standard);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta en un momento.', success: false, code: 'RATE_LIMITED' },
        { status: 429, headers: rl.headers },
      );
    }

    const body = await request.json();
    const parsed = integrationRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Solicitud inválida', details: parsed.error.flatten(), success: false },
        { status: 400 },
      );
    }

    const { integrationId, params, userIntegrations } = parsed.data;
    const result = await executeIntegration(
      integrationId,
      params,
      userIntegrations as UserIntegrations,
    );

    return NextResponse.json({ ...result, success: result.success });
  } catch (error: unknown) {
    console.error('Integration API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error en integración', success: false },
      { status: 500 },
    );
  }
}
