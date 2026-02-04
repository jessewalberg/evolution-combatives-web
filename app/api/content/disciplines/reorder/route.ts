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

        if (!Array.isArray(body.reorderData)) {
            return NextResponse.json(
                { success: false, error: 'reorderData must be an array' },
                { status: 400 }
            )
        }

        for (const item of body.reorderData) {
            if (!item?.id || typeof item.sort_order !== 'number') {
                return NextResponse.json(
                    { success: false, error: 'Each item must include id and sort_order' },
                    { status: 400 }
                )
            }
        }

        await contentMutations.reorderContent('disciplines', body.reorderData)
        return NextResponse.json({ success: true, message: 'Disciplines reordered successfully' })
    } catch (error) {
        console.error('Reorder disciplines error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to reorder disciplines'
            },
            { status: 500 }
        )
    }
}
