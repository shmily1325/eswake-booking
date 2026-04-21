import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Paths here are excluded from all linting (no rules run, no parser load).
// Keep aligned with .gitignore for build output, deps, and generated reports.
const ignoredPaths = [
  '**/node_modules/**',
  'dist/**',
  'dist-ssr/**',
  'coverage/**',
  '.vercel/**',
  'playwright-report/**',
  'test-results/**',
]

export default defineConfig([
  globalIgnores(ignoredPaths),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
