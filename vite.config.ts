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
    // Node 25+ defines its own global localStorage (undefined without --localstorage-file),
    // which hides jsdom's localStorage from component tests. Turn it off in test workers.
    execArgv: ['--no-experimental-webstorage'],
    // Logic tests (*.test.ts) run in node, component tests (*.test.tsx) in jsdom.
    // extends: true lets both projects inherit the plugins, define and test options above.
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          setupFiles: ['./src/__tests__/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./src/__tests__/setup.jsdom.ts'],
        },
      },
    ],
  },
})
