import { APIRequestContext, Locator, Page, expect, test } from '@playwright/test';
import { ROLE } from '../fixtures/accounts';
import { apiContext, apiLogin, loginViaUi } from '../fixtures/auth';
import { skipUnlessLocalApi } from '../fixtures/local-only';
import { FIXTURE_ORGANISATION, SECOND_FIXTURE_ORGANISATION, fixtureOrganisationId } from '../fixtures/organisation';

/**
 * Bilingual content, the admin's side. Real API (edtech-lms-api with the translations routes).
 *
 *  - the organisation's content language, set in the organisation drawer and saved with PUT /organisation/:id, and the
 *    API's 400 for a language the organisation already holds translations in;
 *  - the Translations panel on the lesson and question editors: translate a lesson name and an option, see the
 *    base text, see a graded text refused, see "Base text changed" after a rename, confirm it, remove a language;
 *  - the counts on the curriculum map.
 *
 * It makes a staff account (with a password written in this public repository) and sets the content language of the
 * fixed fixture organisation, so it runs only against a local API. The language is put back and the content it made is
 * deleted in teardown; what stays behind are disabled-account and soft-deleted rows. The Khmer text is the fixture
 * organisations' own names (fixtures/organisation.ts): this file writes none.
 */
skipUnlessLocalApi('creates a staff account and sets an organisation\'s content language');

const RUN = `e2e${Math.random().toString(36).slice(2, 8)}`;
const PASSWORD = 'Staff_Pass1';
const ADMIN = `e2e-trans-${RUN}@example.com`;

/** Translations: the fixture organisations' Khmer names, byte for byte. */
const KM_NAME = SECOND_FIXTURE_ORGANISATION.name;
const KM_SHORT = SECOND_FIXTURE_ORGANISATION.shortname;

const LESSON_NAME = `Lesson ${RUN}`;
const LESSON_RENAMED = `Lesson ${RUN} renamed`;
const LESSON_DESCRIPTION = `Description ${RUN}`;

let sa: APIRequestContext; // the platform superadmin
let saPage: Page;
let orgId: string;
const ids: { subject?: string; curriculum?: string; grade?: string; level?: string; lesson?: string; mcq?: string; fill?: string; userId?: string } = {};

const toasts = (p: Page) => p.locator('.ant-notification-notice');
const panel = (p: Page) => p.getByRole('dialog', { name: 'Translations' });

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

/** What the API holds for a row: the translations, each with its stale flag. */
async function listFor(api: APIRequestContext, table: string, id: string): Promise<{ contentlanguage: string | null; translations: any[] }> {
  const res = await api.get(`/translations/${table}/${id}`);
  expect(res.ok(), `GET translations ${table}: HTTP ${res.status()}`).toBeTruthy();
  return (await res.json()).data;
}

/** Creating a question answers `true`, not its id: find it by its identifier. */
async function findQuestion(api: APIRequestContext, identifier: string): Promise<string> {
  const res = await api.post('/question', { data: { pageindex: 1, pagesize: 10, filter: [{ key: 'questionidentifier', value: identifier }] } });
  const row = (await res.json()).data.data.find((q: any) => q.questionidentifier === identifier);
  expect(row, `the question "${identifier}" was created`).toBeTruthy();
  return row.questionid;
}

