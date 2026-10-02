import { expect, test } from '@playwright/test';
import { loginViaUi } from '../fixtures/auth';
import { API_URL } from '../fixtures/env';

/**
 * A refused request (403) is said once. The error interceptor toasts "You don't have
 * permission to do that." for a 403 nobody else says; older screens that toast for
 * themselves on any error used to add their own message (or "Success" after a failed
 * delete), so a 403 showed two. These mock a 403 on three of those screens and look,
 * once and after a short wait, for exactly one message.
 */
const GENERIC = "You don't have permission to do that.";
const forbidden = { status: 403, contentType: 'application/json', body: JSON.stringify({ errormessage: GENERIC }) };
const toasts = (page: import('@playwright/test').Page) => page.locator('.ant-notification-notice');

test.describe('a 403 on an older screen is one message', () => {
  test.describe.configure({ mode: 'serial' });
  let page: import('@playwright/test').Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUi(page);
  });
  test.afterAll(async () => {
    await page?.close();
  });

  test('the roles list refused: one toast', async () => {
    await page.route(`${API_URL}/roles`, (route) => (route.request().method() === 'POST' ? route.fulfill(forbidden) : route.fallback()));
    await page.goto('/role-perm/index');
    await expect(toasts(page).filter({ hasText: GENERIC })).toHaveCount(1);
    await page.waitForTimeout(750);
    expect(await toasts(page).count(), 'one message, not two').toBe(1);
    await page.unroute(`${API_URL}/roles`);
  });

  test('a document tag delete refused: one toast, no "Server Error", no "Success"', async () => {
    const row = { documenttagid: '00000000-0000-4000-8000-0000000000d1', documenttagname: 'sampletag' };
    await page.route(`${API_URL}/documenttag`, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: false, data: { data: [row], total: 1, pageindex: 1, pagesize: 10 } }) })
        : route.fallback(),
    );
    await page.route(`${API_URL}/documenttag/${row.documenttagid}`, (route) =>
      route.request().method() === 'DELETE' ? route.fulfill(forbidden) : route.fallback(),
    );
    await page.goto('/documenttag/index');
    await page.getByRole('row').filter({ hasText: row.documenttagname }).getByText('Delete').click();
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(toasts(page).filter({ hasText: GENERIC })).toHaveCount(1);
    await page.waitForTimeout(750);
    expect(await toasts(page).count(), 'one message, not two or three').toBe(1);
    await expect(toasts(page).filter({ hasText: /Server Error|Success/ })).toHaveCount(0);
    await page.unroute(`${API_URL}/documenttag`);
    await page.unroute(`${API_URL}/documenttag/${row.documenttagid}`);
  });

  test('a document tag edit page refused: one toast (not "Invalid link" as well), back on the list', async () => {
    const id = '00000000-0000-4000-8000-0000000000d2';
    await page.route(`${API_URL}/documenttag/${id}`, (route) => (route.request().method() === 'GET' ? route.fulfill(forbidden) : route.fallback()));
    await page.goto(`/documenttag/update/${id}`);
    await expect(toasts(page).filter({ hasText: GENERIC })).toHaveCount(1);
    await page.waitForTimeout(750);
    expect(await toasts(page).count(), 'one message, not two').toBe(1);
    await expect(page).toHaveURL(/\/documenttag\/index/);
    await page.unroute(`${API_URL}/documenttag/${id}`);
  });
});
