import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { API_URL, BASE_URL } from '../fixtures/env';

/**
 * Edit details on the Learners list, in a browser, with every answer from the API mocked: the sign-in is a token written
 * to the session (no server is asked), and every request to the API host is answered by a route here, following the
 * contract of `GET student/:schooluserid/details` and `PUT student/:schooluserid/details`. Nothing leaves the machine:
 * any other host is refused.
 *
 * Run it against a production or local build served on E2E_BASE_URL. The session keys and the API host are those of
 * that build's environment file: E2E_API_URL, and E2E_ACCESS_KEYS as "algKey,payloadKey,hashKey".
 */
const ACCESS_KEYS = (process.env.E2E_ACCESS_KEYS ?? 'lms_access_alg,lms_access_payload,lms_access_hash').split(',');
const WITH = ['view_student', 'update_student', 'view_school'];
const WITHOUT = ['view_student', 'view_school'];
const ADMIN_ROLE = 'zr5ER4QD';
const SHOTS = process.env.E2E_SHOTS_DIR;

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
function sessionToken(permissions: string[]): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ lmsuserid: 'staff-1', lmsuserrole: ADMIN_ROLE, firstname: 'Test', lastname: 'Admin', permissions, isplatform: false, organisationid: 'org-1', exp, iat: exp - 10 })}.c2ln`;
}
const json = (status: number, body: unknown) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

const CLASSES = [
  { standardid: 'class-a1', standardname: 'Class 1A' },
  { standardid: 'class-a2', standardname: 'Class 2A' },
];
const CURRICULA = [
  { curriculumid: 'cur-1', curriculumname: 'Reading Basics' },
  { curriculumid: 'cur-2', curriculumname: 'Number Skills' },
  { curriculumid: 'cur-3', curriculumname: 'Science Starters' },
  // The route lists a deleted curriculum without its name.
  { curriculumid: 'cur-gone' } as { curriculumid: string; curriculumname?: string },
];

/** Central's two real sentences for a push that failed: the learning server did not answer, or it lacks the class or curriculum. */
const SYNC_MESSAGE = "The account was saved, but the learning server did not answer. Run Sync Students for this school on the Schools screen.";
const MISSING_MESSAGE = "Saved, but the learning server doesn't have this class or curriculum yet. Run Sync Content, then Sync Students for this school.";

interface Details {
  schooluserid: string;
  schoolusername: string;
  schoolid: string;
  schoolname: string;
  studentfirstname: string;
  studentlastname: string;
  genderid: number;
  dateofbirth: string | null;
  standard: string;
  curriculumids: string[];
  isdisabled: boolean;
}
const details = (n: number, username: string, first: string, patch: Partial<Details> = {}): Details => ({
  schooluserid: `lu-${n}`,
  schoolusername: username,
  schoolid: 'school-a',
  schoolname: 'North Valley School',
  studentfirstname: first,
  studentlastname: 'Rivers',
  genderid: 2,
  dateofbirth: '2014-05-06',
  standard: 'class-a1',
  curriculumids: ['cur-1'],
  isdisabled: false,
  ...patch,
});

const listRow = (d: Details, n: number) => ({
  studentid: `s-${n}`,
  schooluserid: d.schooluserid,
  studentfirstname: d.studentfirstname,
  studentlastname: d.studentlastname,
  'schooluser.schoolusername': d.schoolusername,
  'curriculum.curriculumname': CURRICULA.find((c) => c.curriculumid === d.curriculumids[0])?.curriculumname ?? '',
  schoolname: d.schoolname,
  class: { standardname: CLASSES.find((c) => c.standardid === d.standard)?.standardname ?? '' },
  country: 'Exampleland',
  type: 'Student',
  isdisabled: d.isdisabled,
});

interface Mock {
  details: Record<string, Details>;
  /** Answers a save: given the id and the body. The default applies it and answers pushed. */
  put: (id: string, body: Record<string, any>) => ReturnType<typeof json>;
  /** Answers a read of the details; the default answers from `details`. */
  get: (id: string) => ReturnType<typeof json>;
  requests: Array<{ method: string; path: string; body: unknown }>;
  gets: string[];
  listReads: number;
  holdGet: Record<string, Promise<void>>;
  holdPut?: Promise<void>;
  /** Publication state of a curriculum by id; any other is published. */
  publication: Record<string, string>;
  publicationReads: string[];
  /** Makes every publication read fail (the pickers then offer everything: central still refuses an unpublished one). */
  publicationFails: boolean;
  unmocked: string[];
}

function newMock(): Mock {
  const mock: Mock = {
    details: {
      'lu-1': details(1, 'dara1', 'Dara'),
      'lu-2': details(2, 'sokha2', 'សុខា', { genderid: 1, dateofbirth: null, standard: 'class-a2', curriculumids: ['cur-1', 'cur-2'], isdisabled: true }),
      'lu-3': details(3, 'maly3', 'Maly', { standard: 'class-a2', curriculumids: ['cur-2'] }),
    },
    put: (id, body) => {
      const d = mock.details[id];
      Object.assign(d, {
        studentfirstname: body.studentfirstname,
        studentlastname: body.studentlastname,
        genderid: body.genderid,
        dateofbirth: body.dateofbirth,
        standard: body.standard,
        curriculumids: body.curriculumids,
      });
      return json(200, { schooluserid: id, studentname: `${body.studentfirstname} ${body.studentlastname}`.trim(), push: { status: 'pushed', message: 'ok' } });
    },
    get: (id) => (mock.details[id] ? json(200, mock.details[id]) : json(404, { code: 'NOT_FOUND', errormessage: 'No such learner.' })),
    requests: [],
    gets: [],
    listReads: 0,
    holdGet: {},
    publication: {},
    publicationReads: [],
    publicationFails: false,
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
  const detailsPath = /^student\/([^/]+)\/details$/.exec(path);
  if (method === 'GET' && detailsPath) {
    mock.gets.push(path);
    const hold = mock.holdGet[detailsPath[1]];
    if (hold) await hold;
    return route.fulfill(mock.get(detailsPath[1]));
  }
  if (method === 'PUT' && detailsPath) {
    const body = request.postDataJSON();
    mock.requests.push({ method, path, body });
    if (mock.holdPut) await mock.holdPut;
    return route.fulfill(mock.put(detailsPath[1], body));
  }
  if (method === 'POST' && path === 'student') {
    mock.listReads++;
    const rows = Object.values(mock.details).map((d, i) => listRow(d, i + 1));
    return route.fulfill(json(200, { data: { data: rows, total: rows.length } }));
  }
  if (method === 'POST' && path === 'school') return route.fulfill(json(200, { data: { data: [{ schoolid: 'school-a', schoolname: 'North Valley School' }], total: 1 } }));
  if (method === 'GET' && path === 'standard/school/school-a') return route.fulfill(json(200, { data: CLASSES }));
  if (method === 'GET' && path === 'school/school-a/curriculums') return route.fulfill(json(200, { data: CURRICULA }));
  // Each curriculum's publication state (the pickers offer only published ones).
  const publication = /^curriculum\/publication\/([^/]+)$/.exec(path);
  if (method === 'GET' && publication) {
    mock.publicationReads.push(publication[1]);
    if (mock.publicationFails) return route.fulfill(json(500, { error: true, errormessage: 'Something broke.' }));
    return route.fulfill(json(200, { data: { publicationstatus: mock.publication[publication[1]] ?? 'published' } }));
  }
  mock.unmocked.push(`${method} ${path}`);
  return route.fulfill(json(200, { data: [] }));
}

/** A drawer that starts closed schedules a "restore focus" for 300 ms after the page loads; waiting it out keeps these specs about the drawer. */
const settle = (page: Page) => page.waitForTimeout(600);

async function openLearners(context: BrowserContext, mock: Mock, permissions = WITH): Promise<Page> {
  await signIn(context, mock, permissions);
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/student/index');
  await expect(page.getByRole('columnheader', { name: 'Student Name' })).toBeVisible();
  await expect(page.locator('tbody tr', { hasText: 'dara1' })).toHaveCount(1);
  await settle(page);
  return page;
}

const row = (page: Page, text: string) => page.locator('tbody tr', { hasText: text });
const toasts = (page: Page) => page.locator('.ant-notification-notice-description');
const actions = (page: Page, username: string) => page.getByRole('button', { name: `Manage ${username}`, exact: true });
const menuItem = (page: Page, name: string) => page.getByRole('menuitem', { name, exact: true });
const drawer = (page: Page) => page.getByRole('dialog', { name: 'Edit details' });
const first = (page: Page) => page.locator('#edit-learner-first');
const last = (page: Page) => page.locator('#edit-learner-last');
const dob = (page: Page) => page.locator('#edit-learner-dob');
const save = (page: Page) => drawer(page).getByRole('button', { name: /^(Save|Saving…)$/ });
const focusedLabel = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName ?? '');
const classSelect = (page: Page) => page.locator('#edit-learner-class');
const curriculaSelect = (page: Page) => page.locator('#edit-learner-curricula');

async function openEdit(page: Page, username: string): Promise<void> {
  await actions(page, username).click();
  await menuItem(page, 'Edit details').click();
  await expect(drawer(page).getByRole('heading', { name: 'Edit details', exact: true })).toBeVisible();
  await expect(first(page)).toBeVisible();
  // The drawer slides in from the right; wait until it has stopped before pointing at it.
  let before = -1;
  await expect
    .poll(async () => {
      const x = (await drawer(page).boundingBox())?.x ?? -2;
      const still = x === before;
      before = x;
      return still;
    })
    .toBe(true);
}

async function choose(page: Page, select: 'class' | 'curricula', option: string): Promise<void> {
  await page.locator(`#edit-learner-${select} .ant-select-selector`).click();
  await page.locator('.ant-select-item-option', { hasText: option }).first().click();
  if (select === 'curricula') await page.keyboard.press('Escape');
}

