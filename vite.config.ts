import { defineConfig } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vitest loads this config too; the cloudflare plugin can't run inside the
// test runner, so it is skipped there (vitest.config.ts owns test settings).
const isVitest = Boolean(process.env.VITEST)

export default defineConfig({
    server: {
        port: 3000,
    },
    resolve: {
        tsconfigPaths: true,
    },
    plugins: [
        tailwindcss(),
        // The plugin reads CLOUDFLARE_ENV at build time to pick which env
        // block in wrangler.jsonc to flatten into dist/server/wrangler.json:
        //   CLOUDFLARE_ENV unset    → top-level (evolution-combatives-admin, production)
        //   CLOUDFLARE_ENV=staging  → env.staging
        //   CLOUDFLARE_ENV=preview  → env.preview
        ...(isVitest ? [] : [cloudflare({ viteEnvironment: { name: 'ssr' } })]),
        tanstackStart({
            // Allow colocated page tests inside src/routes without the
            // generator treating them as routes.
            router: { routeFileIgnorePattern: '\\.(test|spec)\\.' },
        }),
        viteReact(),
    ],
})
