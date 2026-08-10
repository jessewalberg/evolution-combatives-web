/**
 * Vitest stand-in for the workerd-only 'cloudflare:workers' module
 * (aliased in vitest.config.ts). Both consumers treat undefined exports
 * as "not on Workers" and fall back accordingly.
 */
export const env = undefined
export const waitUntil = undefined