const errorOf = (page: Page, selector: string) => page.locator('.field', { has: page.locator(selector) }).locator('.field-error');
const bodyOf = (mock: Mock, i = 0) => mock.requests[i]?.body as Record<string, unknown>;

test.describe('Edit details: opening and reading', () => {
  test('the drawer reads the learner with the contract\'s request and shows it prefilled', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    expect(mock.gets, 'the list alone reads no details').toEqual([]);
    await openEdit(page, 'dara1');
    expect(mock.gets).toEqual(['student/lu-1/details']);
    await expect(page.getByTestId('edit-username')).toHaveText('dara1');
    await expect(page.getByTestId('edit-school')).toHaveText('North Valley School');
    await expect(first(page)).toHaveValue('Dara');
    await expect(last(page)).toHaveValue('Rivers');
    await expect(drawer(page).getByRole('radio', { name: 'Female', exact: true })).toBeChecked();
    await expect(drawer(page).getByRole('radio', { name: 'Male', exact: true })).not.toBeChecked();
    await expect(dob(page)).toHaveValue('2014-05-06');
    await expect(classSelect(page)).toContainText('Class 1A');
    await expect(curriculaSelect(page)).toContainText('Reading Basics');
    await expect(drawer(page).getByText('(no longer available)')).toHaveCount(0);
    await expect(save(page)).toBeDisabled();
    expect(mock.requests, 'nothing is sent by opening it').toEqual([]);
    expect(mock.unmocked.filter((r) => !r.endsWith('/all'))).toEqual([]);
  });

  test('a learner with a Khmer name, no date of birth and two curricula is prefilled as they are', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await openEdit(page, 'sokha2');
    await expect(first(page)).toHaveValue('សុខា');
    await expect(dob(page)).toHaveValue('');
    await expect(drawer(page).getByRole('radio', { name: 'Male', exact: true })).toBeChecked();
    await expect(classSelect(page)).toContainText('Class 2A');
    await expect(curriculaSelect(page)).toContainText('Reading Basics');
    await expect(curriculaSelect(page)).toContainText('Number Skills');
  });

  test('a skeleton shows while the details load, and then the form replaces it', async ({ context }) => {
    const mock = newMock();
    let release!: () => void;
    mock.holdGet['lu-1'] = new Promise<void>((resolve) => (release = resolve));
    const page = await openLearners(context, mock);
    await actions(page, 'dara1').click();
    await menuItem(page, 'Edit details').click();
    await expect(page.getByTestId('edit-learner-loading')).toBeVisible();
    await expect(first(page)).toHaveCount(0);
    await expect(save(page)).toBeDisabled();
    release();
    await expect(first(page)).toHaveValue('Dara');
    await expect(page.getByTestId('edit-learner-loading')).toHaveCount(0);
  });

  test('when the details cannot be read the drawer says so and offers Close', async ({ context }) => {
    const mock = newMock();
    mock.get = () => json(500, { code: 'SERVER_ERROR', errormessage: 'Something went wrong.' });
    const page = await openLearners(context, mock);
    await actions(page, 'dara1').click();
    await menuItem(page, 'Edit details').click();
    await expect(page.getByTestId('edit-learner-load-error')).toContainText("The learner's details couldn't be loaded.");
    await expect(first(page)).toHaveCount(0);
    expect(await toasts(page).count(), 'one message, not two').toBe(0);
    await expect(drawer(page).getByRole('button', { name: 'Close', exact: true }).last()).toBeFocused();
    await drawer(page).getByRole('button', { name: 'Close', exact: true }).last().click();
    await expect(drawer(page)).toBeHidden();
    await expect.poll(() => focusedLabel(page)).toBe('Manage dara1');
  });

  test("a 400 on the read shows the API's sentence", async ({ context }) => {
    const mock = newMock();
    mock.get = () => json(400, { code: 'INVALID_INPUT', errormessage: 'Choose an organisation.', fields: [{ field: 'schooluserid', message: 'Choose an organisation.' }] });
    const page = await openLearners(context, mock);
    await actions(page, 'dara1').click();
    await menuItem(page, 'Edit details').click();
    await expect(page.getByTestId('edit-learner-load-error')).toContainText('Choose an organisation.');
    await expect(page.getByTestId('edit-learner-load-error')).not.toContainText("couldn't be loaded");
  });

  test('a learner that no longer exists says so', async ({ context }) => {
    const mock = newMock();
    mock.get = () => json(404, { code: 'NOT_FOUND', errormessage: 'No such learner.' });
    const page = await openLearners(context, mock);
    await actions(page, 'dara1').click();
    await menuItem(page, 'Edit details').click();
    await expect(page.getByTestId('edit-learner-load-error')).toContainText('That learner no longer exists. Close this and try again.');
  });
});

