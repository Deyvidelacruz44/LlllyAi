/**
 * Integrations Store — Zustand
 * Manages user integration settings (weather, news, webSearch).
 */
import { create } from 'zustand';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import type { UserIntegrations, IntegrationConfig } from '@/lib/integrations';
import { DEFAULT_INTEGRATIONS } from '@/lib/integrations';

interface IntegrationsState {
  integrations: UserIntegrations;
  loading: boolean;
  error: string | null;
  load: (userId: string) => Promise<void>;
  updateIntegration: (userId: string, id: keyof UserIntegrations, config: Partial<IntegrationConfig>) => Promise<void>;
  reset: () => void;
}

export const useIntegrationsStore = create<IntegrationsState>((set, get) => ({
  integrations: { ...DEFAULT_INTEGRATIONS },
  loading: true,
  error: null,

  load: async (userId) => {
    set({ loading: true, error: null });
    try {
      const ref = doc(db, 'user_integrations', userId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as Partial<UserIntegrations>;
        set({
          integrations: {
            weather: { ...DEFAULT_INTEGRATIONS.weather, ...data.weather },
            news: { ...DEFAULT_INTEGRATIONS.news, ...data.news },
            webSearch: { ...DEFAULT_INTEGRATIONS.webSearch, ...data.webSearch },
          },
          loading: false,
        });
      } else {
        // Initialize with defaults
        await setDoc(ref, { ...DEFAULT_INTEGRATIONS, updatedAt: Timestamp.now() });
        set({ integrations: { ...DEFAULT_INTEGRATIONS }, loading: false });
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  updateIntegration: async (userId, id, config) => {
    const current = get().integrations;
    const updated = { ...current[id], ...config };
    const newIntegrations = { ...current, [id]: updated };
    set({ integrations: newIntegrations });

    const ref = doc(db, 'user_integrations', userId);
    await setDoc(ref, { ...newIntegrations, updatedAt: Timestamp.now() }, { merge: true });
  },

  reset: () => {
    set({ integrations: { ...DEFAULT_INTEGRATIONS }, loading: true, error: null });
  },
}));
