import type { ComponentType } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

const signInWithPassword = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useSearch: () => ({ email: 'mobile@example.com', tier: 'tier1', invalidDeepLink: false }),
}))

vi.mock('@/src/lib/supabase-browser', () => {
  const client = {
    auth: {
      getUser: () => Promise.resolve({ data: { user: null } }),
      signInWithPassword,
    },
  }
  return { createBrowserClient: () => client }
})

import { Route } from './subscribe'

describe('mobile subscription deep link', () => {
  it('requires browser sign-in before checkout can start', async () => {
    signInWithPassword.mockResolvedValue({ error: null })
    const SubscribePage = Route.options.component as ComponentType
    render(<SubscribePage />)

    await screen.findByRole('heading', { name: 'Sign in to subscribe' })
    const checkoutButtons = screen.getAllByRole('button', { name: /subscribe to/i })
    checkoutButtons.forEach(button => expect(button).toBeDisabled())

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }))

    await waitFor(() => checkoutButtons.forEach(button => expect(button).toBeEnabled()))
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'mobile@example.com',
      password: 'password',
    })
  })
})
