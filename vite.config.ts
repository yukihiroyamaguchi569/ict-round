import { defineConfig } from 'vite'
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
        main: resolve(__dirname, 'index.html'),
        merge: resolve(__dirname, 'merge.html'),
      },
    },
  },
})
