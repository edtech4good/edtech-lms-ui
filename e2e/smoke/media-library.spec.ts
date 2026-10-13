import { APIRequestContext, Locator, Page, expect, test } from '@playwright/test';
import { ROLE } from '../fixtures/accounts';
import { apiContext, apiLogin, loginViaUi } from '../fixtures/auth';
import { skipUnlessLocalApi } from '../fixtures/local-only';
import { ensureLocalFixtureUser } from '../fixtures/local-fixture-user';

/**
 * The media library in the existing admin pages (docs/media-library-phase0-design.md, ML-3): upload with a title,
 * licence and attribution through the document page and through the shared uploader, the title as the label, the
 * edit-details form, the exact type filter, the server's refusals, and the learning picker limited to videos.
 *
 * Real API (central with ML-2) and the real admin. It makes one Organisation Admin with a password written in this
 * public repository, so it runs only against a local API, and it needs `seed:demo` (the demo lessons and tag).
 * Test files are made here, synthetic; every document these tests add is deleted in teardown, and the teardown
 * checks that the delete worked.
 */
skipUnlessLocalApi('creates an Organisation Admin');

const KHMER = 'ភ្នំពេញ'; // docs/khmer-text.md: a place name, 7 code points
const ADMIN = { username: 'e2e-media-admin@example.com', password: 'MediaAdmin_Pass1' };
const DEMO_ORG_CODE = 'edtech4good';
const DEMO_LESSON = 'b0000000-0000-4000-8000-00000000000a'; // "Reading simple words" (seed:demo)

// A 1x1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
// The first bytes of an MP4: a box size, then "ftyp" at offset 4, then padding.
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(16)]);
const CSV = Buffer.from('a,b\n1,2\n', 'utf8');
// Not an image at all, whatever its name says.
const NOT_AN_IMAGE = Buffer.from('MZ\u0090\u0000\u0003 this is a program, not a picture');

const toasts = (p: Page) => p.locator('.ant-notification-notice');
/** The "Upload" button (the document page's has an icon in front of its text). */
const uploadButton = (p: Page) => p.locator('button').filter({ hasText: /^\s*Upload\s*$/ });
const modal = (p: Page, title: string) => p.locator('.ant-modal').filter({ has: p.locator('.ant-modal-title', { hasText: title }) });

interface DocRow {
  documentid: string;
  documentname: string;
  documenttitle: string | null;
  documentlicence: string;
  documentattribution: { v: number; author?: string; sourceurl?: string; adaptedfrom?: string } | null;
  documenttypeid: number;
  documenttags: string[];
}

async function tokenOf(p: Page): Promise<string> {
  return p.evaluate(() => {
    const g = (k: string) => sessionStorage.getItem(k);
    return `${g('lms_access_alg')}.${g('lms_access_payload')}.${g('lms_access_hash')}`;
  });
}

async function listDocuments(api: APIRequestContext, filter: Array<{ key: string; value: string }> = []): Promise<DocRow[]> {
  const res = await api.post('/document', { data: { pageindex: 1, pagesize: 200, filter } });
  expect(res.ok(), `document list: HTTP ${res.status()}`).toBeTruthy();
  return (await res.json()).data.data;
}

/** Choose a file in the open modal's drop area. */
async function chooseFile(p: Page, dialog: Locator, name: string, buffer: Buffer, mimeType = 'application/octet-stream') {
  await dialog.locator('input[type="file"]').setInputFiles({ name, mimeType, buffer });
}

/**
 * A refused file's line: the file's name, then the server's own words. The server's wording is not pinned here (only a
 * stable fragment of it), so a tweak to its text does not break the suite; the name in front is the client's job.
 */
const refusalLine = (name: string, fragment: string) =>
  new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: .*${fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);

/** The title input beside a chosen file in the upload dialog. */
const titleOf = (dialog: Locator, fileName: string) => dialog.getByLabel(`Title for ${fileName}`, { exact: true });

/** Choose a licence in an open details form by its label (the select searches as you type). */
async function chooseLicence(p: Page, dialog: Locator, label: string) {
  await dialog.locator('nz-select').click();
  await p.keyboard.type(label);
  await p.locator('.ant-select-item-option').filter({ hasText: label }).first().click();
}

/**
 * What the page's upload form put in the multipart body: Playwright cannot read a multipart body that holds a file, so
 * the page's XHR is wrapped (before every navigation) to note each upload's fields; a file shows as `file:<name>`.
 */
