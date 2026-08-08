import { test } from '@playwright/test'
import { FIXTURE_IDS } from './fixtures'
import { prepareVisualPage } from './helpers/prepare'
import { expectVisualScreenshot } from './helpers/screenshot'
import { viewportLabel } from './helpers/viewport'

/**
 * Public pages - no admin storageState (set on visual-public-* projects).
 * Covered: login, sign-up, subscribe, subscription-success.
 * Skipped (not in issue #20 list): forgot-password, reset-password, auth/confirm, `/` redirect.
 */

test.describe('@visual public pages', () => {
  test.beforeEach(async ({ page }) => {
    await prepareVisualPage(page)
  })

  test('login @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await page.goto('/login')
    await page.getByLabel(/email address/i).waitFor({ state: 'visible', timeout: 30_000 })
    await expectVisualScreenshot(page, `login-${vp}`)
  })

  test('sign-up @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await page.goto('/sign-up')
    await page.getByRole('heading', { name: 'Create Account', exact: true }).waitFor({
      state: 'visible',
      timeout: 30_000,
    })
    await expectVisualScreenshot(page, `sign-up-${vp}`)
  })

  test('subscribe @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await page.goto(
      `/subscribe?userId=${FIXTURE_IDS.regularUser}&email=officer@test.evolutioncombatives.com`
    )
    await page.getByRole('heading', { name: 'Choose Your Training Level', exact: true }).waitFor({
      state: 'visible',
      timeout: 30_000,
    })
    await expectVisualScreenshot(page, `subscribe-${vp}`)
  })

  test('subscription-success @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await page.goto('/subscription-success?tier=tier2&session_id=cs_test_visual_001')
    await page.getByRole('heading', { name: 'Subscription Activated!', exact: true }).waitFor({
      state: 'visible',
      timeout: 30_000,
    })
    await expectVisualScreenshot(page, `subscription-success-${vp}`)
  })
})
