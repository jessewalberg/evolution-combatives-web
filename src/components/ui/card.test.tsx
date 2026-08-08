import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  StatsCard,
  ActionCard,
} from './card'

describe('Card', () => {
  it('renders children content', () => {
    render(
      <Card>
        <CardContent>Card body</CardContent>
      </Card>
    )
    expect(screen.getByText('Card body')).toBeInTheDocument()
  })

  it('fires onCardClick when interactive', async () => {
    const user = userEvent.setup()
    const onCardClick = vi.fn()
    render(
      <Card interactive onCardClick={onCardClick}>
        Clickable card
      </Card>
    )
    await user.click(screen.getByText('Clickable card'))
    expect(onCardClick).toHaveBeenCalledTimes(1)
  })

  it('applies default variant classes without elevated/interactive/bordered/glass markers', () => {
    render(<Card variant="default">default</Card>)
    const className = screen.getByText('default').className
    // shadow-sm appears in 4/5 variants; assert default via shared border token
    // plus absence of each other variant's distinctive class.
    expect(className).toMatch(/border-border/)
    expect(className).not.toMatch(/shadow-lg/)
    expect(className).not.toMatch(/cursor-pointer/)
    expect(className).not.toMatch(/border-neutral-600/)
    expect(className).not.toMatch(/backdrop-blur-sm/)
  })

  it.each([
    ['elevated', /shadow-lg/],
    ['interactive', /cursor-pointer/],
    ['bordered', /border-neutral-600/],
    ['glass', /backdrop-blur-sm/],
  ] as const)('applies variant=%s classes', (variant, classPattern) => {
    render(<Card variant={variant}>{variant}</Card>)
    expect(screen.getByText(variant).className).toMatch(classPattern)
  })

  it.each(['none', 'sm', 'default', 'lg'] as const)('renders padding=%s', (padding) => {
    render(<Card padding={padding}>{padding}</Card>)
    expect(screen.getByText(padding)).toBeInTheDocument()
  })
})

describe('Card composition', () => {
  it('renders header, title, description, content, and footer', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Analytics</CardTitle>
          <CardDescription>Last 30 days</CardDescription>
        </CardHeader>
        <CardContent>Chart content</CardContent>
        <CardFooter>
          <button type="button">Export</button>
        </CardFooter>
      </Card>
    )
    expect(screen.getByRole('heading', { name: 'Analytics' })).toBeInTheDocument()
    expect(screen.getByText('Last 30 days')).toBeInTheDocument()
    expect(screen.getByText('Chart content')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()
  })

  it.each(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const)(
    'CardTitle renders as %s',
    (level) => {
      render(<CardTitle level={level}>Title</CardTitle>)
      expect(screen.getByRole('heading', { level: Number(level[1]) })).toHaveTextContent(
        'Title'
      )
    }
  )
})

describe('StatsCard (from card.tsx)', () => {
  it('renders title, value, description, and positive trend', () => {
    render(
      <StatsCard
        title="Total Videos"
        value={42}
        description="Published content"
        trend={{ value: 12, isPositive: true }}
      />
    )
    expect(screen.getByText('Total Videos')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Published content')).toBeInTheDocument()
    expect(screen.getByText('12%')).toBeInTheDocument()
  })

  it('renders negative trend', () => {
    render(
      <StatsCard title="Churn" value={5} trend={{ value: 3, isPositive: false }} />
    )
    expect(screen.getByText('3%')).toBeInTheDocument()
  })
})

describe('ActionCard', () => {
  it('renders title, description, and fires action on click', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <ActionCard
        title="Upload Video"
        description="Add new training content"
        action={{ label: 'Get started', onClick }}
      />
    )
    expect(screen.getByText('Upload Video')).toBeInTheDocument()
    expect(screen.getByText('Add new training content')).toBeInTheDocument()
    expect(screen.getByText(/Get started/)).toBeInTheDocument()
    await user.click(screen.getByText('Upload Video'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
