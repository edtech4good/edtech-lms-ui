/**
 * Practice & quiz — catches: MCQ options failing to render or submit (e.g.
 * a disabled/hidden question row), the result popup not appearing after
 * submit, or the quiz's final-question handoff to the result screen
 * breaking.
 *
 * The two tests are independent (each does its own login + drilldown) on
 * purpose: they used to share one login/navigation via a shared `page` and
 * `beforeAll`, which meant the quiz test — the deeper, more valuable
 * assertion — silently never ran whenever the practice test above it
 * failed. Paying for a second login is cheap; losing that coverage exactly
 * when something is broken is not.
 */
import { test, expect, Page } from '@playwright/test';
import {
  CORPORATE_STUDENT,
  KM,
  RESULT_POPUP_BUTTON,
  goToFirstDcrsLessonActivities,
  loginViaExpoUi,
} from './fixtures';

test.describe('expo web practice & quiz (corporate / DCRS)', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test('practice: tapping an MCQ option and submitting shows the result popup', async () => {
    await loginViaExpoUi(page, CORPORATE_STUDENT.username, CORPORATE_STUDENT.password);
    await goToFirstDcrsLessonActivities(page);

    // Fixed seed:dcrs content: lesson 1's single practice.
    await page
      .getByRole('button')
      .filter({ hasText: 'Why direction matters practice' })
      .first()
      .click();

    // Deliberately pick the known-WRONG seeded option, not
    // getByRole('radio').first() — PracticeMCQText.tsx shuffles option order
    // per mount (_.shuffle), so "first" is effectively random. That matters
    // here because of a real app bug (PracticeScreen.tsx handleSubmitPress):
    // on the *last* question, a *correct* answer calls router.back() before
    // the result popup ever gets shown — the screen navigates away out from
    // under it. That bug is being tracked/fixed separately (not in this
    // suite's scope, and edtech-expo is read-only from here); picking the
    // wrong option sidesteps it so this spec tests the popup, not that race.
    // "Family and staff pull the same way" is a seeded incorrect option for
    // this question (see edtech-lms-rpi-api's seed:dcrs).
    await page.getByRole('radio', { name: 'Family and staff pull the same way' }).click();
    await page.getByRole('button', { name: KM.submitButton }).click();

    // Exact incorrect title from km.json — deterministic now that the
    // answer above is deterministic.
    await expect(page.getByText(KM.incorrectTitle, { exact: true })).toBeVisible();
  });

  test('quiz: answering every question reaches the result screen', async () => {
    // Fresh login + fresh navigation — see header comment: this does not
    // depend on the practice test above having run or passed.
    await loginViaExpoUi(page, CORPORATE_STUDENT.username, CORPORATE_STUDENT.password);
    await goToFirstDcrsLessonActivities(page);

    // Fixed seed:dcrs content: lesson 1's single quiz.
    await page
      .getByRole('button')
      .filter({ hasText: 'Why direction matters quiz' })
      .first()
      .click();

    // PracticeFooter's corporate branch shows "<current> / <max>" — read the
    // real question count rather than guessing or polling for the result
    // screen mid-loop: the navigator keeps the previous screen mounted
    // (same reason drilldown.spec.ts needs .last() on the section titles),
    // so a stale, still-visible radio from the outgoing question can win a
    // race against the incoming one. A known, exact iteration count sidesteps
    // that instead of trying to detect the transition.
    const progressText = await page
      .getByText(/^\d+\s*\/\s*\d+$/)
      .first()
      .innerText();
    const totalQuestions = Number(progressText.split('/')[1].trim());
    expect(totalQuestions).toBeGreaterThan(0);

    // QuizScreen advances to the next question (or to /home/result after the
    // last one) regardless of whether the answer was correct — unlike
    // PracticeScreen (see the practice test above), QuizScreen's
    // handleSubmitPress always shows the result popup before any
    // navigation, so answering with whichever option comes first is safe
    // here even though options are shuffled.
    for (let i = 0; i < totalQuestions; i++) {
      await page.getByRole('radio').first().click();
      await page.getByRole('button', { name: KM.submitButton }).click();
      await page.getByRole('button', { name: RESULT_POPUP_BUTTON }).click();
    }

    await expect(page).toHaveURL(/\/home\/result/);
    await expect(page.getByRole('heading', { name: KM.resultHeader })).toBeVisible();
  });
});
