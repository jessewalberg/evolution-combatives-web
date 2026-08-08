import type { Page, Route } from '@playwright/test'
import {
  FIXTURE_IDS,
  FIXTURE_TS,
  FIXTURE_TS_MS,
  adminProfileFixture,
  categoryFixture,
  dashboardMetricsFixture,
  disciplineFixture,
  processingVideoFixture,
  questionFixture,
  regularUserFixture,
  subscriptionFixture,
  videoFixture,
} from '../fixtures'

type MockMode = 'populated' | 'empty' | 'error'

export interface InstallVisualMocksOptions {
  /** Default populated. List pages may pass empty/error for state variants. */
  mode?: MockMode
  /**
   * When set, profile rows for id=eq.<sessionUserId> reuse this id so useAuth
   * matches the real storageState session without hitting live profile data.
   */
  sessionUserId?: string
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

function wantsSingleObject(route: Route): boolean {
  const accept = route.request().headers()['accept'] || ''
  return accept.includes('vnd.pgrst.object')
}

/**
 * Freeze Date + Math.random in the page so relative times and chart mocks
 * stay deterministic without touching production code.
 */
export async function installDeterminism(page: Page): Promise<void> {
  // Freeze Date for relative timestamps, but resume timers so React Query,
  // waitForTimeout, and networkidle keep working under Playwright's clock.
  await page.clock.install({ time: new Date(FIXTURE_TS_MS) })
  await page.clock.resume()

  await page.addInitScript((seedStart: number) => {
    let seed = seedStart
    Math.random = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
  }, 12345)
}

/**
 * Install route mocks for app APIs, Supabase REST, and noisy third parties.
 * Auth token refresh is allowed through so storageState sessions keep working.
 */
export async function installVisualMocks(
  page: Page,
  options: InstallVisualMocksOptions = {}
): Promise<void> {
  const mode = options.mode ?? 'populated'
  const sessionUserId = options.sessionUserId ?? FIXTURE_IDS.adminUser

  // Block analytics / CDN noise that would flake screenshots.
  await page.route('**/posthog.com/**', (route) => route.abort())
  await page.route('**/i.posthog.com/**', (route) => route.abort())
  await page.route('**/iframe.videodelivery.net/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body style="background:#111;color:#666;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">Video preview mocked</body></html>',
    })
  )
  await page.route('**/videodelivery.net/**', (route) => route.abort())
  await page.route('**/cloudflarestream.com/**', (route) => route.abort())

  // Tiny transparent PNG for any remaining remote images.
  const transparentPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
  // Next.js image optimizer proxy (/_next/image?url=...) does not carry a
  // recognizable file extension in the request URL, so it needs its own
  // catch-all rather than relying on the extension-based mock below.
  await page.route('**/_next/image**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: transparentPng,
    })
  )

  await page.route('**/*', async (route) => {
    const url = route.request().url()
    if (!/\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)) {
      return route.fallback()
    }
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      return route.continue()
    }
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: transparentPng,
    })
  })

  await page.route('**/api/csrf-token', (route) =>
    json(route, {
      success: true,
      csrfToken: 'visual-test-csrf-token',
      expiresAt: '2099-01-01T00:00:00.000Z',
    })
  )

  await page.route('**/api/dashboard/metrics', (route) => {
    if (mode === 'error') {
      return json(route, { success: false, error: 'Metrics unavailable' }, 500)
    }
    return json(route, {
      success: true,
      data:
        mode === 'empty'
          ? {
              totalUsers: 0,
              totalUsersGrowth: 0,
              activeSubscriptions: 0,
              monthlyRevenue: 0,
              revenueGrowth: 0,
              totalVideos: 0,
              videosThisMonth: 0,
              avgEngagementTime: 0,
              engagementGrowth: 0,
              processingVideos: 0,
              pendingQA: 0,
              systemAlerts: 0,
            }
          : dashboardMetricsFixture,
    })
  })

  await page.route('**/api/content/disciplines**', (route) => {
    if (mode === 'error') {
      return json(route, { success: false, error: 'Failed to load disciplines' }, 500)
    }
    return json(route, {
      success: true,
      data: mode === 'empty' ? [] : [disciplineFixture],
    })
  })

  await page.route('**/api/content/categories**', (route) => {
    if (mode === 'error') {
      return json(route, { success: false, error: 'Failed to load categories' }, 500)
    }
    return json(route, {
      success: true,
      data: mode === 'empty' ? [] : [categoryFixture],
    })
  })

  await page.route('**/api/content/videos/**', (route) => {
    if (mode === 'error') {
      return json(route, { success: false, error: 'Video not found' }, 404)
    }
    return json(route, { success: true, data: videoFixture })
  })

  await page.route('**/api/content/videos**', (route) => {
    // Detail path handled above; this catches list queries.
    if (route.request().url().match(/\/api\/content\/videos\/[^/?]+/)) {
      return route.fallback()
    }
    if (mode === 'error') {
      return json(route, { success: false, error: 'Failed to load videos' }, 500)
    }
    return json(route, {
      success: true,
      data: {
        data: mode === 'empty' ? [] : [videoFixture],
        totalCount: mode === 'empty' ? 0 : 1,
        hasMore: false,
      },
    })
  })

  await page.route('**/api/subscriptions/create-checkout', (route) =>
    json(route, { url: 'https://checkout.stripe.com/test/visual-session' })
  )

  await page.route('**/api/cloudflare/**', (route) =>
    json(route, {
      success: true,
      data: { previewUrl: null, uploadURL: null },
    })
  )

  await page.route('**/api/video-processing/**', (route) =>
    json(route, { success: true, data: { synced: true } })
  )

  await page.route('**/api/admin/content', (route) =>
    json(route, { success: true, data: {} })
  )

  // Supabase REST - profiles
  // Auth profile lookups (id=eq.<session>) always succeed so layouts keep working.
  // List queries respect mode for users-page empty/error variants.
  await page.route('**/rest/v1/profiles**', async (route) => {
    const url = new URL(route.request().url())
    const idEq = url.searchParams.get('id')?.replace(/^eq\./, '')
    const emailEq = url.searchParams.get('email')?.replace(/^eq\./, '')

    if (idEq) {
      const profile =
        idEq === FIXTURE_IDS.regularUser
          ? regularUserFixture
          : { ...adminProfileFixture, id: idEq === sessionUserId ? sessionUserId : idEq }
      return json(route, wantsSingleObject(route) ? profile : [profile])
    }

    if (emailEq) {
      const profile = { ...adminProfileFixture, email: emailEq }
      return json(route, wantsSingleObject(route) ? profile : [profile])
    }

    if (mode === 'error') {
      return json(route, { message: 'profiles unavailable' }, 500)
    }

    if (mode === 'empty') {
      // AdminLayout/useAuth fetch their own profile via the id=eq.<id> branch
      // above, so this unfiltered list query only feeds users-list/analytics
      // list queries - return genuinely empty so "empty" means empty.
      return json(route, [])
    }

    return json(route, [
      { ...adminProfileFixture, id: sessionUserId },
      regularUserFixture,
    ])
  })

  await page.route('**/rest/v1/subscriptions**', (route) => {
    const url = route.request().url()
    const isAuthLookup =
      url.includes(`user_id=eq.${sessionUserId}`) || wantsSingleObject(route)

    // useAuth active-subscription lookup: always return empty (no admin sub).
    if (isAuthLookup && url.includes(`user_id=eq.${sessionUserId}`)) {
      if (wantsSingleObject(route)) {
        return json(route, null, 406)
      }
      return json(route, [])
    }

    if (mode === 'error') {
      return json(route, { message: 'subscriptions unavailable' }, 500)
    }
    if (mode === 'empty') {
      return json(route, [])
    }
    if (url.includes(`user_id=eq.${FIXTURE_IDS.regularUser}`) || url.includes('user_id=eq.')) {
      return json(
        route,
        wantsSingleObject(route) ? subscriptionFixture : [subscriptionFixture]
      )
    }
    return json(route, [subscriptionFixture])
  })

  await page.route('**/rest/v1/videos**', (route) => {
    if (mode === 'error') {
      return json(route, { message: 'videos unavailable' }, 500)
    }
    if (mode === 'empty') {
      return json(route, [])
    }
    const url = route.request().url()
    if (url.includes('processing_status=in.') || url.includes('processing_status=eq.')) {
      return json(route, [processingVideoFixture])
    }
    return json(route, [videoFixture, processingVideoFixture])
  })

  await page.route('**/rest/v1/questions**', (route) => {
    if (mode === 'error') {
      return json(route, { message: 'questions unavailable' }, 500)
    }
    if (mode === 'empty') {
      return json(route, wantsSingleObject(route) ? null : [], wantsSingleObject(route) ? 406 : 200)
    }
    const url = new URL(route.request().url())
    const idEq = url.searchParams.get('id')?.replace(/^eq\./, '')
    if (idEq || wantsSingleObject(route)) {
      return json(route, wantsSingleObject(route) ? questionFixture : [questionFixture])
    }
    return json(route, [questionFixture])
  })

  await page.route('**/rest/v1/answers**', (route) => json(route, []))
  await page.route('**/rest/v1/answer_templates**', (route) => json(route, []))
  await page.route('**/rest/v1/user_progress**', (route) => json(route, []))
  await page.route('**/rest/v1/support_notes**', (route) => json(route, []))
  await page.route('**/rest/v1/payment_records**', (route) => json(route, []))
  await page.route('**/rest/v1/processing_logs**', (route) => json(route, []))

  // Realtime websocket attempts - abort so they do not hang.
  await page.route('**/realtime/v1/**', (route) => route.abort())

  // Keep auth endpoints on the real project so storageState sessions refresh.
  // (No route registered for /auth/v1 - requests continue by default.)

  void FIXTURE_TS
}
