import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { API_URL, BASE_URL } from '../fixtures/env';
import { MockGrade, grade, gradesAnswer } from '../fixtures/grades';

/**
 * Move to another school on the Learners list, in a browser, with every answer from the API mocked: the sign-in is a token
 * written to the session (no server is asked) and every request to the API host is answered by a route here, following the
 * contract of `PUT student/:schooluserid/school`. Nothing leaves the machine: any other host is refused.
 *
 * Run it against a production or local build served on E2E_BASE_URL. The session keys and the API host are those of that
 * build's environment file: E2E_API_URL, and E2E_ACCESS_KEYS as "algKey,payloadKey,hashKey".
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

const SCHOOLS = [
  { schoolid: 'school-a', schoolname: 'North Valley School', organisationid: 'org-1' },
  { schoolid: 'school-b', schoolname: 'Lakeside School', organisationid: 'org-1' },
  { schoolid: 'school-c', schoolname: 'Hilltop School', organisationid: 'org-1' },
  { schoolid: 'school-x', schoolname: 'Far Away School', organisationid: 'org-2' },
];
const CLASSES: Record<string, Array<{ standardid: string; standardname: string }>> = {
  'school-a': [
    { standardid: 'class-a1', standardname: 'Class 1A' },
    { standardid: 'class-a2', standardname: 'Class 2A' },
  ],
  'school-b': [
    { standardid: 'class-b5', standardname: 'Class 5B' },
    { standardid: 'class-b6', standardname: 'Class 6B' },
  ],
  'school-c': [{ standardid: 'class-c7', standardname: 'Class 7C' }],
  'school-x': [{ standardid: 'class-x1', standardname: 'Class 1X' }],
};
const CURRICULA: Record<string, Array<{ curriculumid: string; curriculumname?: string; isdeleted?: boolean }>> = {
  'school-a': [
    { curriculumid: 'cur-1', curriculumname: 'Reading Basics' },
    { curriculumid: 'cur-2', curriculumname: 'Number Skills' },
  ],
  'school-b': [
    { curriculumid: 'cur-1', curriculumname: 'Reading Basics' },
    { curriculumid: 'cur-4', curriculumname: 'History Tales' },
    { curriculumid: 'cur-gone' },
  ],
  'school-c': [{ curriculumid: 'cur-5', curriculumname: 'Garden Science' }],
  'school-x': [{ curriculumid: 'cur-1', curriculumname: 'Reading Basics' }],
};
const schoolName = (id: string) => SCHOOLS.find((s) => s.schoolid === id)!.schoolname;
const className = (schoolid: string, standardid: string) => CLASSES[schoolid]?.find((c) => c.standardid === standardid)?.standardname ?? '';

/** Central's four sentences for a 200 (the contract), and its refusals. */
const PUSHED = (school: string) => `Moved to ${school}. The learner signs in again to see it.`;
const SKIPPED = (school: string) => `Moved to ${school}. No learner server is set up here, so nothing was pushed.`;
const FAILED = (school: string) => `Moved, but the learning server did not answer. Run Sync Students for ${school} on the Schools screen.`;
const MISSING = (school: string) => `Moved, but the learning server doesn't have this class or curriculum yet. Run Sync Content, then Sync Students for ${school}.`;
const MORE_THAN_ONE = "This learner has more than one record, so it can't be moved here. Contact support.";

interface Learner {
  schooluserid: string;
  schoolusername: string;
  schoolid: string;
  schoolname: string;
  organisationid: string;
  studentfirstname: string;
  studentlastname: string;
  genderid: number;
  dateofbirth: string | null;
  standard: string;
  curriculumids: string[];
  isdisabled: boolean;
  /** What central answers when it knows them. */
  curriculumid?: string;
  gradeid?: string;
}
const learner = (n: number, username: string, first: string, patch: Partial<Learner> = {}): Learner => ({
  schooluserid: `lu-${n}`,
  schoolusername: username,
  schoolid: 'school-a',
  schoolname: 'North Valley School',
  organisationid: 'org-1',
  studentfirstname: first,
  studentlastname: 'Rivers',
  genderid: 2,
  dateofbirth: '2014-05-06',
  standard: 'class-a1',
  curriculumids: ['cur-1', 'cur-2'],
  isdisabled: false,
  ...patch,
});

const listRow = (d: Learner, n: number) => ({
  studentid: `s-${n}`,
  schooluserid: d.schooluserid,
  studentfirstname: d.studentfirstname,
  studentlastname: d.studentlastname,
  'schooluser.schoolusername': d.schoolusername,
  'curriculum.curriculumname': 'Reading Basics',
  schoolid: d.schoolid,
  schoolname: d.schoolname,
  organisationid: d.organisationid,
  class: { standardname: className(d.schoolid, d.standard) },
  country: 'Exampleland',
  type: 'Student',
  isdisabled: d.isdisabled,
});

interface Mock {
  learners: Record<string, Learner>;
  /** Answers a move: given the id and the body. The default applies it and answers pushed. */
  put: (id: string, body: Record<string, any>) => ReturnType<typeof json>;
  schools: typeof SCHOOLS | 'fail';
  requests: Array<{ method: string; path: string; body: unknown }>;
  gets: string[];
  listReads: number;
  holdGet: Record<string, Promise<void>>;
  holdPut?: Promise<void>;
  /** Holds the classes and curricula of one school until released. */
  holdPlacement: Record<string, Promise<void>>;
  /** `publicationstatus` of a curriculum by id on `school/:id/curriculums`; any other is published. */
  publication: Record<string, string>;
  publicationReads: string[];
  /** Leaves `publicationstatus` off the curriculum rows (the pickers then offer everything: central still refuses an unpublished one). */
  statusMissing: boolean;
  unmocked: string[];
  /** curriculumid → its grades; a curriculum not listed has one. */
  grades: Record<string, MockGrade[]>;
  /** What `GET grade/curriculum/:id` was asked for. */
  gradeReads: string[];
}

