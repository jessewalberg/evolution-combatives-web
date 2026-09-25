import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateMobileBearer } from '../../../../../src/lib/mobile-auth'
import {
    isAllowedMobileRedirect,
    mobileDeepLink,
} from '../../../../../src/lib/mobile-redirects'
import { stripe } from '../../../../../src/lib/stripe'

const PortalRequestSchema = z
    .object({
        returnUrl: z
            .string()
            .refine(isAllowedMobileRedirect, 'Untrusted return URL')
            .optional(),
    })
    .strict()

const errorResponse = (status: number, error: string) =>
    NextResponse.json({ success: false, error }, { status })

/** Create a customer portal session for a Stripe customer owned by the caller. */
export async function POST(request: NextRequest) {
    const authResult = await authenticateMobileBearer(request)
    if ('error' in authResult) return authResult.error

    let requestData: z.infer<typeof PortalRequestSchema>
    try {
        requestData = PortalRequestSchema.parse(await request.json())
    } catch (error) {
        if (error instanceof z.ZodError) {
            return errorResponse(400, 'Invalid request data')
        }
        return errorResponse(400, 'Invalid JSON body')
    }

    const { user, supabase } = authResult.data
    const { data: billingRecord, error: billingError } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id, created_at')
        .eq('user_id', user.id)
        .eq('platform', 'stripe')
        .not('stripe_customer_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (billingError) {
        return errorResponse(500, 'Unable to verify billing account')
    }

    if (!billingRecord?.stripe_customer_id) {
        return errorResponse(404, 'No Stripe billing account was found')
    }

    try {
        const session = await stripe.billingPortal.sessions.create({
            customer: billingRecord.stripe_customer_id,
            return_url:
                requestData.returnUrl || mobileDeepLink('subscription/cancel'),
        })

        return NextResponse.json({
            success: true,
            data: {
                sessionId: session.id,
                url: session.url,
            },
        })
    } catch {
        return errorResponse(502, 'Billing portal is temporarily unavailable')
    }
}
