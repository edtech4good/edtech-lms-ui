/**
 * Phone Library tab (corporate / DCRS) — edtech-expo branch feat/library-tab.
 * Runs only under the `phone` project (390x844) alongside the other
 * phone-*.spec.ts files; see playwright.expo.config.ts's own header comment
 * for why phone-width geometry needs its own project.
 *
 * Source read (read-only, sibling worktree
 * .worktrees/expo-library, this spec never edits it):
 *   - src/screens/Library/LibraryScreen.tsx — renders curricula/grades/levels
 *     with testIDs `library-screen`, `library-curriculum-<id>`,
 *     `library-grade-<id>`, `library-level-<id>`, `library-empty`,
 *     `library-loading`, `library-unavailable`. Each level card's
 *     accessibilityLabel is exactly
 *     `${levelname}, ${progressPercent}%, ${lessonsProgress}` (line ~168) —
 *     that single string is what this spec asserts against per card, since
 *     it covers both the Khmer "N of M lessons" footer and the progress
 *     percent in one locator instead of two fragile ones.
 *   - src/services/hooks/useLibrary.ts — fetches `level/library` on mount/
 *     focus/reconnect, catches failures silently and leaves whatever is
 *     cached (LibrarySlice, keyed by schooluserid) so the offline case
 *     renders from redux-persist.
 *   - app/(app)/(home)/_layout.tsx — phone corporate shell is <Tabs> with
 *     three screens in DOM/array order: home (tab-home), library/index
 *     (tab-library), profile/index (tab-profile). dashboard/index is
 *     `href: null` and must not render as a fourth visible tab.
 *   - src/screens/LevelSelection/LevelSelectionScreen.tsx — Level Detail.
 *     When opened `from: 'library'` (LibraryScreen's handleLevelPress sets
 *     this param), a `useEffect` keyed on `params.from` overrides headerLeft
 *     with a BackButton whose onPress is `router.navigate('/library')`
 *     unconditionally — not `router.back()` — specifically so a level opened
 *     from Library always returns there even when the Home tab's own nested
 *     Stack already has Subjects→Courses→Units history underneath (the
 *     "known gap" the file's own top comment documents: Library pushes onto
 *     whatever the Home stack currently holds). Test 3 below is the stack
 *     case that comment worries about.
 *
 * DISCREPANCY FROM THE ASSIGNMENT BRIEF: the brief describes Level Detail
 * rows as carrying `lesson-row-<id>`-style testIDs. Reading
 * src/components/ui/LessonRow.tsx directly (LessonRowProps, the component's
 * JSX) shows it accepts no `testID` prop at all and none is passed by
 * LevelSelectionScreen — each row is a plain `accessibilityRole="button"`
 * Pressable identified only by its accessibilityLabel (chip + title + status
 * + steps). This spec locates rows by role + the lesson title text from the
 * `lesson/level/<levelid>` response instead, and this file's own assertions
 * do NOT rely on any `lesson-row-*` testID existing — worth fixing upstream
 * if per-row automation hooks are wanted later.
 *
 * DISCREPANCY FROM THE REVIEW BRIEF (this file's own review pass): the
 * review asked for "aria-selected or similar" on the tab bar to assert which
 * tab is selected. Confirmed live against the running dev build (DOM
 * inspection via the browser devtools protocol, not guessed): each
 * `tab-*` element is a plain `<a role="link">` inside a `<div
 * role="tablist">` (app/(app)/(home)/_layout.tsx's Tabs renders react-
 * navigation's web tab bar this way), and NEITHER that element NOR any
 * ancestor carries `aria-selected`, `aria-current`, or `role="tab"` — there
 * is nothing accessibility-tree-visible to assert. The only observable
 * "selected" signal is the label `<span>`'s inline text color (blue
 * rgb(11,95,255) selected vs. gray rgb(90,107,128) unselected), which is a
 * styling implementation detail, not an accessibility attribute, and too
 * fragile (a palette change breaks it for no behavioral reason) to assert
 * on. expo-router's Tabs navigator drives that "selected" state directly
 * from the URL, so `assertLibraryTabSelected` below asserts the URL pathname
 * instead — the authoritative, non-fragile signal — and is used everywhere
 * this file needs to confirm Library (not Home) is the active tab.
 */
import { test, expect, Page } from "@playwright/test";
import { CORPORATE_STUDENT, KM, loginViaExpoUi } from "./fixtures";

