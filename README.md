# Agenda AI Personal

Agenda personal inteligente con asistente IA y análisis de métricas, construida con Next.js, Firebase y Google Gemini.

## 🚀 Características

- ✅ **Autenticación completa** (Email/Password + Google)
- 📅 **Calendario interactivo** con vistas mensual, semanal y diaria
- ✔️ **Gestión de tareas** con prioridades y estados
- 💬 **Chat con IA** (comandos en lenguaje natural)
- 📊 **Dashboard de métricas** analizadas por IA
- 📱 **PWA** (instalable en móviles)
- 🔄 **Sincronización en tiempo real** con Firebase

## 🛠️ Stack Tecnológico

- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Backend**: Firebase (Firestore + Auth + Storage)
- **IA**: Google Gemini 1.5 Flash (gratis)
- **Hosting**: Vercel (gratis)

## 📋 Instalación y configuración

### 1. Instalar dependencias:
```bash
npm install
```

### 2. Configurar Gemini API Key:

El archivo `.env.local` ya tiene configurado Firebase. Solo necesitas agregar tu **Gemini API Key GRATIS**:

1. Ve a https://ai.google.dev
2. Haz clic en "Get API Key"
3. Copia tu key y pégala en `.env.local`:

```env
GEMINI_API_KEY=tu-api-key-aqui
```

### 3. Configurar reglas de Firestore:

**IMPORTANTE**: Debes copiar las reglas del archivo `firestore.rules` a tu proyecto Firebase:

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto "Pruebas2026"
3. Ve a **Firestore Database** > **Rules**
4. Copia el contenido de `firestore.rules` 
5. Haz clic en **Publicar**

O usa Firebase CLI:
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

### 4. Habilitar autenticación:

En Firebase Console > Authentication:
- ✅ Habilita **Email/Password**
- ✅ Habilita **Google** (recomendado)

### 5. Ejecutar en desarrollo:

```bash
npm run dev
```

Abre http://localhost:3000

## 📊 Colecciones de Firestore

- `events` - Eventos del calendario
- `tasks` - Tareas y to-dos
- `projects` - Proyectos
- `categories` - Categorías personalizadas
- `ai_conversations` - Historial de chat IA
- `analytics` - Métricas calculadas por IA
- `chats/{chatId}/messages` - Mensajes del chat

## 🚀 Despliegue en Vercel (Gratis)

1. Push tu código a GitHub
2. Importa el proyecto en [Vercel](https://vercel.com)
3. Agrega la variable de entorno `GEMINI_API_KEY`
4. Deploy automático

```bash
npm install -g vercel
vercel
```

## 🔐 Seguridad

- Cada usuario solo accede a sus propios datos
- Autenticación obligatoria para todas las colecciones
- API Keys de Firebase son públicas (seguras para frontend)
- Gemini API Key es server-side (en `.env.local`)

## 💡 Próximas funcionalidades

- [ ] Página de tareas completa
- [ ] Chat con IA integrado
- [ ] Dashboard de métricas IA
- [ ] Notificaciones push
- [ ] Configuración PWA
- [ ] Modo oscuro

## 🆘 Troubleshooting

**Error: "Permission denied" en Firestore**
→ Despliega las reglas de `firestore.rules` a Firebase

**Error: "Gemini API rate limit"**
→ Espera 1 minuto (free tier: 15 req/min)

---

Desarrollado con ❤️ usando tecnologías 100% gratuitas
