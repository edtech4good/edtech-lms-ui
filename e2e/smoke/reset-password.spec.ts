import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { passwordError } from '../../src/app/modules/student/add-learner/add-learner-form';
import { API_URL, BASE_URL } from '../fixtures/env';

/**
 * Reset password on the Learners and Teachers lists, in a browser, with every answer from the API mocked: the sign-in
 * is a token written to the session (no server is asked), and every request to the API host is answered by a route
 * here, following the contract of `PUT student/:schooluserid/password` and `PUT teacher/:schooluserid/password`.
 * Nothing leaves the machine: any other host is refused.
 *
 * Run it against a production or local build served on E2E_BASE_URL. The session keys and the API host are those of
 * that build's environment file: E2E_API_URL, and E2E_ACCESS_KEYS as "algKey,payloadKey,hashKey".
 */
const ACCESS_KEYS = (process.env.E2E_ACCESS_KEYS ?? 'lms_access_alg,lms_access_payload,lms_access_hash').split(',');
const WITH = ['view_student', 'update_student', 'view_teacher', 'update_teacher', 'delete_teacher', 'view_school'];
const WITHOUT = ['view_student', 'view_teacher', 'delete_teacher', 'view_school'];
const ADMIN_ROLE = 'zr5ER4QD';
const SHOTS = process.env.E2E_SHOTS_DIR;
const NEW_PASSWORD = 'riverlamp47';

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
  /** Answers a password request: given the kind, the id and the body. */
  answer: (kind: 'student' | 'teacher', id: string, body: { password?: string }) => ReturnType<typeof json>;
  requests: Array<{ method: string; path: string; body: unknown }>;
  /** Held until released, to see the state while a request runs. */
  hold?: Promise<void>;
  unmocked: string[];
}

function newMock(): Mock {
  return {
    learners: [learner(1, 'Dara'), learner(2, 'Sokha', true), learner(3, 'Maly')],
    teachers: [teacher(1, 'teacher.one'), teacher(2, 'teacher.two', true)],
    answer: (_kind, id) => json(200, { schooluserid: id, schoolusername: 'x', push: { status: 'pushed', message: 'ok' } }),
    requests: [],
    unmocked: [],
  };
}

async function signIn(context: BrowserContext, mock: Mock, permissions: string[], clipboardWrite = true): Promise<void> {
  await context.grantPermissions(clipboardWrite ? ['clipboard-read', 'clipboard-write'] : ['clipboard-read'], { origin: new URL(BASE_URL).origin }).catch(() => undefined);
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
  const passwordPath = /^(student|teacher)\/([^/]+)\/password$/.exec(path);
  if (method === 'PUT' && passwordPath) {
    const body = request.postDataJSON();
    mock.requests.push({ method, path, body });
    if (mock.hold) await mock.hold;
    return route.fulfill(mock.answer(passwordPath[1] as 'student' | 'teacher', passwordPath[2], body));
  }
  if (method === 'POST' && path === 'student') return route.fulfill(json(200, { data: { data: mock.learners, total: mock.learners.length } }));
  if (method === 'POST' && path === 'teacher') return route.fulfill(json(200, { data: { data: mock.teachers, total: mock.teachers.length } }));
  if (method === 'POST' && path === 'school') return route.fulfill(json(200, { data: { data: [], total: 0 } }));
  mock.unmocked.push(`${method} ${path}`);
  return route.fulfill(json(200, { data: [] }));
}

/**
 * A drawer that starts closed schedules a "restore focus" for 300 ms after the page loads (ng-zorro closes it once
 * on creation). A drawer opened inside that window loses focus to its opener, which no person can do; waiting it out
 * keeps these specs about the drawer and not about that timer.
 */
const settle = (page: Page) => page.waitForTimeout(600);

