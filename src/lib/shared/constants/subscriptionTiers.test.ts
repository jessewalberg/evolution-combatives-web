import { describe, it, expect } from 'vitest'
import {
  hasAccessToDiscipline,
  hasAccessToContent,
  getTierLevel,
  canAccessTier,
  getUpgradePath,
  getTierPrice,
  getTierFeatures,
  SUBSCRIPTION_TIERS,
  CONTENT_ACCESS_BY_TIER,
} from './subscriptionTiers'

describe('hasAccessToDiscipline', () => {
  it('allows everyone when discipline requires none', () => {
    expect(hasAccessToDiscipline('none', 'none')).toBe(true)
    expect(hasAccessToDiscipline('tier1', 'none')).toBe(true)
  })

  it('enforces hierarchy', () => {
    expect(hasAccessToDiscipline('tier2', 'tier1')).toBe(true)
    expect(hasAccessToDiscipline('tier1', 'tier2')).toBe(false)
    expect(hasAccessToDiscipline('tier3', 'tier3')).toBe(true)
  })
})

describe('hasAccessToContent', () => {
  it('checks discipline and category access maps', () => {
    expect(hasAccessToContent('none', 'discipline', 'law_enforcement')).toBe(true)
    expect(hasAccessToContent('none', 'discipline', 'jiujitsu')).toBe(false)
    expect(hasAccessToContent('tier1', 'category', 'fundamentals')).toBe(true)
    expect(hasAccessToContent('tier1', 'category', 'tactical')).toBe(false)
    expect(CONTENT_ACCESS_BY_TIER.tier3.disciplines).toContain('law_enforcement')
  })
})

describe('tier helpers', () => {
  it('getTierLevel returns hierarchy numbers', () => {
    expect(getTierLevel('none')).toBe(0)
    expect(getTierLevel('tier1')).toBe(1)
    expect(getTierLevel('tier2')).toBe(2)
    expect(getTierLevel('tier3')).toBe(3)
  })

  it('canAccessTier handles null and hierarchy', () => {
    expect(canAccessTier(null, 'tier1')).toBe(false)
    expect(canAccessTier('tier2', 'tier1')).toBe(true)
    expect(canAccessTier('tier1', 'tier3')).toBe(false)
  })

  it('getUpgradePath returns remaining tiers', () => {
    expect(getUpgradePath(SUBSCRIPTION_TIERS.NONE)).toEqual(['tier1', 'tier2', 'tier3'])
    expect(getUpgradePath('tier1')).toEqual(['tier2', 'tier3'])
    expect(getUpgradePath('tier2')).toEqual(['tier3'])
    expect(getUpgradePath('tier3')).toEqual([])
  })

  it('getTierPrice and getTierFeatures return pricing/features', () => {
    expect(getTierPrice('none')).toBe(0)
    expect(getTierPrice('tier1')).toBe(19)
    expect(getTierPrice('tier2')).toBe(29)
    expect(getTierPrice('tier3')).toBe(39)

    expect(getTierFeatures('tier1')).toContain('Progress tracking')
    expect(getTierFeatures('tier3').length).toBeGreaterThan(getTierFeatures('none').length)
  })
})
