/**
 * Evolution Combatives - Health Check API
 * Simple health check endpoint for monitoring
 * 
 * @description Returns system status and basic info
 * @author Evolution Combatives
 */

import { NextResponse } from 'next/server'
import packageJson from '../../../package.json'

/**
 * GET /api/health
 * Health check endpoint
 */
export async function GET() {
    try {
        return NextResponse.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: packageJson.version,
            environment: process.env.NODE_ENV || 'development'
        })
    } catch {
        return NextResponse.json(
            {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: 'Health check failed'
            },
            { status: 500 }
        )
    }
}