async function watchUploads(p: Page) {
  await p.addInitScript(() => {
    const w = window as unknown as { __uploads: Array<Record<string, string>> };
    w.__uploads = [];
    const open = XMLHttpRequest.prototype.open;
    const send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest & { __url?: string }, method: string, url: string | URL, ...rest: any[]) {
      this.__url = String(url);
      return (open as any).call(this, method, url, ...rest);
    } as typeof open;
    XMLHttpRequest.prototype.send = function (this: XMLHttpRequest & { __url?: string }, body?: any) {
      if (body instanceof FormData && (this.__url ?? '').endsWith('/document/upload')) {
        const fields: Record<string, string> = {};
        body.forEach((v, k) => (fields[k] = typeof v === 'string' ? v : `file:${(v as File).name}`));
        w.__uploads.push(fields);
      }
      return send.call(this, body);
    } as typeof send;
  });
}
const lastUpload = (p: Page) =>
  p.evaluate(() => (window as unknown as { __uploads: Array<Record<string, string>> }).__uploads.slice(-1)[0] as Record<string, string>);

const allUploads = (p: Page) =>
  p.evaluate(() => (window as unknown as { __uploads: Array<Record<string, string>> }).__uploads);

/** The learnings the picker test adds to the demo lesson ("A clip"): deleted before it, after it, and in teardown; the delete is checked. */
async function deleteTestLearnings(a: APIRequestContext): Promise<void> {
  const list = async () => ((await (await a.get(`/lesson/learning/${DEMO_LESSON}`)).json()).data as Array<{ lessonlearningid: string; lessonlearningname: string }>)
    .filter((x) => x.lessonlearningname === 'A clip' || x.lessonlearningname === 'A picture');
  for (const l of await list()) {
    const res = await a.delete(`/lesson/learning/${l.lessonlearningid}`);
    expect(res.ok(), `deleting the learning: HTTP ${res.status()}`).toBeTruthy();
  }
  expect(await list(), 'a learning the test added is still listed after its delete').toHaveLength(0);
}

let page: Page;
let api: APIRequestContext;
const before = new Set<string>();

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  const sa = await apiContext(await apiLogin());
  const orgs = await sa.get(`/organisation?pagesize=200&organisationname=EdTech`);
  const org: string | undefined = (await orgs.json()).data.data.find((o: { organisationcode: string }) => o.organisationcode === DEMO_ORG_CODE)
    ?.organisationid;
  expect(org, `the organisation ${DEMO_ORG_CODE} (seed:demo) is on this API`).toBeTruthy();
  await ensureLocalFixtureUser(sa, { ...ADMIN, roles: [ROLE.organisationadmin], organisationid: org });
  await sa.dispose();
  page = await browser.newPage();
  await watchUploads(page);
  await loginViaUi(page, ADMIN.username, ADMIN.password);
  api = await apiContext(await tokenOf(page));
  for (const d of await listDocuments(api)) before.add(d.documentid);
});

test.afterAll(async () => {
  await deleteTestLearnings(api);
  // Every document these tests added goes; then the list is read again to see that it did.
  const added = (await listDocuments(api)).filter((d) => !before.has(d.documentid));
  for (const d of added) {
    const res = await api.delete(`/document/${d.documentid}`);
    expect(res.ok(), `cleanup: deleting ${d.documentid} came back ${res.status()}`).toBeTruthy();
  }
  const left = (await listDocuments(api)).filter((d) => !before.has(d.documentid));
  expect(left, 'documents these tests added are still listed after their delete').toHaveLength(0);
  await api.dispose();
  await page.close();
});

