import posthog from "posthog-js"

// Environment-specific PostHog configuration
const getPostHogConfig = () => {
  const isDevelopment = process.env.NODE_ENV === "development"
  
  return {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    capture_exceptions: true,
    debug: isDevelopment,
    // Disable mobile-specific features in web environment
    autocapture: {
      dom_event_allowlist: [], // Disable DOM autocapture that might interfere
    },
    // Enable more detailed logging in development
    loaded: isDevelopment ? () => {
      console.log('PostHog loaded successfully', {
        environment: process.env.NODE_ENV,
        key: process.env.NEXT_PUBLIC_POSTHOG_KEY?.substring(0, 10) + '...',
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST
      })
    } : undefined,
  }
}

// Only initialize PostHog in browser environment
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, getPostHogConfig())
} else if (typeof window === "undefined") {
  // Server-side: do nothing
} else {
  console.warn('PostHog key not found in environment variables')
}
