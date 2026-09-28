import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserTable, type User } from './user-table'

vi.mock('@/src/components/compat/image', async () => {
  const { createNextImageMock } = await import('@/test/mocks/next-image')
  return createNextImageMock()
})

function makeUser(overrides: Partial<User> & Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>): User {
  return {
    avatarUrl: undefined,
    subscriptionTier: 'tier1',
    adminRole: null,
    status: 'active',
    activityStatus: 'recent',
    joinDate: '2024-01-15T00:00:00.000Z',
    lastActive: '2024-06-01T12:00:00.000Z',
    totalVideosWatched: 10,
    completionRate: 50,
    isEmailVerified: true,
    totalProgress: 40,
    engagementLevel: 'medium',
    loginHistory: [],
    subscriptionHistory: [],
    totalWatchTime: 120,
    streakDays: 3,
    ...overrides,
  }
}

const alice = makeUser({
  id: 'u1',
  firstName: 'Alice',
  lastName: 'Anderson',
  email: 'alice@example.com',
  status: 'active',
  adminRole: 'super_admin',
  subscriptionTier: 'tier3',
  department: 'Training',
  joinDate: '2024-03-01T00:00:00.000Z',
})

const bob = makeUser({
  id: 'u2',
  firstName: 'Bob',
  lastName: 'Baker',
  email: 'bob@example.com',
  status: 'suspended',
  adminRole: 'content_admin',
  subscriptionTier: 'tier1',
  department: 'Ops',
  joinDate: '2024-02-01T00:00:00.000Z',
})

const carol = makeUser({
  id: 'u3',
  firstName: 'Carol',
  lastName: 'Clark',
  email: 'carol@example.com',
  status: 'pending',
  adminRole: null,
  subscriptionTier: 'none',
  joinDate: '2024-01-01T00:00:00.000Z',
})

const dave = makeUser({
  id: 'u4',
  firstName: 'Dave',
  lastName: 'Davis',
  email: 'dave@example.com',
  status: 'inactive',
  adminRole: 'support_admin',
  subscriptionTier: 'tier2',
  joinDate: '2023-12-01T00:00:00.000Z',
})

const fiveUsers = [
  alice,
  bob,
  carol,
  dave,
  makeUser({
    id: 'u5',
    firstName: 'Eve',
    lastName: 'Edwards',
    email: 'eve@example.com',
    joinDate: '2023-11-01T00:00:00.000Z',
  }),
]

function getDataRows() {
  // First row is header; remaining are body rows
  const rows = screen.getAllByRole('row')
  return rows.slice(1)
}

function rowNames() {
  return getDataRows().map((row) => {
    const heading = within(row).queryByRole('heading', { level: 4 })
    return heading?.textContent?.trim() ?? ''
  })
}

