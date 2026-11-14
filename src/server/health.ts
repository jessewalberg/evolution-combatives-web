/**
 * Evolution Combatives - Health Check API
 * Liveness and build identity only; no external dependency checks.
 */

import { json } from '@/src/lib/http'

export async function GET() {
    return json(
        {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: __COMMIT_SHA__,
            environment: process.env.NODE_ENV || 'development'
        },
        {
            headers: {
                'x-commit-sha': __COMMIT_SHA__,
                'Cache-Control': 'no-store',
            },
        }
    )
}
