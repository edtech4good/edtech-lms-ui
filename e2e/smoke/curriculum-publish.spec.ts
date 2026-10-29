import { APIRequestContext, Page, expect, test } from '@playwright/test';
import { format } from 'date-fns';
import { ROLE } from '../fixtures/accounts';
import { apiContext, loginViaUi } from '../fixtures/auth';
import { skipUnlessLocalApi } from '../fixtures/local-only';
import { fixtureOrganisationId } from '../fixtures/organisation';

/**
 * Publishing a curriculum, the admin's side (docs/admin-publish-screen-plan.md). Real API (edtech-lms-api with the
 * publish, retire and publication routes), no learner server: the push answers "skipped".
 *
 *  - the curriculum list's State column: Never published, Published {today}, Changed since publish, Retired;
 *  - Retire from the list, with its confirm step and the API's push sentence;
 *  - an account without `publish_curriculum` sees the state and no Publish or Retire.
 *
 * It makes staff accounts (with a password written in this public repository), so it runs only against a local API. The
 * content it makes is deleted in teardown, in reverse, and the deletes are checked (a delete here is soft, and some
 * return success and do nothing).
 */
skipUnlessLocalApi('creates staff accounts');

const RUN = `e2e${Math.random().toString(36).slice(2, 8)}`;
const PASSWORD = 'Staff_Pass1';
const ADMIN = `e2e-pub-${RUN}@example.com`;
const LIMITED = `e2e-pub-lim-${RUN}@example.com`;

/** What the pill says today (the browser's day, which is the machine's). */
const TODAY = format(new Date(), 'd MMM yyyy');

let sa: APIRequestContext; // the platform superadmin
let oa: APIRequestContext; // the organisation's admin, with the token of the browser that is signed in as it
let saPage: Page;
let orgId: string;
const ids: { userId?: string; limitedId?: string } = {};

/** One curriculum with a grade, a level and a lesson: every test makes its own, so none depends on another's state. */
interface Content {
  n: number;
  curriculumName: string;
  lessonName: string;
  subject: string;
  curriculum: string;
  grade: string;
  level: string;
  lesson: string;
}
const made: Content[] = [];

const toasts = (p: Page) => p.locator('.ant-notification-notice');

async function created(res: Awaited<ReturnType<APIRequestContext['post']>>, what: string): Promise<any> {
  const body: any = await res.json().catch(() => ({}));
  expect(res.ok(), `could not create ${what}: HTTP ${res.status()} ${JSON.stringify(body)}`).toBeTruthy();
  return body.data;
}

async function tokenOf(p: Page): Promise<string> {
  return p.evaluate(() => {
    const g = (k: string) => sessionStorage.getItem(k);
    return `${g('lms_access_alg')}.${g('lms_access_payload')}.${g('lms_access_hash')}`;
  });
}

/** subject -> curriculum -> grade -> level -> lesson, made as the organisation's own admin. */
async function makeContent(api: APIRequestContext): Promise<Content> {
  const n = made.length + 1;
  const country = (await (await api.get('/country/all?country=')).json()).data[0]?.countryid;
  expect(country, 'the local database has a country').toBeTruthy();
  const curriculumName = `Curriculum ${RUN}-${n}`;
  const lessonName = `Lesson ${RUN}-${n}`;
  const subject = (await created(await api.post('/subject/create', { data: { subjectname: `Sub ${RUN}-${n}`, subjectdescription: `Subject ${RUN}-${n}` } }), 'subject')).subjectid;
  const curriculum = (
    await created(
      await api.post('/curriculum/create', { data: { curriculumname: curriculumName, curriculumdescription: `Curriculum ${RUN}-${n}`, countryid: [country], subjectid: subject } }),
      'curriculum',
    )
  ).curriculumid;
  const content: Content = { n, curriculumName, lessonName, subject, curriculum, grade: '', level: '', lesson: '' };
  made.push(content); // listed as soon as it exists, so a failed step still gets cleaned up
  content.grade = (
    await created(await api.post('/grade/create', { data: { gradename: `Grade ${RUN}-${n}`, gradedescription: `Grade ${RUN}-${n}`, curriculumid: curriculum, gradeorder: 1, passing_points: 0 } }), 'grade')
  ).gradeid;
  content.level = (
    await created(await api.post('/level/create', { data: { levelname: `Level ${RUN}-${n}`, leveldescription: `Level ${RUN}-${n}`, gradeid: content.grade, levelorder: 1, quiz_points: 10, passing_points: 0 } }), 'level')
  ).levelid;
  content.lesson = (
    await created(
      await api.post('/lesson/create', {
        data: { lessonname: lessonName, lessondescription: `Description ${RUN}-${n}`, levelid: content.level, lessonorder: 1, total_points: 100, passing_points: 0 },
      }),
      'lesson',
    )
  ).lessonid;
  return content;
}