test('the document page: a Khmer-named PNG lands as a document labelled with its Khmer title', async () => {
  await page.goto('/document/index');
  await uploadButton(page).click();
  const dialog = modal(page, 'Upload Document');
  await expect(dialog.getByText('Upload one or more files. Each becomes its own document.')).toBeVisible();
  await chooseFile(page, dialog, `${KHMER}.png`, PNG, 'image/png');
  // The title follows the file name, marks and all, and can be edited.
  await expect(titleOf(dialog, `${KHMER}.png`)).toHaveValue(KHMER);
  await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(toasts(page).filter({ hasText: 'Document uploaded sucessfully' })).toHaveCount(1);
  expect(await lastUpload(page)).toEqual({ documenttitle: KHMER, documentlicence: 'unspecified', 'files[]': `file:${KHMER}.png` });
  await expect(toasts(page).filter({ hasText: 'Document uploaded sucessfully' })).toHaveCount(1);
  await expect(dialog).toBeHidden();

  // The list shows the title, not the generated key.
  await expect(page.getByRole('button', { name: KHMER, exact: true })).toBeVisible();
  const [row] = (await listDocuments(api)).filter((d) => d.documenttitle === KHMER);
  expect(row, 'the uploaded document is on the server with its title').toBeTruthy();
  expect(row.documentname).toMatch(/^[0-9a-f-]{36}\.png$/);
  expect(row.documentlicence).toBe('unspecified');
  expect(row.documentattribution).toBeNull();
  expect(row.documenttypeid).toBe(6);
});

test('licence and attribution round-trip: upload, edit details, clear', async () => {
  await page.goto('/document/index');
  await uploadButton(page).click();
  const dialog = modal(page, 'Upload Document');
  await chooseFile(page, dialog, 'licence-check.png', PNG, 'image/png');
  await titleOf(dialog, 'licence-check.png').fill('Licence check');
  await chooseLicence(page, dialog, 'CC BY-NC-SA 3.0');
  await dialog.getByLabel('Author').fill('Ana Example');
  await dialog.getByLabel('Source address').fill('https://example.org/a-page');
  await dialog.getByLabel('Adapted from').fill('An older book');
  await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(toasts(page).filter({ hasText: 'Document uploaded sucessfully' }).last()).toBeVisible();
  expect(await lastUpload(page)).toEqual({
    documenttitle: 'Licence check',
    documentlicence: 'CC-BY-NC-SA-3.0',
    documentattribution: JSON.stringify({ v: 1, author: 'Ana Example', sourceurl: 'https://example.org/a-page', adaptedfrom: 'An older book' }),
    'files[]': 'file:licence-check.png',
  });
  await expect(dialog).toBeHidden();

  const [row] = (await listDocuments(api)).filter((d) => d.documenttitle === 'Licence check');
  expect(row.documentlicence).toBe('CC-BY-NC-SA-3.0');
  expect(row.documentattribution).toEqual({ v: 1, author: 'Ana Example', sourceurl: 'https://example.org/a-page', adaptedfrom: 'An older book' });

  // Edit details: the form shows what is stored.
  const tableRow = page.locator('tbody tr').filter({ hasText: 'Licence check' });
  await tableRow.getByText('Edit', { exact: true }).click();
  const edit = modal(page, 'Edit Document');
  await expect(edit.getByLabel('Title (optional)')).toHaveValue('Licence check');
  await expect(edit.locator('nz-select .ant-select-selection-item')).toHaveText('CC BY-NC-SA 3.0');
  await expect(edit.getByLabel('Author')).toHaveValue('Ana Example');
  await expect(edit.getByLabel('Source address')).toHaveValue('https://example.org/a-page');
  await expect(edit.getByLabel('Adapted from')).toHaveValue('An older book');
  // Change the licence, drop the adapted-from, keep the rest.
  await chooseLicence(page, edit, 'CC0 1.0');
  await edit.getByLabel('Adapted from').fill('');
  const put = page.waitForRequest((r) => r.method() === 'PUT' && r.url().endsWith(`/document/${row.documentid}`));
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await put).postDataJSON()).toEqual({
    documenttitle: 'Licence check',
    documentlicence: 'CC0-1.0',
    documentattribution: { v: 1, author: 'Ana Example', sourceurl: 'https://example.org/a-page' },
  });
  await expect(toasts(page).filter({ hasText: 'Document updated sucessfully' })).toHaveCount(1);
  await expect(edit).toBeHidden();
  let now = (await listDocuments(api)).find((d) => d.documentid === row.documentid)!;
  expect(now.documentlicence).toBe('CC0-1.0');
  expect(now.documentattribution).toEqual({ v: 1, author: 'Ana Example', sourceurl: 'https://example.org/a-page' });
  expect(now.documentname, 'an edit never touches the key').toBe(row.documentname);

  // Clear the licence (it becomes "not recorded"), the title (the key shows) and the attribution.
  await page.locator('tbody tr').filter({ hasText: 'Licence check' }).getByText('Edit', { exact: true }).click();
  await expect(edit.locator('nz-select .ant-select-selection-item')).toHaveText('CC0 1.0 (public domain)');
  await edit.locator('nz-select .ant-select-clear').click({ force: true });
  await edit.getByLabel('Title (optional)').fill('');
  await edit.getByLabel('Author').fill('');
  await edit.getByLabel('Source address').fill('');
  const put2 = page.waitForRequest((r) => r.method() === 'PUT' && r.url().endsWith(`/document/${row.documentid}`));
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await put2).postDataJSON()).toEqual({ documenttitle: null, documentlicence: 'unspecified', documentattribution: null });
  await expect(edit).toBeHidden();
  now = (await listDocuments(api)).find((d) => d.documentid === row.documentid)!;
  expect(now.documenttitle).toBeNull();
  expect(now.documentlicence).toBe('unspecified');
  expect(now.documentattribution).toBeNull();
  // With no title the list shows the key.
  await expect(page.getByRole('button', { name: row.documentname, exact: true })).toBeVisible();
});

