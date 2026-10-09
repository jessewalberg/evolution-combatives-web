import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { escapeCsvField, toCsv, downloadCsv } from './csv'

describe('escapeCsvField', () => {
    it('returns empty quoted string for null and undefined', () => {
        expect(escapeCsvField(null)).toBe('""')
        expect(escapeCsvField(undefined)).toBe('""')
    })

    it('converts non-string values to quoted strings', () => {
        expect(escapeCsvField(123)).toBe('"123"')
        expect(escapeCsvField(true)).toBe('"true"')
        expect(escapeCsvField(0)).toBe('"0"')
    })

    it('quotes all values for consistent parsing', () => {
        expect(escapeCsvField('normal')).toBe('"normal"')
        expect(escapeCsvField('hello world')).toBe('"hello world"')
    })

    it('quotes fields containing commas', () => {
        expect(escapeCsvField('has, comma')).toBe('"has, comma"')
        expect(escapeCsvField('a,b,c')).toBe('"a,b,c"')
    })

    it('quotes fields containing newlines', () => {
        expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"')
        expect(escapeCsvField('line1\r\nline2')).toBe('"line1\r\nline2"')
    })

    it('escapes quotes by doubling them', () => {
        expect(escapeCsvField('has "quotes"')).toBe('"has ""quotes"""')
        expect(escapeCsvField('"quoted"')).toBe('"""quoted"""')
    })

    it('prefixes leading = + - @ tab CR with a quote', () => {
        expect(escapeCsvField('=SUM(A1)')).toBe("\"'=SUM(A1)\"")
        expect(escapeCsvField('=1+1')).toBe("\"'=1+1\"")
        expect(escapeCsvField('+1234')).toBe("\"'+1234\"")
        expect(escapeCsvField('-123')).toBe("\"'-123\"")
        expect(escapeCsvField('@SUM(A1)')).toBe("\"'@SUM(A1)\"")
        expect(escapeCsvField('\t=cmd')).toBe("\"'\t=cmd\"")
        expect(escapeCsvField('\r=cmd')).toBe("\"'\r=cmd\"")
        expect(escapeCsvField('=A1, "B2"')).toBe("\"'=A1, \"\"B2\"\"\"")
    })
})

describe('toCsv', () => {
    it('returns empty string for empty data without headers', () => {
        expect(toCsv([])).toBe('')
    })

    it('returns quoted headers only for empty data with headers option', () => {
        expect(toCsv([], { headers: ['Name', 'Email'] })).toBe('"Name","Email"')
    })

    it('converts simple object array to CSV with all cells quoted', () => {
        const data = [
            { name: 'John', email: 'john@example.com' },
            { name: 'Jane', email: 'jane@example.com' }
        ]
        const csv = toCsv(data)
        const lines = csv.split('\n')
        
        expect(lines[0]).toBe('"name","email"')
        expect(lines[1]).toBe('"John","john@example.com"')
        expect(lines[2]).toBe('"Jane","jane@example.com"')
    })

    it('uses custom headers', () => {
        const data = [{ name: 'John', email: 'john@example.com' }]
        const csv = toCsv(data, { headers: ['Full Name', 'Email Address'] })
        
        expect(csv.split('\n')[0]).toBe('"Full Name","Email Address"')
    })

    it('uses custom keys to select and order columns', () => {
        const data = [{ name: 'John', email: 'john@example.com', age: 30 }]
        const csv = toCsv(data, { keys: ['email', 'name'] })
        
        const lines = csv.split('\n')
        expect(lines[0]).toBe('"email","name"')
        expect(lines[1]).toBe('"john@example.com","John"')
    })

    it('excludes header row when includeHeader is false', () => {
        const data = [{ name: 'John' }]
        const csv = toCsv(data, { includeHeader: false })
        
        expect(csv).toBe('"John"')
    })

    it('escapes data with leading special characters', () => {
        const data = [
            { prefixed: '=SUM(A1)', value: 'normal' },
            { prefixed: '+123', value: 'test, value' }
        ]
        const csv = toCsv(data)
        const lines = csv.split('\n')
        
        expect(lines[1]).toBe("\"'=SUM(A1)\",\"normal\"")
        expect(lines[2]).toBe("\"'+123\",\"test, value\"")
    })
})

