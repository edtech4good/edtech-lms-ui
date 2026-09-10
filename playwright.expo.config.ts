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
 *
 * Two projects:
 *  - `chromium` (1280x800) — the desktop/tablet-and-up structural
 *    assertions: corporate nav rail, kids drawer, landscape lesson video,
 *    the shared login/drilldown/practice/quiz coverage. Ignores
 *    phone-*.spec.ts — those specs assert on viewport-specific pixel
 *    geometry (tab bar position, stacked options, a 16:9 video box) that is
 *    only meaningful at phone width and would either not apply or actively
 *    mismatch at 1280x800.
 *  - `phone` (390x844) — the corporate phone learner path from ROADMAP
 *    Track B: a bottom tab bar (Home/Profile) below theme.breakpoints
 *    .DEFAULT_MIN_WIDTH instead of the nav rail/drawer, vertically stacked
 *    MCQ options, and a full-width 16:9 lesson video. Only runs
 *    phone-*.spec.ts. The viewport is overridable via EXPO_E2E_PHONE_WIDTH /
 *    EXPO_E2E_PHONE_HEIGHT — the mutation-proof lever for the phone spec's
 *    shell/video assertions: pointing it back at desktop dimensions
 *    (1280x800) puts the corporate account back on the nav rail and the
 *    video back to full-height, which the phone spec's assertions do not
 *    expect and should fail against.
 */
const EXPO_WEB_URL = process.env.EXPO_WEB_URL ?? 'http://localhost:8081';
const PHONE_WIDTH = Number(process.env.EXPO_E2E_PHONE_WIDTH) || 390;
const PHONE_HEIGHT = Number(process.env.EXPO_E2E_PHONE_HEIGHT) || 844;

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
      // phone-*.spec.ts asserts viewport-specific geometry that only holds
      // at phone width (see the `phone` project below) — never let this
      // desktop project pick those specs up.
      testIgnore: /phone-.*\.spec\.ts/,
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
    {
      name: 'phone',
      // Only this project runs phone-*.spec.ts — see header comment.
      testMatch: /phone-.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // Must come AFTER the devices['Desktop Chrome'] spread — see the
        // `chromium` project's comment above. Corporate theme drops to the
        // bottom Tabs shell below theme.breakpoints.DEFAULT_MIN_WIDTH (768)
        // — pin a phone-portrait viewport so that shell, the stacked MCQ
        // layout, and the 16:9 lesson video are all actually exercised.
        // Overridable (see header comment) for the mutation-proof: pointing
        // this at desktop dimensions puts corporate back on the nav rail
        // and the video back to full-height, which this spec's assertions
        // should then fail against.
        viewport: { width: PHONE_WIDTH, height: PHONE_HEIGHT },
      },
    },
  ],
  metadata: { expoWebUrl: EXPO_WEB_URL },
});
