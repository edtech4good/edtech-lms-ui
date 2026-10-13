import { APIRequestContext, Locator, Page, expect, request, test } from '@playwright/test';
import { apiContext, apiLogin, loginViaUi } from '../fixtures/auth';
import { API_URL } from '../fixtures/env';
import { skipUnlessLocalApi } from '../fixtures/local-only';
import { SECOND_FIXTURE_ORGANISATION, fixtureOrganisationId } from '../fixtures/organisation';

/**
 * The platform view names the owning organisation on every owned list (PV-1): an "Organisation" column after the row's
 * name, a filter above the list ("All organisations" first), the owner in the header of a record opened from a list, and
 * the create controls disabled with the hint. When an organisation is being acted in none of it is there.
 *
 * Real API and real admin. It makes one document tag in each of the two fixture organisations (one named in Khmer),
 * so it runs only against a local API; the tags are deleted in teardown, and the teardown checks that the delete worked.
 * The documents list and the headers of opened records use what `seed:demo` and `seed:dcrs` made (two organisations that
 * own documents, a curriculum, a lesson, a question and a school each): the names are read from the API, never written here.
 */
skipUnlessLocalApi('creates a document tag in two organisations');

const RUN = Math.random().toString(36).slice(2, 6).replace(/[^a-z0-9]/g, 'x').padEnd(4, 'x');
/** A document tag name: letters and numbers, at most 8. */
const TAG_A = `pv${RUN}a`;
const TAG_B = `pv${RUN}b`;
const CHOOSE_HINT = 'Choose an organisation to act in';

interface Org { id: string; name: string }
let orgA: Org;
let orgB: Org;
const madeTags: Array<{ id: string; org: string }> = [];

let page: Page;
/** A record opened from the platform view in the records test: the page, and the organisation that owns it. */
let openedRecord: { path: string; ownerName: string } | undefined;

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const chip = (p: Page) => p.getByRole('button', { name: /^Organisation: .*Switch organisation$/ });
const menu = (p: Page) => p.getByRole('menu', { name: 'Switch organisation' });
const header = (p: Page) => p.getByRole('columnheader', { name: 'Organisation', exact: true });
const filterBox = (p: Page) => p.getByTestId('owner-filter');
const rowOf = (p: Page, text: string | RegExp) => p.getByRole('row').filter({ hasText: text });

async function tokenOf(p: Page): Promise<string> {
  return p.evaluate(() => {
    const g = (k: string) => sessionStorage.getItem(k);
    return `${g('lms_access_alg')}.${g('lms_access_payload')}.${g('lms_access_hash')}`;
  });
}

/** Switch an API context's session to an organisation (the token it holds is replaced; the page's session is not touched here). */
async function actingAs(organisationid: string): Promise<APIRequestContext> {
  const platform = await request.newContext({ baseURL: API_URL, extraHTTPHeaders: { Authorization: `Bearer ${await apiLogin()}` } });
  const res = await platform.post('/auth/organisation', { data: { organisationid } });
  expect(res.ok(), `could not act as ${organisationid}: HTTP ${res.status()}`).toBeTruthy();
  const token = (await res.json()).data.accessToken as string;
  await platform.dispose();
  return apiContext(token);
}

async function organisationNames(api: APIRequestContext): Promise<Map<string, string>> {
  const res = await api.get('/organisation?pagesize=200');
  expect(res.ok(), `organisation list: HTTP ${res.status()}`).toBeTruthy();
  const rows: Array<{ organisationid: string; organisationname: string }> = (await res.json()).data.data;
  return new Map(rows.map((o) => [o.organisationid, o.organisationname]));
}

/** Choose an option of the owner filter by its text. */
async function chooseOwner(p: Page, name: string): Promise<void> {
  await filterBox(p).locator('nz-select').click();
  await p.locator('.ant-select-item-option').filter({ has: p.getByText(name, { exact: true }) }).click();
}

