import { json } from '@/src/lib/http'
import { contentMutations } from '@/src/services/content'
import { validateApiAuthWithSession } from '@/src/lib/api-auth'

export async function POST({ request }: { request: Request }) {
    const authResult = await validateApiAuthWithSession('content.write')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        const body = await request.json()

        // Validate request body
        if (!Array.isArray(body.reorderData)) {
            return json(
                { success: false, error: 'reorderData must be an array' },
                { status: 400 }
            )
        }

        // Validate each item in reorderData
        for (const item of body.reorderData) {
            if (!item.id || typeof item.sort_order !== 'number') {
                return json(
                    { success: false, error: 'Each item must have id and sort_order' },
                    { status: 400 }
                )
            }
        }

        await contentMutations.reorderContent('categories', body.reorderData)
        return json({
            success: true,
            message: 'Categories reordered successfully'
        })
    } catch (error) {
        console.error('Reorder categories error:', error)
        return json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to reorder categories'
            },
            { status: 500 }
        )
    }
}
