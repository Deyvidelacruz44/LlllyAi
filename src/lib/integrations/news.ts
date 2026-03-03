/**
 * News Integration Plugin
 * Fetches news from a public RSS feed (Google News) — no API key required.
 * Optional: uses NewsAPI if an API key is provided.
 */
import type { Integration, IntegrationConfig, IntegrationResult, IntegrationContext } from './types';

interface NewsItem {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
}

/** Fetch news from Google News RSS (free, no key needed) */
async function fetchGoogleNewsRSS(topic = 'general', lang = 'es', country = 'DO'): Promise<NewsItem[]> {
  try {
    const feedUrl = topic === 'general'
      ? `https://news.google.com/rss?hl=${lang}&gl=${country}&ceid=${country}:${lang}`
      : `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=${lang}&gl=${country}&ceid=${country}:${lang}`;

    const res = await fetch(feedUrl, { next: { revalidate: 1800 } }); // Cache 30 min
    if (!res.ok) return [];
    const xml = await res.text();

    // Simple XML parsing for RSS items
    const items: NewsItem[] = [];
    const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    for (const itemXml of itemMatches.slice(0, 10)) {
      const title = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/)?.[1] || itemXml.match(/<title>(.*?)<\/title>/)?.[1] || '';
      const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] || '';
      const source = itemXml.match(/<source.*?>(.*?)<\/source>/)?.[1] || '';
      const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';

      if (title) {
        items.push({
          title: title.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
          source: source || 'Google News',
          url: link,
          publishedAt: pubDate,
        });
      }
    }
    return items;
  } catch {
    return [];
  }
}

/** Fetch news from NewsAPI (requires key) */
async function fetchNewsAPI(apiKey: string, category = 'general', country = 'us'): Promise<NewsItem[]> {
  try {
    const url = `https://newsapi.org/v2/top-headlines?country=${country}&category=${category}&pageSize=10&apiKey=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.articles || []).slice(0, 10).map((a: any) => ({
      title: a.title || '',
      source: a.source?.name || '',
      url: a.url || '',
      publishedAt: a.publishedAt || '',
    }));
  } catch {
    return [];
  }
}

export const newsIntegration: Integration = {
  id: 'news',
  name: 'Noticias',
  description: 'Resumen de noticias importantes del día. Usa Google News RSS (gratis) o NewsAPI (con key)',
  icon: 'Newspaper',
  requiresApiKey: false, // Works without key via Google News RSS

  async execute(params, config): Promise<IntegrationResult> {
    if (!config.enabled) {
      return { success: false, error: 'Integración de noticias no activada. Actívala en Configuración > Integraciones.' };
    }
    const topic = (params.topic as string) || 'general';
    try {
      const items = config.apiKey
        ? await fetchNewsAPI(config.apiKey, topic)
        : await fetchGoogleNewsRSS(topic);
      return { success: true, data: { items } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error obteniendo noticias' };
    }
  },

  async getContext(config): Promise<IntegrationContext | null> {
    if (!config.enabled) return null;
    try {
      const items = config.apiKey
        ? await fetchNewsAPI(config.apiKey)
        : await fetchGoogleNewsRSS();

      if (items.length === 0) return null;

      const summary = items.slice(0, 5).map((n, i) => `${i + 1}. ${n.title} (${n.source})`).join('\n');
      return {
        summary: `📰 NOTICIAS DESTACADAS:\n${summary}`,
        data: { items: items.slice(0, 5) },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  },
};
