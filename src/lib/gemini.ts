/**
 * AI Client — Anthropic Claude
 * Drop-in replacement for the former Gemini module.
 * Exports the same public API so all callers work without changes.
 */
import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.warn('⚠️ ANTHROPIC_API_KEY no configurada. Los servicios de IA no funcionarán.');
}

const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

/** Model used for lightweight tasks (analysis, search fallback) */
export const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

/** Model used for the main chat (better reasoning) */
export const CHAT_MODEL = 'claude-sonnet-4-6';

/** Check whether the AI SDK is available */
export function isGeminiAvailable(): boolean {
  return anthropic !== null;
}

interface GenerationConfig {
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Returns a thin model wrapper that exposes the same interface that the
 * former Gemini SDK used, so analytics/finance/v1-chat routes work as-is.
 */
export function getModel(config?: Partial<GenerationConfig>) {
  if (!anthropic) throw new Error('Anthropic API key not configured');

  const maxTokens = config?.maxOutputTokens ?? 1024;
  const temperature = config?.temperature;

  const buildParams = (
    messages: Anthropic.MessageParam[],
    system?: string,
  ): Anthropic.MessageCreateParamsNonStreaming => {
    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: DEFAULT_MODEL,
      max_tokens: maxTokens,
      messages,
    };
    if (temperature !== undefined) params.temperature = temperature;
    if (system) params.system = system;
    return params;
  };

  const extractText = (msg: Anthropic.Message): string =>
    msg.content.find(b => b.type === 'text')?.text ?? '';

  return {
    /** Simple single-turn generation */
    async generateContent(prompt: string) {
      const msg = await anthropic!.messages.create(
        buildParams([{ role: 'user', content: prompt }]),
      );
      const text = extractText(msg);
      return { response: { text: () => text } };
    },

    /**
     * Multi-turn chat wrapper.
     * Gemini encoded the system prompt as history[0] (user) + history[1] (model ack).
     * Claude has a proper `system` parameter, so we extract it.
     */
    startChat(options: {
      history: Array<{ role: string; parts: Array<{ text: string }> }>;
    }) {
      const history = options.history ?? [];

      return {
        async sendMessage(userMessage: string) {
          let systemText: string | undefined;
          let startIdx = 0;

          // Gemini hack: first pair (user/model) is actually the system prompt
          if (
            history.length >= 2 &&
            history[0].role === 'user' &&
            history[1].role === 'model'
          ) {
            systemText = history[0].parts.map(p => p.text).join('');
            startIdx = 2;
          }

          const claudeMessages: Anthropic.MessageParam[] = history
            .slice(startIdx)
            .map(h => ({
              role: (h.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
              content: h.parts.map(p => p.text).join(''),
            }));

          claudeMessages.push({ role: 'user', content: userMessage });

          const msg = await anthropic!.messages.create(
            buildParams(claudeMessages, systemText),
          );
          const text = extractText(msg);
          return { response: { text: () => text } };
        },
      };
    },
  };
}

/** Generate content with automatic retry and exponential backoff */
export async function generateWithRetry(
  prompt: string,
  config?: Partial<GenerationConfig>,
  maxRetries = 3,
): Promise<string> {
  if (!anthropic) throw new Error('Anthropic API key not configured');

  const maxTokens = config?.maxOutputTokens ?? 1024;
  const temperature = config?.temperature;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const params: Anthropic.MessageCreateParamsNonStreaming = {
        model: DEFAULT_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      };
      if (temperature !== undefined) params.temperature = temperature;

      const msg = await anthropic.messages.create(params);
      return msg.content.find(b => b.type === 'text')?.text ?? '';
    } catch (error) {
      lastError = error as Error;
      const isTransient =
        error instanceof Anthropic.RateLimitError ||
        error instanceof Anthropic.InternalServerError ||
        (error instanceof Anthropic.APIError && error.status === 529);

      if (isTransient) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error('Max retries exceeded');
}

/** Parse a JSON object from an AI text response (handles markdown fences) */
export function parseJsonResponse<T = Record<string, unknown>>(text: string): T | null {
  const trimmed = text.trim();

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed) as T; } catch { /* fall through */ }
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]) as T; } catch { /* fall through */ }
  }

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]) as T; } catch { /* fall through */ }
  }

  return null;
}
