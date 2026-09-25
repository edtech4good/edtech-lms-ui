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
 * viewport here.
 *
 * This spec compares the on-screen lesson rows against the same
 * `GET .../lesson/level/<levelId>` and `GET .../lesson/level/<levelId>/steps`
 * responses the Level Detail screen itself loads (edtech-expo #97, source
 * read directly in edtech-expo's read-only worktree at
 * .worktrees/expo-level-step-dots — src/screens/LevelSelection/
 * LevelSelectionScreen.tsx `lessonStatusFor`/`approximateSteps`,
 * src/services/hooks/useLevelSteps.ts `stepInfoFor`,
 * src/components/ui/LessonStepDots.tsx `describeSteps`/`toStepInfo`, and
 * src/locales/km.json — cross-checked directly against those files, not
 * from memory):
 *
 *  - a lesson row's status follows the row's own step dots, derived from
 *    `GET /lesson/level/:levelid/steps` (learnings/practices/quizzes, each
 *    item's own `status`), with a per-lesson fallback to the old server
 *    rule (`completed === true || progress >= 100` => done, `progress > 0`
 *    => inProgress, else todo) when that lesson's real structure isn't
 *    known at all (offline first load).
 *  - `stepInfoFor`/`stepStateFor`: a type's state is `done` when every item
 *    is done, `current` when any item is done/inProgress, else `todo` —
 *    computed per type from that type's own items.
 *  - `LessonStepDots`: only types with `total > 0` render a dot at all.
 *  - When a lesson's structure isn't cached, the screen instead renders
 *    `approximateSteps(progress, isNext, done)` — a small, PURE, and fully
 *    reproducible function of already-known values (copied verbatim below
 *    as `approximateSteps`), so even the fallback branch's dots/aria-label
 *    tail can be asserted exactly, not skipped.
 *  - Row status, the up-next pick, the header "N of M"/%, and the
 *    pill/footer CTA all read off the same derived status per
 *    LevelSelectionScreen.tsx's own comment ("every consumer on this screen
 *    ... must go through it so they can't disagree with each other") —
 *    this spec asserts all of them against the same derivation.
 *
 * Two describe blocks:
 *  1. "against real data" — drives the real corporate DCRS Module 1 seed
 *     data (miv.verify) and checks the screen against whatever `/steps` and
 *     `/level` actually return. This is real-world coverage, but whether it
 *     can fail depends on today's seed state (see the "steps vs
 *     fallback-rule disagreement" logging in that test).
 *  2. "intercepted /steps (#97 proof)" — the REAL proof. `page.route`
 *     intercepts the level's `/steps` response, fetches the true payload
 *     (`route.fetch()`), mutates specific item statuses, and fulfills with
 *     the modified body. Every expectation below is then derived from that
 *     MODIFIED body, not the real one — so these cases fail if
 *     `lessonStatusFor`/the dot rendering ever stops actually reading
 *     `/steps`, regardless of what today's seed data happens to contain.
 *     Each case uses its own fresh browser context (no shared
 *     localStorage/cookies) so no persisted progress leaks between cases —
 *     LevelSelectionScreen/useLevelSteps merge server statuses monotonically
 *     into a persisted `activityProgress` store, so reusing a context could
 *     keep an earlier case's "done" around instead of reverting.
 *
 * App-side mutation proof (see this change's commit/PR description for the
 * actual run log): `src/screens/LevelSelection/LevelSelectionScreen.tsx`'s
 * `lessonStatusFor` was temporarily edited in the INTEGRATION worktree
 * (.worktrees/expo-integration, which the running localhost:8096 build hot-
 * reloads from) to always return the server-fallback status, and separately
 * `LessonStepDots.tsx` was edited to stop filtering empty-total step types —
 * each edit was confirmed to turn the intercepted-`/steps` tests (describe
 * block 2) red, then reverted (`git checkout --`) and confirmed to turn them
 * back green, with `git status` confirmed clean before and after.
 *
 * NOT exercised by the seed data (real-data test only): the "every lesson
 * done, no up-next" branch (no pill, no sticky footer). miv.verify's DCRS
 * Module 1 always has at least one unfinished lesson, so that branch has
 * never been observed to run green or red against real data — it guards the
 * contract for whenever the seed does put every lesson in a "done" state.
 * This is not a gap in proof coverage: the intercepted tests below exercise
 * the status-derivation logic directly regardless of seed state.
 */
import { test, expect, Page, Route } from "@playwright/test";
import { CORPORATE_STUDENT, KM, loginViaExpoUi } from "./fixtures";

// km.json's screen.level.lessonRowStatus (copied verbatim — cross-checked
// directly against edtech-expo's km.json). Only used for non-up-next rows:
// the up-next row's status word is replaced by the cta-pill text.
const ROW_STATUS_KM: Record<string, string> = {
  done: "បានបញ្ចប់",
  inProgress: "កំពុងសិក្សា",
  todo: "មិនទាន់ចាប់ផ្ដើម",
};

// screen.level.stepState.* — copied verbatim. `current`/`inProgress` and
// `todo` happen to share their exact Khmer text with lessonRowStatus above
// (and the Start pill text is itself a substring of the "todo" word) — this
// spec never relies on substring/loose matching for that reason; every
// aria-label check below is an exact full-string match.
const STEP_STATE_KM: Record<"done" | "current" | "todo", string> = {
  done: "បានបញ្ចប់",
  current: "កំពុងសិក្សា",
  todo: "មិនទាន់ចាប់ផ្ដើម",
};

// screen.level.stepFormat / stepFormatWithCount — copied verbatim.
const STEP_FORMAT = "{{step}} ({{state}})";
const STEP_FORMAT_WITH_COUNT =
  "{{step}} ({{state}}, {{done}} ក្នុងចំណោម {{total}})";

// screen.level.progressWithCertificate — copied verbatim.
const PROGRESS_WITH_CERTIFICATE_TEMPLATE =
  "មេរៀន {{done}} ក្នុងចំណោម {{total}} · ទទួលវិញ្ញាបនបត្រពេលបញ្ចប់";

// cta.start / cta.continue (LessonRow's cta-pill label).
const PILL_START_KM = "ចាប់ផ្ដើម";
const PILL_CONTINUE_KM = "បន្ត";

// cta.startLesson / cta.continueLesson (the sticky footer AppButton's own
// label) — DIFFERENT i18n keys/strings than the pill's cta.start/continue.
const FOOTER_START_TEMPLATE = "ចាប់ផ្ដើមមេរៀនទី {{n}}";
const FOOTER_CONTINUE_TEMPLATE = "បន្តមេរៀនទី {{n}}";

// screen.lesson.{learningTitle,practiceTitle,quizTitle} (km.json), used to
// build describeSteps()'s step-description text.
const STEP_TITLE_KM = {
  learning: KM.learningTitle,
  practice: KM.practiceTitle,
  quiz: KM.quizTitle,
} as const;

const OLD_PLAY_PATH_D = "M6 4.5v15l14-7.5-14-7.5z";

// theme.colors.primary / theme.colors.divider (src/themes/tokens/corporate.ts)
// as the browser's computed rgb().
const PRIMARY_BORDER_RGB = "rgb(11, 95, 255)";
const DIVIDER_BORDER_RGB = "rgb(227, 232, 239)";

// GET .../lesson/level/<levelId> — Api.fetchLevels's own path
// (`lesson/level/${unitId}`), no trailing segment.
const LEVEL_RESPONSE_URL_RE = /\/lesson\/level\/[^/?]+(?:\?|$)/;

// GET .../lesson/level/:levelid/steps — Api.fetchLevelSteps's own path
// (`lesson/level/${levelId}/steps`), with the level id captured so tests can
// confirm the response actually belongs to the level that was opened.
const LEVEL_STEPS_RESPONSE_URL_RE = /\/lesson\/level\/([^/?]+)\/steps(?:\?|$)/;

type ApiLesson = {
  lessonid: string;
  lessonname: string;
  lessonorder?: number;
  completed?: boolean;
  progress?: number;
};

// Raw shape of GET /lesson/level/:levelid/steps (src/models/Lesson.ts's
// LevelSteps / LevelStepsLesson) — item status is a plain ActivityStatus
// ('done' | 'inProgress' | 'todo') on the item itself.
type StepsApiItem = { status: "done" | "inProgress" | "todo" };
type StepsApiLesson = {
  lessonid: string;
  lessonorder: number;
  learnings?: StepsApiItem[];
  practices?: StepsApiItem[];
  quizzes?: StepsApiItem[];
};
type StepsApiResponse = { levelid: string; lessons?: StepsApiLesson[] };

// km.json's screen.level.lessonChip ("មេរៀនទី {{n}}").
const chipLabelFor = (lessonorder: number | undefined): string =>
  `មេរៀនទី ${lessonorder ?? "·"}`;

type ExpectedStatus = "done" | "inProgress" | "todo";
type StepType = "learning" | "practice" | "quiz";
type StepState = "done" | "current" | "todo";
type StepInfoFull = { state: StepState; done: number; total: number };

// LevelSelectionScreen.tsx's own isLessonDone/fallback rule, copied
// verbatim — the fallback used when a lesson's `/steps` structure is
// entirely missing (never merely empty — see stepStateFor below).
const isLessonDone = (lesson: ApiLesson): boolean =>
  lesson.completed === true || (lesson.progress ?? 0) >= 100;

const fallbackStatusFor = (lesson: ApiLesson): ExpectedStatus => {
  if (isLessonDone(lesson)) return "done";
  if ((lesson.progress ?? 0) > 0) return "inProgress";
  return "todo";
};

/**
 * useLevelSteps.ts's own `stepInfoFor`, copied verbatim (re-expressed over
 * the raw `/steps` item array directly — this spec has no Redux store to
 * read `activityProgress` from, but a fresh login's `/steps` items are
 * exactly what would be merged into that store with no downgrade).
 */
function stepStateFor(items: StepsApiItem[] | undefined): StepInfoFull {
  const total = items?.length ?? 0;
  if (total === 0) return { state: "todo", done: 0, total: 0 };
  const doneCount = items!.filter((i) => i.status === "done").length;
  if (doneCount === total) return { state: "done", done: doneCount, total };
  const anyStarted = items!.some(
    (i) => i.status === "done" || i.status === "inProgress"
  );
  return { state: anyStarted ? "current" : "todo", done: doneCount, total };
}

/**
 * LevelSelectionScreen.tsx's own `approximateSteps`, copied verbatim — a
 * PURE function of already-known values, so the fallback branch (no known
 * `/steps` structure for a lesson) can still be asserted exactly instead of
 * skipped. `toStepInfo`'s bare-string branch (LessonStepDots.tsx) sets
 * `done: 0, total: 1` for every bare state regardless of what the state
 * actually is — reproduced by `toFullFromApprox` below.
 */
function approximateSteps(
  progress: number,
  isNext: boolean,
  done: boolean
): Record<StepType, StepState> {
  if (done) return { learning: "done", practice: "done", quiz: "done" };
  if (progress > 0)
    return { learning: "done", practice: "current", quiz: "todo" };
  if (isNext) return { learning: "current", practice: "todo", quiz: "todo" };
  return { learning: "todo", practice: "todo", quiz: "todo" };
}

const toFullFromApprox = (state: StepState): StepInfoFull => ({
  state,
  done: 0,
  total: 1,
});

/**
 * LevelSelectionScreen.tsx's own `lessonStatusFor`, copied verbatim: only
 * types with at least one item count; done when every such type is done;
 * inProgress when any item across those types has started; todo otherwise;
 * falls back to the old server rule when there is no known structure at all
 * or every known type is empty.
 */
function derivedStatusFor(
  lesson: ApiLesson,
  stepsLesson: StepsApiLesson | undefined
): {
  status: ExpectedStatus;
  usedFallback: boolean;
  perType?: Record<StepType, StepInfoFull>;
} {
  if (stepsLesson) {
    const perType: Record<StepType, StepInfoFull> = {
      learning: stepStateFor(stepsLesson.learnings),
      practice: stepStateFor(stepsLesson.practices),
      quiz: stepStateFor(stepsLesson.quizzes),
    };
    const withItems = (Object.keys(perType) as StepType[]).filter(
      (t) => perType[t].total > 0
    );
    if (withItems.length > 0) {
      let status: ExpectedStatus;
      if (withItems.every((t) => perType[t].state === "done")) status = "done";
      else if (
        withItems.some(
          (t) => perType[t].state === "current" || perType[t].state === "done"
        )
      )
        status = "inProgress";
      else status = "todo";
      return { status, usedFallback: false, perType };
    }
  }
  return { status: fallbackStatusFor(lesson), usedFallback: true };
}

/** Formats a `{{n}}`-style i18next template with a single substitution. */
const format1 = (template: string, key: string, value: string | number): string =>
  template.replace(`{{${key}}}`, String(value));

/**
 * LessonStepDots.tsx's own `describeSteps`, re-expressed over the already-
 * derived per-type StepInfoFull map (works uniformly for both the real
 * `/steps`-derived branch and the `approximateSteps` fallback branch, since
 * both produce the same `{state, done, total}` shape).
 */
function describeStepsExpected(perType: Record<StepType, StepInfoFull>): string {
  return (["learning", "practice", "quiz"] as StepType[])
    .filter((t) => perType[t].total > 0)
    .map((t) => {
      const stepName = STEP_TITLE_KM[t];
      const { state, done, total } = perType[t];
      const stateText = STEP_STATE_KM[state];
      return total > 1
        ? format1(
            format1(
              format1(
                format1(STEP_FORMAT_WITH_COUNT, "step", stepName),
                "state",
                stateText
              ),
              "done",
              done
            ),
            "total",
            total
          )
        : format1(format1(STEP_FORMAT, "step", stepName), "state", stateText);
    })
    .join(", ");
}

/** Formats km.json's cta.startLesson/cta.continueLesson templates. */
const formatFooterLesson = (template: string, n: number): string =>
  format1(template, "n", n);

/** Asserts no old play-triangle glyph (Polygon, or the specific old Path
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

/** Asserts `locator` has no non-`none` computed box-shadow. */
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

/**
 * Navigates from an already-logged-in home screen to the Level Detail
 * screen (DCRS -> Cohort II -> Module 1), capturing the `/level` and
 * `/steps` responses the screen itself triggers. `/steps` is REQUIRED (no
 * `.catch()`): a missing or non-ok response fails this helper loudly rather
 * than silently letting every lesson fall back to the old server rule.
 * Asserts the captured `/steps` payload's own `levelid` equals the id
 * embedded in the request URL (i.e. the level actually opened), not just
 * that *some* `/steps` response arrived.
 */
async function openModule1AndCaptureResponses(
  page: Page
): Promise<{ apiLessons: ApiLesson[]; stepsBody: StepsApiResponse }> {
  const levelResponsePromise = page.waitForResponse(
    (res) =>
      res.request().method() === "GET" &&
      LEVEL_RESPONSE_URL_RE.test(res.url()) &&
      res.ok(),
    { timeout: 10_000 }
  );
  const stepsResponsePromise = page.waitForResponse(
    (res) =>
      res.request().method() === "GET" &&
      LEVEL_STEPS_RESPONSE_URL_RE.test(res.url()) &&
      res.ok(),
    { timeout: 10_000 }
  );

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

  const levelBody = await (await levelResponsePromise).json();
  const stepsResponse = await stepsResponsePromise;
  const stepsJson = await stepsResponse.json();
  const stepsBody: StepsApiResponse = stepsJson?.data ?? stepsJson;

  const urlMatch = LEVEL_STEPS_RESPONSE_URL_RE.exec(stepsResponse.url());
  const openedLevelId = urlMatch?.[1];
  expect(
    openedLevelId,
    `could not extract a level id from the /steps request URL "${stepsResponse.url()}"`
  ).toBeTruthy();
  expect(
    stepsBody?.levelid,
    `/steps response body's levelid ("${stepsBody?.levelid}") should equal the ` +
      `opened level's id ("${openedLevelId}", taken from the request URL)`
  ).toBe(openedLevelId);

  const apiLessons: ApiLesson[] = levelBody?.data?.lesson ?? [];
  expect(
    apiLessons.length,
    "expected at least one lesson in the captured API response"
  ).toBeGreaterThan(0);

  return { apiLessons, stepsBody };
}

type DerivedLesson = {
  lesson: ApiLesson;
  status: ExpectedStatus;
  usedFallback: boolean;
  oldStatus: ExpectedStatus;
};

/**
 * Runs every Level Detail screen assertion (row count, header, per-row
 * status icon/border/aria-label/pill, footer) against the DERIVED
 * expectations built from `apiLessons`/`stepsLessons` — the caller decides
 * whether those came from the real `/level`+`/steps` responses or from a
 * `page.route`-mutated `/steps` body. Every expectation is computed here,
 * not asserted loosely, so this function is exactly what the app-side
 * mutation proof (see this file's header comment) needs to go red against.
 */
async function assertLevelDetailMatchesDerivation(
  page: Page,
  apiLessons: ApiLesson[],
  stepsLessons: StepsApiLesson[],
  logPrefix: string
): Promise<{
  derived: DerivedLesson[];
  expectedUpNext: ApiLesson | undefined;
  expectedUpNextEntry: DerivedLesson | undefined;
  expectedPillText: string;
  expectedFooterText: string;
  expectedDoneCount: number;
  expectedLevelProgress: number;
}> {
  const stepsByLessonId = new Map<string, StepsApiLesson>(
    stepsLessons.map((l) => [l.lessonid, l])
  );
  const sortedApiLessons = [...apiLessons].sort(
    (a, b) => (a.lessonorder ?? 0) - (b.lessonorder ?? 0)
  );

  // Pass 1: status + usedFallback per lesson (independent of up-next).
  const statusOnly = sortedApiLessons.map((lesson) => {
    const stepsLesson = stepsByLessonId.get(lesson.lessonid);
    const { status, usedFallback, perType } = derivedStatusFor(
      lesson,
      stepsLesson
    );
    return {
      lesson,
      stepsLesson,
      status,
      usedFallback,
      perType,
      oldStatus: fallbackStatusFor(lesson),
    };
  });

  const disagreements = statusOnly.filter(
    (d) => !d.usedFallback && d.status !== d.oldStatus
  );
  // eslint-disable-next-line no-console
  console.log(
    `[lesson-status:${logPrefix}] steps-derived vs old-fallback-rule ` +
      `disagreement: ${disagreements.length} lesson(s) — ${JSON.stringify(
        disagreements.map((d) => ({
          lessonid: d.lesson.lessonid,
          stepsStatus: d.status,
          oldStatus: d.oldStatus,
        }))
      )}`
  );

  const expectedUpNextEntry = statusOnly.find((d) => d.status !== "done");
  const expectedUpNext = expectedUpNextEntry?.lesson;

  // Pass 2: now that up-next is known, compute the exact expected per-type
  // step info (and its describeSteps() tail) for every lesson, including
  // fallback lessons via the pure `approximateSteps`.
  const derived: DerivedLesson[] = statusOnly.map((d) => ({
    lesson: d.lesson,
    status: d.status,
    usedFallback: d.usedFallback,
    oldStatus: d.oldStatus,
  }));

  const expectedStepsFor = new Map<string, Record<StepType, StepInfoFull>>();
  for (const d of statusOnly) {
    const isNext = expectedUpNext?.lessonid === d.lesson.lessonid;
    if (!d.usedFallback && d.perType) {
      expectedStepsFor.set(d.lesson.lessonid, d.perType);
    } else {
      const approx = approximateSteps(
        d.lesson.progress ?? 0,
        isNext,
        d.status === "done"
      );
      expectedStepsFor.set(d.lesson.lessonid, {
        learning: toFullFromApprox(approx.learning),
        practice: toFullFromApprox(approx.practice),
        quiz: toFullFromApprox(approx.quiz),
      });
    }
  }

  const expectedUpNextIsStarted = expectedUpNextEntry?.status === "inProgress";
  const expectedPillText = expectedUpNextIsStarted
    ? PILL_CONTINUE_KM
    : PILL_START_KM;
  const expectedUpNextOrder = expectedUpNext?.lessonorder;
  const expectedFooterText =
    expectedUpNextOrder != null
      ? formatFooterLesson(
          expectedUpNextIsStarted ? FOOTER_CONTINUE_TEMPLATE : FOOTER_START_TEMPLATE,
          expectedUpNextOrder
        )
      : expectedPillText;

  const expectedDoneCount = derived.filter((d) => d.status === "done").length;
  const expectedLevelProgress =
    sortedApiLessons.length > 0
      ? Math.min(100, Math.round((expectedDoneCount / sortedApiLessons.length) * 100))
      : 0;

  // eslint-disable-next-line no-console
  console.log(
    `[lesson-status:${logPrefix}] derived ground truth: ${JSON.stringify(
      derived.map((d) => ({
        lessonid: d.lesson.lessonid,
        derivedStatus: d.status,
        usedFallback: d.usedFallback,
      }))
    )}; expected up-next: ${
      expectedUpNext?.lessonid ?? "(none — all done)"
    }; expected header: ${expectedDoneCount} of ${
      sortedApiLessons.length
    } (${expectedLevelProgress}%)`
  );

  const lessonRows = page.locator('[data-testid^="lesson-row-"]');
  await expect(lessonRows.first()).toBeVisible();
  await expect(
    lessonRows,
    `DOM row count should equal the API lesson count (${apiLessons.length})`
  ).toHaveCount(apiLessons.length);

  // Header "N of M lessons · get a certificate" / "%" — exact strings from
  // km.json's screen.level.progressWithCertificate, not a loose substring
  // match.
  const expectedHeaderText = format1(
    format1(PROGRESS_WITH_CERTIFICATE_TEMPLATE, "done", expectedDoneCount),
    "total",
    sortedApiLessons.length
  );
  await expect(
    page.getByText(expectedHeaderText, { exact: true }),
    `expected the header to read exactly "${expectedHeaderText}"`
  ).toBeVisible();
  await expect(
    page.getByText(`${expectedLevelProgress}%`, { exact: true }),
    `expected the header % to read exactly "${expectedLevelProgress}%"`
  ).toBeVisible();

  let pillRows = 0;

  for (const { lesson: apiLesson, status: expectedStatus } of derived) {
    const isExpectedUpNext = expectedUpNext?.lessonid === apiLesson.lessonid;
    const row = page.locator(`[data-testid="lesson-row-${apiLesson.lessonid}"]`);
    await expect(
      row,
      `expected a lesson-row-${apiLesson.lessonid} on screen for this API lesson`
    ).toHaveCount(1);

    await assertNoBoxShadow(row, `lesson-row-${apiLesson.lessonid}`);

    const statusIcons = row.locator('[data-testid^="status-icon-"]');
    await expect(
      statusIcons,
      `lesson-row-${apiLesson.lessonid} should have exactly one status icon`
    ).toHaveCount(1);
    const expectedIconStatus = isExpectedUpNext ? "upNext" : expectedStatus;
    await expect(
      row.locator(`[data-testid="status-icon-${expectedIconStatus}"]`),
      `lesson-row-${apiLesson.lessonid} (derivedStatus=${expectedStatus}, isUpNext=${isExpectedUpNext}) should show status-icon-${expectedIconStatus}`
    ).toHaveCount(1);

    const { borderTopWidth, borderTopColor } = await row.evaluate((el) => {
      const style = getComputedStyle(el);
      return { borderTopWidth: style.borderTopWidth, borderTopColor: style.borderTopColor };
    });
    if (isExpectedUpNext) {
      expect(borderTopWidth, `up-next row borderTopWidth`).toBe("2px");
      expect(borderTopColor, `up-next row borderTopColor`).toBe(PRIMARY_BORDER_RGB);
    } else {
      expect(borderTopWidth, `row borderTopWidth`).toBe("1px");
      expect(borderTopColor, `row borderTopColor`).toBe(DIVIDER_BORDER_RGB);
    }

    await assertNoPlayGlyph(row);

    const pill = row.locator('[data-testid="cta-pill"]');
    const pillCount = await pill.count();
    expect(
      pillCount,
      `lesson-row-${apiLesson.lessonid} cta-pill presence should match up-next expectation`
    ).toBe(isExpectedUpNext ? 1 : 0);
    if (isExpectedUpNext) pillRows++;

    // aria-label: EXACT full-string match, built precisely as LessonRow.tsx
    // assembles it (`${chipLabel}, ${title}, ${statusOrCtaText}, ${stepsDescription}`),
    // including the step-description tail from describeSteps()/`toStepInfo`
    // — not a loose substring/prefix check (the pill/status Khmer words
    // overlap textually with each other and with the tail's own state
    // words, which made a substring check pass under a mutated word in an
    // earlier version of this spec). This is a RETRYING assertion
    // (`toHaveAttribute`, which polls) because the row first paints off the
    // coarse pre-`/steps` guess before settling into its final state.
    const perType = expectedStepsFor.get(apiLesson.lessonid)!;
    const stepsDescription = describeStepsExpected(perType);
    const chip = chipLabelFor(apiLesson.lessonorder);
    const word = isExpectedUpNext ? expectedPillText : ROW_STATUS_KM[expectedStatus];
    const expectedLabel = `${chip}, ${apiLesson.lessonname}, ${word}, ${stepsDescription}`;
    await expect(
      row,
      `lesson-row-${apiLesson.lessonid}'s aria-label should equal exactly "${expectedLabel}"`
    ).toHaveAttribute("aria-label", expectedLabel);

    if (isExpectedUpNext) {
      await expect(
        row.getByText(expectedPillText, { exact: true }),
        `up-next lesson-row-${apiLesson.lessonid} should show the pill text exactly once`
      ).toHaveCount(1);
    } else {
      await expect(
        row.getByText(ROW_STATUS_KM[expectedStatus], { exact: true }),
        `lesson-row-${apiLesson.lessonid} should show the status word exactly once`
      ).toHaveCount(1);
    }
  }

  expect(
    pillRows,
    expectedUpNext
      ? "expected exactly the up-next row to show a cta-pill"
      : "expected no cta-pill when every lesson is done"
  ).toBe(expectedUpNext ? 1 : 0);

  if (expectedUpNext) {
    const footerButton = page.getByRole("button", {
      name: expectedFooterText,
      exact: true,
    });
    await expect(footerButton).toBeVisible();
    const footerText = (await footerButton.innerText()).trim();
    expect(
      footerText,
      `footer text should equal the expected text derived from the up-next ` +
        `lesson's derived status (${expectedUpNextEntry?.status}) and lessonorder`
    ).toBe(expectedFooterText);
  } else {
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
  }

  return {
    derived,
    expectedUpNext,
    expectedUpNextEntry,
    expectedPillText,
    expectedFooterText,
    expectedDoneCount,
    expectedLevelProgress,
  };
}

test.describe("expo web lesson status icons — against real data (corporate / DCRS)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await loginViaExpoUi(page, CORPORATE_STUDENT.username, CORPORATE_STUDENT.password);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test("module screen: lesson rows reflect their own step dots (#97)", async () => {
    const { apiLessons, stepsBody } = await openModule1AndCaptureResponses(page);

    const { derived, expectedUpNext } = await assertLevelDetailMatchesDerivation(
      page,
      apiLessons,
      stepsBody.lessons ?? [],
      "real-data"
    );

    // Whether the NEW steps-driven branch is provably exercised by
    // miv.verify's live data (i.e. whether it disagrees with the old
    // completed/progress rule for at least one lesson) is honest, logged
    // information, not a fabricated pass — see
    // assertLevelDetailMatchesDerivation's own "disagreement" log above.
    // The intercepted-`/steps` tests below are what actually PROVE the
    // branch is live, independent of today's seed state.

    if (expectedUpNext) {
      const upNextRow = page.locator(`[data-testid="lesson-row-${expectedUpNext.lessonid}"]`);
      await page.screenshot({ path: test.info().outputPath("module.png"), fullPage: true });
      const iconBox = await upNextRow
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

      await upNextRow.click();
      await expect(page.getByText(KM.inThisLesson, { exact: true })).toBeVisible();
      await expect(
        page.getByText(expectedUpNext.lessonname, { exact: true }).last()
      ).toBeVisible();
    } else {
      await page.screenshot({ path: test.info().outputPath("module.png"), fullPage: true });
      const sortedApiLessons = [...apiLessons].sort(
        (a, b) => (a.lessonorder ?? 0) - (b.lessonorder ?? 0)
      );
      await page
        .locator(`[data-testid="lesson-row-${sortedApiLessons[0].lessonid}"]`)
        .click();
      await expect(page.getByText(KM.inThisLesson, { exact: true })).toBeVisible();
    }

    const activityRows = page.locator('[data-testid^="activity-row-"]');
    await expect(activityRows.first()).toBeVisible();
    const activityRowCount = await activityRows.count();
    expect(activityRowCount, "expected at least one activity row").toBeGreaterThan(0);
    for (let i = 0; i < activityRowCount; i++) {
      await assertNoPlayGlyph(activityRows.nth(i));
    }

    await page.screenshot({ path: test.info().outputPath("activities.png"), fullPage: true });

    // eslint-disable-next-line no-console
    console.log(
      `[lesson-status:real-data] observed statuses: ${JSON.stringify(
        derived.map((d) => d.status)
      )}`
    );
  });
});

