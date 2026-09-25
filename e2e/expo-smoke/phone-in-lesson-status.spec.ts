/**
 * In-lesson activity status rows — regression net for the LessonSelectionScreen
 * v2.1 corporate rework (edtech-expo, branch test/expo-in-lesson-status): the
 * old three-section list (Learning/Practice/Quiz headers, each with its own
 * "<done>/<total>" count, plus a separate "lesson-activities-summary" line)
 * is GONE. The v2.1 screen renders a single "In this lesson" list, in
 * hierarchy order (all learnings, then practices, then quizzes), sourced from
 * `GET lesson/:lessonid/activities/progress`.
 *
 * Sibling of phone-lesson-status.spec.ts (Level Detail screen, one level
 * up) — same account, same DCRS content, same "compare against the API's
 * own response" method: an earlier version of that sibling spec was
 * decorative until a mutation proof (forcing every status to "todo") caught
 * it, so this spec follows the same shape rather than trusting the DOM
 * alone.
 *
 * Source of truth for testIDs/strings (read directly against the running
 * app at localhost:8091 and the edtech-expo source, not guessed):
 *  - edtech-expo src/screens/LessonSelection/LessonSelectionScreen.tsx —
 *    the `isCorporate` branch builds a flat `steps` array (learnings, then
 *    practices, then quizzes, each carrying a 1-based `indexInType` /
 *    `countInType`), a "Lesson N" chip (screen.level.lessonChip), a meta
 *    line ("Grade · Level · N videos · N practices · N quizzes", zero-count
 *    parts omitted, joined with ' · '), an "In this lesson" heading
 *    (screen.lesson.inThisLesson), one <LessonStepRow> per step
 *    (testID `activity-row-<type>-<id>`), and — only when something isn't
 *    done — a footer <AppButton> (screen.lesson.footerCta /
 *    footerCtaWithIndex) targeting `nextStep`, the first step (in that same
 *    order) whose status isn't 'done'.
 *  - src/components/ui/LessonStepRow.tsx — the next step (`isNext`) gets a
 *    2px `theme.colors.primary` border and a <CtaPill variant="tint"> in
 *    place of its status icon; every other row gets a 1px
 *    `theme.colors.divider` border and a plain <StatusIcon
 *    testID={`status-icon-${status}`}/>. No row has a box-shadow ("one glow
 *    per screen, reserved for the footer CTA"). A learning row's thumbnail
 *    renders its own play-disc overlay (an <Svg><Path d="M5 3l12 7-12
 *    7V3z"/></Svg> inside a dark translucent circle) — the only play glyph
 *    anywhere on this screen; no other row/element should contain it or the
 *    old solid play-triangle path.
 *  - src/components/ui/CtaPill.tsx — testID "cta-pill" by default.
 *  - src/services/hooks/useActivityProgress.ts — fetches
 *    lesson/:lessonId/activities/progress on mount/focus and merges into
 *    the persisted `activityProgress` redux slice, never downgrading a
 *    status already held. `unsyncedFor` (done practice/quiz still in the
 *    offline pendingResults queue) drives LessonStepRow's `unsynced-badge`.
 *  - src/locales/km.json (screen.lesson.*, cta.*) — exact Khmer strings and
 *    interpolation keys copied verbatim below, not hand-typed a second
 *    time. compatibilityJSON is 'v3' (app/(app)/_layout.tsx) but none of
 *    these keys carry a `_plural` sibling in km.json, so simple `{{count}}`/
 *    `{{n}}` substitution is correct for every count this spec exercises.
 *  - Confirmed live (browsing localhost:8091 as miv.verify, DCRS ->
 *    Cohort II -> Module 1: Business Vision & Goals -> "Your business
 *    vision", lesson c0000000-0000-4000-8000-000000000009): the meta line
 *    reads exactly "Cohort II · Module 1: Business Vision & Goals ·
 *    វីដេអូ 1 · លំហាត់ 1 · តេស្ត 1"; the captured activities/progress
 *    response is
 *    {"lessonid":"...09","pass_percentage":80,
 *     "learnings":[{"lessonlearningid":"...11","status":"done","progress_percentage":100}],
 *     "practices":[{"lessonpracticeid":"...15","status":"todo","attempts":0,"best_percentage":null,"question_count":1}],
 *     "quizzes":[{"lessonquizid":"...19","status":"todo","attempts":0,"best_percentage":null,"question_count":2}]};
 *    the practice row (the up-next row: learning already done) has a 2px
 *    rgb(11, 95, 255) border and a cta-pill reading "ចាប់ផ្ដើម"; the
 *    learning and quiz rows both have a 1px rgb(227, 232, 239) border; no
 *    row has a box-shadow; the footer button's accessible name is exactly
 *    "ចាប់ផ្ដើម អនុវត្ត" (single practice, so no trailing index); the
 *    play-disc path (M5 3l12 7-12 7V3z) appears exactly once on the page,
 *    inside the learning row; the old play-triangle path/polygon appear
 *    zero times.
 *
 * The second test below proves persistence, not just in-memory rendering:
 * it waits for redux-persist to actually write lessonCache/activityProgress
 * into localStorage's `persist:root`, then cuts off the rpi API origin
 * (page.route(...).abort) and does a real page.reload() on the current
 * lesson route — the web token lives in sessionStorage, which (per
 * back-button-reload.spec.ts) survives a reload, and Metro keeps serving
 * the JS bundle since only the rpi API origin is aborted, not the app's own
 * origin. An earlier version of this test went offline and navigated back
 * within the same page, which the in-memory redux store alone would have
 * satisfied even if the persist whitelist were removed — this version
 * would not pass that way.
 */
