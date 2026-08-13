import { APIRequestContext, expect, request, test } from '@playwright/test';
import { rpiApiContext, rpiApiLogin } from '../fixtures/auth';
import { RPI_API_URL } from '../fixtures/env';

/**
 * SQL injection / missing-auth regression for the rpi (student) API.
 *
 * sql-injection.spec.ts proves the CENTRAL API (API_URL, :3000) is not
 * SQL-injectable, but the rpi/student API (RPI_API_URL, :3001) has its OWN
 * copies of the same endpoints, and they were never covered by that spec.
 * Manually verified today, against the live pre-fix rpi build:
 *
 *   - GET /curriculum/all?cur=zzznomatch' OR 1=1#   returned ALL curriculum
 *     rows (200), instead of the 0 rows a no-match search should return.
 *     Same raw-interpolation shape as the central curriculum endpoint fixed
 *     in sql-injection.spec.ts, just never ported over to this codebase.
 *   - POST /report/studentstatus returned student PII (names, scores, etc.)
 *     with NO Authorization header at all (200) — the route guard on the
 *     report controller had been commented out.
 *
 * Both are now fixed in edtech-lms-rpi-api: the curriculum search binds its
 * LIKE value instead of interpolating it, and the report controller's
 * `@UseGuards(AccessGuard(TokenType.ACCESS))` is back in place.
 *
 * A green run here means both fixes hold. A RED run means one of them has
 * regressed: either a raw string interpolation is back in the curriculum
 * search, or the report guard has been removed/commented out again. If (1)
 * or (2) below fails, do not relax the assertion — find the sink or the
 * guard.
 */

const NO_MATCH = 'zzz-no-such-value-exists';

let student: APIRequestContext;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  student = await rpiApiContext(await rpiApiLogin());
});

test.afterAll(async () => {
  await student?.dispose();
});

test('GET /curriculum/all (rpi) is not injectable', async () => {
  // Control: a value that matches no curriculum. rpi's /curriculum/all
  // returns { data: [...], error: false } — data IS the array (unlike
  // central's list endpoints, which nest a paged { data: { data, total } }).
  const control = await student.get(
    `/curriculum/all?cur=${encodeURIComponent(NO_MATCH)}`,
  );
  expect(control.ok()).toBeTruthy();
  const controlRows = (await control.json()).data as unknown[];
  expect(controlRows.length, 'control should match nothing').toBe(0);

  // Injection shape #1: `#` comments out the rest of the query. This is the
  // exact payload confirmed against the pre-fix build to return every row.
  const hashPayload = `${NO_MATCH}%' OR 1=1#`;
  const hashInjected = await student.get(
    `/curriculum/all?cur=${encodeURIComponent(hashPayload)}`,
  );
  expect(
    hashInjected.ok(),
    `injection payload errored (${hashInjected.status()})`,
  ).toBeTruthy();
  const hashInjectedRows = (await hashInjected.json()).data as unknown[];
  expect(
    hashInjectedRows.length,
    'injection returned rows a no-match control did not — the LIKE value is being interpolated, not bound',
  ).toBe(controlRows.length);

  // Injection shape #2: the same closed-quote-OR shape the central spec
  // uses, for parity with sql-injection.spec.ts.
  const likePayload = `${NO_MATCH}%' OR curriculumname LIKE '%`;
  const likeInjected = await student.get(
    `/curriculum/all?cur=${encodeURIComponent(likePayload)}`,
  );
  expect(
    likeInjected.ok(),
    `injection payload errored (${likeInjected.status()})`,
  ).toBeTruthy();
  const likeInjectedRows = (await likeInjected.json()).data as unknown[];
  expect(
    likeInjectedRows.length,
    'injection returned rows a no-match control did not — the LIKE value is being interpolated, not bound',
  ).toBe(controlRows.length);
});

test('GET /curriculum/all (rpi) still performs a real substring search', async () => {
  const all = (await (await student.get('/curriculum/all')).json()).data as unknown[];
  const none = (await (await student.get(`/curriculum/all?cur=${encodeURIComponent(NO_MATCH)}`)).json())
    .data as unknown[];
  // The fix must not have turned search into a no-op in either direction: an
  // empty search returns the seeded curriculum, a no-match search returns
  // nothing.
  expect(all.length, 'unfiltered search should return the seeded curriculum').toBeGreaterThan(0);
  expect(none.length, 'a no-match search should return nothing').toBe(0);
});

test('POST /report/studentstatus (rpi) rejects unauthenticated access', async () => {
  // A raw context with NO Authorization header — this is the exact request
  // shape that returned student PII with a 200 before the guard was
  // restored on the report controller.
  const anon = await request.newContext({ baseURL: RPI_API_URL });
  try {
    const res = await anon.post('/report/studentstatus', {
      data: { pageindex: 1, pagesize: 50 },
    });
    expect(
      res.ok(),
      'unauthenticated request to /report/studentstatus succeeded — the report guard is missing again',
    ).toBeFalsy();
    expect(
      [401, 403],
      `expected 401/403, got ${res.status()}`,
    ).toContain(res.status());
  } finally {
    await anon.dispose();
  }
});
