import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { API_URL, BASE_URL } from '../fixtures/env';

/**
 * Remove (a learner who has never signed in) on the Learners list, in a browser, with every answer from the API mocked:
 * the sign-in is a token written to the session (no server is asked), and every request to the API host is answered by a
 * route here, following the contract of `POST student` and `POST student/:schooluserid/remove`. Nothing leaves the
 * machine: any other host is refused.
 *
 * Run it against a production or local build served on E2E_BASE_URL. The session keys and the API host are those of
 * that build's environment file: E2E_API_URL, and E2E_ACCESS_KEYS as "algKey,payloadKey,hashKey".
 */
const ACCESS_KEYS = (process.env.E2E_ACCESS_KEYS ?? 'lms_access_alg,lms_access_payload,lms_access_hash').split(',');
const WITH = ['view_student', 'update_student', 'delete_student', 'view_school'];
const WITHOUT_DELETE = ['view_student', 'update_student', 'view_school'];
const ADMIN_ROLE = 'zr5ER4QD';

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
function sessionToken(permissions: string[]): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ lmsuserid: 'staff-1', lmsuserrole: ADMIN_ROLE, firstname: 'Test', lastname: 'Admin', permissions, isplatform: false, organisationid: 'org-1', exp, iat: exp - 10 })}.c2ln`;
}
const json = (status: number, body: unknown) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

const learner = (n: number, name: string, lastlogin: string | null = null) => ({
  studentid: `s-${n}`,
  schooluserid: `lu-${n}`,
  studentfirstname: name,
  studentlastname: 'Rivers',
  'schooluser.schoolusername': `${name.toLowerCase()}${n}`,
  'curriculum.curriculumname': 'Reading Basics',
  schoolname: 'North Valley School',
  class: { standardname: 'Grade 4' },
  country: 'Exampleland',
  type: 'Student',
  isdisabled: false,
  lastlogin,
});

interface Mock {
  learners: ReturnType<typeof learner>[];
  /** Answers a remove request; the default removes the learner and says so. */
  answer: (id: string) => ReturnType<typeof json>;
  requests: Array<{ method: string; path: string; body: unknown }>;
  listCalls: number;
  /** Held until released, to see the state while a request runs. */
  hold?: Promise<void>;
  unmocked: string[];
}

function newMock(): Mock {
  const mock: Mock = {
    // dara1 and maly3 never signed in; sokha2 did.
    learners: [learner(1, 'Dara'), learner(2, 'Sokha', '2026-11-01T08:30:00.000Z'), learner(3, 'Maly')],
    answer: (id) => {
      const gone = mock.learners.find((l) => l.schooluserid === id);
      mock.learners = mock.learners.filter((l) => l.schooluserid !== id);
      const username = gone?.['schooluser.schoolusername'] ?? 'unknown';
      return json(200, { schooluserid: id, username, removed: true, message: `Removed. The username ${username} can be used again.` });
    },
    requests: [],
    listCalls: 0,
    unmocked: [],
  };
  return mock;
}

async function signIn(context: BrowserContext, mock: Mock, permissions: string[]): Promise<void> {
  await context.addInitScript(
    ({ keys, token }) => {
      const [alg, payload, hash] = token.split('.');
      if (!sessionStorage.getItem(keys[0])) {
        sessionStorage.setItem(keys[0], alg);
        sessionStorage.setItem(keys[1], payload);
        sessionStorage.setItem(keys[2], hash);
      }
    },
    { keys: ACCESS_KEYS, token: sessionToken(permissions) },
  );
  await context.route(
    (url) => url.origin !== new URL(BASE_URL).origin && url.origin !== new URL(API_URL).origin,
    (route) => route.abort(),
  );
  await context.route(`${API_URL}/**`, (route) => answer(route, mock));
}

async function answer(route: Route, mock: Mock): Promise<void> {
  const request = route.request();
  const path = decodeURIComponent(new URL(request.url()).pathname).replace(/^\//, '');
  const method = request.method();
  if (method === 'OPTIONS') return route.fulfill({ status: 204 });
  const removePath = /^student\/([^/]+)\/remove$/.exec(path);
  if (method === 'POST' && removePath) {
    mock.requests.push({ method, path, body: request.postData() });
    if (mock.hold) await mock.hold;
    return route.fulfill(mock.answer(removePath[1]));
  }
  if (method === 'POST' && path === 'student') {
    mock.listCalls += 1;
    return route.fulfill(json(200, { data: { data: mock.learners, total: mock.learners.length } }));
  }
  if (method === 'POST' && path === 'school') return route.fulfill(json(200, { data: { data: [], total: 0 } }));
  mock.unmocked.push(`${method} ${path}`);
  return route.fulfill(json(200, { data: [] }));
}

async function openLearners(context: BrowserContext, mock: Mock, permissions = WITH): Promise<Page> {
  await signIn(context, mock, permissions);
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/student/index');
  await expect(page.getByRole('columnheader', { name: 'Student Name' })).toBeVisible();
  await expect(page.locator('tbody tr', { hasText: 'dara1' })).toHaveCount(1);
  return page;
}

const row = (page: Page, text: string) => page.locator('tbody tr', { hasText: text });
const toasts = (page: Page) => page.locator('.ant-notification-notice-description');
const notices = (page: Page) => page.locator('.ant-notification-notice');
const actions = (page: Page, username: string) => page.getByRole('button', { name: `Manage ${username}`, exact: true });
const menuItem = (page: Page, name: string) => page.getByRole('menuitem', { name, exact: true });
const popconfirm = (page: Page) => page.locator('.ant-popover-inner');
const dividers = (page: Page) => page.locator('.ant-dropdown-menu-item-divider');
const focusedLabel = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName ?? '');
const SHOTS = process.env.E2E_SHOTS_DIR;

async function chooseRemove(page: Page, username: string): Promise<void> {
  await actions(page, username).click();
  await menuItem(page, 'Remove').click();
  await expect(popconfirm(page)).toContainText(`Remove ${username}?`);
}

const CONFIRM = "Remove dara1? This can't be undone. Only a learner who has never signed in can be removed.";

test.describe('Remove: who sees it', () => {
  test('a never-signed-in row gets Remove after a divider, in the danger tone, with delete_student', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await actions(page, 'dara1').click();
    await expect(page.getByRole('menuitem')).toHaveText(['Edit details', 'Move to another school', 'Reset password', 'Disable', 'Remove']);
    await expect(dividers(page)).toHaveCount(1);
    await expect(menuItem(page, 'Remove')).toHaveClass(/ant-dropdown-menu-item-danger/);
    // The divider sits between Disable and Remove.
    const order = await page.locator('.ant-dropdown-menu > li').evaluateAll((els) => els.map((el) => (el.classList.contains('ant-dropdown-menu-item-divider') ? '|' : (el.textContent ?? '').trim())));
    expect(order).toEqual(['Edit details', 'Move to another school', 'Reset password', 'Disable', '|', 'Remove']);
  });

  test('a row that has signed in has no Remove and no divider', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await actions(page, 'sokha2').click();
    await expect(page.getByRole('menuitem')).toHaveText(['Edit details', 'Move to another school', 'Reset password', 'Disable']);
    await expect(dividers(page)).toHaveCount(0);
  });

  test('without delete_student there is no Remove and no divider, on a never-signed-in row too', async ({ context }) => {
    const page = await openLearners(context, newMock(), WITHOUT_DELETE);
    await actions(page, 'dara1').click();
    await expect(page.getByRole('menuitem')).toHaveText(['Edit details', 'Move to another school', 'Reset password', 'Disable']);
    await expect(dividers(page)).toHaveCount(0);
  });

  test('the superadmin permission gets Remove', async ({ context }) => {
    const page = await openLearners(context, newMock(), ['view_student', 'update_student', 'superadmin']);
    await actions(page, 'dara1').click();
    await expect(menuItem(page, 'Remove')).toBeVisible();
  });
});

test.describe('Remove: the confirm', () => {
  test('asks first with the wording, Remove and Cancel buttons, and sends nothing before the confirm', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await chooseRemove(page, 'dara1');
    await expect(popconfirm(page)).toContainText(CONFIRM);
    await expect(popconfirm(page).getByRole('button', { name: 'Remove' })).toBeVisible();
    await expect(popconfirm(page).getByRole('button', { name: 'Cancel' })).toBeVisible();
    expect(mock.requests).toEqual([]);
  });

  test('Cancel sends nothing, keeps the row, and returns focus to Manage', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await chooseRemove(page, 'dara1');
    await popconfirm(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(popconfirm(page)).toHaveCount(0);
    expect(mock.requests).toEqual([]);
    await expect(row(page, 'dara1')).toHaveCount(1);
    await expect.poll(() => focusedLabel(page)).toBe('Manage dara1');
  });

  test('Escape sends nothing, keeps the row, and returns focus to Manage', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await chooseRemove(page, 'dara1');
    await page.keyboard.press('Escape');
    await expect(popconfirm(page)).toHaveCount(0);
    expect(mock.requests).toEqual([]);
    await expect(row(page, 'dara1')).toHaveCount(1);
    await expect.poll(() => focusedLabel(page)).toBe('Manage dara1');
  });

  test('the confirm follows the item chosen last: Remove, Escape, then Disable shows the Disable text and button', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await chooseRemove(page, 'dara1');
    await page.keyboard.press('Escape');
    await actions(page, 'dara1').click();
    await menuItem(page, 'Disable').click();
    await expect(popconfirm(page)).toContainText("Disable dara1? They won't be able to sign in.");
    await expect(popconfirm(page).getByRole('button', { name: 'Disable' })).toBeVisible();
    await expect(popconfirm(page).getByRole('button', { name: 'Remove' })).toHaveCount(0);
  });
});

test.describe('Remove: success', () => {
  test('keyboard only: Manage, Tab to Remove, Enter, Enter on the confirm; the exact request, the notice, the row gone, focus on the next row', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await actions(page, 'dara1').focus();
    await page.keyboard.press('Enter');
    await expect(menuItem(page, 'Edit details')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menuItem(page, 'Reset password')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menuItem(page, 'Disable')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menuItem(page, 'Remove')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(popconfirm(page)).toContainText(CONFIRM);
    expect(mock.requests, 'nothing is sent before the confirm').toEqual([]);
    await expect(popconfirm(page).getByRole('button', { name: 'Remove' })).toBeFocused();
    const listBefore = mock.listCalls;
    await page.keyboard.press('Enter');
    await expect(row(page, 'dara1')).toHaveCount(0);
    expect(mock.requests).toEqual([{ method: 'POST', path: 'student/lu-1/remove', body: '{}' }]);
    await expect(toasts(page)).toHaveText('Removed. The username dara1 can be used again.');
    await expect.poll(() => mock.listCalls, 'the list is read again').toBeGreaterThan(listBefore);
    await expect.poll(() => focusedLabel(page)).toBe('Manage sokha2');
    expect(mock.unmocked.filter((u) => /student\/.*remove/.test(u)), 'the removal is answered by the route above').toEqual([]);
  });

  test('removing the last row puts focus on the previous row', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await chooseRemove(page, 'maly3');
    await popconfirm(page).getByRole('button', { name: 'Remove' }).click();
    await expect(row(page, 'maly3')).toHaveCount(0);
    await expect.poll(() => focusedLabel(page)).toBe('Manage sokha2');
  });

  test('removing the only row puts focus on the list heading', async ({ context }) => {
    const mock = newMock();
    mock.learners = [learner(1, 'Dara')];
    const page = await openLearners(context, mock);
    await chooseRemove(page, 'dara1');
    await popconfirm(page).getByRole('button', { name: 'Remove' }).click();
    await expect(row(page, 'dara1')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.activeElement?.className ?? '')).toContain('ant-card-head-title');
  });

  test('a second click while the removal runs sends nothing more', async ({ context }) => {
    const mock = newMock();
    let release!: () => void;
    mock.hold = new Promise<void>((resolve) => (release = resolve));
    const page = await openLearners(context, mock);
    await chooseRemove(page, 'dara1');
    await popconfirm(page).getByRole('button', { name: 'Remove' }).click();
    await expect.poll(() => mock.requests.length).toBe(1);
    await actions(page, 'dara1').click();
    await expect(menuItem(page, 'Remove')).toHaveAttribute('aria-disabled', 'true');
    await menuItem(page, 'Remove').click({ force: true });
    await page.waitForTimeout(300);
    expect(mock.requests, 'one request only').toHaveLength(1);
    await expect(popconfirm(page)).toHaveCount(0);
    release();
    await expect(row(page, 'dara1')).toHaveCount(0);
    expect(mock.requests).toHaveLength(1);
  });
});

const ERRORS: Array<[string, number, string]> = [
  ['409 signed in or has progress', 409, "This learner has signed in or has progress, so it can't be removed. Disable it instead."],
  ['409 held under another school', 409, 'The learning server holds this account under another school, so nothing was removed. Run Sync Students for this school, then try again.'],
  ['409 removed there but kept here', 409, 'This learner was removed from the learning server, but has activity here, so it was kept. Run Sync Students for this school to restore it on the learning server.'],
  ['503 learning server did not answer', 503, "The learning server didn't answer, so nothing was removed. Try again later."],
  ['500 removed there but not here', 500, 'Removed from the learning server, but not here. Try again.'],
  ['404 not found', 404, 'That learner was not found in this organisation.'],
  ['403 not allowed', 403, 'You do not have permission to remove this learner.'],
];

test.describe('Remove: central refuses', () => {
  for (const [name, status, message] of ERRORS) {
    test(`${name}: central's sentence is shown once, the row stays, focus returns to Manage`, async ({ context }) => {
      const mock = newMock();
      mock.answer = () => json(status, { error: true, errormessage: message });
      const page = await openLearners(context, mock);
      await chooseRemove(page, 'dara1');
      await popconfirm(page).getByRole('button', { name: 'Remove' }).click();
      await expect.poll(() => mock.requests.length).toBe(1);
      await expect(toasts(page)).toHaveText(message);
      await expect(notices(page), 'one notice, not a second one from the interceptor').toHaveCount(1);
      await expect(row(page, 'dara1')).toHaveCount(1);
      await expect.poll(() => focusedLabel(page)).toBe('Manage dara1');
      await actions(page, 'dara1').click();
      await expect(menuItem(page, 'Remove'), 'the row can be tried again').toBeEnabled();
    });
  }

  test("the Remove confirm's OK button has the danger style and Disable's does not", async ({ context }) => {
    const page = await openLearners(context, newMock());
    await chooseRemove(page, 'dara1');
    await expect(popconfirm(page).getByRole('button', { name: 'Remove' })).toHaveClass(/ant-btn-dangerous/);
    await page.keyboard.press('Escape');
    await expect(popconfirm(page)).toHaveCount(0);
    await actions(page, 'dara1').click();
    await menuItem(page, 'Disable').click();
    await expect(popconfirm(page)).toContainText('Disable dara1');
    await expect(popconfirm(page).getByRole('button', { name: 'Disable' })).not.toHaveClass(/ant-btn-dangerous/);
  });

  test('a refusal with no words of its own shows the fixed sentence', async ({ context }) => {
    const mock = newMock();
    mock.answer = () => json(409, {});
    const page = await openLearners(context, mock);
    await chooseRemove(page, 'dara1');
    await popconfirm(page).getByRole('button', { name: 'Remove' }).click();
    await expect(toasts(page)).toHaveText('The learner was not removed.');
    await expect(row(page, 'dara1')).toHaveCount(1);
  });

  test('the error notice stays until it is closed', async ({ context }) => {
    const mock = newMock();
    mock.answer = () => json(409, { error: true, errormessage: ERRORS[0][2] });
    const page = await openLearners(context, mock);
    await chooseRemove(page, 'dara1');
    await popconfirm(page).getByRole('button', { name: 'Remove' }).click();
    await expect(toasts(page)).toHaveText(ERRORS[0][2]);
    await page.waitForTimeout(6500);
    await expect(toasts(page), 'still there after the usual 4.5 seconds').toHaveText(ERRORS[0][2]);
    await page.locator('.ant-notification-notice-close').click();
    await expect(notices(page)).toHaveCount(0);
  });

  test('a success notice goes by itself (only the error stays)', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await chooseRemove(page, 'dara1');
    await popconfirm(page).getByRole('button', { name: 'Remove' }).click();
    await expect(toasts(page)).toHaveText('Removed. The username dara1 can be used again.');
    await expect(notices(page)).toHaveCount(0, { timeout: 9000 });
  });
});

test.describe('Remove: screenshots', () => {
  test('the open menu and the confirm', async ({ context }) => {
    test.skip(!SHOTS, 'E2E_SHOTS_DIR not set');
    const page = await openLearners(context, newMock());
    await actions(page, 'dara1').click();
    await expect(menuItem(page, 'Remove')).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/remove-menu.png` });
    await menuItem(page, 'Remove').click();
    await expect(popconfirm(page)).toContainText(CONFIRM);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/remove-confirm.png` });
  });
});
