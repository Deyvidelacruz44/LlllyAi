import { create } from 'zustand';
import { db } from '@/lib/firebase';
import {
  doc, getDoc, setDoc, updateDoc, Timestamp, arrayUnion,
} from 'firebase/firestore';
import { UserProfile } from '@/types';

function parseUserProfile(docSnap: any): UserProfile | null {
  if (!docSnap.exists()) return null;
  const d = docSnap.data();
  return {
    id: docSnap.id,
    ...d,
    createdAt: d.createdAt?.toDate?.() || new Date(),
    updatedAt: d.updatedAt?.toDate?.() || new Date(),
    summary: {
      ...d.summary,
      lastInteraction: d.summary?.lastInteraction?.toDate?.() || undefined,
    },
  } as UserProfile;
}

interface UserProfileState {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;

  load: (userId: string) => Promise<void>;
  update: (userId: string, data: Partial<UserProfile>) => Promise<void>;
  addNote: (userId: string, note: string) => Promise<void>;
  removeNote: (userId: string, index: number) => Promise<void>;
  updateVoiceSettings: (userId: string, settings: Partial<NonNullable<UserProfile['voiceSettings']>>) => Promise<void>;
  updateName: (userId: string, name: string) => Promise<void>;
  reset: () => void;
}

const DEFAULT_PROFILE: Omit<UserProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
  preferredLanguage: 'es',
  patterns: {},
  summary: {
    totalEventsCreated: 0,
    totalTasksCompleted: 0,
    totalConversations: 0,
  },
  notes: [],
};

export const useUserProfileStore = create<UserProfileState>((set, get) => ({
  profile: null,
  loading: true,
  error: null,

  load: async (userId) => {
    set({ loading: true });
    try {
      const ref = doc(db, 'users', userId);
      const snap = await getDoc(ref);
      let profile = parseUserProfile(snap);
      if (!profile) {
        // Create default profile
        const now = Timestamp.now();
        await setDoc(ref, {
          ...DEFAULT_PROFILE,
          userId,
          createdAt: now,
          updatedAt: now,
        });
        profile = {
          ...DEFAULT_PROFILE,
          id: userId,
          userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      set({ profile, loading: false, error: null });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  update: async (userId, data) => {
    const ref = doc(db, 'users', userId);
    await updateDoc(ref, { ...data, updatedAt: Timestamp.now() });
    set((s) => ({
      profile: s.profile ? { ...s.profile, ...data, updatedAt: new Date() } : null,
    }));
  },

  addNote: async (userId, note) => {
    const ref = doc(db, 'users', userId);
    await updateDoc(ref, { notes: arrayUnion(note), updatedAt: Timestamp.now() });
    set((s) => ({
      profile: s.profile
        ? { ...s.profile, notes: [...(s.profile.notes || []), note], updatedAt: new Date() }
        : null,
    }));
  },

  removeNote: async (userId, index) => {
    const profile = get().profile;
    if (!profile) return;
    const notes = [...(profile.notes || [])];
    notes.splice(index, 1);
    const ref = doc(db, 'users', userId);
    await updateDoc(ref, { notes, updatedAt: Timestamp.now() });
    set((s) => ({
      profile: s.profile ? { ...s.profile, notes, updatedAt: new Date() } : null,
    }));
  },

  updateVoiceSettings: async (userId, settings) => {
    const profile = get().profile;
    const current = profile?.voiceSettings || { autoRead: false, speed: 1.0, pitch: 1.0, enabled: true };
    const merged = { ...current, ...settings };
    const ref = doc(db, 'users', userId);
    await updateDoc(ref, { voiceSettings: merged, updatedAt: Timestamp.now() });
    set((s) => ({
      profile: s.profile ? { ...s.profile, voiceSettings: merged, updatedAt: new Date() } : null,
    }));
  },

  updateName: async (userId, name) => {
    const ref = doc(db, 'users', userId);
    await updateDoc(ref, { name, updatedAt: Timestamp.now() });
    set((s) => ({
      profile: s.profile ? { ...s.profile, name, updatedAt: new Date() } : null,
    }));
  },

  reset: () => {
    set({ profile: null, loading: true, error: null });
  },
}));
