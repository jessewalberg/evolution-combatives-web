import { NextRequest, NextResponse } from 'next/server'
import { contentQueries } from '../../../../src/services/content'
import { validateApiAuthWithSession } from '../../../../src/lib/api-auth'

export async function GET(request: NextRequest) {
    const authResult = await validateApiAuthWithSession('content.read')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        const disciplines = await contentQueries.fetchDisciplines()
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