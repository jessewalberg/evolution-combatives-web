import { describe, it, expect } from 'vitest'
import { escapeLikePattern, buildIlikeFilter, buildOrIlikeFilter } from './postgrest-escape'

describe('escapeLikePattern', () => {
    it('escapes backslash', () => {
        expect(escapeLikePattern('test\\path')).toBe('test\\\\path')
    })

    it('escapes percent', () => {
        expect(escapeLikePattern('50%')).toBe('50\\%')
    })

    it('escapes underscore', () => {
        expect(escapeLikePattern('test_name')).toBe('test\\_name')
    })

    it('escapes multiple special characters', () => {
        expect(escapeLikePattern('50%_test\\path')).toBe('50\\%\\_test\\\\path')
    })

    it('leaves normal characters unchanged', () => {
        expect(escapeLikePattern('Smith, John')).toBe('Smith, John')
    })
})

describe('buildIlikeFilter', () => {
    it('wraps value in double quotes with wildcards', () => {
        expect(buildIlikeFilter('title', 'test')).toBe('title.ilike."%test%"')
    })

    it('preserves commas inside quoted value', () => {
        const result = buildIlikeFilter('title', 'Smith, John')
        expect(result).toBe('title.ilike."%Smith, John%"')
    })

    it('escapes parentheses inside quoted value', () => {
        const result = buildIlikeFilter('title', 'test(1)')
        expect(result).toBe('title.ilike."%test(1)%"')
    })

    it('escapes dots inside quoted value', () => {
        const result = buildIlikeFilter('title', 'file.txt')
        expect(result).toBe('title.ilike."%file.txt%"')
    })

    it('escapes double quotes inside value', () => {
        const result = buildIlikeFilter('title', 'test"quote')
        expect(result).toBe('title.ilike."%test\\"quote%"')
    })

    it('escapes backslash inside value', () => {
        const result = buildIlikeFilter('title', 'test\\path')
        expect(result).toBe('title.ilike."%test\\\\\\\\path%"')
    })

    it('escapes LIKE special characters', () => {
        const result = buildIlikeFilter('title', '50%')
        expect(result).toBe('title.ilike."%50\\\\%%"')
    })
})

describe('buildOrIlikeFilter', () => {
    it('builds filter for single field', () => {
        expect(buildOrIlikeFilter(['title'], 'test')).toBe('title.ilike."%test%"')
    })

    it('builds filter for multiple fields', () => {
        const result = buildOrIlikeFilter(['title', 'description'], 'test')
        expect(result).toBe('title.ilike."%test%",description.ilike."%test%"')
    })

    it('yields exactly two filter conditions', () => {
        const result = buildOrIlikeFilter(['title', 'description'], 'test')
        const conditions = result.split(',')
        expect(conditions).toHaveLength(2)
    })

    it('handles Smith, John correctly with two conditions', () => {
        const result = buildOrIlikeFilter(['title', 'description'], 'Smith, John')
        expect(result).toBe('title.ilike."%Smith, John%",description.ilike."%Smith, John%"')
        const conditions = result.split(/,(?=\w+\.ilike\.)/)
        expect(conditions).toHaveLength(2)
    })

    it('handles comma in value without breaking conditions', () => {
        const result = buildOrIlikeFilter(['title', 'description'], 'a,b')
        expect(result).toContain('title.ilike."%a,b%"')
        expect(result).toContain('description.ilike."%a,b%"')
    })

    it('handles parentheses in value', () => {
        const result = buildOrIlikeFilter(['title', 'description'], 'test(1)')
        expect(result).toContain('title.ilike."%test(1)%"')
        expect(result).toContain('description.ilike."%test(1)%"')
    })

    it('handles dot in value', () => {
        const result = buildOrIlikeFilter(['title', 'description'], 'file.txt')
        expect(result).toContain('title.ilike."%file.txt%"')
        expect(result).toContain('description.ilike."%file.txt%"')
    })

    it('handles backslash in value', () => {
        const result = buildOrIlikeFilter(['title', 'description'], 'test\\value')
        const conditions = result.split(/,(?=\w+\.ilike\.)/)
        expect(conditions).toHaveLength(2)
    })

    it('handles double quote in value', () => {
        const result = buildOrIlikeFilter(['title', 'description'], 'test"value')
        const conditions = result.split(/,(?=\w+\.ilike\.)/)
        expect(conditions).toHaveLength(2)
    })
})
