import { describe, it, expect } from 'vitest'
import {
  generateCSRFToken,
  validateCSRFToken,
  needsCSRFProtection,
  csrfProtection,
} from '@/src/lib/csrf-protection'
import { createNextRequest } from '@/test/helpers/next-request'

describe('generateCSRFToken', () => {
  it('returns a 64-char hex string', () => {
    const token = generateCSRFToken()
    expect(token).toMatch(/^[a-f0-9]{64}$/)
    expect(generateCSRFToken()).not.toBe(token)
  })
})

describe('needsCSRFProtection', () => {
  it('requires CSRF for state-changing API routes', () => {
    expect(needsCSRFProtection(createNextRequest('/api/content/videos', { method: 'POST' }))).toBe(true)
    expect(needsCSRFProtection(createNextRequest('/api/content/videos', { method: 'PUT' }))).toBe(true)
    expect(needsCSRFProtection(createNextRequest('/api/content/videos', { method: 'PATCH' }))).toBe(true)
    expect(needsCSRFProtection(createNextRequest('/api/content/videos', { method: 'DELETE' }))).toBe(true)
  })

  it('skips GET, non-API, webhooks, and mobile API', () => {
    expect(needsCSRFProtection(createNextRequest('/api/content/videos', { method: 'GET' }))).toBe(false)
    expect(needsCSRFProtection(createNextRequest('/dashboard', { method: 'POST' }))).toBe(false)
    expect(needsCSRFProtection(createNextRequest('/api/webhooks/stripe', { method: 'POST' }))).toBe(false)
    expect(needsCSRFProtection(createNextRequest('/api/webhook/test', { method: 'POST' }))).toBe(false)
    expect(needsCSRFProtection(createNextRequest('/api/mobile/video/signed-url', { method: 'POST' }))).toBe(false)
  })
})

describe('validateCSRFToken', () => {
  it('returns false when header or cookie missing', async () => {
    const token = generateCSRFToken()
    expect(await validateCSRFToken(createNextRequest('/api/x', { method: 'POST' }))).toBe(false)
    expect(
      await validateCSRFToken(
        createNextRequest('/api/x', {
          method: 'POST',
          headers: { 'X-CSRF-Token': token },
        })
      )
    ).toBe(false)
    expect(
      await validateCSRFToken(
        createNextRequest('/api/x', {
          method: 'POST',
          cookies: { 'csrf-token': token },
        })
      )
    ).toBe(false)
  })

  it('returns false when tokens mismatch or length invalid', async () => {
    const token = generateCSRFToken()
    expect(
      await validateCSRFToken(
        createNextRequest('/api/x', {
          method: 'POST',
          headers: { 'X-CSRF-Token': token },
          cookies: { 'csrf-token': '0'.repeat(64) },
        })
      )
    ).toBe(false)
    expect(
      await validateCSRFToken(
        createNextRequest('/api/x', {
          method: 'POST',
          headers: { 'X-CSRF-Token': 'short' },
          cookies: { 'csrf-token': 'short' },
        })
      )
    ).toBe(false)
  })

  it('returns true when header and cookie match 64-char token', async () => {
    const token = generateCSRFToken()
    expect(
      await validateCSRFToken(
        createNextRequest('/api/x', {
          method: 'POST',
          headers: { 'X-CSRF-Token': token },
          cookies: { 'csrf-token': token },
        })
      )
    ).toBe(true)
  })
})

describe('csrfProtection', () => {
  it('returns null when protection not needed', async () => {
    expect(await csrfProtection(createNextRequest('/api/health'))).toBeNull()
  })

  it('returns 403 when CSRF invalid', async () => {
    const res = await csrfProtection(
      createNextRequest('/api/content/videos', { method: 'POST' })
    )
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
    const body = await res!.json()
    expect(body.error).toBe('CSRF token validation failed')
  })

  it('returns null when CSRF valid', async () => {
    const token = generateCSRFToken()
    const res = await csrfProtection(
      createNextRequest('/api/content/videos', {
        method: 'POST',
        headers: { 'X-CSRF-Token': token },
        cookies: { 'csrf-token': token },
      })
    )
    expect(res).toBeNull()
  })
})