test('a refused file is named with the server\'s message, in the dialog and in a notice, and adds nothing', async () => {
  const count = async () => (await listDocuments(api)).length;
  const start = await count();
  const cases: Array<{ name: string; buffer: Buffer; title?: string; says: string }> = [
    // a program renamed .png: the first bytes do not agree with the name
    { name: `${KHMER}.png`, buffer: NOT_AN_IMAGE, says: "isn't a valid" },
    // a type that is not on the list
    { name: 'tool.exe', buffer: NOT_AN_IMAGE, says: "type isn't supported" },
    // a title the API will not take: its own message, not "some of the information isn't valid"
    { name: 'long-title.png', buffer: PNG, title: 'x'.repeat(256), says: 'at most 255 characters' },
  ];
  for (const c of cases) {
    await page.goto('/document/index');
    await uploadButton(page).click();
    const dialog = modal(page, 'Upload Document');
    await chooseFile(page, dialog, c.name, c.buffer, 'image/png');
    if (c.title) await titleOf(dialog, c.name).fill(c.title);
    await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
    // the file's name in front of the server's words (the server never says the name), in the dialog and in one notice
    const line = refusalLine(c.name, c.says);
    await expect(dialog.locator('.upload-file-error')).toHaveText(line);
    await expect(toasts(page)).toHaveCount(1);
    await expect(toasts(page).first()).toHaveText(new RegExp(line.source.replace(/^\^/, '')));
    await expect(toasts(page).first()).toContainText(`${c.name}: `);
    await expect(dialog).toBeVisible();
  }
  expect(await count(), 'a refused upload adds no document').toBe(start);

  // a file name is shown as text, never as markup
  await page.goto('/document/index');
  await uploadButton(page).click();
  const dialog = modal(page, 'Upload Document');
  await chooseFile(page, dialog, '<b>bold</b>.exe', NOT_AN_IMAGE);
  await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(toasts(page).first()).toContainText('<b>bold</b>.exe: ');
  await expect(toasts(page).first()).toContainText("type isn't supported");
  await expect(toasts(page).first().locator('b')).toHaveCount(0);
  await expect(dialog.locator('.upload-file-error b')).toHaveCount(0);
});

