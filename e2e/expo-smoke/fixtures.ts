/**
 * Fixtures for the Expo web learner-app smoke suite (e2e/expo-smoke).
 *
 * edtech-expo is a sibling repo (Expo/React Native, not this Angular app).
 * This suite drives its web build (`expo start --web`, localhost:8081 by
 * default) as a black box over HTTP, the same way playwright.config.ts's
 * suite drives the Angular admin app here — it has no access to
 * edtech-expo's source and must never edit it.
 *
 * This suite is meant to graduate into edtech-expo itself once that repo
 * settles on a single package manager (it currently carries both a
 * package-lock.json and a yarn.lock). It lives here in the meantime because
 * this is the repo with a working Playwright setup and the house style
 * (e2e/fixtures/*.ts) to follow.
 *
 * demo.sophea (kids theme / Demo Primary School) and miv.verify (corporate
 * theme / DCRS curriculum) are the designated automation accounts for this
 * suite. Logging in as either writes real progress rows
 * (studentlearningsprogress, studentprogress, etc.) — that is expected, not
 * a leak, and this suite does not attempt to clean it up. Never log in as
 * demo.student or miv.demo here: the rpi API allows one token per user, and
 * those two accounts are in interactive use by others.
 */
import { Page, expect } from '@playwright/test';

/**
 * Shared default password for both automation accounts (both are seeded
 * with `demo`). Overriding this is also the mutation-proof lever for
 * login.spec.ts: `E2E_EXPO_STUDENT_PASS=wrong npm run e2e:expo` breaks both
 * accounts' logins and should turn the "reaches home" assertions red.
 */
const DEFAULT_PASSWORD = process.env.E2E_EXPO_STUDENT_PASS ?? 'demo';

export const KIDS_STUDENT = {
  username: process.env.E2E_EXPO_KIDS_USER ?? 'demo.sophea',
  password: process.env.E2E_EXPO_KIDS_PASS ?? DEFAULT_PASSWORD,
};

export const CORPORATE_STUDENT = {
  username: process.env.E2E_EXPO_CORPORATE_USER ?? 'miv.verify',
  password: process.env.E2E_EXPO_CORPORATE_PASS ?? DEFAULT_PASSWORD,
};

/**
 * Strings copied verbatim from edtech-expo/src/locales/km.json — never
 * hand-typed. The app defaults to Khmer, so these are what a real learner
 * session actually renders.
 */
export const KM = {
  loginButton: 'ចូលគណនី', // screen.login.loginButton
  ok: 'អូខេ', // button.ok
  logout: 'ចាកចេញ', // drawer.logout
  subjectGreeting: 'អរុណសួស្តី', // screen.subject.greeting
  lessonHeader: 'លំហាត់', // screen.lesson.header
  learningTitle: 'សិក្សា', // screen.lesson.learningTitle
  practiceTitle: 'អនុវត្ត', // screen.lesson.practiceTitle
  quizTitle: 'តេស្ត', // screen.lesson.quizTitle
  submitButton: 'បញ្ជូន', // screen.practice.submitButton
  correctButton: 'បន្ទាប់', // screen.practice.correctButton
  incorrectButton: 'សូមព្យាយាមម្តងទៀត', // screen.practice.incorrectButton
  correctTitle: 'អបអរសាទរ!', // screen.practice.correctTitle
  incorrectTitle: 'អូទេ!', // screen.practice.incorrectTitle
  // Generic ResultPopUp body copy (screen.practice.correctMessage /
  // incorrectMessage) — what a learner sees when the answered question has
  // no questionfeedback of its own. ResultPopUp.tsx only reaches these when
  // customMessages is undefined or its corresponding field is falsy.
  genericCorrectMessage: 'ល្អណាស់!', // screen.practice.correctMessage
  genericIncorrectMessage: 'ចម្លើយរបស់អ្នកមិនត្រឹមត្រូវទេ', // screen.practice.incorrectMessage
  resultHeader: 'លទ្ធផល', // screen.result.header
} as const;

/**
 * questionfeedback seeded onto exactly one DCRS question (q1 — "Which of
 * these is a sign of running a business with no plan?", the single question
 * behind both lesson 1's practice AND its quiz) by both
 * edtech-lms-api/scripts/seed-dcrs-content.js and
 * edtech-lms-rpi-api/scripts/seed-dcrs-content.js (kept in lockstep — see
 * comments there). Copied verbatim, not hand-typed a second time, so a typo
 * in one place cannot silently pass against a typo in the other.
 */
export const Q1_FEEDBACK = {
  correctMessage: 'ល្អណាស់! អ្នកយល់ច្បាស់ហើយ។',
  incorrectMessage: 'សាកល្បងម្តងទៀត ហើយពិនិត្យមេរៀនឡើងវិញ។',
} as const;

/** Matches whichever of the two ResultPopUp buttons is currently showing. */
export const RESULT_POPUP_BUTTON = new RegExp(
  `^(${KM.correctButton}|${KM.incorrectButton})$`,
);

/**
 * Logs in through the real form. Both UI themes share the same input types
 * and the same (translated) submit button copy — only the surrounding
 * chrome differs — so one helper covers both. There is no storageState to
 * reuse across contexts the way there is for the Angular admin app (see
 * e2e/fixtures/auth.ts there): this app keeps auth in memory/redux with no
 * persisted state this suite can safely read, so every spec logs in fresh
 * through the UI.
 */
export async function loginViaExpoUi(
  page: Page,
  username: string,
  password: string,
): Promise<void> {
  await page.goto('/');
  // Neither input carries a name/id/testID (confirmed against the live
  // dev build) — type + order is the only stable handle RN-web gives us.
  await page.locator('input[type="text"]').first().fill(username);
  await page.locator('input[type="password"]').first().fill(password);
  // Text, not role: the kids theme's FilledButton (unlike corporate's
  // AppButton) never sets accessibilityRole="button", and which theme is
  // showing here depends on this browser's default/last-touched dev theme
  // pill, not on which account is about to log in — a fresh context (no
  // localStorage) boots kids. getByText works regardless of which one
  // rendered.
  await page.getByText(KM.loginButton, { exact: true }).click();
  await page.waitForURL(/\/home/, { timeout: 15_000 });
}

/**
 * Drives the corporate DCRS drilldown from an already-logged-in home screen
 * (CORPORATE_STUDENT / miv.verify) down to a lesson's activity list:
 * curriculum → grade → module → lesson. `lessonTitle` matches the lesson
 * card by substring — defaults to lesson 1 ("Why direction matters"), the
 * original and still most-used target. The card titles are the fixed
 * `npm run seed:dcrs` content (edtech-lms-rpi-api) that miv.verify's school
 * is seeded with — confirmed against the running dev stack, not guessed.
 * Every card on the way is a role="button" wrapping its title text.
 */
export async function goToFirstDcrsLessonActivities(
  page: Page,
  lessonTitle = 'Why direction matters',
): Promise<void> {
  await page.getByRole('button').filter({ hasText: 'DCRS' }).first().click();
  await page.getByRole('button').filter({ hasText: 'Cohort II' }).first().click();
  await page.getByRole('button').filter({ hasText: 'Module 1' }).first().click();
  await page
    .getByRole('button')
    .filter({ hasText: lessonTitle })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: KM.lessonHeader })).toBeVisible();
}
