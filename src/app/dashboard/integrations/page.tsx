'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useIntegrationsStore } from '@/stores/integrationsStore';
import { getAllIntegrations } from '@/lib/integrations';
import type { UserIntegrations } from '@/lib/integrations';
import {
  CloudSun, Newspaper, Globe, Settings, Check, X, Eye, EyeOff,
  Loader2, Sparkles, Plug, ToggleLeft, ToggleRight, Info, ExternalLink,
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  CloudSun, Newspaper, Globe,
};

export default function IntegrationsPage() {
  const { user } = useAuth();
  const { integrations, loading, load, updateIntegration } = useIntegrationsStore();
  const allPlugins = getAllIntegrations();

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [tempKey, setTempKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [tempCity, setTempCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (user) load(user.uid);
  }, [user, load]);

  const handleToggle = async (id: keyof UserIntegrations) => {
    if (!user) return;
    const current = integrations[id];
    await updateIntegration(user.uid, id, { enabled: !current.enabled });
  };

  const handleSaveApiKey = async (id: keyof UserIntegrations) => {
    if (!user) return;
    setSaving(true);
    await updateIntegration(user.uid, id, { apiKey: tempKey || undefined });
    setEditingKey(null);
    setTempKey('');
    setSaving(false);
  };

  const handleSaveCity = async () => {
    if (!user || !tempCity.trim()) return;
    setSaving(true);
    await updateIntegration(user.uid, 'weather', {
      settings: { ...integrations.weather.settings, defaultCity: tempCity.trim() },
    });
    setTempCity('');
    setSaving(false);
  };

  const handleTest = async (id: string) => {
    setTestResult(null);
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integrationId: id,
          params: id === 'webSearch' ? { query: 'test' } : {},
          userIntegrations: integrations,
        }),
      });
      const data = await res.json();
      setTestResult({
        id,
        success: data.success,
        message: data.success ? '¡Funciona correctamente!' : (data.error || 'Error desconocido'),
      });
    } catch {
      setTestResult({ id, success: false, message: 'Error de conexión' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 bg-gray-200 rounded-xl animate-pulse" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="bg-brand-navy rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 backdrop-blur-sm p-2 rounded-xl">
            <Plug className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Integraciones</h1>
            <p className="text-white/70 text-sm">Conecta servicios externos para ampliar las capacidades de Lilly</p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-brand-blue/10 border border-brand-blue/30 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-brand-navy shrink-0 mt-0.5" />
        <div className="text-sm text-gray-700">
          <p className="font-medium text-brand-navy mb-1">¿Cómo funcionan las integraciones?</p>
          <p>Al activarlas, Lilly podrá consultar clima, noticias y buscar en internet. La información se inyecta en su contexto para que pueda responder preguntas como &quot;¿qué clima hace?&quot; o &quot;¿cuáles son las noticias de hoy?&quot;.</p>
        </div>
      </div>

      {/* Integration Cards */}
      <div className="space-y-4">
        {allPlugins.map((plugin) => {
          const config = integrations[plugin.id as keyof UserIntegrations];
          const Icon = iconMap[plugin.icon] || Settings;
          const isEditing = editingKey === plugin.id;
          const test = testResult?.id === plugin.id ? testResult : null;

          return (
            <div
              key={plugin.id}
              className={`bg-white border rounded-xl p-5 transition-all ${
                config?.enabled
                  ? 'border-brand-blue/40 shadow-md'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Top row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${config?.enabled ? 'bg-brand-navy text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{plugin.name}</h3>
                    <p className="text-xs text-gray-500">{plugin.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(plugin.id as keyof UserIntegrations)}
                  className="shrink-0"
                  title={config?.enabled ? 'Desactivar' : 'Activar'}
                >
                  {config?.enabled ? (
                    <ToggleRight className="w-10 h-10 text-brand-navy" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-gray-300" />
                  )}
                </button>
              </div>

              {/* Config section (only when enabled) */}
              {config?.enabled && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                  {/* API Key */}
                  {plugin.requiresApiKey && (
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">
                        API Key {plugin.id === 'weather' && (
                          <a href="https://openweathermap.org/api" target="_blank" rel="noopener noreferrer"
                            className="text-brand-navy hover:underline inline-flex items-center gap-0.5 ml-1">
                            Obtener <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </label>
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <input
                              type={showKey ? 'text' : 'password'}
                              value={tempKey}
                              onChange={(e) => setTempKey(e.target.value)}
                              placeholder="Pega tu API key aquí..."
                              className="w-full px-3 py-2 pr-9 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue"
                            />
                            <button
                              type="button"
                              onClick={() => setShowKey(!showKey)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <button
                            onClick={() => handleSaveApiKey(plugin.id as keyof UserIntegrations)}
                            disabled={saving}
                            className="p-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 disabled:opacity-50"
                          >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => { setEditingKey(null); setTempKey(''); }}
                            className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingKey(plugin.id);
                            setTempKey(config.apiKey || '');
                            setShowKey(false);
                          }}
                          className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          {config.apiKey ? '🔑 Key configurada — Cambiar' : '+ Agregar API Key'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Weather: default city */}
                  {plugin.id === 'weather' && (
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Ciudad predeterminada</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={tempCity || (config.settings?.defaultCity as string) || ''}
                          onChange={(e) => setTempCity(e.target.value)}
                          placeholder="Ej: Santo Domingo, Madrid, etc."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue"
                        />
                        {tempCity && (
                          <button
                            onClick={handleSaveCity}
                            disabled={saving}
                            className="p-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 disabled:opacity-50"
                          >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Web Search info */}
                  {plugin.id === 'webSearch' && !config.apiKey && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                      <Sparkles className="w-3 h-3 inline mr-1" />
                      Sin SerpAPI key, Lilly usará Gemini para buscar información. Para mejores resultados,
                      agrega una key de <a href="https://serpapi.com" target="_blank" rel="noopener noreferrer" className="text-brand-navy hover:underline">SerpAPI</a>.
                    </p>
                  )}

                  {/* Test button */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleTest(plugin.id)}
                      className="text-xs px-3 py-1.5 bg-brand-blue/10 text-brand-navy rounded-lg hover:bg-brand-blue/20 transition-colors font-medium"
                    >
                      Probar conexión
                    </button>
                    {test && (
                      <span className={`text-xs ${test.success ? 'text-green-600' : 'text-red-500'}`}>
                        {test.success ? '✅' : '❌'} {test.message}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
