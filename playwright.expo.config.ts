import { defineConfig, devices } from '@playwright/test';

/**
 * Expo web smoke suite — regression net for the upcoming Expo SDK ladder in
 * the sibling edtech-expo repo. Shallow "does it still work at all"
 * coverage of the learner flow (login → curriculum → grade → module →
 * lesson → learning/practice/quiz) in both UI themes and in Khmer, so the
 * SDK ladder has something to go red when a rung breaks the app.
 *
 * Kept separate from playwright.config.ts (the Angular admin suite): it
 * targets a different app, on a different port, with a different account
 * model and login flow. The main config excludes e2e/expo-smoke via
 * testIgnore so `npm run e2e` never picks these specs up; run this suite
 * with `npm run e2e:expo`.
 *
 * Points at an already-running `expo start --web` (localhost:8081 by
 * default) and the rpi (student) API. It does not start either — see
 * e2e/expo-smoke/fixtures.ts for the accounts and login helper.
 */
const EXPO_WEB_URL = process.env.EXPO_WEB_URL ?? 'http://localhost:8081';

export default defineConfig({
  testDir: './e2e/expo-smoke',
  // Expo's Metro bundler compiles the web bundle lazily on first request — a
  // cold `expo start -c` (which the SDK ladder will be running against) can
  // take well over a minute before it answers at all. Warm it up once,
  // outside any single spec's own timeout, before the suite starts.
  globalSetup: './e2e/expo-smoke/global-setup.ts',
  // Same reasoning as playwright.config.ts: the rpi API allows one token per
  // user, and this suite's two designated accounts log in and out of the
  // same UI repeatedly. Serial keeps that sane and keeps failures readable.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: EXPO_WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Must come AFTER the devices['Desktop Chrome'] spread, which carries
        // its own 1280x720 viewport and would otherwise silently win.
        // Corporate theme's nav rail only replaces the drawer at
        // theme.breakpoints.DEFAULT_MIN_WIDTH (768) and up — pin a
        // desktop-sized viewport so the corporate structural assertions are
        // meaningful.
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  metadata: { expoWebUrl: EXPO_WEB_URL },
});
