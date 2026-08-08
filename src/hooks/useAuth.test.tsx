import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const { mockPush, mockToastSuccess, mockToastError, mockAuth, mockFrom } = vi.hoisted(() => {
  const mockPush = vi.fn()
  const mockToastSuccess = vi.fn()
  const mockToastError = vi.fn()
  const mockAuth = {
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  }
  const mockFrom = vi.fn()
  return { mockPush, mockToastSuccess, mockToastError, mockAuth, mockFrom }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

vi.mock('@/src/lib/supabase-browser', () => ({
  createBrowserClient: () => ({
    auth: mockAuth,
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

// Also mock relative path used by the hook
vi.mock('../lib/supabase-browser', () => ({
  createBrowserClient: () => ({
    auth: mockAuth,
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

import { useAuth, ROLE_PERMISSIONS as HookPermissions } from '@/src/hooks/useAuth'
import { ROLE_PERMISSIONS as ApiPermissions } from '@/src/lib/api-auth'

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return React.createElement(QueryClientProvider, { client }, children)
}

function profileChain(data: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error: null }),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data, error: null }),
        }),
      }),
    }),
  }
}

describe('ROLE_PERMISSIONS drift detection', () => {
  it('keeps useAuth and api-auth permission maps in sync', () => {
    const hookRoles = Object.keys(HookPermissions).sort()
    const apiRoles = Object.keys(ApiPermissions).sort()
    expect(hookRoles).toEqual(apiRoles)

    const normalize = (map: Record<string, Set<string>>) =>
      Object.fromEntries(
        Object.keys(map)
          .sort()
          .map((role) => [role, [...map[role]].sort()])
      )

    expect(normalize(HookPermissions)).toEqual(normalize(ApiPermissions))
  })
})

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: 'u1', email: 'admin@test.com' },
        },
      },
    })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return profileChain({
          id: 'u1',
          admin_role: 'content_admin',
          full_name: 'Admin',
        })
      }
      if (table === 'subscriptions') {
        return profileChain({
          id: 's1',
          tier: 'tier1',
          status: 'active',
          user_id: 'u1',
        })
      }
      return profileChain(null)
    })
  })

  it('exposes session user and hasPermission for content_admin', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.user?.id).toBe('u1'))
    await waitFor(() => expect(result.current.profile?.admin_role).toBe('content_admin'))
    expect(result.current.hasPermission('content.write')).toBe(true)
    expect(result.current.hasPermission('users.delete')).toBe(false)
  })

  it('super_admin hasPermission grants all via admin.all', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return profileChain({ id: 'u1', admin_role: 'super_admin' })
      }
      return profileChain(null)
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.profile?.admin_role).toBe('super_admin'))
    expect(result.current.hasPermission('users.delete')).toBe(true)
    expect(result.current.canAccessDiscipline('tier3')).toBe(true)
  })

  it('canAccessDiscipline respects subscription tier for non-super-admin', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.userTier).toBe('tier1'))
    expect(result.current.canAccessDiscipline('none')).toBe(true)
    expect(result.current.canAccessDiscipline('tier1')).toBe(true)
    expect(result.current.canAccessDiscipline('tier3')).toBe(false)
  })

  it('login success toasts and navigates to dashboard', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1' }, session: {} },
      error: null,
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await result.current.login({ email: 'a@b.com', password: 'x' })
    })
    expect(mockToastSuccess).toHaveBeenCalledWith('Login successful')
    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })

  it('login failure toasts error', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await result.current.login({ email: 'a@b.com', password: 'bad' })
    })
    expect(mockToastError).toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalledWith('/dashboard')
  })

  it('logout success navigates to login', async () => {
    mockAuth.signOut.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await result.current.logout()
    })
    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  it('logout failure toasts error', async () => {
    mockAuth.signOut.mockResolvedValue({ error: { message: 'Nope' } })
    const { result } = renderHook(() => useAuth(), { wrapper })
    await act(async () => {
      await result.current.logout()
    })
    expect(mockToastError).toHaveBeenCalled()
  })
})
