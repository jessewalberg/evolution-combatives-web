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
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'json-summary'],
      include: [
        'src/lib/**/*.{ts,tsx}',
        'src/services/**/*.{ts,tsx}',
        'src/hooks/**/*.{ts,tsx}',
        'src/components/**/*.{ts,tsx}',
        'middleware.ts',
        'app/api/**/*.{ts,tsx}',
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
      // Aggregate thresholds cover lib/services/hooks/middleware/api, matching
      // the pre-issue-18 gate. src/components/** gets its own glob entry below
      // so it is excluded from this aggregate (per Vitest's per-glob threshold
      // sets) but is still measured and reported via `include` above.
      // Issue #18: coverage on src/components/** is reported, not yet hard-gated
      // - revisit the threshold once real numbers exist from this issue.
      thresholds: {
        lines: 85,
        statements: 85,
        branches: 75,
        functions: 75,
        'src/components/**/*.{ts,tsx}': {
          lines: 0,
          statements: 0,
          branches: 0,
          functions: 0,
        },
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
