import { APIRequestContext, expect, test } from '@playwright/test';
import { ROLE } from '../fixtures/accounts';
import { apiContext, apiLogin, jwtClaims } from '../fixtures/auth';

/**
 * Authorization enforcement — see docs/authorization-model.md.
 *
 * `AccessGuard` used to authorize off `lmsusers.lmsuserrole`, a column
 * `UserBusiness.createUser` stamps `superadmin` on for every account. Its role
 * check therefore passed for anyone who could log in: it read like enforcement
 * and enforced nothing, leaving every endpoint guarded by roles alone open to
 * any account. It now checks the roles the bearer actually holds, carried in
 * the token as `lmsuserroles`.
 *
 * This file existed before the fix, with the escalation marked `test.fail()`,
 * which is how we knew the fix had landed: Playwright fails a `test.fail()`
 * that starts passing. The marker is gone; these are now plain assertions and
 * a regression turns them red.
 *
 * If one of these fails, do not weaken the expectation — something is letting
 * a bearer through that should not be.
 */

const LOW_PRIV = {
  username: `e2e-lowpriv-${Date.now()}@example.com`,
  password: 'LowPriv_Pass1',
};

let admin: APIRequestContext;
let lowPrivToken: string;
let lowPrivUserId: string;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  admin = await apiContext(await apiLogin());

  const created = await admin.post('/user/create', {
    data: {
      lmsusername: LOW_PRIV.username,
      lmsuserpasswordhash: LOW_PRIV.password,
      lmsuserroles: [ROLE.user], // the lowest-privilege RBAC role
      countryids: [],
      schoolids: [],
    },
  });
  expect(created.ok(), `could not create the fixture user: ${created.status()}`).toBeTruthy();
  lowPrivUserId = (await created.json()).data.lmsuserid;

  lowPrivToken = await apiLogin(LOW_PRIV.username, LOW_PRIV.password);
});

test.afterAll(async () => {
  if (lowPrivUserId) {
    // DELETE /user/:id disables rather than removes (UserBusiness
    // .disableuserbyid), so the row survives — disabled, unable to log in, and
    // harmless. The account is uniquely named per run, so runs never collide;
    // the cost is that a long-lived database slowly collects disabled
    // e2e-lowpriv-* rows. Clear them with:
    //   DELETE FROM lmsusers WHERE lmsusername LIKE 'e2e-lowpriv-%' AND isdisabled = 1;
    const res = await admin.delete(`/user/${lowPrivUserId}`);
    if (!res.ok()) {
      // Don't swallow this: a silent failure here is how the fixture user
      // stays enabled and the next run's assertions get murky.
      throw new Error(
        `failed to disable fixture user ${lowPrivUserId}: HTTP ${res.status()}`,
      );
    }
  }
  await admin?.dispose();
});

test('the fixture user really was given the lowest-privilege role', async () => {
  // Guard the guard: if this account silently gained permissions, every
  // assertion below would pass for the wrong reason.
  const claims = jwtClaims(lowPrivToken);
  expect(claims.permissions, 'fixture user should hold no permissions').toEqual([]);
});

test('a user without the role is refused by /student/create', async () => {
  // /student/create is guarded by AccessGuard roles alone
  // (apikey/superadmin/admin) with no @RequirePermissions. This account holds
  // only the "User" role, so the guard must refuse it.
  //
  // The body is deliberately invalid, which is what makes this test safe to
  // run. Nest runs guards before interceptors, so the status says exactly which
  // layer answered:
  //   401/403 — the guard refused. Correct.
  //   400     — the guard let it through and the schema validator caught it.
  //             That was the bug: lmsuserrole was stamped superadmin for every
  //             account, so the role check passed for anyone.
  // Sending a *valid* body would prove the same thing by creating a real
  // student on every run, polluting the disability report's "not collected"
  // bucket. Asking for the refusal is enough.
  //
  // Accept either refusal status rather than pinning one: AccessGuard throws
  // 401 and CheckPermissionsGuard throws 403, and this spec is about the
  // bearer being denied, not about which layer does it. Pinning 403 would have
  // let a correct fix look like a still-failing test.
  const ctx = await apiContext(lowPrivToken);
  const res = await ctx.post('/student/create?online=true', {
    data: { students: [] },
  });
  await ctx.dispose();
  expect(
    [401, 403],
    `a "User"-role account reached /student/create (${res.status()}) — see docs/authorization-model.md`,
  ).toContain(res.status());
});

test('a user with no permissions cannot list users', async () => {
  // The control. /user is permission-gated (@RequirePermissions +
  // CheckPermissionsGuard), so it correctly refuses — which is what proves the
  // failure above is AccessGuard's role check specifically, and not something
  // wrong with the fixture.
  const ctx = await apiContext(lowPrivToken);
  const res = await ctx.post('/user', { data: { pageindex: 0, pagesize: 10 } });
  await ctx.dispose();
  expect(res.status()).toBe(403);
});

test('an unauthenticated caller cannot create students', async () => {
  const ctx = await apiContext('not-a-token');
  const res = await ctx.post('/student/create?online=true', { data: { students: [] } });
  await ctx.dispose();
  expect(res.status()).toBe(401);
});

test('POST /auth/register is gone and cannot mint an account', async () => {
  // Removed on 16 Jul: public, unauthenticated, and accepted Role.superadmin
  // from the request body. Kept as a spec so it cannot come back by accident.
  const ctx = await apiContext('irrelevant');
  const res = await ctx.post('/auth/register', {
    data: {
      lmsusername: `e2e-register-${Date.now()}@example.com`,
      lmsuserpassword: 'Attacker_Pass1',
      firstname: 'Mallory',
      lmsuserrole: ROLE.superadmin,
    },
  });
  await ctx.dispose();
  expect(res.status(), 'POST /auth/register should not exist').toBe(404);
});