import { test, expect, Page, Locator } from '@playwright/test';
import {
  CORPORATE_STUDENT,
  goToFirstDcrsLessonActivities,
  loginViaExpoUi,
} from './fixtures';

const CTA_START_KM = 'ចាប់ផ្ដើម';
const CTA_CONTINUE_KM = 'បន្ត';

const OLD_PLAY_PATH_D = 'M6 4.5v15l14-7.5-14-7.5z';
/** LessonStepRow's PlayDiscOverlay path — the ONLY play glyph this screen
 *  should ever render, and only inside the learning row's thumbnail. */
const THUMBNAIL_PLAY_PATH_D = 'M5 3l12 7-12 7V3z';

const ACTIVITY_PROGRESS_URL_RE = /\/lesson\/[^/?]+\/activities\/progress(?:\?|$)/;

/** "Your business vision" — the DCRS seed's mixed-status lesson this spec
 *  pins on (see goToFirstDcrsLessonActivities's call below), confirmed
 *  live via GET /lesson/level/<levelId> the same way
 *  e2e/security/activity-progress-rpi.spec.ts confirms its own lesson ids. */
const PINNED_LESSON_ID = 'c0000000-0000-4000-8000-000000000009';

/** miv.verify's fixed nav path to the pinned lesson (DCRS -> Cohort II ->
 *  Module 1 -> "Your business vision") — the exact button text clicked
 *  along the way, confirmed live, which is also what the app's own meta
 *  line renders for `selectedCourse.gradename` / `selectedUnit.levelname`
 *  (LessonSelectionScreen.tsx's `metaParts`). Hardcoded rather than
 *  re-derived because this suite always drives this same fixed seed path. */
const GRADENAME_KM = 'Cohort II';
const LEVELNAME_KM = 'Module 1: Business Vision & Goals';

type ActivityKind = 'learnings' | 'practices' | 'quizzes';

