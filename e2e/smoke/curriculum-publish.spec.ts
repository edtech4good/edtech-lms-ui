import { APIRequestContext, Locator, Page, expect, test } from '@playwright/test';
import { format } from 'date-fns';
import { ROLE } from '../fixtures/accounts';
import { apiContext, apiLogin, jwtClaims, loginViaUi } from '../fixtures/auth';
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
/** Bank questions the tests made; the lessons' deletes do not take them with them. */
const created_questions: string[] = [];

const toasts = (p: Page) => p.locator('.ant-notification-notice');

/**
 * The sentence the API says for an act whose push was skipped (no learner server here) or pushed (one is set up): central's
 * `publish-push.ts`. The suite runs against either stack, so the specs accept both.
 */
const pushSentence = (verb: 'Published' | 'Retired' | 'Deleted') =>
  new RegExp(`${verb}\\. (No learner server is set up here, so nothing was pushed|The learner server has the organisation's published curricula)\\.`);

/**
 * Enabled, and still enabled a moment later. `toBeEnabled` alone passes in the frame before a binding disables the button
 * (the row's pill is up a few milliseconds before the button's state is), which made a "must stay enabled" check pass on a
 * build that disables it: the mutation proof caught that.
 */
async function expectStaysEnabled(button: Locator): Promise<void> {
  await expect(button).toBeEnabled();
  await button.page().waitForTimeout(500);
  await expect(button).toBeEnabled();
}

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

/** A second lesson in the content's level, with a quiz of two multiple-choice questions, added through the API. */
async function addLessonWithQuestions(api: APIRequestContext, c: Content): Promise<{ lessonName: string; questionIdentifiers: string[] }> {
  const lessonName = `Second lesson ${RUN}-${c.n}`;
  const lessonid = (
    await created(
      await api.post('/lesson/create', {
        data: { lessonname: lessonName, lessondescription: `Second description ${RUN}-${c.n}`, levelid: c.level, lessonorder: 2, total_points: 100, passing_points: 0 },
      }),
      'the second lesson',
    )
  ).lessonid;
  await created(
    await api.post(`/lesson/quiz/${lessonid}`, { data: { lessonquizname: `Quiz ${RUN}-${c.n}`, lessonquizdescription: `Quiz ${RUN}-${c.n}`, lessonquizorder: 1, points: 10 } }),
    'the quiz',
  );
  const quizzes = (await (await api.get(`/lesson/quiz/${lessonid}`)).json()).data;
  const quizid: string | undefined = quizzes?.[0]?.lessonquizid;
  expect(quizid, 'the quiz is listed').toBeTruthy();
  const option = (id: string, text: string, correct: boolean, sequence: number) => ({
    questionoptionid: id,
    questionoptiontext: text,
    questionoptionvalue: text,
    questionoptionistext: true,
    questionoptionsequence: sequence,
    questionoptioniscorrect: correct,
    questionassociate: null,
    questionoptionfile: null,
  });
  const questionIdentifiers: string[] = [];
  for (const k of [1, 2]) {
    const identifier = `question ${k} ${RUN}-${c.n}`;
    questionIdentifiers.push(identifier);
    await created(
      await api.post('/question/create', {
        data: {
          questionheading: { headingtext: `Heading ${k} ${RUN}-${c.n}`, headingfile: null },
          questioncorrectvalue: 0,
          questiontags: [],
          questionidentifier: identifier,
          templatetypeid: 1,
          questiontext: `Which is larger ${k} ${RUN}-${c.n}`,
          questionoptions: [option(`${RUN}-${c.n}-${k}-1`, 'Seven', false, 1), option(`${RUN}-${c.n}-${k}-2`, 'Twelve', true, 2)],
          questionfeedback: { correctmessage: 'Well done', incorrectmessage: null },
        },
      }),
      'a question',
    );
    const found = (await (await api.post('/question', { data: { pageindex: 1, pagesize: 10, filter: [{ key: 'questionidentifier', value: identifier }] } })).json()).data.data.find(
      (q: any) => q.questionidentifier === identifier,
    );
    expect(found, `the question "${identifier}" was created`).toBeTruthy();
    created_questions.push(found.questionid);
    await created(await api.post(`/lesson/quiz/question/${quizid}/${found.questionid}/${k}`, { data: {} }), 'a quiz question link');
  }
  return { lessonName, questionIdentifiers };
}

/** The list, narrowed to the curriculum with the name filter. */
async function openList(p: Page, c: Content): Promise<void> {
  await p.goto('/curriculum/index');
  await searchList(p, c);
}

