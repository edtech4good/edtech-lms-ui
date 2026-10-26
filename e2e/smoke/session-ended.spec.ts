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

/**
 * The hourly refresh is set with a timer of about an hour. Keep that one callback instead of waiting for it, so a
 * spec fires the real `fetchrefreshtoken` when it chooses (`fireHourlyRefresh`). Installed before the page loads.
 */
async function holdHourlyRefreshTimer(p: Page): Promise<void> {
  await p.addInitScript(() => {
    const w = window as unknown as { __hourly?: () => void };
    const real = window.setTimeout.bind(window);
    window.setTimeout = ((fn: TimerHandler, ms?: number, ...args: unknown[]) => {
      if (typeof fn === 'function' && typeof ms === 'number' && ms > 3_000_000 && ms < 3_700_000) {
        w.__hourly = () => (fn as (...a: unknown[]) => void)(...args);
        return real(() => undefined, 2_147_483_647);
      }
      return real(fn, ms, ...args);
    }) as typeof window.setTimeout;
  });
}

async function fireHourlyRefresh(p: Page): Promise<void> {
  await expect
    .poll(() => p.evaluate(() => typeof (window as unknown as { __hourly?: unknown }).__hourly), { message: 'the hourly timer is set' })
    .toBe('function');
  await p.evaluate(() => (window as unknown as { __hourly: () => void }).__hourly());
}

const storedSession = (p: Page) =>
  p.evaluate(() => Object.fromEntries(Object.entries(sessionStorage).filter(([k]) => k.startsWith('lms_'))));