interface ApiLearning {
  lessonlearningid: string;
  status: 'done' | 'inProgress' | 'todo';
  progress_percentage: number;
}
interface ApiAttempted {
  status: 'done' | 'inProgress' | 'todo';
  attempts: number;
  best_percentage: number | null;
  question_count: number;
}
interface ApiPractice extends ApiAttempted {
  lessonpracticeid: string;
}
interface ApiQuiz extends ApiAttempted {
  lessonquizid: string;
}
interface ActivityProgressResponse {
  lessonid: string;
  pass_percentage: number;
  learnings: ApiLearning[];
  practices: ApiPractice[];
  quizzes: ApiQuiz[];
}

/** Row `type` segment used in `activity-row-<type>-<id>` testIDs. */
const TYPE_FOR: Record<ActivityKind, 'learning' | 'practice' | 'quiz'> = {
  learnings: 'learning',
  practices: 'practice',
  quizzes: 'quiz',
};

/** screen.lesson.stepType.<type> from km.json — same Khmer string as the
 *  old section titles (learningTitle/practiceTitle/quizTitle), but this is
 *  the key the v2.1 screen's `stepTypeLabel` actually reads. */
const STEP_TYPE_KM: Record<'learning' | 'practice' | 'quiz', string> = {
  learning: 'សិក្សា',
  practice: 'អនុវត្ត',
  quiz: 'តេស្ត',
};

const idFor = (kind: ActivityKind, item: ApiLearning | ApiPractice | ApiQuiz): string =>
  kind === 'learnings'
    ? (item as ApiLearning).lessonlearningid
    : kind === 'practices'
      ? (item as ApiPractice).lessonpracticeid
      : (item as ApiQuiz).lessonquizid;

/** A flattened, ordered view of the API response: learnings, then
 *  practices, then quizzes — LessonSelectionScreen's own `steps` order,
 *  which is also the order it picks `nextStep` in and the order this
 *  spec asserts the rows render in. */
interface Step {
  kind: ActivityKind;
  type: 'learning' | 'practice' | 'quiz';
  id: string;
  status: 'done' | 'inProgress' | 'todo';
  indexInType: number;
  countInType: number;
  questionCount?: number;
}

function stepsFor(data: ActivityProgressResponse): Step[] {
  const steps: Step[] = [];
  (['learnings', 'practices', 'quizzes'] as const).forEach(kind => {
    const items = data[kind];
    items.forEach((item, i) => {
      steps.push({
        kind,
        type: TYPE_FOR[kind],
        id: idFor(kind, item),
        status: item.status,
        indexInType: i + 1,
        countInType: items.length,
        questionCount: kind === 'learnings' ? undefined : (item as ApiAttempted).question_count,
      });
    });
  });
  return steps;
}

/** LessonSelectionScreen's own `nextStep` rule: first not-done step, in
 *  learnings -> practices -> quizzes order. */
function findNextStep(steps: Step[]): Step | undefined {
  return steps.find(s => s.status !== 'done');
}

/** screen.lesson.stepEyebrowWithCount / stepType.<type> — "<type> · i of n"
 *  when there's more than one of that type, else just the bare type label. */
function eyebrowKm(step: Step): string {
  const type = STEP_TYPE_KM[step.type];
  return step.countInType > 1
    ? `${type} · ${step.indexInType} ក្នុងចំណោម ${step.countInType}`
    : type;
}

/** screen.lesson.practiceQuestions / quizQuestions — practice/quiz row
 *  titles are built from question_count, not the activity's own name. */
function questionsTitleKm(step: Step): string | undefined {
  if (step.type === 'learning' || step.questionCount == null) return undefined;
  return step.type === 'practice'
    ? `សំណួរ ${step.questionCount} · មិនដាក់ពិន្ទុ`
    : `សំណួរ ${step.questionCount} · ដាក់ពិន្ទុ`;
}

/** screen.lesson.status.* — the row's status line, folding in the
 *  unsynced/learningDone/quizTodo special cases exactly as
 *  LessonSelectionScreen's `statusTextFor` does. */