test('several files: one request each, its own title each, a refused file stays with its message and the batch goes on', async () => {
  const known = new Set((await listDocuments(api)).map((d) => d.documentid));
  await page.goto('/document/index');
  await uploadButton(page).click();
  const dialog = modal(page, 'Upload Document');
  // two files chosen together: each gets its own title from its own name
  await dialog.locator('input[type="file"]').setInputFiles([
    { name: 'bulk-one.png', mimeType: 'image/png', buffer: PNG },
    { name: 'bulk-two.png', mimeType: 'image/png', buffer: PNG },
  ]);
  await expect(titleOf(dialog, 'bulk-one.png')).toHaveValue('bulk-one');
  await expect(titleOf(dialog, 'bulk-two.png')).toHaveValue('bulk-two');
  await titleOf(dialog, 'bulk-two.png').fill('Second one');
  await chooseLicence(page, dialog, 'CC BY 4.0');
  await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(toasts(page).filter({ hasText: '2 documents uploaded sucessfully' })).toHaveCount(1);
  await expect(dialog).toBeHidden();
  // two requests, one file each, the batch's licence, the file's own title
  expect((await allUploads(page)).slice(-2)).toEqual([
    { documenttitle: 'bulk-one', documentlicence: 'CC-BY-4.0', 'files[]': 'file:bulk-one.png' },
    { documenttitle: 'Second one', documentlicence: 'CC-BY-4.0', 'files[]': 'file:bulk-two.png' },
  ]);
  const added = (await listDocuments(api)).filter((d) => !known.has(d.documentid));
  expect(added.map((d) => d.documenttitle).sort()).toEqual(['Second one', 'bulk-one']);
  expect(added.every((d) => d.documentlicence === 'CC-BY-4.0')).toBeTruthy();
  // the list shows them after the batch
  await expect(page.getByRole('button', { name: 'Second one', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'bulk-one', exact: true })).toBeVisible();

  // one good file and one refused: the good one lands, the refused one stays with the server's words
  await page.goto('/document/index');
  await uploadButton(page).click();
  await dialog.locator('input[type="file"]').setInputFiles([
    { name: 'mixed-bad.png', mimeType: 'image/png', buffer: NOT_AN_IMAGE },
    { name: 'mixed-good.png', mimeType: 'image/png', buffer: PNG },
  ]);
  await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
  const badLine = refusalLine('mixed-bad.png', "isn't a valid");
  await expect(dialog.locator('.upload-file-error')).toHaveText(badLine);
  await expect(toasts(page).filter({ hasText: 'Document uploaded sucessfully' })).toHaveCount(1);
  await expect(toasts(page).filter({ hasText: 'mixed-bad.png: ' })).toHaveCount(1);
  await expect(dialog.locator('.upload-file')).toHaveCount(1);
  await expect(dialog.locator('.upload-file-name')).toHaveText('mixed-bad.png');
  const after = (await listDocuments(api)).filter((d) => !known.has(d.documentid));
  expect(after.map((d) => d.documenttitle).sort()).toEqual(['Second one', 'bulk-one', 'mixed-good']);
  // the batch went on past the refusal: the good file came AFTER the bad one
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();

  // more than three refused: one notice that lists them all
  await page.goto('/document/index');
  await uploadButton(page).click();
  await dialog.locator('input[type="file"]').setInputFiles(
    [1, 2, 3, 4].map((n) => ({ name: `bad-${n}.exe`, mimeType: 'application/octet-stream', buffer: NOT_AN_IMAGE })),
  );
  await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(dialog.locator('.upload-file-error')).toHaveCount(4);
  await expect(toasts(page)).toHaveCount(1);
  for (const n of [1, 2, 3, 4]) await expect(toasts(page).first()).toContainText(`bad-${n}.exe: `);
  await expect(toasts(page).first()).toContainText("type isn't supported");
});

test('the type filter sends one exact id, and the new types are named', async () => {
  // a spreadsheet: type 10
  await page.goto('/document/index');
  await uploadButton(page).click();
  const dialog = modal(page, 'Upload Document');
  await chooseFile(page, dialog, 'figures.csv', CSV, 'text/csv');
  await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('tbody tr').filter({ hasText: 'figures' }).locator('td').nth(1)).toHaveText('SPREADSHEET');

  /** Type into the Document Type filter and search; resolves with the list request's filter (null when none was sent). */
  const typeFilter = async (typed: string, expectRequest = true) => {
    await page.locator('th', { hasText: 'Document Type' }).locator('nz-filter-trigger').click();
    const box = page.getByPlaceholder('Search document type');
    await expect(box).toBeVisible();
    await box.fill(typed);
    const asked = expectRequest ? page.waitForRequest((r) => r.method() === 'POST' && /\/document$/.test(r.url())) : null;
    await page.locator('.ant-table-filter-dropdown').getByRole('button', { name: 'Search', exact: true }).dispatchEvent('click');
    return asked ? ((await asked).postDataJSON().filter as Array<{ key: string; value: string }>) : null;
  };

  // type 1 (AUDIO) is not a prefix of type 10: no spreadsheet comes back for it
  const audio = await typeFilter('AUDIO');
  expect(audio.find((f) => f.key === 'documenttypeid')).toEqual({ key: 'documenttypeid', value: '1' });
  await expect(page.locator('tbody tr').filter({ hasText: 'figures' })).toHaveCount(0);
  // (whatever else the organisation holds, nothing listed under AUDIO is anything but audio)
  for (const type of await page.locator('tbody tr.ant-table-row td:nth-child(2)').allTextContents()) expect(type.trim()).toBe('AUDIO');

  const sheet = await typeFilter('spreadsheet');
  expect(sheet.find((f) => f.key === 'documenttypeid')).toEqual({ key: 'documenttypeid', value: '10' });
  await expect(page.locator('tbody tr').filter({ hasText: 'figures' })).toHaveCount(1);
  const types = await page.locator('tbody tr.ant-table-row td:nth-child(2)').allTextContents();
  expect(types.length).toBeGreaterThan(0);
  expect(types.every((t) => t.trim() === 'SPREADSHEET'), `rows under SPREADSHEET: ${types.join(',')}`).toBeTruthy();

  // a name that is not a type says so, and sends nothing
  await typeFilter('nothing', false);
  await expect(toasts(page).filter({ hasText: 'Invalid document type' }).first()).toBeVisible();
});

