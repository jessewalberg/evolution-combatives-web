import { test } from '@playwright/test'
import { FIXTURE_IDS } from './fixtures'
import { prepareVisualPage } from './helpers/prepare'
import { expectVisualScreenshot } from './helpers/screenshot'
import { viewportLabel } from './helpers/viewport'

test.describe('@visual users', () => {
  test('users list populated @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'populated' })
    await page.goto('/users')
    await page
      .getByText(/jane officer|officer@test/i)
      .first()
      .waitFor({ timeout: 30_000 })
      .catch(() => undefined)
    await expectVisualScreenshot(page, `users-list-populated-${vp}`)
  })

  test('users list empty @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'empty' })
    await page.goto('/users')
    await page.waitForTimeout(500)
    await expectVisualScreenshot(page, `users-list-empty-${vp}`)
  })

  test('users detail @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'populated' })
    await page.goto(`/users/${FIXTURE_IDS.regularUser}`)
    await page
      .getByText(/jane officer/i)
      .first()
      .waitFor({ timeout: 30_000 })
      .catch(() => undefined)
    await expectVisualScreenshot(page, `users-detail-${vp}`)
  })
})
