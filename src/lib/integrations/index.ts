/**
 * Integration Registry
 * Central registry for all integration plugins.
 * Each plugin follows the Integration interface.
 */
import type { Integration, IntegrationConfig, UserIntegrations, IntegrationContext } from './types';
import { weatherIntegration } from './weather';
import { newsIntegration } from './news';
import { webSearchIntegration } from './webSearch';

/** All registered integrations */
const registry: Map<string, Integration> = new Map();

// Register built-in integrations
registry.set('weather', weatherIntegration);
registry.set('news', newsIntegration);
registry.set('webSearch', webSearchIntegration);

/** Get all registered integrations */
export function getAllIntegrations(): Integration[] {
  return Array.from(registry.values());
}

/** Get a single integration by ID */
export function getIntegration(id: string): Integration | undefined {
  return registry.get(id);
}

/** Execute an integration action */
export async function executeIntegration(
  id: string,
  params: Record<string, unknown>,
  userIntegrations: UserIntegrations,
) {
  const integration = registry.get(id);
  if (!integration) {
    return { success: false, error: `Integración "${id}" no encontrada` };
  }
  const config = userIntegrations[id as keyof UserIntegrations] as IntegrationConfig | undefined;
  if (!config) {
    return { success: false, error: `Integración "${id}" no configurada` };
  }
  return integration.execute(params, config);
}

/**
 * Gather context from all enabled integrations.
 * Returns a combined string to inject into the AI prompt.
 */
export async function gatherIntegrationContext(
  userIntegrations: UserIntegrations,
): Promise<string> {
  const contexts: IntegrationContext[] = [];

  const promises = Array.from(registry.entries()).map(async ([id, integration]) => {
    const config = userIntegrations[id as keyof UserIntegrations] as IntegrationConfig | undefined;
    if (!config?.enabled) return;
    try {
      const ctx = await integration.getContext(config);
      if (ctx) contexts.push(ctx);
    } catch {
      // Skip failed integrations silently
    }
  });

  await Promise.all(promises);

  if (contexts.length === 0) return '';

  return '\n═══════════════════════════════════════════════\nINFORMACIÓN EXTERNA (Integraciones activas):\n═══════════════════════════════════════════════\n' +
    contexts.map(c => c.summary).join('\n\n');
}

// Re-export types
export type { Integration, IntegrationConfig, UserIntegrations, IntegrationContext } from './types';
export { DEFAULT_INTEGRATIONS } from './types';
