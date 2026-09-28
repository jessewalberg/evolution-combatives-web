import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Avatar, AvatarGroup } from './avatar'

vi.mock('@/src/components/compat/image', async () => {
  const { createNextImageMock } = await import('@/test/mocks/next-image')
  return createNextImageMock()
})

describe('Avatar', () => {
  it('renders initials from name with accessible label', () => {
    render(<Avatar name="John Smith" />)
    expect(screen.getByLabelText('Avatar for John Smith')).toBeInTheDocument()
    expect(screen.getByText('JS')).toBeInTheDocument()
  })

  it('uses custom alt when provided', () => {
    render(<Avatar name="Jane Doe" alt="Profile photo" />)
    expect(screen.getByLabelText('Profile photo')).toBeInTheDocument()
  })

  it('shows status indicator with aria-label', () => {
    render(<Avatar name="Online User" status="online" />)
    expect(screen.getByLabelText('Status: online')).toBeInTheDocument()
  })

  it.each(['online', 'offline', 'away', 'busy'] as const)(
    'renders status=%s',
    (status) => {
      render(<Avatar name="User" status={status} />)
      expect(screen.getByLabelText(`Status: ${status}`)).toBeInTheDocument()
    }
  )

  it.each(['super_admin', 'content_admin', 'support_admin'] as const)(
    'renders role badge for %s',
    (role) => {
      render(<Avatar name="Admin" role={role} />)
      expect(
        screen.getByLabelText(`Role: ${role.replace('_', ' ')}`)
      ).toBeInTheDocument()
    }
  )

  it('fires onAvatarClick when interactive', async () => {
    const user = userEvent.setup()
    const onAvatarClick = vi.fn()
    render(
      <Avatar name="Click Me" interactive onAvatarClick={onAvatarClick} />
    )
    const avatar = screen.getByRole('button', { name: /Avatar for Click Me/ })
    await user.click(avatar)
    expect(onAvatarClick).toHaveBeenCalledTimes(1)
  })

  it('is keyboard-activatable when interactive', async () => {
    const user = userEvent.setup()
    const onAvatarClick = vi.fn()
    render(
      <Avatar name="Key User" interactive onAvatarClick={onAvatarClick} />
    )
    const avatar = screen.getByRole('button', { name: /Avatar for Key User/ })
    avatar.focus()
    await user.keyboard('{Enter}')
    expect(onAvatarClick).toHaveBeenCalledTimes(1)
    await user.keyboard(' ')
    expect(onAvatarClick).toHaveBeenCalledTimes(2)
  })

  it('fires onClick via keyboard when interactive without onAvatarClick', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Avatar name="Click Prop" interactive onClick={onClick} />)
    const avatar = screen.getByRole('button', { name: /Avatar for Click Prop/ })
    avatar.focus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
    await user.keyboard(' ')
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('delivers a genuine MouseEvent to onClick on keyboard activation, not a fabricated one', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Avatar name="Real Event" interactive onClick={onClick} />)
    const avatar = screen.getByRole('button', { name: /Avatar for Real Event/ })
    avatar.focus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
    const event = onClick.mock.calls[0][0]
    expect(event.type).toBe('click')
    expect(event.nativeEvent).toBeInstanceOf(MouseEvent)
  })

  it('shows loading spinner and hides status/role while loading', () => {
    const { container } = render(
      <Avatar
        name="Loading"
        loading
        status="online"
        role="super_admin"
      />
    )
    expect(container.querySelector('svg.animate-spin')).toBeInTheDocument()
    expect(screen.queryByLabelText('Status: online')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Role:/)).not.toBeInTheDocument()
  })

  it.each(['xs', 'sm', 'default', 'lg', 'xl'] as const)(
    'renders size=%s',
    (size) => {
      render(<Avatar name="Sized" size={size} />)
      expect(screen.getByLabelText('Avatar for Sized')).toBeInTheDocument()
    }
  )

  it('renders image element when src is provided', () => {
    render(<Avatar name="With Image" src="/avatars/user.jpg" />)
    expect(screen.getByRole('img', { name: 'With Image' })).toHaveAttribute(
      'src',
      '/avatars/user.jpg'
    )
  })
})

describe('AvatarGroup', () => {
  const avatars = [
    { name: 'Alice' },
    { name: 'Bob' },
    { name: 'Carol' },
    { name: 'Dave' },
    { name: 'Eve' },
  ]

  it('shows overflow count when avatars exceed max', () => {
    render(<AvatarGroup avatars={avatars} max={3} />)
    expect(screen.getByLabelText('2 more users')).toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('fires onAvatarClick with index and avatar data', async () => {
    const user = userEvent.setup()
    const onAvatarClick = vi.fn()
    render(
      <AvatarGroup
        avatars={avatars.slice(0, 2)}
        interactive
        onAvatarClick={onAvatarClick}
      />
    )
    await user.click(screen.getByLabelText('Avatar for Alice'))
    expect(onAvatarClick).toHaveBeenCalledWith(0, expect.objectContaining({ name: 'Alice' }))
  })

  it('fires onOverflowClick when overflow badge is clicked', async () => {
    const user = userEvent.setup()
    const onOverflowClick = vi.fn()
    render(
      <AvatarGroup avatars={avatars} max={2} onOverflowClick={onOverflowClick} />
    )
    await user.click(screen.getByLabelText('3 more users'))
    expect(onOverflowClick).toHaveBeenCalledTimes(1)
  })
})