/** The six content rows the tests need, made as the organisation's own admin. */
async function makeContent(oa: APIRequestContext): Promise<void> {
  const country = (await (await oa.get('/country/all?country=')).json()).data[0]?.countryid;
  expect(country, 'the local database has a country').toBeTruthy();
  ids.subject = (await created(await oa.post('/subject/create', { data: { subjectname: `Sub ${RUN}`, subjectdescription: `Subject ${RUN}` } }), 'subject')).subjectid;
  ids.curriculum = (
    await created(
      await oa.post('/curriculum/create', { data: { curriculumname: `Curriculum ${RUN}`, curriculumdescription: `Curriculum ${RUN}`, countryid: [country], subjectid: ids.subject } }),
      'curriculum',
    )
  ).curriculumid;
  ids.grade = (
    await created(await oa.post('/grade/create', { data: { gradename: `Grade ${RUN}`, gradedescription: `Grade ${RUN}`, curriculumid: ids.curriculum, gradeorder: 1, passing_points: 0 } }), 'grade')
  ).gradeid;
  ids.level = (
    await created(await oa.post('/level/create', { data: { levelname: `Level ${RUN}`, leveldescription: `Level ${RUN}`, gradeid: ids.grade, levelorder: 1, quiz_points: 10, passing_points: 0 } }), 'level')
  ).levelid;
  ids.lesson = (
    await created(
      await oa.post('/lesson/create', {
        data: { lessonname: LESSON_NAME, lessondescription: LESSON_DESCRIPTION, levelid: ids.level, lessonorder: 1, total_points: 100, passing_points: 0 },
      }),
      'lesson',
    )
  ).lessonid;

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
  const base = { questionheading: { headingtext: `Heading ${RUN}`, headingfile: null }, questioncorrectvalue: 0, questiontags: [] };
  const mcqOptionB = `${RUN}-mcq-opt-2`;
  await created(
      await oa.post('/question/create', {
        data: {
          ...base,
          questionidentifier: `mcq ${RUN}`,
          templatetypeid: 1,
          questiontext: `Which is larger ${RUN}`,
          questionoptions: [option(`${RUN}-mcq-opt-1`, 'Seven', false, 1), option(mcqOptionB, 'Twelve', true, 2)],
          questionfeedback: { correctmessage: 'Well done', incorrectmessage: null },
        },
      }),
      'question',
  );
  ids.mcq = await findQuestion(oa, `mcq ${RUN}`);
  // Fill in the blanks (8): its question text holds the blank markers, so it is graded by it and is not translatable.
  await created(
      await oa.post('/question/create', {
        data: {
          ...base,
          questionidentifier: `fill ${RUN}`,
          templatetypeid: 8,
          questiontext: 'I have ----- fish',
          questionoptions: [option(`${RUN}-fill-opt-1`, 'two', true, 1)],
          questiondistractors: [{ questiondistractorid: `${RUN}-fill-d-1`, questiondistractortext: 'three' }],
        },
      }),
      'fill-in-the-blanks question',
  );
  ids.fill = await findQuestion(oa, `fill ${RUN}`);
}

/** Opens the map's tree from the test curriculum down to its lesson (the arrows: a click on a name goes to that record's editor). */
async function openTreeDown(p: Page): Promise<void> {
  for (const title of [`Curriculum ${RUN} (Curriculum)`, `Grade ${RUN} (Grade)`, `Level ${RUN} (Level)`]) {
    await p.locator('.ant-tree-treenode').filter({ has: p.locator('.folder-name', { hasText: title }) }).first().locator('.ant-tree-switcher').click();
  }
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  saPage = await browser.newPage();
  await loginViaUi(saPage);
  sa = await apiContext(await tokenOf(saPage));
  orgId = await fixtureOrganisationId(sa);

  // An Organisation Admin of the fixture organisation makes the content (a platform account that is not acting may not).
  const made = await created(
    await sa.post('/user/create', {
      data: { lmsusername: ADMIN, lmsuserpasswordhash: PASSWORD, lmsuserroles: [ROLE.organisationadmin], organisationid: orgId, countryids: [], schoolids: [] },
    }),
    'the organisation admin',
  );
  ids.userId = made.lmsuserid;
  const oa = await apiContext(await apiLogin(ADMIN, PASSWORD));
  await makeContent(oa);
  await oa.dispose();
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
  // Translations first (a deleted row's translations would be orphans), then the rows, then the language, then the account.
  for (const [table, id] of [['lessons', ids.lesson], ['questions', ids.mcq], ['questions', ids.fill]] as const) {
    if (id) await step(`remove translations of ${table} ${id}`, () => sa.delete(`/translations/${table}/${id}/km`));
  }
  if (ids.mcq) await step('delete mcq', () => sa.delete(`/question/${ids.mcq}`));
  if (ids.fill) await step('delete fill', () => sa.delete(`/question/${ids.fill}`));
  if (ids.lesson) await step('delete lesson', () => sa.delete(`/lesson/${ids.lesson}`));
  if (ids.level) await step('delete level', () => sa.delete(`/level/${ids.level}`));
  if (ids.grade) await step('delete grade', () => sa.delete(`/grade/${ids.grade}`));
  if (ids.curriculum) await step('delete curriculum', () => sa.delete(`/curriculum/${ids.curriculum}`));
  if (ids.subject) await step('delete subject', () => sa.delete(`/subject/${ids.subject}`));
  if (orgId) await step('clear the content language', async () => {
    const org = (await (await sa.get(`/organisation/${orgId}`)).json()).data;
    return sa.put(`/organisation/${orgId}`, {
      data: { organisationname: org.organisationname, organisationshortname: org.organisationshortname, brandingconfig: org.brandingconfig, countryids: org.countries.map((c: any) => c.countryid), contentlanguage: null },
    });
  });
  if (ids.userId) await step('disable the account', () => sa.delete(`/user/${ids.userId}`));
  await sa?.dispose();
  await saPage?.close();
  // Never swallowed: an account left enabled has a password anyone can read here.
  if (problems.length) throw new Error(`cleanup left things behind: ${problems.join('; ')}`);
});

