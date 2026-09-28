/**
 * Practice & quiz — catches: MCQ options failing to render or submit (e.g.
 * a disabled/hidden question row), the result popup not appearing after
 * submit, the quiz's final-question handoff to the result screen breaking,
 * per-question feedback (questionfeedback) either not reaching the popup
 * when seeded or leaking/bleeding into questions that have none, and (added
 * for the child app bar rework) the corporate Quiz screen's header showing
 * the quiz's own seeded name instead of the literal 'Quiz' fallback — see
 * the quiz test's own comment. Also covers the WCAG target-size pass (audit
 * U-07-adjacent): the ResultPopUp button and the Result screen's "Done"
 * button both regressing from `fullWidth` back to a content-hugging width —
 * see each assertion's own comment for the live geometry it's proved
 * against.
 *
 * All tests are independent (each does its own login + drilldown) on
 * purpose: the first two used to share one login/navigation via a shared
 * `page` and `beforeAll`, which meant the quiz test — the deeper, more
 * valuable assertion — silently never ran whenever the practice test above
 * it failed. Paying for a second login is cheap; losing that coverage
 * exactly when something is broken is not.
 */
import { test, expect, Page } from "@playwright/test";
import {
  CORPORATE_STUDENT,
  KM,
  Q1_FEEDBACK,
  RESULT_POPUP_BUTTON,
  goToFirstDcrsLessonActivities,
  loginViaExpoUi,
} from "./fixtures";

