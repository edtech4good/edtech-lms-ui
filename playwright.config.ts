import { defineConfig, devices } from '@playwright/test';
import { API_URL, BASE_URL } from './e2e/fixtures/env';

/**
 * Smoke suite — ROADMAP Track A, Phase 0.
 *
 * This is the regression net for the Angular 12 → current ladder. The 64 .spec
 * files under src/ are `ng generate` scaffolding and assert no behaviour, so
 * until this suite exists there is nothing to tell us a rung of the upgrade
 * broke something. Every check here is deliberately shallow and about whether
 * the app still works at all, not about how it looks.
 *
 * It runs against a running local stack rather than standing one up itself —
 * MySQL, the central API and `ng serve`, with `seed:local` and `seed:demo`
 * applied. See LOCAL_DEVELOPMENT.md. Pointing BASE_URL / API_URL elsewhere runs
 * it against staging.
 */
export default defineConfig({
  testDir: './e2e',
  // The API is shared mutable state and several specs create and delete rows in
  // it. Serial keeps failures readable; the suite is small enough not to care.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  metadata: { apiUrl: API_URL },
});
