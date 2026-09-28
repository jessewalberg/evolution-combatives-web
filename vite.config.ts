import { defineConfig, loadEnv } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Vitest loads this config too; the cloudflare plugin can't run inside the
// test runner, so it is skipped there (vitest.config.ts owns test settings).
const isVitest = Boolean(process.env.VITEST)

/**
 * Parse wrangler.jsonc (full-line // comments only) and return the vars
 * block for the given CLOUDFLARE_ENV (unset → top-level; staging/preview →
 * env.<name>.vars).
 */
function loadWranglerViteVars(cloudflareEnv: string | undefined, deployBuild: boolean): Record<string, string> {
    const raw = readFileSync(resolve(process.cwd(), 'wrangler.jsonc'), 'utf8')
    const stripped = raw.replace(/^\s*\/\/.*$/gm, '')
    const config = JSON.parse(stripped) as {
        vars?: Record<string, string>
        env?: Record<string, { vars?: Record<string, string> }>
    }

    const selected = cloudflareEnv ? config.env?.[cloudflareEnv]?.vars : config.vars
    if (deployBuild && !selected) {
        throw new Error('Deployment environment is missing from Wrangler config')
    }
    const vars = selected ?? {}

    const viteVars: Record<string, string> = {}
    for (const [key, value] of Object.entries(vars)) {
        if (key.startsWith('VITE_') && typeof value === 'string') {
            if (deployBuild && value.includes('REPLACE_AT_DEPLOY')) {
                throw new Error(`Unresolved deploy value for ${key}`)
            }
            viteVars[key] = value
        }
    }
    return viteVars
}

export default defineConfig(({ mode }) => {
    const deployBuild = process.env.DEPLOY_BUILD === '1'
    const existingEnv: Record<string, string> = deployBuild ? {} : loadEnv(mode, process.cwd(), 'VITE_')
    const wranglerVars = loadWranglerViteVars(process.env.CLOUDFLARE_ENV, deployBuild)
    const define: Record<string, string> = {}
    for (const [key, value] of Object.entries(wranglerVars)) {
        if (existingEnv[key] !== undefined) continue
        define[`import.meta.env.${key}`] = JSON.stringify(value)
    }

    return {
        envPrefix: deployBuild ? 'DEPLOY_INTERNAL_' : 'VITE_',
        server: {
            port: 3000,
        },
        resolve: {
            tsconfigPaths: true,
        },
        define,
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
    }
})
