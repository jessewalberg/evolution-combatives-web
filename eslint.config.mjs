import { defineConfig, globalIgnores } from 'eslint/config'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default defineConfig([
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            // Codebase norm: underscore prefix marks intentionally unused
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
            ],
            // Legacy switch-case style throughout the service layer
            'no-case-declarations': 'off',
            // Deliberate casts bridging the stale shared Database types
            '@typescript-eslint/no-explicit-any': 'warn',
        },
    },
    {
        files: ['scripts/**/*.mjs'],
        languageOptions: {
            globals: {
                console: 'readonly',
                process: 'readonly',
            },
        },
    },
    globalIgnores([
        'node_modules/**',
        'dist/**',
        '.next/**',
        '.output/**',
        '.wrangler/**',
        '.claude/**',
        '.conductor/**',
        'coverage/**',
        'playwright-report/**',
        'test-results/**',
        'src/routeTree.gen.ts',
        'worker-configuration.d.ts',
        'next-env.d.ts',
    ]),
])
