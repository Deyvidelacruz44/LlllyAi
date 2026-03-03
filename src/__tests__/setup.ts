/// <reference types="vitest" />
import '@testing-library/jest-dom/vitest';

// Mock Firebase
vi.mock('@/lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
  app: {},
}));

// Mock environment variables
process.env.GEMINI_API_KEY = 'test-key';
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key';
