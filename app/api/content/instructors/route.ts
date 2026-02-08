import { NextRequest, NextResponse } from 'next/server'
import { contentMutations, contentQueries } from '../../../../src/services/content'
import { validateApiAuthWithSession } from '../../../../src/lib/api-auth'
import type { InstructorInsert } from '../../../../src/lib/shared/types/database'

export async function GET(request: NextRequest) {
    const authResult = await validateApiAuthWithSession('content.read')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        const { searchParams } = new URL(request.url)
        const includeInactive = searchParams.get('includeInactive') === 'true'
        const instructors = await contentQueries.fetchInstructors(!includeInactive)
        return NextResponse.json({ success: true, data: instructors })
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
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

        if (!body.full_name) {
            return NextResponse.json(
                { success: false, error: 'Missing required field: full_name' },
                { status: 400 }
            )
        }

        const instructorData: InstructorInsert = {
            full_name: body.full_name,
            bio: body.bio || null,
            avatar_url: body.avatar_url || null,
            credentials: Array.isArray(body.credentials) ? body.credentials : null,
            specialties: Array.isArray(body.specialties) ? body.specialties : null,
            years_experience: body.years_experience ?? null,
            is_active: body.is_active !== undefined ? body.is_active : true
        }

        const instructor = await contentMutations.createInstructor(instructorData)
        return NextResponse.json({ success: true, data: instructor }, { status: 201 })
    } catch (error) {
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create instructor',
            },
            { status: 500 }
        )
    }
}