function newMock(): Mock {
  const mock: Mock = {
    learners: {
      'lu-1': learner(1, 'dara1', 'Dara'),
      'lu-2': learner(2, 'sokha2', 'Sokha', { genderid: 1, isdisabled: true, curriculumids: ['cur-2'] }),
      'lu-3': learner(3, 'maly3', 'Maly', { schoolid: 'school-b', schoolname: 'Lakeside School', standard: 'class-b5', curriculumids: ['cur-1'] }),
      'lu-4': learner(4, 'visal4', 'Visal', { schoolid: 'school-x', schoolname: 'Far Away School', organisationid: 'org-2', standard: 'class-x1', curriculumids: ['cur-1'] }),
    },
    put: (id, body) => {
      const d = mock.learners[id];
      Object.assign(d, { schoolid: body.schoolid, schoolname: schoolName(body.schoolid), standard: body.standard, curriculumids: body.curriculumids });
      return json(200, { schooluserid: id, username: d.schoolusername, schoolid: body.schoolid, schoolname: d.schoolname, push: { status: 'pushed', message: PUSHED(d.schoolname) } });
    },
    schools: SCHOOLS,
    requests: [],
    gets: [],
    listReads: 0,
    holdGet: {},
    holdPlacement: {},
    publication: {},
    publicationReads: [],
    statusMissing: false,
    unmocked: [],
    grades: {},
    gradeReads: [],
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

/** The rows of `GET school/:schoolid/curriculums`: each carries its `publicationstatus`. */
const annotate = (mock: Mock, rows: Array<Record<string, any>>) =>
  rows.map((c) => (mock.statusMissing ? c : { ...c, publicationstatus: mock.publication[c.curriculumid] ?? 'published' }));

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
    const d = mock.learners[detailsPath[1]];
    return route.fulfill(d ? json(200, d) : json(404, { code: 'NOT_FOUND', errormessage: 'No such learner.' }));
  }
  const movePath = /^student\/([^/]+)\/school$/.exec(path);
  if (method === 'PUT' && movePath) {
    mock.requests.push({ method, path, body: request.postDataJSON() });
    if (mock.holdPut) await mock.holdPut;
    return route.fulfill(mock.put(movePath[1], request.postDataJSON()));
  }
  if (method === 'POST' && path === 'student') {
    mock.listReads++;
    const rows = Object.values(mock.learners).map((d, i) => listRow(d, i + 1));
    return route.fulfill(json(200, { data: { data: rows, total: rows.length } }));
  }
  if (method === 'POST' && path === 'school') {
    mock.gets.push('POST school');
    return mock.schools === 'fail' ? route.fulfill(json(500, { code: 'SERVER_ERROR', errormessage: 'Something went wrong.' })) : route.fulfill(json(200, { data: { data: mock.schools, total: mock.schools.length } }));
  }
  const classes = /^standard\/school\/([^/]+)$/.exec(path);
  if (method === 'GET' && classes) {
    mock.gets.push(path);
    const hold = mock.holdPlacement[classes[1]];
    if (hold) await hold;
    return route.fulfill(json(200, { data: CLASSES[classes[1]] ?? [] }));
  }
  const curricula = /^school\/([^/]+)\/curriculums$/.exec(path);
  if (method === 'GET' && curricula) {
    mock.gets.push(path);
    return route.fulfill(json(200, { data: annotate(mock, CURRICULA[curricula[1]] ?? []) }));
  }
  // Each curriculum's publication state (the pickers offer only published ones).
  const publication = /^curriculum\/publication\/([^/]+)$/.exec(path);
  if (method === 'GET' && publication) {
    // The state comes on the curriculum rows; a request to this route is a regression, and is recorded.
    mock.publicationReads.push(publication[1]);
    return route.fulfill(json(404, { error: true }));
  }
  const gradesOf = /^grade\/curriculum\/(.+)$/.exec(path);
  if (method === 'GET' && gradesOf) {
    mock.gradeReads.push(gradesOf[1]);
    return route.fulfill(gradesAnswer(mock.grades, gradesOf[1]));
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
const drawer = (page: Page, username = 'dara1') => page.getByRole('dialog', { name: `Move ${username}` });
const schoolSelect = (page: Page) => page.locator('#move-learner-school');
const classSelect = (page: Page) => page.locator('#move-learner-class');
const curriculaSelect = (page: Page) => page.locator('#move-learner-curricula');
const move = (page: Page, username = 'dara1') => drawer(page, username).getByRole('button', { name: /^(Move|Moving…)$/ });
const focusedLabel = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName ?? '');
const bodyOf = (mock: Mock, i = 0) => mock.requests[i]?.body as Record<string, unknown>;
const errorOf = (page: Page, selector: string) => page.locator('.field', { has: page.locator(selector) }).locator('.field-error');

async function openMove(page: Page, username = 'dara1'): Promise<void> {
  await actions(page, username).click();
  await menuItem(page, 'Move to another school').click();
  await expect(drawer(page, username).getByRole('heading', { name: `Move ${username}`, exact: true })).toBeVisible();
  await expect(schoolSelect(page)).toBeVisible();
  // The drawer slides in from the right; wait until it has stopped before pointing at it.
  let before = -1;
  await expect
    .poll(async () => {
      const x = (await drawer(page, username).boundingBox())?.x ?? -2;
      const still = x === before;
      before = x;
      return still;
    })
    .toBe(true);
}

async function pick(page: Page, select: 'school' | 'class' | 'curricula', option: string): Promise<void> {
  await page.locator(`#move-learner-${select} .ant-select-selector`).click();
  await page.locator('.ant-select-item-option', { hasText: option }).first().click();
  if (select === 'curricula') await page.keyboard.press('Escape');
}

/** Chooses a school, a class and the curricula the person wants, ready to press Move. */
async function fill(page: Page, school: string, klass: string): Promise<void> {
  await pick(page, 'school', school);
  await pick(page, 'class', klass);
}

test.describe('Move to another school: the menu item', () => {
  test('it comes right after Edit details and only where the Manage menu is', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await actions(page, 'dara1').click();
    await expect(page.getByRole('menuitem')).toHaveText(['Edit details', 'Move to another school', 'Reset password', 'Disable']);
    await expect(menuItem(page, 'Move to another school')).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('without the update permission there is no way to open it', async ({ context }) => {
    const page = await openLearners(context, newMock(), WITHOUT);
    await expect(page.getByRole('button', { name: /^Manage / })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Move to another school' })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('with no other school of the learner\'s organisation it is disabled, says why, and opens nothing', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await actions(page, 'visal4').click();
    const item = menuItem(page, 'Move to another school');
    await expect(item).toHaveAttribute('aria-disabled', 'true');
    await expect(item).toHaveAttribute('aria-description', 'There is no other school to move to.');
    await item.hover();
    await expect(page.locator('.ant-tooltip-inner')).toHaveText('There is no other school to move to.');
    await item.click({ force: true });
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('the schools offered are those of the learner\'s organisation, never the current one', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await openMove(page);
    await schoolSelect(page).locator('.ant-select-selector').click();
    await expect(page.locator('.ant-select-item-option')).toHaveText(['Lakeside School', 'Hilltop School']);
  });

  test('a learner of another organisation is offered that organisation\'s schools only', async ({ context }) => {
    const mock = newMock();
    mock.schools = [...SCHOOLS, { schoolid: 'school-y', schoolname: 'Bayview School', organisationid: 'org-2' }];
    const page = await openLearners(context, mock);
    await openMove(page, 'visal4');
    await schoolSelect(page).locator('.ant-select-selector').click();
    await expect(page.locator('.ant-select-item-option')).toHaveText(['Bayview School']);
  });

  test('the Learners page asks for the schools once, however many things use them', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock, [...WITH, 'create_student']);
    expect(mock.gets.filter((g) => g === 'POST school')).toHaveLength(1);
    await openMove(page);
    await schoolSelect(page).locator('.ant-select-selector').click();
    await expect(page.locator('.ant-select-item-option')).toHaveText(['Lakeside School', 'Hilltop School']);
    await page.keyboard.press('Escape');
    await drawer(page).getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Upload Users' }).click();
    await page.locator('.ant-modal-content', { hasText: 'Upload Users' }).locator('.ant-select-selector').first().click();
    await expect(page.locator('.ant-select-item-option')).toHaveText(['North Valley School', 'Lakeside School', 'Hilltop School', 'Far Away School']);
    expect(mock.gets.filter((g) => g === 'POST school')).toHaveLength(1);
  });

  test('after the first schools request failed, a successful Try again lets the Upload Users list show the schools', async ({ context }) => {
    const mock = newMock();
    mock.schools = 'fail';
    const page = await openLearners(context, mock, [...WITH, 'create_student']);
    await actions(page, 'dara1').click();
    await menuItem(page, 'Move to another school').click();
    await expect(page.getByTestId('move-learner-load-error')).toContainText("The schools couldn't be loaded.");
    mock.schools = SCHOOLS;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(schoolSelect(page)).toBeVisible();
    await drawer(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(drawer(page)).toBeHidden();
    await page.getByRole('button', { name: 'Upload Users' }).click();
    await page.locator('.ant-modal-content', { hasText: 'Upload Users' }).locator('.ant-select-selector').first().click();
    await expect(page.locator('.ant-select-item-option')).toHaveText(['North Valley School', 'Lakeside School', 'Hilltop School', 'Far Away School']);
  });

  test('when the schools cannot be read the item stays usable and the drawer says so, with Try again', async ({ context }) => {
    const mock = newMock();
    mock.schools = 'fail';
    const page = await openLearners(context, mock);
    await actions(page, 'dara1').click();
    await expect(menuItem(page, 'Move to another school')).not.toHaveAttribute('aria-disabled', 'true');
    await menuItem(page, 'Move to another school').click();
    await expect(page.getByTestId('move-learner-load-error')).toContainText("The schools couldn't be loaded.");
    mock.schools = SCHOOLS;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(schoolSelect(page)).toBeVisible();
  });
});

test.describe('Move to another school: the form', () => {
  test('the title names the learner, the note says results move, and nothing is sent by opening it', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openMove(page);
    await expect(page.getByTestId('move-results-note')).toHaveText('Past results move with the learner.');
    await expect(drawer(page).getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(move(page)).toBeVisible();
    expect(mock.requests).toEqual([]);
    expect(mock.gets).toContain('student/lu-1/details');
    expect(mock.unmocked.filter((r) => !r.endsWith('/all'))).toEqual([]);
  });

  test('the class and curricula are empty and disabled until a school is chosen', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openMove(page);
    await expect(classSelect(page)).toHaveClass(/ant-select-disabled/);
    await expect(curriculaSelect(page)).toHaveClass(/ant-select-disabled/);
    await expect(classSelect(page)).not.toContainText('Class');
    expect(mock.gets.filter((g) => g.startsWith('standard/') || g.endsWith('/curriculums'))).toEqual([]);
  });

  test('choosing a school reads its classes and curricula and keeps the learner\'s curricula that it has', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openMove(page);
    await pick(page, 'school', 'Lakeside School');
    await expect(classSelect(page)).not.toHaveClass(/ant-select-disabled/);
    expect(mock.gets).toContain('standard/school/school-b');
    expect(mock.gets).toContain('school/school-b/curriculums');
    // dara1 has Reading Basics and Number Skills; Lakeside has Reading Basics, History Tales (and a deleted one without a name).
    await expect(curriculaSelect(page).locator('.ant-select-selection-item')).toHaveText(['Reading Basics']);
    await curriculaSelect(page).locator('.ant-select-selector').click();
    await expect(page.locator('.ant-select-item-option')).toHaveText(['Reading Basics', 'History Tales']);
  });

  test('curricula chosen before the school\'s classes arrive are not replaced by the learner\'s kept ones', async ({ context }) => {
    const mock = newMock();
    let release!: () => void;
    mock.holdPlacement['school-b'] = new Promise<void>((resolve) => (release = resolve));
    const page = await openLearners(context, mock);
    await openMove(page);
    await pick(page, 'school', 'Lakeside School');
    await pick(page, 'curricula', 'History Tales');
    await expect(curriculaSelect(page).locator('.ant-select-selection-item')).toHaveText(['History Tales']);
    release();
    await expect(classSelect(page).locator('.ant-select-selector')).toBeVisible();
    await classSelect(page).locator('.ant-select-selector').click();
    await expect(page.locator('.ant-select-item-option')).toHaveText(['Class 5B', 'Class 6B']);
    await page.keyboard.press('Escape');
    await expect(curriculaSelect(page).locator('.ant-select-selection-item')).toHaveText(['History Tales']);
  });

  test('a school that has none of the learner\'s curricula starts with none chosen', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await openMove(page);
    await pick(page, 'school', 'Hilltop School');
    await expect(classSelect(page)).not.toHaveClass(/ant-select-disabled/);
    await expect(curriculaSelect(page).locator('.ant-select-selection-item')).toHaveCount(0);
  });

  test('changing the school clears the class and reads the new school\'s lists', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await openMove(page);
    await fill(page, 'Lakeside School', 'Class 5B');
    await expect(classSelect(page)).toContainText('Class 5B');
    await pick(page, 'school', 'Hilltop School');
    await expect(classSelect(page).locator('.ant-select-selection-item')).toHaveCount(0);
    await classSelect(page).locator('.ant-select-selector').click();
    await expect(page.locator('.ant-select-item-option')).toHaveText(['Class 7C']);
  });

  test('a slow answer for a school chosen earlier does not replace the later school\'s lists', async ({ context }) => {
    const mock = newMock();
    let release!: () => void;
    mock.holdPlacement['school-b'] = new Promise<void>((resolve) => (release = resolve));
    const page = await openLearners(context, mock);
    await openMove(page);
    await pick(page, 'school', 'Lakeside School');
    await pick(page, 'school', 'Hilltop School');
    await classSelect(page).locator('.ant-select-selector').click();
    await expect(page.locator('.ant-select-item-option')).toHaveText(['Class 7C']);
    release();
    await page.waitForTimeout(500);
    await expect(page.locator('.ant-select-item-option')).toHaveText(['Class 7C']);
  });

  test('Move with nothing chosen names each missing field and sends nothing', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openMove(page);
    await move(page).click();
    await expect(errorOf(page, '#move-learner-school')).toHaveText('Choose a school.');
    await expect(errorOf(page, '#move-learner-class')).toHaveText('Choose a class.');
    await expect(errorOf(page, '#move-learner-curricula')).toHaveText('Choose at least one curriculum.');
    expect(mock.requests).toEqual([]);
  });
});

