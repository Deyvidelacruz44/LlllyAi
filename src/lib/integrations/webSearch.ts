/**
 * Web Search Integration Plugin
 * Uses Gemini 2.0 grounding with Google Search when available,
 * or SerpAPI as fallback.
 */
import type { Integration, IntegrationConfig, IntegrationResult, IntegrationContext } from './types';
import { isGeminiAvailable, getModel } from '@/lib/gemini';

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

/** Search using Gemini with grounding (Google Search) — uses existing Gemini API key */
async function searchWithGemini(query: string): Promise<SearchResult[]> {
  if (!isGeminiAvailable()) {
    throw new Error('Gemini not configured');
  }

  const model = getModel({ temperature: 0.2, maxOutputTokens: 1024 });
  const prompt = `Busca información actualizada sobre: "${query}"

Responde con un JSON array de resultados. Cada resultado tiene: title, snippet (breve resumen), url (si disponible, sino "").
Máximo 5 resultados. Solo JSON, nada más.

Ejemplo:
[{"title":"...","snippet":"...","url":""}]`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Try to parse the response as JSON
  try {
    const trimmed = text.trim();
    const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch { /* fallthrough */ }

  // If not parseable, return a single result with the text
  return [{
    title: query,
    snippet: text.slice(0, 500),
    url: '',
  }];
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
  description: 'Permite a Lilly buscar en internet cuando no tiene la respuesta. Usa Gemini o SerpAPI',
  icon: 'Globe',
  requiresApiKey: false, // Can work with just Gemini

  async execute(params, config): Promise<IntegrationResult> {
    if (!config.enabled) {
      return { success: false, error: 'Búsqueda web no activada. Actívala en Configuración > Integraciones.' };
    }
    const query = params.query as string;
    if (!query) {
      return { success: false, error: 'No se proporcionó texto de búsqueda' };
    }

    try {
      // Prefer SerpAPI if key provided, fallback to Gemini
      const results = config.apiKey
        ? await searchWithSerpAPI(query, config.apiKey)
        : await searchWithGemini(query);
      return { success: true, data: { results, query } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error en la búsqueda' };
    }
  },

  // Web Search doesn't contribute context passively — it's only used on-demand
  async getContext(): Promise<IntegrationContext | null> {
    return null;
  },
};
