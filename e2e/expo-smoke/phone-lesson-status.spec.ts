/**
 * Lesson status icons — regression net for the LessonRow status-icon rework
 * (edtech-expo, branch feat/lesson-status-icons): status glyphs replace the
 * old blue play disc on both the corporate Level Detail screen (Module N
 * lesson list) and the lesson activity list.
 *
 * Runs under the `phone` playwright project (this file's name matches
 * phone-*.spec.ts — see playwright.expo.config.ts's own header comment),
 * whose 390x844-by-default viewport comes from
 * EXPO_E2E_PHONE_WIDTH/EXPO_E2E_PHONE_HEIGHT rather than a hard-coded
 * viewport here — LessonRow's 2px border/CTA pill and the footer button are
 * the phone/tablet corporate Level Detail per the handoff, so this file
 * relies on the project's own viewport instead of pinning one itself.
 *
 * This spec compares the on-screen lesson rows against the same
 * `GET .../lesson/level/<levelId>` response the Level Detail screen itself
 * loads, rather than checking each row is merely self-consistent — a
 * mutation proof (forcing every lesson's status to "todo") showed an
 * earlier version of this spec was decorative for the status mapping.
 *
 * Updated for design v2.1 (source read directly, not from memory, in
 * edtech-expo's feat/lesson-status-icons branch):
 *  - src/components/ui/StatusIcon.tsx: a 4th status, `upNext`, is a filled
 *    primary disc with a white forward arrow (not a play triangle). It is
 *    used ONLY for the up-next row: LessonRow.tsx renders
 *    `<StatusIcon status={isNext ? 'upNext' : status} />`, so the up-next
 *    row's testID is always `status-icon-upNext` regardless of its own
 *    completed/progress-derived status.
 *  - src/components/ui/LessonRow.tsx: the up-next row shows a `cta-pill`
 *    (isNext && ctaLabel) instead of the plain status word; every other row
 *    shows the plain status word (screen.level.lessonRowStatus.<status>).
 *    The row border is 2px theme.colors.primary when isNext, else 1px
 *    theme.colors.divider — and the component's own comment states no row
 *    ever gets a shadow/glow ("the handoff's one screen glow is reserved
 *    for the footer CTA").
 *  - src/screens/LevelSelection/LevelSelectionScreen.tsx: the pill's own
 *    text is `t('cta.start')` when the up-next lesson's progress is 0, else
 *    `t('cta.continue')` (km.json's cta.start/cta.continue). The sticky
 *    footer button's text is a DIFFERENT pair of keys —
 *    `t('cta.startLesson', {n})` / `t('cta.continueLesson', {n})`
 *    (km.json's cta.startLesson/cta.continueLesson, each with a `{{n}}`
 *    lesson-number placeholder) — falling back to the plain
 *    cta.start/cta.continue text when the up-next lesson's `lessonorder`
 *    is null/undefined ("Continue Lesson " with a blank number would read
 *    as broken).
 *
 * What's asserted (see edtech-expo's LessonRow.tsx / StatusIcon.tsx /
 * LevelSelectionScreen.tsx / km.json for the source-of-truth
 * strings/testIDs — cross-checked directly against those files before
 * writing this):
 *  - every API lesson has a `lesson-row-<lessonid>` on screen, containing
 *    exactly one status icon: `status-icon-upNext` for the up-next row (the
 *    first not-done lesson by lessonorder), or `status-icon-<expected>`
 *    computed from that lesson's own `completed`/`progress` fields for
 *    every other row (not just "some" status-icon-*)
 *  - the cta-pill appears in exactly the expected up-next row and nowhere
 *    else; no pill at all when every lesson is done
 *  - the pill's own text, and the sticky footer's text, equal the expected
 *    strings derived from the up-next lesson's own progress and
 *    lessonorder (0 progress => start text; >0 => continue text; footer
 *    uses the "...Lesson N" variant when lessonorder is present) — not
 *    just "one of the two known strings agreeing with whatever the pill
 *    happens to say"
 *  - each row's accessibilityLabel STARTS WITH the exact prefix
 *    LessonRow.tsx builds — `${chipLabel}, ${title}, ${statusOrCtaText}, `
 *    (chipLabel = km.json's screen.level.lessonChip with the lesson's own
 *    lessonorder, title = the API's own lessonname, statusOrCtaText = the
 *    up-next row's own pill text or, for every other row, the Khmer status
 *    word for its own expected status). This is a prefix match, not a loose
 *    substring check: km's lessonRowStatus strings share text with each
 *    other (the Start pill text "ចាប់ផ្ដើម" is itself a substring of the
 *    todo word "មិនទាន់ចាប់ផ្ដើម") and the label's own step-description
 *    tail can contain other status words, so a bare `.includes()` check
 *    would pass even with the wrong word substituted — confirmed while
 *    fixing this spec, where the original substring checks stayed green
 *    under a mutation that swapped the status/CTA word.
 *  - no accessibilityLabel contains the literal string "undefined" (guards
 *    the template's `${chipLabel}, ${title}, ${statusOrCtaText}, ...`
 *    against any of those being unset)
 *  - the actual on-screen text: the up-next row shows its own expected pill
 *    text exactly once (`getByText(..., { exact: true })`), and every other
 *    row shows its own expected Khmer status word exactly once — not just
 *    that the aria-label mentions it
 *  - no lesson row (up-next or not) has any box-shadow/glow: computed via
 *    getComputedStyle in-page, not just a visual check
 *  - each row's borderTopWidth/borderTopColor longhand (not the border
 *    shorthand, which some browsers report inconsistently for a uniform
 *    4-side border): 2px primary blue (theme.colors.primary, #0B5FFF ->
 *    rgb(11, 95, 255)) for the up-next row, 1px divider grey
 *    (theme.colors.divider, #E3E8EF -> rgb(227, 232, 239)) for every other
 *    row — both confirmed directly against
 *    src/themes/tokens/corporate.ts
 *  - no leftover play-triangle SVG (`<polygon>`, or the specific old
 *    `<path d="M6 4.5v15l14-7.5-14-7.5z">`) inside any lesson-row-* or
 *    activity-row-* — StatusIcon.tsx is Circle/Path-only, no Polygon,
 *    confirmed by reading the file directly
 *  - opening the up-next lesson reaches the activity list (activity-row-*)
 *    with no play-triangle glyph there either
 *
 * NOT exercised by the seed data: the "every lesson done, no up-next" branch
 * (no pill, no sticky footer). miv.verify's DCRS Module 1 always has at
 * least one unfinished lesson, so that branch's assertions (see the `else`
 * near the bottom of the test) have never been observed to run green or
 * red against real data — they guard the contract for whenever the seed
 * does put every lesson in a "done" state, nothing more.
 */
