import { randomUUID } from 'crypto'

/**
 * Unique-per-run identifiers so parallel CI jobs cannot collide on shared Supabase data.
 */
export function uniqueSuffix(): string {
  return `${Date.now()}-${randomUUID().slice(0, 8)}`
}

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}+${uniqueSuffix()}@evolution-combatives-e2e.test`
}

export function uniqueSlug(prefix = 'e2e'): string {
  return `${prefix}-${uniqueSuffix()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-')
}

export function uniqueTitle(prefix = 'E2E'): string {
  return `${prefix} ${uniqueSuffix()}`
}
