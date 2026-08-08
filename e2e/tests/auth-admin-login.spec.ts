import { test, expect } from '@playwright/test'

/**
 * Real shared admin secret is typed into the form via page.fill().
 * Playwright traces/videos record plaintext fill values (password fields are not
 * masked), so this file disables both at file level.
 *
 * Playwright rejects test.use({ trace/video }) inside any describe group (forces a
 * new worker). File-level use (or a dedicated config project) is required - same
 * constraint that led the setup project to override trace/video in playwright.config.
 */
test.use({
  storageState: { cookies: [], origins: [] },
  trace: 'off',
  video: 'off',
})

test('logs in valid admin and redirects to dashboard', async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL
  const password = process.env.E2E_ADMIN_PASSWORD
  test.skip(!email || !password, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set')

  await page.goto('/login')
  await page.getByLabel(/email address/i).fill(email!)
  await page.getByLabel(/^password$/i).fill(password!)
  await page.getByRole('button', { name: /^sign in$/i }).click()

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })
})
