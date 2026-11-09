import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { API_URL, BASE_URL } from '../fixtures/env';

/**
 * The Add teacher drawer on the Teachers screen and Sync Teachers on the Schools screen, in a browser, with every answer
 * from the API mocked: the sign-in is a token written to the session (no server is asked), and every request to the API
 * host is answered by a route here, following the contract of `GET student/username-available` (which covers teachers
 * too), `POST teacher/one` and `POST sync/cloud/:schoolname/teachers`. Nothing leaves the machine: any other host is
 * refused.
 *
 * Run it against a production or local build served on E2E_BASE_URL. The session keys and the API host are those of
 * that build's environment file: E2E_API_URL, and E2E_ACCESS_KEYS as "algKey,payloadKey,hashKey" (the local build's
 * keys are the defaults).
 */
const ACCESS_KEYS = (process.env.E2E_ACCESS_KEYS ?? 'lms_access_alg,lms_access_payload,lms_access_hash').split(',');
const PERMISSIONS = ['create_teacher', 'view_teacher', 'view_school', 'sync_students'];
const ADMIN_ROLE = 'zr5ER4QD';

const SCHOOL_A = { schoolid: 'school-a', schoolname: 'North Valley School' };
const SCHOOL_B = { schoolid: 'school-b', schoolname: 'South Hill School' };

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
function sessionToken(claims: object): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ lmsuserid: 'staff-1', lmsuserrole: ADMIN_ROLE, firstname: 'Test', lastname: 'Admin', permissions: PERMISSIONS, exp, iat: exp - 10, ...claims })}.c2ln`;
}

const json = (status: number, body: unknown) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const invalid = (fields: Array<{ field: string; message: string }>) =>
  json(400, { error: true, code: 'INVALID_INPUT', errormessage: "Some of the information isn't valid.", fields });

interface Mock {
  schools: Array<typeof SCHOOL_A>;
  /** username → taken? Any other username is free. */
  taken: Set<string>;
  availabilityCalls: string[];
  createAnswer: () => ReturnType<typeof json>;
  created: Array<Record<string, unknown>>;
  listCalls: number;
  syncAnswer: () => ReturnType<typeof json>;
  /** The decoded path of every sync request. */
  syncCalls: string[];
  unmocked: string[];
}

function newMock(): Mock {
  return {
    schools: [SCHOOL_A, SCHOOL_B],
    taken: new Set(['takenname']),
    availabilityCalls: [],
    createAnswer: () => json(201, { schooluserid: 'tu-1', schoolusername: 'dara1', push: { status: 'pushed', message: 'ok' } }),
    created: [],
    listCalls: 0,
    syncAnswer: () => json(200, { data: { status: 'pushed' } }),
    syncCalls: [],
    unmocked: [],
  };
}

async function signIn(context: BrowserContext, mock: Mock, claims: object, permissions?: string[], clipboardWrite = true): Promise<void> {
  await context.grantPermissions(clipboardWrite ? ['clipboard-read', 'clipboard-write'] : ['clipboard-read'], { origin: new URL(BASE_URL).origin }).catch(() => undefined);
  await context.addInitScript(
    ({ keys, token }) => {
      const [alg, payload, hash] = token.split('.');
      // Only a fresh tab gets the session: a reload within the test keeps what the app stored.
      if (!sessionStorage.getItem(keys[0])) {
        sessionStorage.setItem(keys[0], alg);
        sessionStorage.setItem(keys[1], payload);
        sessionStorage.setItem(keys[2], hash);
      }
    },
    { keys: ACCESS_KEYS, token: sessionToken(permissions ? { ...claims, permissions } : claims) },
  );
  // Anything that is not this app or its mocked API is refused.
  await context.route(
    (url) => url.origin !== new URL(BASE_URL).origin && url.origin !== new URL(API_URL).origin,
    (route) => route.abort(),
  );
  await context.route(`${API_URL}/**`, (route) => answer(route, mock));
}

async function openTeachers(
  context: BrowserContext,
  mock: Mock,
  claims: object = { isplatform: false, organisationid: 'org-1' },
  clipboardWrite = true,
): Promise<Page> {
  await signIn(context, mock, claims, undefined, clipboardWrite);
  const page = await context.newPage();
  await page.goto('/teacher/index');
  await expect(page.getByRole('button', { name: 'Upload Teachers' })).toBeVisible();
  return page;
}

async function openSchools(context: BrowserContext, mock: Mock, permissions?: string[]): Promise<Page> {
  await signIn(context, mock, { isplatform: false, organisationid: 'org-1' }, permissions);
  const page = await context.newPage();
  await page.goto('/school/index');
  await expect(page.getByRole('columnheader', { name: 'Tools' })).toBeVisible();
  await expect(page.locator('tr', { hasText: SCHOOL_A.schoolname })).toHaveCount(1);
  return page;
}

async function answer(route: Route, mock: Mock): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const path = decodeURIComponent(url.pathname).replace(/^\//, '');
  const method = request.method();
  if (method === 'OPTIONS') return route.fulfill({ status: 204 });
  if (method === 'GET' && path === 'student/username-available') {
    const name = url.searchParams.get('username') ?? '';
    mock.availabilityCalls.push(name);
    return route.fulfill(json(200, { available: !mock.taken.has(name) })).catch(() => undefined);
  }
  if (method === 'POST' && path === 'teacher/one') {
    mock.created.push(request.postDataJSON());
    return route.fulfill(mock.createAnswer());
  }
  if (method === 'POST' && /^sync\/cloud\/.+\/teachers$/.test(path)) {
    mock.syncCalls.push(path);
    return route.fulfill(mock.syncAnswer());
  }
  if (method === 'POST' && path === 'school') return route.fulfill(json(200, { data: { data: mock.schools, total: mock.schools.length } }));
  if (method === 'POST' && path === 'teacher') {
    mock.listCalls++;
    return route.fulfill(json(200, { data: { data: [], total: 0 } }));
  }
  mock.unmocked.push(`${method} ${path}`);
  return route.fulfill(json(200, { data: [] }));
}

const drawer = (page: Page) => page.getByRole('dialog', { name: /Add teacher|Teacher added/ });
const note = (page: Page) => page.getByTestId('username-note');
const toasts = (page: Page) => page.locator('.ant-notification-notice-description');
const errorOf = (page: Page, selector: string) => page.locator('.field', { has: page.locator(selector) }).locator('.field-error');
const save = (page: Page) => page.getByRole('button', { name: 'Add teacher', exact: true });

async function choose(page: Page, nzId: string, option: string): Promise<void> {
  await page.locator(`#${nzId.replace(/-input$/, '')} .ant-select-selector`).click();
  await page.locator('.ant-select-item-option', { hasText: option }).first().click();
}

async function openDrawer(page: Page): Promise<void> {
  await page.getByTestId('add-teacher').click();
  await expect(drawer(page)).toBeVisible();
  await expect(page.locator('#add-teacher-username')).toBeVisible();
}

/** Fill every field. Two schools are listed, so School is chosen. */
async function fillRequired(page: Page, username = 'dara1', password = 'riverlamp47'): Promise<void> {
  await page.locator('#add-teacher-username').fill(username);
  await page.locator('#add-teacher-password').fill(password);
  await choose(page, 'add-teacher-school-input', 'North Valley School');
}

