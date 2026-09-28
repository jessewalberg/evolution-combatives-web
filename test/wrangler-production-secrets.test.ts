import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadProductionVars(): Record<string, string> {
    const raw = readFileSync(resolve(process.cwd(), 'wrangler.jsonc'), 'utf8')
    const stripped = raw.replace(/^\s*\/\/.*$/gm, '')
    const config = JSON.parse(stripped) as { vars?: Record<string, string> }
    return config.vars ?? {}
}

const PLACEHOLDER = 'REPLACE_AT_DEPLOY'

describe('wrangler.jsonc production vars', () => {
    it('uses deploy-time placeholders instead of committed public keys and account ids', () => {
        const vars = loadProductionVars()

        expect(vars.VITE_SUPABASE_ANON_KEY).toBe(PLACEHOLDER)
        expect(vars.SUPABASE_ANON_KEY).toBe(PLACEHOLDER)
        expect(vars.VITE_POSTHOG_KEY).toBe(PLACEHOLDER)
        expect(vars.CLOUDFLARE_ACCOUNT_ID).toBe(PLACEHOLDER)
        expect(vars.VITE_SUPABASE_ANON_KEY).not.toMatch(/^eyJ/)
        expect(vars.VITE_POSTHOG_KEY).not.toMatch(/^phc_/)
    })
})
