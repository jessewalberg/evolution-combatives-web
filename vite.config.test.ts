import { afterEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
    vars: {
        VITE_SUPABASE_URL: 'https://production.example',
        VITE_SUPABASE_ANON_KEY: 'production-public-key',
    },
    env: {
        preview: {
            vars: {
                VITE_SUPABASE_URL: 'https://preview.example',
                VITE_SUPABASE_ANON_KEY: 'preview-public-key',
            },
        },
    },
}))

vi.mock('node:fs', async () => {
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
    return {
        ...actual,
        readFileSync: (...args: unknown[]) => String(args[0]).endsWith('wrangler.jsonc')
            ? JSON.stringify(fixture)
            : Reflect.apply(actual.readFileSync, actual, args),
    }
})

import viteConfig from './vite.config'

function resolvedConfig() {
    const factory = viteConfig as (env: { mode: string; command: 'build' }) => {
        define?: Record<string, string>
        envPrefix?: string
    }
    return factory({ mode: 'production', command: 'build' })
}

describe('deployment Vite configuration', () => {
    afterEach(() => vi.unstubAllEnvs())

    it('uses prepared production values instead of local VITE values', () => {
        vi.stubEnv('DEPLOY_BUILD', '1')
        vi.stubEnv('CLOUDFLARE_ENV', '')
        vi.stubEnv('VITE_SUPABASE_URL', 'https://staging.example')

        const config = resolvedConfig()
        expect(config.define?.['import.meta.env.VITE_SUPABASE_URL']).toBe('"https://production.example"')
        expect(config.envPrefix).toBe('DEPLOY_INTERNAL_')
    })

    it('selects preview values and rejects unresolved deploy values', () => {
        vi.stubEnv('DEPLOY_BUILD', '1')
        vi.stubEnv('CLOUDFLARE_ENV', 'preview')
        vi.stubEnv('VITE_SUPABASE_URL', 'https://staging.example')

        expect(resolvedConfig().define?.['import.meta.env.VITE_SUPABASE_URL']).toBe('"https://preview.example"')
        fixture.env.preview.vars.VITE_SUPABASE_URL = 'REPLACE_AT_DEPLOY'
        try {
            expect(() => resolvedConfig()).toThrow('Unresolved deploy value')
        } finally {
            fixture.env.preview.vars.VITE_SUPABASE_URL = 'https://preview.example'
        }
    })

    it('keeps local VITE precedence for ordinary builds', () => {
        vi.stubEnv('DEPLOY_BUILD', '0')
        vi.stubEnv('CLOUDFLARE_ENV', '')
        vi.stubEnv('VITE_SUPABASE_URL', 'https://local.example')

        const config = resolvedConfig()
        expect(config.define?.['import.meta.env.VITE_SUPABASE_URL']).toBeUndefined()
        expect(config.envPrefix).toBe('VITE_')
    })
})