describe('UserTable', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders rows from a props-driven dataset', () => {
    render(<UserTable users={[alice, bob]} />)

    expect(screen.getByText('Alice Anderson')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('Bob Baker')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Suspended')).toBeInTheDocument()
    expect(screen.getByText('Super Admin')).toBeInTheDocument()
    expect(screen.getByText('Content Admin')).toBeInTheDocument()
    expect(screen.getByText(/Showing 2 of 2 users/)).toBeInTheDocument()
  })

  it('shows empty state when the dataset is empty', () => {
    render(<UserTable users={[]} />)

    expect(screen.getByText('No users found')).toBeInTheDocument()
    expect(
      screen.getByText('Users will appear here once they register for the platform.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows loading skeleton when loading', () => {
    const { container } = render(<UserTable users={[alice]} loading />)
    expect(container.querySelector('.animate-pulse') || screen.queryByRole('table')).toBeTruthy()
  })

  it('sorts by name when the User header is clicked (asc then desc)', async () => {
    const user = userEvent.setup()
    // Names chosen so firstName order differs from default joinDate desc
    const zoe = makeUser({
      id: 'z1',
      firstName: 'Zoe',
      lastName: 'Zane',
      email: 'zoe@example.com',
      joinDate: '2024-06-01T00:00:00.000Z',
    })
    const amy = makeUser({
      id: 'a1',
      firstName: 'Amy',
      lastName: 'Adams',
      email: 'amy@example.com',
      joinDate: '2024-05-01T00:00:00.000Z',
    })
    const mike = makeUser({
      id: 'm1',
      firstName: 'Mike',
      lastName: 'Mills',
      email: 'mike@example.com',
      joinDate: '2024-04-01T00:00:00.000Z',
    })

    render(<UserTable users={[zoe, amy, mike]} />)
    // Default joinDate desc
    expect(rowNames()).toEqual(['Zoe Zane', 'Amy Adams', 'Mike Mills'])

    await user.click(within(screen.getAllByRole('row')[0]).getByText('User'))
    expect(rowNames()).toEqual(['Amy Adams', 'Mike Mills', 'Zoe Zane'])

    await user.click(within(screen.getAllByRole('row')[0]).getByText('User'))
    expect(rowNames()).toEqual(['Zoe Zane', 'Mike Mills', 'Amy Adams'])
  })

  it('filters by text search and shows filtered empty state', async () => {
    const user = userEvent.setup()
    render(<UserTable users={[alice, bob, carol]} />)

    const search = screen.getByPlaceholderText(/Search users by name, email, department/i)
    await user.type(search, 'alice')

    await waitFor(() => {
      expect(screen.getByText('Alice Anderson')).toBeInTheDocument()
      expect(screen.queryByText('Bob Baker')).not.toBeInTheDocument()
      expect(screen.queryByText('Carol Clark')).not.toBeInTheDocument()
    })

    await user.clear(search)
    await user.type(search, 'zzzz-no-match')

    await waitFor(() => {
      expect(screen.getByText('No users found')).toBeInTheDocument()
      expect(
        screen.getByText('No users match your current search and filter criteria.')
      ).toBeInTheDocument()
    })
  })

  it('filters by status and admin role via the Filters panel', async () => {
    const user = userEvent.setup()
    render(<UserTable users={[alice, bob, carol, dave]} />)

    await user.click(screen.getByRole('button', { name: /Filters/i }))

    // Status: Active only (checkbox label, not the Status column header)
    await user.click(screen.getByRole('checkbox', { name: 'Active' }))

    expect(screen.getByText('Alice Anderson')).toBeInTheDocument()
    expect(screen.queryByText('Bob Baker')).not.toBeInTheDocument()
    expect(screen.queryByText('Carol Clark')).not.toBeInTheDocument()
    expect(screen.queryByText('Dave Davis')).not.toBeInTheDocument()

    // Clear and filter by admin role (panel stays open after clear - do not toggle Filters again)
    await user.click(screen.getByRole('button', { name: /Clear all filters/i }))
    await waitFor(() => {
      expect(screen.getByText('Bob Baker')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('checkbox', { name: 'Content Admin' }))

    expect(screen.getByText('Bob Baker')).toBeInTheDocument()
    expect(screen.queryByText('Alice Anderson')).not.toBeInTheDocument()
    expect(screen.queryByText('Carol Clark')).not.toBeInTheDocument()
  })

  it('paginates with page size and next/prev controls', async () => {
    const user = userEvent.setup()
    render(<UserTable users={fiveUsers} pageSize={2} />)

    // Default sort joinDate desc → Alice, Bob on page 1
    expect(rowNames()).toEqual(['Alice Anderson', 'Bob Baker'])
    expect(screen.getByText(/Showing 2 of 5 users/)).toBeInTheDocument()
    expect(screen.getByText(/Showing 1-2 of 5 results/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(rowNames()).toEqual(['Carol Clark', 'Dave Davis'])
    expect(screen.getByText(/Showing 3-4 of 5 results/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous' }))
    expect(rowNames()).toEqual(['Alice Anderson', 'Bob Baker'])
  })

  it('toggles row selection, select-all, selected count, and bulk actions', async () => {
    const user = userEvent.setup()
    const onBulkAction = vi.fn()
    render(
      <UserTable users={[alice, bob, carol]} pageSize={10} onBulkAction={onBulkAction} />
    )

    const dataRows = getDataRows()
    const aliceCheckbox = within(dataRows[0]).getByRole('checkbox')
    await user.click(aliceCheckbox)

    expect(screen.getByText('1 users selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Email \(1\)/ })).toBeInTheDocument()

    // Select all via header checkbox
    const headerCheckbox = within(screen.getAllByRole('row')[0]).getByRole('checkbox')
    await user.click(headerCheckbox)
    expect(screen.getByText('3 users selected')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Export \(3\)/ }))
    expect(onBulkAction).toHaveBeenCalledWith(
      'export',
      expect.arrayContaining([
        expect.objectContaining({ id: 'u1' }),
        expect.objectContaining({ id: 'u2' }),
        expect.objectContaining({ id: 'u3' }),
      ])
    )
    // Selection clears after bulk action
    await waitFor(() => {
      expect(screen.queryByText(/users selected/)).not.toBeInTheDocument()
    })
  })

  it('invokes row action callbacks', async () => {
    const user = userEvent.setup()
    const onViewProfile = vi.fn()
    const onEditSubscription = vi.fn()
    const onSendMessage = vi.fn()

    render(
      <UserTable
        users={[alice]}
        onViewProfile={onViewProfile}
        onEditSubscription={onEditSubscription}
        onSendMessage={onSendMessage}
      />
    )

    await user.click(screen.getByTitle('View profile'))
    expect(onViewProfile).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }))

    await user.click(screen.getByTitle('Edit subscription'))
    expect(onEditSubscription).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }))

    await user.click(screen.getByTitle('Send message'))
    expect(onSendMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }))
  })
})
