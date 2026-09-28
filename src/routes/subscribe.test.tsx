import type { ComponentType } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

type DeepLinkSearch = {
  email?: string
  tier?: string
  userId?: string
  invalidDeepLink: boolean
}

const { signInWithPassword, signOut, currentUser, deepLinkSearch } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  currentUser: { value: null as { email: string; id?: string } | null },
  deepLinkSearch: {
    value: {
      email: 'mobile@example.com',
      tier: 'tier1',
      userId: 'mobile-user-uuid',
      invalidDeepLink: false,
    } as DeepLinkSearch,
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

describe('subscribe route validateSearch', () => {
  it('requires userId alongside email and tier, marking the link invalid otherwise', () => {
    const validateSearch = Route.options.validateSearch as (search: Record<string, unknown>) => DeepLinkSearch

    expect(validateSearch({ email: 'a@b.com', tier: 'tier1' })).toMatchObject({ invalidDeepLink: true })
    expect(validateSearch({ email: 'a@b.com', tier: 'tier1', userId: 'u1' })).toEqual({
      email: 'a@b.com',
      tier: 'tier1',
      userId: 'u1',
      invalidDeepLink: false,
    })
  })
})

describe('mobile subscription deep link', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentUser.value = null
    deepLinkSearch.value = {
      email: 'mobile@example.com',
      tier: 'tier1',
      userId: 'mobile-user-uuid',
      invalidDeepLink: false,
    }
    signOut.mockResolvedValue({ error: null })
  })

  it('requires browser sign-in before checkout can start', async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'mobile-user-uuid', email: 'mobile@example.com' } },
      error: null,
    })
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

  it('shows the invalid-deep-link state when the mobile app link has no userId', async () => {
    deepLinkSearch.value = {
      email: 'mobile@example.com',
      tier: 'tier1',
      userId: undefined,
      invalidDeepLink: true,
    }
    const SubscribePage = Route.options.component as ComponentType
    render(<SubscribePage />)

    expect(await screen.findByText(/open this page from the mobile app/i)).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /subscribe to/i })).toHaveLength(0)
  })

  it('blocks checkout by user id when the browser session is a different account', async () => {
    currentUser.value = { email: 'other-account@example.com', id: 'other-user-uuid' }
    const SubscribePage = Route.options.component as ComponentType
    render(<SubscribePage />)

    await screen.findByText(/other-account@example.com/)
    expect(screen.getAllByText(/mobile@example.com/).length).toBeGreaterThan(0)

    const checkoutButtons = screen.getAllByRole('button', { name: /subscribe to/i })
    checkoutButtons.forEach(button => expect(button).toBeDisabled())
    expect(screen.queryByRole('heading', { name: 'Sign in to subscribe' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(signOut).toHaveBeenCalled())
  })

  it('blocks checkout by user id even when the deep link email happens to match a different account', async () => {
    // Guards against email reassignment: the deep link's original owner
    // deleted their account and a new, unrelated user now has that email.
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
      userId: 'mobile-user-uuid',
      invalidDeepLink: false,
    }
    currentUser.value = { email: 'mobile@example.com', id: 'mobile-user-uuid' }
    const SubscribePage = Route.options.component as ComponentType
    render(<SubscribePage />)

    await waitFor(() => {
      const checkoutButtons = screen.getAllByRole('button', { name: /subscribe to/i })
      checkoutButtons.forEach(button => expect(button).toBeEnabled())
    })
  })
})
