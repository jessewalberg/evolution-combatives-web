import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Badge,
  SubscriptionBadge,
  AdminRoleBadge,
  VideoStatusBadge,
  UserStatusBadge,
} from './badge'

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>Active</Badge>)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('renders an icon when provided', () => {
    render(<Badge icon={<span data-testid="badge-icon">★</span>}>Starred</Badge>)
    expect(screen.getByTestId('badge-icon')).toBeInTheDocument()
  })

  it('fires onBadgeClick when interactive', async () => {
    const user = userEvent.setup()
    const onBadgeClick = vi.fn()
    render(
      <Badge interactive onBadgeClick={onBadgeClick}>
        Clickable
      </Badge>
    )
    await user.click(screen.getByText('Clickable'))
    expect(onBadgeClick).toHaveBeenCalledTimes(1)
  })

  it('fires onClick when provided without interactive', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Badge onClick={onClick}>Plain</Badge>)
    await user.click(screen.getByText('Plain'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['default', /bg-muted/],
    ['primary', /bg-primary/],
    ['secondary', /bg-secondary/],
    ['success', /bg-green-600/],
    ['warning', /bg-yellow-600/],
    ['error', /bg-destructive/],
    ['info', /bg-blue-600/],
    ['gold', /from-amber-400/],
  ] as const)('applies variant=%s classes', (variant, classPattern) => {
    render(<Badge variant={variant}>{variant}</Badge>)
    expect(screen.getByText(variant).className).toMatch(classPattern)
  })

  it.each(['solid', 'outline', 'soft'] as const)(
    'renders appearance=%s',
    (appearance) => {
      render(
        <Badge appearance={appearance} variant="primary">
          {appearance}
        </Badge>
      )
      expect(screen.getByText(appearance)).toBeInTheDocument()
    }
  )

  it.each(['xs', 'sm', 'md', 'lg'] as const)('renders size=%s', (size) => {
    render(<Badge size={size}>{size}</Badge>)
    expect(screen.getByText(size)).toBeInTheDocument()
  })
})

describe('SubscriptionBadge', () => {
  it.each([
    ['none', 'Free'],
    ['tier1', 'T1'],
    ['tier2', 'T2'],
    ['tier3', 'T3'],
  ] as const)('renders tier=%s as %s', (tier, label) => {
    render(<SubscriptionBadge tier={tier} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})

describe('AdminRoleBadge', () => {
  it.each([
    ['super_admin', 'Super Admin'],
    ['content_admin', 'Content Admin'],
    ['support_admin', 'Support Admin'],
    ['user', 'User'],
  ] as const)('renders role=%s as %s', (role, label) => {
    render(<AdminRoleBadge role={role} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})

describe('VideoStatusBadge', () => {
  it.each([
    ['processing', 'Processing'],
    ['ready', 'Ready'],
    ['error', 'Error'],
    ['draft', 'Draft'],
    ['uploaded', 'Uploaded'],
    ['archived', 'Archived'],
  ] as const)('renders status=%s as %s', (status, label) => {
    render(<VideoStatusBadge status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})

describe('UserStatusBadge', () => {
  it.each([
    ['active', 'Active'],
    ['inactive', 'Inactive'],
    ['suspended', 'Suspended'],
    ['pending', 'Pending'],
  ] as const)('renders status=%s as %s', (status, label) => {
    render(<UserStatusBadge status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})
