/**
 * Fake Stripe client for unit tests.
 * Programmable method stubs mirroring the Stripe SDK surface used by this codebase.
 */

import { vi } from 'vitest'

export interface FakeStripeClient {
  checkout: {
    sessions: {
      create: ReturnType<typeof vi.fn>
    }
  }
  customers: {
    list: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    retrieve: ReturnType<typeof vi.fn>
  }
  subscriptions: {
    retrieve: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    list: ReturnType<typeof vi.fn>
  }
  webhooks: {
    constructEvent: ReturnType<typeof vi.fn>
  }
  reset: () => void
}

export function createFakeStripeClient(): FakeStripeClient {
  const client: FakeStripeClient = {
    checkout: {
      sessions: {
        create: vi.fn(async () => ({
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/test',
          customer_details: null,
        })),
      },
    },
    customers: {
      list: vi.fn(async () => ({ data: [] })),
      create: vi.fn(async (params: { email: string; metadata?: Record<string, string> }) => ({
        id: 'cus_test_123',
        email: params.email,
        metadata: params.metadata || {},
      })),
      retrieve: vi.fn(async (id: string) => ({
        id,
        email: 'customer@example.com',
        deleted: false,
      })),
    },
    subscriptions: {
      retrieve: vi.fn(async (id: string) => ({
        id,
        status: 'active',
        cancel_at_period_end: false,
        metadata: {},
        items: { data: [{ id: 'si_test', price: { id: 'price_test' } }] },
        customer: 'cus_test_123',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      })),
      update: vi.fn(async (id: string, params: Record<string, unknown>) => ({
        id,
        ...params,
        status: 'active',
        items: { data: [{ id: 'si_test', price: { id: 'price_test' } }] },
      })),
      list: vi.fn(async () => ({ data: [] })),
    },
    webhooks: {
      constructEvent: vi.fn((payload: string, _sig: string, _secret: string) => ({
        id: 'evt_test',
        type: 'checkout.session.completed',
        data: { object: typeof payload === 'string' ? JSON.parse(payload || '{}') : {} },
      })),
    },
    reset() {
      vi.clearAllMocks()
    },
  }

  return client
}

/**
 * Creates a vitest-compatible Stripe constructor mock that returns the given fake client.
 */
export function createStripeConstructorMock(fakeClient: FakeStripeClient) {
  const StripeMock = vi.fn(function Stripe() {
    return fakeClient
  })
  return { default: StripeMock, __esModule: true }
}
