import { APIRequestContext, Page, expect, request, test } from '@playwright/test';
import { DEMO_STUDENT, SUPERADMIN } from './accounts';
import { API_URL, RPI_API_URL } from './env';

/**
 * The API allows 10 sign-ins a minute per client (5 on some routes), and a run
 * of the whole suite signs in more often than that, so any login can come back
 * 429. The fixtures below wait out the window and try once more, and only when
 * the API actually said so: a spec that is not throttled never waits.
 */
const THROTTLE_WINDOW_MS = 61_000;

/** How long to wait after a 429: the API's Retry-After if it sent one, else the window. */
function throttleWaitMs(retryAfter: string | undefined): number {
  const seconds = Number(retryAfter);
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(Math.ceil(seconds) * 1000 + 1_000, THROTTLE_WINDOW_MS + 30_000)
    : THROTTLE_WINDOW_MS;
}

/**
 * How much time each running test or hook has been lent so far, and the timeout it
 * started with. `testInfo.timeout` does not report the time already lent inside a
 * hook, so "timeout + this wait" on every wait set the same deadline again instead of
 * adding up: a hook that signed in five times and was throttled three times ran out
 * of time after the last short wait. The running total is kept here, per test or hook.
 */
const lent = new WeakMap<object, { base: number; extra: number }>();

/**
 * Wait for a throttle window to pass. The wait is longer than a spec's default
 * timeout, so lend the running test (or hook) the time it is about to spend: every
 * wait adds to the deadline, in a test and in a hook.
 *
 * Exported for the fixture's own tests (auth-fixture.spec.ts).
 */
export async function waitOutThrottle(ms: number): Promise<void> {
  // Say so, so a slow run can be told apart from a throttled one.
  console.warn(`[e2e] sign-in was rate-limited (429): waiting ${Math.round(ms / 1000)}s, then trying once more`);
  try {
    const info = test.info();
    const entry = lent.get(info) ?? { base: info.timeout, extra: 0 };
    entry.extra += ms;
    lent.set(info, entry);
    info.setTimeout(entry.base + entry.extra);
  } catch {
    /* not inside a test or hook (a global setup): no timeout to extend */
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** A login response, read in full (the request context that made it is disposed). */
interface LoginAnswer {
  status: number;
  ok: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

/**
 * POST a login to the API and, on a 429, wait out the window and try once more.
 * The body is read before the context is disposed: a response cannot be read
 * after that.
 */
async function postLogin(url: string, data: Record<string, string>): Promise<LoginAnswer> {
  const ctx = await request.newContext();
  try {
    let res = await ctx.post(url, { data });
    if (res.status() === 429) {
      await waitOutThrottle(throttleWaitMs(res.headers()['retry-after']));
      res = await ctx.post(url, { data });
    }
    const body = await res.json().catch(() => null);
    return { status: res.status(), ok: res.ok(), body };
  } finally {
    await ctx.dispose();
  }
}

/**
 * Log in through the real form. Playwright's storageState only captures cookies
 * and localStorage, and this app keeps its JWT in sessionStorage, so there is
 * no state to reuse between contexts — logging in through the UI is both the
 * honest thing to smoke-test and the only thing that works.
 *
 * On a 429 the sign-in page must say so (that message is part of the product),
 * then this waits out the throttle window and signs in once more. Any other
 * failure (a wrong password, a second 429) throws a message that says what the
 * API answered.
 */
export async function loginViaUi(
  page: Page,
  username: string = SUPERADMIN.username,
  password: string = SUPERADMIN.password,
): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    await page.goto('/auth');
    await page.getByLabel('Email', { exact: true }).fill(username);
    await page.getByLabel('Password', { exact: true }).fill(password);
    const answer = page.waitForResponse(
      (r) => r.url().includes('/auth/login') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    const res = await answer;
    if (res.status() === 429 && attempt === 0) {
      await expect(
        page.getByRole('main').getByRole('alert').filter({ hasText: 'Too many sign-in attempts' }),
        'a throttled sign-in says so',
      ).toBeVisible();
      await waitOutThrottle(throttleWaitMs(res.headers()['retry-after']));
      continue;
    }
    if (!res.ok()) {
      // Say what came back, not just that the dashboard never appeared.
      await page.waitForTimeout(150);
      const said = await page.getByRole('main').getByRole('alert').allInnerTexts();
      throw new Error(
        `sign-in as ${username} failed: the API answered HTTP ${res.status()}` +
          (said.length ? ` and the form says ${JSON.stringify(said.join(' '))}` : ''),
      );
    }
    // Login lands on dashboard/index or dashboard/default depending on permissions.
    await page.waitForURL(/\/dashboard\/(index|default)/, { timeout: 15_000 });
    return;
  }
}

/** A token straight from the API, for assertions that do not need a browser. */
export async function apiLogin(
  username: string = SUPERADMIN.username,
  password: string = SUPERADMIN.password,
): Promise<string> {
  const res = await postLogin(`${API_URL}/auth/login`, { lmsusername: username, lmsuserpassword: password });
  expect(res.ok, `login failed for ${username}: ${res.status}`).toBeTruthy();
  return res.body.data.accessToken;
}

/** Decode a JWT payload without verifying it — for asserting claims in tests. */
export function jwtClaims(token: string): Record<string, unknown> {
  // base64url -> base64 by hand; the 'base64url' encoding name is newer than
  // the TypeScript this repo is pinned to.
  const segment = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = segment.padEnd(segment.length + ((4 - (segment.length % 4)) % 4), '=');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

export async function apiContext(token: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}

/**
 * A token from the rpi (student) API, for assertions that do not need a
 * browser. The student login shape is different from staff login: different
 * body fields, and the token comes back at a different path.
 */
export async function rpiApiLogin(
  username: string = DEMO_STUDENT.username,
  password: string = DEMO_STUDENT.password,
): Promise<string> {
  const res = await postLogin(`${RPI_API_URL}/auth/login`, {
    studentusername: username,
    studentpassword: password,
    logintime: '0',
  });
  expect(res.ok, `rpi login failed for ${username}: ${res.status}`).toBeTruthy();
  return res.body.data.accessToken;
}

export async function rpiApiContext(token: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: RPI_API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}
