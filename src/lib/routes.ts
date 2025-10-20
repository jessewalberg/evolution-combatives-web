/**
 * Evolution Combatives - Centralized Route Definitions
 * Single source of truth for all application routes
 * 
 * @description Type-safe route constants to prevent typos and enable easy refactoring
 * @author Evolution Combatives
 */

/**
 * Application Routes
 * 
 * Usage:
 * - router.push(ROUTES.DASHBOARD.CONTENT.VIDEOS)
 * - <Link href={ROUTES.USERS.DETAIL(userId)}>
 */
export const ROUTES = {
    // Public routes
    HOME: '/',
    LOGIN: '/login',
    SIGNUP: '/sign-up',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password',
    SUBSCRIBE: '/subscribe',
    SUBSCRIPTION_SUCCESS: '/subscription-success',

    // Auth routes
    AUTH: {
        CONFIRM: '/auth/confirm',
    },

    // Dashboard routes
    DASHBOARD: {
        HOME: '/dashboard',

        // Content management
        CONTENT: {
            VIDEOS: '/dashboard/content/videos',
            VIDEO_UPLOAD: '/dashboard/content/videos/upload',
            VIDEO_DETAIL: (id: string) => `/dashboard/content/videos/${id}`,
            VIDEO_EDIT: (id: string) => `/dashboard/content/videos/${id}/edit`,
            VIDEO_PREVIEW: (id: string) => `/dashboard/content/videos/${id}/preview`,

            CATEGORIES: '/dashboard/content/categories',
            CATEGORY_DETAIL: (id: string) => `/dashboard/content/categories/${id}`,

            DISCIPLINES: '/dashboard/content/disciplines',
            DISCIPLINE_DETAIL: (id: string) => `/dashboard/content/disciplines/${id}`,

            PROCESSING: '/dashboard/content/processing',
        },

        // Profile (coming soon)
        PROFILE: {
            VIEW: '/dashboard/profile',
            EDIT: '/dashboard/profile/edit',
            CHANGE_PASSWORD: '/dashboard/profile/change-password',
        },

        // Search (coming soon)
        SEARCH: (query: string) => `/dashboard/search?q=${encodeURIComponent(query)}`,
    },

    // User management (root level, not under dashboard)
    USERS: {
        LIST: '/users',
        DETAIL: (id: string) => `/users/${id}`,
        DETAIL_TAB: (id: string, tab: string) => `/users/${id}?tab=${tab}`,
        INVITE: '/users/invite', // Coming soon
        PROFILE: {
            VIEW: '/users/profile', // Coming soon
            EDIT: '/users/profile/edit', // Coming soon
            CHANGE_PASSWORD: '/users/profile/change-password', // Coming soon
        },
    },

    // Analytics (root level, not under dashboard)
    ANALYTICS: {
        HOME: '/analytics',
        VIDEOS: '/analytics/videos',
        VIDEO_DETAIL: (id: string) => `/analytics/videos/${id}`,
        QA: '/analytics/qa',
        USERS: '/analytics/users',
        USER_DETAIL: (id: string) => `/analytics/users/${id}`,
    },

    // Q&A Management (root level, not under dashboard)
    QA: {
        LIST: '/qa',
        DETAIL: (id: string) => `/qa/${id}`,
    },

    // API routes (for reference)
    API: {
        AUTH: {
            LOGIN: '/api/auth/login',
            LOGOUT: '/api/auth/logout',
            SIGNUP: '/api/auth/sign-up',
        },
        CONTENT: {
            VIDEOS: '/api/content/videos',
            VIDEO_DETAIL: (id: string) => `/api/content/videos/${id}`,
            CATEGORIES: '/api/content/categories',
            DISCIPLINES: '/api/content/disciplines',
        },
        CLOUDFLARE: {
            UPLOAD: '/api/cloudflare/upload',
        },
        VIDEO: {
            SIGNED_URL: '/api/video/signed-url',
        },
        SUBSCRIPTIONS: {
            CREATE_CHECKOUT: '/api/subscriptions/create-checkout',
        },
    },
} as const

/**
 * Route helper utilities
 */
export const RouteHelpers = {
    /**
     * Check if a route is a dashboard route
     */
    isDashboardRoute: (path: string): boolean => {
        return path.startsWith('/dashboard')
    },

    /**
     * Check if a route is a public route (no auth required)
     */
    isPublicRoute: (path: string): boolean => {
        const publicRoutes: string[] = [
            ROUTES.HOME,
            ROUTES.LOGIN,
            ROUTES.SIGNUP,
            ROUTES.FORGOT_PASSWORD,
            ROUTES.RESET_PASSWORD,
            ROUTES.AUTH.CONFIRM,
            ROUTES.SUBSCRIBE,
            ROUTES.SUBSCRIPTION_SUCCESS,
        ]
        return publicRoutes.includes(path) || path.startsWith('/api/')
    },

    /**
     * Get breadcrumb items from pathname
     */
    getBreadcrumbs: (pathname: string): Array<{ name: string; href?: string }> => {
        const parts = pathname.split('/').filter(Boolean)
        const breadcrumbs: Array<{ name: string; href?: string }> = []

        let currentPath = ''
        for (let i = 0; i < parts.length; i++) {
            currentPath += `/${parts[i]}`

            // Format the part name
            const name = parts[i]
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')

            // Add breadcrumb (last item has no href as it's the current page)
            breadcrumbs.push({
                name,
                href: i === parts.length - 1 ? undefined : currentPath,
            })
        }

        return breadcrumbs
    },

    /**
     * Build a URL with query parameters
     */
    withQuery: (path: string, params: Record<string, string | number | boolean>): string => {
        const searchParams = new URLSearchParams()
        Object.entries(params).forEach(([key, value]) => {
            searchParams.append(key, String(value))
        })
        const query = searchParams.toString()
        return query ? `${path}?${query}` : path
    },
}

/**
 * Type-safe route parameters
 */
export type RouteParams = {
    videoId?: string
    userId?: string
    categoryId?: string
    disciplineId?: string
    questionId?: string
    tab?: string
    query?: string
}

/**
 * Export for convenience
 */
export default ROUTES

