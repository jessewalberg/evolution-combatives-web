import { describe, it, expect, vi, beforeEach } from 'vitest'

const fakeStripe = {
  checkout: {
    sessions: {
      create: vi.fn(),
    },
  },
  customers: {
    list: vi.fn(),
    create: vi.fn(),
  },
  subscriptions: {
    retrieve: vi.fn(),
    update: vi.fn(),
  },
  webhooks: {
    constructEventAsync: vi.fn(),
  },
}

vi.mock('stripe', () => ({
  default: vi.fn(function Stripe() {
    return fakeStripe
  }),
}))

describe('stripe helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_vitest'
  })

  it('validateWebhookSignature returns event or wraps errors', async () => {
    const { validateWebhookSignature } = await import('@/src/lib/stripe')
    const event = { id: 'evt_1', type: 'checkout.session.completed' }
    fakeStripe.webhooks.constructEventAsync.mockResolvedValue(event)
    await expect(validateWebhookSignature('{}', 'sig', 'secret')).resolves.toEqual(event)

    fakeStripe.webhooks.constructEventAsync.mockImplementation(() => {
      throw new Error('bad sig')
    })
    await expect(validateWebhookSignature('{}', 'sig', 'secret')).rejects.toThrow(
      /Webhook signature verification failed: bad sig/
    )
  })

  it('createCheckoutSession uses existing customer when provided', async () => {
    const { createCheckoutSession } = await import('@/src/lib/stripe')
    fakeStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://pay' })

    await createCheckoutSession({
      priceId: 'price_1',
      customerId: 'cus_1',
      userId: 'u1',
      tier: 'tier1',
      successUrl: 'https://ok',
      cancelUrl: 'https://cancel',
      idempotencyKey: 'attempt-1',
    })

    expect(fakeStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer: 'cus_1',
        metadata: { userId: 'u1', tier: 'tier1', checkoutAttemptId: 'attempt-1' },
        line_items: [{ price: 'price_1', quantity: 1 }],
      }),
      { idempotencyKey: 'attempt-1' },
    )
    expect(fakeStripe.checkout.sessions.create.mock.calls[0][0].customer_creation).toBeUndefined()
  })

  it('createCheckoutSession sets customer_creation when no customerId', async () => {
    const { createCheckoutSession } = await import('@/src/lib/stripe')
    fakeStripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_2' })

    await createCheckoutSession({
      priceId: 'price_1',
      userId: 'u1',
      tier: 'tier2',
      successUrl: 'https://ok',
      cancelUrl: 'https://cancel',
    })

    expect(fakeStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer_creation: 'always' }),
      undefined,
    )
  })

  it('getOrCreateCustomer returns existing or creates new', async () => {
    const { getOrCreateCustomer } = await import('@/src/lib/stripe')
    fakeStripe.customers.list.mockResolvedValue({
      data: [{ id: 'cus_existing', email: 'a@b.com', metadata: { userId: 'u1' } }],
    })
    expect(await getOrCreateCustomer('a@b.com', 'u1')).toEqual({
      id: 'cus_existing',
      email: 'a@b.com',
      metadata: { userId: 'u1' },
    })

    fakeStripe.customers.list.mockResolvedValue({ data: [] })
    fakeStripe.customers.create.mockResolvedValue({ id: 'cus_new', email: 'a@b.com' })
    expect(await getOrCreateCustomer('a@b.com', 'u1')).toEqual({
      id: 'cus_new',
      email: 'a@b.com',
    })
  })

  it('getOrCreateCustomer never reuses a Stripe customer owned by a different user id (email reassignment)', async () => {
    const { getOrCreateCustomer } = await import('@/src/lib/stripe')
    // The email now belongs to 'u2', but Stripe still has a customer record
    // for the previous owner ('u1') under that same email.
    fakeStripe.customers.list.mockResolvedValue({
      data: [{ id: 'cus_old_owner', email: 'reused@b.com', metadata: { userId: 'u1' } }],
    })
    fakeStripe.customers.create.mockResolvedValue({
      id: 'cus_u2',
      email: 'reused@b.com',
      metadata: { userId: 'u2' },
    })

    const result = await getOrCreateCustomer('reused@b.com', 'u2')

    expect(result.id).toBe('cus_u2')
    expect(fakeStripe.customers.create).toHaveBeenCalledWith({
      email: 'reused@b.com',
      metadata: { userId: 'u2' },
    })
  })

  it('getSubscription retrieves by id', async () => {
    const { getSubscription } = await import('@/src/lib/stripe')
    fakeStripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_1' })
    expect(await getSubscription('sub_1')).toEqual({ id: 'sub_1' })
  })

  it('cancel and reactivate subscription toggle cancel_at_period_end', async () => {
    const { cancelSubscription, reactivateSubscription } = await import('@/src/lib/stripe')
    fakeStripe.subscriptions.update.mockResolvedValue({ id: 'sub_1', cancel_at_period_end: true })
    expect(await cancelSubscription('sub_1')).toEqual({ id: 'sub_1', cancel_at_period_end: true })
    expect(fakeStripe.subscriptions.update).toHaveBeenCalledWith('sub_1', {
      cancel_at_period_end: true,
    })

    fakeStripe.subscriptions.update.mockResolvedValue({ id: 'sub_1', cancel_at_period_end: false })
    await reactivateSubscription('sub_1')
    expect(fakeStripe.subscriptions.update).toHaveBeenCalledWith('sub_1', {
      cancel_at_period_end: false,
    })
  })

  it('updateSubscription swaps price and metadata', async () => {
    const { updateSubscription } = await import('@/src/lib/stripe')
    fakeStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_1',
      metadata: { userId: 'u1' },
      items: { data: [{ id: 'si_1' }] },
    })
    fakeStripe.subscriptions.update.mockResolvedValue({ id: 'sub_1' })

    await updateSubscription('sub_1', 'price_new', 'tier3')
    expect(fakeStripe.subscriptions.update).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({
        items: [{ id: 'si_1', price: 'price_new' }],
        metadata: { userId: 'u1', tier: 'tier3' },
        proration_behavior: 'create_prorations',
      })
    )
  })
})
