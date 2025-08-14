/**
 * Evolution Combatives - Shared Supabase Configuration
 * Common configuration for both React Native and Next.js platforms
 * 
 * @description Centralized Supabase configuration with platform-agnostic settings
 * @author Evolution Combatives
 */

/**
 * Shared Supabase configuration
 * Works with both NEXT_PUBLIC_ and EXPO_PUBLIC_ environment variables
 */
export const supabaseConfig = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    options: {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true, // Will be overridden per platform
        },
        realtime: {
            params: {
                eventsPerSecond: 10,
            },
        },
    },
} as const

/**
 * Validate required environment variables
 */
export const validateSupabaseConfig = () => {
    if (!supabaseConfig.url) {
        throw new Error(
            'Missing Supabase URL. Please set NEXT_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL environment variable.'
        )
    }

    if (!supabaseConfig.anonKey) {
        throw new Error(
            'Missing Supabase anon key. Please set NEXT_PUBLIC_SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY environment variable.'
        )
    }

    // Validate URL format
    try {
        new URL(supabaseConfig.url)
    } catch {
        throw new Error('Invalid Supabase URL format.')
    }

    return true
}

/**
 * Platform-specific configuration overrides
 */
export const platformConfigs = {
    /**
     * React Native specific configuration
     */
    reactNative: {
        ...supabaseConfig.options,
        auth: {
            ...supabaseConfig.options.auth,
            detectSessionInUrl: false, // Not applicable for mobile
        },
    },

    /**
     * Next.js browser client configuration
     */
    nextjsBrowser: {
        ...supabaseConfig.options,
        auth: {
            ...supabaseConfig.options.auth,
            detectSessionInUrl: true, // Works in browser
        },
    },

    /**
     * Next.js server client configuration
     */
    nextjsServer: {
        ...supabaseConfig.options,
        auth: {
            ...supabaseConfig.options.auth,
            detectSessionInUrl: false, // Not applicable on server
        },
    },

    /**
     * Admin client configuration (service role)
     */
    admin: {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
        },
        realtime: supabaseConfig.options.realtime,
    },
} as const

/**
 * Environment-specific settings
 */
export const environmentConfig = {
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',

    // Enable debug logging in development
    enableDebugLogging: process.env.NODE_ENV === 'development',

    // API timeouts
    defaultTimeout: 30000, // 30 seconds
    uploadTimeout: 300000, // 5 minutes for file uploads

    // Real-time settings
    realtimeHeartbeatInterval: 30000, // 30 seconds
    realtimeReconnectDelay: 1000, // 1 second
} as const 