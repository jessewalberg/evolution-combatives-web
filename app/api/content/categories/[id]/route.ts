import { NextRequest, NextResponse } from 'next/server'
import { contentQueries, contentMutations } from '../../../../../src/services/content'
import { validateApiAuthWithSession } from '../../../../../src/lib/api-auth'
import type { CategoryUpdate } from '../../../../../src/lib/shared/types/database'

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const params = await context.params
    const authResult = await validateApiAuthWithSession('content.read')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        // Fetch single category with relations
        const categories = await contentQueries.fetchCategories(undefined, true)
        const category = categories.find(c => c.id === params.id)

        if (!category) {
            return NextResponse.json(
                { success: false, error: 'Category not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true, data: category })
    } catch (error) {
        console.error('Get category error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch category'
            },
            { status: 500 }
        )
    }
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const params = await context.params
    const authResult = await validateApiAuthWithSession('content.write')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        const body = await request.json()

        // Prepare update data (only include provided fields)
        const updateData: CategoryUpdate = {}

        if (body.name !== undefined) updateData.name = body.name
        if (body.slug !== undefined) updateData.slug = body.slug
        if (body.description !== undefined) updateData.description = body.description
        if (body.discipline_id !== undefined) updateData.discipline_id = body.discipline_id
        if (body.color !== undefined) updateData.color = body.color
        if (body.icon !== undefined) updateData.icon = body.icon
        if (body.subscription_tier_required !== undefined) {
            updateData.subscription_tier_required = body.subscription_tier_required
        }
        if (body.sort_order !== undefined) updateData.sort_order = body.sort_order
        if (body.is_active !== undefined) updateData.is_active = body.is_active

        const category = await contentMutations.updateCategory(params.id, updateData)
        return NextResponse.json({ success: true, data: category })
    } catch (error) {
        console.error('Update category error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update category'
            },
            { status: 500 }
        )
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const params = await context.params
    const authResult = await validateApiAuthWithSession('content.write')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        await contentMutations.deleteCategory(params.id)
        return NextResponse.json({ success: true, message: 'Category deleted successfully' })
    } catch (error) {
        console.error('Delete category error:', error)
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete category'
            },
            { status: 500 }
        )
    }
}
