import { APIRequestContext, Page, expect, test } from '@playwright/test';
import { ROLE } from '../fixtures/accounts';
import { apiContext, apiLogin, loginViaUi } from '../fixtures/auth';
import { API_URL } from '../fixtures/env';
import { skipUnlessLocalApi } from '../fixtures/local-only';
import { fixtureOrganisationId } from '../fixtures/organisation';

/**
 * A 401 ends the session (lms-ui#117). The API answers a role failure with 403 and keeps 401 for a token it no
 * longer accepts (expired, or evicted by a later sign-in: one token per user), so the error interceptor clears
 * the stored session and sends the person to the sign-in page with ONE notice. It does not do that for the
 * sign-in call itself (the form owns that failure), and it does not do it for a 403.
 *
 * Real API. Makes one Organisation Admin account with a password that is written in this public repository, so
 * it runs only against a local API; the account is disabled in teardown (DELETE /user/:id disables, so the row
 * stays in lmsusers: e2e-session-<RUN>-*).
 */
skipUnlessLocalApi('creates an Organisation Admin account');

const RUN = `e2e${Math.random().toString(36).slice(2, 8)}`;
const PASSWORD = 'Session_Pass1';
const ENDED = 'Your session ended. Sign in again.';
const FORBIDDEN = "You don't have permission to do that.";

const toasts = (p: Page) => p.locator('.ant-notification-notice');
const heldKeys = (p: Page) => p.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('lms_')));

let sa: APIRequestContext;
let admin: { id: string; username: string };

test.beforeAll(async () => {
  sa = await apiContext(await apiLogin());
  const username = `e2e-session-${RUN}-admin@example.com`;
  const res = await sa.post('/user/create', {
    data: {
      lmsusername: username,
      lmsuserpasswordhash: PASSWORD,
      lmsuserroles: [ROLE.organisationadmin],
      organisationid: await fixtureOrganisationId(sa),
      countryids: [],
      schoolids: [],
    },
  });
  expect(res.ok(), `could not create ${username}: ${res.status()}`).toBeTruthy();
  admin = { id: (await res.json()).data.lmsuserid, username };
});

test.afterAll(async () => {
  // Never swallowed: an account left enabled has a password anyone can read here.
  const res = await sa.delete(`/user/${admin.id}`);
  if (!res.ok()) throw new Error(`failed to disable ${admin.id}: HTTP ${res.status()}`);
  await sa.dispose();
});

/** The staff list's own filter: it sends a fresh POST /user. */
async function searchStaff(p: Page): Promise<void> {
  await p.locator('nz-filter-trigger').click();
  await p.getByPlaceholder('Search class').fill('e2e-session');
  await p.getByRole('button', { name: 'Search' }).click();
}