import { test, expect, Page } from "@playwright/test";
import { CORPORATE_STUDENT, KM, loginViaExpoUi } from "./fixtures";

// km.json's screen.level.lessonRowStatus (copied verbatim, not hand-typed a
// second time — cross-checked directly against edtech-expo's km.json around
// line 81-85). Only used for non-up-next rows: the up-next row's status
// word is replaced by the cta-pill text, not this map.
const ROW_STATUS_KM: Record<string, string> = {
  done: "បានបញ្ចប់",
  inProgress: "កំពុងសិក្សា",
  todo: "មិនទាន់ចាប់ផ្ដើម",
};

// cta.start / cta.continue (LessonRow's cta-pill label) — km.json line
// 124-125.
const PILL_START_KM = "ចាប់ផ្ដើម";
const PILL_CONTINUE_KM = "បន្ត";

// cta.startLesson / cta.continueLesson (the sticky footer AppButton's own
// label, with the up-next lesson's own lessonorder interpolated in place
// of "{{n}}") — km.json line 127-128. These are DIFFERENT i18n keys (and
// different Khmer strings) than the pill's cta.start/cta.continue —
// LevelSelectionScreen.tsx uses the "...Lesson N" variant for the footer
// and the plain variant for the pill.
const FOOTER_START_TEMPLATE = "ចាប់ផ្ដើមមេរៀនទី {{n}}";
const FOOTER_CONTINUE_TEMPLATE = "បន្តមេរៀនទី {{n}}";