test('the shared uploader (question create): same fields, attribution behind an expander, lands as a titled document', async () => {
  const known = new Set((await listDocuments(api)).map((d) => d.documentid));
  await page.goto('/question/create');
  await uploadButton(page).click();
  const dialog = modal(page, 'Upload Document');
  await expect(dialog.locator('nz-select')).toBeVisible();
  // attribution is behind an expander
  await expect(dialog.getByLabel('Author')).toBeHidden();
  await chooseFile(page, dialog, `${KHMER}.png`, PNG, 'image/png');
  await expect(titleOf(dialog, `${KHMER}.png`)).toHaveValue(KHMER);
  await chooseLicence(page, dialog, 'CC BY 4.0');
  await dialog.getByText('Attribution (optional)').click();
  await expect(dialog.getByLabel('Author')).toBeVisible();
  await dialog.getByLabel('Author').fill('Ana Example');
  await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(toasts(page).filter({ hasText: 'Document uploaded sucessfully' })).toHaveCount(1);
  expect(await lastUpload(page)).toEqual({
    documenttitle: KHMER,
    documentlicence: 'CC-BY-4.0',
    documentattribution: JSON.stringify({ v: 1, author: 'Ana Example' }),
    'files[]': `file:${KHMER}.png`,
  });
  await expect(toasts(page).filter({ hasText: 'Document uploaded sucessfully' })).toHaveCount(1);
  await expect(dialog).toBeHidden();

  const added = (await listDocuments(api)).filter((d) => !known.has(d.documentid));
  expect(added).toHaveLength(1);
  expect(added[0].documenttitle).toBe(KHMER);
  expect(added[0].documentname).toMatch(/^[0-9a-f-]{36}\.png$/);
  expect(added[0].documentlicence).toBe('CC-BY-4.0');
  expect(added[0].documentattribution).toEqual({ v: 1, author: 'Ana Example' });

  // The question-file picker finds it by the title, labels it with the title, and its value is still the file name.
  const picker = page.locator('nz-select[formcontrolname="questionfile"]');
  await picker.click();
  await page.keyboard.type(KHMER);
  const option = page.locator('.ant-select-item-option').filter({ hasText: KHMER }).first();
  await expect(option).toBeVisible({ timeout: 15_000 });
  await expect(option).not.toContainText(added[0].documentname);
  await option.click();
  await expect(picker.locator('.ant-select-selection-item')).toHaveText(KHMER);
  const value = await page.evaluate(() => {
    // dev build: Angular's debug API
    const ng = (window as unknown as { ng: { getComponent: (e: Element) => { questionForm: { get: (n: string) => { value: string } } } } }).ng;
    return ng.getComponent(document.querySelector('app-question-create')!).questionForm.get('questionfile').value;
  });
  expect(value, 'the picker value is the file name, never the title').toBe(added[0].documentname);
});

