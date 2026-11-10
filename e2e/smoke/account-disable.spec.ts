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
  /** The body a teacher delete answers with; none means an older server that sends no push. */
  deleteBody?: unknown;
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
  const deletePath = /^teacher\/([^/]+)$/.exec(path);
  if (method === 'DELETE' && deletePath) {
    mock.requests.push({ method, path, body: null });
    if (mock.hold) await mock.hold;
    mock.teachers = mock.teachers.filter((t) => t.schooluserid !== deletePath[1]);
    return route.fulfill(json(200, mock.deleteBody ?? { data: {} }));
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
  await expect(page.getByRole('columnheader', { name: 'Teacher User Name' })).toBeVisible();
  await expect(page.locator('tbody tr', { hasText: 'teacher.one' })).toHaveCount(1);
  return page;
}

const row = (page: Page, text: string) => page.locator('tbody tr', { hasText: text });
const toasts = (page: Page) => page.locator('.ant-notification-notice-description');
const actions = (page: Page, username: string) => page.getByRole('button', { name: `Manage ${username}`, exact: true });
const menuItem = (page: Page, name: string) => page.getByRole('menuitem', { name, exact: true });
const popconfirm = (page: Page) => page.locator('.ant-popover-inner');
const SHOTS = process.env.E2E_SHOTS_DIR;


/** Central's two real sentences for a push that failed: the learning server did not answer, or it lacks the class or curriculum. */
const SYNC_MESSAGE = "The change was saved, but the learning server did not answer. Run Sync Students for this school on the Schools screen.";
const MISSING_MESSAGE = "Saved, but the learning server doesn't have this class or curriculum yet. Run Sync Content, then Sync Students for this school.";

test.describe('Learners list', () => {
  test('a disabled row carries a Disabled tag and stays in the list', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await expect(page.locator('tbody tr', { hasText: 'Rivers' })).toHaveCount(3);
    await expect(row(page, 'sokha2').getByTestId('disabled-tag')).toHaveText('Disabled');
    await expect(row(page, 'dara1').getByTestId('disabled-tag')).toHaveCount(0);
  });

  test('the Manage menu offers Disable on an enabled row and Enable on a disabled one, with a named button', async ({ context }) => {
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
      await expect(toasts(page)).toHaveText(`dara1 is disabled on central. ${message}`);
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

  test('a failed push notice is still on screen after 6 seconds', async ({ context }) => {
    const mock = newMock();
    mock.answer = (_k, id, disabled) => json(200, { schooluserid: id, disabled, push: { status: 'failed', message: SYNC_MESSAGE } });
    const page = await openLearners(context, mock);
    await actions(page, 'dara1').click();
    await menuItem(page, 'Disable').click();
    await popconfirm(page).getByRole('button', { name: 'Disable' }).click();
    await expect(toasts(page)).toHaveText(`dara1 is disabled on central. ${SYNC_MESSAGE}`);
    await page.mouse.move(2, 2); // a notice under the pointer pauses its timer
    await page.waitForTimeout(6000);
    await expect(toasts(page)).toHaveText(`dara1 is disabled on central. ${SYNC_MESSAGE}`);
  });

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
    await expect(page.getByRole('button', { name: /^Manage / })).toHaveCount(0);
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
  test('keyboard only: the Manage button opens the menu, focus lands on the item, Enter opens the confirm, Enter confirms', async ({ context }) => {
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
    test(`focus returns to the Manage button after ${how}`, async ({ context }) => {
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
      await expect.poll(() => focusedLabel(page)).toBe('Manage dara1');
      expect(mock.requests).toHaveLength(how === 'Confirm' ? 1 : 0);
    });
  }

  test('a click outside the confirm closes it, sends nothing and returns focus to the Manage button', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await actions(page, 'dara1').click();
    await menuItem(page, 'Disable').click();
    await expect(popconfirm(page)).toBeVisible();
    await page.locator('.ant-card-head-title').click();
    await expect(popconfirm(page)).toHaveCount(0);
    expect(mock.requests).toEqual([]);
    await expect.poll(() => focusedLabel(page)).toBe('Manage dara1');
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
    expect(await focusedLabel(page)).toBe('Manage maly3');
  });

  test('when the request ends with focus lost, it returns to the Manage button', async ({ context }) => {
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
    await expect.poll(() => focusedLabel(page)).toBe('Manage dara1');
  });

  test('focus returns to the Manage button after the menu is closed with Escape', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await actions(page, 'dara1').focus();
    await page.keyboard.press('Enter');
    await expect(menuItem(page, 'Edit details')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menuItem(page, 'Disable')).toHaveCount(0);
    await expect.poll(() => focusedLabel(page)).toBe('Manage dara1');
  });
});

