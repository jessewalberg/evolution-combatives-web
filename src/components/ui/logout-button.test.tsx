import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const {
  mockPush,
  mockToastSuccess,
  mockToastError,
  mockAuth,
  mockFrom,
  mockLogout,
} = vi.hoisted(() => {
  const mockPush = vi.fn()
  const mockToastSuccess = vi.fn()
  const mockToastError = vi.fn()
  const mockAuth = {
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  }
  const mockFrom = vi.fn()
  const mockLogout = vi.fn()
  return {
    mockPush,
    mockToastSuccess,
    mockToastError,
    mockAuth,
    mockFrom,
    mockLogout,
  }
})

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockPush,
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

vi.mock('../../lib/supabase-browser', () => ({
  createBrowserClient: () => ({
    auth: mockAuth,
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    logout: mockLogout,
    isLogoutLoading: false,
  }),
}))

import { LogoutButton, LogoutLink } from './logout-button'

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return React.createElement(QueryClientProvider, { client }, children)
}

describe('LogoutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLogout.mockResolvedValue(undefined)
    localStorage.clear()
    localStorage.setItem('admin_remember_me', '1')
  })

  it('renders Sign Out by default with accessible button role', () => {
    render(<LogoutButton />, { wrapper })
    expect(screen.getByRole('button', { name: /Sign Out/ })).toBeInTheDocument()
  })

  it('calls logout, clears remember-me, and toasts success', async () => {
    const user = userEvent.setup()
    render(<LogoutButton />, { wrapper })
    await user.click(screen.getByRole('button', { name: /Sign Out/ }))
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1)
    })
    expect(localStorage.getItem('admin_remember_me')).toBeNull()
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Logged out successfully',
      expect.objectContaining({
        description: 'You have been securely logged out.',
      })
    )
  })

  it('toasts error when logout rejects', async () => {
    const user = userEvent.setup()
    mockLogout.mockRejectedValueOnce(new Error('network'))
    render(<LogoutButton />, { wrapper })
    await user.click(screen.getByRole('button', { name: /Sign Out/ }))
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Logout failed',
        expect.objectContaining({
          description: 'An unexpected error occurred during logout.',
        })
      )
    })
  })

  it('asks for confirmation when showConfirmation is true', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<LogoutButton showConfirmation />, { wrapper })
    await user.click(screen.getByRole('button', { name: /Sign Out/ }))
    expect(confirmSpy).toHaveBeenCalled()
    expect(mockLogout).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('proceeds after confirmation is accepted', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<LogoutButton showConfirmation />, { wrapper })
    await user.click(screen.getByRole('button', { name: /Sign Out/ }))
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled()
    })
  })

  it('renders custom children and can hide icon', () => {
    render(
      <LogoutButton showIcon={false}>Log me out</LogoutButton>,
      { wrapper }
    )
    expect(screen.getByRole('button', { name: 'Log me out' })).toBeInTheDocument()
  })
})

describe('LogoutLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLogout.mockResolvedValue(undefined)
  })

  it('renders as a ghost button that logs out', async () => {
    const user = userEvent.setup()
    render(<LogoutLink />, { wrapper })
    await user.click(screen.getByRole('button', { name: /Sign out/i }))
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled()
    })
  })
})