const OLD_PLAY_PATH_D = "M6 4.5v15l14-7.5-14-7.5z";

// theme.colors.primary (src/themes/tokens/corporate.ts) as the browser's
// computed rgb() — the up-next row's 2px border colour.
const PRIMARY_BORDER_RGB = "rgb(11, 95, 255)";

// theme.colors.divider (src/themes/tokens/corporate.ts, #E3E8EF) as the
// browser's computed rgb() — every non-up-next row's 1px border colour.
const DIVIDER_BORDER_RGB = "rgb(227, 232, 239)";

// GET .../lesson/level/<levelId> — Api.fetchLevels's own path
// (`lesson/level/${unitId}`), no trailing segment. Deliberately does not
// match fetchChapters's `lesson/${lessonId}/learning` (no "level" segment)
// or fetchUnits's `level/grade/${courseId}` (different segment order).
const LEVEL_RESPONSE_URL_RE = /\/lesson\/level\/[^/?]+(?:\?|$)/;

type ApiLesson = {
  lessonid: string;
  lessonname: string;
  lessonorder?: number;
  completed?: boolean;
  progress?: number;
};

// km.json's screen.level.lessonChip ("មេរៀនទី {{n}}") — LevelSelectionScreen.tsx
// builds LessonRow's chipLabel as `t('screen.level.lessonChip', { n:
// item.lessonorder ?? '·' })`, copied verbatim here to build the exact
// accessibilityLabel prefix LessonRow.tsx assembles
// (`${chipLabel}, ${title}, ${statusOrCtaText}, ...`).
const chipLabelFor = (lessonorder: number | undefined): string =>
  `មេរៀនទី ${lessonorder ?? "·"}`;

type ExpectedStatus = "done" | "inProgress" | "todo";

// LevelSelectionScreen.tsx's own isLessonDone/statusFor, copied verbatim
// (not reimplemented from memory) so this spec's "expected" values are
// derived the same way the screen under test derives them.
const isLessonDone = (lesson: ApiLesson): boolean =>
  lesson.completed === true || (lesson.progress ?? 0) >= 100;

const statusFor = (lesson: ApiLesson): ExpectedStatus => {
  if (isLessonDone(lesson)) return "done";
  if ((lesson.progress ?? 0) > 0) return "inProgress";
  return "todo";
};

/** Formats km.json's cta.startLesson/cta.continueLesson templates with a
 *  lesson number, mirroring i18next's `{{n}}` interpolation. */
const formatFooterLesson = (template: string, n: number): string =>
  template.replace("{{n}}", String(n));

/** Asserts no old play-triangle glyph (Polygon, or the specific play Path
 *  string) is present inside `scope`. */
async function assertNoPlayGlyph(scope: ReturnType<Page["locator"]>) {
  const polygonCount = await scope.locator("svg polygon").count();
  expect(polygonCount, "found a <polygon> (old play triangle) glyph").toBe(0);

  const playPathCount = await scope
    .locator(`svg path[d="${OLD_PLAY_PATH_D}"]`)
    .count();
  expect(
    playPathCount,
    "found the old play-triangle <path> (M6 4.5v15l14-7.5-14-7.5z)"
  ).toBe(0);
}

/** Asserts `locator` has no non-`none` computed box-shadow (a real glow, not
 *  merely a visual absence) — used to confirm the handoff's "no glow on any
 *  lesson row" rule holds for both the up-next row and plain rows. */