/** Narrows the list that is open to the curriculum, in the same page (no reload: an open drawer stays). */
async function searchList(p: Page, c: Content): Promise<void> {
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
  const step = async (what: string, run: () => Promise<{ ok(): boolean; status(): number }>, alsoFine: number[] = []) => {
    try {
      const res = await run();
      if (!res.ok() && !alsoFine.includes(res.status())) problems.push(`${what}: HTTP ${res.status()}`);
    } catch (e) {
      problems.push(`${what}: ${(e as Error).message}`);
    }
  };
  for (const id of created_questions) await step('delete question', () => sa.delete(`/question/${id}`));
  // In reverse of how they were made. A curriculum a test already deleted (or one whose delete test failed half way) answers
  // 400 ("doesn't exist") or 404: that is the state wanted, and the check below confirms it.
  for (const c of [...made].reverse()) {
    if (c.lesson) await step('delete lesson', () => sa.delete(`/lesson/${c.lesson}`));
    if (c.level) await step('delete level', () => sa.delete(`/level/${c.level}`));
    if (c.grade) await step('delete grade', () => sa.delete(`/grade/${c.grade}`));
    await step('delete curriculum', () => sa.delete(`/curriculum/${c.curriculum}`), [400, 404]);
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

  test('Retire is disabled (not hidden) on a row that was never published, and enabled on a published row and on a retired one', async () => {
    const never = await makeContent(oa);
    const published = await makeContent(oa);
    await publishViaApi(oa, published);
    const retired = await makeContent(oa);
    await publishViaApi(oa, retired);
    await created(await oa.put(`/curriculum/retire/${retired.curriculum}`, { data: {} }), 'a retire');
    await openList(page, never);
    await expect(pill(page, never)).toHaveText('Never published');
    await expect(row(page, never).getByTestId('retire-row')).toBeVisible();
    await expect(row(page, never).getByTestId('retire-row')).toBeDisabled();
    await expect(row(page, never).getByTestId('publish-row')).toBeEnabled();
    await openList(page, published);
    await expect(pill(page, published)).toHaveAttribute('data-state', 'published');
    await expectStaysEnabled(row(page, published).getByTestId('retire-row'));
    // retiring a retired curriculum pushes again: it is how a retire whose push failed is repeated
    await openList(page, retired);
    await expect(pill(page, retired)).toHaveText('Retired');
    await expectStaysEnabled(row(page, retired).getByTestId('retire-row'));
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
    const notice = toasts(page).filter({ hasText: pushSentence('Retired') });
    await expect(notice.first()).toBeVisible();
    await page.unrouteAll({ behavior: 'wait' });
    expect(await notice.first().innerText(), 'the toast carries the API\'s sentence').toMatch(pushSentence('Retired'));
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

  test('the curriculum editor\'s header shows the pill: Published on a published curriculum, Never published on one that was not', async () => {
    const published = await makeContent(oa);
    await publishViaApi(oa, published);
    const never = await makeContent(oa);
    const editorPill = () => page.getByTestId('editor-publication').getByTestId('publication-pill');
    await openList(page, published);
    await row(page, published).getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(new RegExp(`/curriculum/update/${published.curriculum}$`));
    await expect(editorPill()).toHaveText(`Published ${TODAY}`);
    await expect(editorPill()).toHaveAttribute('data-state', 'published');
    await openList(page, never);
    await row(page, never).getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(new RegExp(`/curriculum/update/${never.curriculum}$`));
    await expect(editorPill()).toHaveText('Never published');
    await expect(editorPill()).toHaveAttribute('data-state', 'never');
    // the header offers no action
    await expect(page.getByTestId('editor-publication').getByRole('button')).toHaveCount(0);
  });

  test('the editor\'s header says a dash, and no toast, when the state cannot be read', async () => {
    const c = await makeContent(oa);
    await page.route('**/curriculum/publication/*', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: true, errormessage: 'The state is not available.' }) });
    });
    try {
      await page.goto(`/curriculum/update/${c.curriculum}`);
      await expect(page.getByTestId('editor-state-unknown')).toHaveText('—');
      await expect(page.getByTestId('editor-publication').getByTestId('publication-pill')).toHaveCount(0);
      await page.waitForTimeout(500);
      expect(await toasts(page).filter({ hasText: 'The state is not available.' }).count(), 'quietly: no toast').toBe(0);
    } finally {
      await page.unrouteAll({ behavior: 'wait' });
    }
  });

  test('leaving the list stops the state reads: none goes out after the person is on another screen', async () => {
    // three rows or more, answered slowly one after the other, so reads are still to come when the person leaves
    for (let i = 0; i < 3; i += 1) await makeContent(oa);
    await page.route('**/curriculum/publication/*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue().catch(() => undefined);
    });
    try {
      await page.goto('/curriculum/index');
      await expect(page.getByTestId('publication-pill').first()).toBeVisible();
      const late: string[] = [];
      const record = (r: import('@playwright/test').Request) => {
        if (r.method() === 'GET' && /\/curriculum\/publication\//.test(r.url())) late.push(r.url());
      };
      // leave through the menu (a router navigation, not a reload), then watch for two seconds
      await page.locator('nav[aria-label="Main"]').getByRole('link', { name: 'Home', exact: true }).click();
      await expect(page).toHaveURL(/\/dashboard\/index$/);
      page.on('request', record);
      await page.waitForTimeout(2000);
      page.off('request', record);
      expect(late, 'no state read after the list was left').toEqual([]);
    } finally {
      await page.unrouteAll({ behavior: 'wait' });
    }
  });
});

