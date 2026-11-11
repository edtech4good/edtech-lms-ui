import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { API_URL, BASE_URL } from '../fixtures/env';

/**
 * What the admin shows now that central sends the organisation's set to the learning server itself after a school, a
 * class or the quiz-pass switch is saved, in a browser, with every answer from the API mocked (the sign-in is a token
 * written to the session; any host but the app's and the mocked API is refused, so nothing leaves the machine):
 * - a save whose push failed leaves one warning with central's own sentence, that stays until it is closed, on the
 *   school, class and organisation screens; a push that went, or was skipped, shows the usual success;
 * - a school name central refuses is shown under the name field, not as a notice;
 * - the notices that stay (a refused sync, a failed push) close when the route changes, and a refused sync that needs
 *   Sync Content offers a link to the Curriculum list, once however often the sync is pressed;
 * - the quiz-pass switch's help text.
 *
 * Run it against a production or local build served on E2E_BASE_URL (E2E_API_URL is the API host of that build; the
 * session keys are E2E_ACCESS_KEYS as "algKey,payloadKey,hashKey"). The pickers of the learner forms are in
 * add-learner.spec.ts, edit-learner.spec.ts and move-learner.spec.ts.
 */
const ACCESS_KEYS = (process.env.E2E_ACCESS_KEYS ?? 'lms_access_alg,lms_access_payload,lms_access_hash').split(',');
const ADMIN_ROLE = 'zr5ER4QD';
const STAFF = ['view_school', 'create_school', 'update_school', 'delete_school', 'sync_students', 'view_standard', 'create_standard', 'update_standard', 'delete_standard', 'view_curriculum', 'sync_content'];
const PLATFORM = ['view_organisation', 'update_organisation'];

const COUNTRY = { countryid: 'country-1', countryname: 'Northland' };
const CURRICULUM = { curriculumid: 'cur-1', curriculumname: 'Reading Basics' };
const SCHOOL = { schoolid: 'school-a', schoolname: 'North Valley School', countryid: COUNTRY.countryid, curriculums: [CURRICULUM.curriculumid], uitheme: 'kids' };
const CLASS = { standardid: 'class-a1', standardname: 'Class 1A', schoolid: SCHOOL.schoolid, school: { schoolname: SCHOOL.schoolname } };
const ORG = {
  organisationid: 'org-1',
  organisationname: 'Harbour Learning Group',
  organisationcode: 'harbour',
  organisationshortname: 'HLG',
  organisationpreset: 'company',
  organisationstatus: true,
  uitheme: 'corporate',
  brandingconfig: null,
  contentlanguage: 'en',
  countries: [COUNTRY],
};

