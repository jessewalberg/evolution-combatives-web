import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

const { mockPathname } = vi.hoisted(() => ({
  mockPathname: vi.fn(() => '/dashboard'),
}))

vi.mock('@tanstack/react-router', () => ({
  useLocation: (opts?: { select?: (l: { pathname: string }) => unknown }) =>
    opts?.select ? opts.select({ pathname: mockPathname() }) : { pathname: mockPathname() },
}))

vi.mock('@/src/components/compat/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
    className?: string
    onClick?: () => void
    'aria-current'?: React.AriaAttributes['aria-current']
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('../../providers/ThemeProvider', () => ({
  ThemeToggle: () => <button type="button" aria-label="Toggle theme">Theme</button>,
}))

import AdminLayout from './admin-layout'

const defaultUser = {
  name: 'Admin User',
  email: 'admin@test.com',
  role: 'Super Admin',
}

function renderLayout(
  overrides: Partial<React.ComponentProps<typeof AdminLayout>> = {}
) {
  return render(
    <AdminLayout
      userRole="super_admin"
      user={defaultUser}
      {...overrides}
    >
      <div>Page content</div>
    </AdminLayout>
  )
}

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPathname.mockReturnValue('/dashboard')
    // Desktop viewport so sidebar starts visible and collapse toggle is shown
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1280,
    })
  })

  it('renders primary nav items for super_admin', () => {
    renderLayout({ userRole: 'super_admin' })

    const nav = screen.getByRole('navigation')
    expect(within(nav).getByText('Dashboard')).toBeInTheDocument()
    expect(within(nav).getByText('Content')).toBeInTheDocument()
    expect(within(nav).getByText('Users')).toBeInTheDocument()
    expect(within(nav).getByText('Analytics')).toBeInTheDocument()
    expect(within(nav).getByText('Q&A')).toBeInTheDocument()
    expect(screen.getByText('Page content')).toBeInTheDocument()
    expect(screen.getByText('Evolution')).toBeInTheDocument()
  })

  it('marks the Dashboard link active for /dashboard pathname', () => {
    mockPathname.mockReturnValue('/dashboard')
    renderLayout()

    const dashboardLink = screen.getByRole('link', { name: /Dashboard/i })
    expect(dashboardLink).toHaveAttribute('href', '/dashboard')
    expect(dashboardLink).toHaveAttribute('aria-current', 'page')
  })

  it('marks Users link active when pathname is /users', () => {
    mockPathname.mockReturnValue('/users')
    renderLayout({ userRole: 'super_admin' })

    const usersLink = screen.getByRole('link', { name: /Users/i })
    expect(usersLink).toHaveAttribute('href', '/users')
    expect(usersLink).toHaveAttribute('aria-current', 'page')

    const dashboardLink = screen.getByRole('link', { name: /Dashboard/i })
    expect(dashboardLink).not.toHaveAttribute('aria-current')
  })

  it('toggles sidebar collapse and expand on desktop', async () => {
    const user = userEvent.setup()
    renderLayout()

    expect(screen.getByText('Evolution')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Quick Add/i })).toBeInTheDocument()

    // Desktop collapse toggle (hidden lg:flex) - XMark when expanded
    const headerButtons = screen
      .getAllByRole('button')
      .filter((btn) => btn.className.includes('hidden lg:flex'))
    expect(headerButtons.length).toBeGreaterThan(0)

    await user.click(headerButtons[0])

    expect(screen.queryByText('Evolution')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Quick Add/i })).not.toBeInTheDocument()

    // After collapse, toggle button still present (Bars3 icon)
    const collapsedToggle = screen
      .getAllByRole('button')
      .filter((btn) => btn.className.includes('hidden lg:flex'))
    await user.click(collapsedToggle[0])

    expect(screen.getByText('Evolution')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Quick Add/i })).toBeInTheDocument()
  })

  it('submits search query via onSearch', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    renderLayout({ onSearch })

    const input = screen.getByPlaceholderText(/Search content, users, analytics/i)
    await user.type(input, 'defensive tactics')
    await user.keyboard('{Enter}')

    expect(onSearch).toHaveBeenCalledWith('defensive tactics')
  })

  it('filters nav by content_admin role (no Users, shows Content)', () => {
    renderLayout({ userRole: 'content_admin' })

    const nav = screen.getByRole('navigation')
    expect(within(nav).getByText('Dashboard')).toBeInTheDocument()
    expect(within(nav).getByText('Content')).toBeInTheDocument()
    expect(within(nav).queryByText('Users')).not.toBeInTheDocument()
    expect(within(nav).getByText('Analytics')).toBeInTheDocument()
    expect(within(nav).queryByText('Q&A')).not.toBeInTheDocument()
  })

  it('filters nav by support_admin role (Users and Q&A, no Content)', () => {
    renderLayout({ userRole: 'support_admin' })

    const nav = screen.getByRole('navigation')
    expect(within(nav).getByText('Dashboard')).toBeInTheDocument()
    expect(within(nav).queryByText('Content')).not.toBeInTheDocument()
    expect(within(nav).getByText('Users')).toBeInTheDocument()
    expect(within(nav).queryByText('Analytics')).not.toBeInTheDocument()
    expect(within(nav).getByText('Q&A')).toBeInTheDocument()
  })

  it('renders breadcrumbs when provided', () => {
    renderLayout({
      breadcrumbs: [
        { name: 'Dashboard', href: '/dashboard' },
        { name: 'Videos' },
      ],
    })

    // Scope to breadcrumb <nav> - sidebar also has a "Dashboard" link
    const breadcrumbNav = screen
      .getAllByRole('navigation')
      .find((nav) => within(nav).queryByText('Videos'))
    expect(breadcrumbNav).toBeTruthy()
    expect(
      within(breadcrumbNav!).getByRole('link', { name: 'Dashboard' })
    ).toHaveAttribute('href', '/dashboard')
    expect(within(breadcrumbNav!).getByText('Videos')).toBeInTheDocument()
  })

  it('expands Content children and highlights child active link', async () => {
    const user = userEvent.setup()
    mockPathname.mockReturnValue('/dashboard/content/videos')
    renderLayout({ userRole: 'content_admin' })

    await user.click(screen.getByRole('button', { name: /Content/i }))

    const videosLink = await screen.findByRole('link', { name: /Videos/i })
    expect(videosLink).toHaveAttribute('href', '/dashboard/content/videos')
    expect(videosLink).toHaveAttribute('aria-current', 'page')
  })

  it('renders mocked ThemeToggle without theme provider', () => {
    renderLayout()
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument()
  })
})
