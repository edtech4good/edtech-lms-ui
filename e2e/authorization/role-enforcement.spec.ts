import { APIRequestContext, expect, test } from '@playwright/test';
import { ROLE } from '../fixtures/accounts';
import { apiContext, apiLogin, jwtClaims } from '../fixtures/auth';

/**
 * The net under the lmsuserrole fix — see docs/authorization-model.md.
 *
 * `UserBusiness.createUser` stamps `lmsuserrole = superadmin` on every account,
 * and `AccessGuard` authorizes off that field, so its role check passes for
 * anyone who can log in. Endpoints guarded by AccessGuard roles *alone* are
 * open regardless of the role a user was actually given.
 *
 * These specs describe what the system is supposed to do. The ones marked
 * `test.fail()` are the bug: Playwright asserts they fail today and will fail
 * the suite the moment they start passing, which is how we find out the fix
 * landed. Do not "fix" a failing expectation here by weakening it — remove the
 * `test.fail()` marker instead, once the behaviour is actually correct.
 *
 * Fixing lmsuserrole is authorization logic across ~9 endpoints with no other
 * tests under it. This file is the reason that work can start.
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

test.fail(
  'a user with no permissions is refused by /student/create',
  async () => {
    // KNOWN BUG. /student/create is guarded by AccessGuard roles alone, with no
    // @RequirePermissions, and this account carries lmsuserrole = superadmin
    // like every other account — so the role check waves it through.
    //
    // The body is deliberately invalid, which is what makes this test safe to
    // run. Nest runs guards before interceptors, so the status says exactly
    // which layer answered:
    //   403 — the guard refused. Correct, and what we want.
    //   400 — the guard let it through and the schema validator caught it.
    //         That is today, and that is the bug.
    // Sending a *valid* body would prove the same thing by creating a real
    // student on every run, which pollutes the disability report's
    // "not collected" bucket. Asking for the refusal is enough.
    const ctx = await apiContext(lowPrivToken);
    const res = await ctx.post('/student/create?online=true', {
      data: { students: [] },
    });
    await ctx.dispose();
    expect(
      res.status(),
      'a zero-permission account reached /student/create — see docs/authorization-model.md',
    ).toBe(403);
  },
);

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