async function openLearners(context: BrowserContext, mock: Mock, permissions = WITH, clipboardWrite = true): Promise<Page> {
  await signIn(context, mock, permissions, clipboardWrite);
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/student/index');
  await expect(page.getByRole('columnheader', { name: 'Student Name' })).toBeVisible();
  await expect(page.locator('tbody tr', { hasText: 'dara1' })).toHaveCount(1);
  await settle(page);
  return page;
}
async function openTeachers(context: BrowserContext, mock: Mock, permissions = WITH, clipboardWrite = true): Promise<Page> {
  await signIn(context, mock, permissions, clipboardWrite);
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/teacher/index');
  await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
  await expect(page.locator('tbody tr', { hasText: 'teacher.one' })).toHaveCount(1);
  await settle(page);
  return page;
}

const row = (page: Page, text: string) => page.locator('tbody tr', { hasText: text });
const toasts = (page: Page) => page.locator('.ant-notification-notice-description');
const actions = (page: Page, username: string) => page.getByRole('button', { name: `Manage ${username}`, exact: true });
const menuItem = (page: Page, name: string) => page.getByRole('menuitem', { name, exact: true });
const drawer = (page: Page) => page.getByRole('dialog', { name: /^(Reset password|Password changed)$/ });
const passwordField = (page: Page) => drawer(page).locator('#reset-password-input');
const save = (page: Page) => drawer(page).getByRole('button', { name: /^(Save|Saving…)$/ });
const focusedLabel = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName ?? '');

/** Central's two real sentences for a push that failed: the learning server did not answer, or it lacks the class or curriculum. */
const SYNC_MESSAGE = "The password was saved, but the learning server did not answer. Run Sync Students for this school on the Schools screen.";
const MISSING_MESSAGE = "Saved, but the learning server doesn't have this class or curriculum yet. Run Sync Content, then Sync Students for this school.";

type Where = { kind: 'learner' | 'teacher'; username: string; id: string; path: string };
const LEARNER: Where = { kind: 'learner', username: 'dara1', id: 'lu-1', path: 'student/lu-1/password' };
const TEACHER: Where = { kind: 'teacher', username: 'teacher.one', id: 'tu-1', path: 'teacher/tu-1/password' };

/** Opens the Reset password drawer for a row by mouse. */
async function openDrawer(page: Page, where: Where): Promise<void> {
  await actions(page, where.username).click();
  await menuItem(page, 'Reset password').click();
  await expect(drawer(page).getByRole('heading', { name: 'Reset password', exact: true })).toBeVisible();
}
async function saveNew(page: Page, password = NEW_PASSWORD): Promise<void> {
  await passwordField(page).fill(password);
  await save(page).click();
}

