/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest'
import { checkRateLimit, getClientIP, rateLimitResponse } from './rate-limit'

describe('checkRateLimit (in-memory fallback outside Workers)', () => {
    it('enforces the auth limit of 10 per window per key', async () => {
        const key = `test-auth-${Math.random()}`
        for (let i = 0; i < 10; i++) {
            expect(await checkRateLimit('auth', key)).toBe(true)
        }
        expect(await checkRateLimit('auth', key)).toBe(false)
    })

    it('tracks keys independently', async () => {
        const blocked = `blocked-${Math.random()}`
        for (let i = 0; i < 11; i++) await checkRateLimit('auth', blocked)
        expect(await checkRateLimit('auth', blocked)).toBe(false)
        expect(await checkRateLimit('auth', `other-${Math.random()}`)).toBe(true)
    })

    it('tracks kinds independently', async () => {
        const key = `kind-${Math.random()}`
        for (let i = 0; i < 11; i++) await checkRateLimit('auth', key)
        expect(await checkRateLimit('auth', key)).toBe(false)
        expect(await checkRateLimit('api', key)).toBe(true)
    })
})

describe('getClientIP', () => {
    it('prefers cf-connecting-ip, then x-forwarded-for first hop, then x-real-ip', () => {
        expect(
            getClientIP(
                new Request('http://x/', {
                    headers: { 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' },
                })
            )
        ).toBe('1.1.1.1')
        expect(
            getClientIP(new Request('http://x/', { headers: { 'x-forwarded-for': '2.2.2.2, 3.3.3.3' } }))
        ).toBe('2.2.2.2')
        expect(getClientIP(new Request('http://x/', { headers: { 'x-real-ip': '4.4.4.4' } }))).toBe('4.4.4.4')
        expect(getClientIP(new Request('http://x/'))).toBe('unknown')
    })
})

describe('rateLimitResponse', () => {
    it('returns a JSON 429 with Retry-After', async () => {
        const res = rateLimitResponse()
        expect(res.status).toBe(429)
        expect(res.headers.get('Retry-After')).toBe('60')
        const body = await res.json()
        expect(body.error).toBe('Rate limit exceeded')
    })
})
