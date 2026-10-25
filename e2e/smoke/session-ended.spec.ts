import { APIRequestContext, Page, expect, test } from '@playwright/test';
import { ROLE } from '../fixtures/accounts';
import { apiContext, apiLogin, loginViaUi, waitOutThrottle } from '../fixtures/auth';
import { API_URL } from '../fixtures/env';
import { skipUnlessLocalApi } from '../fixtures/local-only';
import { fixtureOrganisationId } from '../fixtures/organisation';

/**
 * A 401 ends the session (lms-ui#117). The API answers a role failure with 403 and keeps 401 for a token it no
 * longer accepts (expired, or evicted by a later sign-in: one token per user), so the error interceptor clears
 * the stored session and sends the person to the sign-in page with ONE notice. It does not do that for the
 * sign-in call itself (the form owns that failure), and it does not do it for a 403.
 *
 * Real API. Makes an Organisation Admin account and a platform (Super Admin) account with a password that is written
 * in this public repository, so it runs only against a local API; the account is disabled in teardown (DELETE /user/:id disables, so the row
 * stays in lmsusers: e2e-session-<RUN>-*).
 */
skipUnlessLocalApi('creates an Organisation Admin and a Super Admin account');

const RUN = `e2e${Math.random().toString(36).slice(2, 8)}`;
const PASSWORD = 'Session_Pass1';
const ENDED = 'Your session ended. Sign in again.';
const FORBIDDEN = "You don't have permission to do that.";

const toasts = (p: Page) => p.locator('.ant-notification-notice');
const heldKeys = (p: Page) => p.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('lms_')));

let sa: APIRequestContext;
let admin: { id: string; username: string };
let platform: { id: string; username: string };

async function makeAccount(tag: string, role: string, organisationid?: string): Promise<{ id: string; username: string }> {
  const username = `e2e-session-${RUN}-${tag}@example.com`;
  const res = await sa.post('/user/create', {
    data: {
      lmsusername: username,
      lmsuserpasswordhash: PASSWORD,
      lmsuserroles: [role],
      ...(organisationid ? { organisationid } : {}),
      countryids: [],
      schoolids: [],
    },
  });
  expect(res.ok(), `could not create ${username}: ${res.status()}`).toBeTruthy();
  return { id: (await res.json()).data.lmsuserid, username };
}

test.beforeAll(async () => {
  sa = await apiContext(await apiLogin());
  admin = await makeAccount('admin', ROLE.organisationadmin, await fixtureOrganisationId(sa));
  platform = await makeAccount('platform', ROLE.superadmin);
});