for (const where of [LEARNER, TEACHER]) {
  const open = (context: BrowserContext, mock: Mock, permissions = WITH, clipboardWrite = true) =>
    where.kind === 'learner' ? openLearners(context, mock, permissions, clipboardWrite) : openTeachers(context, mock, permissions, clipboardWrite);
  const control = (page: Page) => actions(page, where.username);
  const syncWord = where.kind === 'learner' ? 'Sync Students' : 'Sync Teachers';

  test.describe(`Reset password: ${where.kind}`, () => {
    test('the drawer names the account, asks for a password, and Save sends the exact request', async ({ context }) => {
      const mock = newMock();
      const page = await open(context, mock);
      await openDrawer(page, where);
      await expect(page.getByTestId('reset-username')).toHaveText(where.username);
      await expect(passwordField(page)).toHaveValue('');
      await expect(passwordField(page)).toHaveAttribute('type', 'password');
      await expect(drawer(page).getByText('8 to 32 characters with at least one letter and one number.')).toBeVisible();
      expect(mock.requests, 'nothing is sent by opening it').toEqual([]);
      await saveNew(page);
      await expect(page.getByTestId('reset-password-done')).toBeVisible();
      expect(mock.requests).toEqual([{ method: 'PUT', path: where.path, body: { password: NEW_PASSWORD } }]);
      expect(Object.keys(mock.requests[0].body as object)).toEqual(['password']);
    });

    test('Show reveals the password and Hide hides it again', async ({ context }) => {
      const page = await open(context, newMock());
      await openDrawer(page, where);
      await passwordField(page).fill(NEW_PASSWORD);
      await drawer(page).getByRole('button', { name: 'Show' }).click();
      await expect(passwordField(page)).toHaveAttribute('type', 'text');
      await drawer(page).getByRole('button', { name: 'Hide' }).click();
      await expect(passwordField(page)).toHaveAttribute('type', 'password');
    });

    test('Generate fills a valid password, shows it, and Save sends exactly that password', async ({ context }) => {
      const mock = newMock();
      const page = await open(context, mock);
      await openDrawer(page, where);
      await drawer(page).getByRole('button', { name: 'Generate' }).click();
      await expect(passwordField(page)).toHaveAttribute('type', 'text');
      const generated = await passwordField(page).inputValue();
      expect(passwordError(generated), `the generated password ${generated.length} characters long passes the rule`).toBeNull();
      await save(page).click();
      await expect(page.getByTestId('done-password')).toHaveText(generated);
      expect(mock.requests).toEqual([{ method: 'PUT', path: where.path, body: { password: generated } }]);
    });

    test('a password that breaks the rule is refused before anything is sent', async ({ context }) => {
      const mock = newMock();
      const page = await open(context, mock);
      await openDrawer(page, where);
      await saveNew(page, 'short1');
      await expect(drawer(page).getByRole('alert')).toHaveText('Use 8 to 32 characters with at least one letter and one number, and no spaces.');
      await expect(passwordField(page)).toHaveAttribute('aria-invalid', 'true');
      await expect(passwordField(page)).toBeFocused();
      expect(mock.requests).toEqual([]);
    });

    test('the once-shown panel: username and password, each with Copy, the warning, and the pushed line', async ({ context }) => {
      const mock = newMock();
      const page = await open(context, mock);
      await openDrawer(page, where);
      await saveNew(page);
      await expect(drawer(page).getByRole('heading', { name: 'Password changed', exact: true })).toBeVisible();
      await expect(page.getByTestId('done-username')).toHaveText(where.username);
      await expect(page.getByTestId('done-password')).toHaveText(NEW_PASSWORD);
      await expect(page.getByTestId('done-notice')).toHaveText('Write it down or copy it now; it is not shown again.');
      await expect(page.getByTestId('done-outcome')).toHaveText(`${where.username} can sign in with the new password now. Anyone signed in with the old one has been signed out.`);
      await expect(passwordField(page), 'the form is gone').toHaveCount(0);
      await page.getByRole('button', { name: 'Copy password' }).click();
      await expect(page.getByRole('button', { name: 'Copied password' })).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(NEW_PASSWORD);
      await page.getByRole('button', { name: 'Copy username' }).click();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(where.username);
    });

    if (where.kind === 'learner') {
      for (const message of [SYNC_MESSAGE, MISSING_MESSAGE]) {
        test(`a failed push shows central's own sentence: ${message.slice(0, 40)}`, async ({ context }) => {
          const mock = newMock();
          mock.answer = (_k, id) => json(200, { schooluserid: id, schoolusername: 'x', push: { status: 'failed', message } });
          const page = await open(context, mock);
          await openDrawer(page, where);
          await saveNew(page);
          await expect(page.getByTestId('done-outcome')).toHaveText(`The old password still works on the learning server. ${message}`);
          await expect(page.getByTestId('done-password')).toHaveText(NEW_PASSWORD);
        });
      }
    }

    for (const [status, line] of [
      ['failed', `The learning server did not answer, so the old password still works there. Run ${syncWord} for this school on the Schools screen.`],
      ['skipped', 'The learning server gets the new password at its next sync.'],
    ] as const) {
      test(`a ${status} push still shows the password once and says what to do`, async ({ context }) => {
        const mock = newMock();
        mock.answer = (_k, id) => json(200, { schooluserid: id, schoolusername: 'x', push: { status, ...(status === 'failed' && where.kind === 'learner' ? {} : { message: 'm' }) } });
        const page = await open(context, mock);
        await openDrawer(page, where);
        await saveNew(page);
        await expect(page.getByTestId('done-outcome')).toHaveText(line);
        await expect(page.getByTestId('done-password')).toHaveText(NEW_PASSWORD);
      });
    }

    test('an answer with no push status gets the neutral line', async ({ context }) => {
      const mock = newMock();
      mock.answer = (_k, id) => json(200, { schooluserid: id });
      const page = await open(context, mock);
      await openDrawer(page, where);
      await saveNew(page);
      await expect(page.getByTestId('done-outcome')).toHaveText(`${where.username}'s password was changed.`);
    });

    test('a 400 on the password is shown under Password, with the password kept and no toast', async ({ context }) => {
      const mock = newMock();
      mock.answer = () => json(400, { error: true, code: 'INVALID_INPUT', errormessage: 'Invalid input', fields: [{ field: 'password', message: 'That password is too common. Choose another.' }] });
      const page = await open(context, mock);
      await openDrawer(page, where);
      await saveNew(page);
      await expect(drawer(page).locator('#reset-password-error')).toHaveText('That password is too common. Choose another.');
      await expect(passwordField(page)).toHaveValue(NEW_PASSWORD);
      await expect(passwordField(page)).toBeFocused();
      await expect(page.getByTestId('reset-password-done')).toHaveCount(0);
      expect(await toasts(page).count()).toBe(0);
      await passwordField(page).fill('otherlamp48');
      await expect(drawer(page).locator('#reset-password-error'), 'typing clears it').toHaveCount(0);
    });

    test('a 400 with no organisation chosen is said at the top of the form', async ({ context }) => {
      const mock = newMock();
      mock.answer = () => json(400, { error: true, code: 'INVALID_INPUT', errormessage: 'Choose an organisation.', fields: [{ field: 'schooluserid', message: 'Choose an organisation.' }] });
      const page = await open(context, mock);
      await openDrawer(page, where);
      await saveNew(page);
      await expect(drawer(page).locator('.form-error')).toHaveText('Choose an organisation.');
      expect(await toasts(page).count()).toBe(0);
    });

    test('a 404 is said at the top of the form', async ({ context }) => {
      const mock = newMock();
      mock.answer = () => json(404, { error: true, errormessage: 'Not found' });
      const page = await open(context, mock);
      await openDrawer(page, where);
      await saveNew(page);
      await expect(drawer(page).locator('.form-error')).toHaveText('That account no longer exists. Close this and try again.');
    });

    test('Save is disabled while the request runs, and a second press sends nothing', async ({ context }) => {
      const mock = newMock();
      let release!: () => void;
      mock.hold = new Promise<void>((resolve) => (release = resolve));
      const page = await open(context, mock);
      await openDrawer(page, where);
      await saveNew(page);
      await expect.poll(() => mock.requests.length).toBe(1);
      await expect(save(page)).toBeDisabled();
      await expect(save(page)).toHaveText('Saving…');
      await save(page).click({ force: true });
      await page.waitForTimeout(300);
      expect(mock.requests, 'one request only').toHaveLength(1);
      release();
      await expect(page.getByTestId('done-password')).toHaveText(NEW_PASSWORD);
    });

    test('a disabled account is told so, and stays disabled in the list after the reset', async ({ context }) => {
      const mock = newMock();
      const disabledWhere: Where =
        where.kind === 'learner'
          ? { kind: 'learner', username: 'sokha2', id: 'lu-2', path: 'student/lu-2/password' }
          : { kind: 'teacher', username: 'teacher.two', id: 'tu-2', path: 'teacher/tu-2/password' };
      const page = await open(context, mock);
      await openDrawer(page, disabledWhere);
      await expect(page.getByTestId('disabled-note')).toHaveText("This account is disabled. It can't sign in until you enable it.");
      await saveNew(page);
      await expect(page.getByTestId('done-password')).toHaveText(NEW_PASSWORD);
      await expect(page.getByTestId('done-outcome')).toHaveText(`${disabledWhere.username} can sign in with the new password once you enable the account. Anyone signed in with the old one has been signed out.`);
      expect(mock.requests).toEqual([{ method: 'PUT', path: disabledWhere.path, body: { password: NEW_PASSWORD } }]);
      await drawer(page).getByRole('button', { name: 'Done' }).click();
      await expect(drawer(page)).toBeHidden();
      await expect(row(page, disabledWhere.username).getByTestId('disabled-tag')).toHaveText('Disabled');
    });

    test('an answer that arrives after the drawer was closed and reopened is not shown or kept', async ({ context }) => {
      const mock = newMock();
      let release!: () => void;
      mock.hold = new Promise<void>((resolve) => (release = resolve));
      const page = await open(context, mock);
      await openDrawer(page, where);
      await saveNew(page);
      await expect.poll(() => mock.requests.length).toBe(1);
      // The browser's Back closes the drawer while the save is still running.
      await page.evaluate(() => {
        history.pushState({}, '', location.pathname + '?back=1');
        history.back();
      });
      await expect(drawer(page)).toBeHidden();
      await openDrawer(page, where);
      await expect(passwordField(page)).toHaveValue('');
      release();
      await page.waitForTimeout(600);
      await expect(page.getByTestId('reset-password-done'), 'the old answer does not turn the new drawer into a done panel').toHaveCount(0);
      await expect(passwordField(page)).toHaveValue('');
      expect(await page.locator('body').innerText(), 'the password is nowhere on the page').not.toContain(NEW_PASSWORD);
    });

    test('an answer that arrives while the drawer is still closed is not kept: reopening starts empty', async ({ context }) => {
      const mock = newMock();
      let release!: () => void;
      mock.hold = new Promise<void>((resolve) => (release = resolve));
      const page = await open(context, mock);
      await openDrawer(page, where);
      await saveNew(page);
      await expect.poll(() => mock.requests.length).toBe(1);
      await page.evaluate(() => {
        history.pushState({}, '', location.pathname + '?back=1');
        history.back();
      });
      await expect(drawer(page)).toBeHidden();
      release();
      await page.waitForTimeout(600);
      await openDrawer(page, where);
      await expect(passwordField(page)).toHaveValue('');
      await expect(page.getByTestId('reset-password-done')).toHaveCount(0);
      expect(await page.locator('body').innerText(), 'the password is nowhere on the page').not.toContain(NEW_PASSWORD);
    });

    test('a refusal that arrives after close and reopen is not shown in the new drawer', async ({ context }) => {
      const mock = newMock();
      mock.answer = () => json(400, { error: true, code: 'INVALID_INPUT', errormessage: 'Invalid input', fields: [{ field: 'password', message: 'That password is too common. Choose another.' }] });
      let release!: () => void;
      mock.hold = new Promise<void>((resolve) => (release = resolve));
      const page = await open(context, mock);
      await openDrawer(page, where);
      await saveNew(page);
      await expect.poll(() => mock.requests.length).toBe(1);
      await page.evaluate(() => {
        history.pushState({}, '', location.pathname + '?back=1');
        history.back();
      });
      await expect(drawer(page)).toBeHidden();
      await openDrawer(page, where);
      release();
      await page.waitForTimeout(600);
      await expect(drawer(page).locator('#reset-password-error')).toHaveCount(0);
      await expect(passwordField(page)).toHaveValue('');
    });

    test('an enabled account shows no disabled note', async ({ context }) => {
      const page = await open(context, newMock());
      await openDrawer(page, where);
      await expect(page.getByTestId('disabled-note')).toHaveCount(0);
    });

    test('Cancel closes without sending, and reopening starts empty', async ({ context }) => {
      const mock = newMock();
      const page = await open(context, mock);
      await openDrawer(page, where);
      await passwordField(page).fill(NEW_PASSWORD);
      await drawer(page).getByRole('button', { name: 'Show' }).click();
      await drawer(page).getByRole('button', { name: 'Cancel' }).click();
      await expect(drawer(page)).toBeHidden();
      expect(mock.requests).toEqual([]);
      await openDrawer(page, where);
      await expect(passwordField(page)).toHaveValue('');
      await expect(passwordField(page), 'Show is reset too').toHaveAttribute('type', 'password');
    });

    test('Done clears the password from the page; reopening shows an empty form and no trace of it', async ({ context }) => {
      const page = await open(context, newMock());
      await openDrawer(page, where);
      await saveNew(page);
      await expect(page.getByTestId('done-password')).toHaveText(NEW_PASSWORD);
      await drawer(page).getByRole('button', { name: 'Done' }).click();
      await expect(drawer(page)).toBeHidden();
      expect(await page.locator('body').innerText(), 'the password is nowhere on the page').not.toContain(NEW_PASSWORD);
      await openDrawer(page, where);
      await expect(passwordField(page)).toHaveValue('');
      await expect(page.getByTestId('reset-password-done')).toHaveCount(0);
      expect(await page.locator('body').innerText()).not.toContain(NEW_PASSWORD);
    });

    test('the drawer names the row it was opened for, not the previous one', async ({ context }) => {
      const page = await open(context, newMock());
      await openDrawer(page, where);
      await drawer(page).getByRole('button', { name: 'Cancel' }).click();
      await expect(drawer(page)).toBeHidden();
      const other: Where =
        where.kind === 'learner'
          ? { kind: 'learner', username: 'maly3', id: 'lu-3', path: 'student/lu-3/password' }
          : { kind: 'teacher', username: 'teacher.two', id: 'tu-2', path: 'teacher/tu-2/password' };
      await openDrawer(page, other);
      await expect(page.getByTestId('reset-username')).toHaveText(other.username);
    });

    for (const how of ['Cancel', 'Escape', 'Done', 'Close'] as const) {
      test(`focus returns to the row's Manage button after ${how}`, async ({ context }) => {
        const page = await open(context, newMock());
        await openDrawer(page, where);
        if (how === 'Done') await saveNew(page);
        await expect(passwordField(page).or(page.getByTestId('done-password'))).toBeVisible();
        if (how === 'Escape') await page.keyboard.press('Escape');
        else await drawer(page).getByRole('button', { name: how === 'Close' ? 'Close' : how, exact: true }).click();
        await expect(drawer(page)).toBeHidden();
        await expect.poll(() => focusedLabel(page)).toBe(`Manage ${where.username}`);
      });
    }

    test('a click on the mask closes the drawer', async ({ context }) => {
      const mock = newMock();
      const page = await open(context, mock);
      await openDrawer(page, where);
      await page.mouse.click(100, 450);
      await expect(drawer(page)).toBeHidden();
      expect(mock.requests).toEqual([]);
    });

    test('keyboard only: from the row to Save and the once-shown password', async ({ context }) => {
      const mock = newMock();
      const page = await open(context, mock);
      const button = actions(page, where.username);
      await button.focus();
      await page.keyboard.press('Enter');
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      // Focus opens on the first item: Edit details for a learner (Reset password is the next), Reset password for a teacher.
      if (where.kind === 'learner') {
        await expect(menuItem(page, 'Edit details')).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(menuItem(page, 'Move to another school')).toBeFocused();
        await page.keyboard.press('Tab');
      }
      await expect(menuItem(page, 'Reset password')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(drawer(page).getByRole('heading', { name: 'Reset password', exact: true })).toBeVisible();
      await expect(passwordField(page)).toBeFocused();
      await page.keyboard.type(NEW_PASSWORD);
      await page.keyboard.press('Tab');
      await expect(drawer(page).getByRole('button', { name: 'Generate' })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(drawer(page).getByRole('button', { name: 'Show' })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(drawer(page).getByRole('button', { name: 'Cancel' })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(save(page)).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('done-password')).toHaveText(NEW_PASSWORD);
      expect(mock.requests).toEqual([{ method: 'PUT', path: where.path, body: { password: NEW_PASSWORD } }]);
      await expect(drawer(page).getByRole('heading', { name: 'Password changed' })).toBeFocused();
      // Forward from the heading: Copy username, Copy password, Done (the Close button is behind the heading).
      for (let i = 0; i < 8 && !(await drawer(page).getByRole('button', { name: 'Done' }).evaluate((el) => el === document.activeElement)); i++) {
        await page.keyboard.press('Tab');
      }
      await expect(drawer(page).getByRole('button', { name: 'Done' })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(drawer(page)).toBeHidden();
      await expect.poll(() => focusedLabel(page)).toBe(`Manage ${where.username}`);
    });

    test('without the update permission there is no way to open it', async ({ context }) => {
      const page = await open(context, newMock(), WITHOUT);
      if (where.kind === 'learner') {
        await expect(page.getByRole('button', { name: /^Manage / })).toHaveCount(0);
      } else {
        // A teacher's menu is still there for Delete (delete_teacher is held), but it offers no Reset password.
        await actions(page, where.username).click();
        await expect(menuItem(page, 'Delete')).toBeVisible();
        await expect(menuItem(page, 'Reset password')).toHaveCount(0);
      }
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });
  });
}

test.describe('Reset password: the Learners menu', () => {
  test('Reset password is the item above Disable or Enable', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await actions(page, 'dara1').click();
    await expect(page.getByRole('menuitem')).toHaveText(['Edit details', 'Move to another school', 'Reset password', 'Disable']);
    await page.keyboard.press('Escape');
    await actions(page, 'sokha2').click();
    await expect(page.getByRole('menuitem')).toHaveText(['Edit details', 'Move to another school', 'Reset password', 'Enable']);
  });

  test('Space on the item opens the drawer, and the menu closes', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await actions(page, 'dara1').focus();
    await page.keyboard.press('Enter');
    await expect(menuItem(page, 'Edit details')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menuItem(page, 'Move to another school')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menuItem(page, 'Reset password')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(drawer(page).getByRole('heading', { name: 'Reset password', exact: true })).toBeVisible();
    await expect(menuItem(page, 'Disable')).toHaveCount(0);
  });

  test('Disable still asks first and sends its own request', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await actions(page, 'dara1').click();
    await menuItem(page, 'Disable').click();
    await expect(page.locator('.ant-popover-inner')).toContainText('Disable dara1?');
    expect(mock.requests).toEqual([]);
  });

  test('screenshots: the drawer, then the once-shown panel', async ({ context }) => {
    test.skip(!SHOTS, 'E2E_SHOTS_DIR not set');
    const page = await openLearners(context, newMock());
    await openDrawer(page, { kind: 'learner', username: 'sokha2', id: 'lu-2', path: 'student/lu-2/password' });
    await passwordField(page).fill(NEW_PASSWORD);
    await drawer(page).getByRole('button', { name: 'Show' }).click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SHOTS}/reset-form.png` });
    await save(page).click();
    await expect(page.getByTestId('done-password')).toHaveText(NEW_PASSWORD);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/reset-done.png` });
  });
});