function statusTextKm(step: Step, unsynced: boolean): string {
  if (unsynced && step.status === 'done') {
    return 'បានបញ្ចប់ · បានរក្សាទុកក្នុងឧបករណ៍ មិនទាន់ធ្វើសមកាលកម្ម';
  }
  if (step.status === 'done') {
    return step.type === 'learning'
      ? 'បានបញ្ចប់ · អាចមើលឡើងវិញបានគ្រប់ពេល'
      : 'បានបញ្ចប់';
  }
  if (step.status === 'inProgress') return 'កំពុងដំណើរការ';
  // todo
  return step.type === 'quiz'
    ? 'មិនទាន់ចាប់ផ្តើម · ត្រូវប្រលងជាប់ដើម្បីបញ្ចប់មេរៀន'
    : 'មិនទាន់ចាប់ផ្តើម';
}

/** screen.lesson.footerCta / footerCtaWithIndex — footer button's exact
 *  accessible name, only rendered when `nextStep` exists. */
function footerLabelKm(nextStep: Step): string {
  const verb = nextStep.status === 'inProgress' ? CTA_CONTINUE_KM : CTA_START_KM;
  const type = STEP_TYPE_KM[nextStep.type];
  return nextStep.countInType > 1
    ? `${verb} ${type} ${nextStep.indexInType}`
    : `${verb} ${type}`;
}

/** screen.lesson.metaVideos/metaPractices/metaQuizzes joined with the
 *  fixed grade/level breadcrumb text, zero-count parts omitted — exactly
 *  as LessonSelectionScreen's `metaParts.filter(Boolean).join(' · ')`. */
function metaLineKm(data: ActivityProgressResponse): string {
  const parts = [GRADENAME_KM, LEVELNAME_KM];
  if (data.learnings.length > 0) parts.push(`វីដេអូ ${data.learnings.length}`);
  if (data.practices.length > 0) parts.push(`លំហាត់ ${data.practices.length}`);
  if (data.quizzes.length > 0) parts.push(`តេស្ត ${data.quizzes.length}`);
  return parts.join(' · ');
}

/** Asserts the play-disc glyph (THUMBNAIL_PLAY_PATH_D) appears exactly
 *  once on the whole page, and only inside `learningRow` (its thumbnail
 *  overlay) — and that neither the old play-triangle <path> nor a
 *  <polygon> play glyph appears anywhere. */
async function assertPlayGlyphOnlyInThumbnail(
  page: Page,
  learningRow: Locator,
): Promise<void> {
  expect(
    await page.locator('svg polygon').count(),
    'found a <polygon> (old play triangle) glyph somewhere on the page',
  ).toBe(0);
  expect(
    await page.locator(`svg path[d="${OLD_PLAY_PATH_D}"]`).count(),
    'found the old play-triangle <path> (M6 4.5v15l14-7.5-14-7.5z) somewhere on the page',
  ).toBe(0);

  const thumbnailPlayPaths = page.locator(`svg path[d="${THUMBNAIL_PLAY_PATH_D}"]`);
  expect(
    await thumbnailPlayPaths.count(),
    'expected exactly one play-disc glyph (the learning thumbnail\'s) on the page',
  ).toBe(1);
  expect(
    await learningRow.locator(`svg path[d="${THUMBNAIL_PLAY_PATH_D}"]`).count(),
    'the one play-disc glyph on the page should be inside the learning row\'s thumbnail',
  ).toBe(1);
}

/**
 * Asserts the on-screen "In this lesson" list matches `data` exactly:
 * row order (learnings, then practices, then quizzes), each row's eyebrow/
 * title/status text, exactly one cta-pill on the right row with the right
 * text and a 2px primary border, every other row's plain status icon and
 * 1px divider border, no row box-shadow, the meta line, the footer button,
 * and that the only play glyph anywhere is the learning thumbnail's.
 */
