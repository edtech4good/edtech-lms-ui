import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { API_URL, BASE_URL } from '../fixtures/env';

/**
 * Disable / Enable on the Learners and Teachers lists, in a browser, with every answer from the API mocked: the sign-in
 * is a token written to the session (no server is asked), and every request to the API host is answered by a route
 * here, following the contract of `POST student`, `POST teacher`, `PUT student/:schooluserid/disabled` and
 * `PUT teacher/:schooluserid/disabled`. Nothing leaves the machine: any other host is refused.
 *
 * Run it against a production or local build served on E2E_BASE_URL. The session keys and the API host are those of
 * that build's environment file: E2E_API_URL, and E2E_ACCESS_KEYS as "algKey,payloadKey,hashKey".
 */
const ACCESS_KEYS = (process.env.E2E_ACCESS_KEYS ?? 'lms_access_alg,lms_access_payload,lms_access_hash').split(',');
const WITH = ['view_student', 'update_student', 'view_teacher', 'update_teacher', 'delete_teacher', 'view_school'];
const WITHOUT = ['view_student', 'view_teacher', 'delete_teacher', 'view_school'];
const ADMIN_ROLE = 'zr5ER4QD';

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
function sessionToken(permissions: string[]): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ lmsuserid: 'staff-1', lmsuserrole: ADMIN_ROLE, firstname: 'Test', lastname: 'Admin', permissions, isplatform: false, organisationid: 'org-1', exp, iat: exp - 10 })}.c2ln`;
}
const json = (status: number, body: unknown) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

const learner = (n: number, name: string, isdisabled = false) => ({
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
  isdisabled,
});
const teacher = (n: number, username: string, isdisabled = false) => ({ schooluserid: `tu-${n}`, schoolusername: username, schoolname: 'North Valley School', isdisabled });

interface Mock {
  learners: ReturnType<typeof learner>[];
  teachers: ReturnType<typeof teacher>[];
  /** Answers a disabled request: given the kind and the id. */
  answer: (kind: 'student' | 'teacher', id: string, disabled: boolean) => ReturnType<typeof json>;
  requests: Array<{ method: string; path: string; body: unknown }>;
  /** Held until released, to see the state while a request runs. */
  hold?: Promise<void>;
  unmocked: string[];
}

function newMock(): Mock {
  return {
    learners: [learner(1, 'Dara'), learner(2, 'Sokha', true), learner(3, 'Maly')],
    teachers: [teacher(1, 'teacher.one'), teacher(2, 'teacher.two', true)],
    answer: (_kind, id, disabled) => json(200, { schooluserid: id, disabled, push: { status: 'pushed', message: 'ok' } }),
    requests: [],
    unmocked: [],
  };
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
  const disabledPath = /^(student|teacher)\/([^/]+)\/disabled$/.exec(path);
  if (method === 'PUT' && disabledPath) {
    const body = request.postDataJSON();
    mock.requests.push({ method, path, body });
    if (mock.hold) await mock.hold;
    return route.fulfill(mock.answer(disabledPath[1] as 'student' | 'teacher', disabledPath[2], body.disabled));
  }
  if (method === 'POST' && path === 'student') return route.fulfill(json(200, { data: { data: mock.learners, total: mock.learners.length } }));
  if (method === 'POST' && path === 'teacher') return route.fulfill(json(200, { data: { data: mock.teachers, total: mock.teachers.length } }));
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
async function openTeachers(context: BrowserContext, mock: Mock, permissions = WITH): Promise<Page> {
  await signIn(context, mock, permissions);
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/teacher/index');
  await expect(page.getByRole('columnheader', { name: 'Tools' })).toBeVisible();
  await expect(page.locator('tbody tr', { hasText: 'teacher.one' })).toHaveCount(1);
  return page;
}

const row = (page: Page, text: string) => page.locator('tbody tr', { hasText: text });
const toasts = (page: Page) => page.locator('.ant-notification-notice-description');
const actions = (page: Page, username: string) => page.getByRole('button', { name: `Actions for ${username}` });
const menuItem = (page: Page, name: string) => page.getByRole('menuitem', { name, exact: true });
const popconfirm = (page: Page) => page.locator('.ant-popover-inner');
const SHOTS = process.env.E2E_SHOTS_DIR;


/** Central's two real sentences for a push that failed: the learning server did not answer, or it lacks the class or curriculum. */
const SYNC_MESSAGE = "The account was saved, but the learning server did not answer. Run Sync Students for this school on the Schools screen.";
const MISSING_MESSAGE = "Saved, but the learning server doesn't have this class or curriculum yet. Run Sync Content, then Sync Students for this school.";

test.describe('Learners list', () => {
  test('a disabled row carries a Disabled tag and stays in the list', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await expect(page.locator('tbody tr', { hasText: 'Rivers' })).toHaveCount(3);
    await expect(row(page, 'sokha2').getByTestId('disabled-tag')).toHaveText('Disabled');
    await expect(row(page, 'dara1').getByTestId('disabled-tag')).toHaveCount(0);
  });

  test('the Actions menu offers Disable on an enabled row and Enable on a disabled one, with a named button', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
    await actions(page, 'dara1').click();
    await expect(menuItem(page, 'Disable')).toBeVisible();
    await expect(menuItem(page, 'Enable')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await actions(page, 'sokha2').click();
    await expect(menuItem(page, 'Enable')).toBeVisible();
    await expect(menuItem(page, 'Disable')).toHaveCount(0);
  });

  test('Disable asks first, then sends the exact request, tags the row in place and says so', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    const listCalls = () => mock.requests.length;
    await actions(page, 'dara1').click();
    await menuItem(page, 'Disable').click();
    await expect(popconfirm(page)).toContainText("Disable dara1? They won't be able to sign in. Their progress is kept.");
    expect(listCalls(), 'nothing is sent before the confirm').toBe(0);
    await popconfirm(page).getByRole('button', { name: 'Disable' }).click();
    await expect(row(page, 'dara1').getByTestId('disabled-tag')).toHaveText('Disabled');
    expect(mock.requests).toEqual([{ method: 'PUT', path: 'student/lu-1/disabled', body: { disabled: true } }]);
    await expect(toasts(page)).toHaveText('dara1 is disabled.');
    await expect(page.locator('tbody tr', { hasText: 'Rivers' })).toHaveCount(3);
    await actions(page, 'dara1').click();
    await expect(menuItem(page, 'Enable')).toBeVisible();
  });

  test('Enable asks first, then removes the tag in place', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await actions(page, 'sokha2').click();
    await menuItem(page, 'Enable').click();
    await expect(popconfirm(page)).toContainText('Enable sokha2? They can sign in again.');
    await popconfirm(page).getByRole('button', { name: 'Enable' }).click();
    await expect(row(page, 'sokha2').getByTestId('disabled-tag')).toHaveCount(0);
    expect(mock.requests).toEqual([{ method: 'PUT', path: 'student/lu-2/disabled', body: { disabled: false } }]);
    await expect(toasts(page)).toHaveText('sokha2 can sign in again.');
    await actions(page, 'sokha2').click();
    await expect(menuItem(page, 'Disable')).toBeVisible();
  });

  test('Cancel sends nothing and changes nothing', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await actions(page, 'dara1').click();
    await menuItem(page, 'Disable').click();
    await popconfirm(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(popconfirm(page)).toHaveCount(0);
    expect(mock.requests).toEqual([]);
    await expect(row(page, 'dara1').getByTestId('disabled-tag')).toHaveCount(0);
  });

  for (const message of [SYNC_MESSAGE, MISSING_MESSAGE]) {
    test(`a failed push shows central's own sentence: ${message.slice(0, 40)}`, async ({ context }) => {
      const mock = newMock();
      mock.answer = (_k, id, disabled) => json(200, { schooluserid: id, disabled, push: { status: 'failed', message } });
      const page = await openLearners(context, mock);
      await actions(page, 'dara1').click();
      await menuItem(page, 'Disable').click();
      await popconfirm(page).getByRole('button', { name: 'Disable' }).click();
      await expect(toasts(page)).toHaveText(message);
      await expect(row(page, 'dara1').getByTestId('disabled-tag')).toHaveText('Disabled');
    });
  }

  for (const [status, expected] of [
    ['failed', 'dara1 is disabled on central, but the learning server did not answer. Run Sync Students for this school on the Schools screen.'],
    ['skipped', 'dara1 is disabled. The learning server gets the change at its next sync.'],
  ] as const) {
    test(`a ${status} push still tags the row and says what to do`, async ({ context }) => {
      const mock = newMock();
      mock.answer = (_k, id, disabled) => json(200, { schooluserid: id, disabled, push: { status, ...(status === 'failed' ? {} : { message: 'm' }) } });
      const page = await openLearners(context, mock);
      await actions(page, 'dara1').click();
      await menuItem(page, 'Disable').click();
      await popconfirm(page).getByRole('button', { name: 'Disable' }).click();
      await expect(toasts(page)).toHaveText(expected);
      await expect(row(page, 'dara1').getByTestId('disabled-tag')).toHaveText('Disabled');
    });
  }

  test('a 404 leaves the row as it was', async ({ context }) => {
    const mock = newMock();
    mock.answer = () => json(404, { error: true, errormessage: 'Not found' });
    const page = await openLearners(context, mock);
    await actions(page, 'dara1').click();
    await menuItem(page, 'Disable').click();
    await popconfirm(page).getByRole('button', { name: 'Disable' }).click();
    await expect.poll(() => mock.requests.length).toBe(1);
    await expect(row(page, 'dara1').getByTestId('disabled-tag')).toHaveCount(0);
    await expect(row(page, 'dara1')).toBeVisible();
    await actions(page, 'dara1').click();
    await expect(menuItem(page, 'Disable'), 'the row can be tried again').toBeEnabled();
  });

  test('the menu item is disabled while the request runs, and a second click sends nothing', async ({ context }) => {
    const mock = newMock();
    let release!: () => void;
    mock.hold = new Promise<void>((resolve) => (release = resolve));
    const page = await openLearners(context, mock);
    await actions(page, 'dara1').click();
    await menuItem(page, 'Disable').click();
    await popconfirm(page).getByRole('button', { name: 'Disable' }).click();
    await expect.poll(() => mock.requests.length).toBe(1);
    await actions(page, 'dara1').click();
    await expect(menuItem(page, 'Disable')).toHaveAttribute('aria-disabled', 'true');
    await menuItem(page, 'Disable').click({ force: true });
    await page.waitForTimeout(300);
    expect(mock.requests, 'one request only').toHaveLength(1);
    await expect(popconfirm(page)).toHaveCount(0);
    release();
    await expect(row(page, 'dara1').getByTestId('disabled-tag')).toHaveText('Disabled');
  });

  test('without update_student there is no Actions column and no menu', async ({ context }) => {
    const page = await openLearners(context, newMock(), WITHOUT);
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Actions for/ })).toHaveCount(0);
    await expect(row(page, 'sokha2').getByTestId('disabled-tag'), 'the tag is still shown').toHaveText('Disabled');
  });

  test('screenshot: a disabled row and the open menu', async ({ context }) => {
    test.skip(!SHOTS, 'E2E_SHOTS_DIR not set');
    const page = await openLearners(context, newMock());
    await actions(page, 'maly3').click();
    await expect(menuItem(page, 'Disable')).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/disable-learners.png` });
  });
});

const focusedLabel = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName ?? '');

test.describe('Learners list: keyboard and focus', () => {
  test('keyboard only: the Actions button opens the menu, focus lands on the item, Enter opens the confirm, Enter confirms', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    const button = actions(page, 'dara1');
    await expect(button).toHaveAttribute('aria-haspopup', 'menu');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(menuItem(page, 'Edit details')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menuItem(page, 'Reset password')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menuItem(page, 'Disable')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(popconfirm(page)).toContainText('Disable dara1?');
    await expect(popconfirm(page).getByRole('button', { name: 'Disable' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(row(page, 'dara1').getByTestId('disabled-tag')).toHaveText('Disabled');
    expect(mock.requests).toEqual([{ method: 'PUT', path: 'student/lu-1/disabled', body: { disabled: true } }]);
  });

  test('Space on the item also opens the confirm', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await actions(page, 'dara1').focus();
    await page.keyboard.press('Enter');
    await expect(menuItem(page, 'Edit details')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menuItem(page, 'Reset password')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menuItem(page, 'Disable')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(popconfirm(page)).toContainText('Disable dara1?');
  });

  for (const how of ['Confirm', 'Cancel', 'Escape'] as const) {
    test(`focus returns to the Actions button after ${how}`, async ({ context }) => {
      const mock = newMock();
      const page = await openLearners(context, mock);
      await actions(page, 'dara1').focus();
      await page.keyboard.press('Enter');
      await expect(menuItem(page, 'Edit details')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(menuItem(page, 'Reset password')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(menuItem(page, 'Disable')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(popconfirm(page)).toBeVisible();
      if (how === 'Escape') await page.keyboard.press('Escape');
      else await popconfirm(page).getByRole('button', { name: how === 'Confirm' ? 'Disable' : 'Cancel' }).click();
      await expect(popconfirm(page)).toHaveCount(0);
      await expect.poll(() => focusedLabel(page)).toBe('Actions for dara1');
      expect(mock.requests).toHaveLength(how === 'Confirm' ? 1 : 0);
    });
  }

  test('a click outside the confirm closes it, sends nothing and returns focus to the Actions button', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await actions(page, 'dara1').click();
    await menuItem(page, 'Disable').click();
    await expect(popconfirm(page)).toBeVisible();
    await page.locator('.ant-card-head-title').click();
    await expect(popconfirm(page)).toHaveCount(0);
    expect(mock.requests).toEqual([]);
    await expect.poll(() => focusedLabel(page)).toBe('Actions for dara1');
  });

  test('an outside click on another control still works, and takes the focus it clicked', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await actions(page, 'dara1').click();
    await menuItem(page, 'Disable').click();
    await expect(popconfirm(page)).toBeVisible();
    await actions(page, 'maly3').click();
    await expect(popconfirm(page)).toHaveCount(0);
    await expect(menuItem(page, 'Disable')).toBeVisible();
    expect(mock.requests).toEqual([]);
    await expect(menuItem(page, 'Edit details')).toBeFocused();
  });

  test('when the request ends, focus is not pulled back if the user has moved on', async ({ context }) => {
    const mock = newMock();
    let release!: () => void;
    mock.hold = new Promise<void>((resolve) => (release = resolve));
    const page = await openLearners(context, mock);
    await actions(page, 'dara1').click();
    await menuItem(page, 'Disable').click();
    await popconfirm(page).getByRole('button', { name: 'Disable' }).click();
    await expect.poll(() => mock.requests.length).toBe(1);
    await actions(page, 'maly3').focus();
    release();
    await expect(row(page, 'dara1').getByTestId('disabled-tag')).toHaveText('Disabled');
    await page.waitForTimeout(300);
    expect(await focusedLabel(page)).toBe('Actions for maly3');
  });

  test('when the request ends with focus lost, it returns to the Actions button', async ({ context }) => {
    const mock = newMock();
    let release!: () => void;
    mock.hold = new Promise<void>((resolve) => (release = resolve));
    const page = await openLearners(context, mock);
    await actions(page, 'dara1').click();
    await menuItem(page, 'Disable').click();
    await popconfirm(page).getByRole('button', { name: 'Disable' }).click();
    await expect.poll(() => mock.requests.length).toBe(1);
    release();
    await expect(row(page, 'dara1').getByTestId('disabled-tag')).toHaveText('Disabled');
    await expect.poll(() => focusedLabel(page)).toBe('Actions for dara1');
  });

  test('focus returns to the Actions button after the menu is closed with Escape', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await actions(page, 'dara1').focus();
    await page.keyboard.press('Enter');
    await expect(menuItem(page, 'Edit details')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menuItem(page, 'Disable')).toHaveCount(0);
    await expect.poll(() => focusedLabel(page)).toBe('Actions for dara1');
  });
});

test.describe('Teachers list: accessible names and focus', () => {
  test('each Disable or Enable button names its teacher; Delete keeps its own name', async ({ context }) => {
    const page = await openTeachers(context, newMock());
    await expect(page.getByRole('button', { name: 'Disable teacher.one', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enable teacher.two', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Disable teacher.two' })).toHaveCount(0);
    await expect(row(page, 'teacher.one').getByText('Delete', { exact: true })).toBeVisible();
  });

  test('keyboard only: Enter opens the confirm with focus on its button, Enter confirms', async ({ context }) => {
    const mock = newMock();
    const page = await openTeachers(context, mock);
    await page.getByRole('button', { name: 'Disable teacher.one', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(popconfirm(page)).toContainText('Disable teacher.one?');
    await expect(popconfirm(page).getByRole('button', { name: 'Disable' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(row(page, 'teacher.one').getByTestId('disabled-tag')).toHaveText('Disabled');
    expect(mock.requests).toEqual([{ method: 'PUT', path: 'teacher/tu-1/disabled', body: { disabled: true } }]);
  });

  test('a click outside the confirm closes it, sends nothing and returns focus to the row\'s button', async ({ context }) => {
    const mock = newMock();
    const page = await openTeachers(context, mock);
    await page.getByRole('button', { name: 'Disable teacher.one', exact: true }).click();
    await expect(popconfirm(page)).toBeVisible();
    await page.mouse.click(700, 700); // empty page area below the card (the confirm covers the card title)
    await expect(popconfirm(page)).toHaveCount(0);
    expect(mock.requests).toEqual([]);
    await expect.poll(() => focusedLabel(page)).toBe('Disable teacher.one');
  });

  test('when the request ends, focus is not pulled back if the user has moved on', async ({ context }) => {
    const mock = newMock();
    let release!: () => void;
    mock.hold = new Promise<void>((resolve) => (release = resolve));
    const page = await openTeachers(context, mock);
    await page.getByRole('button', { name: 'Disable teacher.one', exact: true }).click();
    await popconfirm(page).getByRole('button', { name: 'Disable' }).click();
    await expect.poll(() => mock.requests.length).toBe(1);
    await page.getByRole('button', { name: 'Enable teacher.two', exact: true }).focus();
    release();
    await expect(row(page, 'teacher.one').getByTestId('disabled-tag')).toHaveText('Disabled');
    await page.waitForTimeout(300);
    expect(await focusedLabel(page)).toBe('Enable teacher.two');
  });

  for (const how of ['Confirm', 'Cancel', 'Escape'] as const) {
    test(`focus returns to the row's button after ${how}`, async ({ context }) => {
      const mock = newMock();
      const page = await openTeachers(context, mock);
      await page.getByRole('button', { name: 'Disable teacher.one', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(popconfirm(page)).toBeVisible();
      if (how === 'Escape') await page.keyboard.press('Escape');
      else await popconfirm(page).getByRole('button', { name: how === 'Confirm' ? 'Disable' : 'Cancel' }).click();
      await expect(popconfirm(page)).toHaveCount(0);
      const after = how === 'Confirm' ? 'Enable teacher.one' : 'Disable teacher.one';
      await expect.poll(() => focusedLabel(page)).toBe(after);
      expect(mock.requests).toHaveLength(how === 'Confirm' ? 1 : 0);
    });
  }
});

