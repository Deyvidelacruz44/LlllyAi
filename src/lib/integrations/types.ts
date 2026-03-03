/**
 * Integration Plugin System Types
 * Standard interface for all external service integrations.
 */

export interface IntegrationConfig {
  enabled: boolean;
  apiKey?: string;
  settings?: Record<string, unknown>;
}

export interface IntegrationContext {
  summary: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface IntegrationResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface Integration {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Short description of what this integration does */
  description: string;
  /** Icon name from lucide-react */
  icon: string;
  /** Whether this integration requires an external API key */
  requiresApiKey: boolean;
  /** Execute the integration's main action with given params */
  execute(params: Record<string, unknown>, config: IntegrationConfig): Promise<IntegrationResult>;
  /** Get contextual info for the AI (injected into prompt) */
  getContext(config: IntegrationConfig): Promise<IntegrationContext | null>;
}

/** User's integration settings stored in Firestore */
export interface UserIntegrations {
  weather: IntegrationConfig;
  news: IntegrationConfig;
  webSearch: IntegrationConfig;
}

export const DEFAULT_INTEGRATIONS: UserIntegrations = {
  weather: { enabled: false },
  news: { enabled: false },
  webSearch: { enabled: false },
};
