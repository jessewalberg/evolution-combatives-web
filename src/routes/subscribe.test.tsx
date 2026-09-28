import type { ComponentType } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { signInWithPassword, signOut, currentUser } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  currentUser: { value: null as { email: string } | null },
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useSearch: () => ({ email: 'mobile@example.com', tier: 'tier1', invalidDeepLink: false }),
}))

vi.mock('@/src/lib/supabase-browser', () => {
  const client = {
    auth: {
      getUser: () => Promise.resolve({ data: { user: currentUser.value } }),
      signInWithPassword,
      signOut,
    },
  }
  return { createBrowserClient: () => client }
})

import { Route } from './subscribe'

describe('mobile subscription deep link', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentUser.value = null
    signOut.mockResolvedValue({ error: null })
  })

  it('requires browser sign-in before checkout can start', async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    const SubscribePage = Route.options.component as ComponentType
    render(<SubscribePage />)

    await screen.findByRole('heading', { name: 'Sign in to subscribe' })
    const checkoutButtons = screen.getAllByRole('button', { name: /subscribe to/i })
    checkoutButtons.forEach(button => expect(button).toBeDisabled())

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => checkoutButtons.forEach(button => expect(button).toBeEnabled()))
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'mobile@example.com',
      password: 'password',
    })
  })

  it('blocks checkout and prompts sign-out when the browser session is a different account than the deep link', async () => {
    currentUser.value = { email: 'other-account@example.com' }
    const SubscribePage = Route.options.component as ComponentType
    render(<SubscribePage />)

    await screen.findByText(/other-account@example.com/)
    expect(screen.getAllByText(/mobile@example.com/).length).toBeGreaterThan(0)

    const checkoutButtons = screen.getAllByRole('button', { name: /subscribe to/i })
    checkoutButtons.forEach(button => expect(button).toBeDisabled())
    // Sign-in form must not be shown - the user is signed in, just as the wrong account
    expect(screen.queryByRole('heading', { name: 'Sign in to subscribe' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(signOut).toHaveBeenCalled())
  })
})
