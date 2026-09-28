import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadConfig(): {
    account_id?: string
    vars: Record<string, string>
    env: Record<string, { vars: Record<string, string> }>
} {
    const raw = readFileSync(resolve(process.cwd(), 'wrangler.jsonc'), 'utf8')
    const stripped = raw.replace(/^\s*\/\/.*$/gm, '')
    return JSON.parse(stripped)
}

const PLACEHOLDER = 'REPLACE_AT_DEPLOY'

function assertPlaceholderVars(label: string, vars: Record<string, string>) {
    for (const [key, value] of Object.entries(vars)) {
        if (key === 'VITE_MOBILE_APP_SCHEME' || key === 'MOBILE_APP_SCHEME') {
            expect(value, `${label}.${key}`).toBe('evolutioncombatives')
            continue
        }
        expect(value, `${label}.${key}`).toBe(PLACEHOLDER)
    }
}

describe('wrangler.jsonc deploy placeholders', () => {
    it('uses REPLACE_AT_DEPLOY for every committed var in production, staging, and preview', () => {
        const config = loadConfig()
        expect(config.account_id).toBeUndefined()
        assertPlaceholderVars('production', config.vars)
        assertPlaceholderVars('staging', config.env.staging.vars)
        assertPlaceholderVars('preview', config.env.preview.vars)
    })
})
