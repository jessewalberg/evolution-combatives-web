import { createFileRoute } from '@tanstack/react-router'

const POSTHOG_ORIGIN = 'https://us.i.posthog.com'
const POSTHOG_ASSETS_ORIGIN = 'https://us-assets.i.posthog.com'

const ALLOWED_REQUEST_HEADERS = new Set([
    'content-type',
    'content-encoding',
    'content-length',
    'accept',
    'accept-encoding',
    'accept-language',
    'user-agent',
    'origin',
    'referer',
])

const ALLOWED_RESPONSE_HEADERS = new Set([
    'content-type',
    'content-encoding',
    'cache-control',
    'vary',
])

function isAllowedAnalyticsPath(path: string): boolean {
    if (path.startsWith('//') || path.startsWith('/\\')) return false
    if (path.includes('\\')) return false
    let decoded: string
    try {
        decoded = decodeURIComponent(path)
    } catch {
        return false
    }
    if (decoded.startsWith('//') || decoded.startsWith('/\\')) return false
    if (decoded.includes('\\')) return false
    return true
}

function filterAllowedHeaders(headers: Headers, allowedSet: Set<string>): Headers {
    const result = new Headers()
    for (const [key, value] of headers.entries()) {
        if (allowedSet.has(key.toLowerCase())) {
            result.set(key, value)
        }
    }
    return result
}

/**
 * PostHog reverse proxy (replaces the next.config.ts rewrites):
 *   /ingest/static/*  → https://us-assets.i.posthog.com/static/*
 *   /ingest/*         → https://us.i.posthog.com/*
 */
async function proxyToPostHog(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/ingest/, '')

    if (!isAllowedAnalyticsPath(path)) {
        return new Response(JSON.stringify({ error: 'Invalid path' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const fixedOrigin = path.startsWith('/static/')
        ? POSTHOG_ASSETS_ORIGIN
        : POSTHOG_ORIGIN

    const targetUrl = new URL(fixedOrigin)
    targetUrl.pathname = path
    targetUrl.search = url.search

    if (targetUrl.origin !== fixedOrigin) {
        return new Response(JSON.stringify({ error: 'Invalid path' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const outboundHeaders = filterAllowedHeaders(request.headers, ALLOWED_REQUEST_HEADERS)
    outboundHeaders.set('host', targetUrl.hostname)

    const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: outboundHeaders,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
        redirect: 'manual',
    })

    const responseHeaders = filterAllowedHeaders(response.headers, ALLOWED_RESPONSE_HEADERS)

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
    })
}

export const Route = createFileRoute('/ingest/$')({
    server: {
        handlers: {
            GET: ({ request }) => proxyToPostHog(request),
            POST: ({ request }) => proxyToPostHog(request),
            OPTIONS: ({ request }) => proxyToPostHog(request),
        },
    },
})
