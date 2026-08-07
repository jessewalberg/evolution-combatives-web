import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User, Session } from '@supabase/supabase-js'
import { AuthService } from './auth'
import { createFakeSupabaseClient } from '@/test/mocks/supabase'

function makeUser(
  overrides: Partial<Omit<User, 'email_confirmed_at'>> & {
    email_confirmed_at?: string | null
  } = {}
): User {
  return {
    id: 'user-1',
    email: 'user@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2024-01-01T00:00:00Z',
    email_confirmed_at: '2024-01-02T00:00:00Z',
    ...overrides,
  } as User
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: makeUser(),
    ...overrides,
  } as Session
}

describe('AuthService', () => {
  const client = createFakeSupabaseClient()
  const service = new AuthService(client as never)

  beforeEach(() => {
    client.reset()
  })

  describe('signIn', () => {
    it('returns user and session on success', async () => {
      const user = makeUser()
      const session = makeSession({ user })
      client.auth.signInWithPassword.mockResolvedValue({
        data: { user, session },
        error: null,
      })

      const result = await service.signIn('User@Example.com', 'Password1!')

      expect(result.error).toBeNull()
      expect(result.data?.user).toBe(user)
      expect(result.data?.session).toBe(session)
      expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'Password1!',
      })
    })

    it('returns formatted error on auth failure', async () => {
      client.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { name: 'AuthError', message: 'Invalid login credentials' },
      })

      const result = await service.signIn('user@example.com', 'wrong')

      expect(result.data).toBeNull()
      expect(result.error).toMatch(/Invalid email or password/i)
    })

    it('returns error when user or session is missing from success response', async () => {
      client.auth.signInWithPassword.mockResolvedValue({
        data: { user: makeUser(), session: null },
        error: null,
      })

      const result = await service.signIn('user@example.com', 'Password1!')

      expect(result.data).toBeNull()
      expect(result.error).toMatch(/Authentication failed/i)
    })
  })

  describe('signUp', () => {
    it('registers user with normalized email and metadata', async () => {
      const user = makeUser({ email: 'new@example.com' })
      client.auth.signUp.mockResolvedValue({
        data: { user, session: null },
        error: null,
      })

      const result = await service.signUp('New@Example.com', 'Password1!', {
        full_name: 'New User',
      })

      expect(result.error).toBeNull()
      expect(result.data?.user).toBe(user)
      expect(client.auth.signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'Password1!',
        options: { data: { full_name: 'New User' } },
      })
    })

    it('defaults metadata to empty object when omitted', async () => {
      const user = makeUser()
      client.auth.signUp.mockResolvedValue({
        data: { user, session: null },
        error: null,
      })

      await service.signUp('user@example.com', 'Password1!')

      expect(client.auth.signUp).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'Password1!',
        options: { data: {} },
      })
    })

    it('returns error when registration yields no user', async () => {
      client.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      })

      const result = await service.signUp('user@example.com', 'Password1!')

      expect(result.data).toBeNull()
      expect(result.error).toMatch(/Registration failed/i)
    })

    it('returns formatted error on signup auth failure', async () => {
      client.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { name: 'AuthError', message: 'User already registered' },
      })

      const result = await service.signUp('user@example.com', 'Password1!')

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })
  })

  describe('signOut', () => {
    it('returns success when sign out succeeds', async () => {
      client.auth.signOut.mockResolvedValue({ error: null })

      const result = await service.signOut()

      expect(result).toEqual({ data: null, error: null })
      expect(client.auth.signOut).toHaveBeenCalled()
    })

    it('returns error when sign out fails', async () => {
      client.auth.signOut.mockResolvedValue({
        error: { name: 'AuthError', message: 'Session not found' },
      })

      const result = await service.signOut()

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })
  })

  describe('getUser', () => {
    it('returns current user', async () => {
      const user = makeUser()
      client.auth.getUser.mockResolvedValue({ data: { user }, error: null })

      const result = await service.getUser()

      expect(result.error).toBeNull()
      expect(result.data).toBe(user)
    })

    it('returns error when no user is present', async () => {
      client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

      const result = await service.getUser()

      expect(result.data).toBeNull()
      expect(result.error).toMatch(/No authenticated user found/i)
    })

    it('returns error when getUser auth call fails', async () => {
      client.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { name: 'AuthError', message: 'JWT expired' },
      })

      const result = await service.getUser()

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })
  })

  describe('getSession', () => {
    it('returns active session', async () => {
      const session = makeSession()
      client.auth.getSession.mockResolvedValue({ data: { session }, error: null })

      const result = await service.getSession()

      expect(result.error).toBeNull()
      expect(result.data).toBe(session)
    })

    it('returns error when no session is present', async () => {
      client.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })

      const result = await service.getSession()

      expect(result.data).toBeNull()
      expect(result.error).toMatch(/No active session found/i)
    })

    it('returns error when getSession auth call fails', async () => {
      client.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: { name: 'AuthError', message: 'network error' },
      })

      const result = await service.getSession()

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })
  })

  describe('resetPassword', () => {
    it('sends reset email with normalized address', async () => {
      client.auth.resetPasswordForEmail.mockResolvedValue({ data: null, error: null })

      const result = await service.resetPassword('User@Example.com', 'https://app/reset')

      expect(result).toEqual({ data: null, error: null })
      expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
        redirectTo: 'https://app/reset',
      })
    })

    it('omits redirectTo when not provided', async () => {
      client.auth.resetPasswordForEmail.mockResolvedValue({ data: null, error: null })

      await service.resetPassword('user@example.com')

      expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
        redirectTo: undefined,
      })
    })

    it('returns error when reset email fails', async () => {
      client.auth.resetPasswordForEmail.mockResolvedValue({
        data: null,
        error: { name: 'AuthError', message: 'Unable to send email' },
      })

      const result = await service.resetPassword('user@example.com')

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })
  })

  describe('updatePassword', () => {
    it('updates password and returns user', async () => {
      const user = makeUser()
      client.auth.updateUser.mockResolvedValue({ data: { user }, error: null })

      const result = await service.updatePassword('NewPassword1!')

      expect(result.error).toBeNull()
      expect(result.data).toBe(user)
      expect(client.auth.updateUser).toHaveBeenCalledWith({ password: 'NewPassword1!' })
    })

    it('returns error when no user is returned', async () => {
      client.auth.updateUser.mockResolvedValue({ data: { user: null }, error: null })

      const result = await service.updatePassword('NewPassword1!')

      expect(result.data).toBeNull()
      expect(result.error).toMatch(/Password update failed/i)
    })

    it('returns error when updateUser fails', async () => {
      client.auth.updateUser.mockResolvedValue({
        data: { user: null },
        error: { name: 'AuthError', message: 'Weak password' },
      })

      const result = await service.updatePassword('weak')

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })
  })

  describe('updateEmail', () => {
    it('updates email with normalized value', async () => {
      const user = makeUser({ email: 'updated@example.com' })
      client.auth.updateUser.mockResolvedValue({ data: { user }, error: null })

      const result = await service.updateEmail('Updated@Example.com')

      expect(result.error).toBeNull()
      expect(result.data?.email).toBe('updated@example.com')
      expect(client.auth.updateUser).toHaveBeenCalledWith({ email: 'updated@example.com' })
    })

    it('returns error when no user is returned', async () => {
      client.auth.updateUser.mockResolvedValue({ data: { user: null }, error: null })

      const result = await service.updateEmail('new@example.com')

      expect(result.data).toBeNull()
      expect(result.error).toMatch(/Email update failed/i)
    })

    it('returns error when updateUser fails', async () => {
      client.auth.updateUser.mockResolvedValue({
        data: { user: null },
        error: { name: 'AuthError', message: 'Email already in use' },
      })

      const result = await service.updateEmail('taken@example.com')

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })
  })

  describe('refreshSession', () => {
    it('returns refreshed user and session', async () => {
      const user = makeUser()
      const session = makeSession({ user })
      client.auth.refreshSession.mockResolvedValue({ data: { user, session }, error: null })

      const result = await service.refreshSession()

      expect(result.error).toBeNull()
      expect(result.data).toEqual({ user, session })
    })

    it('returns error when refresh yields no session', async () => {
      client.auth.refreshSession.mockResolvedValue({
        data: { user: makeUser(), session: null },
        error: null,
      })

      const result = await service.refreshSession()

      expect(result.data).toBeNull()
      expect(result.error).toMatch(/Session refresh failed/i)
    })

    it('returns error when refreshSession fails', async () => {
      client.auth.refreshSession.mockResolvedValue({
        data: { user: null, session: null },
        error: { name: 'AuthError', message: 'Invalid refresh token' },
      })

      const result = await service.refreshSession()

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })
  })

  describe('isAuthenticated', () => {
    it('returns true when session has a user', async () => {
      client.auth.getSession.mockResolvedValue({
        data: { session: makeSession() },
        error: null,
      })

      await expect(service.isAuthenticated()).resolves.toBe(true)
    })

    it('returns false when session is missing', async () => {
      client.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })

      await expect(service.isAuthenticated()).resolves.toBe(false)
    })

    it('returns false when getSession throws', async () => {
      client.auth.getSession.mockRejectedValue(new Error('boom'))

      await expect(service.isAuthenticated()).resolves.toBe(false)
    })
  })

  describe('isSessionValid', () => {
    it('returns true for non-expired session', async () => {
      client.auth.getSession.mockResolvedValue({
        data: { session: makeSession({ expires_at: Math.floor(Date.now() / 1000) + 60 }) },
        error: null,
      })

      await expect(service.isSessionValid()).resolves.toBe(true)
    })

    it('returns false for expired session', async () => {
      client.auth.getSession.mockResolvedValue({
        data: { session: makeSession({ expires_at: Math.floor(Date.now() / 1000) - 60 }) },
        error: null,
      })

      await expect(service.isSessionValid()).resolves.toBe(false)
    })

    it('returns false when session is null', async () => {
      client.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })

      await expect(service.isSessionValid()).resolves.toBe(false)
    })

    it('treats missing expires_at as valid', async () => {
      client.auth.getSession.mockResolvedValue({
        data: { session: makeSession({ expires_at: undefined }) },
        error: null,
      })

      await expect(service.isSessionValid()).resolves.toBe(true)
    })

    it('returns false when getSession throws', async () => {
      client.auth.getSession.mockRejectedValue(new Error('boom'))

      await expect(service.isSessionValid()).resolves.toBe(false)
    })
  })

  describe('signInWithOAuth', () => {
    it('returns provider redirect url on success', async () => {
      client.auth.signInWithOAuth.mockResolvedValue({
        data: { url: 'https://oauth.example.com', provider: 'google' },
        error: null,
      })

      const result = await service.signInWithOAuth('google', {
        redirectTo: 'https://app/callback',
        scopes: 'email',
      })

      expect(result.error).toBeNull()
      expect(result.data?.url).toBe('https://oauth.example.com')
      expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'https://app/callback',
          scopes: 'email',
        },
      })
    })

    it('works without options', async () => {
      client.auth.signInWithOAuth.mockResolvedValue({
        data: { url: 'https://oauth.example.com', provider: 'github' },
        error: null,
      })

      const result = await service.signInWithOAuth('github')

      expect(result.error).toBeNull()
      expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'github',
        options: {
          redirectTo: undefined,
          scopes: undefined,
        },
      })
    })

    it('returns error when OAuth fails', async () => {
      client.auth.signInWithOAuth.mockResolvedValue({
        data: { url: null, provider: 'google' },
        error: { name: 'AuthError', message: 'Provider not enabled' },
      })

      const result = await service.signInWithOAuth('google')

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })
  })

  describe('adminGetUser', () => {
    it('returns user from admin API', async () => {
      const user = makeUser({ id: 'admin-target' })
      client.auth.admin.getUserById.mockResolvedValue({ data: { user }, error: null })

      const result = await service.adminGetUser('admin-target')

      expect(result.error).toBeNull()
      expect(result.data?.id).toBe('admin-target')
    })

    it('returns error when user is not found', async () => {
      client.auth.admin.getUserById.mockResolvedValue({ data: { user: null }, error: null })

      const result = await service.adminGetUser('missing')

      expect(result.data).toBeNull()
      expect(result.error).toMatch(/User not found/i)
    })

    it('returns error when admin getUserById fails', async () => {
      client.auth.admin.getUserById.mockResolvedValue({
        data: { user: null },
        error: { name: 'AuthError', message: 'Forbidden' },
      })

      const result = await service.adminGetUser('u1')

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })
  })

  describe('adminDeleteUser', () => {
    it('deletes user via admin API', async () => {
      client.auth.admin.deleteUser.mockResolvedValue({ data: null, error: null })

      const result = await service.adminDeleteUser('user-to-delete')

      expect(result).toEqual({ data: null, error: null })
      expect(client.auth.admin.deleteUser).toHaveBeenCalledWith('user-to-delete')
    })

    it('returns error when delete fails', async () => {
      client.auth.admin.deleteUser.mockResolvedValue({
        data: null,
        error: { name: 'AuthError', message: 'User not found' },
      })

      const result = await service.adminDeleteUser('missing')

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })
  })

  describe('adminUpdateUser', () => {
    it('updates user via admin API', async () => {
      const user = makeUser({ id: 'u1', email: 'new@example.com' })
      client.auth.admin.updateUserById.mockResolvedValue({ data: { user }, error: null })

      const result = await service.adminUpdateUser('u1', {
        email: 'new@example.com',
        user_metadata: { rank: 'SGT' },
      })

      expect(result.error).toBeNull()
      expect(result.data?.email).toBe('new@example.com')
      expect(client.auth.admin.updateUserById).toHaveBeenCalledWith('u1', {
        email: 'new@example.com',
        user_metadata: { rank: 'SGT' },
      })
    })

    it('returns error when update yields no user', async () => {
      client.auth.admin.updateUserById.mockResolvedValue({ data: { user: null }, error: null })

      const result = await service.adminUpdateUser('u1', { email: 'x@example.com' })

      expect(result.data).toBeNull()
      expect(result.error).toMatch(/User update failed/i)
    })

    it('returns error when admin update fails', async () => {
      client.auth.admin.updateUserById.mockResolvedValue({
        data: { user: null },
        error: { name: 'AuthError', message: 'Forbidden' },
      })

      const result = await service.adminUpdateUser('u1', { password: 'NewPass1!' })

      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
    })
  })

  describe('onAuthStateChange', () => {
    it('forwards auth events to callback', () => {
      const callback = vi.fn()
      const unsubscribe = vi.fn()
      client.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe } },
      })

      const subscription = service.onAuthStateChange(callback)
      const handler = client.auth.onAuthStateChange.mock.calls[0][0] as (
        event: string,
        session: Session | null
      ) => void
      const session = makeSession()
      handler('SIGNED_IN', session)

      expect(callback).toHaveBeenCalledWith('SIGNED_IN', session)
      expect(subscription.unsubscribe).toBe(unsubscribe)
    })

    it('logs auth state changes in development', () => {
      vi.stubEnv('NODE_ENV', 'development')
      const log = vi.spyOn(console, 'log').mockImplementation(() => {})
      const callback = vi.fn()
      client.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      })

      service.onAuthStateChange(callback)
      const handler = client.auth.onAuthStateChange.mock.calls[0][0] as (
        event: string,
        session: Session | null
      ) => void
      const session = makeSession({ user: makeUser({ id: 'dev-user' }) })
      handler('SIGNED_OUT', session)

      expect(log).toHaveBeenCalledWith('Auth state change:', {
        event: 'SIGNED_OUT',
        userId: 'dev-user',
      })
      expect(callback).toHaveBeenCalledWith('SIGNED_OUT', session)

      log.mockRestore()
      vi.unstubAllEnvs()
    })
  })

  describe('validation helpers', () => {
    it('validates email format', () => {
      expect(service.isValidEmail('user@example.com')).toBe(true)
      expect(service.isValidEmail('not-an-email')).toBe(false)
    })

    it('validates password strength rules', () => {
      const weak = service.isValidPassword('short')
      expect(weak.valid).toBe(false)
      expect(weak.errors.length).toBeGreaterThan(0)

      const strong = service.isValidPassword('StrongPass1!')
      expect(strong.valid).toBe(true)
      expect(strong.errors).toEqual([])
    })

    it('reports each missing password requirement', () => {
      const noUpper = service.isValidPassword('lowercase1!')
      expect(noUpper.errors).toContain('Password must contain at least one uppercase letter')

      const noLower = service.isValidPassword('UPPERCASE1!')
      expect(noLower.errors).toContain('Password must contain at least one lowercase letter')

      const noDigit = service.isValidPassword('NoDigits!')
      expect(noDigit.errors).toContain('Password must contain at least one number')

      const noSpecial = service.isValidPassword('NoSpecial1')
      expect(noSpecial.errors).toContain('Password must contain at least one special character')
    })
  })

  describe('getCurrentUserId', () => {
    it('returns user id from session', async () => {
      client.auth.getSession.mockResolvedValue({
        data: { session: makeSession({ user: makeUser({ id: 'session-user' }) }) },
        error: null,
      })

      await expect(service.getCurrentUserId()).resolves.toBe('session-user')
    })

    it('returns null when session is absent', async () => {
      client.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })

      await expect(service.getCurrentUserId()).resolves.toBeNull()
    })

    it('returns null when getSession throws', async () => {
      client.auth.getSession.mockRejectedValue(new Error('boom'))

      await expect(service.getCurrentUserId()).resolves.toBeNull()
    })
  })

  describe('isEmailVerified', () => {
    it('returns true when email_confirmed_at is set', async () => {
      client.auth.getUser.mockResolvedValue({
        data: { user: makeUser({ email_confirmed_at: '2024-01-01T00:00:00Z' }) },
        error: null,
      })

      await expect(service.isEmailVerified()).resolves.toBe(true)
    })

    it('returns false when email is not confirmed', async () => {
      client.auth.getUser.mockResolvedValue({
        data: { user: makeUser({ email_confirmed_at: null }) },
        error: null,
      })

      await expect(service.isEmailVerified()).resolves.toBe(false)
    })

    it('returns false when getUser throws', async () => {
      client.auth.getUser.mockRejectedValue(new Error('boom'))

      await expect(service.isEmailVerified()).resolves.toBe(false)
    })
  })
})
