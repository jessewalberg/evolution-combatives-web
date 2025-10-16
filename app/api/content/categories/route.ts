import { NextRequest, NextResponse } from 'next/server'
import { contentQueries, contentMutations } from '../../../../src/services/content'
import { validateApiAuthWithSession } from '../../../../src/lib/api-auth'
import type { CategoryInsert } from '../../../../src/lib/shared/types/database'

export async function GET() {
    const authResult = await validateApiAuthWithSession('content.read')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        const categories = await contentQueries.fetchCategories(undefined, true) // Include videos for stats
        return NextResponse.json({ success: true, data: categories })
    } catch (error) {
        console.error('Categories API error:', error)
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
        const requiredFields = ['name', 'slug', 'discipline_id']
        for (const field of requiredFields) {
            if (!body[field]) {
                return NextResponse.json(
                    { success: false, error: `Missing required field: ${field}` },
                    { status: 400 }
                )
            }
        }

        // Prepare category data
        const categoryData: CategoryInsert = {
            name: body.name,
            slug: body.slug,
            description: body.description || null,
            discipline_id: body.discipline_id,
            color: body.color || '#6B7280',
            icon: body.icon || null,
            subscription_tier_required: body.subscription_tier_required || 'none',
            sort_order: body.sort_order || 1,
            is_active: body.is_active !== undefined ? body.is_active : true
        }

        const category = await contentMutations.createCategory(categoryData)
        return NextResponse.json({ success: true, data: category }, { status: 201 })
    } catch (error) {
        console.error('Create category error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create category'
            },
            { status: 500 }
        )
    }
}