test('the learning picker offers videos only, labels a video by its title, and a refusal says why', async () => {
  const upload = async (name: string, buffer: Buffer, title: string) => {
    const res = await api.post('/document/upload', {
      multipart: { documenttitle: title, file: { name, mimeType: 'application/octet-stream', buffer } },
    });
    expect(res.ok(), `setup upload of ${name}: HTTP ${res.status()}`).toBeTruthy();
  };
  await deleteTestLearnings(api);
  const known = new Set((await listDocuments(api)).map((d) => d.documentid));
  await upload('clip.mp4', MP4, 'Clip for the picker');
  await upload('stray.png', PNG, 'Picture for the picker');
  const added = (await listDocuments(api)).filter((d) => !known.has(d.documentid));
  const picture = added.find((d) => d.documenttypeid === 6)!;

  // This picker searches by tag, and central's tag filter finds nothing today (its query for a JSON column reads
  // LIKE '"%text%"'; found while building this, reported separately). So the search is sent as a name search here,
  // with every other filter of the page's own request left as it is: what is under test is the type filter.
  await page.goto(`/lesson/learning/${DEMO_LESSON}`);
  const sentByThePage: Array<Array<{ key: string; value: string }>> = [];
  await page.route(/\/document$/, async (route) => {
    const body = route.request().postDataJSON();
    sentByThePage.push(body.filter);
    const filter = body.filter.map((f: { key: string; value: string }) => (f.key === 'documenttags' ? { ...f, key: 'documentname' } : f));
    await route.continue({ postData: JSON.stringify({ ...body, filter }) });
  });
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  const dialog = modal(page, 'Add Learning');
  const select = dialog.locator('nz-select').first();
  await select.click();
  const asked = page.waitForRequest((r) => r.method() === 'POST' && /\/document$/.test(r.url()));
  await page.keyboard.type('picker');
  await asked;
  expect(sentByThePage.length).toBeGreaterThan(0);
  for (const filter of sentByThePage) expect(filter).toContainEqual({ key: 'documenttypeid', value: '2' });
  await expect(page.locator('.ant-select-item-option').filter({ hasText: 'Clip for the picker' })).toBeVisible({ timeout: 15_000 });
  const offered = await page.locator('.ant-select-item-option').allTextContents();
  expect(offered.some((t) => t.includes('Picture for the picker')), `a picture is offered: ${offered.join(' | ')}`).toBeFalsy();

  await page.locator('.ant-select-item-option').filter({ hasText: 'Clip for the picker' }).click();
  await dialog.locator('[formcontrolname="lessonlearningname"]').fill('A clip');
  await dialog.locator('[formcontrolname="lessonlearningdescription"]').fill('Made by a test');
  await dialog.locator('[formcontrolname="lessonlearningorder"]').fill('9');
  await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(toasts(page).filter({ hasText: 'Learning added sucessfully' })).toHaveCount(1);
  // the learning list labels the video by its title
  const row = page.locator('tbody tr').filter({ hasText: 'A clip' });
  await expect(row.getByRole('button', { name: 'Clip for the picker', exact: true })).toBeVisible();

  // A stale list that still offers a picture: the server refuses and the page says why (once).
  await page.unroute(/\/document$/);
  await page.route(/\/document$/, async (route) => {
    const real = await route.fetch();
    const json = await real.json();
    json.data.data = [picture];
    await route.fulfill({ response: real, json });
  });
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await select.click();
  await page.keyboard.type('picker');
  await page.locator('.ant-select-item-option').filter({ hasText: 'Picture for the picker' }).click();
  await dialog.locator('[formcontrolname="lessonlearningname"]').fill('A picture');
  await dialog.locator('[formcontrolname="lessonlearningdescription"]').fill('Should be refused');
  await dialog.locator('[formcontrolname="lessonlearningorder"]').fill('10');
  await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(toasts(page).filter({ hasText: 'needs a video file' })).toHaveCount(1);
  await expect(toasts(page)).toHaveCount(1);
  await page.unroute(/\/document$/);

  await deleteTestLearnings(api);
});

test('the platform view (no organisation chosen): Upload is switched off, with the reason, before a file is chosen', async ({ browser }) => {
  // a platform account is not in any organisation; it acts in one only after choosing it in the switcher
  const platform = await browser.newPage();
  try {
    await loginViaUi(platform);
    for (const [url, area] of [['/document/index', '.upload-action'], ['/question/create', 'app-uploader .upload-action']] as const) {
      await platform.goto(url);
      const action = platform.locator(area).first();
      await expect(action.locator('button')).toBeDisabled();
      await action.hover();
      await expect(platform.locator('.ant-tooltip-inner')).toHaveText(
        'Choose an organisation to act in before you create content. Use the organisation switcher, then try again.',
      );
    }
  } finally {
    await platform.close();
  }
});

