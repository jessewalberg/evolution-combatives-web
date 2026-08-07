import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  StatsCard,
  StatsCardGrid,
  CompactStatsRow,
  formatMetricValue,
  calculatePercentageChange,
  getTrendDirection,
  getTimePeriodLabel,
} from './stats-card'
import { UsersIcon } from '@heroicons/react/24/outline'

describe('formatMetricValue / helpers', () => {
  it('formats currency, percentage, count, decimal, and string passthrough', () => {
    expect(formatMetricValue(12.5, 'percentage')).toBe('12.5%')
    expect(formatMetricValue(1000, 'count')).toBe('1,000')
    expect(formatMetricValue(3.14159, 'decimal')).toBe('3.14')
    expect(formatMetricValue('N/A', 'count')).toBe('N/A')
    expect(formatMetricValue(10, 'currency')).toMatch(/\$/)
  })

  it('calculates percentage change and trend direction', () => {
    expect(calculatePercentageChange(110, 100)).toBeCloseTo(10)
    expect(calculatePercentageChange(50, 0)).toBe(100)
    expect(calculatePercentageChange(0, 0)).toBe(0)
    expect(getTrendDirection(5)).toBe('up')
    expect(getTrendDirection(-5)).toBe('down')
    expect(getTrendDirection(0.05)).toBe('neutral')
  })

  it('returns period labels', () => {
    expect(getTimePeriodLabel('month')).toBe('vs last month')
    expect(getTimePeriodLabel('custom', 'vs Q1')).toBe('vs Q1')
  })
})

describe('StatsCard', () => {
  it('renders title and formatted count value', () => {
    render(
      <StatsCard title="Active Users" value={1247} metricType="count" />
    )
    expect(screen.getByRole('heading', { name: 'Active Users' })).toBeInTheDocument()
    expect(screen.getByText('1,247')).toBeInTheDocument()
  })

  it('shows calculated trend from previousValue', () => {
    render(
      <StatsCard
        title="Revenue"
        value={110}
        previousValue={100}
        metricType="count"
        timePeriod="month"
      />
    )
    expect(screen.getByText('10.0%')).toBeInTheDocument()
    expect(screen.getByText('vs last month')).toBeInTheDocument()
  })

  it('uses explicit percentageChange and trend', () => {
    render(
      <StatsCard
        title="Growth"
        value={50}
        percentageChange={-8.5}
        trend="down"
        variant="growth"
      />
    )
    expect(screen.getByText('8.5%')).toBeInTheDocument()
  })

  it('formats currency metricType', () => {
    render(
      <StatsCard title="MRR" value={100} metricType="currency" variant="revenue" />
    )
    expect(screen.getByText(/\$/)).toBeInTheDocument()
  })

  it('formats percentage metricType', () => {
    render(
      <StatsCard title="Conversion" value={12.34} metricType="percentage" />
    )
    expect(screen.getByText('12.3%')).toBeInTheDocument()
  })

  it('shows loading skeleton when isLoading', () => {
    const { container } = render(
      <StatsCard title="Loading" value={0} isLoading />
    )
    expect(screen.queryByText('Loading')).not.toBeInTheDocument()
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('is clickable via mouse and keyboard when onClick provided', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <StatsCard title="Clickable" value={1} onClick={onClick} icon={UsersIcon} />
    )
    const card = screen.getByRole('button')
    await user.click(card)
    expect(onClick).toHaveBeenCalledTimes(1)
    card.focus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(2)
    await user.keyboard(' ')
    expect(onClick).toHaveBeenCalledTimes(3)
  })

  it('renders subtitle and custom period label', () => {
    render(
      <StatsCard
        title="Sessions"
        value={10}
        subtitle="Unique visitors"
        timePeriod="custom"
        customPeriodLabel="vs campaign"
        previousValue={5}
      />
    )
    expect(screen.getByText('Unique visitors')).toBeInTheDocument()
    expect(screen.getByText('vs campaign')).toBeInTheDocument()
  })

  it.each(['sm', 'default', 'lg'] as const)('renders size=%s', (size) => {
    render(<StatsCard title="Sized" value={1} size={size} />)
    expect(screen.getByText('Sized')).toBeInTheDocument()
  })
})

describe('StatsCardGrid', () => {
  it('renders children in a grid', () => {
    render(
      <StatsCardGrid columns={2}>
        <StatsCard title="A" value={1} />
        <StatsCard title="B" value={2} />
      </StatsCardGrid>
    )
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })
})

describe('CompactStatsRow', () => {
  it('renders stats with trend indicators', () => {
    render(
      <CompactStatsRow
        stats={[
          { label: 'Users', value: 100, change: 5, trend: 'up' },
          { label: 'Views', value: 200, metricType: 'count' },
        ]}
      />
    )
    expect(screen.getByText('Users')).toBeInTheDocument()
    expect(screen.getByText('Views')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('5.0%')).toBeInTheDocument()
  })
})
