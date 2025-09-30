import { NextRequest, NextResponse } from 'next/server'
import { contentMutations } from '../../../../../src/services/content'
import { validateApiAuthWithSession } from '../../../../../src/lib/api-auth'

export async function POST(request: NextRequest) {
    const authResult = await validateApiAuthWithSession('content.write')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        const body = await request.json()

        // Validate request body
        if (!body.targetId || !Array.isArray(body.sourceIds)) {
            return NextResponse.json(
                { success: false, error: 'targetId and sourceIds are required' },
                { status: 400 }
            )
        }

        if (body.sourceIds.length === 0) {
            return NextResponse.json(
                { success: false, error: 'At least one source category is required' },
                { status: 400 }
            )
        }

        // Check if target is not in source list
        if (body.sourceIds.includes(body.targetId)) {
            return NextResponse.json(
                { success: false, error: 'Target category cannot be in source list' },
                { status: 400 }
            )
        }

        await contentMutations.mergeCategories(body.targetId, body.sourceIds)
        return NextResponse.json({
            success: true,
            message: 'Categories merged successfully'
        })
    } catch (error) {
        console.error('Merge categories error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to merge categories'
            },
            { status: 500 }
        )
    }
}