test.describe('a token update in flight', () => {
  test('a switch that never completes holds a refused call for about 20 s, not for ever: then the call recovers with a refresh', async ({ page }) => {
    test.setTimeout(120_000);
    await loginViaUi(page, platform.username, PASSWORD);
    await page.goto('/user/index');
    await page.waitForLoadState('networkidle');
    // The switch goes out and is never answered (and the server never hears of it, so the token stays good).
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let switched = 0;
    await page.route(`${API_URL}/auth/organisation`, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      switched++;
      await held;
      return route.abort();
    });
    let listed = 0;
    await page.route(`${API_URL}/user`, (route) =>
      route.request().method() === 'POST' && ++listed === 1
        ? route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
        : route.fallback(),
    );
    const refreshes = countRefreshes(page);
    const before = await storedSession(page);
    try {
      await page.getByRole('button', { name: /^Organisation: .*Switch organisation$/ }).click();
      await page.getByRole('menuitemradio', { name: 'E2E Fixture Organisation' }).click();
      await expect.poll(() => switched, { message: 'the switch is on its way' }).toBe(1);

      const refused = page.waitForResponse((r) => r.url() === `${API_URL}/user` && r.status() === 401);
      await searchStaff(page);
      await refused;
      const refusedAt = Date.now();
      await page.waitForTimeout(10_000);
      expect(refreshes(), 'ten seconds on, the call is still waiting for the switch').toBe(0);

      await expect.poll(() => refreshes(), { message: 'the wait ended and the refresh was asked', timeout: 30_000 }).toBe(1);
      const waited = Date.now() - refusedAt;
      expect(waited, 'about 20 s').toBeGreaterThan(18_000);
      expect(waited, 'about 20 s').toBeLessThan(26_000);
      await expect.poll(() => listed, { message: 'and the call was sent again', timeout: 10_000 }).toBeGreaterThan(1);
      await expect(page.getByRole('row').filter({ hasText: admin.username })).toBeVisible();
      await page.waitForTimeout(750);
      expect(await toasts(page).filter({ hasText: ENDED }).count(), 'no session-ended notice').toBe(0);
      await expect(page).toHaveURL(/\/user\/index/);
      expect(await storedSession(page), 'the session was renewed, not ended').not.toEqual(before);
      expect(Object.keys(await storedSession(page)).length, 'still signed in').toBeGreaterThan(0);
    } finally {
      release();
    }
  });

  test('an hourly refresh that cannot be asked (503) keeps the session: nothing is stored or said, the next call works', async ({ page }) => {
    await holdHourlyRefreshTimer(page);
    await loginViaUi(page, admin.username, PASSWORD);
    await page.goto('/user/index');
    await page.waitForLoadState('networkidle');
    const before = await storedSession(page);
    let refreshed = 0;
    await page.route(`${API_URL}/auth/refreshtoken*`, (route) => {
      refreshed++;
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    });
    let logouts = 0;
    page.on('request', (r) => {
      if (new URL(r.url()).pathname === '/auth/logout') logouts++;
    });

    await fireHourlyRefresh(page);
    await expect.poll(() => refreshed, { message: 'the refresh was asked' }).toBe(1);
    await page.waitForTimeout(750);
    await expect(page).toHaveURL(/\/user\/index/);
    expect(await toasts(page).count(), 'no notice').toBe(0);
    expect(logouts, 'the server was not told to sign out').toBe(0);
    expect(await storedSession(page), 'the stored session is untouched').toEqual(before);

    await searchStaff(page);
    await expect(page.getByRole('row').filter({ hasText: admin.username })).toBeVisible();
    expect(refreshed, 'no second refresh').toBe(1);
  });

  test('an hourly refresh the server refuses (401) ends the session once, with its notice', async ({ page }) => {
    await holdHourlyRefreshTimer(page);
    await loginViaUi(page, admin.username, PASSWORD);
    await page.goto('/user/index');
    await page.waitForLoadState('networkidle');
    expect((await heldKeys(page)).length, 'a session is held').toBeGreaterThan(0);
    await page.route(`${API_URL}/auth/refreshtoken*`, (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
    );

    await fireHourlyRefresh(page);
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 5_000 });
    await expect(toasts(page).filter({ hasText: ENDED })).toHaveCount(1);
    await page.waitForTimeout(750);
    expect(await toasts(page).count(), 'one notice, and nothing else').toBe(1);
    expect(await heldKeys(page), 'the stored session is gone').toEqual([]);
  });

  test('an organisation switch clicked while the hourly refresh is in flight waits for it: no second refresh, no sign-out', async ({ page }) => {
    await holdHourlyRefreshTimer(page);
    await loginViaUi(page, platform.username, PASSWORD);
    await page.goto('/user/index');
    await page.waitForLoadState('networkidle');
    // The server cancels the old tokens the moment it issues the new pair; the answer is held for 5 s after that.
    let issued = false;
    await page.route(`${API_URL}/auth/refreshtoken*`, async (route) => {
      const answer = await route.fetch();
      issued = true;
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      return route.fulfill({ response: answer });
    });
    const refreshes = countRefreshes(page);
    const switchStatuses: number[] = [];
    page.on('response', (r) => {
      if (r.url() === `${API_URL}/auth/organisation` && r.request().method() === 'POST') switchStatuses.push(r.status());
    });

    // The menu is open with its list loaded before the refresh starts (opening it later would send the list
    // call while the refresh is in flight, and that call would be the one to wait).
    await page.getByRole('button', { name: /^Organisation: .*Switch organisation$/ }).click();
    const choice = page.getByRole('menuitemradio', { name: 'E2E Fixture Organisation' });
    await expect(choice).toBeVisible();
    await fireHourlyRefresh(page);
    await expect.poll(() => issued, { message: 'the server has issued the new pair, which is on its way' }).toBe(true);
    expect(refreshes(), 'one refresh').toBe(1);
    await choice.click();

    await expect(page.getByRole('button', { name: /^Organisation: E2E Fixture Organisation, / })).toBeVisible({ timeout: 20_000 });
    expect(switchStatuses, 'the switch went out with the cancelled token and was refused').toContain(401);
    expect(switchStatuses[switchStatuses.length - 1], 'and was sent again with the new one').toBe(200);
    expect(refreshes(), 'no second refresh with the used refresh token').toBe(1);
    await page.waitForTimeout(750);
    expect(await toasts(page).filter({ hasText: ENDED }).count(), 'no session-ended notice').toBe(0);
    await expect(page).not.toHaveURL(/\/auth\//);
    expect((await heldKeys(page)).length, 'still signed in').toBeGreaterThan(0);
  });

  // The hourly refresh is the refresh in flight: a refused call that comes while it is on its way joins it, and a
  // refresh token is never used twice. Both cases below are the two ways the timer's refresh can be slow.
  test('an hourly refresh the server has answered but the page has not yet received (25 s): the refused call waits for it, no second refresh, nothing said', async ({ page }) => {
    test.setTimeout(120_000);
    await holdHourlyRefreshTimer(page);
    await loginViaUi(page, admin.username, PASSWORD);
    await page.goto('/user/index');
    await page.waitForLoadState('networkidle');
    const before = await storedSession(page);
    // The server rotates the pair at once (so the old access token is dead); the answer reaches the page 25 s later.
    let issued = false;
    await page.route(`${API_URL}/auth/refreshtoken*`, async (route) => {
      const answer = await route.fetch();
      issued = true;
      await new Promise((resolve) => setTimeout(resolve, 25_000));
      return route.fulfill({ response: answer });
    });
    const refreshes = countRefreshes(page);

    await fireHourlyRefresh(page);
    await expect.poll(() => issued, { message: 'the server has rotated the pair' }).toBe(true);
    const listStatuses: number[] = [];
    page.on('response', (r) => {
      if (r.url() === `${API_URL}/user` && r.request().method() === 'POST') listStatuses.push(r.status());
    });
    await searchStaff(page);
    // (The list from before the search is still on screen, so the rows say nothing: it is the search's own answer.)
    await expect.poll(() => listStatuses, { message: 'the call was refused with the dead token, waited, and was sent again with the new one', timeout: 45_000 }).toEqual([401, 200]);
    expect(refreshes(), 'one refresh in all').toBe(1);
    await page.waitForTimeout(750);
    expect(await toasts(page).count(), 'no notice').toBe(0);
    await expect(page).toHaveURL(/\/user\/index/);
    const after = await storedSession(page);
    expect(Object.keys(after).length, 'signed in, with a whole session').toBe(Object.keys(before).length);
    expect(after, 'the session was renewed').not.toEqual(before);
  });

  test('an hourly refresh held before the server has seen it (25 s): the refused call waits for it, and the refresh is asked once', async ({ page }) => {
    test.setTimeout(120_000);
    await holdHourlyRefreshTimer(page);
    await loginViaUi(page, admin.username, PASSWORD);
    await page.goto('/user/index');
    await page.waitForLoadState('networkidle');
    const before = await storedSession(page);
    await page.route(`${API_URL}/auth/refreshtoken*`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 25_000));
      return route.fallback();
    });
    let listed = 0;
    await page.route(`${API_URL}/user`, (route) =>
      route.request().method() === 'POST' && ++listed === 1
        ? route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
        : route.fallback(),
    );
    const refreshes = countRefreshes(page);

    await fireHourlyRefresh(page);
    await expect.poll(() => refreshes(), { message: 'the refresh is on its way' }).toBe(1);
    await searchStaff(page);
    await expect.poll(() => listed, { message: 'the call was refused once and sent again', timeout: 45_000 }).toBe(2);
    // Past the point where a second ask would have gone out and been refused.
    await page.waitForTimeout(8_000);
    expect(refreshes(), 'one refresh in all').toBe(1);
    expect(await toasts(page).count(), 'no notice').toBe(0);
    await expect(page).toHaveURL(/\/user\/index/);
    expect(Object.keys(await storedSession(page)).length, 'signed in').toBe(Object.keys(before).length);
  });

  test('the hourly timer firing while a refused call\'s refresh is in flight joins it: one refresh', async ({ page }) => {
    await holdHourlyRefreshTimer(page);
    await loginViaUi(page, admin.username, PASSWORD);
    await page.goto('/user/index');
    await page.waitForLoadState('networkidle');
    await page.route(`${API_URL}/auth/refreshtoken*`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 4_000));
      return route.fallback();
    });
    let listed = 0;
    await page.route(`${API_URL}/user`, (route) =>
      route.request().method() === 'POST' && ++listed === 1
        ? route.fulfill({ status: 401, contentType: 'application/json', body: '{}' })
        : route.fallback(),
    );
    const refreshes = countRefreshes(page);

    await searchStaff(page);
    await expect.poll(() => refreshes(), { message: 'the refused call\'s refresh is on its way' }).toBe(1);
    await fireHourlyRefresh(page);
    await expect.poll(() => listed, { message: 'the refused call was sent again', timeout: 20_000 }).toBe(2);
    await page.waitForTimeout(2_000);
    expect(refreshes(), 'the timer did not ask again').toBe(1);
    expect(await toasts(page).count(), 'no notice').toBe(0);
    await expect(page).toHaveURL(/\/user\/index/);
    expect((await heldKeys(page)).length, 'still signed in').toBeGreaterThan(0);
  });

  test('a switch answered after the wait ran out and the session ended: its pair is not stored, the sign-in page stays', async ({ page }) => {
    test.setTimeout(120_000);
    await loginViaUi(page, platform.username, PASSWORD);
    await page.goto('/user/index');
    await page.waitForLoadState('networkidle');
    // The server rotates the pair at once (the refresh token is used up); the answer reaches the page 24 s later,
    // after the refused call has given up waiting at 20 s, asked for a refresh with the used token and ended the session.
    let issued = false;
    await page.route(`${API_URL}/auth/organisation`, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      const answer = await route.fetch();
      issued = true;
      await new Promise((resolve) => setTimeout(resolve, 24_000));
      return route.fulfill({ response: answer });
    });
    await page.getByRole('button', { name: /^Organisation: .*Switch organisation$/ }).click();
    const choice = page.getByRole('menuitemradio', { name: 'E2E Fixture Organisation' });
    await expect(choice).toBeVisible();
    await choice.click();
    await expect.poll(() => issued, { message: 'the server has rotated the pair' }).toBe(true);
    await searchStaff(page);

    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 35_000 });
    await expect(toasts(page).filter({ hasText: ENDED })).toHaveCount(1);
    // The switch's answer arrives (about 24 s after it was asked) and must change nothing.
    await page.waitForTimeout(8_000);
    expect(await heldKeys(page), 'the stored session is still gone').toEqual([]);
    await expect(page).toHaveURL(/\/auth\/login/);
    expect(await toasts(page).count(), 'no second notice').toBeLessThanOrEqual(1);
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
