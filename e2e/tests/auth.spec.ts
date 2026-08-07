import { test, expect } from '@playwright/test'
import { uniqueEmail, uniqueSuffix } from '../helpers/unique'
import { createServiceRoleClient } from '../helpers/supabase-admin'
import { deleteAuthUser } from '../helpers/api'

/**
 * Unauthenticated auth flows — clear storageState so setup admin session is not reused.
 */
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Auth — login', () => {
  test('rejects invalid credentials with inline error', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email address/i).fill(`invalid-${uniqueSuffix()}@example.com`)
    await page.getByLabel(/^password$/i).fill('WrongPass1!')
    await page.getByRole('button', { name: /^sign in$/i }).click()

    await expect(
      page.getByText(/invalid email or password/i)
    ).toBeVisible({ timeout: 15_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('rejects non-admin user after successful password auth', async ({ page }) => {
    const email = uniqueEmail('nonadmin')
    const password = `E2eTemp1!${uniqueSuffix().slice(0, 6)}`
    const supabase = createServiceRoleClient()

    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Non Admin' },
    })
    expect(error).toBeNull()
    const userId = created.user!.id

    try {
      // Ensure no admin_role on profile
      await supabase
        .from('profiles')
        .upsert({ id: userId, email, full_name: 'E2E Non Admin', admin_role: null })

      await page.goto('/login')
      await page.getByLabel(/email address/i).fill(email)
      await page.getByLabel(/^password$/i).fill(password)
      await page.getByRole('button', { name: /^sign in$/i }).click()

      await expect(
        page.getByText(/does not have admin privileges/i)
      ).toBeVisible({ timeout: 15_000 })
      await expect(page).toHaveURL(/\/login/)
    } finally {
      await deleteAuthUser(userId)
    }
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
})

test.describe('Auth — sign-up', () => {
  test('submits sign-up form and shows confirmation messaging', async ({ page }) => {
    const email = uniqueEmail('signup')
    const password = `E2eSign1!${uniqueSuffix().slice(0, 6)}`
    let createdUserId: string | undefined

    try {
      await page.goto('/sign-up')
      await page.getByLabel(/full name/i).fill(`E2E Signup ${uniqueSuffix()}`)
      await page.getByLabel(/email address/i).fill(email)
      await page.getByLabel(/^password$/i).fill(password)
      await page.getByLabel(/confirm password/i).fill(password)
      await page.getByRole('button', { name: /create account/i }).click()

      await expect(
        page.getByText(/check your email|account created|confirm/i).first()
      ).toBeVisible({ timeout: 20_000 })

      const supabase = createServiceRoleClient()
      const { data } = await supabase.auth.admin.listUsers()
      const found = data.users.find((u) => u.email === email)
      createdUserId = found?.id
      expect(createdUserId).toBeTruthy()
    } finally {
      if (createdUserId) {
        await deleteAuthUser(createdUserId)
      }
    }
  })
})

test.describe('Auth — forgot / reset password', () => {
  test('forgot-password shows success state without revealing account existence', async ({
    page,
  }) => {
    await page.goto('/forgot-password')
    await page.getByLabel(/admin email address/i).fill(uniqueEmail('forgot'))
    await page.getByRole('button', { name: /send reset email/i }).click()

    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 15_000 })
  })

  test('reset-password without recovery tokens shows invalid link state', async ({ page }) => {
    await page.goto('/reset-password')
    await expect(page.getByText(/invalid reset link/i)).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Auth — confirm branches', () => {
  test('missing params shows invalid verification link error', async ({ page }) => {
    await page.goto('/auth/confirm')
    await expect(
      page.getByText(/invalid verification link/i)
    ).toBeVisible({ timeout: 15_000 })
  })

  test('PKCE code branch surfaces exchange error for invalid code', async ({ page }) => {
    await page.goto('/auth/confirm?code=not-a-real-pkce-code')
    await expect(
      page.getByText(/failed to verify|code verifier|invalid|error/i).first()
    ).toBeVisible({ timeout: 15_000 })
  })

  test('OTP token_hash+type branch surfaces verify error for invalid hash', async ({
    page,
  }) => {
    await page.goto('/auth/confirm?token_hash=invalid-hash&type=email')
    await expect(
      page.getByText(/verification failed|email verification failed|invalid|expired|error/i).first()
    ).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Auth — session timeout', () => {
  test('expired last_login_at redirects to login?error=session_expired', async ({
    page,
    context,
  }) => {
    const email = process.env.E2E_ADMIN_EMAIL
    const password = process.env.E2E_ADMIN_PASSWORD
    test.skip(!email || !password, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set')

    const supabase = createServiceRoleClient()
    const { data: list } = await supabase.auth.admin.listUsers()
    const admin = list.users.find((u) => u.email === email)
    expect(admin).toBeTruthy()

    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    const { data: prior } = await supabase
      .from('profiles')
      .select('last_login_at')
      .eq('id', admin!.id)
      .single()

    try {
      await supabase
        .from('profiles')
        .update({ last_login_at: stale })
        .eq('id', admin!.id)

      await page.goto('/login')
      await page.getByLabel(/email address/i).fill(email!)
      await page.getByLabel(/^password$/i).fill(password!)
      await page.getByRole('button', { name: /^sign in$/i }).click()
      // Login updates last_login_at — so force stale again after login cookie exists
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })

      await supabase
        .from('profiles')
        .update({ last_login_at: stale })
        .eq('id', admin!.id)

      await page.goto('/dashboard')
      await expect(page).toHaveURL(/\/login\?error=session_expired/, { timeout: 20_000 })
    } finally {
      if (prior?.last_login_at) {
        await supabase
          .from('profiles')
          .update({ last_login_at: prior.last_login_at })
          .eq('id', admin!.id)
      } else {
        await supabase
          .from('profiles')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', admin!.id)
      }
      await context.clearCookies()
    }
  })
})

test.describe('Auth — role-based access denial', () => {
  test('support_admin is redirected away from super_admin-only /analytics', async ({
    browser,
  }) => {
    const email = uniqueEmail('support')
    const password = `E2eSupp1!${uniqueSuffix().slice(0, 6)}`
    const supabase = createServiceRoleClient()

    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'E2E Support Admin' },
    })
    expect(error).toBeNull()
    const userId = created.user!.id

    try {
      await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: 'E2E Support Admin',
        admin_role: 'support_admin',
        last_login_at: new Date().toISOString(),
      })

      const context = await browser.newContext()
      const page = await context.newPage()

      await page.goto('/login')
      await page.getByLabel(/email address/i).fill(email)
      await page.getByLabel(/^password$/i).fill(password)
      await page.getByRole('button', { name: /^sign in$/i }).click()
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })

      await page.goto('/analytics')
      await expect(page).toHaveURL(/\/dashboard\?error=insufficient_permissions/, {
        timeout: 15_000,
      })

      await context.close()
    } finally {
      await deleteAuthUser(userId)
    }
  })
})
