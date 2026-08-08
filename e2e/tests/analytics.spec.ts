import { test, expect } from '@playwright/test'

/**
 * Analytics page is role-gated for super_admin / content_admin.
 * Sidebar marks it comingSoon, but the /analytics route still exists and renders charts.
 */
test.describe('Analytics', () => {
  test('page loads and chart containers render', async ({ page }) => {
    await page.goto('/analytics')
    await expect(page).toHaveURL(/\/analytics/)

    // Executive summary / heading signals
    await expect(
      page.getByText(/analytics|executive summary|revenue|total users/i).first()
    ).toBeVisible({ timeout: 30_000 })

    // Recharts renders SVG inside ResponsiveContainer
    await expect(page.locator('.recharts-responsive-container').first()).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.locator('svg.recharts-surface').first()).toBeVisible({
      timeout: 30_000,
    })
  })
})
