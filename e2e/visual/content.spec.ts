import { test } from '@playwright/test'
import { FIXTURE_IDS } from './fixtures'
import { prepareVisualPage } from './helpers/prepare'
import { expectVisualScreenshot } from './helpers/screenshot'
import { viewportLabel } from './helpers/viewport'

/**
 * Content management pages under /dashboard/content/*.
 * Every readiness wait below is a real (non-swallowed) assertion so a page
 * that crashes or never finishes loading fails the test loudly instead of
 * silently screenshotting broken content.
 */

test.describe('@visual content', () => {
  test('disciplines populated @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'populated' })
    await page.goto('/dashboard/content/disciplines')
    await page.getByText(/law enforcement/i).first().waitFor({ state: 'visible', timeout: 30_000 })
    await expectVisualScreenshot(page, `disciplines-populated-${vp}`)
  })

  test('disciplines empty @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'empty' })
    await page.goto('/dashboard/content/disciplines')
    await page.getByRole('heading', { name: 'Disciplines', exact: true }).waitFor({
      state: 'visible',
      timeout: 30_000,
    })
    await expectVisualScreenshot(page, `disciplines-empty-${vp}`)
  })

  test('disciplines error @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'error' })
    await page.goto('/dashboard/content/disciplines')
    await page.getByText(/failed to load disciplines/i).waitFor({
      state: 'visible',
      timeout: 30_000,
    })
    await expectVisualScreenshot(page, `disciplines-error-${vp}`)
  })

  test('categories populated @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'populated' })
    await page.goto('/dashboard/content/categories')
    await page.getByText(/ground control/i).first().waitFor({ state: 'visible', timeout: 30_000 })
    await expectVisualScreenshot(page, `categories-populated-${vp}`)
  })

  test('categories empty @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'empty' })
    await page.goto('/dashboard/content/categories')
    await page.getByRole('heading', { name: 'Categories', exact: true }).waitFor({
      state: 'visible',
      timeout: 30_000,
    })
    await expectVisualScreenshot(page, `categories-empty-${vp}`)
  })

  test('categories error @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'error' })
    await page.goto('/dashboard/content/categories')
    await page.getByText(/failed to load categories/i).waitFor({
      state: 'visible',
      timeout: 30_000,
    })
    await expectVisualScreenshot(page, `categories-error-${vp}`)
  })

  test('videos populated @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'populated' })
    await page.goto('/dashboard/content/videos')
    await page
      .getByText(/defensive tactics/i)
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 })
    await expectVisualScreenshot(page, `videos-populated-${vp}`)
  })

  test('videos empty @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'empty' })
    await page.goto('/dashboard/content/videos')
    await page.getByRole('heading', { name: 'Video Library', exact: true }).waitFor({
      state: 'visible',
      timeout: 30_000,
    })
    await expectVisualScreenshot(page, `videos-empty-${vp}`)
  })

  test('processing populated @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'populated' })
    await page.goto('/dashboard/content/processing')
    await page.getByRole('heading', { name: 'Video Processing Monitor', exact: true }).waitFor({
      state: 'visible',
      timeout: 30_000,
    })
    await expectVisualScreenshot(page, `processing-populated-${vp}`)
  })

  test('processing empty @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'empty' })
    await page.goto('/dashboard/content/processing')
    await page.getByRole('heading', { name: 'Video Processing Monitor', exact: true }).waitFor({
      state: 'visible',
      timeout: 30_000,
    })
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
    await expectVisualScreenshot(page, `video-upload-${vp}`)
  })

  test('video edit @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'populated' })
    await page.goto(`/dashboard/content/videos/${FIXTURE_IDS.video}/edit`)
    await page.getByRole('heading', { name: 'Edit Video', exact: true }).waitFor({
      state: 'visible',
      timeout: 30_000,
    })
    await expectVisualScreenshot(page, `video-edit-${vp}`)
  })

  test('video preview @visual', async ({ page }, testInfo) => {
    const vp = viewportLabel(testInfo.project.name)
    await prepareVisualPage(page, { mode: 'populated' })
    await page.goto(`/dashboard/content/videos/${FIXTURE_IDS.video}/preview`)
    await page
      .getByText(/defensive tactics/i)
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 })
    await expectVisualScreenshot(page, `video-preview-${vp}`)
  })
})