test.describe('Edit details: the entry point', () => {
  test('without the update permission there is no way to open it', async ({ context }) => {
    const page = await openLearners(context, newMock(), WITHOUT);
    await expect(page.getByRole('button', { name: /^Manage / })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Edit details' })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Edit details is the first item in the menu, above Reset password and Disable or Enable', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await actions(page, 'dara1').click();
    await expect(page.getByRole('menuitem')).toHaveText(['Edit details', 'Move to another school', 'Reset password', 'Disable']);
    await page.keyboard.press('Escape');
    await actions(page, 'sokha2').click();
    await expect(page.getByRole('menuitem')).toHaveText(['Edit details', 'Move to another school', 'Reset password', 'Enable']);
  });

  test('keyboard only: from the row to Save, the saved row, the toast and focus back on the row', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    const button = actions(page, 'dara1');
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(menuItem(page, 'Edit details')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(drawer(page).getByRole('heading', { name: 'Edit details', exact: true })).toBeVisible();
    await expect(menuItem(page, 'Reset password')).toHaveCount(0);
    await expect(first(page)).toBeFocused();
    await expect(save(page)).toBeDisabled();
    await page.keyboard.press('End');
    await page.keyboard.type('h');
    await expect(save(page)).toBeEnabled();
    const tabTo = async (target: ReturnType<Page['locator']>, what: string) => {
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Tab');
        if (await target.evaluate((el) => el === document.activeElement || el.contains(document.activeElement)).catch(() => false)) return;
      }
      throw new Error(`Tab did not reach ${what}`);
    };
    await tabTo(last(page), 'Last name');
    await tabTo(drawer(page).getByRole('radio', { name: 'Female', exact: true }), 'Gender');
    await tabTo(dob(page), 'Date of birth');
    await tabTo(classSelect(page), 'Class');
    await tabTo(curriculaSelect(page), 'Curriculum');
    await tabTo(drawer(page).getByRole('button', { name: 'Cancel' }), 'Cancel');
    await tabTo(save(page), 'Save');
    await expect(save(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(drawer(page)).toBeHidden();
    expect(mock.requests).toEqual([
      {
        method: 'PUT',
        path: 'student/lu-1/details',
        body: { studentfirstname: 'Darah', studentlastname: 'Rivers', genderid: 2, dateofbirth: '2014-05-06', standard: 'class-a1', curriculumids: ['cur-1'] },
      },
    ]);
    await expect(toasts(page)).toHaveText("Darah Rivers's details are saved.");
    await expect(row(page, 'dara1')).toContainText('Darah Rivers');
    await expect.poll(() => focusedLabel(page)).toBe('Manage dara1');
  });
});

test.describe('Edit details: Save', () => {
  test('Save is disabled until something changed, and again once it is changed back', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await openEdit(page, 'dara1');
    await expect(save(page)).toBeDisabled();
    await first(page).fill('Dari');
    await expect(save(page)).toBeEnabled();
    await first(page).fill('Dara');
    await expect(save(page)).toBeDisabled();
    await drawer(page).getByRole('radio', { name: 'Male', exact: true }).check();
    await expect(save(page)).toBeEnabled();
    await drawer(page).getByRole('radio', { name: 'Female', exact: true }).check();
    await expect(save(page)).toBeDisabled();
  });

  test('changing class, curricula, gender, date of birth and names sends the exact request and updates the list', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    const readsBefore = mock.listReads;
    await openEdit(page, 'dara1');
    await first(page).fill('Dari');
    await last(page).fill('');
    await drawer(page).getByRole('radio', { name: 'Male', exact: true }).check();
    await dob(page).fill('2015-01-02');
    await choose(page, 'class', 'Class 2A');
    await choose(page, 'curricula', 'Number Skills');
    await save(page).click();
    await expect(drawer(page)).toBeHidden();
    expect(mock.requests).toHaveLength(1);
    expect(mock.requests[0].method).toBe('PUT');
    expect(mock.requests[0].path).toBe('student/lu-1/details');
    expect(bodyOf(mock)).toEqual({ studentfirstname: 'Dari', studentlastname: '', genderid: 1, dateofbirth: '2015-01-02', standard: 'class-a2', curriculumids: ['cur-1', 'cur-2'] });
    expect(Object.keys(bodyOf(mock)).sort()).toEqual(['curriculumids', 'dateofbirth', 'genderid', 'standard', 'studentfirstname', 'studentlastname']);
    await expect(row(page, 'dara1')).toContainText('Dari');
    await expect(row(page, 'dara1')).toContainText('Class 2A');
    expect(mock.listReads, 'the list page is read again').toBeGreaterThan(readsBefore);
    await expect.poll(() => focusedLabel(page)).toBe('Manage dara1');
  });

  test('clearing the date of birth sends null; a curriculum can be removed', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openEdit(page, 'sokha2');
    await curriculaSelect(page).locator('.ant-select-selection-item', { hasText: 'Number Skills' }).locator('.ant-select-selection-item-remove').click();
    await dob(page).fill('2013-02-03');
    await save(page).click();
    await expect(drawer(page)).toBeHidden();
    expect(bodyOf(mock)).toMatchObject({ dateofbirth: '2013-02-03', curriculumids: ['cur-1'] });
    await openEdit(page, 'sokha2');
    await dob(page).fill('');
    await save(page).click();
    await expect(drawer(page)).toBeHidden();
    expect(bodyOf(mock, 1)).toEqual({ studentfirstname: 'សុខា', studentlastname: 'Rivers', genderid: 1, dateofbirth: null, standard: 'class-a2', curriculumids: ['cur-1'] });
  });

  test('a Khmer name goes to the server and comes back to the list exactly as typed', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openEdit(page, 'dara1');
    await first(page).fill('ដារ៉ា');
    await last(page).fill('រិវើស');
    await save(page).click();
    await expect(drawer(page)).toBeHidden();
    expect(bodyOf(mock)).toMatchObject({ studentfirstname: 'ដារ៉ា', studentlastname: 'រិវើស' });
    expect(mock.details['lu-1'].studentfirstname).toBe('ដារ៉ា');
    await expect(toasts(page)).toHaveText("ដារ៉ា រិវើស's details are saved.");
    await expect(row(page, 'dara1')).toContainText('ដារ៉ា រិវើស');
    await openEdit(page, 'dara1');
    await expect(first(page)).toHaveValue('ដារ៉ា');
    await expect(last(page)).toHaveValue('រិវើស');
  });

  const NOTICES: Array<[string, any, string]> = [
    ['pushed', { status: 'pushed', message: 'ok' }, "Dari Rivers's details are saved."],
    ['failed with central\'s Sync Students sentence', { status: 'failed', message: SYNC_MESSAGE }, SYNC_MESSAGE],
    ['failed with central\'s missing class or curriculum sentence', { status: 'failed', message: MISSING_MESSAGE }, MISSING_MESSAGE],
    ['failed with no sentence', { status: 'failed' }, 'Saved, but the learning server did not answer. Run Sync Students for this school on the Schools screen.'],
    ['skipped', { status: 'skipped', message: 'x' }, 'Saved. The learning server gets the change at its next sync.'],
    ['an unknown status', { status: 'other', message: 'x' }, 'Dari Rivers was updated.'],
    ['no push at all', undefined, 'Dari Rivers was updated.'],
  ];
  for (const [what, push, text] of NOTICES) {
    test(`the toast for ${what}`, async ({ context }) => {
      const mock = newMock();
      mock.put = (id) => json(200, { schooluserid: id, studentname: 'Dari Rivers', ...(push ? { push } : {}) });
      const page = await openLearners(context, mock);
      await openEdit(page, 'dara1');
      await first(page).fill('Dari');
      await save(page).click();
      await expect(drawer(page)).toBeHidden();
      await expect(toasts(page)).toHaveText(text);
      await expect.poll(() => focusedLabel(page)).toBe('Manage dara1');
    });
  }

  test('a 400 shows the API\'s sentence under its field and the drawer stays open', async ({ context }) => {
    const mock = newMock();
    mock.put = () => json(400, { code: 'INVALID_INPUT', errormessage: 'Invalid input.', fields: [{ field: 'studentfirstname', message: 'Enter a name of 2 to 45 characters.' }, { field: 'dateofbirth', message: 'Enter a date of birth between 1900 and yesterday.' }] });
    const page = await openLearners(context, mock);
    await openEdit(page, 'dara1');
    await first(page).fill('Dari');
    await save(page).click();
    await expect(errorOf(page, '#edit-learner-first')).toHaveText('Enter a name of 2 to 45 characters.');
    await expect(errorOf(page, '#edit-learner-dob')).toHaveText('Enter a date of birth between 1900 and yesterday.');
    await expect(errorOf(page, '#edit-learner-last')).toHaveCount(0);
    await expect(drawer(page)).toBeVisible();
    await expect(first(page)).toBeFocused();
    expect(await toasts(page).count(), 'a validation failure is never a toast').toBe(0);
    expect(mock.requests).toHaveLength(1);
    // Typing in the field clears its message; the other stays.
    await first(page).fill('Dario');
    await expect(errorOf(page, '#edit-learner-first')).toHaveCount(0);
    await expect(errorOf(page, '#edit-learner-dob')).toHaveCount(1);
  });

  test('a 400 for the class and curriculum shows beside them', async ({ context }) => {
    const mock = newMock();
    mock.put = () => json(400, { code: 'INVALID_INPUT', errormessage: 'Invalid input.', fields: [{ field: 'standard', message: 'Choose a class for this student.' }, { field: 'curriculumids', message: 'Choose curricula that exist.' }] });
    const page = await openLearners(context, mock);
    await openEdit(page, 'dara1');
    await choose(page, 'class', 'Class 2A');
    await save(page).click();
    await expect(errorOf(page, '#edit-learner-class')).toHaveText('Choose a class for this student.');
    await expect(errorOf(page, '#edit-learner-curricula')).toHaveText('Choose curricula that exist.');
    await expect(drawer(page)).toBeVisible();
  });

  test('a 400 with no organisation chosen is one sentence for the form', async ({ context }) => {
    const mock = newMock();
    mock.put = () => json(400, { code: 'INVALID_INPUT', errormessage: 'Choose an organisation.', fields: [{ field: 'schooluserid', message: 'Choose an organisation.' }] });
    const page = await openLearners(context, mock);
    await openEdit(page, 'dara1');
    await first(page).fill('Dari');
    await save(page).click();
    await expect(drawer(page).locator('.form-error')).toContainText('Choose an organisation.');
    await expect(drawer(page)).toBeVisible();
    await expect(save(page)).toBeFocused();
  });

  test('our own rule stops an empty first name before anything is sent', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openEdit(page, 'dara1');
    await first(page).fill('');
    await save(page).click();
    await expect(errorOf(page, '#edit-learner-first')).toHaveText('Enter a name of 2 to 45 characters.');
    expect(mock.requests).toEqual([]);
    await expect(first(page)).toBeFocused();
  });
});