test.describe('Teachers list', () => {
  test('a disabled row carries a Disabled tag, and Delete stays beside Disable and Enable', async ({ context }) => {
    const page = await openTeachers(context, newMock());
    await expect(row(page, 'teacher.two').getByTestId('disabled-tag')).toHaveText('Disabled');
    await expect(row(page, 'teacher.one').getByTestId('disabled-tag')).toHaveCount(0);
    await expect(row(page, 'teacher.one').getByRole('button', { name: 'Disable' })).toBeVisible();
    await expect(row(page, 'teacher.two').getByRole('button', { name: 'Enable' })).toBeVisible();
    await expect(row(page, 'teacher.one').getByText('Delete', { exact: true })).toBeVisible();
    await expect(row(page, 'teacher.two').getByText('Delete', { exact: true })).toBeVisible();
  });

  test('Disable asks first, sends the exact request, tags the row and says so; Enable undoes it', async ({ context }) => {
    const mock = newMock();
    const page = await openTeachers(context, mock);
    await row(page, 'teacher.one').getByRole('button', { name: 'Disable' }).click();
    await expect(popconfirm(page)).toContainText("Disable teacher.one? They won't be able to sign in. Their progress is kept.");
    expect(mock.requests).toEqual([]);
    await popconfirm(page).getByRole('button', { name: 'Disable' }).click();
    await expect(row(page, 'teacher.one').getByTestId('disabled-tag')).toHaveText('Disabled');
    expect(mock.requests).toEqual([{ method: 'PUT', path: 'teacher/tu-1/disabled', body: { disabled: true } }]);
    await expect(toasts(page)).toHaveText('teacher.one is disabled.');
    await expect(row(page, 'teacher.one').getByRole('button', { name: 'Enable' })).toBeVisible();

    await row(page, 'teacher.one').getByRole('button', { name: 'Enable' }).click();
    await expect(popconfirm(page)).toContainText('Enable teacher.one? They can sign in again.');
    await popconfirm(page).getByRole('button', { name: 'Enable' }).click();
    await expect(row(page, 'teacher.one').getByTestId('disabled-tag')).toHaveCount(0);
    expect(mock.requests.at(-1)).toEqual({ method: 'PUT', path: 'teacher/tu-1/disabled', body: { disabled: false } });
  });

  for (const [status, expected] of [
    ['failed', 'teacher.one is disabled on central, but the learning server did not answer. Run Sync Teachers for this school on the Schools screen.'],
    ['skipped', 'teacher.one is disabled. The learning server gets the change at its next sync.'],
  ] as const) {
    test(`a ${status} push says what to do`, async ({ context }) => {
      const mock = newMock();
      mock.answer = (_k, id, disabled) => json(200, { schooluserid: id, disabled, push: { status, message: 'm' } });
      const page = await openTeachers(context, mock);
      await row(page, 'teacher.one').getByRole('button', { name: 'Disable' }).click();
      await popconfirm(page).getByRole('button', { name: 'Disable' }).click();
      await expect(toasts(page)).toHaveText(expected);
    });
  }

  test('a 404 leaves the row as it was', async ({ context }) => {
    const mock = newMock();
    mock.answer = () => json(404, { error: true, errormessage: 'Not found' });
    const page = await openTeachers(context, mock);
    await row(page, 'teacher.one').getByRole('button', { name: 'Disable' }).click();
    await popconfirm(page).getByRole('button', { name: 'Disable' }).click();
    await expect.poll(() => mock.requests.length).toBe(1);
    await expect(row(page, 'teacher.one').getByTestId('disabled-tag')).toHaveCount(0);
    await expect(row(page, 'teacher.one').getByRole('button', { name: 'Disable' })).toBeEnabled();
  });

  test('the button is disabled while the request runs', async ({ context }) => {
    const mock = newMock();
    let release!: () => void;
    mock.hold = new Promise<void>((resolve) => (release = resolve));
    const page = await openTeachers(context, mock);
    await row(page, 'teacher.one').getByRole('button', { name: 'Disable' }).click();
    await popconfirm(page).getByRole('button', { name: 'Disable' }).click();
    await expect.poll(() => mock.requests.length).toBe(1);
    await expect(row(page, 'teacher.one').getByRole('button', { name: 'Disable' })).toBeDisabled();
    release();
    await expect(row(page, 'teacher.one').getByTestId('disabled-tag')).toHaveText('Disabled');
  });

  test('without update_teacher there is no Disable or Enable, and Delete stays', async ({ context }) => {
    const page = await openTeachers(context, newMock(), WITHOUT);
    await expect(page.getByRole('button', { name: /^(Disable|Enable) / })).toHaveCount(0);
    await expect(row(page, 'teacher.one').getByText('Delete', { exact: true })).toBeVisible();
  });

  test('screenshot: the confirm open', async ({ context }) => {
    test.skip(!SHOTS, 'E2E_SHOTS_DIR not set');
    const page = await openTeachers(context, newMock());
    await row(page, 'teacher.one').getByRole('button', { name: 'Disable' }).click();
    await expect(popconfirm(page)).toBeVisible();
    await expect(page.locator('.ant-spin-blur')).toHaveCount(0);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/disable-teachers.png` });
  });
});
