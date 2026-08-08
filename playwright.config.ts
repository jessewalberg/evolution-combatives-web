import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

/**
 * Load gitignored local E2E secrets. CI injects the same names via GitHub Actions secrets.
 * Never commit .env.test.local - covered by .gitignore ".env.*.local".
 */
dotenv.config({ path: path.resolve(__dirname, '.env.test.local') })

const baseURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const isCI = !!process.env.CI

/**
 * Local override: set E2E_WEB_SERVER_COMMAND="pnpm dev" for faster iteration.
 * Default (and CI) uses a production build for reliability.
 */
const webServerCommand =
  process.env.E2E_WEB_SERVER_COMMAND || 'pnpm build && pnpm start'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: webServerCommand,
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 300_000,
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      // Auth setup fills E2E_ADMIN_PASSWORD via page.fill(). Playwright traces
      // and videos record plaintext fill values (password fields are not masked).
      // Disable both so a retry/failure cannot upload the real admin password
      // as a CI artifact. Leave global trace/video as-is for chromium/webkit.
      use: {
        trace: 'off',
        video: 'off',
      },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testIgnore: /.*\.setup\.ts/,
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testIgnore: /.*\.setup\.ts/,
    },
  ],
})
