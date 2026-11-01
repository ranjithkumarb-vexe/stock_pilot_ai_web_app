import { defineConfig, devices } from '@playwright/test';

/**
 * `npm run e2e` runs scripts/e2e.sh (backend :8010 + built web on :5180 + these specs).
 * `npx playwright test` alone: the mocked shell spec needs only a web server (started here when E2E_BASE_URL is
 * unset); the live specs in e2e/live need the backend (E2E_API_URL, default http://localhost:8010) and fail loudly
 * without it.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5180';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  // the live journeys mutate one shared dev database (personas, market overrides): run them one at a time
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL,
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'VITE_API_BASE_URL=${E2E_API_URL:-http://localhost:8010} npx vite --port 5180 --strictPort',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
