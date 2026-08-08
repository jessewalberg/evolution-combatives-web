import { test, expect } from '@playwright/test'
import { uniqueEmail, uniqueSuffix, uniqueTitle } from '../helpers/unique'
import { createServiceRoleClient } from '../helpers/supabase-admin'
import { deleteAuthUser, deleteQuestion } from '../helpers/api'

/**
 * Q&A routes exist even though sidebar marks Q&A as comingSoon.
 * Fixtures use service-role inserts; teardown deletes answers + question + asker user.
 */
test.describe('Q&A - list, detail, answer / moderate', () => {
  let askerId: string | undefined
  let questionId: string | undefined
  let questionTitle: string | undefined

  test.beforeEach(async () => {
    const supabase = createServiceRoleClient()
    const email = uniqueEmail('qa-asker')
    questionTitle = uniqueTitle('Question')

    const { data: user, error } = await supabase.auth.admin.createUser({
      email,
      password: `E2eQa1!${uniqueSuffix().slice(0, 6)}`,
      email_confirm: true,
      user_metadata: { full_name: 'E2E QA Asker' },
    })
    expect(error).toBeNull()
    askerId = user.user!.id

    await supabase.from('profiles').upsert({
      id: askerId,
      email,
      full_name: 'E2E QA Asker',
      admin_role: null,
    })

    const { data: question, error: qErr } = await supabase
      .from('questions')
      .insert({
        question: 'E2E fixture question body - how do I practice this technique?',
        title: questionTitle,
        content: 'E2E fixture question body - how do I practice this technique?',
        status: 'pending',
        priority: 'medium',
        category: 'general',
        user_id: askerId,
        upvotes: 0,
      })
      .select('id')
      .single()

    expect(qErr).toBeNull()
    questionId = question!.id
  })

  test.afterEach(async () => {
    const failures: string[] = []

    if (questionId) {
      try {
        await deleteQuestion(questionId)
      } catch (err) {
        failures.push(
          `deleteQuestion: ${err instanceof Error ? err.message : String(err)}`
        )
      }
      questionId = undefined
    }
    if (askerId) {
      try {
        await deleteAuthUser(askerId)
      } catch (err) {
        failures.push(
          `deleteAuthUser: ${err instanceof Error ? err.message : String(err)}`
        )
      }
      askerId = undefined
    }

    if (failures.length) {
      throw new Error(`Q&A teardown failed: ${failures.join('; ')}`)
    }
  })

  test('lists question, opens detail, posts an answer', async ({ page }) => {
    await page.goto('/qa')
    await expect(page.getByText(/q&a management/i)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(questionTitle!).first()).toBeVisible({ timeout: 20_000 })

    await page.goto(`/qa/${questionId}`)
    await expect(page.getByText(/question details/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(questionTitle!).first()).toBeVisible()

    const answerText = `E2E official answer ${uniqueSuffix()}`
    const answerBox = page.getByLabel(/your answer/i).or(page.getByPlaceholder(/answer/i))
    await answerBox.first().fill(answerText)
    await page.getByRole('button', { name: /post answer/i }).click()

    await expect(page.getByText(answerText).first()).toBeVisible({ timeout: 20_000 })

    const supabase = createServiceRoleClient()
    await expect
      .poll(
        async () => {
          const [answersResult, questionResult] = await Promise.all([
            supabase
              .from('answers')
              .select('id, content')
              .eq('question_id', questionId!),
            supabase
              .from('questions')
              .select('status')
              .eq('id', questionId!)
              .single(),
          ])

          if (answersResult.error) throw answersResult.error
          if (questionResult.error) throw questionResult.error

          return {
            answerPersisted: answersResult.data.some((a) => a.content === answerText),
            status: questionResult.data.status,
          }
        },
        { timeout: 20_000 }
      )
      .toEqual({ answerPersisted: true, status: 'answered' })
  })
})