/** Central's sentences. */
const PUSH_FAILED = 'Saved, but the learning server did not answer. Run Sync Content on the Curricula screen to send it again.';
const NAME_TAKEN = 'A school with this name existed before. Choose another name.';
const MISSING_SCHOOL = "The learning server doesn't have this school or one of its classes yet. Run Sync Content, then Sync Students.";
const MISSING_CURRICULUM = "A curriculum these learners use isn't on the learning server. Publish it, then Sync Students.";
const HELP = "When on, a failed quiz can be retried as many times as needed. The lesson isn't complete until it is passed. Applies to quizzes learners take after this is saved. Earlier results are not recalculated.";

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
function sessionToken(claims: object): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ lmsuserid: 'staff-1', lmsuserrole: ADMIN_ROLE, firstname: 'Test', lastname: 'Admin', exp, iat: exp - 10, ...claims })}.c2ln`;
}
const json = (status: number, body: unknown) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

type Answer = ReturnType<typeof json>;
type Push = { status: 'pushed' | 'skipped' | 'failed'; message: string };
const PUSHED: Push = { status: 'pushed', message: "The learning server has the organisation's schools and classes." };
const SKIPPED: Push = { status: 'skipped', message: 'No learner server is set up here, so nothing was pushed.' };
const FAILED: Push = { status: 'failed', message: PUSH_FAILED };

interface Mock {
  /** What each write answers; a push is added to the 200s by `withPush`. */
  push: Push;
  /** Replaces a write's whole answer (a refusal). */
  refuse: Partial<Record<'schoolCreate' | 'schoolUpdate', Answer>>;
  /** What a sync answers. */
  syncAnswer: () => Answer;
  writes: string[];
  unmocked: string[];
}
const newMock = (): Mock => ({ push: PUSHED, refuse: {}, syncAnswer: () => json(409, { error: true, errormessage: MISSING_SCHOOL }), writes: [], unmocked: [] });

async function signIn(context: BrowserContext, mock: Mock, permissions: string[], claims: object = {}): Promise<void> {
  await context.addInitScript(
    ({ keys, token }) => {
      const [alg, payload, hash] = token.split('.');
      if (!sessionStorage.getItem(keys[0])) {
        sessionStorage.setItem(keys[0], alg);
        sessionStorage.setItem(keys[1], payload);
        sessionStorage.setItem(keys[2], hash);
      }
    },
    { keys: ACCESS_KEYS, token: sessionToken({ permissions, isplatform: false, organisationid: 'org-1', ...claims }) },
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
  const write = (name: string) => mock.writes.push(`${name} ${JSON.stringify(request.postDataJSON() ?? null)}`);
  const withPush = (data: unknown) => json(200, { error: false, data, push: mock.push });

  // schools
  if (method === 'POST' && path === 'school') return route.fulfill(json(200, { data: { data: [SCHOOL], total: 1 } }));
  if (method === 'POST' && path === 'school/create') {
    write('school create');
    return route.fulfill(mock.refuse.schoolCreate ?? withPush({ schoolid: 'school-new' }));
  }
  if (method === 'GET' && path === `school/${SCHOOL.schoolid}`) return route.fulfill(json(200, { data: SCHOOL }));
  if (method === 'PUT' && path === `school/update/${SCHOOL.schoolid}`) {
    write('school update');
    return route.fulfill(mock.refuse.schoolUpdate ?? withPush(true));
  }
  if (method === 'DELETE' && path === `school/${SCHOOL.schoolid}`) {
    write('school delete');
    return route.fulfill(withPush(true));
  }
  if (method === 'DELETE' && path.startsWith('school-contribute/deleteschoolcontribute/')) return route.fulfill(json(200, { data: true }));
  if (method === 'GET' && path.startsWith('school-contribute/getschoolcontribute/')) return route.fulfill(json(200, { data: [] }));
  if (method === 'POST' && path === 'country') return route.fulfill(json(200, { data: { data: [COUNTRY], total: 1 } }));
  if (method === 'GET' && path === `curriculum/country/${COUNTRY.countryid}`) return route.fulfill(json(200, { data: [CURRICULUM] }));
  if (method === 'POST' && path === 'curriculum') return route.fulfill(json(200, { data: { data: [], total: 0 } }));
  if (method === 'POST' && /^sync\/cloud\/[^/]+\/(students|teachers)$/.test(path)) return route.fulfill(mock.syncAnswer());

  // classes
  if (method === 'POST' && path === 'standard') return route.fulfill(json(200, { data: { data: [CLASS], total: 1 } }));
  if (method === 'POST' && path === 'standard/create') {
    write('class create');
    return route.fulfill(withPush({ standardid: 'class-new' }));
  }
  if (method === 'GET' && path === `standard/${CLASS.standardid}`) return route.fulfill(json(200, { data: CLASS }));
  if (method === 'PUT' && path === `standard/${CLASS.standardid}`) {
    write('class update');
    return route.fulfill(withPush(true));
  }
  if (method === 'DELETE' && path === `standard/${CLASS.standardid}`) {
    write('class delete');
    return route.fulfill(withPush(true));
  }

  // organisations
  if (method === 'GET' && path === 'organisation') return route.fulfill(json(200, { data: { data: [ORG], total: 1, pageindex: 1, pagesize: 10 } }));
  if (method === 'GET' && path === `organisation/${ORG.organisationid}`) return route.fulfill(json(200, { data: { ...ORG, requireLessonQuizPass: false } }));
  if (method === 'PUT' && path === `organisation/${ORG.organisationid}`) {
    write('organisation update');
    return route.fulfill(withPush({ ...ORG, requireLessonQuizPass: true }));
  }
  if (method === 'GET' && path === 'country/all') return route.fulfill(json(200, { data: [COUNTRY] }));

  mock.unmocked.push(`${method} ${path}`);
  return route.fulfill(json(200, { data: [] }));
}

async function open(context: BrowserContext, mock: Mock, path: string, ready: (page: Page) => Promise<void>, permissions = STAFF, claims: object = {}): Promise<Page> {
  await signIn(context, mock, permissions, claims);
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(path);
  await ready(page);
  return page;
}

const notices = (page: Page) => page.locator('.ant-notification-notice');
const titles = (page: Page) => page.locator('.ant-notification-notice-message');
const descriptions = (page: Page) => page.locator('.ant-notification-notice-description');
const schoolsReady = (page: Page) => expect(page.locator('tr', { hasText: SCHOOL.schoolname })).toHaveCount(1);
const classesReady = (page: Page) => expect(page.locator('tr', { hasText: CLASS.standardname })).toHaveCount(1);
const settled = (page: Page) => page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));

/** One warning with central's sentence, still there after the default duration, until it is closed. */
async function expectOneStayingWarning(page: Page, words = PUSH_FAILED): Promise<void> {
  await expect(notices(page).filter({ hasText: words })).toHaveCount(1);
  await expect(titles(page).first()).toHaveText('Saved');
  await page.waitForTimeout(800);
  expect(await notices(page).count(), 'one notice, not two (no success beside the warning)').toBe(1);
  await page.waitForTimeout(5500);
  expect(await notices(page).count(), 'still there after the default duration').toBe(1);
  await expect(descriptions(page).first()).toHaveText(words);
}

/** The count of notices once the page has settled and the success notice's own delay has passed. */
async function noticesAfterFence(page: Page): Promise<string[]> {
  await page.waitForTimeout(900);
  await settled(page);
  return descriptions(page).allTextContents();
}

test.describe('a school saved', () => {
  async function createSchool(page: Page): Promise<void> {
    await page.getByPlaceholder('Enter school name').fill('Lakeside School');
    await page.locator('nz-form-item', { hasText: 'Country' }).locator('.ant-select-selector').click();
    await page.locator('.ant-select-item-option', { hasText: COUNTRY.countryname }).click();
    await page.locator('nz-form-item', { hasText: 'Curriculums' }).locator('.ant-select-selector').click();
    await page.locator('.ant-select-item-option', { hasText: CURRICULUM.curriculumname }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Submit' }).click();
  }
  const createReady = (page: Page) => expect(page.getByPlaceholder('Enter school name')).toBeVisible();
  const editReady = async (page: Page) => {
    await createReady(page);
    await expect(page.getByPlaceholder('Enter school name')).toHaveValue(SCHOOL.schoolname);
  };

  for (const [what, push] of [['went', PUSHED], ['was skipped', SKIPPED]] as const) {
    test(`create, when the push ${what}, is the usual success and nothing stays`, async ({ context }) => {
      const mock = newMock();
      mock.push = push;
      const page = await open(context, mock, '/school/create', createReady);
      await createSchool(page);
      await expect(page).toHaveURL(/\/school\/index$/);
      expect(await noticesAfterFence(page)).toEqual(['School created sucessfully']);
      await expect(notices(page)).toHaveCount(0, { timeout: 10_000 });
    });
  }

  test('create, when the push failed, leaves one warning that stays, on the list, and no success', async ({ context }) => {
    const mock = newMock();
    mock.push = FAILED;
    const page = await open(context, mock, '/school/create', createReady);
    await createSchool(page);
    await expect(page).toHaveURL(/\/school\/index$/);
    await expectOneStayingWarning(page);
  });

  test('edit, when the push failed, leaves one warning that stays, on the list, and no success', async ({ context }) => {
    const mock = newMock();
    mock.push = FAILED;
    const page = await open(context, mock, `/school/update/${SCHOOL.schoolid}`, editReady);
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page).toHaveURL(/\/school\/index$/);
    await expectOneStayingWarning(page);
  });

  test('edit, when the push went, is the usual success', async ({ context }) => {
    const page = await open(context, newMock(), `/school/update/${SCHOOL.schoolid}`, editReady);
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page).toHaveURL(/\/school\/index$/);
    expect(await noticesAfterFence(page)).toEqual(['School updated successfully']);
  });

  async function deleteSchool(page: Page): Promise<void> {
    await page.locator('tr', { hasText: SCHOOL.schoolname }).getByText('Delete').click();
    await page.locator('.ant-popover button.ant-btn-primary').first().click();
  }

  test('delete, when the push failed, leaves one warning that stays and no success', async ({ context }) => {
    const mock = newMock();
    mock.push = FAILED;
    const page = await open(context, mock, '/school/index', schoolsReady);
    await deleteSchool(page);
    await expectOneStayingWarning(page);
  });

  test('delete, when the push went, is the usual success', async ({ context }) => {
    const page = await open(context, newMock(), '/school/index', schoolsReady);
    await deleteSchool(page);
    await expect(descriptions(page).filter({ hasText: 'School deleted sucessfully' })).toHaveCount(1);
    expect(await noticesAfterFence(page)).toEqual(['School deleted sucessfully']);
  });

  for (const [form, path, ready, button] of [
    ['create', '/school/create', createReady, 'create'],
    ['edit', `/school/update/${SCHOOL.schoolid}`, editReady, 'edit'],
  ] as const) {
    test(`${form}: a name a school held before is shown under the name field, in central's words, and nothing else`, async ({ context }) => {
      const mock = newMock();
      const refusal = json(409, { error: true, code: 'ALREADY_EXISTS', errormessage: NAME_TAKEN, fields: [{ field: 'schoolname', message: NAME_TAKEN }] });
      if (button === 'create') mock.refuse.schoolCreate = refusal;
      else mock.refuse.schoolUpdate = refusal;
      const page = await open(context, mock, path, ready);
      if (button === 'create') {
        await createSchool(page);
      } else {
        await page.getByPlaceholder('Enter school name').fill('Lakeside School');
        await page.getByRole('button', { name: 'Submit' }).click();
      }
      await expect(page.locator('nz-form-item', { hasText: 'School Name' }).locator('.ant-form-item-explain-error')).toHaveText(NAME_TAKEN);
      expect(await noticesAfterFence(page), 'a validation failure is not a notice').toEqual([]);
      await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}$`));
      // Changing the name takes the message away.
      await page.getByPlaceholder('Enter school name').fill('Lakeside School Two');
      await expect(page.locator('nz-form-item', { hasText: 'School Name' }).locator('.ant-form-item-explain-error')).toHaveCount(0);
    });
  }


  test("create: a name a live school holds is shown under the name field (409 on schoolname)", async ({ context }) => {
    const mock = newMock();
    const SAYS = 'That school already exists.';
    mock.refuse.schoolCreate = json(409, { error: true, code: 'ALREADY_EXISTS', errormessage: SAYS, fields: [{ field: 'schoolname', message: SAYS }] });
    const page = await open(context, mock, '/school/create', createReady);
    await createSchool(page);
    await expect(page.locator('nz-form-item', { hasText: 'School Name' }).locator('.ant-form-item-explain-error')).toHaveText(SAYS);
    expect(await noticesAfterFence(page)).toEqual([]);
  });

  test("edit: a change of organisation central refuses (409 on organisationid) is one notice, in central's words, and the form stays", async ({ context }) => {
    const mock = newMock();
    const SAYS = "A school can't be moved to another organisation yet. Create the school in the other organisation instead.";
    mock.refuse.schoolUpdate = json(409, { error: true, code: 'ALREADY_EXISTS', errormessage: SAYS, fields: [{ field: 'organisationid', message: SAYS }] });
    const page = await open(context, mock, `/school/update/${SCHOOL.schoolid}`, editReady);
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(descriptions(page)).toHaveText([SAYS]);
    await page.waitForTimeout(500);
    expect(await notices(page).count(), 'one notice').toBe(1);
    await expect(page).toHaveURL(/\/school\/update\//);
    await expect(page.locator('nz-form-item', { hasText: 'School Name' }).locator('.ant-form-item-explain-error')).toHaveCount(0);
  });
});

test.describe('a class saved', () => {
  const createReady = (page: Page) => expect(page.getByPlaceholder('Enter class name')).toBeVisible();
  const editReady = async (page: Page) => {
    await createReady(page);
    await expect(page.getByPlaceholder('Enter class name')).toHaveValue(CLASS.standardname);
  };
  async function createClass(page: Page): Promise<void> {
    await page.getByPlaceholder('Enter class name').fill('Class 2B');
    await page.locator('nz-form-item', { hasText: 'School Name' }).locator('.ant-select-selector').click();
    await page.locator('.ant-select-item-option', { hasText: SCHOOL.schoolname }).click();
    await page.getByRole('button', { name: 'Submit' }).click();
  }

  for (const [what, push] of [['went', PUSHED], ['was skipped', SKIPPED]] as const) {
    test(`create, when the push ${what}, is the usual success`, async ({ context }) => {
      const mock = newMock();
      mock.push = push;
      const page = await open(context, mock, '/standard/create', createReady);
      await createClass(page);
      await expect(page).toHaveURL(/\/standard\/index$/);
      expect(await noticesAfterFence(page)).toEqual(['Standard created successfully']);
    });
  }

  test('create, when the push failed, leaves one warning that stays, on the list, and no success', async ({ context }) => {
    const mock = newMock();
    mock.push = FAILED;
    const page = await open(context, mock, '/standard/create', createReady);
    await createClass(page);
    await expect(page).toHaveURL(/\/standard\/index$/);
    await expectOneStayingWarning(page);
  });

  test('edit, when the push failed, leaves one warning that stays, on the list, and no success', async ({ context }) => {
    const mock = newMock();
    mock.push = FAILED;
    const page = await open(context, mock, `/standard/update/${CLASS.standardid}`, editReady);
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page).toHaveURL(/\/standard\/index$/);
    await expectOneStayingWarning(page);
  });

  test('edit, when the push went, is the usual success', async ({ context }) => {
    const page = await open(context, newMock(), `/standard/update/${CLASS.standardid}`, editReady);
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page).toHaveURL(/\/standard\/index$/);
    expect(await noticesAfterFence(page)).toEqual(['Standard updated successfully']);
  });

  async function deleteClass(page: Page): Promise<void> {
    await page.locator('tr', { hasText: CLASS.standardname }).getByText('Delete').click();
    await page.locator('.ant-popover button.ant-btn-primary').first().click();
  }

  test('delete, when the push failed, leaves one warning that stays and no success', async ({ context }) => {
    const mock = newMock();
    mock.push = FAILED;
    const page = await open(context, mock, '/standard/index', classesReady);
    await deleteClass(page);
    await expectOneStayingWarning(page);
  });

  test('delete, when the push went, is the usual success', async ({ context }) => {
    const page = await open(context, newMock(), '/standard/index', classesReady);
    await deleteClass(page);
    await expect(descriptions(page).filter({ hasText: 'Standard deleted sucessfully' })).toHaveCount(1);
    expect(await noticesAfterFence(page)).toEqual(['Standard deleted sucessfully']);
  });
});

test.describe('the quiz-pass switch saved', () => {
  const drawer = (page: Page) => page.getByRole('dialog', { name: /organisation/i });
  const quizSwitch = (page: Page) => drawer(page).getByTestId('org-quizpass');
  const platform = { isplatform: true, organisationid: null };

  async function turnOnAndSave(page: Page): Promise<void> {
    await page.getByRole('button', { name: `Edit ${ORG.organisationname}` }).click();
    await expect(drawer(page).getByRole('heading', { name: 'Edit organisation' })).toBeVisible();
    await expect(quizSwitch(page)).toBeEnabled();
    await quizSwitch(page).click();
    await drawer(page).getByRole('button', { name: 'Save changes' }).click();
    await expect(drawer(page)).toBeHidden();
  }
  const ready = (page: Page) => expect(page.getByRole('button', { name: `Edit ${ORG.organisationname}` })).toBeVisible();

  test('the help text says it applies to quizzes taken after it is saved', async ({ context }) => {
    const page = await open(context, newMock(), '/organisation', ready, PLATFORM, platform);
    await page.getByRole('button', { name: `Edit ${ORG.organisationname}` }).click();
    await expect(drawer(page).locator('#org-quizpass-help')).toHaveText(HELP);
  });

  test('when the push failed, one warning stays with central\'s sentence, in place of the success', async ({ context }) => {
    const mock = newMock();
    mock.push = FAILED;
    const page = await open(context, mock, '/organisation', ready, PLATFORM, platform);
    await turnOnAndSave(page);
    expect(mock.writes.some((w) => w.includes('"requireLessonQuizPass":true'))).toBe(true);
    await expectOneStayingWarning(page);
  });

  for (const [what, push] of [['went', PUSHED], ['was skipped', SKIPPED]] as const) {
    test(`when the push ${what}, it is the usual success and nothing stays`, async ({ context }) => {
      const mock = newMock();
      mock.push = push;
      const page = await open(context, mock, '/organisation', ready, PLATFORM, platform);
      await turnOnAndSave(page);
      await expect(descriptions(page)).toHaveText([ORG.organisationname]);
      await expect(titles(page)).toHaveText(['Organisation saved']);
      await expect(notices(page)).toHaveCount(0, { timeout: 10_000 });
    });
  }
});

test.describe('the notices that stay', () => {
  async function press(page: Page, testId: 'sync-students' | 'sync-teachers' = 'sync-students'): Promise<void> {
    await page.getByTestId(testId).click();
    await page.locator('.ant-popover button.ant-btn-primary').first().click();
  }

  test('a refused sync that needs Sync Content offers a link to the Curriculum list, and the link goes there and closes the notice', async ({ context }) => {
    const mock = newMock();
    const page = await open(context, mock, '/school/index', schoolsReady);
    await press(page);
    await expect(page.getByTestId('sync-refused-message')).toHaveText(MISSING_SCHOOL);
    const link = page.getByTestId('go-to-sync-content');
    await expect(link).toHaveText('Go to Sync Content');
    await expect(link).toHaveAttribute('href', '/curriculum/index');
    if (process.env.E2E_SHOTS) await page.waitForTimeout(800), await page.screenshot({ path: process.env.E2E_SHOTS });
    await link.click();
    await expect(page).toHaveURL(/\/curriculum\/index$/);
    await expect(page.getByTestId('sync-content')).toBeVisible();
    expect(await noticesAfterFence(page), 'the notice went with the route').toEqual([]);
  });

  test('the notice closes when the person goes to another screen by any route', async ({ context }) => {
    const page = await open(context, newMock(), '/school/index', schoolsReady);
    await press(page);
    await expect(notices(page)).toHaveCount(1);
    await page.getByRole('link', { name: 'Edit' }).first().click();
    await expect(page).toHaveURL(/\/school\/update\//);
    expect(await noticesAfterFence(page)).toEqual([]);
  });

  test('pressing a refused sync twice shows one notice, not two', async ({ context }) => {
    const mock = newMock();
    const page = await open(context, mock, '/school/index', schoolsReady);
    await press(page);
    await expect(notices(page)).toHaveCount(1);
    await press(page, 'sync-teachers');
    await page.waitForTimeout(800);
    expect(await notices(page).count(), 'one notice, not two').toBe(1);
    await expect(page.getByTestId('sync-refused-message')).toHaveText(MISSING_SCHOOL);
  });

  test('a refusal about a curriculum has its own next step and no link to Sync Content', async ({ context }) => {
    const mock = newMock();
    mock.syncAnswer = () => json(409, { error: true, errormessage: MISSING_CURRICULUM });
    const page = await open(context, mock, '/school/index', schoolsReady);
    await press(page);
    await expect(descriptions(page)).toHaveText([MISSING_CURRICULUM]);
    await page.waitForTimeout(500);
    await expect(page.getByTestId('go-to-sync-content')).toHaveCount(0);
  });

  test('a refusal with no sentence says it was refused, with no link', async ({ context }) => {
    const mock = newMock();
    mock.syncAnswer = () => json(409, {});
    const page = await open(context, mock, '/school/index', schoolsReady);
    await press(page);
    await expect(descriptions(page)).toHaveText(['The sync was refused.']);
    await expect(page.getByTestId('go-to-sync-content')).toHaveCount(0);
  });

  test('a failed-push warning closes when the route changes', async ({ context }) => {
    const mock = newMock();
    mock.push = FAILED;
    const page = await open(context, mock, '/standard/index', classesReady);
    await page.locator('tr', { hasText: CLASS.standardname }).getByText('Delete').click();
    await page.locator('.ant-popover button.ant-btn-primary').first().click();
    await expect(notices(page).filter({ hasText: PUSH_FAILED })).toHaveCount(1);
    await page.getByRole('link', { name: 'Edit' }).first().click();
    await expect(page).toHaveURL(/\/standard\/update\//);
    expect(await noticesAfterFence(page)).toEqual([]);
  });
});
