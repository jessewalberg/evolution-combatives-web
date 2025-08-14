import { NextRequest, NextResponse } from 'next/server'
import { contentQueries } from '../../../../src/services/content'
import { validateApiAuthWithSession } from '../../../../src/lib/api-auth'

export async function GET(request: NextRequest) {
    const authResult = await validateApiAuthWithSession('content.read')
    if ('error' in authResult) {
        return authResult.error
    }

    try {
        const categories = await contentQueries.fetchCategories()
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