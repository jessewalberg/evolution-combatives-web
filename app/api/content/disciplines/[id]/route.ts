import { NextRequest, NextResponse } from 'next/server'
import { contentQueries, contentMutations } from '../../../../../src/services/content'
import { validateApiAuthWithSession } from '../../../../../src/lib/api-auth'
import type { DisciplineUpdate } from '../../../../../src/lib/shared/types/database'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await validateApiAuthWithSession('content.read')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        const { id } = await params
        // Fetch single discipline with relations
        const disciplines = await contentQueries.fetchDisciplines(true)
        const discipline = disciplines.find(d => d.id === id)

        if (!discipline) {
            return NextResponse.json(
                { success: false, error: 'Discipline not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true, data: discipline })
    } catch (error) {
        console.error('Get discipline error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch discipline'
            },
            { status: 500 }
        )
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await validateApiAuthWithSession('content.write')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        const { id } = await params
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
        return NextResponse.json({ success: true, data: discipline })
    } catch (error) {
        console.error('Update discipline error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update discipline'
            },
            { status: 500 }
        )
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await validateApiAuthWithSession('content.write')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        const { id } = await params
        await contentMutations.deleteDiscipline(id)
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Delete discipline error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete discipline'
            },
            { status: 500 }
        )
    }
}