test('one failure is one notice: a server error or a lost connection is named once, in the dialog and in a single notice', async () => {
  const start = (await listDocuments(api)).length;
  const cases: Array<{ name: string; fragment: string; handle: Parameters<Page['route']>[1] }> = [
    {
      name: 'server-error.png',
      fragment: 'The upload broke',
      handle: (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: true, errormessage: 'The upload broke.' }) }),
    },
    { name: 'no-network.png', fragment: 'That did not go through', handle: (route) => route.abort('connectionreset') },
  ];
  for (const c of cases) {
    await page.goto('/document/index');
    await uploadButton(page).click();
    const dialog = modal(page, 'Upload Document');
    await chooseFile(page, dialog, c.name, PNG, 'image/png');
    await page.route(/\/document\/upload$/, c.handle);
    await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(dialog.locator('.upload-file-error')).toHaveText(refusalLine(c.name, c.fragment));
    // exactly one notice: the interceptor's own is switched off for an upload
    await expect(toasts(page)).toHaveCount(1);
    await expect(toasts(page).first()).toContainText(`${c.name}: `);
    await page.unroute(/\/document\/upload$/);
  }
  expect((await listDocuments(api)).length, 'nothing was stored').toBe(start);
});

test('the lesson plan list and picker show a document by its title, else its key', async () => {
  const PLAN_LESSON = DEMO_LESSON;
  const planRow = (title: string | null) => ({
    lessonplanid: 'c0000000-0000-4000-8000-0000000000aa',
    lessonplanname: 'Plan for the check',
    lessonplandescription: 'Injected by a test',
    lessonid: PLAN_LESSON,
    documentid: 'c0000000-0000-4000-8000-0000000000bb',
    lessonplanstatus: true,
    lessonplanorder: 1,
    lessonname: 'Reading simple words',
    lessondescription: 'x',
    documentname: '0b1c2d3e-0000-4000-8000-000000000000.pdf',
    documenttypeid: 5,
    ...(title === null ? {} : { documenttitle: title }),
  });
  // central's plan read carries no documenttitle today: the list shows the key (the pipe falls back to it) ...
  const showPlans = async (row: ReturnType<typeof planRow>) => {
    await page.unroute(/\/lesson\/plan\/[^/]+$/).catch(() => undefined);
    await page.route(/\/lesson\/plan\/[^/]+$/, async (route) => {
      const real = await route.fetch();
      const json = await real.json();
      json.data = [row];
      await route.fulfill({ response: real, json });
    });
    await page.goto(`/lesson/teacher-plan/${PLAN_LESSON}`);
  };
  await showPlans(planRow(null));
  const cell = page.locator('tbody tr').filter({ hasText: 'Plan for the check' });
  await expect(cell.getByText('0b1c2d3e-0000-4000-8000-000000000000.pdf', { exact: true })).toBeVisible();
  // ... and a title shows as soon as the field is in the response
  await showPlans(planRow('Plan sheet'));
  await expect(page.locator('tbody tr').filter({ hasText: 'Plan for the check' }).getByText('Plan sheet', { exact: true })).toBeVisible();
  await expect(page.getByText('0b1c2d3e-0000-4000-8000-000000000000.pdf')).toHaveCount(0);
  await page.unroute(/\/lesson\/plan\/[^/]+$/);

  // the picker: its options carry the title (the tag search finds nothing on central today, so it is sent as a name search)
  const known = new Set((await listDocuments(api)).map((d) => d.documentid));
  const up = await api.post('/document/upload', { multipart: { documenttitle: 'Plan picture for the check', file: { name: 'plan.png', mimeType: 'image/png', buffer: PNG } } });
  expect(up.ok()).toBeTruthy();
  const mine = (await listDocuments(api)).find((d) => !known.has(d.documentid))!;
  await page.route(/\/document$/, async (route) => {
    const body = route.request().postDataJSON();
    const filter = body.filter.map((f: { key: string; value: string }) => (f.key === 'documenttags' ? { ...f, key: 'documentname' } : f));
    await route.continue({ postData: JSON.stringify({ ...body, filter }) });
  });
  await page.goto(`/lesson/teacher-plan/${PLAN_LESSON}`);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  const dialog = modal(page, 'Add Plan');
  await dialog.locator('nz-select').first().click();
  await page.keyboard.type('Plan picture');
  const option = page.locator('.ant-select-item-option').filter({ hasText: 'Plan picture for the check' });
  await expect(option).toBeVisible({ timeout: 15_000 });
  await expect(option).not.toContainText(mine.documentname);
  // the chosen document shows by its title in the select, too
  await option.click();
  await expect(dialog.locator('nz-select').first().locator('.ant-select-selection-item')).toHaveText('Plan picture for the check');
  await page.unroute(/\/document$/);
});
