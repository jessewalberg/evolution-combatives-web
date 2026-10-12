import { test as base, expect } from '@playwright/test'
import { appAccessHeaders, isAppOrigin } from './helpers/access'

export const test = base.extend({
  page: async ({ page }, use) => {
    const headers = appAccessHeaders(process.env.VITE_APP_URL || 'http://localhost:3000')
    if (Object.keys(headers).length) {
      await page.route(isAppOrigin, (route) =>
        route.continue({ headers: { ...route.request().headers(), ...headers } })
      )
    }
    await use(page)
  },
})

export { expect }
