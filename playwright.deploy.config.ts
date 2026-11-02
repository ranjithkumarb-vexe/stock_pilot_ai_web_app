import { defineConfig, devices } from '@playwright/test';

/** `npm run e2e:deploy` (scripts/e2e_deploy.sh) starts the servers and sets E2E_DEPLOY_PROD_URL / E2E_DEPLOY_DEV_URL. */
export default defineConfig({
  testDir: './e2e',
  testMatch: /deploy-smoke\.spec\.ts/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results-deploy',
  use: { actionTimeout: 15_000, viewport: { width: 1440, height: 900 } },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
});
