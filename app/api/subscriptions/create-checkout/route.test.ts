import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { GET, POST } from './route'

vi.mock('@/src/lib/stripe', () => ({
    createCheckoutSession: vi.fn(),
    getOrCreateCustomer: vi.fn(),
}))

vi.mock('@/src/lib/supabase', () => ({
    createServerClient: vi.fn(),
}))

import { createCheckoutSession, getOrCreateCustomer } from '@/src/lib/stripe'
import { createServerClient } from '@/src/lib/supabase'

const mockCreateCheckoutSession = vi.mocked(createCheckoutSession)
const mockGetOrCreateCustomer = vi.mocked(getOrCreateCustomer)
const mockCreateServerClient = vi.mocked(createServerClient)

const authenticatedUser = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'verified@example.com',
}

function buildSupabase(options: {
    user?: typeof authenticatedUser | null
    authError?: unknown
    existingSubscription?: { id: string; status: string; tier: string } | null
    subscriptionError?: unknown
} = {}) {
    const maybeSingle = vi.fn().mockResolvedValue({
        data: options.existingSubscription || null,
        error: options.subscriptionError || null,
    })

    return {
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: {
                    user:
                        options.user === undefined
                            ? authenticatedUser
                            : options.user,
                },
                error: options.authError || null,
            }),
        },
        from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    in: vi.fn().mockReturnValue({
                        limit: vi.fn().mockReturnValue({ maybeSingle }),
                    }),
                }),
            }),
        }),
    }
}

const post = (body: unknown) =>
    POST(
        createNextRequest('/api/subscriptions/create-checkout', {
            method: 'POST',
            body: JSON.stringify(body),
        })
    )

describe('GET /api/subscriptions/create-checkout', () => {
    it('returns a health response', async () => {
        const response = await GET()
        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({ status: 'ok' })
    })
})

describe('POST /api/subscriptions/create-checkout', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.NEXT_PUBLIC_APP_URL = 'https://www.evolutioncombatives.com'
        mockCreateServerClient.mockResolvedValue(buildSupabase() as never)
        mockGetOrCreateCustomer.mockResolvedValue({ id: 'cus_verified' } as never)
        mockCreateCheckoutSession.mockResolvedValue({
            id: 'cs_123',
            url: 'https://checkout.stripe.com/c/pay/cs_123',
        } as never)
    })

    it('accepts paid tiers only', async () => {
        const response = await post({ tier: 'none' })
        expect(response.status).toBe(400)
        expect(mockCreateServerClient).not.toHaveBeenCalled()
    })

    it('strictly rejects caller-provided ownership fields', async () => {
        const response = await post({
            tier: 'tier1',
            userId: '22222222-2222-4222-8222-222222222222',
            userEmail: 'attacker@example.com',
        })
        expect(response.status).toBe(400)
        expect(mockCreateServerClient).not.toHaveBeenCalled()
    })

    it('requires a verified Supabase user', async () => {
        mockCreateServerClient.mockResolvedValue(
            buildSupabase({ user: null }) as never
        )
        const response = await post({ tier: 'tier1' })
        expect(response.status).toBe(401)
        expect(mockGetOrCreateCustomer).not.toHaveBeenCalled()
    })

    it('blocks duplicate active subscriptions', async () => {
        mockCreateServerClient.mockResolvedValue(
            buildSupabase({
                existingSubscription: {
                    id: 'sub_123',
                    status: 'active',
                    tier: 'tier1',
                },
            }) as never
        )
        const response = await post({ tier: 'tier2' })
        expect(response.status).toBe(409)
        await expect(response.json()).resolves.toMatchObject({
            currentTier: 'tier1',
        })
    })

    it('uses only the authenticated identity when creating checkout', async () => {
        const response = await post({ tier: 'tier2' })
        expect(response.status).toBe(200)
        expect(mockGetOrCreateCustomer).toHaveBeenCalledWith(
            authenticatedUser.email,
            authenticatedUser.id
        )
        expect(mockCreateCheckoutSession).toHaveBeenCalledWith({
            priceId: 'price_test_tier2',
            customerId: 'cus_verified',
            userId: authenticatedUser.id,
            tier: 'tier2',
            successUrl:
                'https://www.evolutioncombatives.com/subscription-success?session_id={CHECKOUT_SESSION_ID}&tier=tier2',
            cancelUrl:
                'https://www.evolutioncombatives.com/subscription-cancel',
        })
    })

    it('fails closed when subscription state cannot be verified', async () => {
        mockCreateServerClient.mockResolvedValue(
            buildSupabase({ subscriptionError: new Error('database offline') }) as never
        )
        const response = await post({ tier: 'tier1' })
        expect(response.status).toBe(500)
        expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
    })
})
