/**
 * Weather Integration Plugin
 * Uses OpenWeatherMap API to provide weather data to Lilly.
 */
import type { Integration, IntegrationConfig, IntegrationResult, IntegrationContext } from './types';

const OPENWEATHERMAP_BASE = 'https://api.openweathermap.org/data/2.5';

interface WeatherData {
  location: string;
  temperature: number;
  feelsLike: number;
  description: string;
  humidity: number;
  windSpeed: number;
  icon: string;
}

interface ForecastItem {
  date: string;
  tempMin: number;
  tempMax: number;
  description: string;
}

async function fetchCurrentWeather(apiKey: string, city: string, units = 'metric', lang = 'es'): Promise<WeatherData> {
  const url = `${OPENWEATHERMAP_BASE}/weather?q=${encodeURIComponent(city)}&units=${units}&lang=${lang}&appid=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 1800 } }); // Cache 30 min
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Weather API error: ${res.status}`);
  }
  const data = await res.json();
  return {
    location: `${data.name}, ${data.sys?.country || ''}`,
    temperature: Math.round(data.main.temp),
    feelsLike: Math.round(data.main.feels_like),
    description: data.weather?.[0]?.description || '',
    humidity: data.main.humidity,
    windSpeed: Math.round(data.wind?.speed || 0),
    icon: data.weather?.[0]?.icon || '',
  };
}

async function fetchForecast(apiKey: string, city: string, units = 'metric', lang = 'es'): Promise<ForecastItem[]> {
  const url = `${OPENWEATHERMAP_BASE}/forecast?q=${encodeURIComponent(city)}&units=${units}&lang=${lang}&appid=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 3600 } }); // Cache 1h
  if (!res.ok) return [];
  const data = await res.json();

  // Group by day and get daily min/max
  const dailyMap = new Map<string, { min: number; max: number; desc: string }>();
  for (const item of data.list || []) {
    const date = item.dt_txt?.split(' ')[0];
    if (!date) continue;
    const existing = dailyMap.get(date);
    const temp = item.main?.temp ?? 0;
    const desc = item.weather?.[0]?.description || '';
    if (existing) {
      existing.min = Math.min(existing.min, temp);
      existing.max = Math.max(existing.max, temp);
    } else {
      dailyMap.set(date, { min: temp, max: temp, desc });
    }
  }

  return Array.from(dailyMap.entries()).slice(0, 5).map(([date, d]) => ({
    date,
    tempMin: Math.round(d.min),
    tempMax: Math.round(d.max),
    description: d.desc,
  }));
}

export const weatherIntegration: Integration = {
  id: 'weather',
  name: 'Clima',
  description: 'Consulta el clima actual y pronóstico usando OpenWeatherMap',
  icon: 'CloudSun',
  requiresApiKey: true,

  async execute(params, config): Promise<IntegrationResult> {
    if (!config.enabled || !config.apiKey) {
      return { success: false, error: 'Integración de clima no configurada. Actívala en Configuración > Integraciones.' };
    }
    const city = (params.city as string) || (config.settings?.defaultCity as string) || 'Santo Domingo';
    try {
      const [current, forecast] = await Promise.all([
        fetchCurrentWeather(config.apiKey, city),
        fetchForecast(config.apiKey, city),
      ]);
      return {
        success: true,
        data: { current, forecast },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error obteniendo el clima' };
    }
  },

  async getContext(config): Promise<IntegrationContext | null> {
    if (!config.enabled || !config.apiKey) return null;
    const city = (config.settings?.defaultCity as string) || 'Santo Domingo';
    try {
      const current = await fetchCurrentWeather(config.apiKey, city);
      const forecast = await fetchForecast(config.apiKey, city);

      const forecastStr = forecast.length > 0
        ? `\nPronóstico: ${forecast.map(f => `${f.date}: ${f.tempMin}°-${f.tempMax}°C, ${f.description}`).join(' | ')}`
        : '';

      return {
        summary: `🌤️ Clima en ${current.location}: ${current.temperature}°C (sensación ${current.feelsLike}°C), ${current.description}, humedad ${current.humidity}%, viento ${current.windSpeed} km/h.${forecastStr}`,
        data: { current, forecast },
        timestamp: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  },
};
