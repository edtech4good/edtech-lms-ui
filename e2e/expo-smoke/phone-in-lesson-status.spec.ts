/**
 * In-lesson activity status icons — regression net for the LessonSelectionScreen
 * corporate rework (edtech-expo, branch feat/activity-progress /
 * feat/in-lesson-status): each learning/practice/quiz row in a lesson's
 * activity list now shows a done/inProgress/todo status icon (or a CTA pill
 * on the single "up next" row) sourced from
 * `GET lesson/:lessonid/activities/progress`, replacing the old
 * always-a-play-icon rows.
 *
 * Sibling of phone-lesson-status.spec.ts (Level Detail screen, one level
 * up) — same account, same DCRS content, same "compare against the API's
 * own response" method: an earlier version of that sibling spec was
 * decorative until a mutation proof (forcing every status to "todo") caught
 * it, so this spec follows the same shape rather than trusting the DOM
 * alone.
 *
 * Source of truth for testIDs/strings (read directly, not guessed):
 *  - edtech-expo src/screens/LessonSelection/LessonSelectionScreen.tsx —
 *    corporateSection() renders `activity-section-<type>` (EyebrowText,
 *    "<title> · <done>/<total>"), `lesson-activities-summary`
 *    (screen.lesson.activitiesDone), and per-row
 *    `activity-row-<type>-<id>` (ContinueLearningRow). trailingFor() gives
 *    the up-next row (first not-done id in learnings -> practices -> quizzes
 *    order) a ctaLabel (cta.continue/cta.start) instead of a status.
 *  - src/components/ui/ContinueLearningRow.tsx — trailing?.ctaLabel wins:
 *    renders <CtaPill> (testID "cta-pill", defaulted in CtaPill.tsx) and
 *    OMITS the StatusIcon entirely for that row; every other row renders
 *    <StatusIcon status=... /> whose own testID defaults to
 *    `status-icon-<status>` (StatusIcon.tsx).
 *  - src/services/hooks/useActivityProgress.ts — fetches
 *    lesson/:lessonId/activities/progress on mount/focus and merges into
 *    the persisted `activityProgress` redux slice (ActivityProgressSlice.ts),
 *    never downgrading a status already held.
 *  - src/locales/km.json — cta.start "ចាប់ផ្ដើម", cta.continue "បន្ត",
 *    screen.lesson.activitiesDone "បានបញ្ចប់សកម្មភាព {{done}} ក្នុងចំណោម {{total}}".
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
import { test, expect, Page } from '@playwright/test';
import {
  CORPORATE_STUDENT,
  KM,
  goToFirstDcrsLessonActivities,
  loginViaExpoUi,
} from './fixtures';

const CTA_START_KM = 'ចាប់ផ្ដើម';
const CTA_CONTINUE_KM = 'បន្ត';

const OLD_PLAY_PATH_D = 'M6 4.5v15l14-7.5-14-7.5z';

const ACTIVITY_PROGRESS_URL_RE = /\/lesson\/[^/?]+\/activities\/progress(?:\?|$)/;

/** "Your business vision" — the DCRS seed's mixed-status lesson this spec
 *  pins on (see goToFirstDcrsLessonActivities's call below), confirmed
 *  live via GET /lesson/level/<levelId> the same way
 *  e2e/security/activity-progress-rpi.spec.ts confirms its own lesson ids. */
const PINNED_LESSON_ID = 'c0000000-0000-4000-8000-000000000009';

/** screen.lesson.activitiesDone from edtech-expo's src/locales/km.json,
 *  "បានបញ្ចប់សកម្មភាព {{done}} ក្នុងចំណោម {{total}}" — read directly from that
 *  file, not guessed, with {{done}}/{{total}} substituted the way i18n
 *  would render them. */
function activitiesDoneKm(done: number, total: number): string {
  return `បានបញ្ចប់សកម្មភាព ${done} ក្នុងចំណោម ${total}`;
}

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

/** Row `type` segment used in `activity-row-<type>-<id>` / `activity-section-<type>` testIDs. */
const TYPE_FOR: Record<ActivityKind, string> = {
  learnings: 'learning',
  practices: 'practice',
  quizzes: 'quiz',
};

const idFor = (kind: ActivityKind, item: ApiLearning | ApiPractice | ApiQuiz): string =>
  kind === 'learnings'
    ? (item as ApiLearning).lessonlearningid
    : kind === 'practices'
      ? (item as ApiPractice).lessonpracticeid
      : (item as ApiQuiz).lessonquizid;

/** LessonSelectionScreen's own up-next rule: first not-done id, in
 *  learnings -> practices -> quizzes order (copied from its
 *  `orderedActivityIds` / `nextActivityId`, not reimplemented from memory). */
