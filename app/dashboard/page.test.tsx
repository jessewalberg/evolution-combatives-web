import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const { mockPush, mockHasPermission } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockHasPermission: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'admin@test.com' },
    profile: {
      id: 'u1',
      admin_role: 'super_admin',
      full_name: 'Admin User',
    },
    hasPermission: mockHasPermission,
    isLoading: false,
  }),
}))

import DashboardPage from './page'

const metrics = {
  totalUsers: 1247,
  totalUsersGrowth: 12.5,
  activeSubscriptions: 892,
  monthlyRevenue: 15420,
  revenueGrowth: 8.2,
  totalVideos: 156,
  videosThisMonth: 12,
  avgEngagementTime: 1845,
  engagementGrowth: 5.1,
  processingVideos: 3,
  pendingQA: 7,
  systemAlerts: 1,
}

function renderPage(options?: { delayMetricsMs?: number }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const delay = options?.delayMetricsMs ?? 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/dashboard/metrics')) {
        if (delay > 0) {
          await new Promise((r) => setTimeout(r, delay))
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: metrics }),
        } as Response
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({ success: false, error: 'not found' }),
      } as Response
    })
  )

  return render(
    <QueryClientProvider client={client}>
      <DashboardPage />
    </QueryClientProvider>
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasPermission.mockReturnValue(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders key stats from mocked metrics', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Dashboard Overview' })
    ).toBeInTheDocument()
    expect(screen.getByText(/Welcome back, Admin User/)).toBeInTheDocument()

    expect(await screen.findByText('1,247')).toBeInTheDocument()
    expect(screen.getByText('892')).toBeInTheDocument()
    expect(screen.getByText('156')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Total Users' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Active Subscriptions' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Video Library' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pending Q&A' })).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('shows loading state on stats while metrics fetch is in flight', async () => {
    renderPage({ delayMetricsMs: 250 })

    expect(
      await screen.findByRole('heading', { name: 'Dashboard Overview' })
    ).toBeInTheDocument()

    // StatsCardSkeleton applies animate-pulse via loading variant
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText('1,247')).not.toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('1,247')).toBeInTheDocument()
    })
  })

  it('renders recent activity feed items', async () => {
    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Recent Activity' })
    ).toBeInTheDocument()

    expect(
      await screen.findByText('New User Registration')
    ).toBeInTheDocument()
    expect(
      screen.getByText(/john.doe@police.gov joined with Intermediate subscription/)
    ).toBeInTheDocument()
    expect(screen.getByText('Video Processing Complete')).toBeInTheDocument()
    expect(screen.getByText('New Q&A Submission')).toBeInTheDocument()
    expect(screen.getByText('Video Upload Started')).toBeInTheDocument()
    expect(screen.getByText('System Alert')).toBeInTheDocument()
  })
})
