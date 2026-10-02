import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import sonarjs from 'eslint-plugin-sonarjs'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'playwright-report', 'test-results', 'reports', '.stryker-tmp']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      sonarjs.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'sonarjs/cognitive-complexity': ['error', 15],
      complexity: ['error', 10],
      'max-depth': ['error', 4],
      'max-params': ['error', 4],
      // Provisional size limits: warn only, revisit after measuring.
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
      // A TODO / FIXME comment alone should not fail CI.
      'sonarjs/todo-tag': 'off',
      'sonarjs/fixme-tag': 'off',
      // Duplicates @typescript-eslint/no-unused-vars.
      'sonarjs/no-unused-vars': 'off',
      'sonarjs/unused-import': 'off',
    },
  },
  {
    // describe() callbacks grow with the number of cases; length is not a smell there.
    files: ['**/*.test.{ts,tsx}', 'e2e/**/*.ts'],
    rules: {
      'max-lines-per-function': 'off',
    },
  },
  {
    // Playwright tests run in Node.
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // The Playwright fixture callback `use` defined here is not a React hook.
    files: ['e2e/helpers.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
])
