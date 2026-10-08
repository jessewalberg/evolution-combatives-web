import { describe, it, expect } from 'vitest'
import {
    VIDEO_ALLOWED_CREATE_FIELDS,
    VIDEO_ALLOWED_UPDATE_FIELDS,
    VIDEO_ALLOWED_BULK_STATUS_FIELDS,
    VIDEO_ALLOWED_WEBHOOK_STATUS_FIELDS,
    filterAllowedFields,
} from './video-field-allowlists'

describe('filterAllowedFields', () => {
    it('filters object to only allowed fields', () => {
        const input = {
            title: 'Test Video',
            description: 'A test',
            id: 'should-be-stripped',
            created_at: 'should-be-stripped',
        }
        const result = filterAllowedFields(input, VIDEO_ALLOWED_CREATE_FIELDS)
        expect(result).toEqual({
            title: 'Test Video',
            description: 'A test',
        })
        expect(result).not.toHaveProperty('id')
        expect(result).not.toHaveProperty('created_at')
    })

    it('returns empty object when no fields allowed', () => {
        const input = { id: '1', created_at: 'now' }
        const result = filterAllowedFields(input, VIDEO_ALLOWED_CREATE_FIELDS)
        expect(result).toEqual({})
    })

    it('preserves null and undefined values for allowed fields', () => {
        const input = {
            title: 'Test',
            description: null,
            thumbnail_url: undefined,
        }
        const result = filterAllowedFields(input, VIDEO_ALLOWED_CREATE_FIELDS)
        expect(result.title).toBe('Test')
        expect(result.description).toBeNull()
        expect(result.thumbnail_url).toBeUndefined()
    })
})

describe('VIDEO_ALLOWED_CREATE_FIELDS', () => {
    it('allows cloudflare_video_id for creates', () => {
        expect(VIDEO_ALLOWED_CREATE_FIELDS.has('cloudflare_video_id')).toBe(true)
    })

    it('does not allow id, view_count, or timestamps', () => {
        expect(VIDEO_ALLOWED_CREATE_FIELDS.has('id')).toBe(false)
        expect(VIDEO_ALLOWED_CREATE_FIELDS.has('view_count')).toBe(false)
        expect(VIDEO_ALLOWED_CREATE_FIELDS.has('created_at')).toBe(false)
        expect(VIDEO_ALLOWED_CREATE_FIELDS.has('updated_at')).toBe(false)
    })
})

describe('VIDEO_ALLOWED_UPDATE_FIELDS', () => {
    it('does not allow cloudflare_video_id for updates', () => {
        expect(VIDEO_ALLOWED_UPDATE_FIELDS.has('cloudflare_video_id')).toBe(false)
    })

    it('does not allow id, view_count, processing_status, or timestamps', () => {
        expect(VIDEO_ALLOWED_UPDATE_FIELDS.has('id')).toBe(false)
        expect(VIDEO_ALLOWED_UPDATE_FIELDS.has('view_count')).toBe(false)
        expect(VIDEO_ALLOWED_UPDATE_FIELDS.has('processing_status')).toBe(false)
        expect(VIDEO_ALLOWED_UPDATE_FIELDS.has('created_at')).toBe(false)
        expect(VIDEO_ALLOWED_UPDATE_FIELDS.has('updated_at')).toBe(false)
    })
})

describe('VIDEO_ALLOWED_BULK_STATUS_FIELDS', () => {
    it('only allows is_published and processing_status', () => {
        expect(VIDEO_ALLOWED_BULK_STATUS_FIELDS.size).toBe(2)
        expect(VIDEO_ALLOWED_BULK_STATUS_FIELDS.has('is_published')).toBe(true)
        expect(VIDEO_ALLOWED_BULK_STATUS_FIELDS.has('processing_status')).toBe(true)
    })
})

describe('VIDEO_ALLOWED_WEBHOOK_STATUS_FIELDS', () => {
    it('only allows processing_status, duration_seconds, and is_published', () => {
        expect(VIDEO_ALLOWED_WEBHOOK_STATUS_FIELDS.size).toBe(3)
        expect(VIDEO_ALLOWED_WEBHOOK_STATUS_FIELDS.has('processing_status')).toBe(true)
        expect(VIDEO_ALLOWED_WEBHOOK_STATUS_FIELDS.has('duration_seconds')).toBe(true)
        expect(VIDEO_ALLOWED_WEBHOOK_STATUS_FIELDS.has('is_published')).toBe(true)
    })

    it('does not allow cloudflare_video_id, title, or other fields', () => {
        expect(VIDEO_ALLOWED_WEBHOOK_STATUS_FIELDS.has('cloudflare_video_id')).toBe(false)
        expect(VIDEO_ALLOWED_WEBHOOK_STATUS_FIELDS.has('title')).toBe(false)
        expect(VIDEO_ALLOWED_WEBHOOK_STATUS_FIELDS.has('id')).toBe(false)
    })
})
