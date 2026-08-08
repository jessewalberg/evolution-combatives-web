import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Shared screenshot options for the visual suite.
 * Keep Playwright's default pixel threshold; only disable animations and
 * mask known non-deterministic regions.
 */
export async function expectVisualScreenshot(
  page: Page,
  name: string,
  options?: {
    mask?: Locator[]
    fullPage?: boolean
  }
): Promise<void> {
  // Cap networkidle so pages with lingering polls cannot burn the full test timeout.
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined)
  // Node-side delay (real clock) so fake page timers cannot stall settle time.
  await new Promise((resolve) => setTimeout(resolve, 300))

  await expect(page).toHaveScreenshot(`${name}.png`, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: options?.fullPage ?? true,
    mask: options?.mask,
  })
}

/** Locators that commonly show live clocks / relative times. */
export function commonTimeMasks(page: Page): Locator[] {
  return [
    page.locator('text=/Last updated:/i'),
    page.locator('text=/\\d+[hm] ago/i'),
    page.locator('text=/Just now/i'),
  ]
}