/** The list requests a page makes, with the filter each carried. */
function recordListFilters(p: Page, pathEnd: string): { seen: Array<Array<{ key: string; value: string }>>; stop: () => void } {
  const seen: Array<Array<{ key: string; value: string }>> = [];
  const on = (r: import('@playwright/test').Request) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname.endsWith(pathEnd)) seen.push(r.postDataJSON()?.filter ?? []);
  };
  p.on('request', on);
  return { seen, stop: () => p.off('request', on) };
}

/** Every list the platform view puts the owner on, with the first column's heading. */
const LISTS: Array<[string, string]> = [
  ['document/index', 'Document Name'],
  ['documenttag/index', 'Document Tag Name'],
  ['questiontag/index', 'Question Tag Name'],
  ['curriculum/index', 'Curriculum Name'],
  ['subject/index', 'Subject Name'],
  ['question/index', 'Question Identifier'],
  ['school/index', 'School Name'],
  ['standard/index', 'Class Name'],
  ['grade/index', 'Grade Name'],
  ['level/index', 'Level Name'],
  ['lesson/index', 'Lesson Name'],
  ['student/index', 'Student Name'],
  ['teacher/index', 'Teacher User Name'],
  ['feedback/index', 'Curriculum'],
  ['baseline-curriculum/index', 'Curriculum Name'],
];

/** The pages that create content or people, and what the control says. */
const CREATES: Array<[string, string]> = [
  ['document/index', 'Upload'],
  ['documenttag/index', 'Create'],
  ['questiontag/index', 'Create'],
  ['curriculum/index', 'Create'],
  ['subject/index', 'Create'],
  ['question/index', 'Create'],
  ['school/index', 'Create'],
  ['standard/index', 'Create'],
  ['grade/index', 'Create'],
  ['level/index', 'Create'],
  ['lesson/index', 'Create'],
  ['student/index', 'Upload Users'],
  ['teacher/index', 'Upload Teachers'],
  ['baseline-curriculum/index', 'Create'],
];

test.beforeAll(async ({ browser }) => {
  // Before anything signs in on a page: one token per user, and switching evicts the last one.
  const root = await apiContext(await apiLogin());
  const idA = await fixtureOrganisationId(root);
  const idB = await fixtureOrganisationId(root, undefined, SECOND_FIXTURE_ORGANISATION);
  const names = await organisationNames(root);
  await root.dispose();
  orgA = { id: idA, name: names.get(idA)! };
  orgB = { id: idB, name: names.get(idB)! };
  expect(orgA.name, 'the first fixture organisation has a name').toBeTruthy();
  expect(orgB.name, 'the second fixture organisation (named in Khmer) has a name').toBe(SECOND_FIXTURE_ORGANISATION.name);

  for (const [org, tag] of [[orgA, TAG_A], [orgB, TAG_B]] as const) {
    const acting = await actingAs(org.id);
    const created = await acting.post('/documenttag/create', { data: { documenttagname: tag } });
    expect(created.ok(), `could not create ${tag}: HTTP ${created.status()}`).toBeTruthy();
    const list = await acting.post('/documenttag', { data: { pageindex: 1, pagesize: 200, filter: [] } });
    const row = (await list.json()).data.data.find((t: { documenttagname: string }) => t.documenttagname === tag);
    expect(row, `${tag} is in the list of its organisation`).toBeTruthy();
    expect(row.organisationid, 'the tag is owned by the organisation it was made in').toBe(org.id);
    madeTags.push({ id: row.documenttagid, org: org.id });
    await acting.dispose();
  }
  page = await browser.newPage();
  await loginViaUi(page);
});

test.afterAll(async () => {
  for (const tag of madeTags) {
    const acting = await actingAs(tag.org);
    const res = await acting.delete(`/documenttag/${tag.id}`);
    if (!res.ok()) throw new Error(`failed to delete the document tag ${tag.id}: HTTP ${res.status()}`);
    const list = await acting.post('/documenttag', { data: { pageindex: 1, pagesize: 200, filter: [] } });
    const left = (await list.json()).data.data.filter((t: { documenttagid: string }) => t.documenttagid === tag.id);
    expect(left, `the delete of ${tag.id} did something`).toHaveLength(0);
    await acting.dispose();
  }
  await page?.close();
});