test.describe('Move to another school: moving', () => {
  test('the request carries the three keys, the row shows the new school and class, and focus returns to the row', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    const readsBefore = mock.listReads;
    await openMove(page);
    await fill(page, 'Lakeside School', 'Class 6B');
    await pick(page, 'curricula', 'History Tales');
    await move(page).click();
    await expect(drawer(page)).toBeHidden();
    expect(mock.requests).toHaveLength(1);
    expect(mock.requests[0].method).toBe('PUT');
    expect(mock.requests[0].path).toBe('student/lu-1/school');
    expect(bodyOf(mock)).toEqual({ schoolid: 'school-b', standard: 'class-b6', curriculumids: ['cur-1', 'cur-4'], gradeid: 'gr-cur-1-1' });
    expect(Object.keys(bodyOf(mock)).sort()).toEqual(['curriculumids', 'gradeid', 'schoolid', 'standard']);
    await expect(row(page, 'dara1')).toContainText('Lakeside School');
    await expect(row(page, 'dara1')).toContainText('Class 6B');
    expect(mock.listReads, 'the list page is read again').toBeGreaterThan(readsBefore);
    await expect(toasts(page)).toHaveText(PUSHED('Lakeside School'));
    await expect.poll(() => focusedLabel(page)).toBe('Manage dara1');
  });

  for (const [label, status, text, kind] of [
    ['a skipped push', 'skipped', SKIPPED, 'info'],
    ['a push that did not get an answer', 'failed', FAILED, 'warning'],
    ['a push that lacks the class or curriculum', 'failed', MISSING, 'warning'],
  ] as const) {
    test(`${label} shows central's own sentence, the row is updated and ${status === 'failed' ? 'the notice stays' : 'the notice is plain'}`, async ({ context }) => {
      const mock = newMock();
      mock.put = (id, body) => {
        const d = mock.learners[id];
        Object.assign(d, { schoolid: body.schoolid, schoolname: schoolName(body.schoolid), standard: body.standard, curriculumids: body.curriculumids });
        return json(200, { schooluserid: id, username: d.schoolusername, schoolid: body.schoolid, schoolname: d.schoolname, push: { status, message: text(d.schoolname) } });
      };
      const page = await openLearners(context, mock);
      await openMove(page);
      await fill(page, 'Hilltop School', 'Class 7C');
      await pick(page, 'curricula', 'Garden Science');
      await move(page).click();
      await expect(drawer(page)).toBeHidden();
      await expect(toasts(page)).toHaveText(text('Hilltop School'));
      await expect(page.locator(`.ant-notification-notice-icon-${kind}`)).toHaveCount(1);
      await expect(row(page, 'dara1')).toContainText('Hilltop School');
      await expect(row(page, 'dara1')).toContainText('Class 7C');
      if (status === 'failed') {
        // A failed push says to run a sync, so its notice is not on a timer.
        await page.waitForTimeout(5500);
        await expect(toasts(page)).toHaveText(text('Hilltop School'));
      }
    });
  }

  test('the pushed notice goes by itself', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await openMove(page);
    await fill(page, 'Lakeside School', 'Class 5B');
    await move(page).click();
    await expect(toasts(page)).toHaveText(PUSHED('Lakeside School'));
    // The notice opens at the bottom right, where the pressed button was: a notice under the pointer stays, so move it off.
    await page.mouse.move(5, 5);
    await expect(toasts(page)).toHaveCount(0, { timeout: 9000 });
  });

  test('a disabled learner can be moved, and stays disabled in the list', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openMove(page, 'sokha2');
    await fill(page, 'Lakeside School', 'Class 5B');
    await pick(page, 'curricula', 'Reading Basics');
    await move(page, 'sokha2').click();
    await expect(drawer(page, 'sokha2')).toBeHidden();
    expect(mock.requests[0].path).toBe('student/lu-2/school');
    await expect(row(page, 'sokha2')).toContainText('Lakeside School');
    await expect(actions(page, 'sokha2')).toBeVisible();
  });

  test('a second click on Move while it is saving sends nothing more', async ({ context }) => {
    const mock = newMock();
    let release!: () => void;
    mock.holdPut = new Promise<void>((resolve) => (release = resolve));
    const page = await openLearners(context, mock);
    await openMove(page);
    await fill(page, 'Lakeside School', 'Class 5B');
    await move(page).click();
    await expect.poll(() => mock.requests.length).toBe(1);
    await expect(move(page)).toHaveText('Moving…');
    await expect(move(page)).toBeDisabled();
    await move(page).click({ force: true });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    expect(mock.requests).toHaveLength(1);
    // The drawer does not close while the move is on its way.
    await drawer(page).getByRole('button', { name: 'Cancel' }).click({ force: true });
    await expect(drawer(page)).toBeVisible();
    release();
    await expect(drawer(page)).toBeHidden();
    expect(mock.requests).toHaveLength(1);
  });
});

