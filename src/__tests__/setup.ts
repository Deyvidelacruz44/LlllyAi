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
process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-key';
