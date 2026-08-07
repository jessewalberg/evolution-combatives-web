import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  EmptyState,
  NoVideosEmptyState,
  NoUsersEmptyState,
  NoSearchResultsEmptyState,
  ErrorEmptyState,
  OfflineEmptyState,
  MaintenanceEmptyState,
  ComingSoonEmptyState,
  NoAnalyticsEmptyState,
} from './empty-state'
import { PlayIcon } from '@heroicons/react/24/outline'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        title="Nothing here"
        description="Add content to get started"
      />
    )
    expect(
      screen.getByRole('heading', { name: 'Nothing here' })
    ).toBeInTheDocument()
    expect(screen.getByText('Add content to get started')).toBeInTheDocument()
  })

  it('renders primary and secondary actions and fires handlers', async () => {
    const user = userEvent.setup()
    const onPrimary = vi.fn()
    const onSecondary = vi.fn()
    render(
      <EmptyState
        icon={PlayIcon}
        title="No videos"
        primaryAction={{ label: 'Upload', onClick: onPrimary }}
        secondaryAction={{
          label: 'Browse',
          onClick: onSecondary,
          variant: 'outline',
        }}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Upload' }))
    await user.click(screen.getByRole('button', { name: 'Browse' }))
    expect(onPrimary).toHaveBeenCalledTimes(1)
    expect(onSecondary).toHaveBeenCalledTimes(1)
  })

  it('disables action button while loading', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <EmptyState
        title="Loading action"
        primaryAction={{ label: 'Retry', onClick, loading: true }}
      />
    )
    const button = screen.getByRole('button', { name: /Retry/ })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('shows branding when enabled', () => {
    render(<EmptyState title="Branded" showBranding />)
    expect(
      screen.getByText('Evolution Combatives Professional Platform')
    ).toBeInTheDocument()
  })

  it('renders custom illustration instead of icon', () => {
    render(
      <EmptyState
        title="Illustrated"
        illustration={<div data-testid="custom-illustration">Art</div>}
      />
    )
    expect(screen.getByTestId('custom-illustration')).toBeInTheDocument()
  })

  it.each(['sm', 'md', 'lg', 'xl'] as const)('renders size=%s', (size) => {
    render(<EmptyState title={`Size ${size}`} size={size} />)
    expect(screen.getByRole('heading', { name: `Size ${size}` })).toBeInTheDocument()
  })
})

describe('predefined empty states', () => {
  it('NoVideosEmptyState fires upload and browse', async () => {
    const user = userEvent.setup()
    const onUpload = vi.fn()
    const onBrowse = vi.fn()
    render(<NoVideosEmptyState onUpload={onUpload} onBrowse={onBrowse} />)
    expect(screen.getByText('No videos uploaded yet')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Upload Video' }))
    await user.click(screen.getByRole('button', { name: 'Browse Templates' }))
    expect(onUpload).toHaveBeenCalled()
    expect(onBrowse).toHaveBeenCalled()
  })

  it('NoUsersEmptyState fires invite and import', async () => {
    const user = userEvent.setup()
    const onInvite = vi.fn()
    const onImport = vi.fn()
    render(<NoUsersEmptyState onInvite={onInvite} onImport={onImport} />)
    await user.click(screen.getByRole('button', { name: 'Invite Users' }))
    await user.click(screen.getByRole('button', { name: 'Import Data' }))
    expect(onInvite).toHaveBeenCalled()
    expect(onImport).toHaveBeenCalled()
  })

  it('NoSearchResultsEmptyState includes search query in description', async () => {
    const user = userEvent.setup()
    const onClearSearch = vi.fn()
    render(
      <NoSearchResultsEmptyState
        searchQuery="takedown"
        onClearSearch={onClearSearch}
      />
    )
    expect(screen.getByText(/takedown/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear Search' }))
    expect(onClearSearch).toHaveBeenCalled()
  })

  it('ErrorEmptyState fires retry', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<ErrorEmptyState onRetry={onRetry} />)
    await user.click(screen.getByRole('button', { name: 'Try Again' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('OfflineEmptyState fires retry connection', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<OfflineEmptyState onRetry={onRetry} />)
    expect(screen.getByText('Connection lost')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry Connection' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('MaintenanceEmptyState shows estimated time and branding', () => {
    render(<MaintenanceEmptyState estimatedTime="2:00 PM" />)
    expect(screen.getByText(/Expected completion: 2:00 PM/)).toBeInTheDocument()
    expect(
      screen.getByText('Evolution Combatives Professional Platform')
    ).toBeInTheDocument()
  })

  it('ComingSoonEmptyState uses feature name', () => {
    render(<ComingSoonEmptyState feature="Live Streaming" />)
    expect(
      screen.getByRole('heading', { name: 'Live Streaming Coming Soon' })
    ).toBeInTheDocument()
  })

  it('NoAnalyticsEmptyState fires refresh', async () => {
    const user = userEvent.setup()
    const onRefresh = vi.fn()
    render(<NoAnalyticsEmptyState onRefresh={onRefresh} />)
    await user.click(screen.getByRole('button', { name: 'Refresh Data' }))
    expect(onRefresh).toHaveBeenCalled()
  })
})
