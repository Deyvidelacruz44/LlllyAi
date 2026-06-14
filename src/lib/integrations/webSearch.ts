/**
 * Web Search Integration Plugin
 * Uses SerpAPI when a key is provided, otherwise falls back to Claude.
 */
import type { Integration, IntegrationConfig, IntegrationResult, IntegrationContext } from './types';
import { isGeminiAvailable, generateWithRetry } from '@/lib/gemini';

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

/** Search using Claude's knowledge as a fallback when no SerpAPI key is set */
async function searchWithClaude(query: string): Promise<SearchResult[]> {
  if (!isGeminiAvailable()) throw new Error('AI not configured');

  const text = await generateWithRetry(
    `Busca información actualizada sobre: "${query}"

Responde con un JSON array de hasta 5 resultados. Cada resultado: {"title":"...","snippet":"resumen breve","url":""}.
Solo JSON, nada más.

Ejemplo:
[{"title":"Ejemplo","snippet":"Resumen del tema...","url":""}]`,
    { temperature: 0.2, maxOutputTokens: 1024 },
  );

  try {
    const match = text.trim().match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
  } catch { /* fallthrough */ }

  return [{ title: query, snippet: text.slice(0, 500), url: '' }];
}

/** Search using SerpAPI (requires key) */
async function searchWithSerpAPI(query: string, apiKey: string): Promise<SearchResult[]> {
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&hl=es&num=5&api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpAPI error: ${res.status}`);
  const data = await res.json();
  return (data.organic_results || []).slice(0, 5).map((r: any) => ({
    title: r.title || '',
    snippet: r.snippet || '',
    url: r.link || '',
  }));
}

export const webSearchIntegration: Integration = {
  id: 'webSearch',
  name: 'Búsqueda Web',
  description: 'Permite a Lilly buscar en internet. Usa SerpAPI si está configurada, o Claude como alternativa.',
  icon: 'Globe',
  requiresApiKey: false,

  async execute(params, config): Promise<IntegrationResult> {
    if (!config.enabled) {
      return { success: false, error: 'Búsqueda web no activada. Actívala en Integraciones.' };
    }
    const query = params.query as string;
    if (!query) return { success: false, error: 'No se proporcionó texto de búsqueda' };

    try {
      const results = config.apiKey
        ? await searchWithSerpAPI(query, config.apiKey)
        : await searchWithClaude(query);
      return { success: true, data: { results, query } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error en la búsqueda' };
    }
  },

  async getContext(): Promise<IntegrationContext | null> {
    return null;
  },
};