test.describe('Move to another school: refusals', () => {
  test('a 400 puts each sentence under its field and the drawer stays', async ({ context }) => {
    const mock = newMock();
    mock.put = () =>
      json(400, {
        code: 'INVALID_INPUT',
        errormessage: 'Check the highlighted fields.',
        fields: [
          { field: 'schoolid', message: 'Choose a different school.' },
          { field: 'standard', message: 'That class is not one of this school.' },
          { field: 'curriculumids', message: 'Choose at least one curriculum of this school.' },
        ],
      });
    const page = await openLearners(context, mock);
    await openMove(page);
    await fill(page, 'Lakeside School', 'Class 5B');
    await move(page).click();
    await expect(errorOf(page, '#move-learner-school')).toHaveText('Choose a different school.');
    await expect(errorOf(page, '#move-learner-class')).toHaveText('That class is not one of this school.');
    await expect(errorOf(page, '#move-learner-curricula')).toHaveText('Choose at least one curriculum of this school.');
    await expect(drawer(page)).toBeVisible();
    expect(await toasts(page).count(), 'a validation failure is never a toast').toBe(0);
    await expect(row(page, 'dara1')).toContainText('North Valley School');
    // Choosing again clears that field's message and nothing else.
    await pick(page, 'school', 'Hilltop School');
    await expect(errorOf(page, '#move-learner-school')).toHaveCount(0);
  });

  test('a 400 with no field passes central\'s sentence on, such as choosing an organisation', async ({ context }) => {
    const mock = newMock();
    mock.put = () => json(400, { code: 'INVALID_INPUT', errormessage: 'Choose an organisation.' });
    const page = await openLearners(context, mock);
    await openMove(page);
    await fill(page, 'Lakeside School', 'Class 5B');
    await move(page).click();
    await expect(page.getByTestId('move-form-error')).toHaveText('Choose an organisation.');
    await expect(drawer(page)).toBeVisible();
  });

  for (const [status, message] of [
    [404, 'That student doesn\'t exist.'],
    [409, MORE_THAN_ONE],
    [500, 'The server stumbled on a pebble.'],
    [503, 'The service is resting. Try in a minute.'],
  ] as const) {
    test(`a ${status} shows central's own sentence once, the drawer stays and Move can be pressed again`, async ({ context }) => {
      const mock = newMock();
      mock.put = () => json(status, { code: 'ERR', errormessage: message });
      const page = await openLearners(context, mock);
      await openMove(page);
      await fill(page, 'Lakeside School', 'Class 5B');
      await move(page).click();
      await expect(page.getByTestId('move-form-error')).toHaveText(message);
      expect(await toasts(page).count(), 'one message, not two').toBe(0);
      await expect(drawer(page)).toBeVisible();
      await expect(row(page, 'dara1')).toContainText('North Valley School');
      await expect(move(page)).toBeEnabled();
      await expect(move(page)).toBeFocused();
    });
  }

  test('a refusal with no sentence of its own gets a fixed one', async ({ context }) => {
    const mock = newMock();
    mock.put = () => ({ status: 500, contentType: 'text/html', body: '<html>oops</html>' });
    const page = await openLearners(context, mock);
    await openMove(page);
    await fill(page, 'Lakeside School', 'Class 5B');
    await move(page).click();
    await expect(page.getByTestId('move-form-error')).toHaveText("The learner couldn't be moved. Try again.");
  });

  test('a learner that no longer exists says so when the drawer is opened', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    delete mock.learners['lu-1'];
    await actions(page, 'dara1').click();
    await menuItem(page, 'Move to another school').click();
    await expect(page.getByTestId('move-learner-load-error')).toContainText('That learner no longer exists. Close this and try again.');
  });
});

