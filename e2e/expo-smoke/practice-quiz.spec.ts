/**
 * Practice & quiz — catches: MCQ options failing to render or submit (e.g.
 * a disabled/hidden question row), the result popup not appearing after
 * submit, the quiz's final-question handoff to the result screen breaking,
 * and per-question feedback (questionfeedback) either not reaching the
 * popup when seeded or leaking/bleeding into questions that have none.
 *
 * All tests are independent (each does its own login + drilldown) on
 * purpose: the first two used to share one login/navigation via a shared
 * `page` and `beforeAll`, which meant the quiz test — the deeper, more
 * valuable assertion — silently never ran whenever the practice test above
 * it failed. Paying for a second login is cheap; losing that coverage
 * exactly when something is broken is not.
 */
import { test, expect, Page } from '@playwright/test';
import {
  CORPORATE_STUDENT,
  KM,
  Q1_FEEDBACK,
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

    // This is q1 (see seed-dcrs-content.js in both API repos), the one
    // question in the whole DCRS fixture seeded with questionfeedback.
    // PracticeScreen.tsx reads currentQuestion.question.questionobject
    // .questionfeedback and, when present, passes it to ResultPopUp as
    // customMessages — which then wins over the generic i18n copy (see
    // ResultPopUp.tsx: `customMessages?.incorrectMessage || t(...)`).
    // Asserting the exact seeded Khmer string (not just "some text changed")
    // is what proves that wiring, not just that a popup rendered. exact:
    // true matters here — the custom string deliberately starts with the
    // same words as the generic fallback ("ល្អណាស់!") so a substring match
    // could not tell them apart.
    await expect(
      page.getByText(Q1_FEEDBACK.incorrectMessage, { exact: true }),
    ).toBeVisible();
    // And the generic fallback text must NOT be showing instead/alongside —
    // guards against a regression that ignores questionfeedback and always
    // renders the generic copy (which would otherwise satisfy the assertion
    // above only coincidentally, if the two ever collided).
    await expect(
      page.getByText(KM.genericIncorrectMessage, { exact: true }),
    ).not.toBeVisible();
  });

  test('practice: a question with NO feedback still shows the generic message', async () => {
    // Fresh login + fresh navigation, same reasoning as the other two tests
    // in this file. Targets lesson 2 ("Your business vision" / q2), which
    // seed-dcrs-content.js deliberately leaves with questionfeedback = null
    // — the negative case for the assertion above, proving ResultPopUp's
    // fallback (`customMessages?.incorrectMessage || t(...)`) still renders
    // the generic i18n string when there is no per-question feedback to show.
    await loginViaExpoUi(page, CORPORATE_STUDENT.username, CORPORATE_STUDENT.password);
    await goToFirstDcrsLessonActivities(page, 'Your business vision');

    await page
      .getByRole('button')
      .filter({ hasText: 'Your business vision practice' })
      .first()
      .click();

    // "We ran out of ice this morning." is q2's seeded incorrect option (see
    // seed-dcrs-content.js) — picked explicitly, not getByRole('radio').first(),
    // for the same shuffle reason as the q1 test above.
    await page
      .getByRole('radio', { name: 'We ran out of ice this morning.' })
      .click();
    await page.getByRole('button', { name: KM.submitButton }).click();

    await expect(page.getByText(KM.incorrectTitle, { exact: true })).toBeVisible();
    await expect(
      page.getByText(KM.genericIncorrectMessage, { exact: true }),
    ).toBeVisible();
    // Confirms this really is the fallback path, not q1's custom text
    // leaking in from stale state.
    await expect(
      page.getByText(Q1_FEEDBACK.incorrectMessage, { exact: true }),
    ).not.toBeVisible();
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