// ---- 1. the organisation's content language ----------------------------------------------------
test.describe('the organisation\'s content language', () => {
  const drawer = () => saPage.getByRole('dialog', { name: /organisation/i });
  const languageSelect = () => drawer().locator('#org-language');

  async function openEdit(): Promise<void> {
    await saPage.goto('/organisation');
    await saPage.getByRole('searchbox', { name: 'Search organisations by name' }).fill(FIXTURE_ORGANISATION.name);
    await saPage.getByRole('row').filter({ hasText: FIXTURE_ORGANISATION.name }).getByRole('button', { name: `Edit ${FIXTURE_ORGANISATION.name}` }).click();
    await expect(drawer().getByRole('heading', { name: 'Edit organisation' })).toBeVisible();
  }
  async function choose(label: string): Promise<void> {
    await languageSelect().click();
    await saPage.locator('.ant-select-item-option').filter({ hasText: label }).click();
  }
  async function save(): Promise<void> {
    await drawer().getByRole('button', { name: 'Save changes' }).click();
  }

  test('starts with none; English is saved and read back from the API', async () => {
    await openEdit();
    await expect(drawer().getByText('Content language', { exact: true })).toBeVisible();
    await expect(languageSelect()).toContainText('None yet');
    await choose('English (en)');
    await save();
    await expect(drawer()).toBeHidden();
    const org = (await (await sa.get(`/organisation/${orgId}`)).json()).data;
    expect(org.contentlanguage).toBe('en');
  });

  test('the field shows what is saved when the organisation is opened again', async () => {
    await openEdit();
    await expect(languageSelect()).toContainText('English (en)');
    await drawer().getByRole('button', { name: 'Cancel' }).click();
    await expect(drawer()).toBeHidden();
  });

  test('a code that is not in the list is typed, checked, and saved in its normal form', async () => {
    await openEdit();
    await choose('Another language');
    const code = drawer().getByLabel('Language code');
    await save();
    await expect(drawer().getByRole('alert').filter({ hasText: 'Enter a language code' })).toBeVisible();
    await code.fill('x');
    await save();
    await expect(drawer().getByRole('alert').filter({ hasText: '2 to 8 letters' })).toBeVisible();
    await code.fill('PT-BR');
    await save();
    await expect(drawer()).toBeHidden();
    expect((await (await sa.get(`/organisation/${orgId}`)).json()).data.contentlanguage).toBe('pt-BR');
    // back to English for the rest
    await openEdit();
    await expect(drawer().getByLabel('Language code')).toHaveValue('pt-BR');
    await choose('English (en)');
    await save();
    await expect(drawer()).toBeHidden();
    expect((await (await sa.get(`/organisation/${orgId}`)).json()).data.contentlanguage).toBe('en');
  });
});

