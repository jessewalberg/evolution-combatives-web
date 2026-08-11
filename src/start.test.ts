/**
 * Unit tests for the request-middleware route rules in src/start.ts —
 * successor to the deleted Next.js middleware.test.ts. The full chain
 * (headers, CSRF, redirects) is exercised end-to-end by the Playwright
 * suites; these cover the pure route logic.
 */
import { describe, it, expect } from 'vitest'
import { hasRouteAccess, isPublicRoute, replaceHtmlApiFallback } from './start'

describe('isPublicRoute', () => {
    it('allows the public pages and endpoints', () => {
        for (const path of [
            '/',
            '/login',
            '/sign-up',
            '/forgot-password',
            '/reset-password',
            '/auth/confirm',
            '/subscribe',
            '/subscription-success',
            '/health',
            '/favicon.ico',
        ]) {
            expect(isPublicRoute(path), path).toBe(true)
        }
    })

    it('matches wildcard prefixes', () => {
        expect(isPublicRoute('/.well-known/apple-app-site-association')).toBe(true)
        expect(isPublicRoute('/assets/app-abc123.css')).toBe(true)
        expect(isPublicRoute('/ingest/e')).toBe(true)
    })

    it('does not treat admin pages as public', () => {
        for (const path of ['/dashboard', '/users', '/users/42', '/analytics', '/qa', '/qa/9']) {
            expect(isPublicRoute(path), path).toBe(false)
        }
    })

    it('does not match lookalike prefixes of exact routes', () => {
        expect(isPublicRoute('/login-help')).toBe(false)
        expect(isPublicRoute('/subscribers')).toBe(false)
    })
})

describe('hasRouteAccess', () => {
    it('grants super_admin every route', () => {
        for (const path of ['/dashboard', '/users', '/analytics', '/qa', '/anything-else']) {
            expect(hasRouteAccess(path, 'super_admin'), path).toBe(true)
        }
    })

    it('scopes content_admin to dashboard and analytics', () => {
        expect(hasRouteAccess('/dashboard', 'content_admin')).toBe(true)
        expect(hasRouteAccess('/dashboard/content/videos', 'content_admin')).toBe(true)
        expect(hasRouteAccess('/analytics', 'content_admin')).toBe(true)
        expect(hasRouteAccess('/users', 'content_admin')).toBe(false)
        expect(hasRouteAccess('/qa', 'content_admin')).toBe(false)
    })

    it('scopes support_admin to dashboard, users, and qa', () => {
        expect(hasRouteAccess('/dashboard', 'support_admin')).toBe(true)
        expect(hasRouteAccess('/users/42', 'support_admin')).toBe(true)
        expect(hasRouteAccess('/qa/9', 'support_admin')).toBe(true)
        expect(hasRouteAccess('/analytics', 'support_admin')).toBe(false)
    })

    it('prefix matching requires a path boundary', () => {
        expect(hasRouteAccess('/usersomething', 'support_admin')).toBe(false)
    })
})

describe('replaceHtmlApiFallback', () => {
    it('replaces a bare HTML Response with JSON 405', async () => {
        const html = new Response('<html></html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
        const result = replaceHtmlApiFallback(html)
        expect(result).toBeInstanceOf(Response)
        const response = result as Response
        expect(response.status).toBe(405)
        expect(await response.json()).toEqual({
            success: false,
            error: 'Method not allowed',
        })
    })

    it('replaces { response } HTML shape and preserves sibling fields', async () => {
        const html = new Response('<html></html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
        })
        const result = replaceHtmlApiFallback({ response: html, ctx: 'keep' }) as {
            response: Response
            ctx: string
        }
        expect(result.ctx).toBe('keep')
        expect(result.response.status).toBe(405)
        expect(await result.response.json()).toEqual({
            success: false,
            error: 'Method not allowed',
        })
    })

    it('leaves JSON API responses untouched', () => {
        const api = new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })
        expect(replaceHtmlApiFallback(api)).toBe(api)
        expect(replaceHtmlApiFallback({ response: api })).toEqual({ response: api })
    })
})
