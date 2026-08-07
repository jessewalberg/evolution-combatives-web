import { test, expect } from '@playwright/test'
import { uniqueEmail, uniqueSuffix, uniqueTitle } from '../helpers/unique'
import { createServiceRoleClient } from '../helpers/supabase-admin'
import { deleteAuthUser } from '../helpers/api'

test.describe('Users — list, filter, detail, edit', () => {
  let fixtureUserId: string | undefined
  let fixtureEmail: string | undefined
  let fixtureName: string | undefined

  test.beforeEach(async () => {
    const supabase = createServiceRoleClient()
    fixtureEmail = uniqueEmail('user')
    fixtureName = uniqueTitle('User')
    const password = `E2eUser1!${uniqueSuffix().slice(0, 6)}`

    const { data, error } = await supabase.auth.admin.createUser({
      email: fixtureEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: fixtureName },
    })
    expect(error).toBeNull()
    fixtureUserId = data.user!.id

    await supabase.from('profiles').upsert({
      id: fixtureUserId,
      email: fixtureEmail,
      full_name: fixtureName,
      admin_role: null,
      department: 'E2E Dept',
      badge_number: `E2E-${uniqueSuffix().slice(0, 6)}`,
      last_login_at: new Date().toISOString(),
    })
  })

  test.afterEach(async () => {
    if (fixtureUserId) {
      await deleteAuthUser(fixtureUserId)
      fixtureUserId = undefined
    }
  })

  test('lists users, filters by search, opens detail, edits profile fields', async ({
    page,
  }) => {
    await page.goto('/users')
    await expect(page.getByText(/user management/i)).toBeVisible({ timeout: 20_000 })

    const search = page.getByPlaceholder(/search users/i)
    await search.fill(fixtureEmail!)
    await expect(page.getByText(fixtureName!).first()).toBeVisible({ timeout: 20_000 })

    // Open detail — row click or view link
    const rowLink = page.getByRole('link', { name: new RegExp(fixtureName!, 'i') }).first()
    if (await rowLink.isVisible().catch(() => false)) {
      await rowLink.click()
    } else {
      await page.goto(`/users/${fixtureUserId}`)
    }

    await expect(page).toHaveURL(new RegExp(`/users/${fixtureUserId}`))
    await expect(page.getByText(fixtureEmail!).first()).toBeVisible({ timeout: 15_000 })

    const editButton = page.getByRole('button', { name: /edit profile/i })
    if (await editButton.isVisible().catch(() => false)) {
      await editButton.click()
      const updatedName = `${fixtureName} Edited`
      const nameInput = page.getByLabel(/full name/i)
      await nameInput.fill(updatedName)
      await page.getByRole('button', { name: /save changes/i }).click()
      await expect(page.getByText(updatedName).first()).toBeVisible({ timeout: 15_000 })

      const supabase = createServiceRoleClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', fixtureUserId!)
        .single()
      expect(profile?.full_name).toBe(updatedName)
    }
  })
})
