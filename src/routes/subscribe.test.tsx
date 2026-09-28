import type { ComponentType } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { signInWithPassword, signOut, currentUser, deepLinkSearch } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  currentUser: { value: null as { email: string; id?: string } | null },
  deepLinkSearch: {
    value: { email: 'mobile@example.com', tier: 'tier1', userId: undefined as string | undefined, invalidDeepLink: false },
  },
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useSearch: () => deepLinkSearch.value,
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
    deepLinkSearch.value = { email: 'mobile@example.com', tier: 'tier1', userId: undefined, invalidDeepLink: false }
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

  it('blocks checkout and prompts sign-out when the browser session is a different account by email (no userId on link)', async () => {
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

  it('blocks checkout by user id even when the deep link email happens to match a different account', async () => {
    // Guards against email reassignment: the deep link's original owner
    // deleted their account and a new, unrelated user now has that email.
    deepLinkSearch.value = {
      email: 'mobile@example.com',
      tier: 'tier1',
      userId: 'original-owner-uuid',
      invalidDeepLink: false,
    }
    currentUser.value = { email: 'mobile@example.com', id: 'new-owner-uuid' }
    const SubscribePage = Route.options.component as ComponentType
    render(<SubscribePage />)

    await waitFor(() => {
      const checkoutButtons = screen.getAllByRole('button', { name: /subscribe to/i })
      checkoutButtons.forEach(button => expect(button).toBeDisabled())
    })
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('allows checkout when the signed-in user id matches the deep link, even if displayed emails differ in case', async () => {
    deepLinkSearch.value = {
      email: 'Mobile@Example.com',
      tier: 'tier1',
      userId: 'same-uuid',
      invalidDeepLink: false,
    }
    currentUser.value = { email: 'mobile@example.com', id: 'same-uuid' }
    const SubscribePage = Route.options.component as ComponentType
    render(<SubscribePage />)

    await waitFor(() => {
      const checkoutButtons = screen.getAllByRole('button', { name: /subscribe to/i })
      checkoutButtons.forEach(button => expect(button).toBeEnabled())
    })
  })
})
