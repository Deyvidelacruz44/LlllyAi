import { NextResponse } from 'next/server';
import { isGeminiAvailable, getModel, parseJsonResponse } from '@/lib/gemini';
import { chatRequestSchema } from '@/lib/schemas';
import { UserProfile } from '@/types';
import { gatherIntegrationContext } from '@/lib/integrations';
import { verifyOrigin } from '@/lib/security';
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from '@/lib/rate-limiter';

export async function POST(request: Request) {
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

    // Validar que la API key esté configurada
    if (!isGeminiAvailable()) {
      return NextResponse.json(
        { 
          error: 'El servicio de IA no está configurado. Contacta al administrador.', 
          success: false 
        },
        { status: 503 }
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

    const model = getModel();

    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentDay = now.toLocaleDateString('es-ES', { weekday: 'long' });

    // Construir sección de memoria del usuario
    let userMemorySection = '';
    if (userProfile) {
      const profile = userProfile as UserProfile;
      userMemorySection = `
MEMORIA DEL USUARIO (Información personal aprendida):
${profile.name ? `- Nombre: ${profile.name}` : '- Nombre: no conocido aún (si se presenta, responde con action "remember" para guardarlo)'}
${profile.timezone ? `- Zona horaria: ${profile.timezone}` : ''}
${profile.workHoursStart && profile.workHoursEnd ? `- Horario laboral: ${profile.workHoursStart} - ${profile.workHoursEnd}` : ''}
${profile.summary?.totalEventsCreated ? `- Eventos creados históricamente: ${profile.summary.totalEventsCreated}` : ''}
${profile.summary?.totalTasksCompleted ? `- Tareas completadas históricamente: ${profile.summary.totalTasksCompleted}` : ''}
${profile.notes && profile.notes.length > 0 ? `
NOTAS PERSONALES (El usuario te pidió recordar esto):
${profile.notes.map((note: string, i: number) => `${i + 1}. ${note}`).join('\n')}
` : ''}
${profile.patterns?.frequentEventTypes?.length ? `- Tipos de evento frecuentes: ${profile.patterns.frequentEventTypes.join(', ')}` : ''}
${profile.patterns?.commonTaskCategories?.length ? `- Categorías de tarea frecuentes: ${profile.patterns.commonTaskCategories.join(', ')}` : ''}
${profile.patterns?.productivityPeakHours?.length ? `- Horas de mayor productividad: ${profile.patterns.productivityPeakHours.join(', ')}` : ''}
${profile.patterns?.preferredMeetingTimes?.length ? `- Horarios preferidos para reuniones: ${profile.patterns.preferredMeetingTimes.join(', ')}` : ''}

USA ESTA INFORMACIÓN para personalizar tus respuestas. Si ves que falta información (nombre, horario laboral, etc.), NO preguntes explícitamente — aprende naturalmente de la conversación.
`;
    }

    // Context section
    let contextSection = '';
    if (agendaContext) {
      if (typeof agendaContext === 'string') {
        contextSection = agendaContext;
      } else {
        contextSection = JSON.stringify(agendaContext, null, 2);
      }
    }

    // Gather external integration context (weather, news, etc.)
    let integrationContextSection = '';
    if (userIntegrations) {
      try {
        const integrationCtx = await gatherIntegrationContext(userIntegrations);
        if (integrationCtx) {
          integrationContextSection = `\n\nINFORMACIÓN EXTERNA EN TIEMPO REAL:\n${integrationCtx}`;
        }
      } catch (e) {
        console.error('Error gathering integration context:', e);
      }
    }

    const systemPrompt = `Eres Lilly, una asistente personal inteligente y proactiva. Tu personalidad es amable, profesional y genuinamente atenta. No eres un simple chatbot — eres una agente personal que gestiona la agenda, finanzas, tareas y vida del usuario.

FECHA Y HORA ACTUAL: ${currentDate} (${currentDay}) ${now.toLocaleTimeString('es-ES')}
${userMemorySection}
ESTADO ACTUAL DEL USUARIO:
${contextSection || 'Sin datos aún — es un usuario nuevo.'}
${integrationContextSection}

═══════════════════════════════════════════════
ACCIONES DISPONIBLES (responde SOLO con JSON):
═══════════════════════════════════════════════

1. CREAR EVENTO:
{"action":"create_event","message":"...","data":{"title":"...","description":"...","day_of_week":"hoy|mañana|lunes|etc","date":"YYYY-MM-DD","start_time":"HH:MM","end_time":"HH:MM","type":"personal|work|meeting|reminder"}}

2. CREAR TAREA:
{"action":"create_task","message":"...","data":{"title":"...","description":"...","priority":"low|medium|high|urgent","day_of_week":"...","date":"YYYY-MM-DD"}}

3. COMPLETAR TAREA (marcar como completada):
{"action":"complete_task","message":"...","data":{"taskId":"ID_DE_LA_TAREA","title":"nombre para confirmar"}}

4. REGISTRAR TRANSACCIÓN:
{"action":"create_transaction","message":"...","data":{"description":"...","amount":123.45,"transaction_type":"expense|income","category":"alimentacion|transporte|vivienda|servicios|entretenimiento|salud|educacion|ropa|tecnologia|salario|freelance|inversiones|ahorro|deuda|regalo|otro","date":"YYYY-MM-DD","day_of_week":"hoy|mañana|etc","account":"principal|banco|efectivo_yo"}}

5. ELIMINAR TAREA:
{"action":"delete_task","message":"...","data":{"taskId":"ID_DE_LA_TAREA","title":"nombre para confirmar"}}

6. ELIMINAR EVENTO:
{"action":"delete_event","message":"...","data":{"eventId":"ID_DEL_EVENTO","title":"nombre para confirmar"}}

7. RECORDAR INFORMACIÓN:
{"action":"remember","message":"...","data":{"note":"resumen conciso de lo que recordar"}}

NOTA: Cuando el usuario te dice su nombre ("soy Juan", "me llamo María"), SIEMPRE usa la acción "remember" con data.note = "El usuario se llama [nombre]" Y TAMBIÉN incluye data.userName = "[nombre]" para guardarlo directamente.

8. CONSULTAR CLIMA:
{"action":"get_weather","message":"...","data":{"city":"nombre de la ciudad"}}

9. BUSCAR EN INTERNET:
{"action":"search_web","message":"...","data":{"query":"búsqueda"}}

10. OBTENER NOTICIAS:
{"action":"get_news","message":"...","data":{}}

NOTA SOBRE INTEGRACIONES: Si ya tienes información del clima o noticias en la sección "INFORMACIÓN EXTERNA EN TIEMPO REAL", úsala directamente en tu respuesta sin ejecutar acciones. Solo usa las acciones 8-10 si el usuario pide información actualizada que no está en tu contexto.

═══════════════════════════════════════════════
REGLAS CRÍTICAS:
═══════════════════════════════════════════════

1. Para ACCIONES → responde SOLO JSON válido (sin texto antes ni después)
2. Para CONSULTAS/CONVERSACIÓN → responde en texto normal SIN JSON
3. Responde SIEMPRE en español
4. Sé concisa pero cálida — usa emojis con moderación
5. Para horas: "3pm" = "15:00", "9am" = "09:00"
6. Si no especifica hora de fin, asume 1 hora después del inicio
7. Si no especifica prioridad, usa "medium"
8. Para completar/eliminar tareas: busca el ID en el contexto de tareas proporcionado
9. Si no encuentras el ID exacto de una tarea/evento, pregunta al usuario cuál quiere
10. Sé PROACTIVA: si ves tareas vencidas, presupuestos excedidos o conflictos de horario, MENCIÓNALO sin que te pregunten
11. Cuando el usuario mencione información personal (nombre, preferencias, hábitos), guárdala con "remember"

EJEMPLOS:
- "Reunión mañana a las 3pm con Pedro" → JSON create_event
- "Agrega tarea: comprar leche" → JSON create_task
- "Gasté 500 en uber" → JSON create_transaction (expense, transporte, 500)
- "Completar la tarea de comprar leche" → JSON complete_task (buscar el ID en el contexto)
- "Elimina el evento del martes" → JSON delete_event (buscar el ID en el contexto)
- "Me llamo Carlos" → JSON remember (note: "El usuario se llama Carlos", userName: "Carlos")
- "¿Qué tengo hoy?" → Texto normal listando eventos/tareas del día
- "¿Cuánto he gastado?" → Texto con análisis financiero del contexto
- "¿Qué clima hace?" → Si tienes datos de clima en contexto, responde directo. Si no, JSON get_weather
- "Busca información sobre X" → JSON search_web
- "¿Cuáles son las noticias de hoy?" → Si tienes noticias en contexto, responde directo. Si no, JSON get_news`;

    const chatHistory = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: systemPrompt }],
        },
        {
          role: 'model',
          parts: [{ text: '¡Hola! 👋 Soy Lilly, tu asistente personal. Gestiono tu agenda, tareas, finanzas y más. ¿En qué te puedo ayudar?' }],
        },
        ...chatHistory.slice(0, -1),
      ],
    });

    const lastMessage = messages[messages.length - 1];

    // Attempt to send with one automatic retry on 429
    let aiResponse: string;
    try {
      const result = await chat.sendMessage(lastMessage.content);
      aiResponse = result.response.text();
    } catch (sendError: unknown) {
      const errMsg = sendError instanceof Error ? sendError.message : String(sendError);
      if (errMsg.includes('429') || errMsg.includes('quota')) {
        // Wait and retry once
        const delayMatch = errMsg.match(/retry in ([\d.]+)s/i);
        const waitMs = delayMatch ? Math.ceil(parseFloat(delayMatch[1]) * 1000) : 10_000;
        await new Promise(resolve => setTimeout(resolve, Math.min(waitMs, 15_000)));
        try {
          const retryResult = await chat.sendMessage(lastMessage.content);
          aiResponse = retryResult.response.text();
        } catch {
          return NextResponse.json(
            { error: 'Lilly está descansando un momento porque se excedió el límite de consultas. Intenta de nuevo en 1 minuto. 🕐', success: false, code: 'RATE_LIMITED' },
            { status: 429 },
          );
        }
      } else {
        throw sendError;
      }
    }

    // Parse JSON actions from AI response
    let parsedAction = null;
    let messageText = aiResponse;

    const parsedJson = parseJsonResponse<{ action?: string; message?: string; data?: any }>(aiResponse);
    if (parsedJson && parsedJson.action && parsedJson.action !== 'none') {
      parsedAction = parsedJson;
      messageText = parsedJson.message || '';
    }

    return NextResponse.json({ 
      message: messageText,
      ...(parsedAction && { action: parsedAction }),
      success: true 
    });

  } catch (error: unknown) {
    console.error('Error in chat API:', error);
    const errMsg = error instanceof Error ? error.message : String(error);

    // Handle known Gemini errors with user-friendly messages
    if (errMsg.includes('429') || errMsg.includes('quota')) {
      return NextResponse.json(
        { error: 'Se excedió el límite de consultas de IA. Intenta de nuevo en unos minutos. 🕐', success: false, code: 'RATE_LIMITED' },
        { status: 429 },
      );
    }
    if (errMsg.includes('403') || errMsg.includes('API key')) {
      return NextResponse.json(
        { error: 'La clave de IA no es válida o no tiene permisos. Verifica GEMINI_API_KEY.', success: false, code: 'AUTH_ERROR' },
        { status: 403 },
      );
    }
    if (errMsg.includes('SAFETY') || errMsg.includes('blocked')) {
      return NextResponse.json(
        { error: 'El mensaje fue filtrado por las políticas de seguridad de la IA. Intenta reformular tu pregunta.', success: false, code: 'SAFETY_BLOCKED' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Error al procesar el mensaje. Intenta de nuevo.', success: false, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
