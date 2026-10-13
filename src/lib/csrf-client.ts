let cachedToken: { token: string; expires: number } | null = null
let pendingToken: Promise<string> | null = null

async function getCSRFToken(): Promise<string> {
    if (cachedToken && Date.now() < cachedToken.expires) return cachedToken.token
    if (pendingToken) return pendingToken

    const request = (async () => {
        const response = await fetch('/api/csrf-token', { credentials: 'include' })
        if (!response.ok) throw new Error(`Failed to fetch CSRF token: ${response.status}`)

        const data = await response.json()
        const expires = new Date(data.expiresAt).getTime() - 60_000
        if (!data.success || typeof data.csrfToken !== 'string' || !Number.isFinite(expires)) {
            throw new Error('Failed to get CSRF token from response')
        }

        cachedToken = { token: data.csrfToken, expires }
        return data.csrfToken
    })()
    pendingToken = request
    try {
        return await request
    } finally {
        if (pendingToken === request) pendingToken = null
    }
}

async function isCSRFRejection(response: Response): Promise<boolean> {
    if (response.status !== 403) return false
    try {
        return (await response.clone().json()).error === 'CSRF token validation failed'
    } catch {
        return false
    }
}

export async function fetchWithCSRF(path: string, init: RequestInit): Promise<Response> {
    const send = async (token: string) => {
        const headers = new Headers(init.headers)
        if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
        headers.set('X-CSRF-Token', token)
        return fetch(path, { ...init, headers, credentials: 'include' })
    }

    const token = await getCSRFToken()
    let response = await send(token)
    if (await isCSRFRejection(response)) {
        if (cachedToken?.token === token) cachedToken = null
        const retryToken = await getCSRFToken()
        response = await send(retryToken)
        if (await isCSRFRejection(response) && cachedToken?.token === retryToken) cachedToken = null
    }
    return response
}
