import { createAdminClient } from '@/src/lib/supabase'

export async function recordStripeCustomer(customerId: string, userId: string): Promise<void> {
    const { data, error } = await createAdminClient().rpc('record_stripe_customer', {
        p_customer_id: customerId,
        p_user_id: userId,
    })
    if (error) throw error

    const result = typeof data === 'string' ? JSON.parse(data) : data
    if (result?.result === 'conflict') throw new Error('Stripe customer ownership conflict')
    if (result?.result !== 'recorded') throw new Error('Unexpected Stripe customer record result')
}