test.describe('a 401 ends the session', () => {
  test('a token another sign-in evicted: the next call lands on the sign-in page, with one notice and no stored session', async ({
    browser,
  }) => {
    const first = await browser.newPage();
    const second = await browser.newPage();
    try {
      await loginViaUi(first, admin.username, PASSWORD);
      await first.goto('/user/index');
      await expect(first.getByRole('columnheader', { name: 'Email' })).toBeVisible();
      expect((await heldKeys(first)).length, 'a session is held').toBeGreaterThan(0);

      // The same account signs in elsewhere: the API keeps one token per user, so the first one is dead.
      await loginViaUi(second, admin.username, PASSWORD);

      const refused = first.waitForResponse((r) => r.url().startsWith(`${API_URL}/user`) && r.status() === 401);
      await searchStaff(first);
      await refused;

      await expect(first).toHaveURL(/\/auth\/login/, { timeout: 5_000 });
      await expect(first.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
      await expect(toasts(first).filter({ hasText: ENDED })).toHaveCount(1);
      // Read once, after a pause: a retrying count could pass after a second notice had faded.
      await first.waitForTimeout(750);
      expect(await toasts(first).count(), 'one notice, and nothing else').toBe(1);
      expect(await heldKeys(first), 'the stored session is gone').toEqual([]);
    } finally {
      await first.close();
      await second.close();
    }
  });
});

test.describe('a 401 the refresh token can answer is not an ended session', () => {
  test('calls refused together share one refresh and are sent again: the page loads, no notice, still signed in', async ({ page }) => {
    await loginViaUi(page, admin.username, PASSWORD);
    const before = await page.evaluate(() => sessionStorage.getItem('lms_access_hash'));

    // Every API call the staff list makes is refused once, as when the access token has just expired (the
    // refresh token still works). More than one call is refused, so the refresh has to be shared.
    const refusedOnce = new Set<string>();
    await page.route(`${API_URL}/**`, (route) => {
      const r = route.request();
      const path = new URL(r.url()).pathname;
      const key = `${r.method()} ${path}`;
      if (path.startsWith('/auth/') || r.method() === 'OPTIONS' || refusedOnce.has(key)) return route.fallback();
      refusedOnce.add(key);
      return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    });
    let refreshes = 0;
    page.on('request', (r) => {
      if (new URL(r.url()).pathname === '/auth/refreshtoken') refreshes++;
    });

    await page.goto('/user/index');
    await expect(page.getByRole('row').filter({ hasText: admin.username })).toBeVisible();
    expect(refusedOnce.size, 'more than one call was refused together').toBeGreaterThan(1);
    expect(refreshes, 'one refresh for all of them').toBe(1);
    await page.waitForTimeout(750);
    expect(await toasts(page).count(), 'no notice').toBe(0);
    await expect(page).toHaveURL(/\/user\/index/);
    expect(await page.evaluate(() => sessionStorage.getItem('lms_access_hash')), 'the session was renewed').not.toBe(before);
  });
});

test.describe('a sign-in that fails is not an ended session', () => {
  test('a wrong password stays on the sign-in page, in the form, with no session-ended notice', async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel('Email', { exact: true }).fill(admin.username);
    await page.getByLabel('Password', { exact: true }).fill('Wrong_Password1');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('main').getByRole('alert')).toHaveText('The email or password is incorrect.');
    await page.waitForTimeout(750);
    expect(await toasts(page).count(), 'no notice at all').toBe(0);
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('a sign-in the API answers with a 401 is the form\'s message alone: no notice, no second navigation', async ({ page }) => {
    await page.route(`${API_URL}/auth/login`, (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
    );
    await page.goto('/auth');
    await page.getByLabel('Email', { exact: true }).fill(admin.username);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    const answered = page.waitForResponse((r) => r.url().endsWith('/auth/login') && r.status() === 401);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await answered;
    await expect(page.getByRole('main').getByRole('alert')).toHaveText("Sign-in isn't available right now. Try again in a moment.");
    await page.waitForTimeout(750);
    expect(await toasts(page).filter({ hasText: ENDED }).count(), 'no session-ended notice').toBe(0);
    expect(await toasts(page).count(), 'no notice at all').toBe(0);
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe('a 403 is not an ended session', () => {
  test('a role failure says so and leaves the session and the page alone', async ({ page }) => {
    // The premise: the API answers an Organisation Admin's call to a platform-only route with 403, not 401.
    const adminApi = await apiContext(await apiLogin(admin.username, PASSWORD));
    try {
      expect((await adminApi.get('/organisation?pagesize=1')).status()).toBe(403);
    } finally {
      await adminApi.dispose();
    }

    // The sign-in comes after that API sign-in, which would otherwise have evicted it.
    await loginViaUi(page, admin.username, PASSWORD);
    const before = await heldKeys(page);
    expect(before.length, 'a session is held').toBeGreaterThan(0);

    // The staff list is refused, in the API's own words for a role failure.
    await page.route(`${API_URL}/user`, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ errormessage: FORBIDDEN }) })
        : route.fallback(),
    );
    const refused = page.waitForResponse((r) => r.url() === `${API_URL}/user` && r.status() === 403);
    await page.goto('/user/index');
    await refused;

    await expect(toasts(page).filter({ hasText: FORBIDDEN })).toHaveCount(1);
    await page.waitForTimeout(750);
    expect(await toasts(page).filter({ hasText: ENDED }).count(), 'no session-ended notice').toBe(0);
    await expect(page).toHaveURL(/\/user\/index/);
    expect(await heldKeys(page), 'the stored session is untouched').toEqual(before);
    await page.unroute(`${API_URL}/user`);
  });
});
