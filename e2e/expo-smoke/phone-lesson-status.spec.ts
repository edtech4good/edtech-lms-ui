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
 * What's asserted (see edtech-expo's LessonRow.tsx / StatusIcon.tsx /
 * CtaPill.tsx / LevelSelectionScreen.tsx / km.json for the source-of-truth
 * strings/testIDs — cross-checked directly against those files before
 * writing this):
 *  - every API lesson has a `lesson-row-<lessonid>` on screen, containing
 *    exactly the `status-icon-<expected>` computed from that lesson's own
 *    `completed`/`progress` fields (not just "some" status-icon-*)
 *  - the cta-pill appears in exactly the expected up-next row (the first
 *    not-done lesson by lessonorder) and nowhere else; no pill at all when
 *    every lesson is done
 *  - the pill's own text, and the sticky footer's text, equal the expected
 *    strings derived from the up-next lesson's own progress (0 => start;
 *    >0 => continue) — not just "one of the two known strings agreeing
 *    with whatever the pill happens to say"
 *  - the pill row's own accessibilityLabel contains the pill's own label
 *    text (LessonRow.tsx's accessibilityLabel template appends
 *    `, ${ctaLabel}` only when showCta)
 *  - each row's accessibilityLabel contains the Khmer status string matching
 *    its status-icon testID (km.json's screen.level.lessonRowStatus)
 *  - no accessibilityLabel contains the literal string "undefined" (guards
 *    the template's `${chipLabel}, ${title}, ${rowStatusText}, ...` against
 *    any of those being unset)
 *  - no leftover play-triangle SVG (`<polygon>`, or the specific old
 *    `<path d="M6 4.5v15l14-7.5-14-7.5z">`) inside any lesson-row-* or
 *    activity-row-* — StatusIcon.tsx and CtaPill's ChevronIcon are both
 *    Circle/Path-only, no Polygon, confirmed by reading both files directly
 *  - opening the up-next lesson reaches the activity list (activity-row-*)
 *    with no play-triangle glyph there either
 */
import { test, expect, Page } from "@playwright/test";
import { CORPORATE_STUDENT, KM, loginViaExpoUi } from "./fixtures";

// km.json's screen.level.lessonRowStatus (copied verbatim, not hand-typed a
// second time — cross-checked directly against edtech-expo's km.json at
// src/locales/km.json around line 82).
const ROW_STATUS_KM: Record<string, string> = {
  done: "បានបញ្ចប់",
  inProgress: "កំពុងសិក្សា",
  todo: "មិនទាន់ចាប់ផ្ដើម",
};

// cta.start / cta.continue (LessonRow's CtaPill label) — km.json around
// line 123.
const PILL_START_KM = "ចាប់ផ្ដើម";
const PILL_CONTINUE_KM = "បន្ត";
// screen.level.continueLearning (the sticky footer AppButton's own label
// when the up-next lesson has progress > 0) — km.json around line 81. NOT
// the same string as the pill's "បន្ត" — LevelSelectionScreen.tsx uses two
// different i18n keys for the pill vs. the footer.
const FOOTER_CONTINUE_KM = "បន្តការសិក្សា";

const OLD_PLAY_PATH_D = "M6 4.5v15l14-7.5-14-7.5z";

// GET .../lesson/level/<levelId> — Api.fetchLevels's own path
// (`lesson/level/${unitId}`), no trailing segment. Deliberately does not
// match fetchChapters's `lesson/${lessonId}/learning` (no "level" segment)
// or fetchUnits's `level/grade/${courseId}` (different segment order).
const LEVEL_RESPONSE_URL_RE = /\/lesson\/level\/[^/?]+(?:\?|$)/;

type ApiLesson = {
  lessonid: string;
  lessonorder?: number;
  completed?: boolean;
  progress?: number;
};

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
    const expectedFooterText =
      expectedUpNextProgress > 0 ? FOOTER_CONTINUE_KM : PILL_START_KM;

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
      }`
    );

    const rowCount = await lessonRows.count();
    expect(
      rowCount,
      `DOM row count (${rowCount}) should equal the API lesson count (${apiLessons.length})`
    ).toBe(apiLessons.length);

    const observedStatuses: string[] = [];
    let pillRows = 0;

    for (const apiLesson of sortedApiLessons) {
      const expectedStatus = statusFor(apiLesson);
      const row = page.locator(
        `[data-testid="lesson-row-${apiLesson.lessonid}"]`
      );
      await expect(
        row,
        `expected a lesson-row-${apiLesson.lessonid} on screen for this API lesson`
      ).toHaveCount(1);

      // Exactly one status-icon-* inside this row, and it must be the one
      // computed from this lesson's own completed/progress fields — not
      // merely "some" valid status.
      const statusIcons = row.locator('[data-testid^="status-icon-"]');
      await expect(
        statusIcons,
        `lesson-row-${apiLesson.lessonid} should have exactly one status icon`
      ).toHaveCount(1);
      const expectedIcon = row.locator(
        `[data-testid="status-icon-${expectedStatus}"]`
      );
      await expect(
        expectedIcon,
        `lesson-row-${apiLesson.lessonid} (completed=${apiLesson.completed}, progress=${apiLesson.progress}) should show status-icon-${expectedStatus}, the icon actually shown did not match`
      ).toHaveCount(1);
      observedStatuses.push(expectedStatus);

      // No play-triangle glyph anywhere in this row.
      await assertNoPlayGlyph(row);

      // aria-label sanity: no literal "undefined", and it contains the
      // Khmer status string matching the EXPECTED status for this lesson.
      const label = await row.getAttribute("aria-label");
      expect(
        label,
        `lesson-row-${apiLesson.lessonid} should carry an aria-label`
      ).not.toBeNull();
      expect(
        (label as string).includes("undefined"),
        `lesson-row-${apiLesson.lessonid}'s aria-label contains the literal string "undefined": "${label}"`
      ).toBe(false);
      expect(
        (label as string).includes(ROW_STATUS_KM[expectedStatus]),
        `lesson-row-${apiLesson.lessonid}'s aria-label "${label}" should contain the Khmer status text for "${expectedStatus}" ("${ROW_STATUS_KM[expectedStatus]}")`
      ).toBe(true);

      // The cta-pill must appear in this row iff it is the expected
      // up-next row — not just "at most one per row, somewhere".
      const isExpectedUpNext = expectedUpNext?.lessonid === apiLesson.lessonid;
      const pill = row.locator('[data-testid="cta-pill"]');
      const pillCount = await pill.count();
      expect(
        pillCount,
        `lesson-row-${apiLesson.lessonid} cta-pill presence (${pillCount}) should match up-next expectation (${
          isExpectedUpNext ? 1 : 0
        })`
      ).toBe(isExpectedUpNext ? 1 : 0);

      if (isExpectedUpNext) {
        pillRows++;
        const pillText = (await pill.first().innerText()).trim();
        expect(
          pillText,
          `up-next lesson-row-${apiLesson.lessonid}'s pill text should equal the expected text derived from its own progress (${apiLesson.progress})`
        ).toBe(expectedPillText);
        expect(
          (label as string).includes(pillText),
          `lesson-row-${apiLesson.lessonid}'s aria-label "${label}" should contain its own pill's text "${pillText}"`
        ).toBe(true);
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
    // string derived from the up-next lesson's own progress.
    if (expectedUpNext) {
      const footerButton = page.getByRole("button", {
        name: new RegExp(`^(${PILL_START_KM}|${FOOTER_CONTINUE_KM})$`),
      });
      await expect(footerButton).toBeVisible();
      const footerText = (await footerButton.innerText()).trim();
      expect(
        footerText,
        `footer text should equal the expected text derived from the up-next lesson's own progress (${expectedUpNext.progress})`
      ).toBe(expectedFooterText);

      // Screenshots: module screen, plus a zoom crop of one status icon.
      await page.screenshot({
        path: test.info().outputPath("module.png"),
        fullPage: true,
      });
      const iconBox = await lessonRows
        .first()
        .locator('[data-testid^="status-icon-"]')
        .first()
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
      await expect(
        page.getByRole("heading", { name: KM.lessonHeader })
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
          name: new RegExp(`^(${PILL_START_KM}|${FOOTER_CONTINUE_KM})$`),
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
      await expect(
        page.getByRole("heading", { name: KM.lessonHeader })
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