interface LibraryLevel {
  levelid: string;
  levelname: string;
  progress: number;
  number_lessons: number;
  number_completed_lessons: number;
}
interface LibraryGrade {
  gradeid: string;
  levels: LibraryLevel[];
}
interface LibraryCurriculum {
  curriculumid: string;
  grades: LibraryGrade[];
}
interface LibraryResponseBody {
  data: { curricula: LibraryCurriculum[]; generated_at: string };
}

interface LevelResponseBody {
  data: { lesson: { lessonid: string; lessonname: string }[] };
}

/**
 * `screen.library.lessonsProgress` ("មេរៀន {{done}} ក្នុងចំណោម {{total}}")
 * interpolated the same way i18next does for `{{done}}`/`{{total}}`.
 */
function lessonsProgressText(done: number, total: number): string {
  return `មេរៀន ${done} ក្នុងចំណោម ${total}`;
}

/**
 * Copied verbatim from CorporateCardGrid.tsx's own `normalizeProgressFraction`
 * (re-exported via src/components) — LibraryScreen imports the real one; this
 * is a test-side copy of the same three lines so the expected percentage is
 * derived the same way the component derives it, not guessed.
 */
function normalizeProgressFraction(
  progress: number | undefined | null,
): number | undefined {
  if (typeof progress !== "number" || progress <= 0) return undefined;
  return progress > 1 ? progress / 100 : progress;
}

/** Every `library-level-<id>`'s expected accessible name, per LibraryScreen.tsx line ~168. */
function expectedLevelLabel(level: LibraryLevel): string {
  const pct = Math.round((normalizeProgressFraction(level.progress) ?? 0) * 100);
  return `${level.levelname}, ${pct}%, ${lessonsProgressText(
    level.number_completed_lessons,
    level.number_lessons,
  )}`;
}

/**
 * Registers the `GET .../level/library` waitForResponse BEFORE the caller
 * taps the library tab — matches the ok-response, 10s-timeout, `/level/library`
 * substring the assignment specifies. Returns the parsed body once resolved.
 */
function waitForLibraryResponse(page: Page) {
  return page.waitForResponse(
    (res) =>
      res.request().method() === "GET" &&
      /\/level\/library(\?|$)/.test(res.url()) &&
      res.ok(),
    { timeout: 10_000 },
  );
}

/**
 * Clicks the Library tab, waits for its `level/library` fetch to resolve,
 * and returns THIS call's own parsed body plus the response's own origin
 * (derived from the live response URL, not a hardcoded constant — the origin
 * is also what the offline test needs to scope its `page.route` block to).
 * Every test that needs library data calls this itself — no shared
 * module-level response body, so tests never depend on another test having
 * run first.
 */
async function openLibrary(
  page: Page,
): Promise<{ body: LibraryResponseBody; origin: string }> {
  const responsePromise = waitForLibraryResponse(page);
  await page.locator('[data-testid="tab-library"]').click();
  const response = await responsePromise;
  const body = (await response.json()) as LibraryResponseBody;
  await expect(page.locator('[data-testid="library-screen"]')).toBeVisible();
  return { body, origin: new URL(response.url()).origin };
}

/**
 * Walks curricula → grades → levels from a real `level/library` response and
 * asserts, IN RESPONSE ORDER, that the matching `library-curriculum-*` /
 * `library-grade-*` / `library-level-*` testIDs exist in the DOM in that same
 * order, and that every level card's accessible name matches
 * expectedLevelLabel (covers both the Khmer lessons-progress footer and the
 * progress percent in one check — see this file's header comment). Also
 * asserts `library-empty` is absent when curricula is non-empty.
 */