test.describe('Move to another school: closing', () => {
  test('Cancel changes nothing, sends nothing and returns focus to the row', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openMove(page);
    await fill(page, 'Lakeside School', 'Class 5B');
    await drawer(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(drawer(page)).toBeHidden();
    expect(mock.requests).toEqual([]);
    await expect(row(page, 'dara1')).toContainText('North Valley School');
    await expect.poll(() => focusedLabel(page)).toBe('Manage dara1');
    // Opening again starts empty, not from the abandoned choice.
    await openMove(page);
    await expect(schoolSelect(page).locator('.ant-select-selection-item')).toHaveCount(0);
    await expect(classSelect(page)).toHaveClass(/ant-select-disabled/);
  });

  test('Escape changes nothing and sends nothing', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openMove(page);
    await page.locator('#move-learner-school-input').focus();
    await page.keyboard.press('Escape');
    if (await drawer(page).isVisible()) await page.keyboard.press('Escape');
    await expect(drawer(page)).toBeHidden();
    expect(mock.requests).toEqual([]);
    await expect(row(page, 'dara1')).toContainText('North Valley School');
    await expect.poll(() => focusedLabel(page)).toBe('Manage dara1');
  });

  test('the Close button and a click on the mask close it too', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    await openMove(page);
    await drawer(page).getByRole('button', { name: 'Close', exact: true }).first().click();
    await expect(drawer(page)).toBeHidden();
    await openMove(page);
    await page.mouse.click(20, 400);
    await expect(drawer(page)).toBeHidden();
    expect(mock.requests).toEqual([]);
  });

  test('a skeleton shows while the learner is read, and a late answer for an earlier opening is dropped', async ({ context }) => {
    const mock = newMock();
    let release!: () => void;
    mock.holdGet['lu-1'] = new Promise<void>((resolve) => (release = resolve));
    const page = await openLearners(context, mock);
    await actions(page, 'dara1').click();
    await menuItem(page, 'Move to another school').click();
    await expect(page.getByTestId('move-learner-loading')).toBeVisible();
    await expect(move(page)).toBeDisabled();
    await drawer(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(drawer(page)).toBeHidden();
    await openMove(page, 'maly3');
    release();
    await page.waitForTimeout(500);
    await expect(drawer(page, 'maly3')).toBeVisible();
    await expect(schoolSelect(page).locator('.ant-select-selection-item')).toHaveCount(0);
  });
});

