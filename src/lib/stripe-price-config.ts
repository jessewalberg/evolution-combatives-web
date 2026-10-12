/**
 * Live Stripe price ids. Production wrangler vars ship as named placeholders.
 * Requests to the production hostnames fail until Jesse replaces them.
 */

export const STRIPE_PRICE_ENV = {
    tier1: 'STRIPE_BEGINNER_PRICE_ID',
    tier2: 'STRIPE_INTERMEDIATE_PRICE_ID',
    tier3: 'STRIPE_ADVANCED_PRICE_ID',
} as const

export type PaidSubscriptionTier = keyof typeof STRIPE_PRICE_ENV

const PRICE_ENV_NAMES = Object.values(STRIPE_PRICE_ENV)

const PRODUCTION_HOSTS = new Set([
    'evolutioncombatives.com',
    'www.evolutioncombatives.com',
])

export function stripePriceConfigProblem(name: string, value: string | undefined): string | null {
    if (value == null || value.trim() === '') {
        return `${name} is unset`
    }
    const trimmed = value.trim()
    if (trimmed === 'update' || trimmed.startsWith('PLACEHOLDER_')) {
        return `${name} is still a placeholder`
    }
    return null
}

export function assertStripePriceIdsConfigured(hostname?: string): void {
    const problems = PRICE_ENV_NAMES
        .map((name) => stripePriceConfigProblem(name, process.env[name]))
        .filter((problem): problem is string => problem != null)

    const host = hostname?.toLowerCase()
    const productionHost = host != null && PRODUCTION_HOSTS.has(host)
    // Unset fails everywhere. Placeholders fail on the production hostnames,
    // and when no host is given, so a deploy cannot serve the site until
    // Jesse replaces them. Local and preview hosts keep booting.
    const blocking = host == null || productionHost
        ? problems
        : problems.filter((problem) => problem.endsWith('is unset'))

    if (blocking.length > 0) {
        throw new Error(
            `Stripe price configuration is invalid: ${blocking.join('; ')}. Replace the placeholders before the Worker serves traffic.`,
        )
    }
}

export function readRequiredStripePriceId(name: (typeof PRICE_ENV_NAMES)[number]): string {
    const problem = stripePriceConfigProblem(name, process.env[name])
    if (problem) {
        throw new Error(`${problem}. Set this Worker config var before serving traffic.`)
    }
    return process.env[name]!.trim()
}

/** Map a Stripe price id to a tier only when the configured value is a real price id. */
export function tierForConfiguredPriceId(priceId: string | null | undefined): PaidSubscriptionTier | null {
    if (!priceId) return null
    for (const [tier, name] of Object.entries(STRIPE_PRICE_ENV) as Array<[PaidSubscriptionTier, (typeof PRICE_ENV_NAMES)[number]]>) {
        const configured = process.env[name]
        if (configured && stripePriceConfigProblem(name, configured) == null && configured.trim() === priceId) {
            return tier
        }
    }
    return null
}
