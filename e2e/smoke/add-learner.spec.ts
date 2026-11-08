import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { API_URL, BASE_URL } from '../fixtures/env';

/**
 * The Add learner drawer on the Learners screen, in a browser, with every answer from the API mocked: the sign-in is a
 * token written to the session (no server is asked), and every request to the API host is answered by a route here,
 * following the contract of `GET student/username-available` and `POST student/one`. Nothing leaves the machine: any
 * other host is refused.
 *
 * Run it against a production or local build served on E2E_BASE_URL. The session keys and the API host are those of
 * that build's environment file: E2E_API_URL, and E2E_ACCESS_KEYS as "algKey,payloadKey,hashKey" (the local build's
 * keys are the defaults).
 */
const ACCESS_KEYS = (process.env.E2E_ACCESS_KEYS ?? 'lms_access_alg,lms_access_payload,lms_access_hash').split(',');
const PERMISSIONS = ['create_student', 'view_student', 'view_school', 'view_curriculum'];
const ADMIN_ROLE = 'zr5ER4QD';

const SCHOOL_A = { schoolid: 'school-a', schoolname: 'North Valley School' };
const SCHOOL_B = { schoolid: 'school-b', schoolname: 'South Hill School' };
const CLASSES: Record<string, Array<{ standardid: string; standardname: string }>> = {
  'school-a': [
    { standardid: 'class-a1', standardname: 'Class 1A' },
    { standardid: 'class-a2', standardname: 'Class 2A' },
  ],
  'school-b': [{ standardid: 'class-b1', standardname: 'Class 9B' }],
};
const CURRICULA: Record<string, Array<{ curriculumid: string; curriculumname: string }>> = {
  'school-a': [
    { curriculumid: 'cur-1', curriculumname: 'Reading Basics' },
    { curriculumid: 'cur-2', curriculumname: 'Number Skills' },
  ],
  'school-b': [{ curriculumid: 'cur-3', curriculumname: 'Science Starters' }],
};

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
  availabilityStatus: number;
  availabilityCalls: string[];
  createAnswer: () => ReturnType<typeof json>;
  created: Array<Record<string, unknown>>;
  listCalls: number;
  unmocked: string[];
}

function newMock(): Mock {
  return {
    schools: [SCHOOL_A, SCHOOL_B],
    taken: new Set(['takenname']),
    availabilityStatus: 200,
    availabilityCalls: [],
    createAnswer: () => json(201, { schooluserid: 'su-1', schoolusername: 'sokha1', studentname: 'Sokha Chan', push: { status: 'pushed', message: 'ok' } }),
    created: [],
    listCalls: 0,
    unmocked: [],
  };
}

async function openLearners(
  context: BrowserContext,
  mock: Mock,
  claims: object = { isplatform: false, organisationid: 'org-1' },
): Promise<Page> {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE_URL).origin }).catch(() => undefined);
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
    { keys: ACCESS_KEYS, token: sessionToken(claims) },
  );
  // Anything that is not this app or its mocked API is refused.
  await context.route(
    (url) => url.origin !== new URL(BASE_URL).origin && url.origin !== new URL(API_URL).origin,
    (route) => route.abort(),
  );
  await context.route(`${API_URL}/**`, (route) => answer(route, mock));
  const page = await context.newPage();
  await page.goto('/student/index');
  await expect(page.getByRole('button', { name: 'Upload Users' })).toBeVisible();
  return page;
}

async function answer(route: Route, mock: Mock): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname.replace(/^\//, '');
  const method = request.method();
  if (method === 'OPTIONS') return route.fulfill({ status: 204 });
  if (method === 'GET' && path === 'student/username-available') {
    const name = url.searchParams.get('username') ?? '';
    mock.availabilityCalls.push(name);
    if (mock.availabilityStatus !== 200) return route.fulfill(json(mock.availabilityStatus, { error: true }));
    return route.fulfill(json(200, { available: !mock.taken.has(name) }));
  }
  if (method === 'POST' && path === 'student/one') {
    mock.created.push(request.postDataJSON());
    return route.fulfill(mock.createAnswer());
  }
  if (method === 'POST' && path === 'school') return route.fulfill(json(200, { data: { data: mock.schools, total: mock.schools.length } }));
  if (method === 'POST' && path === 'student') {
    mock.listCalls++;
    return route.fulfill(json(200, { data: { data: [], total: 0 } }));
  }
  const standards = path.match(/^standard\/school\/(.+)$/);
  if (method === 'GET' && standards) return route.fulfill(json(200, { data: CLASSES[standards[1]] ?? [] }));
  const curricula = path.match(/^school\/(.+)\/curriculums$/);
  if (method === 'GET' && curricula) return route.fulfill(json(200, { data: CURRICULA[curricula[1]] ?? [] }));
  mock.unmocked.push(`${method} ${path}`);
  return route.fulfill(json(200, { data: [] }));
}

