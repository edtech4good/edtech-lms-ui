import { APIRequestContext, expect, test } from '@playwright/test';
import { ROLE } from '../fixtures/accounts';
import { apiContext, apiLogin, jwtClaims } from '../fixtures/auth';

/**
 * What the Admin and Teacher roles hold, and what that must never include.
 * See docs/authorization-model.md. Companion to role-enforcement.spec.ts, which
 * covers the guard; this covers the grants behind it.
 *
 * The RBAC seed gave Super Admin everything and every other role nothing, so
 * once AccessGuard started reading real roles an Admin account could do nothing
 * at all. Migration 20260716160000 grants Admin 159 and Teacher 60 (read-only,
 * minus the two learner-identity reads — see the identity test below).
 *
 * These assert shapes, not counts. `expect(perms.length).toBe(159)` would go red
 * on any honest addition to the Permission enum and teach everyone to re-baseline
 * it, which is how a suite stops meaning anything. What must stay true is that
 * Admin cannot administer users or roles, that Teacher cannot write, and that
 * nobody accidentally earns the superadmin wildcard.
 *
 * If one of these fails, do not weaken the expectation.
 */

const TEACHER = {
  username: `e2e-teacher-${Date.now()}@example.com`,
  password: 'Teacher_Pass1',
};
const ADMIN = {
  username: `e2e-admin-${Date.now()}@example.com`,
  password: 'AdminRole_Pass1',
};
/** Super Admin PLUS other roles — the combination the wildcard bug turned on. */
const MULTI = {
  username: `e2e-multi-${Date.now()}@example.com`,
  password: 'MultiRole_Pass1',
};
/** Two non-superadmin roles at once — the other direction of the same bug. */
const COMBO = {
  username: `e2e-combo-${Date.now()}@example.com`,
  password: 'Combo_Pass1',
};

let superadmin: APIRequestContext;
const createdUserIds: string[] = [];
let teacherToken: string;
let adminToken: string;
let multiToken: string;
let comboToken: string;

test.describe.configure({ mode: 'serial' });