/**
 * Intercepts the `/steps` request for whichever level id it targets and
 * fulfills it with a body produced by `mutate(realBody)`. `route.fetch()`
 * gets the true response so the mutation is applied on top of real data,
 * not a hand-built fixture. Returns a promise that resolves with the
 * mutated body once the interception has actually fired, so the caller can
 * derive its expectations from exactly what was served.
 */
function interceptSteps(
  page: Page,
  mutate: (real: StepsApiResponse) => StepsApiResponse
): Promise<StepsApiResponse> {
  let resolveMutated: (body: StepsApiResponse) => void;
  const mutatedPromise = new Promise<StepsApiResponse>((resolve) => {
    resolveMutated = resolve;
  });

  page.route(
    (url) => LEVEL_STEPS_RESPONSE_URL_RE.test(url.toString()),
    async (route: Route) => {
      const response = await route.fetch();
      const realJson = await response.json();
      const realBody: StepsApiResponse = realJson?.data ?? realJson;
      const mutatedBody = mutate(realBody);
      const fulfilledJson =
        realJson?.data !== undefined ? { ...realJson, data: mutatedBody } : mutatedBody;
      resolveMutated(mutatedBody);
      await route.fulfill({ response, json: fulfilledJson });
    }
  );

  return mutatedPromise;
}