test.describe('Edit details: a class or curriculum that is gone', () => {
  const gone = () => {
    const mock = newMock();
    mock.details['lu-1'] = details(1, 'dara1', 'Dara', { standard: 'class-gone', curriculumids: ['cur-1', 'cur-gone'] });
    return mock;
  };

  test('they show as (no longer available) and Save stays disabled until each is replaced or removed', async ({ context }) => {
    const mock = gone();
    const page = await openLearners(context, mock);
    await openEdit(page, 'dara1');
    await expect(classSelect(page)).toContainText('(no longer available)');
    await expect(curriculaSelect(page)).toContainText('(no longer available)');
    await expect(curriculaSelect(page)).toContainText('Reading Basics');
    await expect(page.getByTestId('class-gone')).toBeVisible();
    await expect(page.getByTestId('curricula-gone')).toBeVisible();
    // A change elsewhere is not enough.
    await first(page).fill('Dari');
    await expect(save(page)).toBeDisabled();
    await choose(page, 'class', 'Class 1A');
    await expect(classSelect(page)).not.toContainText('(no longer available)');
    await expect(page.getByTestId('class-gone')).toHaveCount(0);
    await expect(save(page)).toBeDisabled();
    await curriculaSelect(page).locator('.ant-select-selection-item', { hasText: '(no longer available)' }).locator('.ant-select-selection-item-remove').click();
    await expect(curriculaSelect(page)).not.toContainText('(no longer available)');
    await expect(page.getByTestId('curricula-gone')).toHaveCount(0);
    await expect(save(page)).toBeEnabled();
    await save(page).click();
    await expect(drawer(page)).toBeHidden();
    expect(bodyOf(mock)).toMatchObject({ standard: 'class-a1', curriculumids: ['cur-1'] });
  });

  test('a learner whose only curriculum is gone must choose a valid one', async ({ context }) => {
    const mock = newMock();
    mock.details['lu-1'] = details(1, 'dara1', 'Dara', { curriculumids: ['cur-gone'] });
    const page = await openLearners(context, mock);
    await openEdit(page, 'dara1');
    await expect(curriculaSelect(page)).toContainText('(no longer available)');
    await expect(save(page)).toBeDisabled();
    await choose(page, 'curricula', 'Number Skills');
    await expect(save(page)).toBeDisabled();
    await curriculaSelect(page).locator('.ant-select-selection-item', { hasText: '(no longer available)' }).locator('.ant-select-selection-item-remove').click();
    await expect(save(page)).toBeEnabled();
    await save(page).click();
    await expect(drawer(page)).toBeHidden();
    expect(bodyOf(mock)).toMatchObject({ curriculumids: ['cur-2'] });
  });
});

