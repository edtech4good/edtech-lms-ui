import { APIRequestContext, expect, request, test } from '@playwright/test';
import { rpiApiContext, rpiApiLogin } from '../fixtures/auth';
import { RPI_API_URL } from '../fixtures/env';
import { CORPORATE_STUDENT } from '../expo-smoke/fixtures';

/**
 * Contract + auth/injection regression for the new rpi (student) endpoint
 * `GET /lesson/:lessonid/activities/progress` (edtech-lms-rpi-api, branch
 * feat/activity-progress). This is the endpoint
 * edtech-expo's useActivityProgress hook polls to drive the lesson activity
 * list's status icons (done/inProgress/todo) and CTA pill — see
 * edtech-expo's src/services/hooks/useActivityProgress.ts and
 * src/redux/slices/ActivityProgressSlice.ts.
 *
 * Contract (confirmed live against the running rpi API on :3003):
 *   { data: { lessonid, pass_percentage, learnings: [...], practices: [...],
 *     quizzes: [...] }, error: false }
 *   - learnings: { lessonlearningid, status, progress_percentage }
 *   - practices: { lessonpracticeid, status, attempts, best_percentage|null, question_count }
 *   - quizzes:   { lessonquizid, status, attempts, best_percentage|null, question_count }
 *   - status is one of 'done' | 'inProgress' | 'todo'
 *   - question_count (added for edtech-expo's v2.1 Lesson screen rework,
 *     which builds each practice/quiz row's title from it —
 *     src/screens/LessonSelection/LessonSelectionScreen.tsx's `titleFor` /
 *     src/locales/km.json's practiceQuestions/quizQuestions) is a
 *     non-negative integer on every practice/quiz item.
 *
 * Logs in as miv.verify (CORPORATE_STUDENT, credentials from
 * ../expo-smoke/fixtures — this suite runs under playwright.config.ts, not
 * playwright.expo.config.ts, so expo-smoke's global-setup.ts credentials
 * guard does NOT run here; the check below re-implements the "non-local
 * target requires a real password" guard for just this account). The rpi
 * API allows one token per user, so logging in here evicts any other
 * miv.verify session (a human or another test run) — same caveat as
 * fixtures.ts's own header comment.
 *
 * Test lesson ids are miv.verify's (CORPORATE_STUDENT-equivalent) real DCRS
 * Module 1 lessons, confirmed live via GET /lesson/level/<levelId>:
 *   c0000000-0000-4000-8000-000000000008  "Why direction matters"
 *   c0000000-0000-4000-8000-000000000009  "Your business vision" — mixed
 *     (learning done, practice/quiz todo with attempts 0, best_percentage
 *     null) — the up-next lesson for the phone spec. Confirmed live on
 *     25 Sep 2026 (browsing localhost:8091 as miv.verify): its practice
 *     has question_count 1, its quiz has question_count 2 — the DCRS
 *     seed's question fixtures for this lesson, not runtime-computed, so
 *     these two counts are pinned below as a stable-seed fact rather than
 *     re-derived.
 *
 * Neither lesson's exact per-activity status is asserted as a hard-coded
 * "every status is done" fact: `npm run seed:dcrs` (seed-dcrs-content.js)
 * creates no progress rows at all, so a fresh seed leaves both lessons
 * entirely 'todo' with attempts 0 — lesson 008 only reads as "fully done"
 * today because earlier runs/humans completed it. Instead, both lessons are
 * checked against the same relational consistency rules a response must
 * satisfy regardless of how much progress has accumulated (quiz done iff
 * best_percentage >= pass_percentage; best_percentage null iff attempts 0;
 * practice done implies attempts > 0; learning done implies
 * progress_percentage 100; status is a member of the enum) — see
 * assertActivityProgressConsistency below.
 * No lesson with an 'inProgress' activity was found in the current seed
 * data (checked lessons 008-00b under level 006); the enum-membership
 * assertion only requires every status actually observed to be a member of
 * the enum, it does not require all three to appear.
 */

const DONE_LESSON_ID = 'c0000000-0000-4000-8000-000000000008';
const MIXED_LESSON_ID = 'c0000000-0000-4000-8000-000000000009';
const STATUS_ENUM = ['done', 'inProgress', 'todo'];

/** Local hosts that don't require a real (non-`demo`) password — mirrors
 *  expo-smoke/credentials.ts's own localHosts set, kept separate because
 *  that module lives in a sibling suite this spec must not depend on for
 *  its own skip behaviour. */
function isLocalHost(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.localhost')
  );
}

/**
 * Asserts the relational rules that must hold for an
 * activities/progress response regardless of how much of the lesson has
 * actually been completed — the seed-independent contract this suite
 * checks instead of a hard-coded "everything is done" snapshot. `label` is
 * folded into failure messages so a failure names which lesson (mixed vs.
 * done-seed) it came from.
 */
