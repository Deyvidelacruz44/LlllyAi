import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY no configurada. El chat IA no funcionará.');
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

interface UserProfileData {
  name?: string;
  patterns?: {
    frequentEventTypes?: string[];
    commonTaskCategories?: string[];
    preferredMeetingTimes?: string[];
    productivityPeakHours?: string[];
  };
  summary?: {
    totalEventsCreated?: number;
    totalTasksCompleted?: number;
    totalConversations?: number;
    lastInteraction?: string;
    commonRequests?: string[];
  };
  notes?: string[];
}

export async function POST(request: Request) {
  try {
    // Validar que la API key esté configurada
    if (!genAI) {
      return NextResponse.json(
        { 
          error: 'El servicio de IA no está configurado. Contacta al administrador.', 
          success: false 
        },
        { status: 503 }
      );
    }

    const { messages, agendaContext, userProfile } = await request.json();

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentDay = now.toLocaleDateString('es-ES', { weekday: 'long' });

    // Construir sección de memoria del usuario
    let userMemorySection = '';
    if (userProfile) {
      const profile = userProfile as UserProfileData;
      userMemorySection = `
MEMORIA DEL USUARIO (Información que has aprendido sobre este usuario):
${profile.name ? `- Nombre: ${profile.name}` : ''}
${profile.summary?.totalEventsCreated ? `- Ha creado ${profile.summary.totalEventsCreated} eventos en total` : ''}
${profile.summary?.totalTasksCompleted ? `- Ha completado ${profile.summary.totalTasksCompleted} tareas` : ''}
${profile.notes && profile.notes.length > 0 ? `
NOTAS PERSONALES (Cosas que el usuario te ha pedido recordar):
${profile.notes.map((note: string, i: number) => `${i + 1}. ${note}`).join('\n')}
` : ''}
${profile.patterns?.frequentEventTypes ? `- Tipos de evento frecuentes: ${profile.patterns.frequentEventTypes.join(', ')}` : ''}
${profile.patterns?.productivityPeakHours ? `- Horas de mayor productividad: ${profile.patterns.productivityPeakHours.join(', ')}` : ''}

USA ESTA INFORMACIÓN para personalizar tus respuestas y dar consejos más relevantes.
`;
    }

    const systemPrompt = `Eres un asistente personal amigable especializado en gestión de agenda y productividad. 
Fecha actual: ${currentDate} (${currentDay})
Hora actual: ${now.toLocaleTimeString('es-ES')}
${userMemorySection}
Información actual de la agenda del usuario:
${agendaContext ? JSON.stringify(agendaContext, null, 2) : 'El usuario aún no tiene eventos ni tareas registradas.'}

CAPACIDADES:
- Crear eventos en el calendario
- Crear tareas con prioridades
- Registrar transacciones financieras (ingresos y gastos)
- Consultar eventos, tareas y finanzas existentes
- Analizar patrones de productividad y financieros
- Recordar información personal del usuario
- Dar consejos personalizados sobre organización y finanzas

INSTRUCCIONES CRÍTICAS PARA ACCIONES:

Cuando el usuario quiera CREAR UN EVENTO, responde SOLO con este JSON:
{
  "action": "create_event",
  "message": "He creado el evento [título]",
  "data": {
    "title": "nombre del evento",
    "description": "descripción opcional",
    "day_of_week": "mañana|hoy|lunes|martes|etc",
    "date": "YYYY-MM-DD (opcional, si especifica fecha exacta)",
    "start_time": "HH:MM (formato 24h)",
    "end_time": "HH:MM (formato 24h)",
    "type": "personal|work|meeting|reminder"
  }
}

Cuando el usuario quiera CREAR UNA TAREA, responde SOLO con este JSON:
{
  "action": "create_task",
  "message": "He creado la tarea [título]",
  "data": {
    "title": "nombre de la tarea",
    "description": "descripción opcional",
    "priority": "low|medium|high|urgent",
    "day_of_week": "día límite opcional"
  }
}

Cuando el usuario quiera REGISTRAR UN GASTO o INGRESO financiero, responde SOLO con este JSON:
{
  "action": "create_transaction",
  "message": "He registrado [el gasto/ingreso] de $[monto]",
  "data": {
    "description": "descripción de la transacción",
    "amount": 123.45,
    "transaction_type": "expense|income",
    "category": "alimentacion|transporte|vivienda|servicios|entretenimiento|salud|educacion|ropa|tecnologia|salario|freelance|inversiones|ahorro|deuda|regalo|otro",
    "date": "YYYY-MM-DD (opcional)",
    "day_of_week": "hoy|mañana|lunes|etc (opcional)"
  }
}

Cuando el usuario te pida RECORDAR algo personal (preferencias, hábitos, información importante), responde con:
{
  "action": "remember",
  "message": "¡Anotado! Recordaré que [lo que dijiste]",
  "data": {
    "note": "resumen conciso de lo que quiere recordar"
  }
}

Para CONSULTAS o CONVERSACIÓN NORMAL (sin crear nada), responde en texto normal conversacional SIN JSON.

EJEMPLOS:
- "Crea reunión mañana a las 3pm" → Responde con JSON create_event
- "Agrega tarea comprar leche" → Responde con JSON create_task
- "Gasté 50 en comida" → Responde con JSON create_transaction (expense, alimentacion, 50)
- "Me pagaron 1500 de freelance" → Responde con JSON create_transaction (income, freelance, 1500)
- "Recuerda que prefiero reuniones por la mañana" → Responde con JSON remember
- "¿Qué tengo hoy?" → Responde en texto normal listando eventos
- "¿Cuánto he gastado este mes?" → Responde en texto usando el contexto financiero
- "Hola, ¿cómo estás?" → Responde en texto normal conversacional

IMPORTANTE:
- Responde SIEMPRE en español
- Sé conciso pero amable
- Usa emojis ocasionalmente
- Si el usuario tiene notas guardadas, ÚSALAS para dar respuestas personalizadas
- Si no entiendes qué quiere crear, pregunta los detalles
- Para horas, interpreta: "3pm" = "15:00", "9am" = "09:00"
- Si no especifica hora de fin, asume 1 hora después del inicio`;

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
          parts: [{ text: '¡Hola! 👋 Soy tu asistente personal de agenda. Puedo ayudarte a organizar tus eventos, tareas y analizar tu productividad. También puedo recordar cosas importantes sobre ti. ¿En qué te puedo ayudar hoy?' }],
        },
        ...chatHistory.slice(0, -1),
      ],
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    const response = result.response.text();

    // Parse JSON actions from AI response
    let parsedAction = null;
    let messageText = response;

    try {
      const trimmed = response.trim();
      // Check if response is pure JSON
      if (trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed);
        if (parsed.action && parsed.action !== 'none') {
          parsedAction = parsed;
          messageText = parsed.message || '';
        }
      } else {
        // Check for JSON embedded in code blocks
        const jsonMatch = trimmed.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.action && parsed.action !== 'none') {
            parsedAction = parsed;
            messageText = parsed.message || trimmed.replace(jsonMatch[0], '').trim();
          }
        }
      }
    } catch (e) {
      // Not valid JSON, treat as plain text response
    }

    return NextResponse.json({ 
      message: messageText,
      ...(parsedAction && { action: parsedAction }),
      success: true 
    });

  } catch (error: unknown) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al procesar el mensaje', success: false },
      { status: 500 }
    );
  }
}
