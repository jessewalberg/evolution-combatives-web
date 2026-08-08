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
    await page.waitForTimeout(1000)
    const chartMask = page.locator('.recharts-responsive-container, .recharts-wrapper')
    await expectVisualScreenshot(page, `analytics-populated-${vp}`, {
      mask: [chartMask],
    })
  })

  test('analytics empty @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'empty' })
    await page.goto('/analytics')
    await page.waitForTimeout(1000)
    const chartMask = page.locator('.recharts-responsive-container, .recharts-wrapper')
    await expectVisualScreenshot(page, `analytics-empty-${vp}`, {
      mask: [chartMask],
    })
  })
})