const drawer = (page: Page) => page.getByRole('dialog', { name: /Add learner|Learner added/ });
const note = (page: Page) => page.getByTestId('username-note');
const toasts = (page: Page) => page.locator('.ant-notification-notice-description');
/** The error line inside the field that holds `selector`. */
const errorOf = (page: Page, selector: string) => page.locator('.field', { has: page.locator(selector) }).locator('.field-error');

async function choose(page: Page, nzId: string, option: string): Promise<void> {
  await page.locator(`#${nzId.replace(/-input$/, '')} .ant-select-selector`).click();
  await page.locator('.ant-select-item-option', { hasText: option }).first().click();
}

async function openDrawer(page: Page): Promise<void> {
  await page.getByTestId('add-learner').click();
  await expect(drawer(page)).toBeVisible();
  await expect(page.locator('#add-learner-first')).toBeVisible();
}

/** Fill every required field. School A has two classes and two curricula, so each is chosen. */
async function fillRequired(page: Page, username = 'sokha1', password = 'riverlamp47'): Promise<void> {
  await page.locator('#add-learner-first').fill('Sokha');
  await page.locator('#add-learner-username').fill(username);
  await page.locator('#add-learner-password').fill(password);
  await choose(page, 'add-learner-school-input', 'North Valley School');
  await choose(page, 'add-learner-class-input', 'Class 1A');
  await choose(page, 'add-learner-curricula-input', 'Reading Basics');
  await page.keyboard.press('Escape');
  await page.getByRole('radio', { name: 'Female', exact: true }).check({ force: true });
}

