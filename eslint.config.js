import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Policy (prod in use — safety first):
// - Do not downgrade or blanket-disable rules (e.g. no-explicit-any) to "go green".
// - Fixes in app code must preserve runtime behavior: types, scopes, dead-code
//   removal, or refactors proven equivalent; avoid logic / API contract changes
//   in the same pass as lint cleanup.
// - globalIgnores only for generated output / deps / reports — never to hide
//   hand-written src or api sources from lint.

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
