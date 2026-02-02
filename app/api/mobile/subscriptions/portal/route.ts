import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createBillingPortalSession, getOrCreateCustomer } from '../../../../../src/lib/stripe'
import { z } from 'zod'

const PortalRequestSchema = z.object({
    returnUrl: z.string().url().optional(),
})

async function validateMobileAppAuth(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization')
        const mobileClient = request.headers.get('X-Mobile-Client')
        const userAgent = request.headers.get('User-Agent')

        console.log('🔐 [Mobile Portal API] Auth Debug:', {
            hasAuthHeader: !!authHeader,
            authHeaderStart: authHeader?.substring(0, 20) + '...',
            headerLength: authHeader?.length,
            mobileClient,
            userAgent
        })

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return {
                error: NextResponse.json(
                    { success: false, error: 'Bearer token required for mobile API' },
                    { status: 401 }
                )
            }
        }

        const token = authHeader.replace('Bearer ', '')

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            }
        )

        const { data: { user }, error: userError } = await supabase.auth.getUser(token)

        if (userError || !user) {
            return {
                error: NextResponse.json(
                    { success: false, error: 'Invalid authentication token' },
                    { status: 401 }
                )
            }
        }

        return { user, supabase }
    } catch (error) {
        console.error('[Mobile Portal API] Auth validation error:', error)
        return {
            error: NextResponse.json(
                { success: false, error: 'Authentication failed' },
                { status: 500 }
            )
        }
    }
}

/**
 * Mobile-specific billing portal endpoint
 */
export async function POST(request: NextRequest) {
    console.log('📱 [Mobile Portal API] Incoming billing portal request')

    const authResult = await validateMobileAppAuth(request)
    if ('error' in authResult) {
        return authResult.error
    }

    const { user } = authResult

    try {
        const requestBody = await request.json()
        const validatedData = PortalRequestSchema.parse(requestBody)
        const returnUrl = validatedData.returnUrl || 'evolutioncombatives://subscription/cancel'

        const customer = await getOrCreateCustomer(user.email!, user.id)

        const session = await createBillingPortalSession({
            customerId: customer.id,
            returnUrl,
        })

        return NextResponse.json({
            success: true,
            data: {
                url: session.url,
                returnUrl,
            }
        })
    } catch (error) {
        console.error('[Mobile Portal API] Error creating portal session:', error)

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid request data',
                    details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
                },
                { status: 400 }
            )
        }

        return NextResponse.json(
            {
                success: false,
                error: 'Failed to create billing portal session',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