async function assertActivityListMatches(
  page: Page,
  data: ActivityProgressResponse,
): Promise<void> {
  const steps = stepsFor(data);
  expect(steps.length, 'expected at least one activity in the response').toBeGreaterThan(0);
  const nextStep = findNextStep(steps);

  // Row order: DOM order of activity-row-* testIDs must equal
  // learnings -> practices -> quizzes, in each kind's own order.
  const rowTestIds = await page.locator('[data-testid^="activity-row-"]').evaluateAll(
    els => els.map(el => el.getAttribute('data-testid')),
  );
  expect(rowTestIds).toEqual(steps.map(s => `activity-row-${s.type}-${s.id}`));

  let learningRow: Locator | undefined;
  let pillCount = 0;

  for (const step of steps) {
    const row = page.locator(`[data-testid="activity-row-${step.type}-${step.id}"]`);
    await expect(row, `expected activity-row-${step.type}-${step.id} on screen`).toHaveCount(1);
    if (step.type === 'learning') learningRow = row;

    // Eyebrow (type, plus " · i of n" when there's more than one of this type).
    await expect(row).toContainText(eyebrowKm(step));

    // Title: practice/quiz titles are built from question_count; learning
    // titles come from the lesson's own content name, not this response,
    // so this spec doesn't assert an exact learning title string.
    const expectedTitle = questionsTitleKm(step);
    if (expectedTitle) await expect(row).toContainText(expectedTitle);

    const isNext = nextStep?.id === step.id && nextStep.type === step.type;
    const pill = row.locator('[data-testid="cta-pill"]');
    const statusIcon = row.locator(`[data-testid="status-icon-${step.status}"]`);
    const border = await row.evaluate(el => {
      const cs = getComputedStyle(el);
      return { width: cs.borderWidth, color: cs.borderColor, shadow: cs.boxShadow };
    });
    expect(border.shadow, `activity-row-${step.type}-${step.id} should have no box-shadow`).toBe(
      'none',
    );

    if (isNext) {
      pillCount += 1;
      await expect(
        pill,
        `next-step row activity-row-${step.type}-${step.id} should show the cta-pill`,
      ).toHaveCount(1);
      const expectedCta = step.status === 'inProgress' ? CTA_CONTINUE_KM : CTA_START_KM;
      expect((await pill.innerText()).trim()).toBe(expectedCta);
      await expect(
        row.locator('[data-testid^="status-icon-"]'),
        `next-step row activity-row-${step.type}-${step.id} should not also show a status icon`,
      ).toHaveCount(0);
      expect(border.width, 'next-step row should have a 2px border').toBe('2px');
      expect(border.color, 'next-step row border should be primary rgb(11, 95, 255)').toBe(
        'rgb(11, 95, 255)',
      );
    } else {
      await expect(
        pill,
        `non-next-step row activity-row-${step.type}-${step.id} should not show a cta-pill`,
      ).toHaveCount(0);
      await expect(
        statusIcon,
        `activity-row-${step.type}-${step.id} (status ${step.status}) should show status-icon-${step.status}`,
      ).toHaveCount(1);
      expect(border.width, 'non-next-step row should have a 1px border').toBe('1px');
      expect(border.color, 'non-next-step row border should be the divider token rgb(227, 232, 239)').toBe(
        'rgb(227, 232, 239)',
      );
    }

    // Status line (exact km string, built the way the app builds it).
    // unsynced-badge is only ever plausible for a done, non-learning row —
    // this spec doesn't have visibility into the client's offline
    // pendingResults queue from outside, so it checks the structural rule
    // (never on learning rows, never on a non-done row) rather than an
    // exact presence/absence per row.
    const unsyncedBadge = row.locator('[data-testid="unsynced-badge"]');
    const unsyncedBadgeCount = await unsyncedBadge.count();
    if (unsyncedBadgeCount > 0) {
      expect(
        step.type !== 'learning' && step.status === 'done',
        `unsynced-badge on activity-row-${step.type}-${step.id} should only appear on a done practice/quiz row`,
      ).toBe(true);
    }
    await expect(row).toContainText(statusTextKm(step, unsyncedBadgeCount > 0));
  }

  expect(pillCount, 'expected exactly one cta-pill across the whole activity list').toBe(
    nextStep ? 1 : 0,
  );

  expect(learningRow, 'expected a learning row to check the play-disc scoping against').toBeTruthy();
  if (learningRow) await assertPlayGlyphOnlyInThumbnail(page, learningRow);

  // Meta line: "Grade · Level · N videos · N practices · N quizzes",
  // zero-count parts omitted, exact km text.
  await expect(page.getByText(metaLineKm(data), { exact: true })).toBeVisible();

  // "In this lesson" heading.
  await expect(page.getByText('នៅក្នុងមេរៀននេះ', { exact: true })).toBeVisible();

  // Footer: only rendered while something isn't done, targeting nextStep.
  if (nextStep) {
    const footerButton = page.getByRole('button', {
      name: footerLabelKm(nextStep),
      exact: true,
    });
    await expect(footerButton).toBeVisible();
  } else {
    // Nothing left to start/continue — no footer CTA at all.
    await expect(page.getByRole('button', { name: CTA_START_KM })).toHaveCount(0);
    await expect(page.getByRole('button', { name: CTA_CONTINUE_KM })).toHaveCount(0);
  }

  // Soft warning, not a failure: if every activity is done (or none are),
  // this lesson doesn't exercise the next-step-row-vs-status-icon
  // distinction the rest of this function checks so carefully.
  const totalDone = steps.filter(s => s.status === 'done').length;
  if (totalDone === 0 || totalDone === steps.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[in-lesson-status] lesson ${data.lessonid} has no mix of done/not-done ` +
        `activities (done=${totalDone}/${steps.length}) — the next-step-row-vs-` +
        'status-icon distinction is not meaningfully exercised by this run.',
    );
  }
}

test.describe('expo web in-lesson activity status (corporate / DCRS)', () => {
  // Each test is independent (fresh login + navigation via beforeEach) so a
  // failure in one doesn't cascade into the next, and so neither test
  // relies on DOM/redux state a previous test happened to leave behind.
  let context: import('@playwright/test').BrowserContext;
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    // Fresh context per test: empty persisted redux-persist store, so the
    // FIRST render's UI status is whatever mergeServer just wrote from the
    // captured response — not a leftover value from a previous test's
    // persisted state. This is what makes "UI status == server status" true.
    context = await browser.newContext();
    page = await context.newPage();
    await loginViaExpoUi(page, CORPORATE_STUDENT.username, CORPORATE_STUDENT.password);
  });

  test.afterEach(async () => {
    await context?.close();
  });

  test('activity rows reflect the activities/progress API response', async () => {
    const progressResponsePromise = page.waitForResponse(
      res =>
        res.request().method() === 'GET' &&
        ACTIVITY_PROGRESS_URL_RE.test(res.url()) &&
        res.ok(),
      { timeout: 10_000 },
    );

    // Reaches DCRS -> Cohort II -> Module 1 -> lesson -> activity list.
    // "Your business vision" is Module 1's mixed-status DCRS seed lesson
    // (learning done, practice/quiz todo) rather than the fully-done
    // "Why direction matters", which would give this test nothing to
    // distinguish "next-step row" from "any other row".
    await goToFirstDcrsLessonActivities(page, 'Your business vision');

    const progressResponse = await progressResponsePromise;
    const body = await progressResponse.json();
    const data: ActivityProgressResponse = body.data;

    expect(data.lessonid, 'captured response should be for the pinned lesson').toBe(
      PINNED_LESSON_ID,
    );

    // v2.1 drops the corporate Lesson screen's app-bar title (see
    // goToFirstDcrsLessonActivities's own comment) — assert the "In this
    // lesson" heading text (screen.lesson.inThisLesson, a plain Text with no
    // accessibilityRole) that assertActivityListMatches also checks below,
    // instead of the removed KM.lessonHeader app-bar heading.
    await expect(page.getByText('នៅក្នុងមេរៀននេះ', { exact: true })).toBeVisible();
    await assertActivityListMatches(page, data);

    await page.screenshot({
      path: test.info().outputPath('activities.png'),
      fullPage: true,
    });
  });

  test('lesson activity statuses survive a reload with the rpi API unreachable (persisted store, not live memory)', async () => {
    const progressResponsePromise = page.waitForResponse(
      res =>
        res.request().method() === 'GET' &&
        ACTIVITY_PROGRESS_URL_RE.test(res.url()) &&
        res.ok(),
      { timeout: 10_000 },
    );
    await goToFirstDcrsLessonActivities(page, 'Your business vision');
    const progressResponse = await progressResponsePromise;
    const body = await progressResponse.json();
    const capturedData: ActivityProgressResponse = body.data;
    const capturedApiUrl = progressResponse.url();

    const steps = stepsFor(capturedData);
    const activityIds = steps.map(s => s.id);
    expect(activityIds.length, 'expected at least one activity id to look for').toBeGreaterThan(0);

    // redux-persist writes `persist:root` as a JSON object whose values are
    // THEMSELVES JSON strings, one per whitelisted slice (persistReducer's
    // own serialization) — so this parses twice: once for persist:root,
    // once per slice string, rather than substring-matching the raw
    // localStorage value.
    async function readPersistedSlice(sliceKey: string): Promise<string | undefined> {
      return page.evaluate(key => {
        const raw = window.localStorage.getItem('persist:root');
        if (!raw) return undefined;
        try {
          const root = JSON.parse(raw) as Record<string, string>;
          return root[key];
        } catch {
          return undefined;
        }
      }, sliceKey);
    }

    // Throttled writes (redux-persist debounces to localStorage), so this
    // polls rather than reading once immediately after the API response.
    await expect
      .poll(
        async () => {
          const [lessonCacheRaw, activityProgressRaw] = await Promise.all([
            readPersistedSlice('lessonCache'),
            readPersistedSlice('activityProgress'),
          ]);
          const lessonCacheHasLesson =
            typeof lessonCacheRaw === 'string' && lessonCacheRaw.includes(capturedData.lessonid);
          const activityProgressHasAllIds =
            typeof activityProgressRaw === 'string' &&
            activityIds.every(id => activityProgressRaw.includes(id));
          return lessonCacheHasLesson && activityProgressHasAllIds;
        },
        {
          message:
            'waiting for redux-persist to write the lesson into lessonCache and its ' +
            'activity ids into activityProgress under localStorage persist:root',
          timeout: 15_000,
        },
      )
      .toBe(true);

    // Cut off the rpi API origin only — Metro/the app's own origin (which
    // serves the JS bundle on reload) is left untouched, so a failure here
    // is about this app's offline-first behaviour, not about the browser's
    // own document cache.
    const apiOrigin = new URL(capturedApiUrl).origin;
    const routePattern = `${apiOrigin}/**`;
    await page.route(routePattern, route => route.abort('internetdisconnected'));
    try {
      // The web token lives in sessionStorage, which (per
      // back-button-reload.spec.ts) survives a reload — only the rpi API
      // calls are cut off, not the app's own auth state.
      await page.reload();

      // If other boot-time API calls (e.g. the profile fetch) also hit the
      // aborted origin, the app may bounce to login or render blank instead
      // of the lesson screen. That would be a real offline-first bug, not
      // something to special-case around here — this assertion is left as
      // the correct expected behaviour (the lesson screen reappearing from
      // persisted state) so it fails loudly and reports that finding
      // precisely, rather than being papered over.
      // Same v2.1 substitution as the test above — no app-bar title to wait
      // on, so assert the "In this lesson" heading text reappeared from
      // persisted state instead.
      await expect(page.getByText('នៅក្នុងមេរៀននេះ', { exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await assertActivityListMatches(page, capturedData);
    } finally {
      await page.unroute(routePattern);
    }
  });
});
