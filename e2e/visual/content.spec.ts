import { test } from '@playwright/test'
import { FIXTURE_IDS } from './fixtures'
import { prepareVisualPage } from './helpers/prepare'
import { expectVisualScreenshot } from './helpers/screenshot'
import { viewportLabel } from './helpers/viewport'

/**
 * Content management pages under /dashboard/content/*.
 * Video edit uses server-only contentQueries in the browser and renders an
 * error state - still captured so regressions on that shell are visible.
 */

test.describe('@visual content', () => {
  test('disciplines populated @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'populated' })
    await page.goto('/dashboard/content/disciplines')
    await page.getByText(/law enforcement/i).first().waitFor({ timeout: 30_000 }).catch(() => undefined)
    await expectVisualScreenshot(page, `disciplines-populated-${vp}`)
  })

  test('disciplines empty @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'empty' })
    await page.goto('/dashboard/content/disciplines')
    await page.waitForTimeout(500)
    await expectVisualScreenshot(page, `disciplines-empty-${vp}`)
  })

  test('categories populated @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'populated' })
    await page.goto('/dashboard/content/categories')
    await page.getByText(/ground control/i).first().waitFor({ timeout: 30_000 }).catch(() => undefined)
    await expectVisualScreenshot(page, `categories-populated-${vp}`)
  })

  test('categories empty @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'empty' })
    await page.goto('/dashboard/content/categories')
    await page.waitForTimeout(500)
    await expectVisualScreenshot(page, `categories-empty-${vp}`)
  })

  test('videos populated @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'populated' })
    await page.goto('/dashboard/content/videos')
    await page
      .getByText(/defensive tactics/i)
      .first()
      .waitFor({ timeout: 30_000 })
      .catch(() => undefined)
    await expectVisualScreenshot(page, `videos-populated-${vp}`)
  })

  test('videos empty @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'empty' })
    await page.goto('/dashboard/content/videos')
    await page.waitForTimeout(500)
    await expectVisualScreenshot(page, `videos-empty-${vp}`)
  })

  test('processing populated @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'populated' })
    await page.goto('/dashboard/content/processing')
    await page.waitForTimeout(800)
    await expectVisualScreenshot(page, `processing-populated-${vp}`)
  })

  test('processing empty @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'empty' })
    await page.goto('/dashboard/content/processing')
    await page.waitForTimeout(800)
    await expectVisualScreenshot(page, `processing-empty-${vp}`)
  })

  test('video upload @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'populated' })
    await page.goto('/dashboard/content/videos/upload')
    await page
      .getByRole('heading', { name: /upload/i })
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 })
      .catch(() => undefined)
    await expectVisualScreenshot(page, `video-upload-${vp}`)
  })

  test('video edit @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'populated' })
    await page.goto(`/dashboard/content/videos/${FIXTURE_IDS.video}/edit`)
    await page.waitForTimeout(800)
    await expectVisualScreenshot(page, `video-edit-${vp}`)
  })

  test('video preview @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'populated' })
    await page.goto(`/dashboard/content/videos/${FIXTURE_IDS.video}/preview`)
    await page
      .getByText(/defensive tactics/i)
      .first()
      .waitFor({ timeout: 30_000 })
      .catch(() => undefined)
    await expectVisualScreenshot(page, `video-preview-${vp}`)
  })
})