// ---- the publish drawer -----------------------------------------------------------------------------
test.describe('the publish drawer, signed in as the organisation\'s admin', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUi(page, ADMIN, PASSWORD);
    oa = await apiContext(await tokenOf(page));
  });
  test.afterAll(async () => {
    await page?.close();
  });

  const drawer = (c: Content) => page.getByRole('dialog', { name: `Publish ${c.curriculumName}` });

  async function openDrawer(c: Content): Promise<void> {
    await openList(page, c);
    await row(page, c).getByTestId('publish-row').click();
    await expect(drawer(c)).toBeVisible();
    await expect(drawer(c).getByTestId('publish-total')).toBeVisible();
  }

  test('a curriculum never published: the drawer says all of it reaches learners and lists no changes; Publish closes it, the toast carries the push sentence, the row says Published today', async () => {
    const c = await makeContent(oa);
    await openDrawer(c);
    await expect(drawer(c).getByTestId('publish-title')).toHaveText(c.curriculumName);
    await expect(drawer(c).getByTestId('publication-pill')).toHaveText('Never published');
    await expect(drawer(c).getByTestId('publish-total')).toHaveText('This curriculum has not been published. All of it reaches learners on this publish.');
    await expect(drawer(c).locator('[data-testid^="names-"]')).toHaveCount(0);
    await expect(drawer(c).getByTestId('confirm-publish')).toHaveText('Publish');
    await drawer(c).getByTestId('confirm-publish').click();
    await expect(drawer(c)).toBeHidden();
    await expect(toasts(page).filter({ hasText: pushSentence('Published') })).toBeVisible();
    await expect(pill(page, c)).toHaveText(`Published ${TODAY}`);
    expect((await overview(oa, c)).publicationstatus).toBe('published');
  });

  test('after a first publish, a new lesson and its questions are listed as added', async () => {
    const c = await makeContent(oa);
    await publishViaApi(oa, c);
    const added = await addLessonWithQuestions(oa, c);
    await openDrawer(c);
    await expect(drawer(c).getByTestId('publication-pill')).toHaveText('Changed since publish');
    const total = await drawer(c).getByTestId('publish-total').innerText();
    expect(total).toMatch(/^1 lesson added, 2 questions added/);
    await expect(drawer(c).getByTestId('names-lessons-added')).toContainText(added.lessonName);
    for (const identifier of added.questionIdentifiers) await expect(drawer(c).getByTestId('names-questions-added')).toContainText(identifier);
    await expect(drawer(c).getByTestId('confirm-publish')).toHaveText('Publish');
    await drawer(c).getByTestId('confirm-publish').click();
    await expect(drawer(c)).toBeHidden();
    await expect(pill(page, c)).toHaveText(`Published ${TODAY}`);
    expect((await overview(oa, c)).changedsincepublish).toBe(false);
  });

  test('a renamed lesson is listed as one changed lesson, and Cancel publishes nothing', async () => {
    const c = await makeContent(oa);
    await publishViaApi(oa, c);
    const before = (await overview(oa, c)).publicationid;
    await renameLessonViaApi(oa, c);
    await openDrawer(c);
    // a lesson's rename also moves the grade and the level that hold it (central counts them: "2 other changes")
    await expect(drawer(c).getByTestId('publish-total')).toHaveText('1 lesson changed, 2 other changes');
    await expect(drawer(c).getByTestId('names-lessons-changed').locator('li')).toHaveText([`${c.lessonName} renamed`]);
    await drawer(c).getByTestId('cancel-publish').click();
    await expect(drawer(c)).toBeHidden();
    expect((await overview(oa, c)).publicationid, 'nothing was published').toBe(before);
    await expect(pill(page, c)).toHaveText('Changed since publish');
  });

  test('nothing changed: the drawer says so, the button reads Re-publish, and it still records a publication', async () => {
    const c = await makeContent(oa);
    await publishViaApi(oa, c);
    const before = (await overview(oa, c)).publicationid;
    await openDrawer(c);
    await expect(drawer(c).getByTestId('publish-total')).toHaveText('Nothing has changed since the last publish.');
    await expect(drawer(c).getByTestId('confirm-publish')).toHaveText('Re-publish');
    await drawer(c).getByTestId('confirm-publish').click();
    await expect(drawer(c)).toBeHidden();
    await expect(toasts(page).filter({ hasText: pushSentence('Published') })).toBeVisible();
    expect((await overview(oa, c)).publicationid, 'a new publication was recorded').not.toBe(before);
  });

  test('a retired curriculum: the drawer says all of it returns and lists no changes', async () => {
    const c = await makeContent(oa);
    await publishViaApi(oa, c);
    await created(await oa.put(`/curriculum/retire/${c.curriculum}`, { data: {} }), 'a retire');
    await openDrawer(c);
    await expect(drawer(c).getByTestId('publication-pill')).toHaveText('Retired');
    await expect(drawer(c).getByTestId('publish-total')).toHaveText('This curriculum is retired. All of it reaches learners again on this publish.');
    await expect(drawer(c).locator('[data-testid^="names-"]')).toHaveCount(0);
    await drawer(c).getByTestId('cancel-publish').click();
    await expect(drawer(c)).toBeHidden();
  });

  test('a late answer for the curriculum that was closed never shows under the one opened next', async () => {
    const a = await makeContent(oa);
    await publishViaApi(oa, a); // published, nothing changed: its overview says "Nothing has changed" and the pill Published
    const b = await makeContent(oa); // never published
    await openList(page, a);
    // A's overview answers are held until B's drawer has been read and 2.5 s have gone by since the first was asked.
    let bRead: () => void = () => undefined;
    const bIsRead = new Promise<void>((resolve) => (bRead = resolve));
    let firstHeld = 0;
    await page.route(`**/curriculum/publication/${a.curriculum}`, async (route) => {
      firstHeld ||= Date.now();
      await bIsRead;
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, firstHeld + 2500 - Date.now())));
      await route.continue().catch(() => undefined); // an answer whose read was cancelled has nowhere to go
    });
    try {
      await row(page, a).getByTestId('publish-row').click();
      await expect(drawer(a)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(drawer(a)).toBeHidden();
      await searchList(page, b);
      await row(page, b).getByTestId('publish-row').click();
      await expect(drawer(b).getByTestId('publish-total')).toBeVisible();
      bRead();
      // A's answer lands now (2.5 s after it was asked); give it time to arrive and be, wrongly, shown
      await page.waitForTimeout(3000);
      await expect(drawer(b).getByTestId('publish-total')).toHaveText('This curriculum has not been published. All of it reaches learners on this publish.');
      await expect(drawer(b).getByTestId('confirm-publish')).toHaveText('Publish');
      await expect(drawer(b).getByTestId('publication-pill')).toHaveText('Never published');
    } finally {
      bRead();
      await page.unrouteAll({ behavior: 'wait' });
    }
  });

  test('while it publishes the button says Publishing… and Publish and Cancel are disabled', async () => {
    const c = await makeContent(oa);
    await openDrawer(c);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/curriculum/publish/*', async (route) => {
      await held;
      await route.continue();
    });
    await drawer(c).getByTestId('confirm-publish').click();
    await expect(drawer(c).getByTestId('confirm-publish')).toHaveText('Publishing…');
    await expect(drawer(c).getByTestId('confirm-publish')).toBeDisabled();
    await expect(drawer(c).getByTestId('cancel-publish')).toBeDisabled();
    release();
    await expect(drawer(c)).toBeHidden();
    await page.unrouteAll({ behavior: 'wait' });
    await expect(pill(page, c)).toHaveText(`Published ${TODAY}`);
  });
});

// ---- a publish that is refused or fails, said by the drawer -----------------------------------------------
test.describe('a publish that is refused or fails (the API\'s answer mocked)', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUi(page, ADMIN, PASSWORD);
    oa = await apiContext(await tokenOf(page));
  });
  test.afterAll(async () => {
    await page?.close();
  });
  test.afterEach(async () => {
    await page.unrouteAll({ behavior: 'wait' });
  });

  const drawer = (c: Content) => page.getByRole('dialog', { name: `Publish ${c.curriculumName}` });
  const PUBLISH = '**/curriculum/publish/*';
  const answer = (status: number, body: unknown) => async (route: import('@playwright/test').Route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  /** A published curriculum with a change to publish, its drawer open and read. */
  async function openChanged(): Promise<Content> {
    const c = await makeContent(oa);
    await publishViaApi(oa, c);
    await renameLessonViaApi(oa, c);
    await openList(page, c);
    await row(page, c).getByTestId('publish-row').click();
    await expect(drawer(c).getByTestId('publish-total')).toBeVisible();
    return c;
  }

  /** The error toasts showing, read once (a retrying count passes when a toast fades). */
  const toastCount = async () => toasts(page).count();

  test('400: the API\'s sentence, its hint and one line per table named, in the drawer and in no toast', async () => {
    const c = await openChanged();
    await page.route(
      PUBLISH,
      answer(400, {
        error: true,
        errormessage: "This curriculum can't be published yet. lessons: 1 row has no name. questions: 2 rows have no heading.",
        hint: 'Fix or remove the rows in the tables named, then publish again. Nothing was published.',
        fields: [
          { field: 'lessons', message: 'lessons: 1 row has no name.' },
          { field: 'questions', message: 'questions: 2 rows have no heading.' },
        ],
      }),
    );
    await drawer(c).getByTestId('confirm-publish').click();
    const refusal = drawer(c).getByTestId('publish-refusal');
    await expect(refusal).toContainText("This curriculum can't be published yet. lessons: 1 row has no name.");
    await expect(refusal).toContainText('Fix or remove the rows in the tables named, then publish again. Nothing was published.');
    await expect(drawer(c).getByTestId('field-lessons')).toHaveText('lessons: 1 row has no name.');
    await expect(drawer(c).getByTestId('field-questions')).toHaveText('questions: 2 rows have no heading.');
    await expect(drawer(c).getByTestId('confirm-publish')).toHaveText('Publish');
    await expect(drawer(c).getByTestId('confirm-publish')).toBeEnabled();
    await page.waitForTimeout(500);
    expect(await toastCount(), 'the drawer said it; the interceptor said nothing').toBe(0);
  });

  test('409: someone else published; the drawer says so and Reload reads the overview again', async () => {
    const c = await openChanged();
    await page.route(
      PUBLISH,
      answer(409, { error: true, errormessage: 'This curriculum was published a moment ago by someone else. Reload and publish again.', hint: 'Reload the curriculum, check what changed, then publish again. Nothing was published.' }),
    );
    let reads = 0;
    const count = (r: import('@playwright/test').Request) => {
      if (r.method() === 'GET' && /\/curriculum\/publication\//.test(r.url())) reads += 1;
    };
    await drawer(c).getByTestId('confirm-publish').click();
    await expect(drawer(c).getByTestId('publish-refusal')).toHaveText(/Someone published this curriculum a moment ago\. Reload to see their changes\./);
    await page.waitForTimeout(500);
    expect(await toastCount(), 'no toast: the drawer said it').toBe(0);
    page.on('request', count);
    await drawer(c).getByTestId('publish-reload').click();
    await expect(drawer(c).getByTestId('publish-refusal')).toHaveCount(0);
    await expect(drawer(c).getByTestId('publish-total')).toBeVisible();
    page.off('request', count);
    expect(reads, 'Reload read the overview once').toBe(1);
  });

  test('502: the drawer\'s error state has the API\'s words and Try again; Try again reads the overview and the drawer is usable again', async () => {
    const c = await openChanged();
    await page.route(PUBLISH, answer(502, { error: true, errormessage: 'The learner server refused the request.', hint: 'Try again in a few minutes.', reference: 'E-TEST1' }));
    await drawer(c).getByTestId('confirm-publish').click();
    await expect(drawer(c).getByTestId('publish-error')).toContainText('The learner server refused the request. Try again in a few minutes. Reference: E-TEST1.');
    await expect(drawer(c).getByTestId('confirm-publish')).toBeDisabled();
    await page.waitForTimeout(500);
    expect(await toastCount(), 'the gateway notice is the drawer\'s, not the interceptor\'s').toBe(0);
    await drawer(c).getByTestId('publish-try-again').click();
    await expect(drawer(c).getByTestId('publish-error')).toHaveCount(0);
    await expect(drawer(c).getByTestId('publish-total')).toHaveText('1 lesson changed, 2 other changes');
    await expect(drawer(c).getByTestId('confirm-publish')).toBeEnabled();
  });

  test('an unreachable service (no answer): the drawer says so, with Try again', async () => {
    const c = await openChanged();
    await page.route(PUBLISH, (route) => route.abort('connectionrefused'));
    await drawer(c).getByTestId('confirm-publish').click();
    await expect(drawer(c).getByTestId('publish-error')).toContainText("The service couldn't be reached. Check the connection and try again.");
    await expect(drawer(c).getByTestId('publish-try-again')).toBeVisible();
    await page.waitForTimeout(500);
    expect(await toastCount(), 'no "Something went wrong" toast on top').toBe(0);
  });

  test('403: the no-permission line in the drawer, and no toast', async () => {
    const c = await openChanged();
    await page.route(PUBLISH, answer(403, { error: true, errormessage: 'Forbidden' }));
    await drawer(c).getByTestId('confirm-publish').click();
    await expect(drawer(c).getByTestId('publish-refusal')).toHaveText("You don't have permission to do that.");
    await page.waitForTimeout(500);
    expect(await toastCount()).toBe(0);
  });

  test('404: the curriculum is gone; the drawer closes, one toast says so, and the list is read again', async () => {
    const c = await openChanged();
    await page.route(PUBLISH, answer(404, { error: true, errormessage: "That curriculum doesn't exist." }));
    let lists = 0;
    const count = (r: import('@playwright/test').Request) => {
      if (r.method() === 'POST' && /\/curriculum$/.test(r.url())) lists += 1;
    };
    page.on('request', count);
    await drawer(c).getByTestId('confirm-publish').click();
    await expect(drawer(c)).toBeHidden();
    await expect(toasts(page).filter({ hasText: `Couldn't publish “${c.curriculumName}”` })).toContainText('It no longer exists.');
    await expect.poll(() => lists, 'the list was read again').toBe(1);
    page.off('request', count);
    expect(await toastCount(), 'one toast').toBe(1);
  });

  test('a publish that stands but whose push failed: the drawer closes and an error toast stays, with the API\'s sentence', async () => {
    const c = await openChanged();
    const message = 'Published. The push to the learner server failed; a platform admin can re-push from Sync Content. The learner server could not be reached.';
    await page.route(
      PUBLISH,
      answer(200, { error: false, data: { publicationid: 'mock', publishedat: new Date().toISOString(), summary: { counts: {}, changes: {}, affected: { lessons: {}, questions: {} }, shared: [] }, push: { status: 'failed', message } } }),
    );
    await drawer(c).getByTestId('confirm-publish').click();
    await expect(drawer(c)).toBeHidden();
    const toast = toasts(page).filter({ hasText: message });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('but the push failed');
    // it stays: still there after a success toast would have gone (six seconds), and after the page has moved on
    await page.waitForTimeout(7500);
    await expect(toast).toBeVisible();
  });

  test('a publish whose push was skipped makes a success toast that goes after six seconds', async () => {
    const c = await openChanged();
    const message = 'Published. No learner server is set up here, so nothing was pushed.';
    await page.route(
      PUBLISH,
      answer(200, { error: false, data: { publicationid: 'mock', publishedat: new Date().toISOString(), summary: { counts: {}, changes: {}, affected: { lessons: {}, questions: {} }, shared: [] }, push: { status: 'skipped', reason: 'nocloud', message } } }),
    );
    await drawer(c).getByTestId('confirm-publish').click();
    const toast = toasts(page).filter({ hasText: message });
    await expect(toast).toBeVisible();
    await expect(toast).toBeHidden({ timeout: 9000 });
  });

  test('the drawer\'s own read failing is said by the drawer, with Try again, and adds no toast to the list\'s', async () => {
    const c = await makeContent(oa);
    await publishViaApi(oa, c);
    await page.route('**/curriculum/publication/*', answer(500, { error: true, errormessage: 'The state is not available.' }));
    await openList(page, c);
    await expect(toasts(page).filter({ hasText: 'The state is not available.' }).first()).toBeVisible();
    // the list is read twice on the way (the search), each read fails once: let both have said it, then count
    await page.waitForTimeout(700);
    const before = await toastCount();
    await row(page, c).getByTestId('publish-row').click();
    await expect(drawer(c).getByTestId('publish-error')).toContainText('The state is not available.');
    await expect(drawer(c).getByTestId('publish-try-again')).toBeVisible();
    await expect(drawer(c).getByTestId('confirm-publish')).toBeDisabled();
    expect(await toastCount(), 'the drawer said it: no toast of its own').toBe(before);
  });
});

// ---- deleting a curriculum, and the whole life of one --------------------------------------------------------
test.describe('deleting a curriculum, signed in as the organisation\'s admin', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUi(page, ADMIN, PASSWORD);
    oa = await apiContext(await tokenOf(page));
  });
  test.afterAll(async () => {
    await page?.close();
  });
  test.afterEach(async () => {
    await page.unrouteAll({ behavior: 'wait' });
  });

  const drawer = (c: Content) => page.getByRole('dialog', { name: `Publish ${c.curriculumName}` });

  async function deleteViaList(c: Content): Promise<void> {
    await row(page, c).getByTestId('delete-row').click();
    await page.locator('.ant-popover').getByRole('button', { name: 'OK' }).click();
  }

  async function expectDeleted(c: Content): Promise<void> {
    const res = await oa.get(`/curriculum/${c.curriculum}`);
    const body: any = await res.json().catch(() => ({}));
    expect(res.status() === 404 || body?.data?.isdeleted === true || !body?.data, `the curriculum is gone: HTTP ${res.status()}`).toBeTruthy();
  }

  /** The toast a delete makes: the title "Curriculum deleted" and the API's sentence alone as its body (it starts with the act). */
  const deletedToast = () => toasts(page).filter({ has: page.locator('.ant-notification-notice-message', { hasText: /^Curriculum deleted$/ }) });

  test('the toast is titled "Curriculum deleted" and its body is the API\'s push sentence alone, and the row is gone', async () => {
    const c = await makeContent(oa);
    await publishViaApi(oa, c);
    await openList(page, c);
    await deleteViaList(c);
    const toast = deletedToast();
    await expect(toast).toBeVisible();
    const body = toast.locator('.ant-notification-notice-description');
    await expect(body).toHaveText(pushSentence('Deleted'));
    expect(await body.innerText(), 'the verb is said once').not.toContain('Curriculum deleted.');
    await expect(row(page, c)).toHaveCount(0);
    await expectDeleted(c);
  });

  test('a curriculum that was never published says there was nothing to push', async () => {
    const c = await makeContent(oa);
    await openList(page, c);
    await deleteViaList(c);
    const toast = deletedToast();
    await expect(toast).toBeVisible();
    await expect(toast.locator('.ant-notification-notice-description')).toHaveText('Deleted. That curriculum was not published, so there was nothing to push.');
    await expectDeleted(c);
  });

  test('a delete whose push failed is an error toast that stays, and the curriculum is still deleted', async () => {
    const c = await makeContent(oa);
    await publishViaApi(oa, c);
    const message = 'Deleted. The push to the learner server failed; a platform admin can re-push from Sync Content. The learner server could not be reached.';
    await page.route('**/curriculum/*', async (route) => {
      if (route.request().method() !== 'DELETE') return route.fallback();
      const real = await route.fetch();
      const json = await real.json();
      return route.fulfill({ response: real, json: { ...json, push: { status: 'failed', message } } });
    });
    await openList(page, c);
    await deleteViaList(c);
    const toast = toasts(page).filter({ hasText: message });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Curriculum deleted, but the push failed');
    await expect(toast.locator('.ant-notification-notice-description')).toHaveText(message);
    await expect(row(page, c)).toHaveCount(0);
    await page.waitForTimeout(7500);
    await expect(toast, 'it stays').toBeVisible();
    await expectDeleted(c);
  });

  test('the whole life: never published, published, changed, published again, retired, deleted', async () => {
    const c = await makeContent(oa);
    await openList(page, c);
    await expect(pill(page, c)).toHaveText('Never published');
    // first publish, from the drawer
    await row(page, c).getByTestId('publish-row').click();
    await expect(drawer(c).getByTestId('publish-total')).toContainText('All of it reaches learners on this publish.');
    await drawer(c).getByTestId('confirm-publish').click();
    await expect(drawer(c)).toBeHidden();
    await expect(pill(page, c)).toHaveText(`Published ${TODAY}`);
    // the lesson is renamed through the API; the list, read again, says Changed since publish
    await renameLessonViaApi(oa, c);
    await openList(page, c);
    await expect(pill(page, c)).toHaveText('Changed since publish');
    // the drawer lists the one changed lesson, and publishing it puts the pill back
    await row(page, c).getByTestId('publish-row').click();
    await expect(drawer(c).getByTestId('names-lessons-changed').locator('li')).toHaveText([`${c.lessonName} renamed`]);
    await drawer(c).getByTestId('confirm-publish').click();
    await expect(drawer(c)).toBeHidden();
    await expect(pill(page, c)).toHaveText(`Published ${TODAY}`);
    // retire
    await row(page, c).getByTestId('retire-row').click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Retire', exact: true }).click();
    await expect(pill(page, c)).toHaveText('Retired');
    // delete: the toast says what the push did, and the row is gone
    await deleteViaList(c);
    const toast = deletedToast();
    await expect(toast).toBeVisible();
    // a retired curriculum is no longer published: the API has nothing to push
    await expect(toast.locator('.ant-notification-notice-description')).toHaveText('Deleted. That curriculum was not published, so there was nothing to push.');
    await expect(row(page, c)).toHaveCount(0);
    await expectDeleted(c);
  });
});

