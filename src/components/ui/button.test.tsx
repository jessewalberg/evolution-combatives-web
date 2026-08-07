import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './button'

describe('Button', () => {
  it('renders a button with default role and text', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('fires onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click me</Button>)
    await user.click(screen.getByRole('button', { name: 'Click me' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire onClick when disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>
    )
    const button = screen.getByRole('button', { name: 'Disabled' })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('shows loading spinner and disables interaction while loading', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const { container } = render(
      <Button loading loadingText="Uploading..." onClick={onClick}>
        Upload
      </Button>
    )
    const button = screen.getByRole('button', { name: /Uploading/ })
    expect(button).toBeDisabled()
    expect(screen.getByText('Uploading...')).toBeInTheDocument()
    expect(container.querySelector('svg.animate-spin')).toBeInTheDocument()
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders left and right icons when not loading', () => {
    render(
      <Button
        leftIcon={<span data-testid="left-icon">L</span>}
        rightIcon={<span data-testid="right-icon">R</span>}
      >
        Export
      </Button>
    )
    expect(screen.getByTestId('left-icon')).toBeInTheDocument()
    expect(screen.getByTestId('right-icon')).toBeInTheDocument()
  })

  it('hides left/right icons while loading', () => {
    render(
      <Button
        loading
        leftIcon={<span data-testid="left-icon">L</span>}
        rightIcon={<span data-testid="right-icon">R</span>}
      >
        Export
      </Button>
    )
    expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument()
    expect(screen.queryByTestId('right-icon')).not.toBeInTheDocument()
  })

  it.each([
    'primary',
    'secondary',
    'outline',
    'ghost',
    'destructive',
    'success',
    'warning',
  ] as const)('renders variant=%s without crashing', (variant) => {
    render(<Button variant={variant}>{variant}</Button>)
    expect(screen.getByRole('button', { name: variant })).toBeInTheDocument()
  })

  it.each(['xs', 'sm', 'default', 'lg', 'xl', 'icon'] as const)(
    'renders size=%s',
    (size) => {
      render(
        <Button size={size} aria-label={size === 'icon' ? 'Icon action' : undefined}>
          {size === 'icon' ? 'X' : size}
        </Button>
      )
      expect(screen.getByRole('button')).toBeInTheDocument()
    }
  )

  it('activates via keyboard Enter/Space', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Keyboard</Button>)
    const button = screen.getByRole('button', { name: 'Keyboard' })
    button.focus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
    await user.keyboard(' ')
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('supports type="submit"', () => {
    render(<Button type="submit">Submit</Button>)
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute(
      'type',
      'submit'
    )
  })
})
