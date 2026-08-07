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
      thresholds: {
        lines: 85,
        statements: 85,
        branches: 75,
        functions: 75,
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