test.describe('Edit details: closing', () => {
  test('Cancel closes at once when nothing changed, and focus returns to the row', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await openEdit(page, 'dara1');
    await drawer(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(drawer(page)).toBeHidden();
    await expect(page.getByText('Discard your changes?')).toHaveCount(0);
    await expect.poll(() => focusedLabel(page)).toBe('Manage dara1');
  });

  test('a change that was changed back closes without asking', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await openEdit(page, 'dara1');
    await first(page).fill('Dari');
    await first(page).fill('Dara');
    await drawer(page).getByRole('button', { name: 'Close', exact: true }).first().click();
    await expect(drawer(page)).toBeHidden();
    await expect(page.getByText('Discard your changes?')).toHaveCount(0);
  });

  test('with a change, closing asks; Keep editing keeps it, Discard drops it and sends nothing', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openEdit(page, 'dara1');
    await first(page).fill('Dari');
    await drawer(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Discard your changes?')).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing' }).click();
    await expect(page.getByText('Discard your changes?')).toHaveCount(0);
    await expect(drawer(page)).toBeVisible();
    await expect(first(page)).toHaveValue('Dari');
    await drawer(page).getByRole('button', { name: 'Close', exact: true }).first().click();
    await expect(page.getByText('Discard your changes?')).toBeVisible();
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(drawer(page)).toBeHidden();
    expect(mock.requests).toEqual([]);
    await expect.poll(() => focusedLabel(page)).toBe('Manage dara1');
    // Opening again shows the server's values, not the discarded ones.
    await openEdit(page, 'dara1');
    await expect(first(page)).toHaveValue('Dara');
  });
});

