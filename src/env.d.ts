/// <reference types="vite/client" />

/**
 * Typed Vite env exposed via `import.meta.env.VITE_*`. Values come from
 * `.env.local` in dev and the wrangler.jsonc `vars` block at build time.
 * Anything the Worker reads at runtime (non-VITE_*) flows through
 * `process.env` via wrangler.jsonc vars/secrets and is typed in
 * `worker-configuration.d.ts`.
 */
interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
    readonly VITE_APP_URL: string
    readonly VITE_MOBILE_APP_SCHEME?: string
    readonly VITE_POSTHOG_KEY?: string
    readonly VITE_POSTHOG_HOST?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
