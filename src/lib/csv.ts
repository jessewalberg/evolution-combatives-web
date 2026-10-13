/**
 * CSV export utilities with proper encoding
 * 
 * Handles:
 * - Proper escaping of quotes (doubled within quoted fields)
 * - Quoting of fields containing commas, quotes, or newlines
 * - Escape CSV cells (prefixes =, +, -, @, tab, carriage return)
 */

/**
 * Characters that are prefixed with a single quote for spreadsheet compatibility.
 */
const CELL_PREFIX_TRIGGERS = ['=', '+', '-', '@', '\t', '\r']

/**
 * Escapes a single CSV field value with proper encoding.
 * 
 * @param value - The value to escape (will be converted to string)
 * @returns Properly escaped CSV field
 * 
 * @example
 * ```ts
 * escapeCsvField('normal') // 'normal'
 * escapeCsvField('has, comma') // '"has, comma"'
 * escapeCsvField('has "quotes"') // '"has ""quotes"""'
 * escapeCsvField('=SUM(A1)') // "\"'=SUM(A1)\""
 * ```
 */
export function escapeCsvField(value: unknown): string {
    if (value === null || value === undefined) {
        return '""'
    }

    let str = String(value)

    // Escape CSV cells by prepending a single quote
    if (CELL_PREFIX_TRIGGERS.some(trigger => str.startsWith(trigger))) {
        str = "'" + str
    }

    // Always quote cells for consistent parsing
    // Escape internal quotes by doubling them
    return '"' + str.replace(/"/g, '""') + '"'
}

/**
 * Converts an array of objects to CSV format with proper encoding.
 * 
 * @param data - Array of objects to convert
 * @param options - Configuration options
 * @returns CSV string with proper encoding
 * 
 * @example
 * ```ts
 * const data = [
 *   { name: 'John', email: 'john@example.com' },
 *   { name: 'Jane, Jr.', email: '=HYPERLINK("bad")' }
 * ]
 * toCsv(data, { headers: ['Name', 'Email'] })
 * // "Name,Email\nJohn,john@example.com\n\"Jane, Jr.\",\"'=HYPERLINK(\"\"bad\"\")\""
 * ```
 */
export function toCsv<T extends Record<string, unknown>>(
    data: T[],
    options: {
        headers?: string[]
        keys?: (keyof T)[]
        includeHeader?: boolean
    } = {}
): string {
    if (!data.length) {
        return options.includeHeader !== false && options.headers?.length 
            ? options.headers.map(escapeCsvField).join(',')
            : ''
    }

    const keys = options.keys ?? (Object.keys(data[0]) as (keyof T)[])
    const headers = options.headers ?? keys.map(String)
    const includeHeader = options.includeHeader !== false

    const rows: string[] = []

    if (includeHeader) {
        rows.push(headers.map(escapeCsvField).join(','))
    }

    for (const row of data) {
        const values = keys.map(key => escapeCsvField(row[key]))
        rows.push(values.join(','))
    }

    return rows.join('\n')
}

/**
 * Creates a downloadable CSV file and triggers browser download.
 * 
 * @param data - Array of objects to export
 * @param filename - Filename for the download (without extension)
 * @param options - CSV formatting options
 */
export function downloadCsv<T extends Record<string, unknown>>(
    data: T[],
    filename: string,
    options: Parameters<typeof toCsv<T>>[1] = {}
): void {
    const csvContent = toCsv(data, options)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}