describe('users export row builder', () => {
    it('produces no cell containing literal string undefined', () => {
        const userData = [
            {
                email: 'user@test.com',
                firstName: 'Test',
                lastName: 'User',
                subscriptionTier: undefined as unknown as string,
                status: 'active',
                joinDate: '2024-01-01',
                lastActive: '2024-01-15',
                totalProgress: '50.0%',
                completionRate: '25.0%',
                department: undefined as unknown as string,
                location: null as unknown as string
            }
        ]

        const csv = toCsv(userData, {
            headers: ['Email', 'First Name', 'Last Name', 'Subscription', 'Status', 'Join Date', 'Last Active', 'Progress', 'Completion Rate', 'Department', 'Location'],
            keys: ['email', 'firstName', 'lastName', 'subscriptionTier', 'status', 'joinDate', 'lastActive', 'totalProgress', 'completionRate', 'department', 'location']
        })

        expect(csv).not.toContain('"undefined"')
        expect(csv).not.toMatch(/,undefined,/)
        expect(csv).not.toMatch(/,undefined$/)
    })

    it('prefixes cells starting with = for spreadsheet compatibility', () => {
        const userData = [
            {
                email: '=HYPERLINK("http://test")',
                firstName: 'Test',
                lastName: '+User',
                subscriptionTier: 'tier1',
                status: 'active',
                joinDate: '2024-01-01',
                lastActive: '-1 day',
                totalProgress: '50.0%',
                completionRate: '@mention',
                department: 'IT',
                location: 'NYC'
            }
        ]

        const csv = toCsv(userData, {
            headers: ['Email', 'First Name', 'Last Name', 'Subscription', 'Status', 'Join Date', 'Last Active', 'Progress', 'Completion Rate', 'Department', 'Location'],
            keys: ['email', 'firstName', 'lastName', 'subscriptionTier', 'status', 'joinDate', 'lastActive', 'totalProgress', 'completionRate', 'department', 'location']
        })

        expect(csv).toContain("\"'=HYPERLINK")
        expect(csv).toContain("\"'+User\"")
        expect(csv).toContain("\"'-1 day\"")
        expect(csv).toContain("\"'@mention\"")
    })
})

describe('video export integration', () => {
    it('prefixes video title starting with = for spreadsheet compatibility', () => {
        const videoData = [
            { title: '=HYPERLINK("external")', category: 'Training', status: 'ready' },
            { title: '+Normal Title', category: 'Tutorial, Advanced', status: 'processing' },
            { title: 'Regular Video', category: 'Basic "Course"', status: 'ready' }
        ]
        
        const csv = toCsv(videoData, {
            headers: ['Title', 'Category', 'Status'],
            keys: ['title', 'category', 'status']
        })
        
        const lines = csv.split('\n')
        
        expect(lines[0]).toBe('"Title","Category","Status"')
        expect(lines[1]).toContain("'=HYPERLINK(\"\"external\"\")")
        expect(lines[2]).toContain("'+Normal Title")
        expect(lines[2]).toContain('Tutorial, Advanced')
        expect(lines[3]).toContain('""Course""')
    })

    it('handles empty and null video fields', () => {
        const videoData = [
            { title: 'Video 1', category: '', instructor: null as unknown as string },
        ]
        
        const csv = toCsv(videoData, {
            headers: ['Title', 'Category', 'Instructor'],
            keys: ['title', 'category', 'instructor']
        })
        
        const lines = csv.split('\n')
        expect(lines[1]).toBe('"Video 1","",""')
    })
})

describe('downloadCsv', () => {
    let createObjectURLMock: ReturnType<typeof vi.fn>
    let revokeObjectURLMock: ReturnType<typeof vi.fn>
    let appendChildMock: ReturnType<typeof vi.fn>
    let removeChildMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
        createObjectURLMock = vi.fn().mockReturnValue('blob:test')
        revokeObjectURLMock = vi.fn()
        appendChildMock = vi.fn()
        removeChildMock = vi.fn()

        vi.stubGlobal('URL', {
            createObjectURL: createObjectURLMock,
            revokeObjectURL: revokeObjectURLMock
        })

        vi.spyOn(document.body, 'appendChild').mockImplementation(appendChildMock as unknown as <T extends Node>(node: T) => T)
        vi.spyOn(document.body, 'removeChild').mockImplementation(removeChildMock as unknown as <T extends Node>(child: T) => T)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('creates blob with correct type and triggers download', () => {
        const clickMock = vi.fn()
        vi.spyOn(document, 'createElement').mockReturnValue({
            href: '',
            download: '',
            click: clickMock,
        } as unknown as HTMLAnchorElement)

        const data = [{ name: 'Test' }]
        downloadCsv(data, 'export')

        expect(createObjectURLMock).toHaveBeenCalled()
        const blob = createObjectURLMock.mock.calls[0][0]
        expect(blob.type).toBe('text/csv;charset=utf-8')

        expect(clickMock).toHaveBeenCalled()
        expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test')
    })

    it('appends .csv extension when not present', () => {
        const anchor = { href: '', download: '', click: vi.fn() }
        vi.spyOn(document, 'createElement').mockReturnValue(anchor as unknown as HTMLAnchorElement)

        downloadCsv([{ name: 'Test' }], 'export')
        expect(anchor.download).toBe('export.csv')
    })

    it('does not double .csv extension', () => {
        const anchor = { href: '', download: '', click: vi.fn() }
        vi.spyOn(document, 'createElement').mockReturnValue(anchor as unknown as HTMLAnchorElement)

        downloadCsv([{ name: 'Test' }], 'export.csv')
        expect(anchor.download).toBe('export.csv')
    })
})
