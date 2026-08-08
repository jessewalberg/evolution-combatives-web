import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Spinner,
  LoadingOverlay,
  Skeleton,
  Progress,
  TableSkeleton,
  CardSkeleton,
  VideoGridSkeleton,
  LoadingButton,
} from './loading'

describe('Spinner', () => {
  it('has status role and default Loading label', () => {
    render(<Spinner />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('shows visible label when showLabel is true', () => {
    render(<Spinner label="Fetching data" showLabel />)
    // Visible label + sr-only duplicate both render the same text
    const labels = screen.getAllByText('Fetching data')
    expect(labels.length).toBeGreaterThanOrEqual(2)
    expect(labels.some((el) => el.classList.contains('sr-only'))).toBe(true)
    expect(labels.some((el) => !el.classList.contains('sr-only'))).toBe(true)
    expect(screen.getByRole('status', { name: 'Fetching data' })).toBeInTheDocument()
  })

  it.each(['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const)(
    'renders size=%s',
    (size) => {
      render(<Spinner size={size} aria-label={`spin-${size}`} />)
      expect(screen.getByRole('status')).toBeInTheDocument()
    }
  )
})

describe('LoadingOverlay', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(
      <LoadingOverlay isVisible={false} message="Working..." />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows message and spinner when visible', () => {
    render(<LoadingOverlay isVisible message="Processing video..." />)
    expect(screen.getByText('Processing video...')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('Skeleton', () => {
  it('renders a single skeleton block', () => {
    const { container } = render(<Skeleton data-testid="skel" />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders multiple lines when lines > 1', () => {
    const { container } = render(<Skeleton lines={3} />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3)
  })
})

describe('Progress', () => {
  it('exposes progressbar role with value attributes', () => {
    render(<Progress value={40} max={100} label="Upload" showValue />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '40')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(screen.getByText('40%')).toBeInTheDocument()
    expect(screen.getByText('Upload')).toBeInTheDocument()
  })

  it('clamps percentage display at 100', () => {
    render(<Progress value={150} max={100} showValue />)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('supports indeterminate mode', () => {
    render(<Progress value={0} indeterminate aria-label="Indeterminate" />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
})

describe('specialized skeletons', () => {
  it('TableSkeleton renders header and body rows', () => {
    const { container } = render(
      <TableSkeleton rows={2} columns={3} showHeader />
    )
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(5)
  })

  it('CardSkeleton can show avatar and image', () => {
    const { container } = render(
      <CardSkeleton showAvatar showImage lines={2} />
    )
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(3)
  })

  it('VideoGridSkeleton renders requested count', () => {
    const { container } = render(<VideoGridSkeleton count={3} columns={3} />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(6)
  })
})

describe('LoadingButton', () => {
  it('fires click when not loading', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<LoadingButton onClick={onClick}>Save</LoadingButton>)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('disables and shows loading text while loading', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <LoadingButton isLoading loadingText="Saving..." onClick={onClick}>
        Save
      </LoadingButton>
    )
    const button = screen.getByRole('button', { name: /Saving/ })
    expect(button).toBeDisabled()
    expect(screen.getByText('Saving...')).toBeInTheDocument()
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})