function findUpNext(
  data: ActivityProgressResponse,
): { kind: ActivityKind; id: string; status: string } | undefined {
  for (const kind of ['learnings', 'practices', 'quizzes'] as const) {
    for (const item of data[kind]) {
      if (item.status !== 'done') {
        return { kind, id: idFor(kind, item), status: item.status };
      }
    }
  }
  return undefined;
}

async function assertNoPlayGlyph(scope: ReturnType<Page['locator']>) {
  expect(
    await scope.locator('svg polygon').count(),
    'found a <polygon> (old play triangle) glyph',
  ).toBe(0);
  expect(
    await scope.locator(`svg path[d="${OLD_PLAY_PATH_D}"]`).count(),
    'found the old play-triangle <path> (M6 4.5v15l14-7.5-14-7.5z)',
  ).toBe(0);
}

/**
 * Asserts the on-screen activity list matches `data` exactly: every
 * activity has its row, the row carries the right status icon (or, for the
 * single up-next activity, the cta-pill with the right text and no status
 * icon), section header done/total counts, the lesson summary text, and no
 * leftover play glyph anywhere.
 */
async function assertActivityListMatches(
  page: Page,
  data: ActivityProgressResponse,
): Promise<void> {
  const upNext = findUpNext(data);

  for (const kind of ['learnings', 'practices', 'quizzes'] as const) {
    const type = TYPE_FOR[kind];
    const items = data[kind];
    const done = items.filter(i => i.status === 'done').length;
    const total = items.length;

    if (total === 0) continue;

    const section = page.locator(`[data-testid="activity-section-${type}"]`);
    await expect(section).toHaveCount(1);
    await expect(section).toContainText(`${done}/${total}`);

    for (const item of items) {
      const id = idFor(kind, item);
      const row = page.locator(`[data-testid="activity-row-${type}-${id}"]`);
      await expect(row, `expected activity-row-${type}-${id} on screen`).toHaveCount(1);
      await assertNoPlayGlyph(row);

      const isUpNext = upNext?.kind === kind && upNext.id === id;
      const pill = row.locator('[data-testid="cta-pill"]');
      const statusIcon = row.locator(`[data-testid="status-icon-${item.status}"]`);

      if (isUpNext) {
        await expect(
          pill,
          `up-next row activity-row-${type}-${id} should show the cta-pill`,
        ).toHaveCount(1);
        const expectedText = item.status === 'inProgress' ? CTA_CONTINUE_KM : CTA_START_KM;
        const pillText = (await pill.innerText()).trim();
        expect(
          pillText,
          `up-next row's cta-pill text should be "${expectedText}" (status ${item.status})`,
        ).toBe(expectedText);
        // Up-next row swaps the status icon out entirely for the pill.
        await expect(
          row.locator('[data-testid^="status-icon-"]'),
          `up-next row activity-row-${type}-${id} should not also show a status icon`,
        ).toHaveCount(0);
      } else {
        await expect(
          pill,
          `non-up-next row activity-row-${type}-${id} should not show a cta-pill`,
        ).toHaveCount(0);
        await expect(
          statusIcon,
          `activity-row-${type}-${id} (status ${item.status}) should show status-icon-${item.status}`,
        ).toHaveCount(1);
      }
    }
  }

  const totalActivities =
    data.learnings.length + data.practices.length + data.quizzes.length;
  const totalDone =
    data.learnings.filter(i => i.status === 'done').length +
    data.practices.filter(i => i.status === 'done').length +
    data.quizzes.filter(i => i.status === 'done').length;
  if (totalActivities > 0) {
    const summary = page.locator('[data-testid="lesson-activities-summary"]');
    await expect(summary).toHaveCount(1);
    // Exact km string, not a digit substring match — screen.lesson
    // .activitiesDone in edtech-expo's src/locales/km.json, confirmed
    // verbatim (see activitiesDoneKm's own header comment). A digit-only
    // check could pass against unrelated text that happens to contain the
    // same numbers.
    await expect(summary).toContainText(activitiesDoneKm(totalDone, totalActivities));
  }

  // No pill anywhere when every activity is done.
  if (!upNext) {
    await expect(page.locator('[data-testid="cta-pill"]')).toHaveCount(0);
  }

  // Soft warning, not a failure: if every activity is done (or none are),
  // this lesson doesn't exercise the up-next-row-vs-status-icon
  // distinction the rest of this function checks so carefully.
  if (totalActivities > 0 && (totalDone === 0 || totalDone === totalActivities)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[in-lesson-status] lesson ${data.lessonid} has no mix of done/not-done ` +
        `activities (done=${totalDone}/${totalActivities}) — the up-next-row-vs-` +
        'status-icon distinction is not meaningfully exercised by this run.',
    );
  }
}

test.describe('expo web in-lesson activity status (corporate / DCRS)', () => {
  test.describe.configure({ mode: 'serial' });

  let context: import('@playwright/test').BrowserContext;
  let page: Page;
  let capturedData: ActivityProgressResponse;
  /** Full URL of the captured activities/progress response — its origin is
   *  what the offline-persistence test below routes and aborts. */
  let capturedApiUrl: string;

  test.beforeAll(async ({ browser }) => {
    // Fresh context: empty persisted redux-persist store, so the FIRST
    // render's UI status is whatever mergeServer just wrote from the
    // response below — not a leftover value from a previous run's
    // persisted state. This is what makes "UI status == server status"
    // true for this test.
    context = await browser.newContext();
    page = await context.newPage();
    await loginViaExpoUi(page, CORPORATE_STUDENT.username, CORPORATE_STUDENT.password);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('activity rows reflect the activities/progress API response', async () => {
    // Registered BEFORE the navigation that triggers it
    // (goToFirstDcrsLessonActivities's final click, which selects the
    // named lesson and mounts LessonSelectionScreen, whose
    // useActivityProgress effect fires the
    // GET lesson/:lessonid/activities/progress request) —
    // waitForResponse only catches responses that complete AFTER it
    // starts listening.
    const progressResponsePromise = page.waitForResponse(
      res =>
        res.request().method() === 'GET' &&
        ACTIVITY_PROGRESS_URL_RE.test(res.url()) &&
        res.ok(),
      { timeout: 10_000 },
    );

    // Reaches DCRS -> Cohort II -> Module 1 -> lesson -> activity list.
    // goToFirstDcrsLessonActivities defaults to lesson 1 ("Why direction
    // matters"); Module 1's up-next lesson per the level API is actually
    // lesson 2 ("Your business vision", the DCRS seed's
    // partially-completed one) — pass its title explicitly so this spec
    // exercises the seed's mixed-status lesson (learning done,
    // practice/quiz todo) rather than the fully-done lesson 1, which would
    // give this test nothing to distinguish "up-next row" from "any other
    // row".
    await goToFirstDcrsLessonActivities(page, 'Your business vision');

    const progressResponse = await progressResponsePromise;
    const body = await progressResponse.json();
    const data: ActivityProgressResponse = body.data;
    capturedData = data;
    capturedApiUrl = progressResponse.url();

    expect(data.lessonid, 'captured response should be for the pinned lesson').toBe(
      PINNED_LESSON_ID,
    );
    const totalActivities =
      data.learnings.length + data.practices.length + data.quizzes.length;
    expect(totalActivities, 'expected at least one activity in the response').toBeGreaterThan(0);

    // eslint-disable-next-line no-console
    console.log(
      `[in-lesson-status] API ground truth for lesson ${data.lessonid}: ` +
        JSON.stringify({
          learnings: data.learnings.map(l => ({ id: l.lessonlearningid, status: l.status })),
          practices: data.practices.map(p => ({ id: p.lessonpracticeid, status: p.status, attempts: p.attempts })),
          quizzes: data.quizzes.map(q => ({ id: q.lessonquizid, status: q.status, attempts: q.attempts })),
        }),
    );
    const observedStatuses = [
      ...data.learnings.map(l => l.status),
      ...data.practices.map(p => p.status),
      ...data.quizzes.map(q => q.status),
    ];
    for (const state of ['done', 'inProgress', 'todo'] as const) {
      // eslint-disable-next-line no-console
      console.log(
        `[in-lesson-status] status "${state}" ${
          observedStatuses.includes(state) ? 'occurred' : 'did NOT occur'
        } in the observed data`,
      );
    }

    await expect(page.getByRole('heading', { name: KM.lessonHeader })).toBeVisible();
    await assertActivityListMatches(page, data);

    await page.screenshot({
      path: test.info().outputPath('activities.png'),
      fullPage: true,
    });
  });

  test('lesson activity statuses survive a reload with the rpi API unreachable (persisted store, not live memory)', async () => {
    // Runs after the previous test, on the SAME page/context: the page has
    // already loaded/rendered statuses from the server response captured
    // above, and useActivityProgress's mergeServer effect should have
    // written them into the persisted `activityProgress` redux-persist
    // slice (and the lesson itself into `lessonCache`). This test proves
    // that persistence directly, rather than relying on a same-page
    // client-side navigation the in-memory store alone could also satisfy.

    const lessonId = capturedData.lessonid;
    const activityIds = [
      ...capturedData.learnings.map(l => l.lessonlearningid),
      ...capturedData.practices.map(p => p.lessonpracticeid),
      ...capturedData.quizzes.map(q => q.lessonquizid),
    ];
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
            typeof lessonCacheRaw === 'string' && lessonCacheRaw.includes(lessonId);
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
      await expect(page.getByRole('heading', { name: KM.lessonHeader })).toBeVisible({
        timeout: 15_000,
      });
      await assertActivityListMatches(page, capturedData);
    } finally {
      await page.unroute(routePattern);
    }
  });
});