test.describe('Edit details: answers that arrive late', () => {
  test('a read for an earlier opening does not replace the form of the later one', async ({ context }) => {
    const mock = newMock();
    let release!: () => void;
    mock.holdGet['lu-1'] = new Promise<void>((resolve) => (release = resolve));
    const page = await openLearners(context, mock);
    await actions(page, 'dara1').click();
    await menuItem(page, 'Edit details').click();
    await expect(page.getByTestId('edit-learner-loading')).toBeVisible();
    await drawer(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(drawer(page)).toBeHidden();
    await openEdit(page, 'maly3');
    await expect(first(page)).toHaveValue('Maly');
    release();
    await page.waitForTimeout(600);
    await expect(first(page)).toHaveValue('Maly');
    await expect(page.getByTestId('edit-username')).toHaveText('maly3');
    await expect(classSelect(page)).toContainText('Class 2A');
    await expect(save(page)).toBeDisabled();
  });

  test('a save answer for an earlier opening shows no toast, reads no list and leaves the later opening alone', async ({ context }) => {
    const mock = newMock();
    let release!: () => void;
    mock.holdPut = new Promise<void>((resolve) => (release = resolve));
    const page = await openLearners(context, mock);
    await openEdit(page, 'dara1');
    await first(page).fill('Dari');
    await save(page).click();
    await expect.poll(() => mock.requests.length).toBe(1);
    await expect(save(page)).toHaveText('Saving…');
    // The browser's Back closes the drawer while the save is still running.
    await page.evaluate(() => {
      history.pushState({}, '', location.pathname + '?back=1');
      history.back();
    });
    await expect(drawer(page)).toBeHidden();
    await openEdit(page, 'dara1');
    await expect(first(page)).toHaveValue('Dara');
    const reads = mock.listReads;
    release();
    await page.waitForTimeout(600);
    await expect(drawer(page), 'the old answer does not close the new drawer').toBeVisible();
    await expect(first(page)).toHaveValue('Dara');
    expect(await toasts(page).count(), 'the old answer raises no toast').toBe(0);
    expect(mock.listReads).toBe(reads);
  });
});

test.describe('Edit details: the other menu items', () => {
  test('Reset password and Disable still open their own things', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await actions(page, 'dara1').click();
    await menuItem(page, 'Reset password').click();
    await expect(page.getByRole('dialog', { name: 'Reset password' })).toBeVisible();
    await expect(drawer(page)).toHaveCount(0);
  });
});