test.afterAll(async () => {
  // Never swallowed: an account left enabled has a password anyone can read here.
  for (const who of [admin, platform]) {
    const res = await sa.delete(`/user/${who.id}`);
    if (!res.ok()) throw new Error(`failed to disable ${who.id}: HTTP ${res.status()}`);
  }
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

/** Count the refresh requests a page makes. */
function countRefreshes(p: Page): () => number {
  let n = 0;
  p.on('request', (r) => {
    if (new URL(r.url()).pathname === '/auth/refreshtoken') n++;
  });
  return () => n;
}

/**
 * Refuse each distinct API call (not /auth/*) once with a 401, as when the access token has just expired and the
 * refresh token still works. The first call refused is answered at once; every later one after `lateMs`.
 * Installed only after the page has gone quiet, so no earlier call is caught mid-flight by the next navigation.
 */
async function refuseEachCallOnce(p: Page, lateMs = 0): Promise<Set<string>> {
  const refused = new Set<string>();
  await p.route(`${API_URL}/**`, async (route) => {
    const r = route.request();
    const path = new URL(r.url()).pathname;
    const key = `${r.method()} ${path}`;
    if (path.startsWith('/auth/') || r.method() === 'OPTIONS' || refused.has(key)) return route.fallback();
    const late = refused.size > 0 ? lateMs : 0;
    refused.add(key);
    if (late) await new Promise((resolve) => setTimeout(resolve, late));
    return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
  });
  return refused;
}

test.describe('a 401 the refresh token can answer is not an ended session', () => {
  test('calls refused together share one refresh and are sent again: the page loads, no notice, still signed in', async ({ page }) => {
    await loginViaUi(page, admin.username, PASSWORD);
    await page.waitForLoadState('networkidle');
    const before = await page.evaluate(() => sessionStorage.getItem('lms_access_hash'));
    const refused = await refuseEachCallOnce(page);
    const refreshes = countRefreshes(page);

    await page.goto('/user/index');
    await expect(page.getByRole('row').filter({ hasText: admin.username })).toBeVisible();
    expect(refused.size, 'more than one call was refused together').toBeGreaterThan(1);
    expect(refreshes(), 'one refresh for all of them').toBe(1);
    await page.waitForTimeout(750);
    expect(await toasts(page).count(), 'no notice').toBe(0);
    await expect(page).toHaveURL(/\/user\/index/);
    expect(await page.evaluate(() => sessionStorage.getItem('lms_access_hash')), 'the session was renewed').not.toBe(before);
  });

  test('a call refused after a refresh has already replaced its token is sent again without a second refresh', async ({ page }) => {
    await loginViaUi(page, admin.username, PASSWORD);
    await page.waitForLoadState('networkidle');
    // The first call refused starts the refresh; the others are refused 1.5 s later, long after the new pair is
    // stored, still carrying the token they were sent with.
    const refused = await refuseEachCallOnce(page, 1_500);
    const refreshes = countRefreshes(page);

    await page.goto('/user/index');
    await expect(page.getByRole('row').filter({ hasText: admin.username })).toBeVisible({ timeout: 15_000 });
    expect(refused.size, 'more than one call was refused').toBeGreaterThan(1);
    expect(refreshes(), 'one refresh in all: the late refusals found a new token already stored').toBe(1);
    await page.waitForTimeout(750);
    expect(await toasts(page).count(), 'no notice').toBe(0);
    await expect(page).toHaveURL(/\/user\/index/);
  });

  test('a refresh that cannot be asked (503) does not end the session: the call stays refused, nothing is stored or said', async ({ page }) => {
    await loginViaUi(page, admin.username, PASSWORD);
    await page.waitForLoadState('networkidle');
    const stored = () => page.evaluate(() => Object.fromEntries(Object.entries(sessionStorage).filter(([k]) => k.startsWith('lms_'))));
    const before = await stored();
    let listed = 0;
    await page.route(`${API_URL}/user`, (route) =>
      route.request().method() === 'POST' && ++listed === 1
        ? route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
        : route.fallback(),
    );
    let refreshed = 0;
    await page.route(`${API_URL}/auth/refreshtoken*`, (route) => {
      refreshed++;
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    });

    await page.goto('/user/index');
    await expect.poll(() => refreshed, 'the refresh was asked').toBe(1);
    await page.waitForTimeout(750);
    expect(await toasts(page).filter({ hasText: ENDED }).count(), 'no session-ended notice').toBe(0);
    expect(await toasts(page).count(), 'no notice at all, not even for the refresh').toBe(0);
    await expect(page).toHaveURL(/\/user\/index/);
    expect(await stored(), 'the stored session is untouched').toEqual(before);

    // The token is still good: the next call works.
    await searchStaff(page);
    await expect(page.getByRole('row').filter({ hasText: admin.username })).toBeVisible();
    expect(refreshed, 'no second refresh').toBe(1);
  });

  test('a call refused while an organisation switch is about to store the new pair waits for it: no refresh, no sign-out', async ({ page }) => {
    // The server cancels the old tokens the moment it issues the new pair, so a call made while the answer is
    // still on its way is refused. The answer is held for 2.5 s after the server has made it.
    await loginViaUi(page, platform.username, PASSWORD);
    await page.goto('/user/index');
    await page.waitForLoadState('networkidle');
    await page.route(`${API_URL}/auth/organisation`, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      const answer = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 2_500));
      return route.fulfill({ response: answer });
    });
    const refreshes = countRefreshes(page);
    const listStatuses: number[] = [];
    page.on('response', (r) => {
      if (r.url() === `${API_URL}/user` && r.request().method() === 'POST') listStatuses.push(r.status());
    });

    await page.getByRole('button', { name: /^Organisation: .*Switch organisation$/ }).click();
    await page.getByRole('menuitemradio', { name: 'E2E Fixture Organisation' }).click();
    await page.waitForTimeout(800);
    await searchStaff(page);

    await expect(page.getByRole('button', { name: /^Organisation: E2E Fixture Organisation, / })).toBeVisible({ timeout: 15_000 });
    expect(listStatuses, 'the call went out with the cancelled token and was refused').toContain(401);
    await expect.poll(() => listStatuses[listStatuses.length - 1], 'and was sent again with the new one').toBe(200);
    expect(refreshes(), 'no refresh with the dying refresh token').toBe(0);
    await page.waitForTimeout(750);
    expect(await toasts(page).filter({ hasText: ENDED }).count(), 'no session-ended notice').toBe(0);
    await expect(page).not.toHaveURL(/\/auth\//);
    expect((await heldKeys(page)).length, 'still signed in').toBeGreaterThan(0);
  });
});

test.describe('a sign-in that fails is not an ended session', () => {
  test('a wrong password stays on the sign-in page, in the form, with no session-ended notice', async ({ page }) => {
    const alert = page.getByRole('main').getByRole('alert');
    for (let attempt = 0; ; attempt++) {
      await page.goto('/auth');
      await page.getByLabel('Email', { exact: true }).fill(admin.username);
      await page.getByLabel('Password', { exact: true }).fill('Wrong_Password1');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      // The API allows 10 sign-ins a minute and this file signs in often: when it says so, wait the window out once.
      await expect(alert).toHaveText(/The email or password is incorrect\.|Too many sign-in attempts/);
      if (attempt === 0 && /Too many/.test(await alert.innerText())) {
        await waitOutThrottle(61_000);
        continue;
      }
      break;
    }
    await expect(alert).toHaveText('The email or password is incorrect.');
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