test.describe('Move to another school: keyboard only', () => {
  test('from the row to Move: open, school, class, curricula, Move, then the notice and focus on the row', async ({ context }) => {
    const mock = newMock();
    const page = await openLearners(context, mock);
    const button = actions(page, 'dara1');
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(menuItem(page, 'Edit details')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(menuItem(page, 'Move to another school')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(drawer(page).getByRole('heading', { name: 'Move dara1', exact: true })).toBeVisible();
    await expect(schoolSelect(page).locator('input')).toBeFocused();
    // School: the list opens with the arrow and Enter takes the highlighted school.
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.ant-select-item-option').first()).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(schoolSelect(page)).toContainText('Lakeside School');
    const tabTo = async (target: ReturnType<Page['locator']>, what: string) => {
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Tab');
        if (await target.evaluate((el) => el === document.activeElement || el.contains(document.activeElement)).catch(() => false)) return;
      }
      throw new Error(`Tab did not reach ${what}`);
    };
    await tabTo(classSelect(page), 'Class');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.ant-select-item-option').first()).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(classSelect(page)).toContainText('Class 5B');
    await tabTo(curriculaSelect(page), 'Curricula');
    await expect(curriculaSelect(page).locator('.ant-select-selection-item')).toHaveText(['Reading Basics']);
    await tabTo(drawer(page).getByRole('button', { name: 'Cancel' }), 'Cancel');
    await tabTo(move(page), 'Move');
    await page.keyboard.press('Enter');
    await expect(drawer(page)).toBeHidden();
    expect(mock.requests).toEqual([{ method: 'PUT', path: 'student/lu-1/school', body: { schoolid: 'school-b', standard: 'class-b5', curriculumids: ['cur-1'], gradeid: 'gr-cur-1-1' } }]);
    await expect(toasts(page)).toHaveText(PUSHED('Lakeside School'));
    await expect(row(page, 'dara1')).toContainText('Lakeside School');
    await expect.poll(() => focusedLabel(page)).toBe('Manage dara1');
  });
});

test.describe('Move to another school: the other menu items', () => {
  test('Edit details and Reset password still open their own things', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await actions(page, 'dara1').click();
    await menuItem(page, 'Reset password').click();
    await expect(page.getByRole('dialog', { name: 'Reset password' })).toBeVisible();
    await expect(drawer(page)).toHaveCount(0);
  });
});

