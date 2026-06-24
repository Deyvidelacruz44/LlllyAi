import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { CHAT_MODEL, isGeminiAvailable, parseJsonResponse } from '@/lib/gemini';
import { chatRequestSchema } from '@/lib/schemas';
import { UserProfile } from '@/types';
import { gatherIntegrationContext } from '@/lib/integrations';
import { verifyOrigin } from '@/lib/security';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/lib/rate-limiter';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// ─── Tool definitions ──────────────────────────────────────────────────────────
// Claude uses these for structured action execution instead of JSON-in-text.
const LILLY_TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_event',
    description: 'Crea un evento en el calendario del usuario',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Título del evento' },
        description: { type: 'string', description: 'Descripción opcional' },
        day_of_week: { type: 'string', description: 'hoy|mañana|lunes|martes|miércoles|jueves|viernes|sábado|domingo' },
        date: { type: 'string', description: 'Fecha en formato YYYY-MM-DD (alternativa a day_of_week)' },
        start_time: { type: 'string', description: 'Hora de inicio HH:MM (ej: 09:00, 15:30)' },
        end_time: { type: 'string', description: 'Hora de fin HH:MM. Si no se especifica, asume 1 hora después del inicio' },
        type: { type: 'string', enum: ['personal', 'work', 'meeting', 'reminder'] },
      },
      required: ['title'],
    },
  },
  {
    name: 'create_task',
    description: 'Crea una tarea en la lista de tareas del usuario',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Título de la tarea' },
        description: { type: 'string', description: 'Descripción opcional' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        day_of_week: { type: 'string', description: 'Fecha de vencimiento: hoy|mañana|lunes|...' },
        date: { type: 'string', description: 'Fecha de vencimiento YYYY-MM-DD' },
        status: { type: 'string', enum: ['pending', 'in-progress'] },
      },
      required: ['title'],
    },
  },
  {
    name: 'complete_task',
    description: 'Marca una tarea existente como completada. Busca el taskId en el contexto de tareas.',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: { type: 'string', description: 'ID de la tarea (del contexto de tareas proporcionado)' },
        title: { type: 'string', description: 'Nombre de la tarea para confirmar al usuario' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'delete_task',
    description: 'Elimina una tarea existente permanentemente',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: { type: 'string', description: 'ID de la tarea a eliminar' },
        title: { type: 'string', description: 'Nombre de la tarea para confirmar al usuario' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'delete_event',
    description: 'Elimina un evento del calendario',
    input_schema: {
      type: 'object' as const,
      properties: {
        eventId: { type: 'string', description: 'ID del evento a eliminar' },
        title: { type: 'string', description: 'Nombre del evento para confirmar al usuario' },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'create_transaction',
    description: 'Registra una transacción financiera (ingreso o gasto)',
    input_schema: {
      type: 'object' as const,
      properties: {
        description: { type: 'string', description: 'Descripción de la transacción' },
        amount: { type: 'number', description: 'Monto numérico (sin símbolo de moneda)' },
        currency: { type: 'string', enum: ['DOP', 'USD'], description: 'Moneda del monto: DOP (pesos dominicanos, por defecto) o USD (dólares). Usa USD solo si el usuario lo menciona explícitamente.' },
        transaction_type: { type: 'string', enum: ['expense', 'income'] },
        category: {
          type: 'string',
          enum: [
            'alimentacion', 'transporte', 'vivienda', 'servicios',
            'entretenimiento', 'salud', 'educacion', 'ropa', 'tecnologia',
            'salario', 'freelance', 'inversiones', 'ahorro', 'deuda', 'regalo', 'otro',
          ],
        },
        date: { type: 'string', description: 'Fecha YYYY-MM-DD' },
        day_of_week: { type: 'string', description: 'hoy|mañana|ayer|lunes|...' },
        account: { type: 'string', enum: ['principal', 'banco', 'efectivo_yo'] },
      },
      required: ['description', 'amount', 'transaction_type'],
    },
  },
  {
    name: 'remember',
    description: 'Guarda información personal del usuario en su perfil (nombre, preferencias, hábitos). Úsala cuando el usuario se presente o comparta algo sobre sí mismo.',
    input_schema: {
      type: 'object' as const,
      properties: {
        note: { type: 'string', description: 'Nota concisa de lo que recordar sobre el usuario' },
        userName: { type: 'string', description: 'Nombre del usuario, solo si se acaba de presentar' },
      },
      required: ['note'],
    },
  },
  {
    name: 'get_weather',
    description: 'Consulta el clima actual de una ciudad cuando el usuario lo solicita y no hay datos de clima en el contexto',
    input_schema: {
      type: 'object' as const,
      properties: {
        city: { type: 'string', description: 'Nombre de la ciudad' },
      },
      required: ['city'],
    },
  },
  {
    name: 'search_web',
    description: 'Busca información actualizada en internet cuando el usuario lo pide explícitamente',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Términos de búsqueda' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_news',
    description: 'Obtiene las noticias más recientes cuando el usuario las solicita y no hay noticias en el contexto',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

// ─── Message normalisation ─────────────────────────────────────────────────────
function buildClaudeMessages(
  raw: Array<{ role: string; content: string }>,
): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = [];

  for (const msg of raw) {
    const role = (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant';

    // Claude requires messages to start with 'user'
    if (result.length === 0 && role === 'assistant') continue;

    const prev = result[result.length - 1];
    if (prev?.role === role) {
      // Merge consecutive same-role messages (e.g. greeting + real message)
      (prev.content as string) += '\n' + msg.content;
    } else {
      result.push({ role, content: msg.content });
    }
  }

  return result;
}

// ─── Route handler ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    if (!verifyOrigin(request)) {
      return NextResponse.json({ error: 'Origen no permitido', success: false }, { status: 403 });
    }

    const rlKey = getRateLimitKey(request);
    const rl = checkRateLimit(rlKey, RATE_LIMITS.ai);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta en un momento.', success: false, code: 'RATE_LIMITED' },
        { status: 429, headers: rl.headers },
      );
    }

    if (!isGeminiAvailable() || !anthropic) {
      return NextResponse.json(
        { error: 'El servicio de IA no está configurado. Configura ANTHROPIC_API_KEY.', success: false },
        { status: 503 },
      );
    }

    const body = await request.json();
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Solicitud inválida', details: parsed.error.flatten(), success: false },
        { status: 400 },
      );
    }

    const { messages, agendaContext, userProfile, userIntegrations } = parsed.data;

    // ── Build system prompt ──────────────────────────────────────────────────
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentDay = now.toLocaleDateString('es-ES', { weekday: 'long' });

    let userMemorySection = '';
    if (userProfile) {
      const p = userProfile as UserProfile;
      userMemorySection = [
        '\nMEMORIA DEL USUARIO:',
        p.name ? `- Nombre: ${p.name}` : '- Nombre: desconocido (si se presenta, usa la herramienta "remember")',
        p.timezone ? `- Zona horaria: ${p.timezone}` : '',
        p.workHoursStart && p.workHoursEnd ? `- Horario laboral: ${p.workHoursStart} - ${p.workHoursEnd}` : '',
        p.notes?.length ? `\nNOTAS PERSONALES:\n${p.notes.map((n: string, i: number) => `${i + 1}. ${n}`).join('\n')}` : '',
        p.patterns?.frequentEventTypes?.length ? `- Tipos de evento frecuentes: ${p.patterns.frequentEventTypes.join(', ')}` : '',
        p.patterns?.productivityPeakHours?.length ? `- Horas productivas: ${p.patterns.productivityPeakHours.join(', ')}` : '',
      ].filter(Boolean).join('\n');
    }

    let contextSection = '';
    if (agendaContext) {
      contextSection = typeof agendaContext === 'string'
        ? agendaContext
        : JSON.stringify(agendaContext, null, 2);
    }

    let integrationSection = '';
    if (userIntegrations) {
      try {
        const ctx = await gatherIntegrationContext(userIntegrations);
        if (ctx) integrationSection = `\n\nINFORMACIÓN EXTERNA EN TIEMPO REAL:\n${ctx}`;
      } catch { /* non-fatal */ }
    }

    const systemPrompt = `Eres Lilly, asistente personal inteligente y proactiva de ${userProfile && (userProfile as UserProfile).name ? (userProfile as UserProfile).name : 'tu usuario'}. Tu personalidad es amable, profesional y genuinamente atenta. Gestionas agenda, tareas, finanzas y vida del usuario.

FECHA Y HORA: ${currentDate} (${currentDay}) ${now.toLocaleTimeString('es-ES')}
${userMemorySection}

ESTADO ACTUAL DEL USUARIO:
${contextSection || 'Usuario nuevo, sin datos todavía.'}
${integrationSection}

INSTRUCCIONES:
- Responde SIEMPRE en español
- Sé concisa pero cálida. Emojis con moderación
- Para acciones (crear evento, tarea, transacción, etc.) usa las herramientas disponibles — NO las menciones en texto, simplemente úsalas
- Para consultas o conversación, responde en texto normal
- Sé PROACTIVA: si ves tareas vencidas, presupuestos excedidos o conflictos, menciónalo
- Para horas: "3pm" = "15:00", "9am" = "09:00"
- Finanzas con dos monedas: DOP (pesos RD$, por defecto) y USD (dólares US$). Si el usuario menciona "dólares"/"USD", registra en USD; si no, asume DOP. NUNCA sumes pesos y dólares juntos: si te piden un total con ambas monedas, repórtalas por separado (ej. "RD$19,000 y US$33")
- Si no especifica prioridad, usa "medium"; si no especifica hora fin, asume +1 hora
- Para completar/eliminar: busca el ID exacto en el contexto. Si no lo encuentras, pregunta
- Cuando el usuario diga su nombre o comparta información personal, usa "remember"
- Si ya tienes datos de clima/noticias en el contexto, úsalos directamente sin llamar a las herramientas`;

    // ── Build message history ────────────────────────────────────────────────
    const claudeMessages = buildClaudeMessages(
      messages as Array<{ role: string; content: string }>,
    );

    if (claudeMessages.length === 0) {
      return NextResponse.json({ error: 'No hay mensajes', success: false }, { status: 400 });
    }

    // ── Call Claude ──────────────────────────────────────────────────────────
    let response: Anthropic.Message;
    try {
      response = await anthropic.messages.create({
        model: CHAT_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        tools: LILLY_TOOLS,
        messages: claudeMessages,
      });
    } catch (sendError: unknown) {
      if (sendError instanceof Anthropic.RateLimitError) {
        // One retry after a brief wait
        await new Promise(r => setTimeout(r, 10_000));
        try {
          response = await anthropic.messages.create({
            model: CHAT_MODEL,
            max_tokens: 1024,
            system: systemPrompt,
            tools: LILLY_TOOLS,
            messages: claudeMessages,
          });
        } catch {
          return NextResponse.json(
            { error: 'Lilly está descansando un momento. Intenta en 1 minuto. 🕐', success: false, code: 'RATE_LIMITED' },
            { status: 429 },
          );
        }
      } else {
        throw sendError;
      }
    }

    // ── Parse response ───────────────────────────────────────────────────────
    const textBlock = response.content.find(b => b.type === 'text');
    const toolBlock = response.content.find(b => b.type === 'tool_use');

    const messageText = textBlock?.type === 'text' ? textBlock.text : '';

    if (toolBlock?.type === 'tool_use') {
      // Claude decided to use a tool → translate to the format FloatingChat expects
      return NextResponse.json({
        message: messageText,
        action: {
          action: toolBlock.name,
          message: messageText || `Ejecutando acción...`,
          data: toolBlock.input,
        },
        success: true,
      });
    }

    // Pure text response (conversation, analysis, questions)
    return NextResponse.json({ message: messageText, success: true });

  } catch (error: unknown) {
    console.error('Error in chat API:', error);
    const errMsg = error instanceof Error ? error.message : String(error);

    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: 'Se excedió el límite de consultas. Intenta de nuevo en unos minutos. 🕐', success: false, code: 'RATE_LIMITED' },
        { status: 429 },
      );
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: 'La clave de IA no es válida. Verifica ANTHROPIC_API_KEY.', success: false, code: 'AUTH_ERROR' },
        { status: 403 },
      );
    }
    if (error instanceof Anthropic.PermissionDeniedError) {
      return NextResponse.json(
        { error: 'La clave de IA no tiene permiso o crédito para este modelo.', success: false, code: 'PERMISSION_ERROR', detail: errMsg },
        { status: 403 },
      );
    }
    if (error instanceof Anthropic.NotFoundError) {
      return NextResponse.json(
        { error: 'Modelo de IA no encontrado. Verifica el ID del modelo.', success: false, code: 'MODEL_NOT_FOUND', detail: errMsg },
        { status: 404 },
      );
    }
    if (error instanceof Anthropic.BadRequestError) {
      return NextResponse.json(
        { error: 'Solicitud inválida a la IA.', success: false, code: 'BAD_REQUEST', detail: errMsg },
        { status: 400 },
      );
    }
    if (errMsg.includes('SAFETY') || errMsg.includes('blocked')) {
      return NextResponse.json(
        { error: 'El mensaje fue filtrado. Intenta reformular tu pregunta.', success: false, code: 'SAFETY_BLOCKED' },
        { status: 400 },
      );
    }

    // Surface the real error detail so failures are diagnosable in production
    return NextResponse.json(
      { error: 'Error al procesar el mensaje. Intenta de nuevo.', success: false, code: 'INTERNAL_ERROR', detail: errMsg },
      { status: 500 },
    );
  }
}
