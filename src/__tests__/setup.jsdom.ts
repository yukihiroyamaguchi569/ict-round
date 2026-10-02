import { afterEach, beforeEach } from 'vitest';
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
