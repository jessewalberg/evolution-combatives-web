/**
 * Video field allowlists for database operations.
 * Restrict which fields can be written to the videos table.
 */

export const VIDEO_ALLOWED_CREATE_FIELDS = new Set([
    'title',
    'description',
    'slug',
    'category_id',
    'instructor_id',
    'cloudflare_video_id',
    'duration_seconds',
    'thumbnail_url',
    'tier_required',
    'tags',
    'is_published',
    'sort_order',
    'difficulty',
])

export const VIDEO_ALLOWED_UPDATE_FIELDS = new Set([
    'title',
    'description',
    'slug',
    'category_id',
    'instructor_id',
    'thumbnail_url',
    'tier_required',
    'tags',
    'is_published',
    'sort_order',
    'difficulty',
])

export const VIDEO_ALLOWED_BULK_STATUS_FIELDS = new Set([
    'is_published',
    'processing_status',
])

export const VIDEO_ALLOWED_WEBHOOK_STATUS_FIELDS = new Set([
    'processing_status',
    'duration_seconds',
    'is_published',
])

export function filterAllowedFields<T extends Record<string, unknown>>(
    data: T,
    allowedFields: Set<string>
): Partial<T> {
    const filtered: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
        if (allowedFields.has(key)) {
            filtered[key] = value
        }
    }
    return filtered as Partial<T>
}