async function assertNoBoxShadow(
  locator: ReturnType<Page["locator"]>,
  description: string
) {
  const boxShadow = await locator.evaluate(
    (el) => getComputedStyle(el).boxShadow
  );
  expect(
    boxShadow,
    `${description} should have no box-shadow, found "${boxShadow}"`
  ).toBe("none");
}

test.describe("expo web lesson status icons (corporate / DCRS)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // No hard-coded viewport — the `phone` project's own use.viewport
    // (EXPO_E2E_PHONE_WIDTH/HEIGHT, default 390x844) applies, the same way
    // phone-learner-path.spec.ts's beforeAll does.
    const context = await browser.newContext();
    page = await context.newPage();
    await loginViaExpoUi(
      page,
      CORPORATE_STUDENT.username,
      CORPORATE_STUDENT.password
    );
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("module screen: lesson rows reflect the API's own completed/progress data", async () => {
    // Set up BEFORE the click below (the "Module 1" click is what
    // navigates into the Level Detail screen and triggers the fetch) —
    // waiting on this after the fact could race past a fetch that already
    // completed. res.ok() is required so a failed request (e.g. a 401 mid
    // re-login) can't be mistaken for the real payload.
    const levelResponsePromise = page.waitForResponse(
      (res) =>
        res.request().method() === "GET" &&
        LEVEL_RESPONSE_URL_RE.test(res.url()) &&
        res.ok(),
      { timeout: 10_000 }
    );

    // Reaches DCRS -> Cohort II -> Module 1 and stops at the lesson list
    // (Level Detail) screen — same clicks goToFirstDcrsLessonActivities
    // makes, minus the final lesson-row click (mirrors
    // phone-learner-path.spec.ts's "lesson chip uses the contrast token"
    // test, which stops at this same screen the same way). "Module 1" is
    // matched with a word-boundary regex, not a bare substring, so it can't
    // also match a future "Module 10" card.
    await page.getByRole("button").filter({ hasText: "DCRS" }).first().click();
    await page
      .getByRole("button")
      .filter({ hasText: "Cohort II" })
      .first()
      .click();
    await page
      .getByRole("button")
      .filter({ hasText: /\bModule 1\b/ })
      .first()
      .click();

    const body = await (await levelResponsePromise).json();

    const lessonRows = page.locator('[data-testid^="lesson-row-"]');
    await expect(lessonRows.first()).toBeVisible();

    const apiLessons: ApiLesson[] = body?.data?.lesson ?? [];
    expect(
      apiLessons.length,
      "expected at least one lesson in the captured API response"
    ).toBeGreaterThan(0);

    const sortedApiLessons = [...apiLessons].sort(
      (a, b) => (a.lessonorder ?? 0) - (b.lessonorder ?? 0)
    );
    const expectedUpNext = sortedApiLessons.find((l) => !isLessonDone(l));
    const expectedUpNextProgress = expectedUpNext?.progress ?? 0;
    const expectedPillText =
      expectedUpNextProgress > 0 ? PILL_CONTINUE_KM : PILL_START_KM;
    const expectedUpNextOrder = expectedUpNext?.lessonorder;
    // Footer falls back to the plain pill text when lessonorder is missing
    // (LevelSelectionScreen.tsx's footerCtaLabel fallback).
    const expectedFooterText =
      expectedUpNextOrder != null
        ? formatFooterLesson(
            expectedUpNextProgress > 0
              ? FOOTER_CONTINUE_TEMPLATE
              : FOOTER_START_TEMPLATE,
            expectedUpNextOrder
          )
        : expectedPillText;

    // eslint-disable-next-line no-console
    console.log(
      `[lesson-status] API ground truth: ${JSON.stringify(
        sortedApiLessons.map((l) => ({
          lessonid: l.lessonid,
          lessonorder: l.lessonorder,
          completed: l.completed,
          progress: l.progress,
          expectedStatus: statusFor(l),
        }))
      )}`
    );
    // eslint-disable-next-line no-console
    console.log(
      `[lesson-status] expected up-next: ${
        expectedUpNext?.lessonid ?? "(none — all done)"
      }, expected pill text: ${
        expectedUpNext ? expectedPillText : "(no pill)"
      }, expected footer text: ${
        expectedUpNext ? expectedFooterText : "(no footer)"
      }`
    );

    await expect(
      lessonRows,
      `DOM row count should equal the API lesson count (${apiLessons.length})`
    ).toHaveCount(apiLessons.length);
    const rowCount = await lessonRows.count();

    const observedStatuses: string[] = [];
    let pillRows = 0;

    for (const apiLesson of sortedApiLessons) {
      const expectedStatus = statusFor(apiLesson);
      const isExpectedUpNext = expectedUpNext?.lessonid === apiLesson.lessonid;
      const row = page.locator(
        `[data-testid="lesson-row-${apiLesson.lessonid}"]`
      );
      await expect(
        row,
        `expected a lesson-row-${apiLesson.lessonid} on screen for this API lesson`
      ).toHaveCount(1);

      // No row — up-next or not — gets a box-shadow/glow (LessonRow.tsx's
      // own comment: "the handoff's one screen glow is reserved for the
      // footer CTA").
      await assertNoBoxShadow(row, `lesson-row-${apiLesson.lessonid}`);

      // Exactly one status-icon-* inside this row. The up-next row always
      // shows status-icon-upNext (LessonRow.tsx passes
      // `isNext ? 'upNext' : status`), regardless of its own
      // completed/progress-derived status; every other row shows the icon
      // computed from its own completed/progress fields.
      const statusIcons = row.locator('[data-testid^="status-icon-"]');
      await expect(
        statusIcons,
        `lesson-row-${apiLesson.lessonid} should have exactly one status icon`
      ).toHaveCount(1);
      const expectedIconStatus = isExpectedUpNext ? "upNext" : expectedStatus;
      const expectedIcon = row.locator(
        `[data-testid="status-icon-${expectedIconStatus}"]`
      );
      await expect(
        expectedIcon,
        `lesson-row-${apiLesson.lessonid} (completed=${apiLesson.completed}, progress=${apiLesson.progress}, isUpNext=${isExpectedUpNext}) should show status-icon-${expectedIconStatus}, the icon actually shown did not match`
      ).toHaveCount(1);
      observedStatuses.push(expectedStatus);

      // Border: LessonRow.tsx sets borderWidth/borderColor on all four
      // sides; the top edge is checked as a representative longhand, which
      // browsers report consistently where the shorthands may not.
      const { borderTopWidth, borderTopColor } = await row.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          borderTopWidth: style.borderTopWidth,
          borderTopColor: style.borderTopColor,
        };
      });
      if (isExpectedUpNext) {
        // The up-next row's border is 2px, primary blue.
        expect(
          borderTopWidth,
          `up-next lesson-row-${apiLesson.lessonid}'s borderTopWidth should be 2px, found "${borderTopWidth}"`
        ).toBe("2px");
        expect(
          borderTopColor,
          `up-next lesson-row-${apiLesson.lessonid}'s borderTopColor should be the primary blue (${PRIMARY_BORDER_RGB}), found "${borderTopColor}"`
        ).toBe(PRIMARY_BORDER_RGB);
      } else {
        // Every other row's border is 1px, the divider colour.
        expect(
          borderTopWidth,
          `lesson-row-${apiLesson.lessonid}'s borderTopWidth should be 1px, found "${borderTopWidth}"`
        ).toBe("1px");
        expect(
          borderTopColor,
          `lesson-row-${apiLesson.lessonid}'s borderTopColor should be the divider colour (${DIVIDER_BORDER_RGB}), found "${borderTopColor}"`
        ).toBe(DIVIDER_BORDER_RGB);
      }

      // No play-triangle glyph anywhere in this row.
      await assertNoPlayGlyph(row);

      // aria-label sanity: no literal "undefined".
      const label = await row.getAttribute("aria-label");
      expect(
        label,
        `lesson-row-${apiLesson.lessonid} should carry an aria-label`
      ).not.toBeNull();
      expect(
        (label as string).includes("undefined"),
        `lesson-row-${apiLesson.lessonid}'s aria-label contains the literal string "undefined": "${label}"`
      ).toBe(false);

      // The cta-pill must appear in this row iff it is the expected
      // up-next row — not just "at most one per row, somewhere". Non-up-next
      // rows show the plain status word instead (no pill).
      const pill = row.locator('[data-testid="cta-pill"]');
      const pillCount = await pill.count();
      expect(
        pillCount,
        `lesson-row-${apiLesson.lessonid} cta-pill presence (${pillCount}) should match up-next expectation (${
          isExpectedUpNext ? 1 : 0
        })`
      ).toBe(isExpectedUpNext ? 1 : 0);

      // aria-label prefix, anchored exactly as LessonRow.tsx builds it
      // (`${chipLabel}, ${title}, ${statusOrCtaText}, ${stepsDescription}`)
      // — NOT a loose substring check. A loose check is vacuous here: the
      // Start pill text ("ចាប់ផ្ដើម") is a substring of the not-started word
      // ("មិនទាន់ចាប់ផ្ដើម"), and every label ends with the step description,
      // which reuses the done / not-started words. Anchoring on the exact
      // prefix (chip, title, word) rules both out.
      const chip = chipLabelFor(apiLesson.lessonorder);
      const word = isExpectedUpNext ? expectedPillText : ROW_STATUS_KM[expectedStatus];
      const expectedPrefix = `${chip}, ${apiLesson.lessonname}, ${word}, `;
      expect(
        (label as string).startsWith(expectedPrefix),
        `lesson-row-${apiLesson.lessonid}'s aria-label "${label}" should start with "${expectedPrefix}"`
      ).toBe(true);

      // The status word / pill text in the row: exactly one exact-match
      // occurrence (toHaveCount counts DOM matches, visible or not).
      if (isExpectedUpNext) {
        pillRows++;
        await expect(
          row.getByText(expectedPillText, { exact: true }),
          `up-next lesson-row-${apiLesson.lessonid} should show the pill text "${expectedPillText}" exactly once`
        ).toHaveCount(1);
      } else {
        await expect(
          row.getByText(ROW_STATUS_KM[expectedStatus], { exact: true }),
          `lesson-row-${apiLesson.lessonid} should show the status word "${ROW_STATUS_KM[expectedStatus]}" exactly once`
        ).toHaveCount(1);
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `[lesson-status] observed ${rowCount} lesson row(s), statuses: ${JSON.stringify(
        observedStatuses
      )}`
    );
    for (const state of ["done", "inProgress", "todo"] as const) {
      const occurred = observedStatuses.includes(state);
      // eslint-disable-next-line no-console
      console.log(
        `[lesson-status] status "${state}" ${
          occurred ? "occurred" : "did NOT occur"
        } in the observed data`
      );
    }

    expect(
      pillRows,
      expectedUpNext
        ? "expected exactly the up-next row to show a cta-pill"
        : "expected no cta-pill when every lesson is done (per the API data)"
    ).toBe(expectedUpNext ? 1 : 0);

    // Footer button: only rendered when there's an upNext lesson (i.e. not
    // every lesson is done, per the API). Its text must equal the expected
    // "...Lesson N" (or plain fallback) string derived from the up-next
    // lesson's own progress and lessonorder.
    if (expectedUpNext) {
      const footerButton = page.getByRole("button", {
        name: expectedFooterText,
        exact: true,
      });
      await expect(footerButton).toBeVisible();
      const footerText = (await footerButton.innerText()).trim();
      expect(
        footerText,
        `footer text should equal the expected text derived from the up-next lesson's own progress (${expectedUpNext.progress}) and lessonorder (${expectedUpNext.lessonorder})`
      ).toBe(expectedFooterText);

      // Screenshots: module screen, plus a zoom crop of the up-next status
      // icon.
      await page.screenshot({
        path: test.info().outputPath("module.png"),
        fullPage: true,
      });
      const upNextRowForCrop = page.locator(
        `[data-testid="lesson-row-${expectedUpNext.lessonid}"]`
      );
      const iconBox = await upNextRowForCrop
        .locator('[data-testid="status-icon-upNext"]')
        .boundingBox();
      if (iconBox) {
        await page.screenshot({
          path: test.info().outputPath("status-icon-crop.png"),
          clip: {
            x: Math.max(0, iconBox.x - 8),
            y: Math.max(0, iconBox.y - 8),
            width: iconBox.width + 16,
            height: iconBox.height + 16,
          },
        });
      }

      // Open the up-next lesson: tap its row (the whole row is the
      // Pressable target — LessonRow.tsx sets onPress on the row itself,
      // not the pill).
      const upNextRow = page.locator(
        `[data-testid="lesson-row-${expectedUpNext.lessonid}"]`
      );
      await upNextRow.click();
      // v2.1 (edtech-expo #93/#94, localhost:8091) drops the Lesson
      // screen's own app-bar title (screen.lesson.header / KM.lessonHeader)
      // — the app-bar shows only a back chevron now (see
      // goToFirstDcrsLessonActivities's and phone-in-lesson-status.spec.ts's
      // own comments on the same change). Assert the "In this lesson"
      // heading text (screen.lesson.inThisLesson, a plain Text with no
      // accessibilityRole) instead, confirming the navigation actually
      // landed on the Lesson screen.
      await expect(
        page.getByText("នៅក្នុងមេរៀននេះ", { exact: true })
      ).toBeVisible();
    } else {
      // Every lesson is already done per the API — no incomplete lesson,
      // so LevelSelectionScreen renders no pill and no sticky footer.
      // NOT currently exercised by the seed data (miv.verify's DCRS
      // Module 1 always has unfinished lessons), so this branch has not
      // been observed to run green or red — it only guards the contract
      // for whenever the seed does put every lesson in a "done" state.
      await expect(
        page.getByRole("button", {
          name: new RegExp(
            `^(${PILL_START_KM}|${PILL_CONTINUE_KM}|${FOOTER_START_TEMPLATE.replace(
              "{{n}}",
              "\\d+"
            )}|${FOOTER_CONTINUE_TEMPLATE.replace("{{n}}", "\\d+")})$`
          ),
        })
      ).toHaveCount(0);

      await page.screenshot({
        path: test.info().outputPath("module.png"),
        fullPage: true,
      });
      // No up-next row to open — fall back to the first lesson by
      // lessonorder (sortedApiLessons[0]) so the activity-list assertions
      // below still run, using the same lesson-row-<id> testID the loop
      // above already validated, not a hard-coded lesson title.
      await page
        .locator(`[data-testid="lesson-row-${sortedApiLessons[0].lessonid}"]`)
        .click();
      // v2.1 drops the Lesson screen's app-bar title — see the up-next
      // branch's own comment above for the full explanation.
      await expect(
        page.getByText("នៅក្នុងមេរៀននេះ", { exact: true })
      ).toBeVisible();
    }

    // Activity list: activity-row-* present, no play glyph anywhere.
    const activityRows = page.locator('[data-testid^="activity-row-"]');
    await expect(activityRows.first()).toBeVisible();
    const activityRowCount = await activityRows.count();
    expect(
      activityRowCount,
      "expected at least one activity row"
    ).toBeGreaterThan(0);
    for (let i = 0; i < activityRowCount; i++) {
      await assertNoPlayGlyph(activityRows.nth(i));
    }

    await page.screenshot({
      path: test.info().outputPath("activities.png"),
      fullPage: true,
    });
  });
});
