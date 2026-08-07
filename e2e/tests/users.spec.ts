import { test, expect } from '@playwright/test'
import { uniqueEmail, uniqueSuffix, uniqueTitle } from '../helpers/unique'
import { createServiceRoleClient } from '../helpers/supabase-admin'
import { deleteAuthUser } from '../helpers/api'

test.describe('Users - list, filter, detail, edit', () => {
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

    const search = page.getByPlaceholder('Search users...', { exact: true })
    await search.fill(fixtureEmail!)
    await expect(page.getByText(fixtureName!).first()).toBeVisible({ timeout: 20_000 })

    // Open detail via the row's View profile action (icon button with title)
    const row = page.locator('tr', { hasText: fixtureEmail! })
    const viewProfile = row.getByRole('button', { name: /view profile/i })
    await expect(viewProfile).toBeVisible()
    await viewProfile.click()

    await expect(page).toHaveURL(new RegExp(`/users/${fixtureUserId}`))
    await expect(page.getByText(fixtureEmail!).first()).toBeVisible({ timeout: 15_000 })

    const editButton = page.getByRole('button', { name: /edit profile/i })
    await expect(editButton).toBeVisible()
    await editButton.click()

    const updatedName = `${fixtureName} Edited`
    // Label is not htmlFor-associated; use the edit form placeholder.
    const nameInput = page.getByPlaceholder(/enter full name/i)
    await expect(nameInput).toBeVisible()
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
  })
})
