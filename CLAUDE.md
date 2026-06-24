# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Start dev server (Next.js)
npm run build         # Production build
npm run lint          # ESLint
npm run test          # Vitest (single run)
npm run test:watch    # Vitest (watch mode)
npm run test:coverage
npm run type-check    # tsc --noEmit
```

## Architecture

**Lilly AI** is a personal productivity + finance assistant built with Next.js 16 (App Router), React 19, Tailwind 4, Zustand 5, and Firebase 12. The AI engine is **Anthropic Claude** (`claude-sonnet-4-6` for chat, `claude-haiku-4-5-20251001` for lightweight tasks). Deployed on Netlify.

### Data layer

All persistent state lives in **Firebase Firestore**. Zustand stores (`src/stores/`) mirror Firestore collections; they load on auth and write back on every mutation.

Key collections:
- `transactions / budgets` — finances (also written by MisFinanzas bot, see below)
- `events` — calendar
- `tasks` — tasks
- `debts / receivables` — debt tracking
- `user_profiles/{userId}` — AI memory and learned patterns
- `user_integrations/{userId}` — integration settings (weather API key, Make webhook URL, etc.)

Firebase client: `src/lib/firebase.ts` (uses `NEXT_PUBLIC_FIREBASE_*` vars).  
Firebase Admin (server-only): `src/lib/firebase-admin.ts` — lazy-parses `FIREBASE_SERVICE_ACCOUNT` (JSON or base64). Used by cron jobs and FCM push.

### AI context pipeline

Every chat turn:
1. `src/lib/contextBuilder.ts` — `buildSmartContext(userId)` queries Firestore for today's events, overdue tasks, monthly finances, budget alerts, etc.
2. `src/lib/integrations/index.ts` — `gatherIntegrationContext()` runs enabled plugins (weather, news, web search).
3. Both are injected into the Claude system prompt inside `/api/chat/route.ts`.
4. Claude can call tools (`create_event`, `create_task`, `create_transaction`, …) that hit the `/api/v1/*` REST routes.

### Integrations plugin system

Plugins live in `src/lib/integrations/`. Each implements the `Integration` interface from `types.ts`:
- `execute(params, config)` — on-demand trigger
- `getContext(config)` — passive context injected into the AI prompt each turn

Registered plugins: `weather`, `news`, `webSearch`, `make` (Make.com webhooks).  
Registry + orchestration: `src/lib/integrations/index.ts`.  
User settings persisted in `user_integrations/{userId}` via `src/stores/integrationsStore.ts`.

### MisFinanzas integration (external bot)

A separate Python bot at `C:\Users\User\Desktop\2026\Software propios\MisFinanzas` monitors `deyvifcruz@gmail.com` hourly and extracts Banreservas credit card expense notifications. It writes directly into the shared Firestore `transactions` collection (project `pruebas2026-9088f`). Document IDs follow `misfinanzas_{gmail_message_id}` to prevent duplicates on re-runs.

**Purpose:** gives Lilly real financial context so it can answer questions like "¿cuánto gasté esta semana?" or "¿en qué categoría gasto más?" with actual bank data. ~193 transactions from the last 12 months, updated automatically every hour.

**Filter to target bot transactions:**
```
userId == "c8raT37h0rOZAFPfBAdtgNIMeA82"  AND  account == "tarjeta_banreservas"
```

The document schema matches `Transaction` in `src/types/index.ts:167` field-for-field (`userId`, `type`, `category`, `amount`, `description`, `date`, `account`, `tags`, `isRecurring`, `createdAt`, `updatedAt`). `parseTxDoc()` in `src/stores/financesStore.ts:10` converts Firestore `Timestamp` fields to JS `Date` via `.toDate()`. Valid categories: `alimentacion`, `transporte`, `tecnologia`, `entretenimiento`, `salud`, `vivienda`, `otro`.

### Security

- Origin + referer verification: `src/lib/security.ts`
- In-memory rate limiting per IP/userId: `src/lib/rate-limiter.ts` — tiers: `standard` 60/min, `ai` 20/min, `auth` 10/min, `read` 120/min
- Input sanitization: `sanitiseString()` / `sanitiseObject()` strip HTML and script injection
- Auth: Firebase ID token **or** static API token (`x-api-token` header) — both verified in `src/lib/api-auth.ts`
- Firestore security rules enforce `userId` ownership on every document

### Environment variables

```
ANTHROPIC_API_KEY              # Server-only — Claude API
NEXT_PUBLIC_FIREBASE_*         # 6 public Firebase config vars
FIREBASE_SERVICE_ACCOUNT       # Full service account JSON (admin SDK, server-only)
NEXT_PUBLIC_FIREBASE_VAPID_KEY # FCM web push certificate
CRON_SECRET                    # Protects /api/cron/reminders endpoint
```
