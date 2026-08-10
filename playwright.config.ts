import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'

/**
 * Load gitignored local E2E secrets. CI injects the same names via GitHub Actions secrets.
 * Never commit .env.test.local - covered by .gitignore ".env.*.local".
 */
dotenv.config({ path: path.resolve(__dirname, '.env.test.local') })

const baseURL = process.env.VITE_APP_URL || 'http://localhost:3000'
const isCI = !!process.env.CI

/**
 * Local override: set E2E_WEB_SERVER_COMMAND="pnpm dev" for faster iteration.
 * Default (and CI) uses a production build served by workerd via vite preview.
 */
const webServerCommand =
  process.env.E2E_WEB_SERVER_COMMAND || 'pnpm exec vite build && pnpm exec vite preview --port 3000'

/**
 * Snapshot paths omit {platform} so committed Linux baselines are the single
 * source of truth. Do not regenerate on macOS - see e2e/visual/README.md.
 */
const visualSnapshotPathTemplate =
  '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}-{projectName}{ext}'

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
      testMatch: /tests\/.*\.spec\.ts/,
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
      testMatch: /tests\/.*\.spec\.ts/,
    },
    // Visual regression - Chromium only (font baselines are Linux CI generated).
    {
      name: 'visual-public-desktop',
      testMatch: /visual\/public\.spec\.ts/,
      snapshotPathTemplate: visualSnapshotPathTemplate,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        storageState: { cookies: [], origins: [] },
      },
    },
    {
      name: 'visual-public-mobile',
      testMatch: /visual\/public\.spec\.ts/,
      snapshotPathTemplate: visualSnapshotPathTemplate,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        storageState: { cookies: [], origins: [] },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'visual-authed-desktop',
      testMatch: /visual\/(?!public).*\.spec\.ts/,
      snapshotPathTemplate: visualSnapshotPathTemplate,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        storageState: 'e2e/.auth/admin.json',
      },
    },
    {
      name: 'visual-authed-mobile',
      testMatch: /visual\/(?!public).*\.spec\.ts/,
      snapshotPathTemplate: visualSnapshotPathTemplate,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        storageState: 'e2e/.auth/admin.json',
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
})