test.describe('the platform view, signed in as the platform superadmin and acting in no organisation', () => {
  test.describe.configure({ mode: 'serial' });

  test('the document tag list names each row\'s organisation, the Khmer name included, right after the name', async () => {
    await page.goto('/documenttag/index');
    await expect(chip(page)).toHaveAccessibleName(/^Organisation: All organisations, Platform view/);
    await expect(header(page)).toHaveCount(1);
    const heads = (await page.locator('thead th').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    expect(heads.slice(0, 2), 'the Organisation column is the first after the name').toEqual(['Document Tag Name', 'Organisation']);
    const a = rowOf(page, TAG_A);
    const b = rowOf(page, TAG_B);
    await expect(a.getByTestId('owner-name')).toHaveText(orgA.name);
    await expect(b.getByTestId('owner-name')).toHaveText(orgB.name);
    expect(orgB.name).toMatch(/[ក-៿]/); // a Khmer name, shown as stored
  });

  test('the filter starts at All organisations, narrows the list to one organisation through the API, and All brings both back', async () => {
    await page.goto('/documenttag/index');
    await expect(filterBox(page)).toBeVisible();
    await expect(filterBox(page).locator('nz-select')).toContainText('All organisations');
    await expect(rowOf(page, TAG_A)).toHaveCount(1);
    await expect(rowOf(page, TAG_B)).toHaveCount(1);

    const sent = recordListFilters(page, '/documenttag');
    await chooseOwner(page, orgA.name);
    await expect(rowOf(page, TAG_A)).toHaveCount(1);
    await expect(rowOf(page, TAG_B)).toHaveCount(0);
    expect(sent.seen.at(-1), 'the page asked the API for one organisation').toEqual([{ key: 'organisationid', value: orgA.id }]);
    // Every row left is that organisation's.
    const owners = await page.getByTestId('owner-name').allInnerTexts();
    expect(owners.length).toBeGreaterThan(0);
    for (const o of owners) expect(o).toBe(orgA.name);

    await chooseOwner(page, orgB.name);
    await expect(rowOf(page, TAG_B)).toHaveCount(1);
    await expect(rowOf(page, TAG_A)).toHaveCount(0);
    expect(sent.seen.at(-1)).toEqual([{ key: 'organisationid', value: orgB.id }]);

    await chooseOwner(page, 'All organisations');
    await expect(rowOf(page, TAG_A)).toHaveCount(1);
    await expect(rowOf(page, TAG_B)).toHaveCount(1);
    expect(sent.seen.at(-1), 'All sends no organisation').toEqual([]);
    sent.stop();
  });

  for (const [path, firstColumn] of LISTS) {
    test(`${path}: the Organisation column and the filter are there`, async () => {
      await page.goto(`/${path}`);
      await expect(page.locator('thead th').filter({ hasText: firstColumn }).first()).toBeVisible();
      await expect(header(page)).toHaveCount(1);
      await expect(filterBox(page)).toBeVisible();
      await expect(filterBox(page).locator('nz-select')).toContainText('All organisations');
    });
  }

  // Every page that creates something: the control is a disabled button (never a link), and says why on hover.
  for (const [path, name] of CREATES) {
    test(`${path}: ${name} is disabled, with the hint, and is not a link`, async () => {
      await page.goto(`/${path}`);
      // (The text only: the document page's button has an icon in front of it.)
      const button = page.locator('button').filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) });
      await expect(button).toBeDisabled();
      await expect(page.getByRole('link', { name, exact: true })).toHaveCount(0);
      await button.locator('xpath=..').hover();
      await expect(page.locator('.ant-tooltip')).toContainText(CHOOSE_HINT);
    });
  }

  // The lists the seeds fill for two organisations: choosing one organisation leaves only its rows, "All" brings the other back.
  for (const path of [
    'curriculum/index',
    'subject/index',
    'question/index',
    'school/index',
    'standard/index',
    'grade/index',
    'level/index',
    'lesson/index',
    'student/index',
    'teacher/index',
    'feedback/index',
    'baseline-curriculum/index',
  ]) {
    test(`${path}: the filter leaves only the rows of the organisation chosen`, async () => {
      await page.goto(`/${path}`);
      const owners = () => page.getByTestId('owner-name').allInnerTexts();
      await expect.poll(async () => new Set(await owners()).size, { message: `${path}: two organisations own rows (seed:demo and seed:dcrs)` }).toBeGreaterThanOrEqual(2);
      const before = await owners();
      const [chosen, other] = [...new Set(before)];
      await chooseOwner(page, chosen);
      await expect.poll(async () => [...new Set(await owners())], { message: `${path}: only ${chosen} is left` }).toEqual([chosen]);
      const after = await owners();
      expect(after.length, 'rows of the other organisation are gone').toBeLessThan(before.length);
      await chooseOwner(page, 'All organisations');
      await expect.poll(async () => (await owners()).includes(other), { message: `${path}: All brings ${other} back` }).toBe(true);
    });
  }

  test('the documents list names the owner of each document, and the filter narrows it to the organisation chosen', async () => {
    const api = await apiContext(await tokenOf(page));
    const names = await organisationNames(api);
    const docs: Array<{ documentid: string; documentname: string; documenttitle: string | null; organisationid: string | null }> = (
      await (await api.post('/document', { data: { pageindex: 1, pagesize: 200, filter: [] } })).json()
    ).data.data;
    await api.dispose();
    const owners = [...new Set(docs.map((d) => d.organisationid).filter((o): o is string => !!o))];
    expect(owners.length, 'seed:demo and seed:dcrs: two organisations own documents').toBeGreaterThanOrEqual(2);
    const [o1, o2] = owners;
    const labelOf = (d: { documenttitle: string | null; documentname: string }) => d.documenttitle ?? d.documentname;

    await page.goto('/document/index');
    await expect(header(page)).toHaveCount(1);
    for (const o of [o1, o2]) {
      const first = docs.find((d) => d.organisationid === o)!;
      await expect(rowOf(page, labelOf(first)).first().getByTestId('owner-name')).toHaveText(names.get(o)!);
    }

    const sent = recordListFilters(page, '/document');
    await chooseOwner(page, names.get(o1)!);
    expect(sent.seen.at(-1)).toEqual([{ key: 'organisationid', value: o1 }]);
    const expected = docs.filter((d) => d.organisationid === o1).length;
    // (The pager's total is hidden on a single page: count the rows.)
    await expect(page.getByTestId('owner-name')).toHaveCount(expected);
    for (const text of await page.getByTestId('owner-name').allInnerTexts()) expect(text).toBe(names.get(o1));
    const other = docs.find((d) => d.organisationid === o2)!;
    await expect(rowOf(page, labelOf(other)), 'a document of the other organisation is not listed').toHaveCount(0);
    sent.stop();
  });

  test('a document opened for editing says who owns it', async () => {
    await page.goto('/document/index');
    const firstRow = page.locator('tbody tr').first();
    const owner = await firstRow.getByTestId('owner-name').innerText();
    await firstRow.locator('a').filter({ hasText: /^Edit$/ }).click(); // an anchor with no address: not a link role
    await expect(page.locator('.ant-modal').getByTestId('owned-by')).toHaveText(`Owned by ${owner}`);
    await page.locator('.ant-modal').getByRole('button', { name: 'Cancel' }).click();
  });

  test('a curriculum, a lesson, a question and a school opened from the platform view say who owns them', async () => {
    const api = await apiContext(await tokenOf(page));
    const names = await organisationNames(api);
    const first = async (path: string, body: object, key: string) =>
      (await (await api.post(path, { data: body })).json()).data.data[0]?.[key] as string;
    const paging = { pageindex: 1, pagesize: 1, filter: [] };
    const curriculumRow = (await (await api.post('/curriculum', { data: paging })).json()).data.data[0];
    const schoolRow = (await (await api.post('/school', { data: paging })).json()).data.data[0];
    const questionid = await first('/question', paging, 'questionid');
    const lessonid = (await (await api.get('/lesson/all')).json()).data[0].lessonid as string;
    const lessonOwner = (await (await api.get(`/lesson/${lessonid}`)).json()).data.organisationid as string;
    const questionOwner = (await (await api.get(`/question/${questionid}`)).json()).data.organisationid as string;
    await api.dispose();

    for (const [path, owner, label] of [
      [`curriculum/update/${curriculumRow.curriculumid}`, curriculumRow.organisationid, 'curriculum'],
      [`school/update/${schoolRow.schoolid}`, schoolRow.organisationid, 'school'],
      [`lesson/update/${lessonid}`, lessonOwner, 'lesson'],
      [`question/update/${questionid}`, questionOwner, 'question'],
    ] as const) {
      expect(names.get(owner), `the ${label} has an owner that is a live organisation`).toBeTruthy();
      await page.goto(`/${path}`);
      await expect(page.getByTestId('owned-by'), `the ${label}'s header`).toHaveText(`Owned by ${names.get(owner)}`);
      if (label === 'curriculum') openedRecord = { path, ownerName: names.get(owner)! };
    }
  });
});

