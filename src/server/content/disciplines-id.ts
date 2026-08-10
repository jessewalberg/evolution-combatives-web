import { contentQueries, contentMutations } from '@/src/services/content'
import { validateApiAuthWithSession } from '@/src/lib/api-auth'
import { json } from '@/src/lib/http'
import type { DisciplineUpdate } from '@/src/lib/shared/types/database'

export async function GET({ params }: { request: Request; params: { id: string } }) {
    const authResult = await validateApiAuthWithSession('content.read')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        const { id } = params
        // Fetch single discipline with relations
        const disciplines = await contentQueries.fetchDisciplines(true)
        const discipline = disciplines.find(d => d.id === id)

        if (!discipline) {
            return json(
                { success: false, error: 'Discipline not found' },
                { status: 404 }
            )
        }

        return json({ success: true, data: discipline })
    } catch (error) {
        console.error('Get discipline error:', error)
        return json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch discipline'
            },
            { status: 500 }
        )
    }
}

export async function PUT({ request, params }: { request: Request; params: { id: string } }) {
    const authResult = await validateApiAuthWithSession('content.write')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        const { id } = params
        const body = await request.json()

        // Prepare update data (only include provided fields)
        const updateData: DisciplineUpdate = {}

        if (body.name !== undefined) updateData.name = body.name
        if (body.slug !== undefined) updateData.slug = body.slug
        if (body.description !== undefined) updateData.description = body.description
        if (body.color !== undefined) updateData.color = body.color
        if (body.icon !== undefined) updateData.icon = body.icon
        if (body.subscription_tier_required !== undefined) {
            updateData.subscription_tier_required = body.subscription_tier_required
        }
        if (body.sort_order !== undefined) updateData.sort_order = body.sort_order
        if (body.is_active !== undefined) updateData.is_active = body.is_active

        const discipline = await contentMutations.updateDiscipline(id, updateData)
        return json({ success: true, data: discipline })
    } catch (error) {
        console.error('Update discipline error:', error)
        return json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update discipline'
            },
            { status: 500 }
        )
    }
}

export async function DELETE({ params }: { request: Request; params: { id: string } }) {
    const authResult = await validateApiAuthWithSession('content.write')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        const { id } = params
        await contentMutations.deleteDiscipline(id)
        return json({ success: true })
    } catch (error) {
        console.error('Delete discipline error:', error)
        return json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete discipline'
            },
            { status: 500 }
        )
    }
}
