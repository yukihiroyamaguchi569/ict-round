import { defineConfig, devices } from '@playwright/test';

// Dedicated port, distinct from vite's dev (5173) and preview (4173) defaults,
// so a server started by hand is never mistaken for the one under test.
const PORT = 4317;
const BASE_URL = `http://localhost:${PORT}`;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    // The app registers a Service Worker in production; keep it out so every test starts clean.
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Test the production build users actually receive, not the dev server.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    // Always build and serve fresh; reusing a server could test a stale build.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
