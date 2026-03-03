import { GoogleGenerativeAI, GenerativeModel, GenerationConfig } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY no configurada. Los servicios de IA no funcionarán.');
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

/** Default model ID used across all AI features */
export const DEFAULT_MODEL = 'gemini-2.0-flash';

/** Check whether the Gemini SDK is available */
export function isGeminiAvailable(): boolean {
  return genAI !== null;
}

/** Get a Gemini generative model with optional config overrides */
export function getModel(config?: Partial<GenerationConfig>): GenerativeModel {
  if (!genAI) {
    throw new Error('Gemini API key not configured');
  }
  return genAI.getGenerativeModel({
    model: DEFAULT_MODEL,
    ...(config ? { generationConfig: config } : {}),
  });
}

/** Generate content with automatic retry and exponential backoff */
export async function generateWithRetry(
  prompt: string,
  config?: Partial<GenerationConfig>,
  maxRetries = 3,
): Promise<string> {
  const model = getModel(config);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      lastError = error as Error;
      const message = lastError.message || '';
      // Retry on rate-limit or transient server errors
      if (message.includes('429') || message.includes('500') || message.includes('503')) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error; // Non-retryable error
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/** Parse a JSON object from an AI text response (handles markdown fences) */
export function parseJsonResponse<T = Record<string, unknown>>(text: string): T | null {
  const trimmed = text.trim();

  // Try direct parse
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as T;
    } catch { /* fall through */ }
  }

  // Try extracting from markdown code fence
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]) as T;
    } catch { /* fall through */ }
  }

  // Try finding a JSON object anywhere in the text
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as T;
    } catch { /* fall through */ }
  }

  return null;
}
