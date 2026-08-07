import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Breadcrumb, BreadcrumbProvider, useBreadcrumbContext } from './breadcrumb'

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
    className?: string
    onClick?: () => void
    title?: string
    'aria-current'?: React.AriaAttributes['aria-current']
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const items = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Content', href: '/admin/content' },
  { label: 'Videos', href: '/dashboard/content/videos' },
  { label: 'Upload New Video', isCurrent: true },
]

describe('Breadcrumb', () => {
  it('renders navigation with aria-label', () => {
    render(<Breadcrumb items={items} />)
    expect(
      screen.getByRole('navigation', { name: 'Breadcrumb navigation' })
    ).toBeInTheDocument()
  })

  it('marks the current page with aria-current', () => {
    render(<Breadcrumb items={items} maxItems={10} />)
    expect(screen.getByText('Upload New Video').closest('[aria-current="page"]')).toBeTruthy()
  })

  it('renders links for items with href', () => {
    render(<Breadcrumb items={items} maxItems={10} />)
    expect(screen.getByRole('link', { name: /Dashboard/ })).toHaveAttribute(
      'href',
      '/admin'
    )
    expect(screen.getByRole('link', { name: /Content/ })).toHaveAttribute(
      'href',
      '/admin/content'
    )
  })

  it('calls onItemClick when a link is clicked', async () => {
    const user = userEvent.setup()
    const onItemClick = vi.fn()
    render(<Breadcrumb items={items} maxItems={10} onItemClick={onItemClick} />)
    await user.click(screen.getByRole('link', { name: /Dashboard/ }))
    expect(onItemClick).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Dashboard' }),
      0
    )
  })

  it('collapses middle items when exceeding maxItems and expands on click', async () => {
    const user = userEvent.setup()
    const longItems = [
      { label: 'Home', href: '/' },
      { label: 'Level1', href: '/1' },
      { label: 'Level2', href: '/2' },
      { label: 'Level3', href: '/3' },
      { label: 'Current', isCurrent: true },
    ]
    render(<Breadcrumb items={longItems} maxItems={3} />)

    expect(screen.queryByText('Level1')).not.toBeInTheDocument()
    // maxItems=3 => first + ellipsis + last; middle 3 items are collapsed
    const expand = screen.getByRole('button', {
      name: /Expand 3 hidden breadcrumb items/,
    })
    await user.click(expand)
    expect(screen.getByText('Level1')).toBeInTheDocument()
    expect(screen.getByText('Level2')).toBeInTheDocument()
    expect(screen.getByText('Level3')).toBeInTheDocument()
  })

  it('returns null for empty items', () => {
    const { container } = render(<Breadcrumb items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('hides home icon when showHomeIcon is false', () => {
    render(
      <Breadcrumb
        items={[{ label: 'Only', href: '/' }]}
        showHomeIcon={false}
      />
    )
    expect(screen.getByRole('link', { name: 'Only' })).toBeInTheDocument()
  })

  it.each(['sm', 'md', 'lg'] as const)('renders size=%s', (size) => {
    render(<Breadcrumb items={[{ label: 'Home', href: '/' }]} size={size} />)
    expect(
      screen.getByRole('navigation', { name: 'Breadcrumb navigation' })
    ).toBeInTheDocument()
  })
})

describe('BreadcrumbProvider', () => {
  function Consumer() {
    const { items: ctxItems, addItem, setCurrentPage } = useBreadcrumbContext()
    return (
      <div>
        <ul>
          {ctxItems.map((item) => (
            <li key={item.label}>{item.label}</li>
          ))}
        </ul>
        <button type="button" onClick={() => addItem({ label: 'Added', href: '/a' })}>
          Add
        </button>
        <button type="button" onClick={() => setCurrentPage('Current')}>
          Set Current
        </button>
      </div>
    )
  }

  it('provides breadcrumb state to consumers', async () => {
    const user = userEvent.setup()
    render(
      <BreadcrumbProvider initialItems={[{ label: 'Root', href: '/' }]}>
        <Consumer />
      </BreadcrumbProvider>
    )
    expect(screen.getByText('Root')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByText('Added')).toBeInTheDocument()
  })

  it('throws when useBreadcrumbContext is used outside provider', () => {
    const Spy = () => {
      useBreadcrumbContext()
      return null
    }
    expect(() => render(<Spy />)).toThrow(
      'useBreadcrumbContext must be used within a BreadcrumbProvider'
    )
  })
})