test.describe('Add learner drawer', () => {
  test('opens from the Learners screen with the Account, Where and About fields and nothing for later slices', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openDrawer(page);
    const form = drawer(page);
    await expect(form.getByRole('heading', { name: 'Add learner', exact: true })).toBeVisible();
    for (const label of ['First name', 'Last name', 'Username', 'Password', 'School', 'Class', 'Curriculum', 'Date of birth']) {
      await expect(form.getByText(label, { exact: false }).first(), label).toBeVisible();
    }
    await expect(form.getByRole('radio')).toHaveCount(2);
    await expect(form.getByRole('radio', { name: 'Female', exact: true })).toBeVisible();
    await expect(form.getByRole('radio', { name: 'Male', exact: true })).toBeVisible();
    await expect(form.getByRole('button', { name: 'Generate' })).toBeVisible();
    await expect(form.getByRole('button', { name: 'Show' })).toBeVisible();
    const text = await form.innerText();
    for (const later of ['Profile questions', 'Washington', 'Non-binary', 'Prefer not to say', 'Teacher']) {
      expect(text, `${later} belongs to a later slice`).not.toContain(later);
    }
    // (The list's own search boxes ask `.../all`, in no fixed order; every other request is one this spec answers.)
    expect(mock.unmocked.filter((r) => !r.endsWith('/all'))).toEqual([]);
  });

  test('says Available, Taken and the rule as the username is typed, and a failed check blocks nothing', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openDrawer(page);
    const field = page.locator('#add-learner-username');
    await expect(note(page)).toHaveAttribute('aria-live', 'polite');

    await field.fill('sokha1');
    await expect(note(page)).toHaveText('Available. Learners use this to sign in.');
    await field.fill('takenname');
    await expect(note(page)).toHaveText('That username is taken.');
    await field.fill('a');
    await expect(note(page)).toHaveText('Use 2 to 16 letters and digits, with no spaces or symbols.');
    await field.fill('has space');
    await expect(note(page)).toHaveText('Use 2 to 16 letters and digits, with no spaces or symbols.');
    // Debounced: one request for the settled value, none for a value the rule already refuses.
    expect(mock.availabilityCalls).toEqual(['sokha1', 'takenname']);

    // A check that fails says nothing and a save still goes to the server.
    mock.availabilityStatus = 500;
    await field.fill('sokha2');
    await expect.poll(() => mock.availabilityCalls.length).toBe(3);
    await expect(note(page)).toHaveText('');
    await fillRequired(page, 'sokha2');
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(page.getByTestId('done-username')).toHaveText('sokha1');
    expect(mock.created).toHaveLength(1);
  });

  test('Generate fills a two-word password with two digits, turns Show on, and Show hides it again', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await openDrawer(page);
    const password = page.locator('#add-learner-password');
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Generate' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    const value = await password.inputValue();
    expect(value).toMatch(/^[a-z]{8,12}[0-9]{2}$/);
    await page.getByRole('button', { name: 'Hide' }).click();
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Generate' }).click();
    await expect(password).not.toHaveValue(value);
  });

  test('sends exactly the contract body, leaving out the optional keys when empty and including them when filled', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await fillRequired(page);
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(page.getByTestId('done-username')).toBeVisible();
    expect(mock.created).toHaveLength(1);
    expect(mock.created[0]).toEqual({
      schoolid: 'school-a',
      standard: 'class-a1',
      curriculumids: ['cur-1'],
      studentfirstname: 'Sokha',
      schoolusername: 'sokha1',
      password: 'riverlamp47',
      genderid: 2,
    });

    await page.getByRole('button', { name: 'Done' }).click();
    await openDrawer(page);
    await fillRequired(page, 'dara2', 'maplestone09');
    await page.locator('#add-learner-last').fill('  Chan ');
    await page.locator('#add-learner-dob').fill('2014-03-05');
    await page.getByRole('radio', { name: 'Male', exact: true }).check({ force: true });
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(page.getByTestId('done-username')).toBeVisible();
    expect(mock.created[1]).toEqual({
      schoolid: 'school-a',
      standard: 'class-a1',
      curriculumids: ['cur-1'],
      studentfirstname: 'Sokha',
      studentlastname: 'Chan',
      schoolusername: 'dara2',
      password: 'maplestone09',
      genderid: 1,
      dateofbirth: '2014-03-05',
    });
  });

  test('shows the username and the password once, with Copy, then forgets the password on close', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await fillRequired(page);
    const listCallsBefore = mock.listCalls;
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(page.getByTestId('done-username')).toHaveText('sokha1');
    await expect(page.getByTestId('done-password')).toHaveText('riverlamp47');
    await expect(page.getByTestId('done-notice')).toHaveText('Write it down or copy it now; it is not shown again.');
    await expect(page.locator('#add-learner-password'), 'the form is gone').toHaveCount(0);
    expect(mock.listCalls, 'the learners list was asked again').toBeGreaterThan(listCallsBefore);

    await page.getByRole('button', { name: 'Copy password' }).click();
    await expect(page.getByRole('button', { name: 'Copied password' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('riverlamp47');
    await page.getByRole('button', { name: 'Copy username' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('sokha1');

    await page.getByRole('button', { name: 'Done' }).click();
    await expect(drawer(page)).toBeHidden();
    expect(await page.locator('body').innerText(), 'the password is nowhere on the page').not.toContain('riverlamp47');
    expect(await page.locator('body').innerHTML(), 'nor in its markup').not.toContain('riverlamp47');

    await openDrawer(page);
    for (const id of ['first', 'last', 'username', 'password', 'dob']) {
      await expect(page.locator(`#add-learner-${id}`), id).toHaveValue('');
    }
    await expect(page.getByTestId('done-password')).toHaveCount(0);
    expect(await page.locator('body').innerHTML()).not.toContain('riverlamp47');
  });

  for (const [status, text, kind] of [
    ['pushed', 'Added. Sokha Chan can sign in now.', 'success'],
    ['failed', 'Added. The learning server did not answer: run Sync Students for this school on the Schools screen.', 'warning'],
    ['skipped', 'Added.', 'success'],
  ] as const) {
    test(`the toast for a push that ${status}`, async ({ context }) => {
      const mock = newMock();
      mock.createAnswer = () =>
        json(201, { schooluserid: 'su-1', schoolusername: 'sokha1', studentname: 'Sokha Chan', push: { status, message: `push ${status}` } });
      const page = await openLearners(context, mock);
      await openDrawer(page);
      await fillRequired(page);
      await page.getByRole('button', { name: 'Add learner', exact: true }).click();
      await expect(toasts(page)).toHaveText(text);
      await expect(page.locator(`.ant-notification-notice .anticon-${kind === 'warning' ? 'exclamation-circle' : 'check-circle'}`)).toHaveCount(1);
    });
  }

  test('a 400 is shown under the field it names, in the API’s own words, and nothing else is cleared', async ({ context }) => {
    const mock = newMock();
    const PASSWORD_SAYS = 'Use 8 to 32 characters with at least one letter and one number, and no spaces.';
    mock.createAnswer = () =>
      invalid([
        { field: 'schoolusername', message: 'That username is taken.' },
        { field: 'password', message: PASSWORD_SAYS },
        { field: 'standard', message: 'Choose a class of this school.' },
      ]);
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await fillRequired(page);
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(note(page)).toHaveText('That username is taken.');
    await expect(errorOf(page, '#add-learner-password')).toHaveText(PASSWORD_SAYS);
    await expect(errorOf(page, '#add-learner-class')).toHaveText('Choose a class of this school.');
    await expect(errorOf(page, '#add-learner-first')).toHaveCount(0);
    await expect(errorOf(page, '#add-learner-school')).toHaveCount(0);
    await expect(errorOf(page, '#add-learner-curricula')).toHaveCount(0);
    // Nothing was cleared.
    await expect(page.locator('#add-learner-first')).toHaveValue('Sokha');
    await expect(page.locator('#add-learner-username')).toHaveValue('sokha1');
    await expect(page.locator('#add-learner-password')).toHaveValue('riverlamp47');
    await expect(page.getByRole('radio', { name: 'Female', exact: true })).toBeChecked();
    await expect(page.getByRole('button', { name: 'Add learner', exact: true }), 'Save is enabled again').toBeEnabled();
    expect(await toasts(page).count(), 'a validation failure is not a toast').toBe(0);
    // Editing a field takes its own message away and leaves the others.
    await page.locator('#add-learner-password').fill('riverlamp48');
    await expect(errorOf(page, '#add-learner-password')).toHaveCount(0);
    await expect(errorOf(page, '#add-learner-class')).toHaveText('Choose a class of this school.');
  });

  test('a 400 that names no field (no organisation chosen) is said once at the top of the form', async ({ context }) => {
    const mock = newMock();
    mock.createAnswer = () => json(400, { error: true, code: 'INVALID_INPUT', errormessage: 'Choose an organisation.' });
    // (The body names no field here; the next test is the one central sends, naming School.)
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await fillRequired(page);
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(drawer(page).locator('.form-error')).toHaveText('Choose an organisation.');
    expect(await toasts(page).count()).toBe(0);
  });

  test('the “Choose an organisation.” 400 that names School is shown under School', async ({ context }) => {
    const mock = newMock();
    mock.createAnswer = () => invalid([{ field: 'schoolid', message: 'Choose an organisation.' }]);
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await fillRequired(page);
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(errorOf(page, '#add-learner-school')).toHaveText('Choose an organisation.');
    await expect(drawer(page).locator('.form-error')).toHaveCount(0);
  });

  test('names are limited to 45 characters, the first at least 2, and extra push keys are ignored', async ({ context }) => {
    const mock = newMock();
    mock.createAnswer = () =>
      json(201, {
        schooluserid: 'su-1', schoolusername: 'sokha1', studentname: 'Sokha Chan',
        push: { status: 'failed', message: 'x', cause: 'timeout', hint: 'retry', code: 'E1', reason: 'nocloud' },
      });
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await expect(page.locator('#add-learner-first')).toHaveAttribute('maxlength', '45');
    await expect(page.locator('#add-learner-last')).toHaveAttribute('maxlength', '45');
    await fillRequired(page);
    await page.locator('#add-learner-first').fill('S');
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(errorOf(page, '#add-learner-first')).toHaveText('Enter a name of 2 to 45 characters.');
    expect(mock.created).toEqual([]);
    await page.locator('#add-learner-first').fill('');
    await page.locator('#add-learner-first').pressSequentially('x'.repeat(60));
    expect(await page.locator('#add-learner-first').inputValue()).toHaveLength(45);
    await page.locator('#add-learner-first').fill('Sokha');
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(toasts(page)).toHaveText('Added. The learning server did not answer: run Sync Students for this school on the Schools screen.');
  });

  test('required fields are named before anything is sent, and the first empty one takes focus', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(errorOf(page, '#add-learner-first')).toHaveText('Enter a name of 2 to 45 characters.');
    await expect(page.locator('#add-learner-username')).toHaveAttribute('aria-invalid', 'true');
    await expect(note(page)).toHaveText('Enter a username.');
    await expect(errorOf(page, '#add-learner-password')).toHaveText('Enter a password.');
    await expect(errorOf(page, '#add-learner-school')).toHaveText('Choose a school.');
    await expect(errorOf(page, '#add-learner-class')).toHaveText('Choose a class.');
    await expect(errorOf(page, '#add-learner-curricula')).toHaveText('Choose at least one curriculum.');
    await expect(drawer(page).getByRole('radiogroup', { name: 'Gender' }).locator('xpath=..').locator('.field-error')).toHaveText('Choose Female or Male.');
    await expect(page.locator('#add-learner-first')).toBeFocused();
    expect(mock.created, 'nothing was sent').toEqual([]);
    await page.locator('#add-learner-first').fill('Sokha');
    await page.locator('#add-learner-username').fill('sokha1');
    await page.locator('#add-learner-password').fill('short1');
    await page.getByRole('button', { name: 'Add learner', exact: true }).click();
    await expect(errorOf(page, '#add-learner-password')).toHaveText('Use 8 to 32 characters with at least one letter and one number, and no spaces.');
    expect(mock.created).toEqual([]);
  });

  test('a school’s classes and curricula follow the school; changing the school empties them; one school or curriculum is preselected', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openDrawer(page);
    await expect(page.locator('#add-learner-class')).toHaveClass(/ant-select-disabled/);
    await choose(page, 'add-learner-school-input', 'North Valley School');
    await choose(page, 'add-learner-class-input', 'Class 2A');
    await choose(page, 'add-learner-curricula-input', 'Number Skills');
    await page.keyboard.press('Escape');
    await expect(page.locator('#add-learner-class .ant-select-selection-item')).toHaveText('Class 2A');
    await choose(page, 'add-learner-school-input', 'South Hill School');
    await expect(page.locator('#add-learner-class .ant-select-selection-item'), 'the class was reset').toHaveCount(0);
    // South Hill has one curriculum, so it is chosen for the person.
    await expect(page.locator('#add-learner-curricula .ant-select-selection-item-content')).toHaveText('Science Starters');
    await page.locator('#add-learner-class .ant-select-selector').click();
    await expect(page.locator('.ant-select-item-option')).toHaveText(['Class 9B']);

    // One school only: it is the school, with its single curriculum.
    const single = newMock();
    single.schools = [SCHOOL_B];
    const page2 = await openLearners(await page.context().browser()!.newContext({ baseURL: BASE_URL }), single);
    await openDrawer(page2);
    await expect(page2.locator('#add-learner-school .ant-select-selection-item')).toHaveText('South Hill School');
    await expect(page2.locator('#add-learner-curricula .ant-select-selection-item-content')).toHaveText('Science Starters');
  });

  test('in the platform view (no acting organisation) the button is disabled and no drawer opens', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock, { isplatform: true, organisationid: null, lmsuserrole: 'Mapyr2Pw' });
    const button = page.getByTestId('add-learner');
    await expect(button).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Upload Users' })).toBeDisabled();
    await button.click({ force: true }).catch(() => undefined);
    await expect(page.getByRole('dialog', { name: /Add learner/ })).toHaveCount(0);
    const box = (await button.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('.ant-tooltip:not(.ant-tooltip-hidden)')).toContainText('Choose an organisation to act in');
  });
});
