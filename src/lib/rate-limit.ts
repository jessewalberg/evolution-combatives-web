/**
 * Evolution Combatives - Rate limiting
 *
 * Backed by Cloudflare Workers rate-limiting bindings (configured in
 * wrangler.jsonc `unsafe.bindings`), which count across isolates within a
 * colo. Outside the Workers runtime (vitest, plain node) an in-memory
 * fallback keeps the same semantics per process.
 *
 * The binding only supports 10s/60s periods, so the legacy per-15-minute
 * windows are expressed as per-minute equivalents:
 *   api   1000/15min → 100/60s
 *   admin  500/5min  → 100/60s
 *   auth   100/15min →  10/60s
 */

export type RateLimitKind = 'api' | 'admin' | 'auth'

const BINDING_NAMES: Record<RateLimitKind, string> = {
    api: 'API_RATE_LIMITER',
    admin: 'ADMIN_RATE_LIMITER',
    auth: 'AUTH_RATE_LIMITER',
}

const FALLBACK_LIMITS: Record<RateLimitKind, { windowMs: number; maxRequests: number }> = {
    api: { windowMs: 60_000, maxRequests: 100 },
    admin: { windowMs: 60_000, maxRequests: 100 },
    auth: { windowMs: 60_000, maxRequests: 10 },
}

interface RateLimiterBinding {
    limit(options: { key: string }): Promise<{ success: boolean }>
}

const fallbackStore = new Map<string, { count: number; resetTime: number }>()

function checkFallbackLimit(kind: RateLimitKind, key: string): boolean {
    const config = FALLBACK_LIMITS[kind]
    const now = Date.now()
    const storeKey = `${kind}:${key}`
    const window = fallbackStore.get(storeKey)

    // Opportunistically clean expired entries
    if (fallbackStore.size > 1000) {
        for (const [k, v] of fallbackStore.entries()) {
            if (now > v.resetTime) fallbackStore.delete(k)
        }
    }

    if (!window || now > window.resetTime) {
        fallbackStore.set(storeKey, { count: 1, resetTime: now + config.windowMs })
        return true
    }

    if (window.count >= config.maxRequests) {
        return false
    }

    window.count++
    return true
}

async function getBinding(kind: RateLimitKind): Promise<RateLimiterBinding | undefined> {
    try {
        const { env } = await import(/* @vite-ignore */ 'cloudflare:workers')
        return (env as Record<string, unknown>)[BINDING_NAMES[kind]] as RateLimiterBinding | undefined
    } catch {
        return undefined
    }
}

/**
 * Returns true when the request is allowed, false when rate limited.
 */
export async function checkRateLimit(kind: RateLimitKind, key: string): Promise<boolean> {
    const binding = await getBinding(kind)

    if (binding) {
        const { success } = await binding.limit({ key })
        return success
    }

    return checkFallbackLimit(kind, key)
}

export function rateLimitResponse(): Response {
    return new Response(
        JSON.stringify({
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.',
        }),
        {
            status: 429,
            headers: {
                'Content-Type': 'application/json',
                'Retry-After': '60',
            },
        },
    )
}

/**
 * Get client IP address for rate limiting
 */
export function getClientIP(request: Request): string {
    const cfConnectingIP = request.headers.get('cf-connecting-ip')
    if (cfConnectingIP) return cfConnectingIP

    const forwarded = request.headers.get('x-forwarded-for')
    if (forwarded) return forwarded.split(',')[0].trim()

    const realIP = request.headers.get('x-real-ip')
    if (realIP) return realIP

    return 'unknown'
}
