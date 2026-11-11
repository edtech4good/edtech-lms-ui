import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { API_URL, BASE_URL } from '../fixtures/env';

/**
 * Every admin notice sits at the bottom left of the window, app-wide (one setting where ng-zorro is configured), so a notice
 * never covers the Create and Sync Content buttons at the top right of a list. Shown here on the Curriculum list with every
 * answer from the API mocked: a Sync Content the API fails with its own words (the interceptor's error notice) and a plain success. Any other host is refused.
 *
 * Run it against a production or local build served on E2E_BASE_URL (E2E_API_URL, and E2E_ACCESS_KEYS as "algKey,payloadKey,hashKey").
 */
const ACCESS_KEYS = (process.env.E2E_ACCESS_KEYS ?? 'lms_access_alg,lms_access_payload,lms_access_hash').split(',');
const PERMISSIONS = ['view_curriculum', 'create_curriculum', 'sync_content'];
const REFUSED = "The learning server did not accept this sync. Try again in a moment.";

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
function sessionToken(): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ lmsuserid: 'staff-1', lmsuserrole: 'zr5ER4QD', firstname: 'Test', lastname: 'Admin', permissions: PERMISSIONS, isplatform: false, organisationid: 'org-1', exp, iat: exp - 10 })}.c2ln`;
}
const json = (status: number, body: unknown) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function open(context: BrowserContext, syncAnswer: () => ReturnType<typeof json>): Promise<Page> {
  await context.addInitScript(
    ({ keys, token }) => {
      const [alg, payload, hash] = token.split('.');
      if (!sessionStorage.getItem(keys[0])) {
        sessionStorage.setItem(keys[0], alg);
        sessionStorage.setItem(keys[1], payload);
        sessionStorage.setItem(keys[2], hash);
      }
    },
    { keys: ACCESS_KEYS, token: sessionToken() },
  );
  await context.route(
    (url) => url.origin !== new URL(BASE_URL).origin && url.origin !== new URL(API_URL).origin,
    (route) => route.abort(),
  );
  await context.route(`${API_URL}/**`, async (route: Route) => {
    const request = route.request();
    const path = decodeURIComponent(new URL(request.url()).pathname).replace(/^\//, '');
    const method = request.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204 });
    if (method === 'POST' && path === 'sync/cloud') return route.fulfill(syncAnswer());
    if (method === 'POST' && path === 'curriculum') {
      return route.fulfill(json(200, { data: { data: [{ curriculumid: 'cur-1', curriculumname: 'Reading Basics' }], total: 1 } }));
    }
    return route.fulfill(json(200, { data: [] }));
  });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/curriculum/index');
  await expect(page.getByTestId('sync-content')).toBeVisible();
  return page;
}

async function pressSyncContent(page: Page): Promise<void> {
  await page.getByTestId('sync-content').click();
  await page.locator('.ant-popover-buttons button.ant-btn-primary, .ant-popover button.ant-btn-primary').first().click();
}

/** The notice is inside the bottom-right container, and sits in the lower right quarter of the window. */
async function expectBottomLeft(page: Page, words: string): Promise<void> {
  const notice = page.locator('.ant-notification-bottomLeft .ant-notification-notice', { hasText: words });
  await expect(notice).toBeVisible();
  await expect(page.locator('.ant-notification-topRight .ant-notification-notice')).toHaveCount(0);
  await expect(page.locator('.ant-notification-bottomRight .ant-notification-notice')).toHaveCount(0);
  const box = (await notice.boundingBox())!;
  const view = page.viewportSize()!;
  expect(box.x + box.width, 'in the left half').toBeLessThan(view.width / 2);
  expect(box.y, 'in the lower half').toBeGreaterThan(view.height / 2);
}

test.describe('notices sit at the bottom left', () => {
  test('a failed Sync Content shows at the bottom left and leaves Create and Sync Content uncovered', async ({ context }) => {
    const page = await open(context, () => json(500, { error: true, errormessage: REFUSED }));
    await pressSyncContent(page);
    await expectBottomLeft(page, REFUSED);
    for (const button of [page.getByTestId('sync-content'), page.getByRole('link', { name: /create/i }).first()]) {
      const b = (await button.boundingBox())!;
      const at = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.ant-notification') !== null, [b.x + b.width / 2, b.y + b.height / 2]);
      expect(at, 'a notice is not over the button').toBe(false);
    }
    if (process.env.E2E_NOTICE_SHOT) {
      // After the open animation and the tooltips have settled.
      await page.mouse.move(700, 600);
      await page.waitForTimeout(1500);
    }
    if (process.env.E2E_NOTICE_SHOT) await page.screenshot({ path: process.env.E2E_NOTICE_SHOT });
  });

  test('a plain success toast shows at the bottom left', async ({ context }) => {
    const page = await open(context, () => json(200, { data: {} }));
    await pressSyncContent(page);
    await expectBottomLeft(page, 'Content synced to cloud sucessfully');
  });
});
