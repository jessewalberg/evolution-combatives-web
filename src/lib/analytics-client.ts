/**
 * PostHog browser initialization (port of instrumentation-client.ts).
 * Imported for side effects from the root route; no-ops during SSR.
 */

import posthog from 'posthog-js'

const isDevelopment = import.meta.env.DEV

if (typeof window !== 'undefined' && import.meta.env.VITE_POSTHOG_KEY) {
    posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
        api_host: '/ingest',
        ui_host: 'https://us.posthog.com',
        capture_exceptions: true,
        debug: isDevelopment,
        // Disable mobile-specific features in web environment
        autocapture: {
            dom_event_allowlist: [], // Disable DOM autocapture that might interfere
        },
        loaded: isDevelopment
            ? () => {
                  console.log('PostHog loaded successfully', {
                      key: import.meta.env.VITE_POSTHOG_KEY?.substring(0, 10) + '...',
                  })
              }
            : undefined,
    })
} else if (typeof window !== 'undefined' && !isDevelopment) {
    console.warn('PostHog key not found in environment variables')
}

export { posthog }
