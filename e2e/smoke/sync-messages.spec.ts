import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { API_URL, BASE_URL } from '../fixtures/env';

/**
 * Sync Students and Sync Teachers on the school list, in a browser, with every answer from the API mocked: a sync the
 * central API refuses with a 409 shows central's own sentence as one error notice that stays until closed; with no sentence
 * it shows a fallback; a success and a 500 behave as before. Nothing leaves the machine: any other host is refused.
 *
 * Run it against a production or local build served on E2E_BASE_URL. The session keys and the API host are those of that
 * build's environment file: E2E_API_URL, and E2E_ACCESS_KEYS as "algKey,payloadKey,hashKey".
 */
const ACCESS_KEYS = (process.env.E2E_ACCESS_KEYS ?? 'lms_access_alg,lms_access_payload,lms_access_hash').split(',');
const PERMISSIONS = ['view_school', 'sync_students'];
const SCHOOL = { schoolid: 'school-a', schoolname: 'North Valley School' };
const MISSING_SCHOOL_STUDENTS = "The learning server doesn't have this school or one of its classes yet. Run Sync Content, then Sync Students.";
const MISSING_SCHOOL_TEACHERS = "The learning server doesn't have this school or one of its classes yet. Run Sync Content, then Sync Teachers.";
const MISSING_CURRICULUM = "A curriculum these learners use isn't on the learning server. Publish it, then Sync Students.";

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
function sessionToken(): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ lmsuserid: 'staff-1', lmsuserrole: 'zr5ER4QD', firstname: 'Test', lastname: 'Admin', permissions: PERMISSIONS, isplatform: false, organisationid: 'org-1', exp, iat: exp - 10 })}.c2ln`;
}
const json = (status: number, body: unknown) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

interface Mock {
  /** What the next sync request is answered with. */
  syncAnswer: () => ReturnType<typeof json>;
  /** The decoded path of every sync request. */
  syncCalls: string[];
  unmocked: string[];
}

const newMock = (syncAnswer: () => ReturnType<typeof json>): Mock => ({ syncAnswer, syncCalls: [], unmocked: [] });

async function open(context: BrowserContext, mock: Mock): Promise<Page> {
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
    if (method === 'POST' && /^sync\/cloud\/[^/]+\/(students|teachers)$/.test(path)) {
      mock.syncCalls.push(path);
      return route.fulfill(mock.syncAnswer());
    }
    if (method === 'POST' && path === 'school') return route.fulfill(json(200, { data: { data: [SCHOOL], total: 1 } }));
    // the list's country and curriculum filters
    if (method === 'POST' && (path === 'country' || path === 'curriculum')) return route.fulfill(json(200, { data: { data: [], total: 0 } }));
    mock.unmocked.push(`${method} ${path}`);
    return route.fulfill(json(200, { data: [] }));
  });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/school/index');
  await expect(page.locator('tr', { hasText: SCHOOL.schoolname })).toHaveCount(1);
  await expect(page.getByTestId('sync-students')).toHaveCount(1);
  return page;
}

const notices = (page: Page) => page.locator('.ant-notification-notice');

async function press(page: Page, testId: 'sync-students' | 'sync-teachers'): Promise<void> {
  await page.getByTestId(testId).click();
  await page.locator('.ant-popover-buttons button.ant-btn-primary, .ant-popover button.ant-btn-primary').first().click();
}

/** One notice, with these words, that is still there well after the default duration (4.5 s). */
async function expectOneStayingError(page: Page, words: string): Promise<void> {
  await expect(notices(page).filter({ hasText: words }).first()).toBeVisible();
  // Let a second notice (if one were raised) render, then count once: a retrying count would wait for a default-duration
  // notice to go away and read 1.
  await page.waitForTimeout(800);
  expect(await notices(page).count(), 'one notice, not two').toBe(1);
  await expect(notices(page).first().locator('.ant-notification-notice-message')).toHaveText('Error');
  await page.waitForTimeout(6000);
  expect(await notices(page).count(), 'still one notice after the default duration').toBe(1);
  await expect(notices(page).first()).toContainText(words);
  await notices(page).first().locator('.ant-notification-notice-close').click();
  await expect(notices(page)).toHaveCount(0);
}

const refusal = (errormessage?: string) => json(409, errormessage === undefined ? {} : { error: true, errormessage });

test.describe('a sync central refuses with a 409', () => {
  for (const [what, words] of [
    ['the school or a class is missing', MISSING_SCHOOL_STUDENTS],
    ['a curriculum is missing', MISSING_CURRICULUM],
  ] as const) {
    test(`Sync Students shows central's sentence (${what}), once, until it is closed`, async ({ context }) => {
      const mock = newMock(() => refusal(words));
      const page = await open(context, mock);
      await press(page, 'sync-students');
      await expectOneStayingError(page, words);
      expect(mock.syncCalls).toEqual(['sync/cloud/North Valley School/students']);
      expect(mock.unmocked).toEqual([]);
    });
  }

  test('Sync Teachers shows central\'s sentence, once, until it is closed', async ({ context }) => {
    const mock = newMock(() => refusal(MISSING_SCHOOL_TEACHERS));
    const page = await open(context, mock);
    await press(page, 'sync-teachers');
    await expectOneStayingError(page, MISSING_SCHOOL_TEACHERS);
    expect(mock.syncCalls).toEqual(['sync/cloud/North Valley School/teachers']);
  });

  for (const testId of ['sync-students', 'sync-teachers'] as const) {
    test(`${testId}: a 409 with no sentence says "The sync was refused."`, async ({ context }) => {
      const page = await open(context, newMock(() => refusal()));
      await press(page, testId);
      await expectOneStayingError(page, 'The sync was refused.');
    });
  }
});