// ---- the curriculum map ------------------------------------------------------------------------------------
test.describe('the curriculum map, signed in as the organisation\'s admin', () => {
  let page: Page;
  /** The map keeps its tree in the session under this key (services/list-cache.ts). */
  const TREE_KEY = 'JqGJMqfgE9HEU6hC';

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUi(page, ADMIN, PASSWORD);
    oa = await apiContext(await tokenOf(page));
  });
  test.afterAll(async () => {
    await page?.close();
  });

  const nodePill = (c: Content) =>
    page
      .locator('.ant-tree-treenode')
      .filter({ has: page.locator('.folder-name', { hasText: `${c.curriculumName} (Curriculum)` }) })
      .first()
      .getByTestId('publication-pill');
  const treeKey = () => page.evaluate((key) => sessionStorage.getItem(key), TREE_KEY);
  /** Another list's remembered search (the question list's): a publish, retire or delete must leave it where it is. */
  const OTHER_KEY = 'storeTagValue';
  const seedTreeKey = () =>
    page.evaluate(
      ([key, other]) => {
        sessionStorage.setItem(key, '[]');
        sessionStorage.setItem(other, 'kept-search');
      },
      [TREE_KEY, OTHER_KEY],
    );
  const otherKey = () => page.evaluate((key) => sessionStorage.getItem(key), OTHER_KEY);

  test('a curriculum node shows Never published, Published and Retired (no "changed": the tree does not carry it)', async () => {
    const c = await makeContent(oa);
    await page.goto('/map/index');
    await expect(nodePill(c)).toHaveText('Never published');
    await publishViaApi(oa, c);
    await renameLessonViaApi(oa, c); // changed since publish, which the map does not say
    await page.goto('/map/index');
    await expect(nodePill(c)).toHaveText(`Published ${TODAY}`);
    await expect(nodePill(c)).toHaveAttribute('data-state', 'published');
    await created(await oa.put(`/curriculum/retire/${c.curriculum}`, { data: {} }), 'a retire');
    await page.goto('/map/index');
    await expect(nodePill(c)).toHaveText('Retired');
  });

  test('a publish from the list empties the map\'s cached tree', async () => {
    const c = await makeContent(oa);
    await openList(page, c);
    await seedTreeKey();
    expect(await treeKey(), 'the cache is there before').toBe('[]');
    await row(page, c).getByTestId('publish-row').click();
    await page.getByRole('dialog', { name: `Publish ${c.curriculumName}` }).getByTestId('confirm-publish').click();
    await expect(pill(page, c)).toHaveText(`Published ${TODAY}`);
    expect(await treeKey(), 'the key is gone').toBeNull();
    expect(await otherKey(), 'the question list\'s remembered search is still there').toBe('kept-search');
  });

  test('a retire from the list empties the map\'s cached tree', async () => {
    const c = await makeContent(oa);
    await publishViaApi(oa, c);
    await openList(page, c);
    await seedTreeKey();
    await row(page, c).getByTestId('retire-row').click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Retire', exact: true }).click();
    await expect(pill(page, c)).toHaveText('Retired');
    expect(await treeKey(), 'the key is gone').toBeNull();
    expect(await otherKey(), 'the question list\'s remembered search is still there').toBe('kept-search');
  });

  test('a delete from the list empties the map\'s cached tree', async () => {
    const c = await makeContent(oa);
    await openList(page, c);
    await seedTreeKey();
    await row(page, c).getByTestId('delete-row').click();
    await page.locator('.ant-popover').getByRole('button', { name: 'OK' }).click();
    await expect(row(page, c)).toHaveCount(0);
    expect(await treeKey(), 'the key is gone').toBeNull();
    expect(await otherKey(), 'the question list\'s remembered search is still there').toBe('kept-search');
  });

  test('a map opened from a node, then a publish, then the map again shows the new state, not the kept tree', async () => {
    const c = await makeContent(oa);
    await page.goto('/map/index');
    await expect(nodePill(c)).toHaveText('Never published');
    // opening a node keeps the tree in the session and goes to that record's editor
    await page.locator('.folder-name', { hasText: `${c.curriculumName} (Curriculum)` }).first().click();
    await expect(page).toHaveURL(/\/curriculum\/update\//);
    expect(await treeKey(), 'the tree was kept').not.toBeNull();
    await openList(page, c);
    await row(page, c).getByTestId('publish-row').click();
    await page.getByRole('dialog', { name: `Publish ${c.curriculumName}` }).getByTestId('confirm-publish').click();
    await expect(pill(page, c)).toHaveText(`Published ${TODAY}`);
    await page.goto('/map/index');
    await expect(nodePill(c)).toHaveText(`Published ${TODAY}`);
  });
});

