import { createStart } from '@tanstack/react-start'

// Request middleware (security headers, CSRF, auth/role guards, rate
// limiting) is added here as the Next.js middleware.ts port lands.
export const startInstance = createStart(() => {
    return {
        requestMiddleware: [],
    }
})
