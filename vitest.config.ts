import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  oxc: {
    // Next.js tsconfig uses jsx: "preserve"; Vitest must transform JSX in .tsx tests.
    jsx: {
      runtime: 'automatic',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Supabase client factories resolve these at call time; give tests a
    // stable dummy config (individual tests may stub their own).
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
    },
    include: ['**/*.{test,spec}.{ts,tsx}'],
    // .claude/** matters: agent worktrees under .claude/worktrees/ contain
    // full repo copies whose test files would otherwise run 7x the suite.
    exclude: ['node_modules', 'dist', '.wrangler', '.claude/**', 'e2e/**', 'playwright.config.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'json-summary'],
      include: [
        'src/lib/**/*.{ts,tsx}',
        'src/services/**/*.{ts,tsx}',
        'src/hooks/**/*.{ts,tsx}',
        'src/components/**/*.{ts,tsx}',
        'src/server/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/*.{test,spec}.{ts,tsx}',
        '**/node_modules/**',
        '**/*.d.ts',
        'src/lib/shared/types/**',
        'src/lib/shared/index.ts',
        'src/lib/shared/services/index.ts',
        'src/lib/shared/types/index.ts',
      ],
      // Vitest's top-level scalar thresholds (lines/statements/branches/functions)
      // always apply as a "global" check over every included file, even ones
      // also matched by a more specific glob entry - a glob entry adds an
      // additional, separate check, it does not carve that file set out of the
      // global aggregate. So the top-level scalar keys are intentionally left
      // unset here, and the pre-issue-18 gate is instead expressed as a single
      // glob-keyed threshold whose brace-expanded pattern covers exactly the
      // previously gated paths as one combined aggregate (matching the old
      // 85/85/75/75 gate, which passed even though middleware.ts alone sits
      // below 85/75 - it only clears the bar combined with the other paths).
      // src/components/** is deliberately not part of this glob, and there is
      // no top-level scalar threshold, so it is measured and reported via
      // `include` above but not gated.
      // Issue #18: coverage on src/components/** is reported, not yet hard-gated
      // - revisit the threshold once real numbers exist from this issue.
      thresholds: {
        // Post-migration equivalent of the old gate: middleware.ts became
        // src/start.ts (ungated, like src/components — Issue #18 successor)
        // and app/api/** handler logic now lives in src/server/**.
        '{src/lib/**/*.{ts,tsx},src/services/**/*.{ts,tsx},src/hooks/**/*.{ts,tsx},src/server/**/*.{ts,tsx}}':
          { lines: 85, statements: 85, branches: 75, functions: 75 },
      },
      reportOnFailure: true,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      shared: path.resolve(__dirname, './src/lib/shared'),
    },
  },
})
