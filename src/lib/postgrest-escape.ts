/**
 * Escape special characters in PostgREST filter values.
 */

/**
 * Escape LIKE pattern special characters.
 * Escapes: \ % _
 */
export function escapeLikePattern(input: string): string {
    return input
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')
}

/**
 * Escape a value for PostgREST double-quoted string format.
 * Escapes: \ "
 */
function escapeForQuotedString(input: string): string {
    return input
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
}

/**
 * Build an ilike filter condition with properly escaped and quoted value.
 * First LIKE-escapes the input, then escapes for double-quoted strings.
 * Returns format: fieldname.ilike."%value%"
 */
export function buildIlikeFilter(fieldName: string, value: string): string {
    const likeEscaped = escapeLikePattern(value)
    const quotedEscaped = escapeForQuotedString(likeEscaped)
    return `${fieldName}.ilike."%${quotedEscaped}%"`
}

/**
 * Build an OR filter for multiple fields with the same ilike value.
 * Returns format: field1.ilike."%value%",field2.ilike."%value%"
 */
export function buildOrIlikeFilter(fieldNames: string[], value: string): string {
    return fieldNames.map(field => buildIlikeFilter(field, value)).join(',')
}