test.describe('Move to another school: screenshots', () => {
  test.skip(!SHOTS, 'set E2E_SHOTS_DIR to write the screenshots');
  test('the menu with the item and the filled drawer', async ({ context }) => {
    const page = await openLearners(context, newMock());
    await actions(page, 'dara1').click();
    await expect(menuItem(page, 'Move to another school')).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/move-menu.png` });
    await menuItem(page, 'Move to another school').click();
    await expect(schoolSelect(page)).toBeVisible();
    await fill(page, 'Lakeside School', 'Class 5B');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SHOTS}/move-drawer.png` });
  });
});

test.describe('only published curricula are offered', () => {
  const offered = (page: Page) => page.locator('.ant-select-item-option').allTextContents().then((t) => t.map((x) => x.trim()));

  test('a curriculum never published or retired is not offered', async ({ context }) => {
    const mock = newMock();
    // The second school lists Reading Basics (cur-1), History Tales (cur-4) and one deleted curriculum.
    mock.publication = { 'cur-4': 'never' };
    const page = await openLearners(context, mock);
    await openMove(page);
    await pick(page, 'school', 'Lakeside School');
    await expect(curriculaSelect(page)).toBeVisible();
    await curriculaSelect(page).locator('.ant-select-selector').click();
    await expect.poll(() => offered(page)).toEqual(['Reading Basics']);
    expect(mock.publicationReads, 'the state comes on the curriculum rows: no per-curriculum request').toEqual([]);
  });

  test('a retired curriculum the learner already has is kept across the move, labelled (retired); a new pick never offers an unpublished one', async ({ context }) => {
    const mock = newMock();
    // dara1 holds cur-1 and cur-2; the second school lists cur-1 and cur-4.
    mock.publication = { 'cur-1': 'withdrawn', 'cur-4': 'never' };
    const page = await openLearners(context, mock);
    await openMove(page);
    await pick(page, 'school', 'Lakeside School');
    await pick(page, 'class', 'Class 5B');
    await expect(curriculaSelect(page)).toContainText('Reading Basics (retired)');
    await curriculaSelect(page).locator('.ant-select-selector').click();
    await expect.poll(() => offered(page)).toEqual(['Reading Basics (retired)']);
    await page.keyboard.press('Escape');
    await move(page).click();
    await expect(drawer(page)).toBeHidden();
    expect(bodyOf(mock)).toMatchObject({ schoolid: 'school-b', curriculumids: ['cur-1'] });
  });

  test('the grade hint names a retired primary curriculum the learner already has, with its label', async ({ context }) => {
    const mock = newMock();
    mock.publication = { 'cur-1': 'withdrawn' };
    mock.learners['lu-1'] = learner(1, 'dara1', 'Dara', { curriculumid: 'cur-1', gradeid: 'gr-cur-1-2', curriculumids: ['cur-1'] });
    mock.grades['cur-1'] = [grade('cur-1', 1), grade('cur-1', 2)];
    const page = await openLearners(context, mock);
    await openMove(page);
    await fill(page, 'Lakeside School', 'Class 5B');
    await expect(page.getByTestId('grade-hint')).toHaveText('In Reading Basics (retired)');
  });

  test("central's 400 on curriculumids is shown under the Curriculum field, in its own words", async ({ context }) => {
    const mock = newMock();
    const SAYS = 'Publish History Tales first, or choose another curriculum.';
    mock.put = () => json(400, { code: 'INVALID_INPUT', errormessage: 'Invalid input.', fields: [{ field: 'curriculumids', message: SAYS }] });
    const page = await openLearners(context, mock);
    await openMove(page);
    await pick(page, 'school', 'Lakeside School');
    await pick(page, 'class', 'Class');
    await move(page).click();
    await expect(errorOf(page, '#move-learner-curricula')).toHaveText(SAYS);
    expect(await toasts(page).count(), 'a validation failure is not a toast').toBe(0);
  });
});

