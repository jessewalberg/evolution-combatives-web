import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadConfig(): { account_id?: string; vars: Record<string, string>; env: Record<string, { vars: Record<string, string> }> } {
    const raw = readFileSync(resolve(process.cwd(), 'wrangler.jsonc'), 'utf8')
    const stripped = raw.replace(/^\s*\/\/.*$/gm, '')
    return JSON.parse(stripped)
}

const PLACEHOLDER = 'REPLACE_AT_DEPLOY'

describe('wrangler.jsonc production vars', () => {
    it('uses deploy-time placeholders instead of committed public keys and account ids', () => {
        const config = loadConfig()
        const vars = config.vars

        expect(config.account_id).toBeUndefined()
        // Only the committed *production* Cloudflare account id is a
        // placeholder - staging/preview aren't secret, they're this same
        // account's other Workers, and Stream API calls need the real id.
        expect(config.env.staging.vars.CLOUDFLARE_ACCOUNT_ID).not.toBe(PLACEHOLDER)
        expect(config.env.preview.vars.CLOUDFLARE_ACCOUNT_ID).not.toBe(PLACEHOLDER)

        expect(vars.VITE_SUPABASE_ANON_KEY).toBe(PLACEHOLDER)
        expect(vars.SUPABASE_ANON_KEY).toBe(PLACEHOLDER)
        expect(vars.VITE_POSTHOG_KEY).toBe(PLACEHOLDER)
        expect(vars.CLOUDFLARE_ACCOUNT_ID).toBe(PLACEHOLDER)
        expect(vars.VITE_SUPABASE_ANON_KEY).not.toMatch(/^eyJ/)
        expect(vars.VITE_POSTHOG_KEY).not.toMatch(/^phc_/)
    })
})