test.describe('the other outcomes are as before', () => {
  test('a success says so, with the success notice, and goes by itself', async ({ context }) => {
    const page = await open(context, newMock(() => json(200, { data: { status: 'pushed' } })));
    await press(page, 'sync-students');
    await expect(notices(page)).toHaveCount(1);
    await expect(notices(page).first()).toContainText('North Valley School students synced successfully.');
    await expect(notices(page).first()).not.toContainText('Certificates sent');
    await expect(notices(page)).toHaveCount(0, { timeout: 10_000 });
  });

  test('Sync Students also says certificates were sent when central pushed them', async ({ context }) => {
    const page = await open(context, newMock(() => json(200, { data: { status: 'pushed', certificates: { status: 'pushed', upserted: 3, deleted: 0, message: 'Certificates sent to the learning server.' } } })));
    await press(page, 'sync-students');
    await expect(notices(page)).toHaveCount(1);
    await expect(notices(page).first()).toHaveText(/North Valley School students synced successfully\. Certificates sent to the learning server\./);
  });

  test('Sync Students shows central\'s warning when the certificates failed, beside the roster success', async ({ context }) => {
    const message = 'The certificates could not be sent. Sync Students again.';
    const page = await open(context, newMock(() => json(200, { data: { status: 'pushed', certificates: { status: 'failed', message } } })));
    await press(page, 'sync-students');
    await expect(notices(page).filter({ hasText: message })).toHaveCount(1);
    await expect(notices(page).filter({ hasText: 'students synced successfully.' })).toHaveCount(1);
    await expect(notices(page).filter({ hasText: message }).locator('.ant-notification-notice-message')).toHaveText('Warning');
    await expect(notices(page).filter({ hasText: 'students synced successfully.' })).not.toContainText('Certificates sent');
  });

  test('a skipped certificates outcome adds nothing', async ({ context }) => {
    const page = await open(context, newMock(() => json(200, { data: { status: 'pushed', certificates: { status: 'skipped', message: 'No learners, so no certificates were sent.' } } })));
    await press(page, 'sync-students');
    await expect(notices(page).first()).toContainText('students synced successfully.');
    await page.waitForTimeout(800);
    expect(await notices(page).count()).toBe(1);
    await expect(notices(page).first()).not.toContainText('Certificates');
    await expect(notices(page).first()).not.toContainText('No learners');
  });

  test('a teachers success says so', async ({ context }) => {
    const page = await open(context, newMock(() => json(200, { data: { status: 'pushed' } })));
    await press(page, 'sync-teachers');
    await expect(notices(page).first()).toContainText('North Valley School teachers synced successfully');
  });

  for (const testId of ['sync-students', 'sync-teachers'] as const) {
    test(`${testId}: a 500 is the interceptor's one notice, with the API's words`, async ({ context }) => {
      const page = await open(context, newMock(() => json(500, { error: true, errormessage: 'Something broke on the server.' })));
      await press(page, testId);
      await expect(notices(page).first()).toContainText('Something broke on the server.');
      await expect(notices(page).first()).not.toContainText('The sync was refused.');
      await page.waitForTimeout(800);
      expect(await notices(page).count(), 'one notice, not two').toBe(1);
    });
  }
});