test.describe('Add teacher drawer', () => {
  test('opens from the Teachers screen with Username, Password and School, and no field a teacher account does not store', async ({ context }) => {
    const mock = newMock();
    const page = await openTeachers(context, mock);
    await openDrawer(page);
    const form = drawer(page);
    await expect(form.getByRole('heading', { name: 'Add teacher', exact: true })).toBeVisible();
    for (const label of ['Username', 'Password', 'School']) {
      await expect(form.getByText(label, { exact: false }).first(), label).toBeVisible();
    }
    await expect(form.getByRole('button', { name: 'Generate' })).toBeVisible();
    await expect(form.getByRole('button', { name: 'Show' })).toBeVisible();
    await expect(form.getByRole('radio')).toHaveCount(0);
    const text = await form.innerText();
    for (const absent of ['First name', 'Last name', 'Class', 'Curriculum', 'Gender', 'Date of birth', 'learner']) {
      expect(text, `${absent} is not part of a teacher`).not.toContain(absent);
    }
    expect(mock.unmocked.filter((r) => !r.endsWith('/all'))).toEqual([]);
  });

  test('the button sits beside Upload Teachers, which stays', async ({ context }) => {
    const page = await openTeachers(context, newMock());
    await expect(page.getByTestId('add-teacher')).toHaveText('+ Add teacher');
    await expect(page.getByTestId('add-teacher')).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Upload Teachers' })).toBeEnabled();
  });

  test('says Available, Taken and the rule as the username is typed', async ({ context }) => {
    const mock = newMock();
    const page = await openTeachers(context, mock);
    await openDrawer(page);
    const username = page.locator('#add-teacher-username');
    await username.fill('dara1');
    await expect(note(page)).toHaveText('Available. Teachers use this to sign in on the app.');
    await expect(note(page)).toHaveAttribute('aria-live', 'polite');
    await username.fill('takenname');
    await expect(note(page)).toHaveText('That username is taken.');
    await username.fill('a');
    await expect(note(page)).toHaveText('Use 2 to 16 English letters or numbers.');
    expect(mock.availabilityCalls, 'only values the rule accepts are asked').toEqual(['dara1', 'takenname']);
  });

  test('Generate fills a two-word password with two digits, turns Show on, and Show hides it again', async ({ context }) => {
    const page = await openTeachers(context, newMock());
    await openDrawer(page);
    const password = page.locator('#add-teacher-password');
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Generate' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    expect(await password.inputValue()).toMatch(/^[a-z]+[a-z]+\d{2}$/);
    await page.getByRole('button', { name: 'Hide' }).click();
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('sends exactly three keys: the school, the username (trimmed) and the password', async ({ context }) => {
    const mock = newMock();
    const page = await openTeachers(context, mock);
    await openDrawer(page);
    await page.getByRole('button', { name: 'Generate' }).click();
    const generated = await page.locator('#add-teacher-password').inputValue();
    await page.locator('#add-teacher-username').fill('dara1 ');
    await choose(page, 'add-teacher-school-input', 'South Hill School');
    await save(page).click();
    await expect(page.getByTestId('done-username')).toBeVisible();
    expect(mock.created).toHaveLength(1);
    expect(mock.created[0]).toEqual({ schoolid: 'school-b', schoolusername: 'dara1', password: generated });
    expect(Object.keys(mock.created[0]).sort()).toEqual(['password', 'schoolid', 'schoolusername']);
  });

  test('the only school is preselected', async ({ context }) => {
    const mock = newMock();
    mock.schools = [SCHOOL_B];
    const page = await openTeachers(context, mock);
    await openDrawer(page);
    await expect(page.locator('#add-teacher-school .ant-select-selection-item')).toHaveText('South Hill School');
    await page.locator('#add-teacher-username').fill('dara1');
    await page.locator('#add-teacher-password').fill('riverlamp47');
    await save(page).click();
    await expect(page.getByTestId('done-username')).toBeVisible();
    expect(mock.created[0].schoolid).toBe('school-b');
  });

  test('shows the username and the password once, with Copy, then forgets the password on close', async ({ context }) => {
    const mock = newMock();
    const page = await openTeachers(context, mock);
    await openDrawer(page);
    await fillRequired(page);
    const listCallsBefore = mock.listCalls;
    await save(page).click();
    await expect(drawer(page).getByRole('heading', { name: 'Teacher added', exact: true })).toBeVisible();
    await expect(page.getByTestId('done-username')).toHaveText('dara1');
    await expect(page.getByTestId('done-password')).toHaveText('riverlamp47');
    await expect(page.getByTestId('done-notice')).toHaveText('Write it down or copy it now; it is not shown again.');
    await expect(page.locator('#add-teacher-password'), 'the form is gone').toHaveCount(0);
    expect(mock.listCalls, 'the teachers list was asked again').toBeGreaterThan(listCallsBefore);

    await page.getByRole('button', { name: 'Copy password' }).click();
    await expect(page.getByRole('button', { name: 'Copied password' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('riverlamp47');
    await page.getByRole('button', { name: 'Copy username' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('dara1');

    await page.getByRole('button', { name: 'Done' }).click();
    await expect(drawer(page)).toBeHidden();
    expect(await page.locator('body').innerText(), 'the password is nowhere on the page').not.toContain('riverlamp47');
    expect(await page.locator('body').innerHTML(), 'nor in its markup').not.toContain('riverlamp47');

    await openDrawer(page);
    await expect(page.locator('#add-teacher-username')).toHaveValue('');
    await expect(page.locator('#add-teacher-password')).toHaveValue('');
    await expect(page.getByTestId('done-password')).toHaveCount(0);
    expect(await page.locator('body').innerHTML()).not.toContain('riverlamp47');
  });

  for (const [status, text, tone] of [
    ['pushed', 'dara1 can sign in on the app now with these details.', 'ok'],
    ['failed', "dara1 can't sign in yet: the learning server did not answer. Run Sync Teachers for this school on the Schools screen.", 'warn'],
    ['skipped', 'dara1 can sign in once the learning server next syncs.', 'info'],
  ] as const) {
    test(`the done panel for a push that ${status} says so, in the panel and not in a toast`, async ({ context }) => {
      const mock = newMock();
      mock.createAnswer = () => json(201, { schooluserid: 'tu-1', schoolusername: 'dara1', push: { status, message: 'server words' } });
      const page = await openTeachers(context, mock);
      await openDrawer(page);
      await fillRequired(page);
      await save(page).click();
      await expect(page.getByTestId('done-outcome')).toHaveText(text);
      await expect(page.getByTestId('done-outcome')).toHaveClass(tone === 'warn' ? /warn/ : /^((?!warn).)*$/);
      await expect(page.getByTestId('done-username')).toHaveText('dara1');
      await expect(page.getByTestId('done-password')).toHaveText('riverlamp47');
      await page.waitForTimeout(300);
      expect(await page.locator('.ant-notification-notice').count(), 'no toast: the outcome is in the panel').toBe(0);
    });
  }

  test('after a save the heading takes focus and is described by the outcome line', async ({ context }) => {
    const page = await openTeachers(context, newMock());
    await openDrawer(page);
    await fillRequired(page);
    await save(page).click();
    const title = page.getByRole('heading', { name: 'Teacher added', exact: true });
    await expect(title).toBeFocused();
    await expect(title).toHaveAccessibleDescription('dara1 can sign in on the app now with these details.');
  });

  test('a 400 is shown under each field it names, in the API’s own words, and nothing is cleared', async ({ context }) => {
    const mock = newMock();
    const PASSWORD_SAYS = 'Use 8 to 32 characters with at least one letter and one number, and no spaces.';
    mock.createAnswer = () =>
      invalid([
        { field: 'schoolusername', message: 'That username is taken.' },
        { field: 'password', message: PASSWORD_SAYS },
        { field: 'schoolid', message: 'Choose an organisation.' },
      ]);
    const page = await openTeachers(context, mock);
    await openDrawer(page);
    await fillRequired(page);
    await save(page).click();
    await expect(note(page)).toHaveText('That username is taken.');
    await expect(errorOf(page, '#add-teacher-password')).toHaveText(PASSWORD_SAYS);
    await expect(errorOf(page, '#add-teacher-school')).toHaveText('Choose an organisation.');
    await expect(page.locator('#add-teacher-username')).toHaveValue('dara1');
    await expect(page.locator('#add-teacher-password')).toHaveValue('riverlamp47');
    await expect(save(page), 'Save is enabled again').toBeEnabled();
    expect(await toasts(page).count(), 'a validation failure is not a toast').toBe(0);
    // Editing a field takes its own message away and leaves the others.
    await page.locator('#add-teacher-password').fill('riverlamp48');
    await expect(errorOf(page, '#add-teacher-password')).toHaveCount(0);
    await expect(errorOf(page, '#add-teacher-school')).toHaveText('Choose an organisation.');
  });

  test('a generic 400 that names no field is said once at the top of the form (central names School for a missing organisation)', async ({ context }) => {
    const mock = newMock();
    mock.createAnswer = () => json(400, { error: true, code: 'INVALID_INPUT', errormessage: 'The request is not valid.' });
    const page = await openTeachers(context, mock);
    await openDrawer(page);
    await fillRequired(page);
    await save(page).click();
    await expect(drawer(page).locator('.form-error')).toHaveText('The request is not valid.');
    expect(await toasts(page).count()).toBe(0);
  });

  /** Opens the done panel for dara1 / riverlamp47. `stubs` runs in the page before the app, to refuse a copy route. */
  async function openDonePanel(context: BrowserContext, stubs?: () => void): Promise<Page> {
    if (stubs) await context.addInitScript(stubs);
    // A refusal test holds only clipboard-read, so the permission state matches the real failure ("denied").
    const page = await openTeachers(context, newMock(), undefined, !stubs);
    await openDrawer(page);
    await fillRequired(page);
    await save(page).click();
    await expect(page.getByTestId('done-username')).toHaveText('dara1');
    return page;
  }
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
  async function seedClipboard(page: Page, context: BrowserContext, refusing: boolean): Promise<string> {
    const sentinel = `sentinel-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    const origin = new URL(BASE_URL).origin;
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    await page.evaluate(
      (value) => {
        const real = (window as unknown as { __realWriteText?: (t: string) => Promise<void> }).__realWriteText;
        return (real ?? navigator.clipboard.writeText.bind(navigator.clipboard))(value);
      },
      sentinel,
    );
    if (refusing) {
      await context.clearPermissions();
      await context.grantPermissions(['clipboard-read'], { origin });
    }
    expect(await clipboardText(page), 'the sentinel is on the clipboard').toBe(sentinel);
    return sentinel;
  }

  test('Copy still works when the Clipboard API refuses the write: the password and the username reach the clipboard', async ({ context }) => {
    const page = await openDonePanel(context, refuseClipboardApi);
    await seedClipboard(page, context, true);
    await page.getByRole('button', { name: 'Copy password' }).click();
    await expect(page.getByRole('button', { name: 'Copied password' })).toBeVisible();
    await expect(page.getByText("The copy didn't work")).toHaveCount(0);
    expect(await clipboardText(page)).toBe('riverlamp47');
    await seedClipboard(page, context, true);
    await page.getByRole('button', { name: 'Copy username' }).click();
    await expect(page.getByRole('button', { name: 'Copied username' })).toBeVisible();
    expect(await clipboardText(page)).toBe('dara1');
    await expect(page.locator('textarea')).toHaveCount(0);
  });

  test('Copy says it did not work, and stays Copy, only when both copy routes fail', async ({ context }) => {
    const page = await openDonePanel(context, refuseBoth);
    const sentinel = await seedClipboard(page, context, true);
    await page.getByRole('button', { name: 'Copy password' }).click();
    await expect(page.getByText("The copy didn't work. Select the password and copy it by hand.")).toBeVisible();
    expect(await clipboardText(page), 'nothing was copied').toBe(sentinel);
    await expect(page.getByRole('button', { name: 'Copied password' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Copy username' }).click();
    await expect(page.getByText("The copy didn't work. Select the username and copy it by hand.")).toBeVisible();
    expect(await clipboardText(page), 'nothing was copied').toBe(sentinel);
    await expect(page.locator('textarea')).toHaveCount(0);
  });

  test('a 403 is said at the top of the form in the teacher’s words, not the learner’s', async ({ context }) => {
    const mock = newMock();
    mock.createAnswer = () => json(403, { error: true });
    const page = await openTeachers(context, mock);
    await openDrawer(page);
    await fillRequired(page);
    await save(page).click();
    await expect(drawer(page).locator('.form-error')).toHaveText("You don't have permission to add teachers.");
    expect(await drawer(page).innerText()).not.toContain('learner');
  });

  test('required fields are named before anything is sent, and the first empty one takes focus', async ({ context }) => {
    const mock = newMock();
    const page = await openTeachers(context, mock);
    await openDrawer(page);
    await save(page).click();
    await expect(errorOf(page, '#add-teacher-password')).toHaveText('Enter a password.');
    await expect(page.locator('#add-teacher-username')).toBeFocused();
    await expect(note(page)).toHaveText('Enter a username.');
    await expect(errorOf(page, '#add-teacher-school')).toHaveText('Choose a school.');
    expect(mock.created).toEqual([]);
  });

  test('closing asks "Discard this teacher?" once something is typed, and not before', async ({ context }) => {
    const page = await openTeachers(context, newMock());
    await openDrawer(page);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(drawer(page)).toHaveCount(0);
    await openDrawer(page);
    await page.locator('#add-teacher-username').fill('dara1');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Discard this teacher?')).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page.locator('#add-teacher-username')).toHaveValue('dara1');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(drawer(page)).toHaveCount(0);
    await openDrawer(page);
    await expect(page.locator('#add-teacher-username')).toHaveValue('');
  });

  test('the browser Back button closes the drawer completely: the password is gone and the next opening is empty', async ({ context }) => {
    const page = await openTeachers(context, newMock());
    await page.evaluate(() => history.pushState({}, '', location.href));
    await openDrawer(page);
    await fillRequired(page);
    await save(page).click();
    await expect(page.getByTestId('done-password')).toHaveText('riverlamp47');
    await page.goBack();
    await expect(drawer(page)).toHaveCount(0);
    await page.getByTestId('add-teacher').click();
    await expect(drawer(page)).toBeVisible();
    await expect(page.locator('#add-teacher-username')).toHaveValue('');
    await expect(page.locator('#add-teacher-password')).toHaveValue('');
    expect(await page.content()).not.toContain('riverlamp47');
  });

  test('in the platform view (no acting organisation) the button is disabled and no drawer opens', async ({ context }) => {
    const page = await openTeachers(context, newMock(), { isplatform: true, organisationid: null, lmsuserrole: 'Mapyr2Pw' });
    const button = page.getByTestId('add-teacher');
    await expect(button).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Upload Teachers' })).toBeDisabled();
    await button.click({ force: true }).catch(() => undefined);
    await expect(page.getByRole('dialog', { name: /Add teacher/ })).toHaveCount(0);
    const box = (await button.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('.ant-tooltip:not(.ant-tooltip-hidden)')).toContainText('Choose an organisation to act in');
  });

  test('without create_teacher there is no button', async ({ context }) => {
    const mock = newMock();
    await signIn(context, mock, { isplatform: false, organisationid: 'org-1' }, ['view_teacher', 'view_school']);
    const page = await context.newPage();
    await page.goto('/teacher/index');
    await expect(page.getByRole('columnheader', { name: 'Teacher User Name' })).toBeVisible();
    await expect(page.getByTestId('add-teacher')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Upload Teachers' })).toHaveCount(0);
  });

  test('screenshots for the review (only when E2E_SHOTS names a folder)', async ({ context }) => {
    test.skip(!process.env.E2E_SHOTS, 'set E2E_SHOTS to a folder to write them');
    const dir = process.env.E2E_SHOTS!;
    const page = await openTeachers(context, newMock());
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDrawer(page);
    await fillRequired(page);
    await page.getByRole('button', { name: 'Show' }).click();
    await expect(note(page)).toHaveText('Available. Teachers use this to sign in on the app.');
    await drawer(page).locator('.head').click(); // closes the open list
    await expect(page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')).toHaveCount(0);
    await page.screenshot({ path: `${dir}/add-teacher-form.png` });
    await save(page).click();
    await expect(page.getByTestId('done-outcome')).toBeVisible();
    await page.screenshot({ path: `${dir}/add-teacher-done.png` });
  });
});

test.describe('Sync Teachers on the Schools screen', () => {
  test('after the confirm it posts to the school’s teachers path and says it synced', async ({ context }) => {
    const mock = newMock();
    const page = await openSchools(context, mock);
    const row = page.locator('tr', { hasText: SCHOOL_A.schoolname });
    await expect(row.getByTestId('sync-students')).toBeVisible();
    await row.getByTestId('sync-teachers').click();
    await expect(page.getByText('Sure to sync?')).toBeVisible();
    expect(mock.syncCalls, 'nothing is sent before the confirm').toEqual([]);
    await page.locator('.ant-popover:not(.ant-popover-hidden) button', { hasText: 'OK' }).click();
    await expect(toasts(page)).toHaveText('North Valley School teachers synced successfully');
    expect(mock.syncCalls).toEqual(['sync/cloud/North Valley School/teachers']);
  });

  test('a school with no teachers shows the API’s own sentence as an error toast', async ({ context }) => {
    const mock = newMock();
    mock.syncAnswer = () => json(404, { error: true, errormessage: 'There are no teachers to sync.' });
    const page = await openSchools(context, mock);
    await page.locator('tr', { hasText: SCHOOL_A.schoolname }).getByTestId('sync-teachers').click();
    await page.locator('.ant-popover:not(.ant-popover-hidden) button', { hasText: 'OK' }).click();
    await expect(toasts(page)).toHaveText('There are no teachers to sync.');
    await expect(page.locator('.ant-notification-notice-message')).toHaveText('Error');
    expect(mock.syncCalls).toHaveLength(1);
  });

  test('Cancel on the confirm sends nothing', async ({ context }) => {
    const mock = newMock();
    const page = await openSchools(context, mock);
    await page.locator('tr', { hasText: SCHOOL_A.schoolname }).getByTestId('sync-teachers').click();
    await page.locator('.ant-popover:not(.ant-popover-hidden) button', { hasText: 'Cancel' }).click();
    await page.waitForTimeout(300);
    expect(mock.syncCalls).toEqual([]);
  });

  test('without the sync_students permission neither Sync button is offered', async ({ context }) => {
    const page = await openSchools(context, newMock(), ['view_school', 'view_teacher']);
    const row = page.locator('tr', { hasText: SCHOOL_A.schoolname });
    await expect(row.getByTestId('sync-teachers')).toHaveCount(0);
    await expect(row.getByTestId('sync-students')).toHaveCount(0);
  });
});
