import { createFileRoute } from '@tanstack/react-router'

const POSTHOG_ORIGIN = 'https://us.i.posthog.com'
const POSTHOG_ASSETS_ORIGIN = 'https://us-assets.i.posthog.com'

const HOP_BY_HOP_HEADERS = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
])

function isPathUnsafe(path: string): boolean {
    if (path.startsWith('//') || path.startsWith('/\\')) return true
    if (path.includes('\\')) return true
    const decoded = decodeURIComponent(path)
    if (decoded.startsWith('//') || decoded.startsWith('/\\')) return true
    if (decoded.includes('\\')) return true
    return false
}

function stripHopByHopHeaders(headers: Headers): Headers {
    const result = new Headers()
    for (const [key, value] of headers.entries()) {
        if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
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

    if (isPathUnsafe(path)) {
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

    const outboundHeaders = stripHopByHopHeaders(request.headers)
    outboundHeaders.set('host', targetUrl.hostname)
    outboundHeaders.delete('cookie')

    const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: outboundHeaders,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
        redirect: 'manual',
    })

    const responseHeaders = stripHopByHopHeaders(response.headers)
    responseHeaders.delete('set-cookie')

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
