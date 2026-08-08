import { test } from '@playwright/test'
import { prepareVisualPage } from './helpers/prepare'
import { commonTimeMasks, expectVisualScreenshot } from './helpers/screenshot'
import { viewportLabel } from './helpers/viewport'

test.describe('@visual dashboard', () => {
  test('dashboard home populated @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'populated' })
    await page.goto('/dashboard')
    await page.getByRole('heading', { name: 'Dashboard Overview', exact: true }).waitFor({
      state: 'visible',
      timeout: 30_000,
    })
    await expectVisualScreenshot(page, `dashboard-home-populated-${vp}`, {
      mask: commonTimeMasks(page),
    })
  })

  test('dashboard home empty metrics @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'empty' })
    await page.goto('/dashboard')
    await page.getByRole('heading', { name: 'Dashboard Overview', exact: true }).waitFor({
      state: 'visible',
      timeout: 30_000,
    })
    await expectVisualScreenshot(page, `dashboard-home-empty-${vp}`, {
      mask: commonTimeMasks(page),
    })
  })
})