/** The overview the screen reads, straight from the API. */
async function overview(api: APIRequestContext, c: Content): Promise<any> {
  const res = await api.get(`/curriculum/publication/${c.curriculum}`);
  expect(res.ok(), `GET publication: HTTP ${res.status()}`).toBeTruthy();
  return (await res.json()).data;
}

async function publishViaApi(api: APIRequestContext, c: Content): Promise<any> {
  return created(await api.put(`/curriculum/publish/${c.curriculum}`, { data: {} }), 'a publication');
}

async function renameLessonViaApi(api: APIRequestContext, c: Content): Promise<void> {
  const res = await api.put(`/lesson/${c.lesson}`, {
    data: { lessonname: `${c.lessonName} renamed`, lessondescription: `Description ${RUN}-${c.n}`, levelid: c.level, lessonorder: 1, total_points: 100, passing_points: 0 },
  });
  expect(res.ok(), `rename: HTTP ${res.status()}`).toBeTruthy();
}

/** The list, narrowed to the curriculum with the name filter. */
async function openList(p: Page, c: Content): Promise<void> {
  await p.goto('/curriculum/index');
  await p.locator('th', { hasText: 'Curriculum Name' }).locator('nz-filter-trigger').click();
  await p.getByPlaceholder('Search curriculum').fill(c.curriculumName);
  await p.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(row(p, c)).toBeVisible();
}

const row = (p: Page, c: Content) => p.getByRole('row').filter({ hasText: c.curriculumName });
const pill = (p: Page, c: Content) => row(p, c).getByTestId('publication-pill');

/** Checked: a row the teardown deleted no longer answers (a deleted row answers 404, or is marked deleted). */
async function expectGone(api: APIRequestContext, path: string, what: string, problems: string[]): Promise<void> {
  const res = await api.get(path);
  if (res.status() === 404) return;
  const body: any = await res.json().catch(() => ({}));
  if (res.ok() && body?.data && body.data.isdeleted !== true) problems.push(`${what} still answers GET ${path}`);
}

test.beforeAll(async ({ browser }) => {
  saPage = await browser.newPage();
  await loginViaUi(saPage);
  sa = await apiContext(await tokenOf(saPage));
  orgId = await fixtureOrganisationId(sa);

  // An Organisation Admin of the fixture organisation makes the content and publishes it (a platform account that is not acting may not).
  const made = await created(
    await sa.post('/user/create', {
      data: { lmsusername: ADMIN, lmsuserpasswordhash: PASSWORD, lmsuserroles: [ROLE.organisationadmin], organisationid: orgId, countryids: [], schoolids: [] },
    }),
    'the organisation admin',
  );
  ids.userId = made.lmsuserid;
});

test.afterAll(async () => {
  const problems: string[] = [];
  const step = async (what: string, run: () => Promise<{ ok(): boolean; status(): number }>) => {
    try {
      const res = await run();
      if (!res.ok()) problems.push(`${what}: HTTP ${res.status()}`);
    } catch (e) {
      problems.push(`${what}: ${(e as Error).message}`);
    }
  };
  // In reverse of how they were made. A curriculum the test already deleted answers 404: that is the state wanted.
  for (const c of [...made].reverse()) {
    if (c.lesson) await step('delete lesson', () => sa.delete(`/lesson/${c.lesson}`));
    if (c.level) await step('delete level', () => sa.delete(`/level/${c.level}`));
    if (c.grade) await step('delete grade', () => sa.delete(`/grade/${c.grade}`));
    const res = await sa.delete(`/curriculum/${c.curriculum}`);
    if (!res.ok() && res.status() !== 404) problems.push(`delete curriculum: HTTP ${res.status()}`);
    await step('delete subject', () => sa.delete(`/subject/${c.subject}`));
    // Checked: the rows no longer answer.
    await expectGone(sa, `/curriculum/${c.curriculum}`, 'the curriculum', problems);
    if (c.lesson) await expectGone(sa, `/lesson/${c.lesson}`, 'the lesson', problems);
  }
  if (ids.limitedId) await step('disable the limited account', () => sa.delete(`/user/${ids.limitedId}`));
  if (ids.userId) await step('disable the account', () => sa.delete(`/user/${ids.userId}`));
  await oa?.dispose();
  await sa?.dispose();
  await saPage?.close();
  // Never swallowed: an account left enabled has a password anyone can read here.
  if (problems.length) throw new Error(`cleanup left things behind: ${problems.join('; ')}`);
});

