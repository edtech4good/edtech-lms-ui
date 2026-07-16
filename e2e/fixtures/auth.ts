import { APIRequestContext, Page, expect, request } from '@playwright/test';
import { SUPERADMIN } from './accounts';
import { API_URL } from './env';

/**
 * Log in through the real form. Playwright's storageState only captures cookies
 * and localStorage, and this app keeps its JWT in sessionStorage, so there is
 * no state to reuse between contexts — logging in through the UI is both the
 * honest thing to smoke-test and the only thing that works.
 */
export async function loginViaUi(
  page: Page,
  username: string = SUPERADMIN.username,
  password: string = SUPERADMIN.password,
): Promise<void> {
  await page.goto('/auth');
  await page.fill('input[formControlName="lmsusername"]', username);
  await page.fill('input[formControlName="lmsuserpassword"]', password);
  await page.getByRole('button', { name: 'Log in' }).click();
  // Login lands on dashboard/index or dashboard/default depending on permissions.
  await page.waitForURL(/\/dashboard\/(index|default)/, { timeout: 15_000 });
}

/** A token straight from the API, for assertions that do not need a browser. */
export async function apiLogin(
  username: string = SUPERADMIN.username,
  password: string = SUPERADMIN.password,
): Promise<string> {
  const ctx = await request.newContext();
  const res = await ctx.post(`${API_URL}/auth/login`, {
    data: { lmsusername: username, lmsuserpassword: password },
  });
  expect(res.ok(), `login failed for ${username}: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  await ctx.dispose();
  return body.data.accessToken;
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