function assertActivityProgressConsistency(
  data: {
    pass_percentage: number;
    learnings: Array<{ lessonlearningid: string; status: string; progress_percentage: number }>;
    practices: Array<{ lessonpracticeid: string; status: string; attempts: number; best_percentage: number | null; question_count: number }>;
    quizzes: Array<{ lessonquizid: string; status: string; attempts: number; best_percentage: number | null; question_count: number }>;
  },
  label: string,
): void {
  expect(Array.isArray(data.learnings), `${label}: learnings should be an array`).toBe(true);
  expect(Array.isArray(data.practices), `${label}: practices should be an array`).toBe(true);
  expect(Array.isArray(data.quizzes), `${label}: quizzes should be an array`).toBe(true);
  expect(data.learnings.length, `${label}: expected at least one learning`).toBeGreaterThan(0);
  expect(data.practices.length, `${label}: expected at least one practice`).toBeGreaterThan(0);
  expect(data.quizzes.length, `${label}: expected at least one quiz`).toBeGreaterThan(0);

  for (const l of data.learnings) {
    expect(typeof l.lessonlearningid).toBe('string');
    expect(STATUS_ENUM, `${label}: learning status "${l.status}" not in enum`).toContain(l.status);
    expect(typeof l.progress_percentage).toBe('number');
    if (l.status === 'done') {
      // learning done => progress_percentage 100
      expect(
        l.progress_percentage,
        `${label}: learning status done should imply progress_percentage 100`,
      ).toBe(100);
    }
  }

  for (const p of data.practices) {
    expect(typeof p.lessonpracticeid).toBe('string');
    expect(STATUS_ENUM, `${label}: practice status "${p.status}" not in enum`).toContain(p.status);
    expect(typeof p.attempts).toBe('number');
    expect(
      Number.isInteger(p.question_count) && p.question_count >= 0,
      `${label}: practice question_count should be a non-negative integer, got ${JSON.stringify(p.question_count)}`,
    ).toBe(true);
    expect(
      p.best_percentage === null || typeof p.best_percentage === 'number',
      `${label}: practice best_percentage should be null or a number, got ${JSON.stringify(p.best_percentage)}`,
    ).toBe(true);
    expect(
      p.best_percentage === null ? p.attempts === 0 : p.attempts > 0,
      `${label}: practice best_percentage null (${p.best_percentage}) should be iff attempts 0 (attempts=${p.attempts})`,
    ).toBe(true);
    if (p.status === 'done') {
      // practice done => attempts > 0
      expect(p.attempts, `${label}: practice done should imply attempts > 0`).toBeGreaterThan(0);
    }
  }

  for (const q of data.quizzes) {
    expect(typeof q.lessonquizid).toBe('string');
    expect(STATUS_ENUM, `${label}: quiz status "${q.status}" not in enum`).toContain(q.status);
    expect(typeof q.attempts).toBe('number');
    expect(
      Number.isInteger(q.question_count) && q.question_count >= 0,
      `${label}: quiz question_count should be a non-negative integer, got ${JSON.stringify(q.question_count)}`,
    ).toBe(true);
    expect(
      q.best_percentage === null || typeof q.best_percentage === 'number',
      `${label}: quiz best_percentage should be null or a number, got ${JSON.stringify(q.best_percentage)}`,
    ).toBe(true);
    expect(
      q.best_percentage === null ? q.attempts === 0 : q.attempts > 0,
      `${label}: quiz best_percentage null (${q.best_percentage}) should be iff attempts 0 (attempts=${q.attempts})`,
    ).toBe(true);
    // quiz done <=> best_percentage >= pass_percentage
    if (q.status === 'done') {
      expect(
        q.best_percentage,
        `${label}: quiz status done should imply best_percentage >= ${data.pass_percentage}`,
      ).toBeGreaterThanOrEqual(data.pass_percentage);
    }
    if (q.best_percentage !== null && q.best_percentage >= data.pass_percentage) {
      expect(
        q.status,
        `${label}: quiz best_percentage ${q.best_percentage} >= pass_percentage ${data.pass_percentage} should imply status done`,
      ).toBe('done');
    }
  }
}

let student: APIRequestContext;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  if (!isLocalHost(RPI_API_URL) && !process.env.E2E_EXPO_CORPORATE_PASS) {
    test.skip(
      true,
      `Non-local E2E_RPI_API_URL (${RPI_API_URL}) requires E2E_EXPO_CORPORATE_PASS to be ` +
        `set in the shell. This spec runs under playwright.config.ts, not ` +
        `playwright.expo.config.ts, so expo-smoke's global-setup.ts credentials guard ` +
        `does not run here, and the 'demo' fallback password only works against a local seed.`,
    );
  }

  // rpiApiLogin defaults to DEMO_STUDENT (fixtures/accounts.ts), a
  // different school/curriculum entirely — the two DCRS lesson ids above
  // are seeded under miv.verify's school (see edtech-expo's expo-smoke
  // fixtures), so this suite must log in as that account explicitly, not
  // rely on rpiApiLogin's default.
  student = await rpiApiContext(
    await rpiApiLogin(CORPORATE_STUDENT.username, CORPORATE_STUDENT.password),
  );
});

