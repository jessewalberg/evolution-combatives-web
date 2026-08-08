import { test } from '@playwright/test'
import { FIXTURE_IDS } from './fixtures'
import { prepareVisualPage } from './helpers/prepare'
import { expectVisualScreenshot } from './helpers/screenshot'
import { viewportLabel } from './helpers/viewport'

test.describe('@visual qa', () => {
  test('qa list populated @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'populated' })
    await page.goto('/qa')
    await page
      .getByText(/firearm retention/i)
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 })
    await expectVisualScreenshot(page, `qa-list-populated-${vp}`)
  })

  test('qa list empty @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'empty' })
    await page.goto('/qa')
    await page.getByRole('heading', { name: 'Q&A Management', exact: true }).waitFor({
      state: 'visible',
      timeout: 30_000,
    })
    await expectVisualScreenshot(page, `qa-list-empty-${vp}`)
  })

  test('qa detail @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'populated' })
    await page.goto(`/qa/${FIXTURE_IDS.question}`)
    await page
      .getByText(/firearm retention/i)
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 })
    await expectVisualScreenshot(page, `qa-detail-${vp}`)
  })
})
