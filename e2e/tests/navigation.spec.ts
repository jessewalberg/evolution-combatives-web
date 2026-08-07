import { test, expect } from '@playwright/test'

/**
 * Dashboard sidebar navigation.
 * Analytics and Q&A are disabled/comingSoon in admin-layout.tsx — assert disabled state,
 * do not expect navigation.
 */
test.describe('Dashboard navigation', () => {
  test('sidebar links navigate to enabled destinations', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard/)

    // Dashboard
    await page.getByRole('link', { name: /^dashboard$/i }).first().click()
    await expect(page).toHaveURL(/\/dashboard/)

    // Content children (Videos / Categories / Disciplines)
    // Expand Content if needed — children may already be visible for super_admin
    const contentTrigger = page.getByRole('button', { name: /^content$/i }).or(
      page.getByRole('link', { name: /^content$/i })
    )
    if (await contentTrigger.first().isVisible().catch(() => false)) {
      await contentTrigger.first().click()
    }

    await page.getByRole('link', { name: /^videos$/i }).first().click()
    await expect(page).toHaveURL(/\/dashboard\/content\/videos/)

    await page.getByRole('link', { name: /^categories$/i }).first().click()
    await expect(page).toHaveURL(/\/dashboard\/content\/categories/)

    await page.getByRole('link', { name: /^disciplines$/i }).first().click()
    await expect(page).toHaveURL(/\/dashboard\/content\/disciplines/)

    // Users
    await page.getByRole('link', { name: /^users$/i }).first().click()
    await expect(page).toHaveURL(/\/users/)
  })

  test('Analytics and Q&A sidebar items are disabled / coming soon', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page.getByText(/^analytics$/i).first()).toBeVisible()
    await expect(page.getByText(/^q&a$/i).first()).toBeVisible()

    // admin-layout renders Badge "Soon" for comingSoon items (not navigable links)
    await expect(page.getByText(/^soon$/i).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /^analytics$/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /^q&a$/i })).toHaveCount(0)
  })
})