test.afterAll(async () => {
  await student?.dispose();
});

test('401 without a token', async () => {
  const anon = await request.newContext({ baseURL: RPI_API_URL });
  try {
    const res = await anon.get(`/lesson/${DONE_LESSON_ID}/activities/progress`);
    expect(res.status(), `expected 401, got ${res.status()}`).toBe(401);
  } finally {
    await anon.dispose();
  }
});

test('401 with a garbage token', async () => {
  const garbage = await request.newContext({
    baseURL: RPI_API_URL,
    extraHTTPHeaders: { Authorization: 'Bearer not-a-real-jwt' },
  });
  try {
    const res = await garbage.get(`/lesson/${DONE_LESSON_ID}/activities/progress`);
    expect(res.status(), `expected 401, got ${res.status()}`).toBe(401);
  } finally {
    await garbage.dispose();
  }
});

test('400 for a well-formed but unknown lesson id', async () => {
  const randomUuid = '11111111-2222-4333-8444-555555555555';
  const res = await student.get(`/lesson/${randomUuid}/activities/progress`);
  expect(res.status(), `expected 400, got ${res.status()}`).toBe(400);
});

test('response shape/types for a real DCRS lesson (mixed statuses)', async () => {
  const res = await student.get(`/lesson/${MIXED_LESSON_ID}/activities/progress`);
  expect(res.ok(), `expected 2xx, got ${res.status()}`).toBeTruthy();
  const body = await res.json();

  expect(body.error).toBe(false);
  const data = body.data;
  expect(data.lessonid).toBe(MIXED_LESSON_ID);
  // 80 is the product's quiz pass mark (COMPLETED_PERCENTAGE) — the one
  // place in this file that pins pass_percentage to a literal value;
  // every other check below is relational against data.pass_percentage
  // itself, so it holds regardless of whether the product ever changes
  // this number.
  expect(data.pass_percentage).toBe(80);

  assertActivityProgressConsistency(data, 'mixed lesson (009)');
});

test('question_count matches the DCRS seed for the mixed lesson (practice 1, quiz 2)', async () => {
  // Pinned per this file's header comment (confirmed live 25 Sep 2026):
  // lesson 009's question fixtures are a stable part of the DCRS seed
  // (seed-dcrs-content.js), not runtime-computed progress state, so this
  // is safe to assert as an exact fact rather than a relational rule.
  const res = await student.get(`/lesson/${MIXED_LESSON_ID}/activities/progress`);
  expect(res.ok(), `expected 2xx, got ${res.status()}`).toBeTruthy();
  const body = await res.json();
  const data = body.data;

  expect(data.practices, 'expected exactly one practice on the mixed lesson').toHaveLength(1);
  expect(data.practices[0].question_count, 'mixed lesson practice question_count').toBe(1);
  expect(data.quizzes, 'expected exactly one quiz on the mixed lesson').toHaveLength(1);
  expect(data.quizzes[0].question_count, 'mixed lesson quiz question_count').toBe(2);
});

test('response for the other DCRS seed lesson: relational consistency holds', async () => {
  // Not asserted as "everything is done": seed-dcrs-content.js creates no
  // progress rows, so a fresh seed leaves this lesson 'todo' throughout —
  // it only looks fully done today because earlier runs/humans completed
  // it. assertActivityProgressConsistency checks the rules that must hold
  // either way.
  const res = await student.get(`/lesson/${DONE_LESSON_ID}/activities/progress`);
  expect(res.ok(), `expected 2xx, got ${res.status()}`).toBeTruthy();
  const body = await res.json();
  const data = body.data;

  assertActivityProgressConsistency(data, 'done-seed lesson (008)');
});

const INJECTION_PAYLOADS = [
  `' OR 1=1 --`,
  `' OR '1'='1`,
  `1; DROP TABLE lesson;--`,
  `%27%20OR%201%3D1%20--`, // pre-encoded, then encodeURIComponent'd again below
];

for (const payload of INJECTION_PAYLOADS) {
  test(`SQL-injection-ish lesson id is rejected, not 500: ${JSON.stringify(payload)}`, async () => {
    const res = await student.get(
      `/lesson/${encodeURIComponent(payload)}/activities/progress`,
    );
    expect(
      res.status(),
      `expected a 4xx, got ${res.status()} for payload ${JSON.stringify(payload)}`,
    ).toBeGreaterThanOrEqual(400);
    expect(
      res.status(),
      `expected a 4xx (not 5xx), got ${res.status()} for payload ${JSON.stringify(payload)}`,
    ).toBeLessThan(500);
    const body = await res.json().catch(() => null);
    if (body) {
      // Never data on an injection payload.
      expect(body.data === false || body.data == null, 'injection payload should not return data').toBeTruthy();
    }
  });
}
