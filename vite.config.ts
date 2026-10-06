import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'fs'
import { resolve } from 'path'

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
  build: {
    rollupOptions: {
      input: {
        // merge.html は PC で複数部署のラウンドデータを統合するページ（別エントリなのでスマホ側のバンドルは増えない）
        main: resolve(import.meta.dirname, 'index.html'),
        merge: resolve(import.meta.dirname, 'merge.html'),
      },
    },
  },
  test: {
    // Node's own global localStorage hides jsdom's; turn it off (flag exists since Node 22.4).
    execArgv: ['--no-experimental-webstorage'],
    // Coverage is collected once across both projects below. lcov.info is what scoria reads.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/__tests__/**', 'src/**/*.d.ts'],
    },
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