test.describe('acting in an organisation', () => {
  test.describe.configure({ mode: 'serial' });

  test('choosing the organisation in the switcher takes the column, the filter and the disabled controls away', async () => {
    await page.goto('/documenttag/index');
    await chip(page).click();
    await expect(menu(page)).toBeVisible();
    await menu(page).getByRole('menuitemradio', { name: new RegExp(`^${escapeRe(orgA.name)}`) }).click();
    await expect(chip(page)).toHaveAccessibleName(new RegExp(`^Organisation: ${escapeRe(orgA.name)}`));
    await page.goto('/documenttag/index');
    await expect(rowOf(page, TAG_A)).toHaveCount(1);
    await expect(rowOf(page, TAG_B), 'the other organisation\'s tag is not listed').toHaveCount(0);
    await expect(header(page)).toHaveCount(0);
    await expect(page.getByTestId('owner-name')).toHaveCount(0);
    await expect(filterBox(page)).toHaveCount(0);
    await expect(page.getByTestId('create-blocked')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Create', exact: true })).toBeVisible();
  });

  for (const [path, firstColumn] of LISTS) {
    test(`${path}: no Organisation column, no filter, and the create control is a live link`, async () => {
      await page.goto(`/${path}`);
      await expect(page.locator('thead th').filter({ hasText: firstColumn }).first()).toBeVisible();
      await expect(header(page)).toHaveCount(0);
      await expect(page.getByTestId('owner-name')).toHaveCount(0);
      await expect(filterBox(page)).toHaveCount(0);
      await expect(page.getByTestId('create-blocked')).toHaveCount(0);
      await expect(page.locator('.create-action-blocked button:disabled')).toHaveCount(0);
    });
  }

  test('a record opened while acting in its owner has no owner line', async () => {
    expect(openedRecord, 'the records test opened a curriculum').toBeTruthy();
    await page.goto('/documenttag/index');
    await chip(page).click();
    await menu(page).getByRole('menuitemradio', { name: new RegExp(`^${escapeRe(openedRecord!.ownerName)}`) }).click();
    await expect(chip(page)).toHaveAccessibleName(new RegExp(`^Organisation: ${escapeRe(openedRecord!.ownerName)}`));
    await page.goto(`/${openedRecord!.path}`);
    await expect(page.locator('form').first()).toBeVisible();
    await expect(page.getByTestId('owned-by')).toHaveCount(0);
  });

  test('back in the platform view the column returns', async () => {
    await page.goto('/documenttag/index');
    await chip(page).click();
    await menu(page).getByRole('menuitemradio', { name: 'All organisations' }).click();
    await expect(chip(page)).toHaveAccessibleName(/^Organisation: All organisations, Platform view/);
    await page.goto('/documenttag/index');
    await expect(header(page)).toHaveCount(1);
    await expect(rowOf(page, TAG_B).getByTestId('owner-name')).toHaveText(orgB.name);
  });
});
