import { APIRequestContext, expect, test } from '@playwright/test';
import { apiContext, apiLogin } from '../fixtures/auth';

/**
 * SQL injection regression for the search filters. See PILOT.md hardening.
 *
 * Every filtered-list search built its LIKE clause by interpolating the raw
 * query/body value into a Sequelize `literal()`:
 *
 *     [Op.like]: literal(`'%${value.trim()}%'`)   // 18 sinks, 10 files
 *
 * `literal()` emits raw SQL, so the value broke out of the string. Confirmed
 * exploitable before the fix (edtech-lms-api): a control search matching nothing
 * returned 0 rows, while a payload closing the quote with `OR` returned rows.
 * The worst reach is the shared helper in util.service.ts (constructWhere /
 * buildWhere), used by many list endpoints — so this was not five endpoints,
 * it was most search boxes in the product, over a table (`students`) full of
 * children's names, dates of birth and disability data.
 *
 * The fix drops `literal()` so Sequelize binds the value as a parameter. This
 * spec covers both shapes — an individual business method (GET /curriculum/all,
 * query param) and the shared helper (POST /roles filter body) — and asserts:
 *
 *   1. an injection payload returns the SAME rows as a control that matches
 *      nothing. If it ever returns more, the OR broke out and injection is back.
 *   2. legitimate substring search still works, so the fix did not just disable
 *      the feature.
 *
 * The payloads are read-only (`OR ... LIKE`) by design — enough to prove the
 * breakout without a spec that writes or drops anything against a shared DB.
 *
 * If assertion (1) fails: a `literal()` (or other raw interpolation) has come
 * back into a filter. Do not relax the expectation — find the sink.
 */

const NO_MATCH = 'zzz-no-such-value-exists';

let admin: APIRequestContext;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  admin = await apiContext(await apiLogin());
});

test.afterAll(async () => {
  await admin?.dispose();
});

test('GET /curriculum/all (query param) is not injectable', async () => {
  // Control: a value that matches no curriculum.
  const control = await admin.get(
    `/curriculum/all?cur=${encodeURIComponent(NO_MATCH)}`,
  );
  expect(control.ok()).toBeTruthy();
  const controlRows = (await control.json()).data as unknown[];
  expect(controlRows.length, 'control should match nothing').toBe(0);

  // Injection: close the LIKE string and OR in an always-true term. If the
  // value were interpolated, this returns every curriculum; bound, it is just
  // a literal search string that matches nothing.
  const payload = `${NO_MATCH}%' OR curriculumname LIKE '%`;
  const injected = await admin.get(
    `/curriculum/all?cur=${encodeURIComponent(payload)}`,
  );
  expect(injected.ok(), `injection payload errored (${injected.status()})`).toBeTruthy();
  const injectedRows = (await injected.json()).data as unknown[];
  expect(
    injectedRows.length,
    'injection returned rows a no-match control did not — the LIKE value is being interpolated, not bound',
  ).toBe(controlRows.length);
});

test('GET /curriculum/all still performs a real substring search', async () => {
  const all = (await (await admin.get('/curriculum/all')).json()).data as unknown[];
  const none = (await (await admin.get(`/curriculum/all?cur=${encodeURIComponent(NO_MATCH)}`)).json())
    .data as unknown[];
  // The fix must not have turned search into a no-op in either direction:
  // an empty search returns everything, a no-match search returns nothing.
  expect(all.length, 'unfiltered search should return the seeded curriculum').toBeGreaterThan(0);
  expect(none.length, 'a no-match search should return nothing').toBe(0);
});

test('POST /roles filter (shared constructWhere helper) is not injectable', async () => {
  const query = async (value: string) => {
    const res = await admin.post('/roles', {
      data: { pageindex: 1, pagesize: 50, filter: [{ key: 'rolename', value }] },
    });
    expect(res.ok(), `/roles errored (${res.status()})`).toBeTruthy();
    return (await res.json()).data.data as unknown[];
  };

  const control = await query(NO_MATCH);
  expect(control.length, 'control should match no role').toBe(0);

  const injected = await query(`${NO_MATCH}%' OR rolename LIKE '%`);
  expect(
    injected.length,
    'injection through the shared filter helper returned rows — constructWhere is interpolating again',
  ).toBe(0);

  // And the helper still filters: "Admin" matches Admin and Super Admin.
  const legit = await query('Admin');
  expect(legit.length, '"Admin" should match at least the Admin role').toBeGreaterThan(0);
});
