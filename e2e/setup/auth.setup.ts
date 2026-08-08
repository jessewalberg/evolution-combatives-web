import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const authFile = path.join(__dirname, '../.auth/admin.json')

/**
 * Logs in once via the real /login UI and persists storageState for dependent projects.
 * Requires E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD (op:// / GitHub secrets - never hardcoded).
 */
setup('authenticate as admin', async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL
  const password = process.env.E2E_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error(
      'E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set for the auth setup project'
    )
  }

  fs.mkdirSync(path.dirname(authFile), { recursive: true })

  await page.goto('/login')
  await page.getByLabel(/email address/i).fill(email)
  await page.getByLabel(/^password$/i).fill(password)
  await page.getByRole('button', { name: /^sign in$/i }).click()

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })

  await page.context().storageState({ path: authFile })
})
