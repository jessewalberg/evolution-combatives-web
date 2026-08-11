import { createFileRoute } from '@tanstack/react-router'

/**
 * PostHog reverse proxy (replaces the next.config.ts rewrites):
 *   /ingest/static/*  → https://us-assets.i.posthog.com/static/*
 *   /ingest/*         → https://us.i.posthog.com/*
 */
async function proxyToPostHog(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/ingest/, '')

    const targetOrigin = path.startsWith('/static/')
        ? 'https://us-assets.i.posthog.com'
        : process.env.POSTHOG_HOST || 'https://us.i.posthog.com'

    const targetUrl = new URL(path + url.search, targetOrigin)

    const headers = new Headers(request.headers)
    headers.set('host', targetUrl.hostname)
    headers.delete('cookie')

    const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
        redirect: 'follow',
    })

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
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
