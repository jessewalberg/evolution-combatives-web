import type { APIRequestContext, Page } from '@playwright/test'
import { fetchCsrfHeaders, fetchCsrfHeadersFromPage } from './csrf'
import { createServiceRoleClient } from './supabase-admin'

type Json = Record<string, unknown>

async function apiJson(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  options?: { data?: Json; headers?: Record<string, string> }
) {
  const response = await request.fetch(path, {
    method,
    data: options?.data,
    headers: options?.headers,
  })
  const body = (await response.json().catch(() => ({}))) as Json
  return { response, body }
}

/**
 * Authenticated content/admin API helpers used by specs for create + teardown.
 * Mutating calls always attach a valid CSRF token.
 */
export async function contentApi(request: APIRequestContext) {
  const headers = await fetchCsrfHeaders(request)

  return {
    async createDiscipline(data: {
      name: string
      slug: string
      description?: string
    }) {
      const { response, body } = await apiJson(request, 'POST', '/api/content/disciplines', {
        data,
        headers,
      })
      if (!response.ok()) {
        throw new Error(`createDiscipline failed: ${response.status()} ${JSON.stringify(body)}`)
      }
      return body.data as { id: string; name: string; slug: string }
    },

    async deleteDiscipline(id: string) {
      const { response, body } = await apiJson(
        request,
        'DELETE',
        `/api/content/disciplines/${id}`,
        { headers }
      )
      return { ok: response.ok(), status: response.status(), body }
    },

    async createCategory(data: {
      name: string
      slug: string
      discipline_id: string
      description?: string
    }) {
      const { response, body } = await apiJson(request, 'POST', '/api/content/categories', {
        data,
        headers,
      })
      if (!response.ok()) {
        throw new Error(`createCategory failed: ${response.status()} ${JSON.stringify(body)}`)
      }
      return body.data as { id: string; name: string; slug: string }
    },

    async deleteCategory(id: string) {
      const { response, body } = await apiJson(
        request,
        'DELETE',
        `/api/content/categories/${id}`,
        { headers }
      )
      return { ok: response.ok(), status: response.status(), body }
    },

    async reorderCategories(reorderData: Array<{ id: string; sort_order: number }>) {
      const { response, body } = await apiJson(
        request,
        'POST',
        '/api/content/categories/reorder',
        { data: { reorderData }, headers }
      )
      return { ok: response.ok(), status: response.status(), body }
    },

    async mergeCategories(targetId: string, sourceIds: string[]) {
      const { response, body } = await apiJson(
        request,
        'POST',
        '/api/content/categories/merge',
        { data: { targetId, sourceIds }, headers }
      )
      return { ok: response.ok(), status: response.status(), body }
    },

    async createVideo(videoData: {
      id: string
      title: string
      slug: string
      categoryId: string
      status?: string
      isPublished?: boolean
      description?: string
    }) {
      const { response, body } = await apiJson(request, 'POST', '/api/content/videos', {
        data: { action: 'create', videoData },
        headers,
      })
      if (!response.ok()) {
        throw new Error(`createVideo failed: ${response.status()} ${JSON.stringify(body)}`)
      }
      return body.data as { id: string; title: string; processing_status: string; is_published: boolean }
    },

    async updateVideo(id: string, updateData: Json) {
      const { response, body } = await apiJson(request, 'POST', '/api/content/videos', {
        data: { action: 'update', id, updateData },
        headers,
      })
      return { ok: response.ok(), status: response.status(), body }
    },

    async bulkUpdateVideoStatus(videoIds: string[], updates: Json) {
      const { response, body } = await apiJson(request, 'POST', '/api/admin/content', {
        data: { action: 'bulkUpdateVideoStatus', videoIds, updates },
        headers,
      })
      return { ok: response.ok(), status: response.status(), body }
    },

    async bulkDeleteVideos(videoIds: string[]) {
      const { response, body } = await apiJson(request, 'POST', '/api/admin/content', {
        data: { action: 'bulkDeleteVideos', videoIds },
        headers,
      })
      return { ok: response.ok(), status: response.status(), body }
    },

    async deleteVideo(videoId: string) {
      const { response, body } = await apiJson(request, 'POST', '/api/admin/content', {
        data: { action: 'deleteVideo', videoId },
        headers,
      })
      return { ok: response.ok(), status: response.status(), body }
    },

    async listVideos(search?: string) {
      const qs = search ? `?search=${encodeURIComponent(search)}` : ''
      const { response, body } = await apiJson(request, 'GET', `/api/content/videos${qs}`)
      return { ok: response.ok(), status: response.status(), body }
    },

    async listDisciplines() {
      const { response, body } = await apiJson(request, 'GET', '/api/content/disciplines')
      return { ok: response.ok(), status: response.status(), body }
    },
  }
}

