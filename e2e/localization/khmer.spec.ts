import { APIRequestContext, expect, test } from '@playwright/test';
import { apiContext, apiLogin } from '../fixtures/auth';

/**
 * Khmer text survives the paths a Cambodian deployment actually uses.
 *
 * The rest of this suite is ASCII, and ASCII test data cannot fail an
 * ASCII-only check — which is exactly how `studentfirstname` shipped with
 * `joi.alphanum()` (`/^[a-zA-Z0-9]+$/`) on the create path. A learner could not
 * be enrolled under their own name in a Khmer literacy programme; the enforced
 * workaround was to enrol them as "Sokha" and rename them to "សុខា" afterwards,
 * because the *edit* path had no such restriction. See docs/khmer-text.md.
 *
 * Storage was never the problem: MySQL is utf8mb4 and the round-trip was always
 * byte-exact. These specs exist because a validator quietly disagreed with the
 * language the product is taught in.
 *
 * Student enrolment is asserted against the API rather than the UI because the
 * only enrolment path in the admin app is a CSV upload; the Angular validator
 * mirroring this rule is covered by its own unit-free path here plus the Khmer
 * subject round-trip in smoke/crud.spec.ts, which drives a real reactive form.
 */

const KHMER = {
  first: 'សុខា', // Sokha
  last: 'ចាន់', // Chan
  city: 'ភ្នំពេញ', // Phnom Penh
};

const isKhmer = (s: string) => [...s].every((c) => c.charCodeAt(0) >= 0x1780 && c.charCodeAt(0) <= 0x17ff);

let admin: APIRequestContext;
const created: string[] = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  admin = await apiContext(await apiLogin());
});

test.afterAll(async () => {
  // No cleanup, deliberately. This file enrols one learner per run and leaves
  // it there, because **there is no working way to delete a student**:
  // DELETE /student/:schooluserid opens a transaction, has both of its business
  // calls commented out, commits, and returns { error: false, data: true }. It
  // reports success and does nothing — verified against a live database, count
  // unchanged.
  //
  // A cleanup routine calling it would read as if it swept up and would sweep
  // nothing, which is worse than admitting the residue. The learners are named
  // khm* and are visible in the disability report's "not collected" bucket.
  // Clear them with the query in LOCAL_DEVELOPMENT.md §5a. When the delete
  // endpoint works, this should clean up after itself like crud.spec.ts does.
  await admin?.dispose();
});

test('a learner can be enrolled under a Khmer name', async () => {
  const username = `khm${Math.random().toString(36).slice(2, 8)}`;
  created.push(username);
  const res = await admin.post('/student/create?online=true', {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    data: {
      curriculumid: ['b0000000-0000-4000-8000-000000000005'],
      schoolid: 'b0000000-0000-4000-8000-000000000002',
      standard: 'b0000000-0000-4000-8000-000000000003',
      students: [
        {
          studentfirstname: KHMER.first,
          studentlastname: KHMER.last,
          genderid: '2',
          city: KHMER.city,
          country: 'Cambodia',
          state: 'PP',
          dateofjoin: '01-07-2026',
          schoolusername: username,
          schooluserpasswordhash: 'TestPass1',
        },
      ],
    },
  });
  expect(
    res.status(),
    'enrolling a learner with a Khmer name was rejected — the alphanum validator is back',
  ).toBe(200);
});

test('a Khmer name survives the CSV export round-trip byte-exact', async () => {
  // Not just "did it 200": the name has to come back as the same characters.
  // A mangled charset anywhere between MySQL and json2csv would show up here as
  // question marks or mojibake rather than Khmer codepoints.
  const res = await admin.get('/student/download-students');
  expect(res.ok()).toBeTruthy();
  const csv = await res.text();
  const line = csv.split('\n').find((l) => l.includes(created[0]));
  expect(line, 'the Khmer learner is missing from the export').toBeTruthy();
  expect(line).toContain(KHMER.first);
  expect(line).toContain(KHMER.last);
  expect(line).toContain(KHMER.city);
  expect(isKhmer(KHMER.first), 'fixture is not actually Khmer').toBeTruthy();
});

test('a one-character Khmer name is still too short', async () => {
  // Guard against over-correcting: dropping alphanum must not drop min(2).
  const res = await admin.post('/student/create?online=true', {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    data: {
      curriculumid: ['b0000000-0000-4000-8000-000000000005'],
      schoolid: 'b0000000-0000-4000-8000-000000000002',
      standard: 'b0000000-0000-4000-8000-000000000003',
      students: [
        {
          studentfirstname: 'ក',
          genderid: '1',
          city: 'PP',
          country: 'Cambodia',
          state: 'PP',
          dateofjoin: '01-07-2026',
          schoolusername: `khmshort${Math.random().toString(36).slice(2, 5)}`,
          schooluserpasswordhash: 'TestPass1',
        },
      ],
    },
  });
  expect(res.status()).toBe(400);
});
