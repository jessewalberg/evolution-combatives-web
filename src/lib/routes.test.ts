import { describe, it, expect } from 'vitest'
import ROUTES, { RouteHelpers } from '@/src/lib/routes'

describe('ROUTES', () => {
  it('exposes expected static and dynamic paths', () => {
    expect(ROUTES.HOME).toBe('/')
    expect(ROUTES.LOGIN).toBe('/login')
    expect(ROUTES.SIGNUP).toBe('/sign-up')
    expect(ROUTES.FORGOT_PASSWORD).toBe('/forgot-password')
    expect(ROUTES.RESET_PASSWORD).toBe('/reset-password')
    expect(ROUTES.SUBSCRIBE).toBe('/subscribe')
    expect(ROUTES.SUBSCRIPTION_SUCCESS).toBe('/subscription-success')
    expect(ROUTES.AUTH.CONFIRM).toBe('/auth/confirm')
    expect(ROUTES.DASHBOARD.HOME).toBe('/dashboard')
    expect(ROUTES.DASHBOARD.CONTENT.VIDEOS).toBe('/dashboard/content/videos')
    expect(ROUTES.DASHBOARD.CONTENT.VIDEO_UPLOAD).toBe('/dashboard/content/videos/upload')
    expect(ROUTES.DASHBOARD.CONTENT.VIDEO_DETAIL('abc')).toBe('/dashboard/content/videos/abc')
    expect(ROUTES.DASHBOARD.CONTENT.VIDEO_EDIT('abc')).toBe('/dashboard/content/videos/abc/edit')
    expect(ROUTES.DASHBOARD.CONTENT.VIDEO_PREVIEW('abc')).toBe('/dashboard/content/videos/abc/preview')
    expect(ROUTES.DASHBOARD.CONTENT.CATEGORY_DETAIL('c1')).toBe('/dashboard/content/categories/c1')
    expect(ROUTES.DASHBOARD.CONTENT.DISCIPLINE_DETAIL('d1')).toBe('/dashboard/content/disciplines/d1')
    expect(ROUTES.DASHBOARD.CONTENT.PROCESSING).toBe('/dashboard/content/processing')
    expect(ROUTES.DASHBOARD.PROFILE.VIEW).toBe('/dashboard/profile')
    expect(ROUTES.DASHBOARD.PROFILE.EDIT).toBe('/dashboard/profile/edit')
    expect(ROUTES.DASHBOARD.PROFILE.CHANGE_PASSWORD).toBe('/dashboard/profile/change-password')
    expect(ROUTES.USERS.LIST).toBe('/users')
    expect(ROUTES.USERS.DETAIL('u1')).toBe('/users/u1')
    expect(ROUTES.USERS.DETAIL_TAB('u1', 'progress')).toBe('/users/u1?tab=progress')
    expect(ROUTES.USERS.INVITE).toBe('/users/invite')
    expect(ROUTES.USERS.PROFILE.VIEW).toBe('/users/profile')
    expect(ROUTES.USERS.PROFILE.EDIT).toBe('/users/profile/edit')
    expect(ROUTES.USERS.PROFILE.CHANGE_PASSWORD).toBe('/users/profile/change-password')
    expect(ROUTES.ANALYTICS.HOME).toBe('/analytics')
    expect(ROUTES.ANALYTICS.VIDEOS).toBe('/analytics/videos')
    expect(ROUTES.ANALYTICS.VIDEO_DETAIL('v1')).toBe('/analytics/videos/v1')
    expect(ROUTES.ANALYTICS.QA).toBe('/analytics/qa')
    expect(ROUTES.ANALYTICS.USERS).toBe('/analytics/users')
    expect(ROUTES.ANALYTICS.USER_DETAIL('u1')).toBe('/analytics/users/u1')
    expect(ROUTES.QA.LIST).toBe('/qa')
    expect(ROUTES.QA.DETAIL('q1')).toBe('/qa/q1')
    expect(ROUTES.DASHBOARD.SEARCH('jiu jitsu')).toBe('/dashboard/search?q=jiu%20jitsu')
    expect(ROUTES.API.AUTH.LOGIN).toBe('/api/auth/login')
    expect(ROUTES.API.AUTH.LOGOUT).toBe('/api/auth/logout')
    expect(ROUTES.API.AUTH.SIGNUP).toBe('/api/auth/sign-up')
    expect(ROUTES.API.CONTENT.VIDEOS).toBe('/api/content/videos')
    expect(ROUTES.API.CONTENT.VIDEO_DETAIL('v1')).toBe('/api/content/videos/v1')
    expect(ROUTES.API.CONTENT.CATEGORIES).toBe('/api/content/categories')
    expect(ROUTES.API.CONTENT.DISCIPLINES).toBe('/api/content/disciplines')
    expect(ROUTES.API.CLOUDFLARE.UPLOAD).toBe('/api/cloudflare/upload')
    expect(ROUTES.API.VIDEO.SIGNED_URL).toBe('/api/video/signed-url')
    expect(ROUTES.API.SUBSCRIPTIONS.CREATE_CHECKOUT).toBe('/api/subscriptions/create-checkout')
  })
})

describe('RouteHelpers.isDashboardRoute', () => {
  it('detects dashboard prefixes', () => {
    expect(RouteHelpers.isDashboardRoute('/dashboard')).toBe(true)
    expect(RouteHelpers.isDashboardRoute('/dashboard/content')).toBe(true)
    expect(RouteHelpers.isDashboardRoute('/users')).toBe(false)
  })
})

describe('RouteHelpers.isPublicRoute', () => {
  it('allows configured public pages and API paths', () => {
    expect(RouteHelpers.isPublicRoute('/login')).toBe(true)
    expect(RouteHelpers.isPublicRoute('/auth/confirm')).toBe(true)
    expect(RouteHelpers.isPublicRoute('/api/content/videos')).toBe(true)
    expect(RouteHelpers.isPublicRoute('/dashboard')).toBe(false)
  })
})

describe('RouteHelpers.getBreadcrumbs', () => {
  it('builds breadcrumb trail from pathname', () => {
    const crumbs = RouteHelpers.getBreadcrumbs('/dashboard/content/videos')
    expect(crumbs).toHaveLength(3)
    expect(crumbs[0]).toEqual({ name: 'Dashboard', href: '/dashboard' })
    expect(crumbs[1]).toEqual({ name: 'Content', href: '/dashboard/content' })
    expect(crumbs[2]).toEqual({ name: 'Videos', href: undefined })
  })

  it('title-cases hyphenated segments', () => {
    const crumbs = RouteHelpers.getBreadcrumbs('/forgot-password')
    expect(crumbs[0].name).toBe('Forgot Password')
  })
})

describe('RouteHelpers.withQuery', () => {
  it('appends query string or returns path when empty', () => {
    expect(RouteHelpers.withQuery('/users', { page: 2, active: true })).toBe(
      '/users?page=2&active=true'
    )
    expect(RouteHelpers.withQuery('/users', {})).toBe('/users')
  })
})
