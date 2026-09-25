const DEFAULT_MOBILE_SCHEME = 'evolutioncombatives'
const BUILT_IN_MOBILE_SCHEMES = new Set([
    DEFAULT_MOBILE_SCHEME,
    'evolutioncombatives-dev',
    'evolutioncombatives-staging',
    'evolutioncombatives-preview',
    'evolutioncombatives-testflight',
])
const PRODUCTION_WEB_HOSTS = new Set([
    'evolutioncombatives.com',
    'www.evolutioncombatives.com',
    'testing.evolutioncombatives.com',
])

function configuredMobileScheme(): string {
    return (process.env.NEXT_PUBLIC_MOBILE_APP_SCHEME || DEFAULT_MOBILE_SCHEME)
        .replace(/:\/\/$/, '')
        .replace(/:$/, '')
}

function configuredMobileSchemes(): Set<string> {
    const schemes = new Set(BUILT_IN_MOBILE_SCHEMES)
    schemes.add(configuredMobileScheme())

    for (const value of (process.env.MOBILE_APP_SCHEMES || '').split(',')) {
        const scheme = value.trim().replace(/:\/\/$/, '').replace(/:$/, '')
        if (scheme) schemes.add(scheme)
    }

    return schemes
}

function configuredWebHosts(): Set<string> {
    const hosts = new Set(PRODUCTION_WEB_HOSTS)

    for (const value of [
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.NEXT_PUBLIC_ADMIN_URL,
    ]) {
        if (!value) continue

        try {
            hosts.add(new URL(value).hostname)
        } catch {
            // Invalid deployment configuration must not expand the allowlist.
        }
    }

    return hosts
}

/** Restrict Stripe redirects to the app deep link or owned web origins. */
export function isAllowedMobileRedirect(value: string): boolean {
    try {
        const url = new URL(value)
        if (configuredMobileSchemes().has(url.protocol.replace(/:$/, ''))) {
            return true
        }

        if (url.protocol === 'https:' && configuredWebHosts().has(url.hostname)) {
            return true
        }

        return (
            process.env.NODE_ENV !== 'production' &&
            url.protocol === 'http:' &&
            (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
        )
    } catch {
        return false
    }
}

export function mobileDeepLink(path: string): string {
    return `${configuredMobileScheme()}://${path.replace(/^\/+/, '')}`
}
