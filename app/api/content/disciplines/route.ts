import { NextRequest, NextResponse } from 'next/server'
import { contentQueries, contentMutations } from '../../../../src/services/content'
import { validateApiAuthWithSession } from '../../../../src/lib/api-auth'
import type { DisciplineInsert } from '../../../../src/lib/shared/types/database'

export async function GET() {
    const authResult = await validateApiAuthWithSession('content.read')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        const disciplines = await contentQueries.fetchDisciplines(true) // Include categories for counts
        return NextResponse.json({ success: true, data: disciplines })
    } catch (error) {
        console.error('Disciplines API error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    const authResult = await validateApiAuthWithSession('content.write')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        const body = await request.json()

        // Validate required fields
        const requiredFields = ['name', 'slug']
        for (const field of requiredFields) {
            if (!body[field]) {
                return NextResponse.json(
                    { success: false, error: `Missing required field: ${field}` },
                    { status: 400 }
                )
            }
        }

        // Prepare discipline data
        const disciplineData: DisciplineInsert = {
            name: body.name,
            slug: body.slug,
            description: body.description || null,
            color: body.color || '#3B82F6',
            icon: body.icon || null,
            subscription_tier_required: body.subscription_tier_required || 'none',
            sort_order: body.sort_order || 1,
            is_active: body.is_active !== undefined ? body.is_active : true
        }

        const discipline = await contentMutations.createDiscipline(disciplineData)
        return NextResponse.json({ success: true, data: discipline }, { status: 201 })
    } catch (error) {
        console.error('Create discipline error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create discipline'
            },
            { status: 500 }
        )
    }
}