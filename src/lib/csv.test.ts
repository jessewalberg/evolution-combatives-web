import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { escapeCsvField, toCsv, downloadCsv } from './csv'

describe('escapeCsvField', () => {
    it('returns empty string for null and undefined', () => {
        expect(escapeCsvField(null)).toBe('')
        expect(escapeCsvField(undefined)).toBe('')
    })

    it('converts non-string values to strings', () => {
        expect(escapeCsvField(123)).toBe('123')
        expect(escapeCsvField(true)).toBe('true')
        expect(escapeCsvField(0)).toBe('0')
    })

    it('returns simple values unchanged', () => {
        expect(escapeCsvField('normal')).toBe('normal')
        expect(escapeCsvField('hello world')).toBe('hello world')
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

    it('neutralizes formula injection with equals sign', () => {
        expect(escapeCsvField('=SUM(A1)')).toBe("'=SUM(A1)")
        expect(escapeCsvField('=1+1')).toBe("'=1+1")
    })

    it('neutralizes formula injection with plus sign', () => {
        expect(escapeCsvField('+1234')).toBe("'+1234")
    })

    it('neutralizes formula injection with minus sign', () => {
        expect(escapeCsvField('-123')).toBe("'-123")
    })

    it('neutralizes formula injection with at sign', () => {
        expect(escapeCsvField('@SUM(A1)')).toBe("'@SUM(A1)")
    })

    it('neutralizes formula injection with tab', () => {
        // Tab starting field gets single-quote prefix for formula neutralization
        expect(escapeCsvField('\t=cmd')).toBe("'\t=cmd")
    })

    it('handles combined escaping and neutralization', () => {
        // Has comma and quotes so gets quoted; also has = so gets neutralized
        expect(escapeCsvField('=A1, "B2"')).toBe("\"'=A1, \"\"B2\"\"\"")
    })
})

describe('toCsv', () => {
    it('returns empty string for empty data without headers', () => {
        expect(toCsv([])).toBe('')
    })

    it('returns headers only for empty data with headers option', () => {
        expect(toCsv([], { headers: ['Name', 'Email'] })).toBe('Name,Email')
    })

    it('converts simple object array to CSV', () => {
        const data = [
            { name: 'John', email: 'john@example.com' },
            { name: 'Jane', email: 'jane@example.com' }
        ]
        const csv = toCsv(data)
        const lines = csv.split('\n')
        
        expect(lines[0]).toBe('name,email')
        expect(lines[1]).toBe('John,john@example.com')
        expect(lines[2]).toBe('Jane,jane@example.com')
    })

    it('uses custom headers', () => {
        const data = [{ name: 'John', email: 'john@example.com' }]
        const csv = toCsv(data, { headers: ['Full Name', 'Email Address'] })
        
        expect(csv.split('\n')[0]).toBe('Full Name,Email Address')
    })

    it('uses custom keys to select and order columns', () => {
        const data = [{ name: 'John', email: 'john@example.com', age: 30 }]
        const csv = toCsv(data, { keys: ['email', 'name'] })
        
        const lines = csv.split('\n')
        expect(lines[0]).toBe('email,name')
        expect(lines[1]).toBe('john@example.com,John')
    })

    it('excludes header row when includeHeader is false', () => {
        const data = [{ name: 'John' }]
        const csv = toCsv(data, { includeHeader: false })
        
        expect(csv).toBe('John')
    })

    it('properly escapes data with formula characters', () => {
        const data = [
            { formula: '=SUM(A1)', value: 'normal' },
            { formula: '+123', value: 'test, value' }
        ]
        const csv = toCsv(data)
        const lines = csv.split('\n')
        
        // Formula prefix added, no quoting needed (no comma/quote/newline in value)
        expect(lines[1]).toBe("'=SUM(A1),normal")
        // +123 gets prefix, test, value gets quoted due to comma
        expect(lines[2]).toBe("'+123,\"test, value\"")
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

        vi.spyOn(document.body, 'appendChild').mockImplementation(appendChildMock)
        vi.spyOn(document.body, 'removeChild').mockImplementation(removeChildMock)
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
