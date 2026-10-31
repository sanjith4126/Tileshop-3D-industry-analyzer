import { defineConfig, devices } from '@playwright/test'

// Runs against an already running stack (frontend on E2E_BASE_URL, which proxies /api to the API).
// Locally: start Postgres, API, ML service and `npm run dev` in frontend/, then `npm test` here.
// Set PW_CHANNEL=chrome to use the installed Chrome instead of Playwright's bundled Chromium.
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5180',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL || undefined } }],
})