test.describe('Edit details: screenshots', () => {
  test.skip(!SHOTS, 'set E2E_SHOTS_DIR to write the screenshots');
  test('the filled drawer and the list after a save', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openEdit(page, 'dara1');
    await first(page).fill('Dara');
    await last(page).fill('Rivera');
    await choose(page, 'class', 'Class 2A');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/edit-form.png` });
    await save(page).click();
    await expect(drawer(page)).toBeHidden();
    await expect(row(page, 'dara1')).toContainText('Dara Rivera');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/edit-saved.png` });
  });
});

test.describe('only published curricula are offered', () => {
  const offered = (page: Page) => page.locator('.ant-select-item-option').allTextContents().then((t) => t.map((x) => x.trim()));

  test('a curriculum never published or retired is not offered', async ({ context }) => {
    const mock = newMock();
    mock.publication = { 'cur-2': 'never', 'cur-3': 'withdrawn' };
    const page = await openLearners(context, mock);
    await openEdit(page, 'dara1');
    await curriculaSelect(page).locator('.ant-select-selector').click();
    await expect.poll(() => offered(page)).toEqual(['Reading Basics']);
  });

  test("a learner's own curriculum that is no longer published shows as not available and must be replaced before saving", async ({ context }) => {
    const mock = newMock();
    // maly3 holds cur-2.
    mock.publication = { 'cur-2': 'withdrawn' };
    const page = await openLearners(context, mock);
    await openEdit(page, 'maly3');
    await expect(curriculaSelect(page)).toContainText('(no longer available)');
    await expect(page.getByTestId('curricula-gone')).toBeVisible();
    await first(page).fill('Malia');
    await expect(save(page)).toBeDisabled();
    await choose(page, 'curricula', 'Reading Basics');
    await curriculaSelect(page).locator('.ant-select-selection-item', { hasText: '(no longer available)' }).locator('.ant-select-selection-item-remove').click();
    await expect(save(page)).toBeEnabled();
  });

  test("central's 400 on curriculumids is shown under the Curriculum field, in its own words", async ({ context }) => {
    const mock = newMock();
    const SAYS = 'Publish Number Skills first, or choose another curriculum.';
    mock.put = () => json(400, { code: 'INVALID_INPUT', errormessage: 'Invalid input.', fields: [{ field: 'curriculumids', message: SAYS }] });
    const page = await openLearners(context, mock);
    await openEdit(page, 'dara1');
    await choose(page, 'curricula', 'Number Skills');
    await save(page).click();
    await expect(errorOf(page, '#edit-learner-curricula')).toHaveText(SAYS);
    expect(await toasts(page).count(), 'a validation failure is not a toast').toBe(0);
  });
});