test.describe("expo web practice & quiz (corporate / DCRS)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("practice: tapping an MCQ option and submitting shows the result popup", async () => {
    await loginViaExpoUi(
      page,
      CORPORATE_STUDENT.username,
      CORPORATE_STUDENT.password
    );
    await goToFirstDcrsLessonActivities(page);

    // Fixed seed:dcrs content: lesson 1's single practice. v2.1
    // (edtech-expo #93/#94) no longer titles the row "<lesson name>
    // practice" — LessonStepRow's title is pre-composed from question_count
    // alone — so it's located by its stable `activity-row-practice-<id>`
    // testID instead (ID.practice1, c0000000-0000-4000-8000-000000000014,
    // from both API repos' scripts/seed-dcrs-content.js, kept in lockstep;
    // see drilldown.spec.ts's own comment on the same change).
    await page
      .locator(
        '[data-testid="activity-row-practice-c0000000-0000-4000-8000-000000000014"]'
      )
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
    await page
      .getByRole("radio", { name: "Family and staff pull the same way" })
      .click();
    await page.getByRole("button", { name: KM.submitButton }).click();

    // Exact incorrect title from km.json — deterministic now that the
    // answer above is deterministic.
    await expect(
      page.getByText(KM.incorrectTitle, { exact: true })
    ).toBeVisible();

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
      page.getByText(Q1_FEEDBACK.incorrectMessage, { exact: true })
    ).toBeVisible();
    // And the generic fallback text must NOT be showing instead/alongside —
    // guards against a regression that ignores questionfeedback and always
    // renders the generic copy (which would otherwise satisfy the assertion
    // above only coincidentally, if the two ever collided).
    await expect(
      page.getByText(KM.genericIncorrectMessage, { exact: true })
    ).not.toBeVisible();

    // WCAG target-size pass (audit U-07-adjacent, edtech-expo
    // ResultPopUp.tsx, corporate-only): the popup's AppButton now carries
    // `fullWidth`, so it spans the dialog's own padded content box instead
    // of hugging its label. Locate the dialog as the button's own ancestor
    // with computed `minWidth: '356px'` (ResultPopUp.tsx's own
    // `minWidth: 356`) rather than an RN-web class name — those atomic
    // classes aren't stable locators. Confirmed live at 1280x800: the
    // popup button (RESULT_POPUP_BUTTON, currently KM.incorrectButton)
    // measures 362.66px wide inside a 426.66px-wide dialog —
    // (426.66 - 64) == 362.66 to the pixel, i.e. the button exactly fills
    // the dialog's content box once its 32px-a-side padding
    // (`theme.layouts.large * 2`) is subtracted. 0.8x is a floor
    // comfortably under that, but still well above what a content-hugging
    // (non-fullWidth) button renders for this label.
    const popupButton = page.getByRole("button", { name: RESULT_POPUP_BUTTON });
    await expect(popupButton).toBeVisible();
    const popupBox = await popupButton.boundingBox();
    expect(popupBox).not.toBeNull();
    const dialogWidth = await popupButton.evaluate((btn) => {
      let el: Element | null = btn;
      while (el && getComputedStyle(el).minWidth !== "356px") {
        el = el.parentElement;
      }
      return el ? el.getBoundingClientRect().width : null;
    });
    expect(dialogWidth).not.toBeNull();
    expect(popupBox!.width).toBeGreaterThanOrEqual(0.8 * (dialogWidth! - 64));
  });

  test("practice: a question with NO feedback still shows the generic message", async () => {
    // Fresh login + fresh navigation, same reasoning as the other two tests
    // in this file. Targets lesson 2 ("Your business vision" / q2), which
    // seed-dcrs-content.js deliberately leaves with questionfeedback = null
    // — the negative case for the assertion above, proving ResultPopUp's
    // fallback (`customMessages?.incorrectMessage || t(...)`) still renders
    // the generic i18n string when there is no per-question feedback to show.
    await loginViaExpoUi(
      page,
      CORPORATE_STUDENT.username,
      CORPORATE_STUDENT.password
    );
    await goToFirstDcrsLessonActivities(page, "Your business vision");

    // v2.1: located by testID, not the retired "<lesson name> practice"
    // row title — see the practice test above's own comment.
    // ID.practice2, c0000000-0000-4000-8000-000000000015.
    await page
      .locator(
        '[data-testid="activity-row-practice-c0000000-0000-4000-8000-000000000015"]'
      )
      .click();

    // "We ran out of ice this morning." is q2's seeded incorrect option (see
    // seed-dcrs-content.js) — picked explicitly, not getByRole('radio').first(),
    // for the same shuffle reason as the q1 test above.
    await page
      .getByRole("radio", { name: "We ran out of ice this morning." })
      .click();
    await page.getByRole("button", { name: KM.submitButton }).click();

    await expect(
      page.getByText(KM.incorrectTitle, { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText(KM.genericIncorrectMessage, { exact: true })
    ).toBeVisible();
    // Confirms this really is the fallback path, not q1's custom text
    // leaking in from stale state.
    await expect(
      page.getByText(Q1_FEEDBACK.incorrectMessage, { exact: true })
    ).not.toBeVisible();
  });

  test("quiz: answering every question reaches the result screen", async () => {
    // Fresh login + fresh navigation — see header comment: this does not
    // depend on the practice test above having run or passed.
    await loginViaExpoUi(
      page,
      CORPORATE_STUDENT.username,
      CORPORATE_STUDENT.password
    );
    await goToFirstDcrsLessonActivities(page);

    // Fixed seed:dcrs content: lesson 1's single quiz. v2.1: located by
    // testID, not the retired "<lesson name> quiz" row title — see the
    // practice test above's own comment. ID.quiz1,
    // c0000000-0000-4000-8000-000000000018.
    await page
      .locator(
        '[data-testid="activity-row-quiz-c0000000-0000-4000-8000-000000000018"]'
      )
      .click();

    // Guards QuizScreen.tsx's navigation.setOptions title spread
    // (`isCorporate && lessonquizname ? { title: lessonquizname } : {}`,
    // run in a useEffect keyed on `navigation` at mount): the corporate
    // Quiz screen's react-navigation header must show the quiz's own
    // seeded name, not the literal 'Quiz' the (home)/_layout.tsx
    // Stack.Screen falls back to only as its pre-mount default (that
    // fallback is deliberately kept literal for the kids theme, which never
    // sets this title — see _layout.tsx's own comment). lessonquizname for
    // lesson 1's quiz is `${lessonname} quiz` from both API repos'
    // seed-dcrs-content.js (`INSERT INTO lessonquizzes ...
    // lessonquizname`) — "Why direction matters quiz", the exact string
    // this test already clicks by above. Confirmed live at 1280x800: the
    // only role="heading" on this screen reads "Why direction matters
    // quiz"; no heading reads the bare "Quiz" fallback. exact: true matters
    // here — Playwright's getByRole `name` is a substring match by
    // default, so without it a mutation that appends to lessonquizname
    // (the mutation-proof lever below) would still satisfy a bare
    // substring check; confirmed live the mutation-proof failed to catch
    // that regression until exact: true was added.
    await expect(
      page.getByRole("heading", {
        name: "Why direction matters quiz",
        exact: true,
      })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Quiz", exact: true })
    ).toHaveCount(0);

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
    const totalQuestions = Number(progressText.split("/")[1].trim());
    expect(totalQuestions).toBeGreaterThan(0);

    // QuizScreen advances to the next question (or to /home/result after the
    // last one) regardless of whether the answer was correct — unlike
    // PracticeScreen (see the practice test above), QuizScreen's
    // handleSubmitPress always shows the result popup before any
    // navigation, so answering with whichever option comes first is safe
    // here even though options are shuffled.
    for (let i = 0; i < totalQuestions; i++) {
      await page.getByRole("radio").first().click();
      await page.getByRole("button", { name: KM.submitButton }).click();
      await page.getByRole("button", { name: RESULT_POPUP_BUTTON }).click();
    }

    await expect(page).toHaveURL(/\/home\/result/);
    await expect(
      page.getByRole("heading", { name: KM.resultHeader })
    ).toBeVisible();

    // Same WCAG target-size / full-width pass, ResultScreen.tsx's corporate
    // branch (audit U-07, "Full-width CTA like Level Detail's Continue
    // button"): the "រួចរាល់" (Done) button sits inside
    // `<View style={{ alignSelf: 'stretch' }}>` with `fullWidth`, so it
    // spans that View's width rather than hugging its label. Locate "the
    // content" as the nearest ancestor strictly wider than the button
    // itself — same reasoning as the dialog-locator above, RN-web's atomic
    // class names aren't stable handles, and walking up avoids hard-coding
    // Container's own DOM shape. Confirmed live at 1280x800: the Done
    // button measures 1160px wide inside a 1192px-wide ancestor
    // (Container's own box — the 32px gap is
    // `theme.layouts.pageHorizontalPadding`, 16px a side, Metrics.ts) —
    // comfortably over the 0.8x floor. The extra >=400px floor is a second,
    // independent net: confirmed live a content-hugging (non-fullWidth)
    // "រួចរាល់" button renders far under 400px, so this still fails hard
    // even if the ancestor-walk above ever landed on an unexpected element.
    const doneButton = page.getByRole("button", { name: KM.finishButton });
    await expect(doneButton).toBeVisible();
    const doneBox = await doneButton.boundingBox();
    expect(doneBox).not.toBeNull();
    const contentWidth = await doneButton.evaluate((btn) => {
      const btnWidth = btn.getBoundingClientRect().width;
      let el: Element | null = btn.parentElement;
      while (el && el.getBoundingClientRect().width <= btnWidth + 1) {
        el = el.parentElement;
      }
      return el ? el.getBoundingClientRect().width : null;
    });
    expect(contentWidth).not.toBeNull();
    expect(doneBox!.width).toBeGreaterThanOrEqual(0.8 * contentWidth!);
    expect(doneBox!.width).toBeGreaterThanOrEqual(400);
  });
});