// ---- Sync Content -------------------------------------------------------------------------------------------
test.describe('Sync Content on the curriculum list', () => {
  test('the platform superadmin is offered it, with the tooltip; an account whose token has neither superadmin nor sync_content is not', async ({ browser }) => {
    // the platform superadmin (the beforeAll's own session)
    await saPage.goto('/curriculum/index');
    const wrap = saPage.getByTestId('sync-content-wrap');
    await expect(wrap).toBeVisible();
    await expect(saPage.getByTestId('sync-content')).toHaveText('Sync Content');
    await wrap.hover();
    await expect(saPage.locator('.ant-tooltip').filter({ hasText: 'Re-push the published set to the learner server' })).toBeVisible();
    // an organisation admin: offered it only if its token carries one of the two permissions
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    try {
      await loginViaUi(p, ADMIN, PASSWORD);
      const permissions = (jwtClaims(await tokenOf(p)).permissions ?? []) as string[];
      const allowed = permissions.includes('superadmin') || permissions.includes('sync_content');
      await p.goto('/curriculum/index');
      await expect(p.getByRole('columnheader', { name: 'Tools' })).toBeVisible();
      await expect(p.getByRole('button', { name: 'Create' }).or(p.getByRole('link', { name: 'Create' })).first()).toBeVisible(); // the toolbar has rendered
      await expect(p.getByTestId('sync-content')).toHaveCount(allowed ? 1 : 0);
      expect(allowed, 'an organisation admin does not hold sync_content (the platform re-pushes)').toBe(false);
    } finally {
      await ctx.close();
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
    // The content is made with a token of its own (no other test's session is needed, so this runs alone too).
    const maker = await apiContext(await apiLogin(ADMIN, PASSWORD));
    const c = await makeContent(maker);
    await publishViaApi(maker, c);
    await maker.dispose();
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
