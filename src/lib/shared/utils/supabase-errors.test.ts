import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  EvolutionCombativesError,
  isAuthError,
  isPostgrestError,
  isNetworkError,
  formatErrorMessage,
  formatAuthErrorMessage,
  formatPostgrestErrorMessage,
  handleSupabaseError,
  withRetry,
  safeQuery,
  ErrorCodes,
} from '@/src/lib/shared/utils/supabase-errors'
import type { AuthError, PostgrestError } from '@supabase/supabase-js'

function authError(message: string): AuthError {
  return { name: 'AuthError', message } as AuthError
}

function pgError(code: string, message = 'err', details = 'd', hint = 'h'): PostgrestError {
  return { code, message, details, hint, name: 'PostgrestError' } as PostgrestError
}

describe('error type guards', () => {
  it('detects AuthError by name', () => {
    expect(isAuthError(authError('Invalid login credentials'))).toBe(true)
    expect(isAuthError(new Error('x'))).toBe(false)
    expect(isAuthError(null)).toBe(false)
  })

  it('detects PostgrestError by shape', () => {
    expect(isPostgrestError(pgError('PGRST116'))).toBe(true)
    expect(isPostgrestError({ code: 'x', message: 'm' })).toBe(false)
  })

  it('detects network errors by message keywords', () => {
    expect(isNetworkError(new Error('fetch failed'))).toBe(true)
    expect(isNetworkError(new Error('network down'))).toBe(true)
    expect(isNetworkError(new Error('connection reset'))).toBe(true)
    expect(isNetworkError(new Error('timeout exceeded'))).toBe(true)
    expect(isNetworkError(new Error('other'))).toBe(false)
    expect(isNetworkError('string')).toBe(false)
  })
})

describe('formatAuthErrorMessage', () => {
  it('maps known auth messages', () => {
    expect(formatAuthErrorMessage(authError('Invalid login credentials'))).toMatch(/Invalid email/)
    expect(formatAuthErrorMessage(authError('Email not confirmed'))).toMatch(/confirmation link/)
    expect(formatAuthErrorMessage(authError('User not found'))).toMatch(/No account found/)
    expect(formatAuthErrorMessage(authError('Password is too weak'))).toMatch(/8 characters/)
    expect(formatAuthErrorMessage(authError('Email rate limit exceeded'))).toMatch(/Too many email/)
    expect(formatAuthErrorMessage(authError('Signup disabled'))).toMatch(/disabled/)
    expect(formatAuthErrorMessage(authError('User already registered'))).toMatch(/already exists/)
    expect(formatAuthErrorMessage(authError('Custom'))).toBe('Custom')
  })
})

describe('formatPostgrestErrorMessage', () => {
  it('maps known codes', () => {
    expect(formatPostgrestErrorMessage(pgError('PGRST116'))).toMatch(/No data found/)
    expect(formatPostgrestErrorMessage(pgError('PGRST204'))).toMatch(/not found/)
    expect(formatPostgrestErrorMessage(pgError('23505'))).toMatch(/already exists/)
    expect(formatPostgrestErrorMessage(pgError('23503'))).toMatch(/referenced/)
    expect(formatPostgrestErrorMessage(pgError('42501'))).toMatch(/permission/)
    expect(formatPostgrestErrorMessage(pgError('42P01'))).toMatch(/table not found/)
    expect(formatPostgrestErrorMessage(pgError('08006'))).toMatch(/connection failed/)
  })

  it('uses generic message in non-development for unknown codes', () => {
    const msg = formatPostgrestErrorMessage(pgError('99999', 'weird'))
    expect(msg).toMatch(/database error|Database error/i)
  })
})

describe('formatErrorMessage', () => {
  it('routes by error kind', () => {
    expect(formatErrorMessage(authError('Invalid login credentials'))).toMatch(/Invalid email/)
    expect(formatErrorMessage(pgError('PGRST116'))).toMatch(/No data found/)
    expect(formatErrorMessage(new Error('fetch failed'))).toMatch(/Network connection/)
    expect(formatErrorMessage(new EvolutionCombativesError('custom'))).toBe('custom')
    expect(formatErrorMessage(new Error('plain'))).toBe('plain')
    expect(formatErrorMessage(42)).toMatch(/unexpected error/i)
  })
})

describe('handleSupabaseError', () => {
  it('wraps into EvolutionCombativesError with codes', () => {
    const auth = handleSupabaseError(authError('Invalid login credentials'), 'login')
    expect(auth).toBeInstanceOf(EvolutionCombativesError)
    expect(auth.code).toBe('AUTH_ERROR')

    const pg = handleSupabaseError(pgError('23505', 'dup', 'details', 'hint'), 'insert')
    expect(pg.code).toBe('23505')
    expect(pg.details).toBe('details')

    const net = handleSupabaseError(new Error('network fail'), 'fetch')
    expect(net.code).toBe('NETWORK_ERROR')

    const unk = handleSupabaseError('boom')
    expect(unk.code).toBe('UNKNOWN_ERROR')
  })
})

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns on first success', async () => {
    const op = vi.fn().mockResolvedValue('ok')
    await expect(withRetry(op, 3, 100)).resolves.toBe('ok')
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('retries with exponential backoff then succeeds', async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce('ok')

    const promise = withRetry(op, 3, 1000, 'retry-test')
    await vi.advanceTimersByTimeAsync(1000)
    await expect(promise).resolves.toBe('ok')
    expect(op).toHaveBeenCalledTimes(2)
  })

  it('does not retry auth errors', async () => {
    const op = vi.fn().mockRejectedValue(authError('Invalid login credentials'))
    await expect(withRetry(op, 3, 100)).rejects.toBeInstanceOf(EvolutionCombativesError)
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('does not retry Postgrest 4xx-style codes', async () => {
    const op = vi.fn().mockRejectedValue(pgError('42501'))
    await expect(withRetry(op, 3, 100)).rejects.toBeInstanceOf(EvolutionCombativesError)
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('throws after exhausting retries', async () => {
    const op = vi.fn().mockRejectedValue(new Error('connection timeout'))
    const promise = withRetry(op, 2, 100).catch((e) => e)
    await vi.advanceTimersByTimeAsync(100)
    await vi.advanceTimersByTimeAsync(200)
    const err = await promise
    expect(err).toBeInstanceOf(EvolutionCombativesError)
    expect(op).toHaveBeenCalledTimes(2)
  })
})

describe('safeQuery', () => {
  it('returns data on success', async () => {
    const result = await safeQuery(async () => ({ data: { id: 1 }, error: null }))
    expect(result).toEqual({ data: { id: 1 }, error: null })
  })

  it('formats result.error', async () => {
    const result = await safeQuery(async () => ({
      data: null,
      error: authError('Invalid login credentials'),
    }))
    expect(result.data).toBeNull()
    expect(result.error).toMatch(/Invalid email/)
  })

  it('catches thrown errors', async () => {
    const result = await safeQuery(async () => {
      throw new Error('boom')
    })
    expect(result.data).toBeNull()
    expect(result.error).toBe('boom')
  })
})

describe('ErrorCodes', () => {
  it('exposes stable code constants', () => {
    expect(ErrorCodes.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS')
    expect(ErrorCodes.NETWORK_ERROR).toBe('NETWORK_ERROR')
  })
})
