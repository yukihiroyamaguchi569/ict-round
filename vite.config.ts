import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };
const now = new Date();
const buildDate = String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  test: {
    // Component tests (*.test.tsx) opt into jsdom with a `// @vitest-environment jsdom` docblock.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/__tests__/setup.ts'],
    // Node 25+ defines its own global localStorage (undefined without --localstorage-file),
    // which hides jsdom's localStorage from component tests. Turn it off in test workers.
    execArgv: ['--no-experimental-webstorage'],
  },
})
