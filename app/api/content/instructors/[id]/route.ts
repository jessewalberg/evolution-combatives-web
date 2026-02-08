import { NextRequest, NextResponse } from 'next/server'
import { contentMutations, contentQueries } from '../../../../../src/services/content'
import { validateApiAuthWithSession } from '../../../../../src/lib/api-auth'
import type { InstructorUpdate } from '../../../../../src/lib/shared/types/database'

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
        const instructors = await contentQueries.fetchInstructors(false)
        const instructor = instructors.find((row) => row.id === id)

        if (!instructor) {
            return NextResponse.json(
                { success: false, error: 'Instructor not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true, data: instructor })
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch instructor',
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

        const updateData: InstructorUpdate = {}
        if (body.full_name !== undefined) updateData.full_name = body.full_name
        if (body.bio !== undefined) updateData.bio = body.bio
        if (body.avatar_url !== undefined) updateData.avatar_url = body.avatar_url
        if (body.credentials !== undefined) updateData.credentials = body.credentials
        if (body.specialties !== undefined) updateData.specialties = body.specialties
        if (body.years_experience !== undefined) updateData.years_experience = body.years_experience
        if (body.is_active !== undefined) updateData.is_active = body.is_active

        const instructor = await contentMutations.updateInstructor(id, updateData)
        return NextResponse.json({ success: true, data: instructor })
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update instructor',
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
        await contentMutations.deleteInstructor(id)
        return NextResponse.json({ success: true, message: 'Instructor deleted successfully' })
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to delete instructor',
            },
            { status: 500 }
        )
    }
}
