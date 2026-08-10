import { defineConfig, globalIgnores } from 'eslint/config'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default defineConfig([
    js.configs.recommended,
    ...tseslint.configs.recommended,
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
