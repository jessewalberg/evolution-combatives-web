/**
 * Evolution Combatives - Health Check API
 * Simple health check endpoint for monitoring
 */

import { json } from '@/src/lib/http'

export async function GET() {
    try {
        return json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development'
        })
    } catch {
        return json(
            {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: 'Health check failed'
            },
            { status: 500 }
        )
    }
}