/**
 * Same helpers using the browser page's cookie jar (storageState session).
 */
export async function contentApiFromPage(page: Page) {
  const headers = await fetchCsrfHeadersFromPage(page)

  async function pageFetch(method: string, path: string, data?: Json) {
    return page.evaluate(
      async ({ method, path, data, headers }) => {
        const res = await fetch(path, {
          method,
          headers,
          body: data ? JSON.stringify(data) : undefined,
        })
        const body = await res.json().catch(() => ({}))
        return { ok: res.ok, status: res.status, body }
      },
      { method, path, data, headers }
    )
  }

  return {
    headers,
    pageFetch,
    deleteDiscipline: (id: string) => pageFetch('DELETE', `/api/content/disciplines/${id}`),
    deleteCategory: (id: string) => pageFetch('DELETE', `/api/content/categories/${id}`),
    deleteVideo: (videoId: string) =>
      pageFetch('POST', '/api/admin/content', { action: 'deleteVideo', videoId }),
    bulkDeleteVideos: (videoIds: string[]) =>
      pageFetch('POST', '/api/admin/content', { action: 'bulkDeleteVideos', videoIds }),
  }
}

/**
 * Tear down auth users / profile / subscription rows created by a test.
 * Used only when no product API exists for the resource.
 */
export async function deleteAuthUser(userId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const failures: string[] = []

  const { error: subscriptionsError } = await supabase
    .from('subscriptions')
    .delete()
    .eq('user_id', userId)
  if (subscriptionsError) {
    failures.push(`subscriptions: ${subscriptionsError.message}`)
  }

  const { error: answersError } = await supabase
    .from('answers')
    .delete()
    .eq('admin_id', userId)
  if (answersError) {
    failures.push(`answers: ${answersError.message}`)
  }

  const { error: questionsError } = await supabase
    .from('questions')
    .delete()
    .eq('user_id', userId)
  if (questionsError) {
    failures.push(`questions: ${questionsError.message}`)
  }

  const { error: profilesError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId)
  if (profilesError) {
    failures.push(`profiles: ${profilesError.message}`)
  }

  const { error: authError } = await supabase.auth.admin.deleteUser(userId)
  if (authError) {
    failures.push(`auth.users: ${authError.message}`)
  }

  if (failures.length) {
    throw new Error(`Failed to delete auth user ${userId}: ${failures.join('; ')}`)
  }
}

export async function deleteSubscriptionByUserId(userId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const { error } = await supabase.from('subscriptions').delete().eq('user_id', userId)
  if (error) {
    throw new Error(`Failed to delete subscriptions for ${userId}: ${error.message}`)
  }
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  await supabase.from('answers').delete().eq('question_id', questionId)
  const { error } = await supabase.from('questions').delete().eq('id', questionId)
  if (error) {
    throw new Error(`Failed to delete question ${questionId}: ${error.message}`)
  }
}

/**
 * Expire a Stripe Checkout Session created by a test (test-mode).
 * Ignores the idempotent case where the session is already expired or completed.
 */
export async function expireStripeCheckoutSession(sessionId: string): Promise<void> {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is required to expire Checkout Sessions in E2E teardown')
  }

  // Lazy import so specs that never create a session do not require Stripe at load time.
  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(secretKey)

  try {
    await stripe.checkout.sessions.expire(sessionId)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: string }).code)
        : ''
    // Already expired / completed / terminal - safe to ignore
    if (
      /already (?:been )?(?:expired|complete)|cannot be expired|resource_missing/i.test(
        message
      ) ||
      code === 'resource_missing'
    ) {
      return
    }
    throw new Error(`Failed to expire Checkout Session ${sessionId}: ${message}`)
  }
}