async function assertLibraryMatchesResponse(
  page: Page,
  body: LibraryResponseBody,
): Promise<void> {
  const curricula = body.data.curricula ?? [];

  if (curricula.length > 0) {
    await expect(page.locator('[data-testid="library-empty"]')).toHaveCount(0);
  }

  const curriculumTestIds = await page
    .locator('[data-testid^="library-curriculum-"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
  expect(curriculumTestIds).toEqual(
    curricula.map((c) => `library-curriculum-${c.curriculumid}`),
  );

  for (const curriculum of curricula) {
    const curriculumEl = page.locator(
      `[data-testid="library-curriculum-${curriculum.curriculumid}"]`,
    );
    const gradeTestIds = await curriculumEl
      .locator('[data-testid^="library-grade-"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
    expect(gradeTestIds).toEqual(
      curriculum.grades.map((g) => `library-grade-${g.gradeid}`),
    );

    for (const grade of curriculum.grades) {
      const gradeEl = page.locator(`[data-testid="library-grade-${grade.gradeid}"]`);
      const levelTestIds = await gradeEl
        .locator('[data-testid^="library-level-"]')
        .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
      expect(levelTestIds).toEqual(
        grade.levels.map((l) => `library-level-${l.levelid}`),
      );

      for (const level of grade.levels) {
        const card = page.locator(`[data-testid="library-level-${level.levelid}"]`);
        await expect(card).toHaveAccessibleName(expectedLevelLabel(level));
      }
    }
  }
}

/** First curriculum → first grade → first level in response order, or null if empty. */
function firstLevel(body: LibraryResponseBody): LibraryLevel | null {
  for (const curriculum of body.data.curricula ?? []) {
    for (const grade of curriculum.grades) {
      if (grade.levels.length > 0) return grade.levels[0];
    }
  }
  return null;
}

/**
 * Asserts Library is expo-router's active tab. See this file's header
 * comment (DISCREPANCY FROM THE REVIEW BRIEF) for why this checks the URL
 * rather than an aria-selected-style DOM attribute: none exists on this tab
 * bar, confirmed live.
 */
async function assertLibraryTabSelected(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/library$/);
}

test.describe("expo web phone Library tab (corporate / DCRS)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await loginViaExpoUi(page, CORPORATE_STUDENT.username, CORPORATE_STUDENT.password);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  // Full reload (not client-side nav) before every test: resets whatever
  // nested-Stack/router history the previous test built up (e.g. test 3's
  // Home drill-down), so tests never see leftover navigation state from
  // whichever test ran before them. The logged-in session survives the
  // reload (redux-persist rehydrates auth from localStorage), so this does
  // not require logging in again.
  test.beforeEach(async () => {
    await page.goto("/home");
    await expect(page.locator('[data-testid="tab-home"]')).toBeVisible();
  });

  test("tab bar has exactly three tabs in order: home, library, profile", async () => {
    await expect(page.locator('[data-testid="tab-home"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-library"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-profile"]')).toBeVisible();

    // Scoped to the tablist's own role="link" children (confirmed live:
    // each tab-* element is <a role="link"> inside a <div role="tablist">)
    // rather than [data-testid^="tab-"], so a fourth tab rendered WITHOUT a
    // testID (e.g. dashboard/index losing its href: null) would still be
    // counted here and fail this guard.
    const tabItems = page.getByRole("tablist").getByRole("link");
    await expect(tabItems).toHaveCount(3);

    // Exact testID order too, not just a count.
    const testIds = await tabItems.evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-testid")),
    );
    expect(testIds).toEqual(["tab-home", "tab-library", "tab-profile"]);

    // Order also verified by x-position, independent of DOM-order alone.
    const [homeBox, libraryBox, profileBox] = await Promise.all([
      page.locator('[data-testid="tab-home"]').boundingBox(),
      page.locator('[data-testid="tab-library"]').boundingBox(),
      page.locator('[data-testid="tab-profile"]').boundingBox(),
    ]);
    expect(homeBox).not.toBeNull();
    expect(libraryBox).not.toBeNull();
    expect(profileBox).not.toBeNull();
    expect(homeBox!.x).toBeLessThan(libraryBox!.x);
    expect(libraryBox!.x).toBeLessThan(profileBox!.x);

    await page.screenshot({ path: test.info().outputPath("library.png") });
  });

  test("library tab renders curricula/grades/levels matching the level/library response", async () => {
    const { body } = await openLibrary(page);
    await assertLibraryMatchesResponse(page, body);

    await page.screenshot({ path: test.info().outputPath("library.png") });
  });

  // Reading app/(app)/(home)/home/_layout.tsx's `levels` Stack.Screen: on
  // web BOTH the ordinary drill-down (learnerBackFor, "fallback" navigate)
  // and the `from: 'library'` case (BackButton with a hard-coded
  // router.navigate('/library')) render the SAME LearnerBackButton/BackButton
  // component with the SAME Khmer accessibilityLabel (t('button.back')) —
  // the assignment brief's assumption that a plain drill-down visit has no
  // (or an English "Go back") back button does not hold here, unlike the
  // practice/quiz screens phone-learner-path.spec.ts checks (which have no
  // learnerBackFor override and fall back to the stock header). The only
  // observable difference between the two cases is where the button's
  // onPress actually navigates, which the back-navigation tests exercise
  // instead of trying to distinguish the two button instances by label.
  test("Home drill-down stack case: Library-opened level still backs out to Library", async () => {
    // Drive the ordinary Home → curriculum → grade → level drill-down first
    // (same clicks as fixtures.ts's goToFirstDcrsLessonActivities, stopping
    // one level earlier at Level Detail rather than continuing into a
    // lesson's activity list), so the Home tab's own nested Stack has real
    // history underneath by the time Library is used — the exact "stack
    // case" LibraryScreen.tsx's handleLevelPress comment worries about.
    await page.getByRole("button").filter({ hasText: "DCRS" }).first().click();
    await page.getByRole("button").filter({ hasText: "Cohort II" }).first().click();
    await page.getByRole("button").filter({ hasText: "Module 1" }).first().click();
    // Confirms we actually reached Level Detail via the drill-down (its
    // seeded lesson-row title), before Library ever touches this screen.
    await expect(page.getByText("Why direction matters", { exact: true })).toBeVisible();

    // Now switch to Library — this does not clear the Home stack's history
    // underneath (see the file header comment's known-gap quote) — and open
    // a level from there.
    const { body } = await openLibrary(page);
    const level = firstLevel(body);
    expect(level).not.toBeNull();

    const levelDetailResponsePromise = page.waitForResponse(
      (res) =>
        res.request().method() === "GET" &&
        res.url().includes(`lesson/level/${level!.levelid}`) &&
        res.ok(),
      { timeout: 10_000 },
    );
    await page.locator(`[data-testid="library-level-${level!.levelid}"]`).click();
    const levelDetailBody = (await (
      await levelDetailResponsePromise
    ).json()) as LevelResponseBody;
    expect(levelDetailBody.data.lesson.length).toBeGreaterThan(0); // fail loudly, never skip
    const firstLessonName = levelDetailBody.data.lesson[0].lessonname;

    // The bottom Tabs navigator keeps every tab's screen mounted (no
    // unmountOnBlur) — confirmed live: `library-screen`'s node stays in the
    // DOM once handleLevelPress's router.navigate switches the active tab
    // to Home, just hidden. Assert hidden, not absent.
    await expect(page.locator('[data-testid="library-screen"]')).not.toBeVisible();

    const libraryBackButton = page.getByRole("button", { name: KM.back, exact: true });
    await expect(libraryBackButton).toBeVisible();
    await libraryBackButton.click();

    // Must land on Library, NOT back on the Home Units drill-down that was
    // sitting underneath it in the stack.
    await expect(page.locator('[data-testid="library-screen"]')).toBeVisible();
    await assertLibraryTabSelected(page);
    // Level Detail's own content must be gone, not just Library's own
    // content present — asserted against the real first lesson title from
    // this level's own lesson/level response, not a fixed string that can
    // never match a real seeded name (see the review that replaced this).
    await expect(page.getByText(firstLessonName, { exact: true })).not.toBeVisible();
  });

  test("tapping a level card opens Level Detail, and back returns to Library", async () => {
    const { body } = await openLibrary(page);
    const level = firstLevel(body);
    expect(level, "expected miv.verify's level/library response to contain at least one level").not.toBeNull();

    const levelDetailResponsePromise = page.waitForResponse(
      (res) =>
        res.request().method() === "GET" &&
        res.url().includes(`lesson/level/${level!.levelid}`) &&
        res.ok(),
      { timeout: 10_000 },
    );
    await page.locator(`[data-testid="library-level-${level!.levelid}"]`).click();
    const levelDetailResponse = await levelDetailResponsePromise;
    const levelDetailBody = (await levelDetailResponse.json()) as LevelResponseBody;

    // See the previous test's comment: Tabs keeps every screen mounted, so
    // assert hidden, not absent.
    await expect(page.locator('[data-testid="library-screen"]')).not.toBeVisible();
    // See this file's header comment: LessonRow carries no testID, so rows
    // are located by role + the lesson title text the level/<id> response
    // itself returned, not by a lesson-row-* testID.
    for (const lesson of levelDetailBody.data.lesson) {
      await expect(
        page.getByRole("button").filter({ hasText: lesson.lessonname }).first(),
      ).toBeVisible();
    }

    await page.screenshot({ path: test.info().outputPath("library.png") });

    // BackButton.tsx's accessibilityLabel is t('button.back'); when opened
    // `from: 'library'` its onPress navigates to '/library' unconditionally
    // (LevelSelectionScreen.tsx's params.from-keyed effect), never
    // router.back(), so this must land back on Library, not wherever the
    // Home stack's own history would otherwise pop to.
    await page.getByRole("button", { name: KM.back, exact: true }).click();
    await expect(page.locator('[data-testid="library-screen"]')).toBeVisible();
    await assertLibraryTabSelected(page);
    expect(levelDetailBody.data.lesson.length).toBeGreaterThan(0); // fail loudly, never skip
    const firstLessonName = levelDetailBody.data.lesson[0].lessonname;
    await expect(page.getByText(firstLessonName, { exact: true })).not.toBeVisible();
  });
  test("library persists offline: cached cards render with the API unreachable", async () => {
    // Load Library online first — this both gives this test its own
    // response body to assert against later and (via LibrarySlice, name
    // 'library', whitelisted in Store.ts's persistConfig) writes the cache
    // that the offline reload below needs to have something to fall back to.
    const { body, origin } = await openLibrary(page);
    await assertLibraryMatchesResponse(page, body);

    // redux-persist's async-storage web shim writes LibrarySlice to
    // localStorage['persist:root'] as a second JSON string, keyed
    // 'library'. Poll rather than read once: the write isn't synchronous
    // with the fetch resolving (same reasoning phone-learner-path.spec.ts's
    // own logout test gives for polling persist:root).
    const libraryEntryCount = async () =>
      page.evaluate(() => {
        const raw = window.localStorage.getItem("persist:root");
        if (!raw) return 0;
        const root = JSON.parse(raw) as Record<string, string>;
        if (!root.library) return 0;
        const library = JSON.parse(root.library) as {
          byUser: Record<string, { curricula: unknown[] }>;
        };
        return Object.keys(library.byUser ?? {}).length;
      });
    await expect.poll(libraryEntryCount, { timeout: 10_000 }).toBeGreaterThan(0);

    // Block every request to the rpi API's own origin (derived above from
    // the live level/library response's own URL, not a hardcoded constant),
    // then reload on the Library route — useLibrary's fetch will throw
    // (caught silently) and fall back to whatever LibrarySlice already has
    // cached for this user. Count aborts so this proves the route handler
    // actually fired at least once, not just that it was registered.
    let abortCount = 0;
    try {
      await page.route(`${origin}/**`, (route) => {
        abortCount++;
        return route.abort();
      });
      await page.reload();

      await expect(page.locator('[data-testid="library-screen"]')).toBeVisible();
      await assertLibraryMatchesResponse(page, body);
      expect(abortCount).toBeGreaterThan(0);

      await page.screenshot({ path: test.info().outputPath("library.png") });
    } finally {
      await page.unroute(`${origin}/**`);
    }
  });
});