// ---- 2. the Translations panel on the lesson editor ---------------------------------------------
test.describe('the Translations panel, signed in as the organisation\'s admin', () => {
  let page: Page;
  const textBlock = (key: string): Locator => panel(page).getByTestId(`text-${key}`);
  const input = (key: string): Locator => panel(page).getByTestId(`input-${key}`);
  const save = () => panel(page).getByTestId('save-translations');

  async function openLesson(): Promise<void> {
    await page.goto(`/lesson/update/${ids.lesson}`);
    await expect(page.locator('input[formcontrolname="lessonname"]')).not.toHaveValue('');
    await page.getByTestId('open-translations').click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByTestId('base-language')).toBeVisible();
  }
  async function openQuestion(id: string): Promise<void> {
    await page.goto(`/question/update/${id}`);
    await expect(page.locator('input[formcontrolname="questionidentifier"]')).not.toHaveValue('');
    await page.getByTestId('open-translations').click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByTestId('base-language')).toBeVisible();
  }
  async function addLanguage(code: string): Promise<void> {
    await panel(page).getByTestId('add-language-code').fill(code);
    await panel(page).getByTestId('add-language').click();
  }

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUi(page, ADMIN, PASSWORD);
  });
  test.afterAll(async () => {
    await page?.close();
  });

  test('the lesson panel names the base language, lists the lesson\'s texts read-only, and has no language yet', async () => {
    await openLesson();
    await expect(panel(page).getByTestId('base-language')).toHaveText('English (en)');
    await expect(textBlock('lessonname').getByTestId('base-text')).toHaveText(LESSON_NAME);
    await expect(textBlock('lessondescription').getByTestId('base-text')).toHaveText(LESSON_DESCRIPTION);
    await expect(panel(page).getByTestId('no-languages')).toBeVisible();
    await expect(save()).toBeDisabled();
  });

  test('a language code is checked before it is added', async () => {
    await openLesson();
    await addLanguage('en');
    await expect(panel(page).getByRole('alert').filter({ hasText: 'own content language' })).toBeVisible();
    await addLanguage('k');
    await expect(panel(page).getByRole('alert').filter({ hasText: '2 to 8' })).toBeVisible();
    await expect(panel(page).getByTestId('lang-en')).toHaveCount(0);
  });

  test('a lesson name is translated: saved, read back from the API byte for byte, and not stale', async () => {
    await openLesson();
    await addLanguage('KM');
    await expect(panel(page).getByTestId('lang-km')).toBeVisible();
    await input('lessonname').fill(KM_NAME);
    await expect(save()).toBeEnabled();
    await save().click();
    await expect(toasts(page).filter({ hasText: 'Translations saved.' })).toBeVisible();
    const held = await listFor(sa, 'lessons', ids.lesson!);
    expect(held.contentlanguage).toBe('en');
    expect(held.translations).toHaveLength(1);
    expect(held.translations[0]).toMatchObject({ field: 'lessonname', subkey: '', language: 'km', text: KM_NAME, stale: false });
    // The panel shows what was saved, marked translated; the description is still open.
    await expect(textBlock('lessonname')).toContainText('Translated');
    await expect(input('lessonname')).toHaveValue(KM_NAME);
    await expect(textBlock('lessondescription')).toContainText('Not translated');
    await expect(save()).toBeDisabled();
  });

  test('a question option is translated, keyed by its id; the graded text of a fill-in-the-blanks question is not offered', async () => {
    await openQuestion(ids.mcq!);
    await addLanguage('km');
    const optionKey = `questionoptiontext.${RUN}-mcq-opt-2`;
    await expect(textBlock(optionKey).getByTestId('base-text')).toHaveText('Twelve');
    await input(optionKey).fill(KM_SHORT);
    await save().click();
    await expect(toasts(page).filter({ hasText: 'Translations saved.' })).toBeVisible();
    const held = await listFor(sa, 'questions', ids.mcq!);
    expect(held.translations).toHaveLength(1);
    expect(held.translations[0]).toMatchObject({ field: 'questionoptiontext', subkey: `${RUN}-mcq-opt-2`, language: 'km', text: KM_SHORT, stale: false });

    await openQuestion(ids.fill!);
    await addLanguage('km');
    const graded = textBlock('questiontext');
    await expect(graded.getByTestId('base-text')).toHaveText('I have ----- fish');
    await expect(graded.getByTestId('not-translatable')).toHaveText('Not translatable');
    await expect(input('questiontext')).toHaveCount(0);
    // Its options are display text for this template (8): the option text is offered.
    await expect(input(`questionoptiontext.${RUN}-fill-opt-1`)).toBeVisible();
    // The API agrees: it refuses the graded text.
    const refused = await sa.put(`/translations/questions/${ids.fill}`, { data: { language: 'km', fields: { questiontext: KM_SHORT } } });
    expect(refused.status()).toBe(400);
  });

  test('the curriculum map shows the counts for the lesson once they are switched on', async () => {
    await page.goto('/map/index');
    await expect(page.getByText(`Curriculum ${RUN} (Curriculum)`)).toBeVisible();
    // Off by default: no chips, and nothing asked of the publication route.
    await expect(page.locator('[data-testid^="chip-"]')).toHaveCount(0);
    const asked: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/curriculum/publication/')) asked.push(r.url());
    });
    await page.getByTestId('translation-counts-switch').click();
    await expect(page.getByTestId('chip-km').first()).toBeVisible();
    // Open the tree down to the lesson.
    await openTreeDown(page);
    const lessonRow = page.locator('.custom-node').filter({ hasText: `${LESSON_NAME} (Lesson)` });
    // The lesson has a name (translated) and a description (not): one untranslated text.
    await expect(lessonRow.getByTestId('chip-km')).toHaveText('km: 1 untranslated');
    expect(asked.length, 'the overview was asked for once per curriculum, only after the switch').toBeGreaterThan(0);
  });

  test('after the lesson is renamed the translated name is marked "Base text changed", and counted as stale', async () => {
    const res = await sa.put(`/lesson/${ids.lesson}`, {
      data: { lessonname: LESSON_RENAMED, lessondescription: LESSON_DESCRIPTION, levelid: ids.level, lessonorder: 1, total_points: 100, passing_points: 0 },
    });
    expect(res.ok(), `rename: HTTP ${res.status()}`).toBeTruthy();
    expect((await listFor(sa, 'lessons', ids.lesson!)).translations[0].stale).toBe(true);

    await openLesson();
    await panel(page).getByTestId('lang-km').click();
    await expect(textBlock('lessonname').getByTestId('base-text')).toHaveText(LESSON_RENAMED);
    await expect(textBlock('lessonname').getByTestId('stale')).toHaveText('Base text changed');
    await expect(textBlock('lessondescription').getByTestId('stale')).toHaveCount(0);
    // An untouched stale translation is not saved by a save of something else: it stays stale.
    await input('lessondescription').fill(KM_SHORT);
    await save().click();
    await expect(toasts(page).filter({ hasText: 'Translations saved.' })).toBeVisible();
    const held = await listFor(sa, 'lessons', ids.lesson!);
    expect(held.translations.find((t) => t.field === 'lessonname')?.stale).toBe(true);
    expect(held.translations.find((t) => t.field === 'lessondescription')?.stale).toBe(false);
    await expect(textBlock('lessonname').getByTestId('stale')).toBeVisible();

    // The map counts it.
    await page.goto('/map/index');
    await page.getByTestId('translation-counts-switch').click();
    await openTreeDown(page);
    await expect(page.locator('.custom-node').filter({ hasText: `${LESSON_RENAMED} (Lesson)` }).getByTestId('chip-km')).toHaveText('km: 1 stale');
  });

  test('"it is still correct" confirms the old wording: it is saved against the new base text and is no longer stale', async () => {
    await openLesson();
    await panel(page).getByTestId('lang-km').click();
    await textBlock('lessonname').getByRole('button', { name: 'it is still correct' }).click();
    await expect(textBlock('lessonname').getByTestId('stale')).toHaveCount(0);
    await save().click();
    await expect(toasts(page).filter({ hasText: 'Translations saved.' })).toBeVisible();
    const held = await listFor(sa, 'lessons', ids.lesson!);
    expect(held.translations.map((t) => t.stale)).toEqual([false, false]);
    expect(held.translations.find((t) => t.field === 'lessonname')?.text).toBe(KM_NAME);
  });

  test('emptying a saved translation is not sent: the save is blocked and says why', async () => {
    await openLesson();
    await panel(page).getByTestId('lang-km').click();
    await input('lessondescription').fill('');
    await expect(textBlock('lessondescription').getByRole('alert')).toContainText("can't be blank");
    await expect(save()).toBeDisabled();
    await panel(page).getByTestId('close-translations').click();
    // Unsaved changes ask first.
    await page.getByRole('alertdialog', { name: 'Discard your changes?' }).getByRole('button', { name: 'Discard changes' }).click();
    await expect(panel(page)).toBeHidden();
    expect((await listFor(sa, 'lessons', ids.lesson!)).translations).toHaveLength(2);
  });

  test('a refusal from the catalogue is one notice in the API\'s own words', async () => {
    // Clear the organisation's language behind the panel's back: the next save is refused with a 400.
    const org = (await (await sa.get(`/organisation/${orgId}`)).json()).data;
    const put = (lang: string | null) =>
      sa.put(`/organisation/${orgId}`, {
        data: { organisationname: org.organisationname, organisationshortname: org.organisationshortname, brandingconfig: org.brandingconfig, countryids: org.countries.map((c: any) => c.countryid), contentlanguage: lang },
      });
    await openLesson();
    await panel(page).getByTestId('lang-km').click();
    await input('lessondescription').fill(KM_NAME);
    expect((await put(null)).ok()).toBeTruthy();
    await save().click();
    const notice = toasts(page).filter({ hasText: "Set the organisation's content language first." });
    await expect(notice).toHaveCount(1);
    // The panel re-reads what the API holds and says so: the organisation has no content language now.
    await expect(panel(page).getByTestId('no-content-language')).toBeVisible();
    expect((await listFor(sa, 'lessons', ids.lesson!)).translations).toHaveLength(2);
    expect((await put('en')).ok()).toBeTruthy();
  });

  test('the organisation cannot take as its own language one it already has translations in: the API\'s sentence is shown beside the field', async () => {
    await saPage.goto('/organisation');
    await saPage.getByRole('searchbox', { name: 'Search organisations by name' }).fill(FIXTURE_ORGANISATION.name);
    await saPage.getByRole('row').filter({ hasText: FIXTURE_ORGANISATION.name }).getByRole('button', { name: `Edit ${FIXTURE_ORGANISATION.name}` }).click();
    const drawer = saPage.getByRole('dialog', { name: /organisation/i });
    await drawer.locator('#org-language').click();
    await saPage.locator('.ant-select-item-option').filter({ hasText: 'Khmer (km)' }).click();
    await drawer.getByRole('button', { name: 'Save changes' }).click();
    await expect(drawer.getByTestId('org-language-error')).toHaveText('This organisation has translations in that language. Remove them first, or choose another language.');
    await expect(drawer).toBeVisible();
    expect((await (await sa.get(`/organisation/${orgId}`)).json()).data.contentlanguage).toBe('en');
    await drawer.getByRole('button', { name: 'Cancel' }).click();
    await saPage.getByRole('alertdialog', { name: 'Discard your changes?' }).getByRole('button', { name: 'Discard changes' }).click();
    await expect(drawer).toBeHidden();
  });

  test('removing a language asks first, and then deletes every translation of the row in it', async () => {
    await openLesson();
    await panel(page).getByTestId('lang-km').click();
    await panel(page).getByTestId('remove-language').click();
    const confirm = page.getByRole('alertdialog', { name: /Remove Khmer \(km\)\?/ });
    await expect(confirm).toBeVisible();
    // Keep it: nothing is deleted.
    await confirm.getByRole('button', { name: 'Keep it' }).click();
    expect((await listFor(sa, 'lessons', ids.lesson!)).translations).toHaveLength(2);
    await panel(page).getByTestId('remove-language').click();
    await page.getByRole('alertdialog', { name: /Remove Khmer \(km\)\?/ }).getByRole('button', { name: 'Remove language' }).click();
    await expect(toasts(page).filter({ hasText: 'translations were removed' })).toBeVisible();
    await expect(panel(page).getByTestId('lang-km')).toHaveCount(0);
    await expect(panel(page).getByTestId('no-languages')).toBeVisible();
    expect((await listFor(sa, 'lessons', ids.lesson!)).translations).toHaveLength(0);
    // The question's Khmer is its own: untouched by removing the lesson's.
    expect((await listFor(sa, 'questions', ids.mcq!)).translations).toHaveLength(1);
  });
});
