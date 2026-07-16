import { APIRequestContext, expect, test } from '@playwright/test';
import { ROLE } from '../fixtures/accounts';
import { apiContext, apiLogin } from '../fixtures/auth';

/**
 * GET /curriculumbaseline/:id/download — see PILOT.md hardening.
 *
 * This streams a CSV of `studentfirstname`, `schoolusername`, `schoolname` and
 * each learner's assessment result. Its guards were commented out, so it was an
 * unauthenticated download of children's names and scores. Demonstrated against
 * a running stack before the fix: an anonymous GET returned 200 and a row
 * reading `សុខា,khmz3y6dh,Demo Primary School,…`.
 *
 * It looked harmless locally only because the handler's proxy hop to the student
 * API 401s when the two sides' SERVER_SYNC_KEY defaults differ — which is the
 * case in local dev, and NOT the case in a correctly configured environment.
 * Setting that key is a required go-live step, so fixing the config is what
 * would have armed the leak. The accident was never the protection; that is the
 * same shape as POST /auth/register, which was "safe" only because it 500'd.
 *
 * Gated on `view_download_student`, not the `view_baseline-endline` the
 * commented-out line named: Teacher holds view_baseline-endline, and this
 * payload is learner identity, which Teacher is deliberately denied (PILOT.md,
 * 16 Jul). Admin and Super Admin hold view_download_student.
 *
 * These use a bogus id on purpose. Nest runs guards before the handler, so the
 * status says exactly which layer answered and the spec never needs baseline
 * fixture data — nor does it stream a real child's record into CI logs:
 *   401 — AccessGuard refused (no/!bad token). Correct for anonymous.
 *   403 — CheckPermissionsGuard refused. Correct for Teacher.
 *   anything else — authorization passed and the handler ran. Correct for Admin.
 *
 * If the anonymous test fails, the guard came off again and children's names are
 * downloadable by anyone. Do not weaken it.
 */

const BOGUS_BASELINE_ID = '00000000-0000-4000-8000-0000000000aa';
const DOWNLOAD = `/curriculumbaseline/${BOGUS_BASELINE_ID}/download`;

const TEACHER = {
  username: `e2e-cbdl-teacher-${Date.now()}@example.com`,
  password: 'CbdlTeacher_Pass1',
};
const ADMIN = {
  username: `e2e-cbdl-admin-${Date.now()}@example.com`,
  password: 'CbdlAdmin_Pass1',
};

let superadmin: APIRequestContext;
const createdUserIds: string[] = [];
let teacherToken: string;
let adminToken: string;

test.describe.configure({ mode: 'serial' });

async function makeUser(
  ctx: APIRequestContext,
  account: { username: string; password: string },
  roles: string[],
): Promise<string> {
  const created = await ctx.post('/user/create', {
    data: {
      lmsusername: account.username,
      lmsuserpasswordhash: account.password,
      lmsuserroles: roles,
      countryids: [],
      schoolids: [],
    },
  });
  expect(
    created.ok(),
    `could not create fixture ${account.username}: ${created.status()}`,
  ).toBeTruthy();
  return (await created.json()).data.lmsuserid;
}

test.beforeAll(async () => {
  superadmin = await apiContext(await apiLogin());
  createdUserIds.push(await makeUser(superadmin, TEACHER, [ROLE.teacher]));
  createdUserIds.push(await makeUser(superadmin, ADMIN, [ROLE.admin]));
  teacherToken = await apiLogin(TEACHER.username, TEACHER.password);
  adminToken = await apiLogin(ADMIN.username, ADMIN.password);
});

test.afterAll(async () => {
  // DELETE /user/:id disables rather than removes — same caveat as the other
  // authorization specs. Clear with:
  //   DELETE FROM lmsusers WHERE lmsusername LIKE 'e2e-cbdl-%';
  for (const id of createdUserIds) {
    const res = await superadmin.delete(`/user/${id}`);
    if (!res.ok()) {
      throw new Error(`failed to disable fixture user ${id}: HTTP ${res.status()}`);
    }
  }
  await superadmin?.dispose();
});

test('an unauthenticated caller cannot download baseline results', async () => {
  // The bug. This returned 200 and a CSV of children's names and scores.
  const ctx = await apiContext('not-a-token');
  const res = await ctx.get(DOWNLOAD);
  await ctx.dispose();
  expect(
    res.status(),
    'anonymous reached the baseline results download — that is a CSV of children\'s names, see PILOT.md',
  ).toBe(401);
});

test('a Teacher cannot download baseline results', async () => {
  // Teacher holds view_baseline-endline but not view_download_student. The CSV
  // carries studentfirstname, which Teacher is deliberately denied.
  const ctx = await apiContext(teacherToken);
  const res = await ctx.get(DOWNLOAD);
  await ctx.dispose();
  expect(
    res.status(),
    'a Teacher reached the baseline results download — it contains learner identity',
  ).toBe(403);
});

test('an Admin can still reach the baseline results download', async () => {
  // The control: proves the two refusals above are the guard doing its job and
  // not the endpoint being broken for everyone. A bogus id means the handler
  // may fail downstream — irrelevant here; what matters is that authorization
  // let it through.
  const ctx = await apiContext(adminToken);
  const res = await ctx.get(DOWNLOAD);
  await ctx.dispose();
  expect(
    [401, 403],
    `an Admin was refused the download (${res.status()}) — the guard is too tight`,
  ).not.toContain(res.status());
});