// ---- the State column and Retire -------------------------------------------------------------------
test.describe('the curriculum list, signed in as the organisation\'s admin', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUi(page, ADMIN, PASSWORD);
    oa = await apiContext(await tokenOf(page));
  });
  test.afterAll(async () => {
    await page?.close();
  });

  test('a curriculum that was never published says so', async () => {
    const c = await makeContent(oa);
    expect((await overview(oa, c)).publicationstatus).toBe('never');
    await openList(page, c);
    await expect(pill(page, c)).toHaveText('Never published');
    await expect(pill(page, c)).toHaveAttribute('data-state', 'never');
  });

  test('a published curriculum says Published and today\'s date', async () => {
    const c = await makeContent(oa);
    await publishViaApi(oa, c);
    await openList(page, c);
    await expect(pill(page, c)).toHaveText(`Published ${TODAY}`);
    await expect(pill(page, c)).toHaveAttribute('data-state', 'published');
  });

  test('a published curriculum whose lesson was renamed says Changed since publish', async () => {
    const c = await makeContent(oa);
    await publishViaApi(oa, c);
    await renameLessonViaApi(oa, c);
    expect((await overview(oa, c)).changedsincepublish).toBe(true);
    await openList(page, c);
    await expect(pill(page, c)).toHaveText('Changed since publish');
    await expect(pill(page, c)).toHaveAttribute('data-state', 'changed');
  });

  test('Retire asks first, and Cancel leaves the curriculum published', async () => {
    const c = await makeContent(oa);
    await publishViaApi(oa, c);
    await openList(page, c);
    await row(page, c).getByTestId('retire-row').click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText('Learners lose this curriculum at their next sync. Their progress is kept.');
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toBeHidden();
    expect((await overview(oa, c)).publicationstatus).toBe('published');
    await expect(pill(page, c)).toHaveAttribute('data-state', 'published');
  });

  test('Retire is disabled while it runs; the toast carries the API\'s push sentence and the row says Retired', async () => {
    const c = await makeContent(oa);
    await publishViaApi(oa, c);
    await openList(page, c);
    // hold the answer back, to see the button while the call is out
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/curriculum/retire/*', async (route) => {
      await held;
      await route.continue();
    });
    await row(page, c).getByTestId('retire-row').click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Retire', exact: true }).click();
    await expect(row(page, c).getByTestId('retire-row')).toBeDisabled();
    release();
    const notice = toasts(page).filter({ hasText: 'No learner server is set up here' });
    await expect(notice.first()).toBeVisible();
    await page.unrouteAll({ behavior: 'wait' });
    expect(await notice.first().innerText(), 'the toast carries the API\'s sentence').toContain('Retired. No learner server is set up here, so nothing was pushed.');
    await expect(pill(page, c)).toHaveText('Retired');
    await expect(pill(page, c)).toHaveAttribute('data-state', 'retired');
    expect((await overview(oa, c)).publicationstatus).toBe('withdrawn');
  });

  test('a row whose state cannot be read shows a dash and one error, and the reads stop', async () => {
    // two rows to read, so that "the reads stop" can be told from "there was only one"
    await makeContent(oa);
    await makeContent(oa);
    let asked = 0;
    await page.route('**/curriculum/publication/*', async (route) => {
      asked += 1;
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: true, errormessage: 'The state is not available.' }) });
    });
    try {
      // the first page of the list, with no search: a second load would make a second, honest, read and toast
      await page.goto('/curriculum/index');
      await expect(page.getByTestId('state-unknown').first()).toHaveText('—');
      await expect(toasts(page).filter({ hasText: 'The state is not available.' })).toHaveCount(1);
      // the fence: a second read of the count, after the page has had time to ask for more
      await page.waitForTimeout(500);
      expect(await toasts(page).filter({ hasText: 'The state is not available.' }).count(), 'one toast, not one per row').toBe(1);
      expect(asked, 'the reads stopped after the first failure').toBe(1);
    } finally {
      await page.unrouteAll({ behavior: 'wait' });
    }
  });
});

// ---- an account without publish_curriculum -------------------------------------------------------------
test.describe('an account without publish_curriculum', () => {
  test('sees the state, and is offered neither Publish nor Retire', async ({ browser }) => {
    const made1 = await created(
      await sa.post('/user/create', {
        data: { lmsusername: LIMITED, lmsuserpasswordhash: PASSWORD, lmsuserroles: [ROLE.user, ROLE.teacher], organisationid: orgId, countryids: [], schoolids: [] },
      }),
      'the limited account',
    );
    ids.limitedId = made1.lmsuserid;
    const c = await makeContent(oa);
    await publishViaApi(oa, c);
    const lp = await (await browser.newContext()).newPage();
    try {
      await loginViaUi(lp, LIMITED, PASSWORD);
      await openList(lp, c);
      await expect(pill(lp, c)).toHaveText(`Published ${TODAY}`);
      await expect(row(lp, c).getByTestId('retire-row')).toHaveCount(0);
      await expect(row(lp, c).getByTestId('publish-row')).toHaveCount(0);
    } finally {
      await lp.context().close();
    }
  });
});
