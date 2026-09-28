import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  cn,
  formatFileSize,
  formatDuration,
  formatDate,
  formatCurrency,
  getTierBadgeColor,
  getAdminRoleBadge,
  getVideoStatusColor,
  truncateText,
  generateInitials,
  isValidEmail,
  debounce,
  getTacticalStatusText,
  formatTierName,
} from '@/src/lib/utils'

describe('cn', () => {
  it('merges class names and resolves Tailwind conflicts', () => {
    expect(cn('px-4', 'px-6')).toContain('px-6')
    // eslint-disable-next-line no-constant-binary-expression -- exercising cn() falsy filtering
    expect(cn('px-4', false && 'hidden', 'block')).toContain('block')
  })
})

describe('formatFileSize', () => {
  it('formats zero and binary units', () => {
    expect(formatFileSize(0)).toBe('0 Bytes')
    // parseFloat strips trailing zeros from toFixed output
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1536000, 1)).toMatch(/MB/)
    expect(formatFileSize(2147483648, 2)).toBe('2 GB')
    expect(formatFileSize(1536, 1)).toBe('1.5 KB')
  })

  it('clamps negative decimals to 0', () => {
    expect(formatFileSize(2048, -1)).toBe('2 KB')
  })
})

describe('formatDuration', () => {
  it('formats seconds as MM:SS or HH:MM:SS', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(83)).toBe('1:23')
    expect(formatDuration(3665)).toBe('1:01:05')
  })

  it('returns 0:00 for negative input', () => {
    expect(formatDuration(-5)).toBe('0:00')
  })
})

describe('formatDate', () => {
  it('returns Invalid date for bad input', () => {
    expect(formatDate('not-a-date')).toBe('Invalid date')
  })

  it('formats short, long, and time', () => {
    const date = new Date('2024-01-15T14:30:00')
    expect(formatDate(date, 'short')).toMatch(/Jan/)
    expect(formatDate(date, 'long')).toMatch(/January/)
    expect(formatDate(date, 'time')).toMatch(/\d/)
  })

  it('formats relative times', () => {
    expect(formatDate(new Date(), 'relative')).toBe('Just now')
    expect(formatDate(Date.now() - 5 * 60 * 1000, 'relative')).toBe('5m ago')
    expect(formatDate(Date.now() - 3 * 60 * 60 * 1000, 'relative')).toBe('3h ago')
    expect(formatDate(Date.now() - 2 * 24 * 60 * 60 * 1000, 'relative')).toBe('2d ago')
    expect(formatDate(Date.now() - 10 * 24 * 60 * 60 * 1000, 'relative')).toMatch(/202/)
  })
})

describe('formatCurrency', () => {
  it('converts cents to USD currency string', () => {
    expect(formatCurrency(999)).toBe('$9.99')
    expect(formatCurrency(0)).toBe('$0.00')
    expect(formatCurrency(4900)).toBe('$49.00')
  })
})

describe('badge helpers', () => {
  it('maps tier badge colors', () => {
    expect(getTierBadgeColor('tier3')).toBe('warning')
    expect(getTierBadgeColor('tier2')).toBe('info')
    expect(getTierBadgeColor('tier1')).toBe('success')
    expect(getTierBadgeColor('none')).toBe('secondary')
  })

  it('maps admin role badges', () => {
    expect(getAdminRoleBadge('super_admin')).toEqual({ variant: 'error', text: 'Super Admin' })
    expect(getAdminRoleBadge('content_admin')).toEqual({ variant: 'primary', text: 'Content Admin' })
    expect(getAdminRoleBadge('support_admin')).toEqual({ variant: 'info', text: 'Support Admin' })
    expect(getAdminRoleBadge(null)).toEqual({ variant: 'secondary', text: 'User' })
  })

  it('maps video status colors', () => {
    expect(getVideoStatusColor('ready')).toBe('success')
    expect(getVideoStatusColor('processing')).toBe('warning')
    expect(getVideoStatusColor('uploading')).toBe('warning')
    expect(getVideoStatusColor('error')).toBe('error')
    expect(getVideoStatusColor('failed')).toBe('error')
  })
})

describe('truncateText', () => {
  it('returns original when under max', () => {
    expect(truncateText('short', 20)).toBe('short')
  })

  it('truncates with and without word preservation', () => {
    expect(truncateText('This is a long description', 20)).toBe('This is a long descr...')
    expect(truncateText('This is a long description', 20, true)).toBe('This is a long...')
  })
})

describe('generateInitials', () => {
  it('handles names, emails, and empty', () => {
    expect(generateInitials('John Doe')).toBe('JD')
    expect(generateInitials('John Michael Doe', 3)).toBe('JMD')
    expect(generateInitials('john@example.com')).toBe('J')
    expect(generateInitials('')).toBe('')
    expect(generateInitials('   ')).toBe('')
  })
})

describe('isValidEmail', () => {
  it('validates email formats', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
    expect(isValidEmail('user+tag@domain.co.uk')).toBe(true)
    expect(isValidEmail('invalid-email')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('delays invocation until quiet period', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 300)
    debounced('a')
    debounced('b')
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('b')
  })
})

describe('tactical / tier display', () => {
  it('maps tactical status text', () => {
    expect(getTacticalStatusText('ready')).toBe('Operational')
    expect(getTacticalStatusText('processing')).toBe('In Progress')
    expect(getTacticalStatusText('uploading')).toBe('Deploying')
    expect(getTacticalStatusText('error')).toBe('Mission Failed')
    expect(getTacticalStatusText('failed')).toBe('Mission Failed')
  })

  it('formats tier names', () => {
    expect(formatTierName('tier3')).toBe('Tier 3 Professional')
    expect(formatTierName('tier2')).toBe('Tier 2 Operator')
    expect(formatTierName('tier1')).toBe('Tier 1 Recruit')
    expect(formatTierName('none')).toBe('No Active Subscription')
  })
})