test.describe("expo web lesson status icons — intercepted /steps (#97 proof)", () => {
  // Real proof: page.route intercepts the level's own `/steps` response,
  // fetches the TRUE payload, mutates specific item statuses, and fulfills
  // with the modified body. Every expectation below is derived from that
  // MODIFIED body (assertLevelDetailMatchesDerivation takes it as an
  // argument), not from what the real seed data happens to contain — so
  // these cases fail if the app ever stops actually reading `/steps` to
  // decide status/dots, independent of today's seed state. Each case gets
  // its own fresh browser context/login (no shared storage) so no
  // persisted progress leaks between cases.

  test("(a) a todo lesson's first learning flips to inProgress: steps -> inProgress, up-next pill/footer flip Start -> Continue", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      let mutatedLessonId: string | undefined;
      const mutatedPromise = interceptSteps(page, (real) => {
        // Pick, purely from the real /steps payload, a lesson that is
        // entirely untouched (every learning/practice/quiz item todo) —
        // its steps-derived status is "todo" before mutation.
        const candidate = (real.lessons ?? []).find((l) => {
          const allItems = [
            ...(l.learnings ?? []),
            ...(l.practices ?? []),
            ...(l.quizzes ?? []),
          ];
          return (
            allItems.length > 0 &&
            allItems.every((i) => i.status === "todo") &&
            (l.learnings?.length ?? 0) > 0
          );
        });
        expect(
          candidate,
          "case (a) needs at least one lesson in /steps with a learning item and every item todo"
        ).toBeTruthy();
        mutatedLessonId = candidate!.lessonid;
        const mutatedLessons = (real.lessons ?? []).map((l) =>
          l.lessonid === candidate!.lessonid
            ? {
                ...l,
                learnings: [
                  { ...l.learnings![0], status: "inProgress" as const },
                  ...l.learnings!.slice(1),
                ],
              }
            : l
        );
        return { ...real, lessons: mutatedLessons };
      });

      await loginViaExpoUi(page, CORPORATE_STUDENT.username, CORPORATE_STUDENT.password);
      const { apiLessons } = await openModule1AndCaptureResponses(page);
      const mutatedStepsBody = await mutatedPromise;

      // eslint-disable-next-line no-console
      console.log(`[lesson-status:case-a] mutated lesson: ${mutatedLessonId}`);

      const { derived, expectedUpNext } = await assertLevelDetailMatchesDerivation(
        page,
        apiLessons,
        mutatedStepsBody.lessons ?? [],
        "case-a"
      );

      const mutatedEntry = derived.find((d) => d.lesson.lessonid === mutatedLessonId)!;
      expect(
        mutatedEntry.status,
        "the mutated lesson's steps-derived status should be inProgress (one learning item started)"
      ).toBe("inProgress");
      expect(
        mutatedEntry.oldStatus,
        "the OLD fallback rule (completed/progress, untouched by this mutation) should still say todo " +
          "— proving the app is reading the NEW /steps-derived rule, not the old one"
      ).toBe("todo");

      const isUpNext = expectedUpNext?.lessonid === mutatedLessonId;
      // eslint-disable-next-line no-console
      console.log(
        `[lesson-status:case-a] mutated lesson is up-next: ${isUpNext} (up-next=${expectedUpNext?.lessonid})`
      );
      if (isUpNext) {
        await expect(
          page.getByRole("button", { name: /^ចាប់ផ្ដើម/ })
        ).toHaveCount(0);
        // Pill/footer text assertions already happened inside
        // assertLevelDetailMatchesDerivation, computed against the
        // MUTATED status (inProgress) — this just confirms the OLD "Start"
        // text is gone, i.e. it really did flip to Continue, not just
        // "some valid text".
      }

      await page.screenshot({ path: test.info().outputPath("case-a.png"), fullPage: true });
    } finally {
      await context.close();
    }
  });

  test("(b) a done lesson's quiz statuses reset to todo: steps -> inProgress, header N/% drop", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      let mutatedLessonId: string | undefined;
      const mutatedPromise = interceptSteps(page, (real) => {
        // A lesson whose every known non-empty type is fully done, with a
        // non-empty quizzes array to reset.
        const candidate = (real.lessons ?? []).find((l) => {
          const types = [l.learnings, l.practices, l.quizzes].filter(
            (arr): arr is StepsApiItem[] => !!arr && arr.length > 0
          );
          return (
            (l.quizzes?.length ?? 0) > 0 &&
            types.length > 0 &&
            types.every((arr) => arr.every((i) => i.status === "done"))
          );
        });
        expect(
          candidate,
          "case (b) needs at least one lesson in /steps that is fully done with a non-empty quizzes array"
        ).toBeTruthy();
        mutatedLessonId = candidate!.lessonid;
        const mutatedLessons = (real.lessons ?? []).map((l) =>
          l.lessonid === candidate!.lessonid
            ? {
                ...l,
                quizzes: (l.quizzes ?? []).map((q) => ({
                  ...q,
                  status: "todo" as const,
                })),
              }
            : l
        );
        return { ...real, lessons: mutatedLessons };
      });

      await loginViaExpoUi(page, CORPORATE_STUDENT.username, CORPORATE_STUDENT.password);
      const { apiLessons } = await openModule1AndCaptureResponses(page);
      const mutatedStepsBody = await mutatedPromise;

      // eslint-disable-next-line no-console
      console.log(`[lesson-status:case-b] mutated lesson: ${mutatedLessonId}`);

      const { derived, expectedDoneCount } = await assertLevelDetailMatchesDerivation(
        page,
        apiLessons,
        mutatedStepsBody.lessons ?? [],
        "case-b"
      );

      const mutatedEntry = derived.find((d) => d.lesson.lessonid === mutatedLessonId)!;
      expect(
        mutatedEntry.status,
        "the mutated lesson's steps-derived status should be inProgress (quizzes reset, learning/practice still done)"
      ).toBe("inProgress");
      expect(
        mutatedEntry.oldStatus,
        "the OLD fallback rule (completed/progress, untouched by this mutation) should still say done " +
          "— the on-screen row shows inProgress instead, proving it reads /steps, not the old rule"
      ).toBe("done");

      // The done count/% already got asserted exactly inside
      // assertLevelDetailMatchesDerivation against the mutated data;
      // this just logs the resulting header value for the record.
      // eslint-disable-next-line no-console
      console.log(
        `[lesson-status:case-b] header now reads doneCount=${expectedDoneCount} (mutated lesson no longer counted as done)`
      );

      await page.screenshot({ path: test.info().outputPath("case-b.png"), fullPage: true });
    } finally {
      await context.close();
    }
  });

  test("(c) a lesson's quizzes array is emptied: quiz dot hidden, aria-label tail omits it", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      let mutatedLessonId: string | undefined;
      const mutatedPromise = interceptSteps(page, (real) => {
        const candidate = (real.lessons ?? []).find(
          (l) => (l.quizzes?.length ?? 0) > 0
        );
        expect(
          candidate,
          "case (c) needs at least one lesson in /steps with a non-empty quizzes array"
        ).toBeTruthy();
        mutatedLessonId = candidate!.lessonid;
        const mutatedLessons = (real.lessons ?? []).map((l) =>
          l.lessonid === candidate!.lessonid ? { ...l, quizzes: [] } : l
        );
        return { ...real, lessons: mutatedLessons };
      });

      await loginViaExpoUi(page, CORPORATE_STUDENT.username, CORPORATE_STUDENT.password);
      const { apiLessons } = await openModule1AndCaptureResponses(page);
      const mutatedStepsBody = await mutatedPromise;

      // eslint-disable-next-line no-console
      console.log(`[lesson-status:case-c] mutated lesson: ${mutatedLessonId}`);

      await assertLevelDetailMatchesDerivation(
        page,
        apiLessons,
        mutatedStepsBody.lessons ?? [],
        "case-c"
      );
      // The generic per-row assertion above already required the row's
      // aria-label to equal describeStepsExpected()'s tail EXACTLY, which
      // (per LessonStepDots.tsx's `STEP_ORDER.filter(total > 0)`) omits the
      // quiz clause entirely once quizzes is empty — that alone proves the
      // tail change. This adds the direct, visual half of the same claim:
      // no quiz-labelled dot renders in this row's DOM at all.
      const mutatedRow = page.locator(`[data-testid="lesson-row-${mutatedLessonId}"]`);
      await expect(
        mutatedRow.getByText(KM.quizTitle, { exact: false }),
        `lesson-row-${mutatedLessonId} should render no "${KM.quizTitle}" (quiz) dot label after its quizzes array was emptied`
      ).toHaveCount(0);

      await page.screenshot({ path: test.info().outputPath("case-c.png"), fullPage: true });
    } finally {
      await context.close();
    }
  });
});