const manage = (page: Page, username: string) => page.getByRole('button', { name: `Manage ${username}`, exact: true });
/** Opens a teacher's Manage menu with the mouse and chooses an item. */
async function chooseTeacherItem(page: Page, username: string, item: string): Promise<void> {
  await manage(page, username).click();
  await menuItem(page, item).click();
}

test.describe('Teachers list: accessible names and focus', () => {
  test('each Manage button names its teacher; the menu offers Disable or Enable, and Delete', async ({ context }) => {
    const page = await openTeachers(context, newMock());
    await expect(manage(page, 'teacher.one')).toBeVisible();
    await expect(manage(page, 'teacher.two')).toBeVisible();
    await manage(page, 'teacher.one').click();
    await expect(menuItem(page, 'Disable')).toBeVisible();
    await expect(menuItem(page, 'Enable')).toHaveCount(0);
    await expect(menuItem(page, 'Delete')).toBeVisible();
    await page.keyboard.press('Escape');
    await manage(page, 'teacher.two').click();
    await expect(menuItem(page, 'Enable')).toBeVisible();
    await expect(menuItem(page, 'Disable')).toHaveCount(0);
    await expect(menuItem(page, 'Delete')).toBeVisible();
  });

  test('keyboard only: Enter opens the menu, Tab reaches Disable, Enter opens the confirm with focus on its button, Enter confirms', async ({ context }) => {
    const mock = newMock();
    const page = await openTeachers(context, mock);
    await manage(page, 'teacher.one').focus();
    await page.keyboard.press('Enter');
    await expect(menuItem(page, 'Reset password')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menuItem(page, 'Disable')).toBeFocused();
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
    await chooseTeacherItem(page, 'teacher.one', 'Disable');
    await expect(popconfirm(page)).toBeVisible();
    await page.mouse.click(700, 700); // empty page area below the card (the confirm covers the card title)
    await expect(popconfirm(page)).toHaveCount(0);
    expect(mock.requests).toEqual([]);
    await expect.poll(() => focusedLabel(page)).toBe('Manage teacher.one');
  });

  test('when the request ends, focus is not pulled back if the user has moved on', async ({ context }) => {
    const mock = newMock();
    let release!: () => void;
    mock.hold = new Promise<void>((resolve) => (release = resolve));
    const page = await openTeachers(context, mock);
    await chooseTeacherItem(page, 'teacher.one', 'Disable');
    await popconfirm(page).getByRole('button', { name: 'Disable' }).click();
    await expect.poll(() => mock.requests.length).toBe(1);
    await manage(page, 'teacher.two').focus();
    release();
    await expect(row(page, 'teacher.one').getByTestId('disabled-tag')).toHaveText('Disabled');
    await page.waitForTimeout(300);
    expect(await focusedLabel(page)).toBe('Manage teacher.two');
  });

  for (const how of ['Confirm', 'Cancel', 'Escape'] as const) {
    test(`focus returns to the row's Manage button after ${how}`, async ({ context }) => {
      const mock = newMock();
      const page = await openTeachers(context, mock);
      await manage(page, 'teacher.one').focus();
      await page.keyboard.press('Enter');
      await expect(menuItem(page, 'Reset password')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(menuItem(page, 'Disable')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(popconfirm(page)).toBeVisible();
      if (how === 'Escape') await page.keyboard.press('Escape');
      else await popconfirm(page).getByRole('button', { name: how === 'Confirm' ? 'Disable' : 'Cancel' }).click();
      await expect(popconfirm(page)).toHaveCount(0);
      await expect.poll(() => focusedLabel(page)).toBe('Manage teacher.one');
      expect(mock.requests).toHaveLength(how === 'Confirm' ? 1 : 0);
    });
  }
});

test.describe('Teachers list', () => {
  test('a disabled row carries a Disabled tag, and Delete is in the menu beside Disable and Enable', async ({ context }) => {
    const page = await openTeachers(context, newMock());
    await expect(row(page, 'teacher.two').getByTestId('disabled-tag')).toHaveText('Disabled');
    await expect(row(page, 'teacher.one').getByTestId('disabled-tag')).toHaveCount(0);
    await manage(page, 'teacher.one').click();
    await expect(menuItem(page, 'Disable')).toBeVisible();
    await expect(menuItem(page, 'Delete')).toBeVisible();
    await page.keyboard.press('Escape');
    await manage(page, 'teacher.two').click();
    await expect(menuItem(page, 'Enable')).toBeVisible();
    await expect(menuItem(page, 'Delete')).toBeVisible();
  });

  test('Disable asks first, sends the exact request, tags the row and says so; Enable undoes it', async ({ context }) => {
    const mock = newMock();
    const page = await openTeachers(context, mock);
    await chooseTeacherItem(page, 'teacher.one', 'Disable');
    await expect(popconfirm(page)).toContainText("Disable teacher.one? They won't be able to sign in. Their progress is kept.");
    expect(mock.requests).toEqual([]);
    await popconfirm(page).getByRole('button', { name: 'Disable' }).click();
    await expect(row(page, 'teacher.one').getByTestId('disabled-tag')).toHaveText('Disabled');
    expect(mock.requests).toEqual([{ method: 'PUT', path: 'teacher/tu-1/disabled', body: { disabled: true } }]);
    await expect(toasts(page)).toHaveText('teacher.one is disabled.');
    await manage(page, 'teacher.one').click();
    await expect(menuItem(page, 'Enable')).toBeVisible();
    await menuItem(page, 'Enable').click();
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
      await chooseTeacherItem(page, 'teacher.one', 'Disable');
      await popconfirm(page).getByRole('button', { name: 'Disable' }).click();
      await expect(toasts(page)).toHaveText(expected);
    });
  }

  test('a 404 leaves the row as it was', async ({ context }) => {
    const mock = newMock();
    mock.answer = () => json(404, { error: true, errormessage: 'Not found' });
    const page = await openTeachers(context, mock);
    await chooseTeacherItem(page, 'teacher.one', 'Disable');
    await popconfirm(page).getByRole('button', { name: 'Disable' }).click();
    await expect.poll(() => mock.requests.length).toBe(1);
    await expect(row(page, 'teacher.one').getByTestId('disabled-tag')).toHaveCount(0);
    await manage(page, 'teacher.one').click();
    await expect(menuItem(page, 'Disable')).toBeEnabled();
  });

  test('the menu item is disabled while the request runs, and a second click sends nothing', async ({ context }) => {
    const mock = newMock();
    let release!: () => void;
    mock.hold = new Promise<void>((resolve) => (release = resolve));
    const page = await openTeachers(context, mock);
    await chooseTeacherItem(page, 'teacher.one', 'Disable');
    await popconfirm(page).getByRole('button', { name: 'Disable' }).click();
    await expect.poll(() => mock.requests.length).toBe(1);
    await manage(page, 'teacher.one').click();
    await expect(menuItem(page, 'Disable')).toHaveAttribute('aria-disabled', 'true');
    await menuItem(page, 'Disable').click({ force: true });
    await page.waitForTimeout(300);
    expect(mock.requests, 'one request only').toHaveLength(1);
    await expect(popconfirm(page)).toHaveCount(0);
    release();
    await expect(row(page, 'teacher.one').getByTestId('disabled-tag')).toHaveText('Disabled');
  });

  test('without update_teacher there is no Disable or Enable, and Delete stays', async ({ context }) => {
    const page = await openTeachers(context, newMock(), WITHOUT);
    await manage(page, 'teacher.one').click();
    await expect(menuItem(page, 'Disable')).toHaveCount(0);
    await expect(menuItem(page, 'Enable')).toHaveCount(0);
    await expect(menuItem(page, 'Delete')).toBeVisible();
  });

  test('screenshot: the confirm open', async ({ context }) => {
    test.skip(!SHOTS, 'E2E_SHOTS_DIR not set');
    const page = await openTeachers(context, newMock());
    await chooseTeacherItem(page, 'teacher.one', 'Disable');
    await expect(popconfirm(page)).toBeVisible();
    await expect(page.locator('.ant-spin-blur')).toHaveCount(0);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/disable-teachers.png` });
  });
});

const dialogNamed = (page: Page, name: string) => page.getByRole('dialog', { name, exact: true });

test.describe('Manage menu: the button', () => {
  test('the Learners list shows a Manage button with its text and an arrow on every row', async ({ context }) => {
    const page = await openLearners(context, newMock());
    for (const username of ['dara1', 'sokha2', 'maly3']) {
      const button = actions(page, username);
      await expect(button).toBeVisible();
      await expect(button).toHaveText(/Manage/);
      await expect(button.locator('.anticon-down')).toBeVisible();
    }
  });

  test('the Teachers list shows a Manage button with its text and an arrow on every row', async ({ context }) => {
    const page = await openTeachers(context, newMock());
    for (const username of ['teacher.one', 'teacher.two']) {
      const button = manage(page, username);
      await expect(button).toBeVisible();
      await expect(button).toHaveText(/Manage/);
      await expect(button.locator('.anticon-down')).toBeVisible();
    }
    await expect(page.getByRole('button', { name: /^(Reset password|Disable|Enable) / })).toHaveCount(0);
  });

  test('the menus list their items in order, and the Teachers menu puts Delete after a divider', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await actions(page, 'dara1').click();
    await expect(page.getByRole('menuitem')).toHaveText(['Edit details', 'Reset password', 'Disable']);
    await expect(page.locator('.ant-dropdown-menu-item-divider')).toHaveCount(0);
    await page.keyboard.press('Escape');
    const teachers = await openTeachers(context, newMock());
    await manage(teachers, 'teacher.one').click();
    await expect(teachers.getByRole('menuitem')).toHaveText(['Reset password', 'Disable', 'Delete']);
    await expect(teachers.locator('.ant-dropdown-menu-item-divider')).toHaveCount(1);
    await expect(menuItem(teachers, 'Delete')).toHaveClass(/ant-dropdown-menu-item-danger/);
  });
});

test.describe('Manage menu: keyboard only, every action', () => {
  test('Learners: Edit details opens its drawer', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await actions(page, 'dara1').focus();
    await page.keyboard.press('Enter');
    await expect(menuItem(page, 'Edit details')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialogNamed(page, 'Edit details')).toBeVisible();
  });

  test('Learners: Reset password opens its drawer', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await actions(page, 'dara1').focus();
    await page.keyboard.press('Enter');
    await expect(menuItem(page, 'Edit details')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menuItem(page, 'Reset password')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialogNamed(page, 'Reset password')).toBeVisible();
  });

  test('Learners: Disable opens its confirm', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await actions(page, 'dara1').focus();
    await page.keyboard.press('Enter');
    await expect(menuItem(page, 'Edit details')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menuItem(page, 'Reset password')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menuItem(page, 'Disable')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(popconfirm(page)).toContainText('Disable dara1?');
  });

  test('Teachers: Reset password opens its drawer from the first item', async ({ context }) => {
    const page = await openTeachers(context, newMock());
    await manage(page, 'teacher.one').focus();
    await page.keyboard.press('Enter');
    await expect(menuItem(page, 'Reset password')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialogNamed(page, 'Reset password')).toBeVisible();
  });

  test('Teachers: Disable opens its confirm', async ({ context }) => {
    const page = await openTeachers(context, newMock());
    await manage(page, 'teacher.one').focus();
    await page.keyboard.press('Enter');
    await expect(menuItem(page, 'Reset password')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menuItem(page, 'Disable')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(popconfirm(page)).toContainText('Disable teacher.one?');
  });

  test('Teachers: Delete is reachable, asks first, and deletes on Enter', async ({ context }) => {
    const mock = newMock();
    const page = await openTeachers(context, mock);
    await manage(page, 'teacher.one').focus();
    await page.keyboard.press('Enter');
    await expect(menuItem(page, 'Reset password')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menuItem(page, 'Disable')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menuItem(page, 'Delete')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(popconfirm(page)).toContainText('Sure to delete?');
    expect(mock.requests, 'nothing is sent before the confirm').toEqual([]);
    await expect(popconfirm(page).locator('.ant-btn-primary')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(row(page, 'teacher.one')).toHaveCount(0);
    expect(mock.requests).toEqual([{ method: 'DELETE', path: 'teacher/tu-1', body: null }]);
    await expect(toasts(page)).toHaveText('Teacher deleted.');
  });
});

test.describe('Manage menu: Teachers Delete', () => {
  test('Cancel sends nothing and keeps the row; focus returns to Manage', async ({ context }) => {
    const mock = newMock();
    const page = await openTeachers(context, mock);
    await chooseTeacherItem(page, 'teacher.one', 'Delete');
    await expect(popconfirm(page)).toContainText('Sure to delete?');
    await popconfirm(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(popconfirm(page)).toHaveCount(0);
    expect(mock.requests).toEqual([]);
    await expect(row(page, 'teacher.one')).toHaveCount(1);
    await expect.poll(() => focusedLabel(page)).toBe('Manage teacher.one');
  });

  test('a second click while the delete runs sends nothing more', async ({ context }) => {
    const mock = newMock();
    let release!: () => void;
    mock.hold = new Promise<void>((resolve) => (release = resolve));
    const page = await openTeachers(context, mock);
    await chooseTeacherItem(page, 'teacher.one', 'Delete');
    await popconfirm(page).locator('.ant-btn-primary').click();
    await expect.poll(() => mock.requests.length).toBe(1);
    await manage(page, 'teacher.one').click();
    await expect(menuItem(page, 'Delete')).toHaveAttribute('aria-disabled', 'true');
    await menuItem(page, 'Delete').click({ force: true });
    await page.waitForTimeout(300);
    expect(mock.requests, 'one request only').toHaveLength(1);
    await expect(popconfirm(page)).toHaveCount(0);
    release();
    await expect(row(page, 'teacher.one')).toHaveCount(0);
  });
});

test.describe('Manage menu: permissions', () => {
  test('a user with none of the permissions sees no Manage button', async ({ context }) => {
    const page = await openTeachers(context, newMock(), ['view_teacher', 'view_school']);
    await expect(page.getByRole('button', { name: /^Manage / })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Actions' })).toHaveCount(0);
    await expect(row(page, 'teacher.one').getByTestId('disabled-tag')).toHaveCount(0);
    await expect(row(page, 'teacher.two').getByTestId('disabled-tag')).toHaveText('Disabled');
  });

  test('a user with only delete_teacher sees a menu with only Delete, and no divider', async ({ context }) => {
    const page = await openTeachers(context, newMock(), ['view_teacher', 'delete_teacher', 'view_school']);
    await manage(page, 'teacher.one').click();
    await expect(page.getByRole('menuitem')).toHaveText(['Delete']);
    await expect(page.locator('.ant-dropdown-menu-item-divider')).toHaveCount(0);
  });

  test('a user with only update_teacher sees Reset password and Disable, and no Delete or divider', async ({ context }) => {
    const page = await openTeachers(context, newMock(), ['view_teacher', 'update_teacher', 'view_school']);
    await manage(page, 'teacher.one').click();
    await expect(page.getByRole('menuitem')).toHaveText(['Reset password', 'Disable']);
    await expect(page.locator('.ant-dropdown-menu-item-divider')).toHaveCount(0);
  });
});

test.describe('Manage menu: reopening after a keyboard-chosen item', () => {
  type Case = { list: 'learners' | 'teachers'; item: string; closeWith: 'Escape' | 'Cancel' };
  const cases: Case[] = [
    { list: 'learners', item: 'Disable', closeWith: 'Escape' },
    { list: 'learners', item: 'Disable', closeWith: 'Cancel' },
    { list: 'teachers', item: 'Disable', closeWith: 'Escape' },
    { list: 'teachers', item: 'Disable', closeWith: 'Cancel' },
    { list: 'teachers', item: 'Delete', closeWith: 'Escape' },
    { list: 'teachers', item: 'Delete', closeWith: 'Cancel' },
  ];
  for (const c of cases) {
    test(`${c.list}: ${c.item} chosen by keyboard, closed with ${c.closeWith}, one Enter on Manage opens the menu`, async ({ context }) => {
      const mock = newMock();
      const page = c.list === 'learners' ? await openLearners(context, mock) : await openTeachers(context, mock);
      const button = c.list === 'learners' ? actions(page, 'dara1') : manage(page, 'teacher.one');
      await button.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('menuitem').first()).toBeFocused();
      const items = await page.getByRole('menuitem').allTextContents();
      const steps = items.map((x) => x.trim()).indexOf(c.item);
      for (let i = 0; i < steps; i++) {
        await page.keyboard.press('Tab');
        await expect(page.getByRole('menuitem').nth(i + 1)).toBeFocused();
      }
      await page.keyboard.press('Enter');
      await expect(popconfirm(page)).toBeVisible();
      if (c.closeWith === 'Escape') await page.keyboard.press('Escape');
      else await popconfirm(page).getByRole('button', { name: 'Cancel' }).click();
      await expect(popconfirm(page)).toHaveCount(0);
      await expect(button).toBeFocused();
      await expect(page.locator('.ant-dropdown'), 'the menu has finished closing').toHaveCount(0);
      await page.keyboard.press('Enter');
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('menuitem').first()).toBeVisible();
      expect(mock.requests).toEqual([]);
    });
  }
});

test.describe('Manage menu: the confirm follows the item chosen last', () => {
  test('Delete, Escape, then Disable on the same row: the Disable text, and Confirm sends only the disabled request', async ({ context }) => {
    const mock = newMock();
    const page = await openTeachers(context, mock);
    await chooseTeacherItem(page, 'teacher.one', 'Delete');
    await expect(popconfirm(page)).toContainText('Sure to delete?');
    await page.keyboard.press('Escape');
    await expect(popconfirm(page)).toHaveCount(0);
    await chooseTeacherItem(page, 'teacher.one', 'Disable');
    await expect(popconfirm(page)).toContainText("Disable teacher.one? They won't be able to sign in.");
    await expect(popconfirm(page)).not.toContainText('Sure to delete?');
    await popconfirm(page).getByRole('button', { name: 'Disable' }).click();
    await expect(row(page, 'teacher.one').getByTestId('disabled-tag')).toHaveText('Disabled');
    expect(mock.requests).toEqual([{ method: 'PUT', path: 'teacher/tu-1/disabled', body: { disabled: true } }]);
    await expect(row(page, 'teacher.one')).toHaveCount(1);
  });

  test('Disable, Escape, then Delete on the same row: the delete text, and Confirm sends only the delete', async ({ context }) => {
    const mock = newMock();
    const page = await openTeachers(context, mock);
    await chooseTeacherItem(page, 'teacher.one', 'Disable');
    await expect(popconfirm(page)).toContainText('Disable teacher.one?');
    await page.keyboard.press('Escape');
    await expect(popconfirm(page)).toHaveCount(0);
    await chooseTeacherItem(page, 'teacher.one', 'Delete');
    await expect(popconfirm(page)).toContainText('Sure to delete?');
    await expect(popconfirm(page)).not.toContainText('Disable teacher.one?');
    await popconfirm(page).locator('.ant-btn-primary').click();
    await expect(row(page, 'teacher.one')).toHaveCount(0);
    expect(mock.requests).toEqual([{ method: 'DELETE', path: 'teacher/tu-1', body: null }]);
  });
});

test.describe('Manage menu: focus after a teacher is deleted', () => {
  test('the next row\'s Manage button gets focus', async ({ context }) => {
    const page = await openTeachers(context, newMock());
    await chooseTeacherItem(page, 'teacher.one', 'Delete');
    await popconfirm(page).locator('.ant-btn-primary').click();
    await expect(row(page, 'teacher.one')).toHaveCount(0);
    await expect.poll(() => focusedLabel(page)).toBe('Manage teacher.two');
  });

  test('the previous row\'s Manage button gets focus when the last row was deleted', async ({ context }) => {
    const page = await openTeachers(context, newMock());
    await chooseTeacherItem(page, 'teacher.two', 'Delete');
    await popconfirm(page).locator('.ant-btn-primary').click();
    await expect(row(page, 'teacher.two')).toHaveCount(0);
    await expect.poll(() => focusedLabel(page)).toBe('Manage teacher.one');
  });

  test('the list heading gets focus when no row remains', async ({ context }) => {
    const mock = newMock();
    mock.teachers = mock.teachers.slice(0, 1);
    const page = await openTeachers(context, mock);
    await chooseTeacherItem(page, 'teacher.one', 'Delete');
    await popconfirm(page).locator('.ant-btn-primary').click();
    await expect(row(page, 'teacher.one')).toHaveCount(0);
    await expect(page.locator('.ant-card-head-title')).toBeFocused();
  });
});

test.describe('Teachers Delete: what central says about the learning server', () => {
  const MESSAGES = {
    pushed: 'Deleted. The teacher can no longer sign in.',
    skipped: 'Deleted. No learner server is set up here, so nothing was pushed.',
    failed: 'Deleted, but the learning server did not answer. Run Sync Teachers for this school on the Schools screen.',
  } as const;
  const notice = (page: Page) => page.locator('.ant-notification-notice');

  for (const [status, kind] of [['pushed', 'success'], ['skipped', 'success'], ['failed', 'warning']] as const) {
    test(`a ${status} push shows central's sentence as a ${kind} notice; the row leaves; focus moves on`, async ({ context }) => {
      const mock = newMock();
      mock.deleteBody = { error: false, data: true, push: { status, message: MESSAGES[status] } };
      const page = await openTeachers(context, mock);
      await chooseTeacherItem(page, 'teacher.one', 'Delete');
      await popconfirm(page).locator('.ant-btn-primary').click();
      await expect(row(page, 'teacher.one')).toHaveCount(0);
      await expect(toasts(page)).toHaveText(MESSAGES[status]);
      await expect(notice(page).locator(`.ant-notification-notice-icon-${kind}`)).toHaveCount(1);
      await expect.poll(() => focusedLabel(page)).toBe('Manage teacher.two');
    });
  }

  test('a failed push notice is still on screen after 6 seconds', async ({ context }) => {
    const mock = newMock();
    mock.deleteBody = { error: false, data: true, push: { status: 'failed', message: MESSAGES.failed } };
    const page = await openTeachers(context, mock);
    await chooseTeacherItem(page, 'teacher.one', 'Delete');
    await popconfirm(page).locator('.ant-btn-primary').click();
    await expect(toasts(page)).toHaveText(MESSAGES.failed);
    await page.mouse.move(2, 2); // a notice under the pointer pauses its timer
    await page.waitForTimeout(6000);
    await expect(toasts(page)).toHaveText(MESSAGES.failed);
  });

  test('central\'s message is shown as sent, not replaced', async ({ context }) => {
    const mock = newMock();
    mock.deleteBody = { error: false, data: true, push: { status: 'failed', message: 'Invented central sentence.' } };
    const page = await openTeachers(context, mock);
    await chooseTeacherItem(page, 'teacher.one', 'Delete');
    await popconfirm(page).locator('.ant-btn-primary').click();
    await expect(toasts(page)).toHaveText('Invented central sentence.');
  });

  test('an answer without push shows a plain success notice; the row leaves; focus moves on', async ({ context }) => {
    const mock = newMock();
    mock.deleteBody = { error: false, data: true };
    const page = await openTeachers(context, mock);
    await chooseTeacherItem(page, 'teacher.one', 'Delete');
    await popconfirm(page).locator('.ant-btn-primary').click();
    await expect(row(page, 'teacher.one')).toHaveCount(0);
    await expect(toasts(page)).toHaveText('Teacher deleted.');
    await expect(notice(page).locator('.ant-notification-notice-icon-success')).toHaveCount(1);
    await expect.poll(() => focusedLabel(page)).toBe('Manage teacher.two');
  });
});