test.describe('Reset password: the Teachers menu', () => {
  test('each Manage button names its teacher, and its menu offers Reset password, Disable or Enable and Delete', async ({ context }) => {
    const page = await openTeachers(context, newMock());
    await expect(actions(page, 'teacher.one')).toBeVisible();
    await expect(actions(page, 'teacher.two')).toBeVisible();
    await actions(page, 'teacher.one').click();
    await expect(menuItem(page, 'Reset password')).toBeVisible();
    await expect(menuItem(page, 'Disable')).toBeVisible();
    await expect(menuItem(page, 'Delete')).toBeVisible();
    await page.keyboard.press('Escape');
    await actions(page, 'teacher.two').click();
    await expect(menuItem(page, 'Enable')).toBeVisible();
  });
});

/** Copy when the browser refuses the Clipboard API, as add-teacher.spec.ts does it. */
test.describe('Reset password: Copy when the clipboard is refused', () => {
  const refuseClipboardApi = () => {
    (window as unknown as { __realWriteText: (t: string) => Promise<void> }).__realWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: () => Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError')),
    });
  };
  // (Each stub is serialised into the page on its own, so it cannot call the other.)
  const refuseBoth = () => {
    (window as unknown as { __realWriteText: (t: string) => Promise<void> }).__realWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: () => Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError')),
    });
    document.execCommand = () => false;
  };
  const clipboardText = (page: Page) => page.evaluate(() => navigator.clipboard.readText());
  /** Writes a random sentinel to the shared headless clipboard first, so a read-back cannot pass on an old value. */
  async function seedClipboard(page: Page, context: BrowserContext): Promise<string> {
    const sentinel = `sentinel-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    const origin = new URL(BASE_URL).origin;
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    await page.evaluate((value) => {
      const real = (window as unknown as { __realWriteText?: (t: string) => Promise<void> }).__realWriteText;
      return (real ?? navigator.clipboard.writeText.bind(navigator.clipboard))(value);
    }, sentinel);
    await context.clearPermissions();
    await context.grantPermissions(['clipboard-read'], { origin });
    expect(await clipboardText(page), 'the sentinel is on the clipboard').toBe(sentinel);
    return sentinel;
  }
  async function openDone(context: BrowserContext, where: Where, stubs: () => void): Promise<Page> {
    await context.addInitScript(stubs);
    const page = where.kind === 'learner' ? await openLearners(context, newMock(), WITH, false) : await openTeachers(context, newMock(), WITH, false);
    await openDrawer(page, where);
    await saveNew(page);
    await expect(page.getByTestId('done-password')).toHaveText(NEW_PASSWORD);
    return page;
  }

  for (const where of [LEARNER, TEACHER]) {
    test(`${where.kind}: Copy still works when the Clipboard API refuses the write`, async ({ context }) => {
      const page = await openDone(context, where, refuseClipboardApi);
      await seedClipboard(page, context);
      await page.getByRole('button', { name: 'Copy password' }).click();
      await expect(page.getByRole('button', { name: 'Copied password' })).toBeVisible();
      await expect(page.getByText("The copy didn't work")).toHaveCount(0);
      expect(await clipboardText(page)).toBe(NEW_PASSWORD);
      await seedClipboard(page, context);
      await page.getByRole('button', { name: 'Copy username' }).click();
      await expect(page.getByRole('button', { name: 'Copied username' })).toBeVisible();
      expect(await clipboardText(page)).toBe(where.username);
      await expect(page.locator('textarea')).toHaveCount(0);
    });

    test(`${where.kind}: Copy says it did not work, and stays Copy, only when both routes fail`, async ({ context }) => {
      const page = await openDone(context, where, refuseBoth);
      const sentinel = await seedClipboard(page, context);
      await page.getByRole('button', { name: 'Copy password' }).click();
      await expect(page.getByText("The copy didn't work. Select the password and copy it by hand.")).toBeVisible();
      expect(await clipboardText(page), 'nothing was copied').toBe(sentinel);
      await expect(page.getByRole('button', { name: 'Copied password' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Copy username' }).click();
      await expect(page.getByText("The copy didn't work. Select the username and copy it by hand.")).toBeVisible();
      expect(await clipboardText(page), 'nothing was copied').toBe(sentinel);
      await expect(page.locator('textarea')).toHaveCount(0);
    });
  }
});
