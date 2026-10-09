import { test } from '@playwright/test'
import { prepareVisualPage } from './helpers/prepare'
import { expectVisualScreenshot } from './helpers/screenshot'
import { viewportLabel } from './helpers/viewport'

/**
 * Analytics charts use Math.random in page code; installDeterminism seeds it.
 * Chart containers are also masked against Recharts layout jitter.
 */

test.describe('@visual analytics', () => {
  test('analytics populated @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'populated' })
    await page.goto('/analytics')
    await page
      .getByRole('heading', { name: /analytics/i })
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 })
    const chartMask = page.locator('.recharts-responsive-container, .recharts-wrapper')
    // Live metrics + system health values are computed during SSR, where the
    // browser-side Math.random seed cannot reach; mask them like the charts.
    const liveMask = page.locator('[data-testid="realtime-metrics"], [data-testid="system-health"]')
    const refreshMask = page.getByRole('button', { name: /auto refresh/i })
    await expectVisualScreenshot(page, `analytics-populated-${vp}`, {
      mask: [chartMask, liveMask, refreshMask],
    })
  })

  test('analytics empty @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'empty' })
    await page.goto('/analytics')
    await page
      .getByRole('heading', { name: /analytics/i })
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 })
    const chartMask = page.locator('.recharts-responsive-container, .recharts-wrapper')
    const liveMask = page.locator('[data-testid="realtime-metrics"], [data-testid="system-health"]')
    const refreshMask = page.getByRole('button', { name: /auto refresh/i })
    await expectVisualScreenshot(page, `analytics-empty-${vp}`, {
      mask: [chartMask, liveMask, refreshMask],
    })
  })
})