async function makeUser(
  admin: APIRequestContext,
  account: { username: string; password: string },
  roles: string[],
): Promise<string> {
  const created = await admin.post('/user/create', {
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
  createdUserIds.push(
    await makeUser(superadmin, MULTI, [ROLE.superadmin, ROLE.admin, ROLE.teacher]),
  );
  createdUserIds.push(await makeUser(superadmin, COMBO, [ROLE.admin, ROLE.teacher]));

  teacherToken = await apiLogin(TEACHER.username, TEACHER.password);
  adminToken = await apiLogin(ADMIN.username, ADMIN.password);
  multiToken = await apiLogin(MULTI.username, MULTI.password);
  comboToken = await apiLogin(COMBO.username, COMBO.password);
});

test.afterAll(async () => {
  // DELETE /user/:id disables rather than removes — same caveat as
  // role-enforcement.spec.ts. Accounts are uniquely named per run. Clear with:
  //   DELETE FROM lmsusers WHERE lmsusername LIKE 'e2e-teacher-%' OR
  //     lmsusername LIKE 'e2e-admin-%' OR lmsusername LIKE 'e2e-multi-%';
  for (const id of createdUserIds) {
    const res = await superadmin.delete(`/user/${id}`);
    if (!res.ok()) {
      throw new Error(`failed to disable fixture user ${id}: HTTP ${res.status()}`);
    }
  }
  await superadmin?.dispose();
});

test('the Admin role holds real permissions', async () => {
  // Guard the guard. Before the grant this was [], and every "Admin cannot X"
  // assertion below would have passed for the wrong reason.
  const perms = jwtClaims(adminToken).permissions as string[];
  expect(perms.length, 'Admin should hold permissions').toBeGreaterThan(0);
  expect(perms, 'Admin must not carry the superadmin wildcard').not.toContain('superadmin');
});

test('the Admin role holds nothing that administers users or roles', async () => {
  // Not a style preference. POST /roles/user-bind-role requires only
  // `update_user` and binds any role to any user; POST /user/create requires
  // only `create_user` and takes lmsuserroles from the request body. Either one
  // makes the holder Super Admin under another name.
  const perms = jwtClaims(adminToken).permissions as string[];
  const escalation = perms.filter((p) => /^(create|view|update|delete)_(user|role)$/.test(p));
  expect(
    escalation,
    'Admin holds user/role administration — that IS Super Admin, see docs/authorization-model.md',
  ).toEqual([]);
});

test('an Admin cannot bind roles to users', async () => {
  const ctx = await apiContext(adminToken);
  const res = await ctx.post('/roles/user-bind-role', {
    data: { lmsuserid: createdUserIds[0], rolesid: [ROLE.superadmin] },
  });
  await ctx.dispose();
  // 401 (AccessGuard) or 403 (CheckPermissionsGuard) — this is about the bearer
  // being denied, not which layer denies it. 200 would mean an Admin just made
  // themselves Super Admin.
  expect(
    [401, 403],
    `an Admin reached user-bind-role (${res.status()}) — that is self-promotion to Super Admin`,
  ).toContain(res.status());
});

test('an Admin cannot mint a Super Admin', async () => {
  const ctx = await apiContext(adminToken);
  const res = await ctx.post('/user/create', {
    data: {
      lmsusername: `e2e-escalation-${Date.now()}@example.com`,
      lmsuserpasswordhash: 'Escalation_Pass1',
      lmsuserroles: [ROLE.superadmin],
      countryids: [],
      schoolids: [],
    },
  });
  await ctx.dispose();
  expect(
    [401, 403],
    `an Admin created an account (${res.status()}) — it could have asked for Super Admin`,
  ).toContain(res.status());
});

test('the Teacher role is read-only', async () => {
  const perms = jwtClaims(teacherToken).permissions as string[];
  expect(perms.length, 'Teacher should hold permissions').toBeGreaterThan(0);
  const writes = perms.filter((p) => !/^(view|download)_/.test(p));
  expect(writes, 'Teacher holds a non-read permission').toEqual([]);
  expect(perms, 'Teacher must not carry the superadmin wildcard').not.toContain('superadmin');
});

test('the Teacher role cannot see learner identities', async () => {
  // The decision of 16 Jul (PILOT.md), enforced rather than merely written down.
  //
  // GET /student/all returns a child's studentfirstname, studentlastname,
  // mothername, fathername, dateofbirth, contact and all six wg_* Washington
  // Group disability answers. That is categorically more than the reports show:
  // POST /report/studentstatus, which Teacher may call, returns a learner's
  // username and progress, and GET /report/disability is aggregated to counts.
  //
  // view_download_student is the one that would bite hardest — it gates the
  // "download students" button, which is exactly that CSV.
  const perms = jwtClaims(teacherToken).permissions as string[];
  expect(perms, 'Teacher holds view_student — see PILOT.md, this was decided').not.toContain(
    'view_student',
  );
  expect(
    perms,
    'Teacher holds view_download_student — that is the learner PII CSV button',
  ).not.toContain('view_download_student');

  // The exclusion is anchored, not a prefix. These are quiz-score reads and
  // Teacher keeps them; an unanchored /^view_student/ would strip them silently
  // and nobody would notice until a report went blank.
  expect(perms, 'Teacher lost view_student_level_quiz — the exclusion is matching as a prefix')
    .toContain('view_student_level_quiz');
  expect(
    perms,
    'Teacher lost view_download_student_quiz_score — the exclusion is matching as a prefix',
  ).toContain('view_download_student_quiz_score');
});

test('a Teacher can reach the feeds behind the report filters', async () => {
  // Role.teacher was in no role list, so these returned 401 and every report
  // screen's filters came up empty — silently, because the components pipe
  // catchError(() => of({ results: [] })). A dropdown with no options looks
  // like "no data", not like a 401, which is why this went unnoticed.
  const ctx = await apiContext(teacherToken);
  const feeds = ['/country/', '/curriculum/all', '/standard/all', '/school/'];
  for (const feed of feeds) {
    const res = await ctx.get(feed);
    expect(
      res.status(),
      `a Teacher was refused ${feed} — the report filters will be silently empty`,
    ).toBe(200);
  }
  await ctx.dispose();
});

test('a Teacher still cannot reach learner records', async () => {
  // StudentController carries a CLASS-level AccessGuard listing
  // apikey/superadmin/admin, so it applies to every route in it and Teacher's
  // view_student grant is inert. Deliberate: widening it would also expose
  // GET /student/download-students (a bulk PII CSV), whose method-level guard is
  // commented out so it relies on the class guard alone. (POST
  // /student/migrate-standardid was in the same position until it was given its
  // own Super Admin method guard on 16 Jul — edtech-lms-api#17 — so it no longer
  // depends on the class guard; see the migration-endpoint test below.)
  // See PILOT.md. If this ever goes green, that decision was made — check it
  // was made deliberately.
  const ctx = await apiContext(teacherToken);
  const res = await ctx.get('/student/all');
  await ctx.dispose();
  expect([401, 403]).toContain(res.status());
});

test('a Teacher cannot write', async () => {
  const ctx = await apiContext(teacherToken);
  const res = await ctx.post('/subject/create', { data: { subjectname: 'e2e-should-not-exist' } });
  await ctx.dispose();
  expect(
    [401, 403],
    `a Teacher created a subject (${res.status()}) — read-only means read-only`,
  ).toContain(res.status());
});

test('the data-migration endpoints are Super Admin only', async () => {
  // These four ran one-off data migrations behind a `:key` that was
  // ADD_PERMISSIONS_KEY — a constant committed to the public edtech-lms-api
  // repo, so any authenticated staff account (Teacher included) could trigger
  // them; the two standard/* ones had no role at all, and remove-standardid
  // hard-deletes rows. edtech-lms-api#17 replaced the key with
  // AccessGuard(TokenType.ACCESS, Role.superadmin).
  //
  // This asserts refusal only. A Super Admin token is deliberately NOT exercised
  // here: a successful call would run a destructive migration against the DB.
  // The guard rejects before the handler, so 401/403 is the whole signal. A 404
  // would also fail this (route gone), and a 200/400 means the guard was dropped
  // and the handler ran — either way it goes red, which is the point.
  const routes = [
    '/standard/migrate-standardid',
    '/standard/remove-standardid',
    '/student/migrate-standardid',
    '/student/migrate-subject-curriculum',
  ];
  for (const [label, token] of [
    ['an Admin', adminToken],
    ['a Teacher', teacherToken],
  ] as const) {
    const ctx = await apiContext(token);
    for (const route of routes) {
      const res = await ctx.post(route);
      expect(
        [401, 403],
        `${label} reached POST ${route} (${res.status()}) — migration endpoints must be Super Admin only`,
      ).toContain(res.status());
    }
    await ctx.dispose();
  }
});

test('a Super Admin holding other roles keeps the superadmin wildcard', async () => {
  // The regression guard for the dedup in convertRolesPermsToArrayOfString.
  //
  // The wildcard — a full bypass in CheckPermissionsGuard — is awarded when a
  // bearer's permission count equals COUNT(*) of permissions. That count pushed
  // one entry per grant per role and never deduplicated, so granting Admin and
  // Teacher anything at all broke this account: 190 + 159 + 60 = 409 != 190,
  // and a Super Admin silently lost the wildcard.
  //
  // It cannot be caught with superadmin@superadmin.com: SUPERADMIN_USERNAME
  // grants every permission by username and skips this branch entirely. This
  // fixture exists to exercise the branch the seeded account hides.
  const perms = jwtClaims(multiToken).permissions as string[];
  expect(
    perms,
    'a multi-role Super Admin lost the wildcard — convertRolesPermsToArrayOfString is counting duplicates again',
  ).toContain('superadmin');
});

test('holding several roles does not by itself confer the wildcard', async () => {
  // The other direction of the same bug: two roles whose raw counts SUM to
  // COUNT(*) earned the wildcard even when their permissions overlapped
  // entirely, so the bearer held far fewer distinct permissions than the total
  // and was handed a full bypass anyway.
  //
  // Admin + Teacher is 159 + 60 = 219 today, so this cannot fire by arithmetic
  // accident right now. That is luck, not design: it depends on counts nobody
  // is watching, and a future role holding exactly (190 - 159) = 31 grants
  // alongside Admin would reach 190 and trip it. The dedup is what makes it
  // impossible by construction; this asserts the property, not the arithmetic.
  const perms = jwtClaims(comboToken).permissions as string[];
  expect(
    perms,
    'an Admin+Teacher bearer earned the superadmin wildcard — the count is not deduplicating',
  ).not.toContain('superadmin');
  // And the bearer really does hold both roles, or the assertion above is vacuous.
  const roles = jwtClaims(comboToken).lmsuserroles as string[];
  expect(roles).toEqual(expect.arrayContaining([ROLE.admin, ROLE.teacher]));
});