test.describe("expo web phone Library tab — nothing cached yet", () => {
  test("blocking only level/library shows the unavailable message, not empty", async ({
    browser,
  }) => {
    // Fresh context/page: no persist:root at all, so this is a genuinely
    // uncached learner. Logging in again as miv.verify evicts whatever
    // token the describe block above was holding — acceptable per this
    // suite's house rules (fixtures.ts's own header comment). This test
    // does not depend on, and is not depended on by, any test above: it
    // opens its own isolated browser context regardless of run order.
    const context = await browser.newContext();
    const page = await context.newPage();
    let blockedCount = 0;
    try {
      await loginViaExpoUi(page, CORPORATE_STUDENT.username, CORPORATE_STUDENT.password);

      // Block ONLY the library endpoint — login and every other request
      // still go through normally. Count hits so this proves the block
      // actually intercepted a real request, not just that the route
      // matcher was registered.
      await page.route("**/level/library", (route) => {
        blockedCount++;
        return route.abort();
      });

      await page.locator('[data-testid="tab-library"]').click();

      await expect(page.locator('[data-testid="library-unavailable"]')).toBeVisible();
      await expect(page.getByText(KM.libraryUnavailable, { exact: true })).toBeVisible();
      await expect(page.locator('[data-testid="library-empty"]')).toHaveCount(0);
      expect(blockedCount).toBeGreaterThan(0);

      await page.screenshot({ path: test.info().outputPath("library.png") });
    } finally {
      await page.unroute("**/level/library");
      await context.close();
    }
  });
});
