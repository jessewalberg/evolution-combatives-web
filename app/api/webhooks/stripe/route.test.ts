import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNextRequest } from '@/test/helpers/next-request'
import { POST } from './route'
import type Stripe from 'stripe'

vi.mock('@/src/lib/stripe', () => ({
  validateWebhookSignature: vi.fn(),
}))

vi.mock('@/src/lib/supabase', () => ({
  createAdminClient: vi.fn(),
}))

import { validateWebhookSignature } from '@/src/lib/stripe'
import { createAdminClient } from '@/src/lib/supabase'

const mockValidateWebhookSignature = vi.mocked(validateWebhookSignature)
const mockCreateAdminClient = vi.mocked(createAdminClient)

function makeEvent(type: string, object: Record<string, unknown>) {
  return {
    id: 'evt_1',
    type,
    data: { object },
  } as unknown as Stripe.Event
}

function buildSupabase() {
  const insert = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  })
  const selectSingle = vi.fn().mockResolvedValue({
    data: { user_id: 'user-1' },
    error: null,
  })

  return {
    from: vi.fn(() => ({
      insert,
      update,
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: selectSingle }),
      }),
    })),
  }
}

function webhookRequest(body: string, signature?: string) {
  return createNextRequest('/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: signature ? { 'stripe-signature': signature } : {},
  })
}

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateAdminClient.mockReturnValue(buildSupabase() as never)
  })

  it('returns 400 when signature header is missing', async () => {
    const res = await POST(webhookRequest('{}'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Missing signature')
    expect(mockValidateWebhookSignature).not.toHaveBeenCalled()
  })

  it('returns 400 when signature validation fails', async () => {
    mockValidateWebhookSignature.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const res = await POST(webhookRequest('{}', 'bad-sig'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Webhook handler failed')
  })

  it('handles checkout.session.completed', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('checkout.session.completed', {
        id: 'cs_1',
        metadata: { userId: 'user-1', tier: 'tier1' },
      })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ received: true })
  })

  it('handles customer.subscription.created', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('customer.subscription.created', {
        id: 'sub_1',
        status: 'active',
        customer: 'cus_1',
        metadata: { userId: 'user-1', tier: 'tier1' },
        current_period_start: 1700000000,
        current_period_end: 1702592000,
        cancel_at_period_end: false,
        canceled_at: null,
      })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)
    expect(mockCreateAdminClient).toHaveBeenCalled()
  })

  it('handles customer.subscription.updated', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('customer.subscription.updated', {
        id: 'sub_1',
        status: 'canceled',
        current_period_start: 1700000000,
        current_period_end: 1702592000,
        cancel_at_period_end: true,
        canceled_at: 1701000000,
      })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)
  })

  it('handles customer.subscription.deleted', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('customer.subscription.deleted', { id: 'sub_1' })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)
  })

  it('handles invoice.payment_succeeded', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('invoice.payment_succeeded', { subscription: 'sub_1' })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)
  })

  it('handles invoice.payment_failed', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('invoice.payment_failed', { subscription: 'sub_1' })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)
  })

  it('returns 200 for unhandled event types', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('customer.created', { id: 'cus_new' })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ received: true })
  })

  it('skips checkout.session.completed when metadata missing', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('checkout.session.completed', { id: 'cs_2', metadata: {} })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)
  })

  it('skips subscription.created when metadata missing', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('customer.subscription.created', {
        id: 'sub_2',
        status: 'active',
        customer: 'cus_1',
        metadata: {},
        current_period_start: 1700000000,
        current_period_end: 1702592000,
        cancel_at_period_end: false,
        canceled_at: null,
      })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)
  })

  it('returns 400 when subscription insert fails', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('customer.subscription.created', {
        id: 'sub_fail',
        status: 'active',
        customer: 'cus_1',
        metadata: { userId: 'user-1', tier: 'tier1' },
        current_period_start: 1700000000,
        current_period_end: 1702592000,
        cancel_at_period_end: false,
        canceled_at: null,
      })
    )
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue({ error: { message: 'dup' } }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { user_id: 'user-1' }, error: null }),
          }),
        }),
      })),
    } as never)

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Webhook handler failed')
  })

  it('handles subscription.updated without cancel path', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('customer.subscription.updated', {
        id: 'sub_1',
        status: 'active',
        current_period_start: 1700000000,
        current_period_end: 1702592000,
        cancel_at_period_end: false,
        canceled_at: null,
      })
    )

    const res = await POST(webhookRequest('{}', 'sig'))
    expect(res.status).toBe(200)
  })

  it('handles invoice events without subscription', async () => {
    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('invoice.payment_succeeded', { subscription: null })
    )
    const res1 = await POST(webhookRequest('{}', 'sig'))
    expect(res1.status).toBe(200)

    mockValidateWebhookSignature.mockReturnValue(
      makeEvent('invoice.payment_failed', { subscription: null })
    )
    const res2 = await POST(webhookRequest('{}', 'sig'))
    expect(res2.status).toBe(200)
  })
})

describe('GET /api/webhooks/stripe', () => {
  it('returns health check', async () => {
    const { GET } = await import('./route')
    const res = await GET()
    const body = await res.json()

    expect(body.status).toBe('ok')
    expect(body.service).toBe('stripe-webhooks')
  })
})
