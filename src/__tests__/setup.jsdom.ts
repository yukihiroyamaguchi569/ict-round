import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// jsdom provides a real localStorage; clear it so state does not leak between tests.
beforeEach(() => {
  localStorage.clear();
});

// Vitest globals are disabled, so Testing Library cannot register its auto-cleanup.
afterEach(() => {
  cleanup();
});

// jsdom has no matchMedia; components use it to detect standalone (installed PWA) mode.
window.matchMedia = vi.fn((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));