test.describe('Move to another school: the grade', () => {
  const gradeField = (page: Page) => page.locator('#move-learner-grade');
  const MESSAGE = 'Choose a grade for this student.';

  test('with the grade central knows, the learner\'s own grade is preselected and sent when the primary curriculum is kept', async ({ context }) => {
    const mock = newMock();
    mock.learners['lu-1'] = learner(1, 'dara1', 'Dara', { curriculumid: 'cur-1', gradeid: 'gr-cur-1-2' });
    mock.grades['cur-1'] = [grade('cur-1', 1), grade('cur-1', 2)];
    const page = await openLearners(context, mock);
    await openMove(page);
    await fill(page, 'Lakeside School', 'Class 6B');
    await expect(gradeField(page)).toContainText('Grade 2');
    await expect(page.getByTestId('grade-hint')).toHaveText('In Reading Basics');
    await move(page).click();
    await expect(drawer(page)).toBeHidden();
    expect(bodyOf(mock).gradeid).toBe('gr-cur-1-2');
  });

  test('a learner with no grade on a several-grade primary curriculum that is kept must still choose one: required, blocked, then sent', async ({ context }) => {
    const mock = newMock();
    mock.learners['lu-1'] = learner(1, 'dara1', 'Dara', { curriculumid: 'cur-1', gradeid: null as never });
    mock.grades['cur-1'] = [grade('cur-1', 1), grade('cur-1', 2)];
    const page = await openLearners(context, mock);
    await openMove(page);
    await fill(page, 'Lakeside School', 'Class 6B');
    await expect(page.locator('label[for="move-learner-grade-input"] .req')).toHaveCount(1);
    await expect(gradeField(page)).not.toContainText('Keep the current grade');
    mock.requests.length = 0;
    await move(page).click();
    await expect(page.getByTestId('grade-error')).toHaveText(MESSAGE);
    expect(mock.requests, 'nothing is sent without a grade').toEqual([]);
    await gradeField(page).locator('.ant-select-selector').click();
    await page.locator('.ant-select-item-option', { hasText: 'Grade 2' }).click();
    await move(page).click();
    await expect(drawer(page)).toBeHidden();
    expect(bodyOf(mock).gradeid).toBe('gr-cur-1-2');
  });

  test('a new primary curriculum with several grades needs a choice; none sends nothing and names the field', async ({ context }) => {
    const mock = newMock();
    mock.learners['lu-1'] = learner(1, 'dara1', 'Dara', { curriculumid: 'cur-1', gradeid: 'gr-cur-1-2', curriculumids: ['cur-1'] });
    mock.grades['cur-1'] = [grade('cur-1', 1), grade('cur-1', 2)];
    mock.grades['cur-4'] = [grade('cur-4', 1), grade('cur-4', 2)];
    const page = await openLearners(context, mock);
    await openMove(page);
    await fill(page, 'Lakeside School', 'Class 6B');
    // the school does not have Reading Basics for this learner: pick History Tales (two grades of its own), which is then primary
    await pick(page, 'curricula', 'History Tales');
    await page.locator('#move-learner-curricula .ant-select-selection-item', { hasText: 'Reading Basics' }).locator('.ant-select-selection-item-remove').click();
    await expect(page.getByTestId('grade-hint')).toHaveText('In History Tales');
    await expect(gradeField(page)).not.toContainText('Grade 2');
    mock.requests.length = 0;
    await move(page).click();
    await expect(page.getByTestId('grade-error')).toHaveText(MESSAGE);
    expect(mock.requests).toEqual([]);
  });

  test('the API refusing the grade shows under the curriculum field when the grade is not asked for', async ({ context }) => {
    const mock = newMock();
    mock.put = () => json(400, { error: true, code: 'INVALID_INPUT', errormessage: 'Check the highlighted fields.', fields: [{ field: 'gradeid', message: MESSAGE }] });
    const page = await openLearners(context, mock);
    await openMove(page);
    await fill(page, 'Lakeside School', 'Class 6B');
    await move(page).click();
    await expect(page.getByTestId('grade-under-curriculum')).toHaveText(MESSAGE);
    await expect(drawer(page)).toBeVisible();
  });

  test('a curriculum with no grade blocks the move and says so', async ({ context }) => {
    const mock = newMock();
    mock.grades['cur-1'] = [];
    const page = await openLearners(context, mock);
    await openMove(page);
    await fill(page, 'Lakeside School', 'Class 6B');
    await expect(page.getByTestId('grade-under-curriculum')).toHaveText("This curriculum has no grade yet, so a learner can't be put in it.");
    mock.requests.length = 0;
    await move(page).click();
    expect(mock.requests).toEqual([]);
  });
});

test.describe('Move to another school: a refusal on both the grade and the curriculum', () => {
  test('both fields show their own message, each under its own field, and nothing is a toast', async ({ context }) => {
    const mock = newMock();
    const CURRICULUM_SAYS = 'Publish Reading Basics first, or choose another curriculum.';
    const GRADE_SAYS = 'Choose a grade for this student.';
    mock.learners['lu-1'] = learner(1, 'dara1', 'Dara', { curriculumid: 'cur-1', gradeid: 'gr-cur-1-2' });
    mock.grades['cur-1'] = [grade('cur-1', 1), grade('cur-1', 2)];
    mock.put = () => json(400, { error: true, code: 'INVALID_INPUT', errormessage: 'Check the highlighted fields.', fields: [{ field: 'curriculumids', message: CURRICULUM_SAYS }, { field: 'gradeid', message: GRADE_SAYS }] });
    const page = await openLearners(context, mock);
    await openMove(page);
    await fill(page, 'Lakeside School', 'Class 6B');
    await move(page).click();
    await expect(errorOf(page, '#move-learner-curricula')).toHaveText(CURRICULUM_SAYS);
    await expect(page.getByTestId('grade-error')).toHaveText(GRADE_SAYS);
    expect(await toasts(page).count(), 'a validation failure is not a toast').toBe(0);
  });
});
