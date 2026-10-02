import { APIRequestContext, Locator, Page, Route, expect, test } from '@playwright/test';
import { ROLE } from '../fixtures/accounts';
import { apiContext, apiLogin, loginViaUi } from '../fixtures/auth';

/**
 * Platform Organisations: list, and the New / Edit drawer. Real API.
 *
 * Every organisation these tests create is named with RUN and given a code that
 * starts with "e2e" + a random suffix (RUN), so nothing can collide across runs
 * (a code is never reusable, even after a delete), and is deleted through the API
 * in teardown. Deletes are soft: each run leaves its rows, invisible to the API,
 * in the organisations table:
 *   SELECT organisationcode FROM organisations WHERE organisationcode LIKE 'e2e%';
 *
 * The no-permission describe uses one fixed account, e2e-org-teacher@example.com:
 * created if missing, never disabled. That is accepted: the API can disable a user
 * but cannot list or re-enable one, so disabling it in teardown would make the next
 * run fail, and an account per run only piles up. It holds no organisation permission.
 */

const RUN = `e2e${Math.random().toString(36).slice(2, 8)}`;
let counter = 0;
const KHMER_NAME = 'ក្រុមហ៊ុនគំរូ';
const KHMER_SHORT = 'កគ';

/** A fresh name, code and short name for one organisation. */
function sample(): { name: string; code: string; short: string } {
  counter += 1;
  return { name: `${KHMER_NAME} ${RUN}-${counter}`, code: `${RUN}${counter}`, short: KHMER_SHORT };
}

const created: string[] = [];
let api: APIRequestContext;
let page: Page;

async function tokenOf(p: Page): Promise<string> {
  return p.evaluate(() => {
    const g = (k: string) => sessionStorage.getItem(k);
    return `${g('lms_access_alg')}.${g('lms_access_payload')}.${g('lms_access_hash')}`;
  });
}

/** Everything this run made that is still live, from the API as the signed-in superadmin. */
async function liveRows(): Promise<Array<{ organisationid: string; organisationname: string; organisationcode: string }>> {
  const res = await api.get(`/organisation?pagesize=200&organisationname=${encodeURIComponent(RUN)}`);
  return (await res.json()).data.data;
}

async function countryId(): Promise<string> {
  const list = (await (await api.get('/country/all?country=')).json()).data;
  return list[0].countryid;
}

/** An organisation made straight through the API (to have something to edit, or to collide with). */
async function makeViaApi(s = sample(), extra: Record<string, unknown> = {}): Promise<{ id: string } & ReturnType<typeof sample>> {
  const res = await api.post('/organisation', {
    data: {
      organisationname: s.name,
      organisationcode: s.code,
      organisationshortname: s.short,
      organisationpreset: 'company',
      countryids: [await countryId()],
      ...extra,
    },
  });
  expect(res.ok(), `could not create ${s.code}: ${res.status()}`).toBeTruthy();
  const id = (await res.json()).data.organisationid;
  created.push(id);
  return { id, ...s };
}

const newButton = () => page.getByRole('button', { name: '+ New organisation' }).first();
const drawer = () => page.getByRole('dialog', { name: /organisation/i });
// A required field's label ends in a * (hidden from assistive technology, but in the label's text).
const field = (label: string) => drawer().getByLabel(new RegExp(`^${label}\\s*\\*?\\s*$`));
const toasts = () => page.locator('.ant-notification-notice');
const rowOf = (name: string): Locator => page.getByRole('row').filter({ hasText: name });

/** Choose a country in the drawer's multi-select. */
async function chooseCountry(name = 'Cambodia'): Promise<void> {
  await field('Countries').click();
  await page.locator('.ant-select-item-option', { hasText: name }).click();
  // Close the dropdown without leaving the drawer.
  await field('Countries').press('Escape');
}

async function openNew(): Promise<void> {
  await newButton().click();
  await expect(drawer()).toBeVisible();
}

async function fillValid(s: { name: string; code: string; short: string }): Promise<void> {
  await field('Name').fill(s.name);
  await field('Short name').fill(s.short);
  await field('Code').fill(s.code);
  await chooseCountry();
}

async function submit(): Promise<void> {
  await drawer().getByRole('button', { name: /Create organisation|Save changes/ }).click();
}

/** Look once, after a pause, for a toast: a retrying assertion would pass once it faded. */
async function expectNoToast(): Promise<void> {
  await page.waitForTimeout(750);
  expect(await toasts().count(), 'no toast').toBe(0);
}

test.describe('organisations, signed in as the platform superadmin', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUi(page);
    api = await apiContext(await tokenOf(page));
  });

  test.beforeEach(async () => {
    await page.goto('/organisation');
    await expect(page.getByRole('heading', { level: 1, name: 'Organisations' })).toBeVisible();
  });

  test.afterAll(async () => {
    let deleted = 0;
    const all = new Set(created);
    for (const row of await liveRows()) all.add(row.organisationid);
    for (const id of all) {
      const res = await api.delete(`/organisation/${id}`);
      // A 404 means a test already deleted it.
      if (res.ok()) deleted++;
      else if (res.status() !== 404) throw new Error(`failed to delete organisation ${id}: HTTP ${res.status()}`);
    }
    const left = await liveRows();
    // Said out loud so the rows these runs leave behind (soft-deleted, so only in the table) can be counted.
    console.log(`[e2e] organisations: run ${RUN} created ${all.size} rows (codes ${RUN}*), deleted ${deleted} here and the rest in their tests, ${left.length} still live`);
    expect(left, 'nothing this run made is still live').toEqual([]);
    await api.dispose();
    await page.close();
  });

  test('the list is a table with the columns the API can fill, and none it cannot', async () => {
    // (There is a table once there is a row.)
    await makeViaApi();
    await page.reload();
    const headers = page.getByRole('columnheader');
    await expect(headers.filter({ hasText: /^Organisation$/ })).toHaveCount(1);
    for (const name of ['Started from', 'Countries', 'Status']) {
      await expect(headers.filter({ hasText: new RegExp(`^${name}$`) })).toHaveCount(1);
    }
    // Not returned by the API yet: left out, not invented.
    for (const name of ['Schools', 'Learners', 'Staff', 'Last active']) {
      await expect(headers.filter({ hasText: name })).toHaveCount(0);
    }
    // Sorted by name by the API: no sort control to pretend otherwise.
    await expect(page.locator('th.ant-table-column-has-sorters')).toHaveCount(0);
  });

  test('create with a Khmer name and Khmer short name, and see it in the list', async () => {
    const s = sample();
    await openNew();
    // Focus lands in the first field.
    await expect(field('Name')).toBeFocused();
    await field('Name').fill(s.name);
    await field('Short name').fill(s.short);
    // The live preview shows the initials; the colour and starting point are chosen.
    await expect(drawer().getByRole('img', { name: 'Tile preview' })).toHaveText(s.short);
    await drawer().getByRole('radio', { name: 'Violet' }).check();
    await drawer().getByRole('radio', { name: /School network/ }).check();
    await field('Code').fill(s.code);
    await chooseCountry();
    await submit();

    await expect(drawer()).toBeHidden();
    await expect(toasts()).toContainText('Organisation created');
    const row = rowOf(s.name);
    await expect(row).toBeVisible();
    await expect(row).toContainText(s.short);
    await expect(row).toContainText('School network');
    await expect(row).toContainText('Cambodia');
    await expect(row).toContainText('Active');
    await expect(row).toContainText(s.code);
    // Focus is back on the control that opened the drawer.
    await expect(newButton()).toBeFocused();

    // What the API holds: the preset, the colour in brandingconfig, the Khmer text intact.
    const stored = (await liveRows()).find((r) => r.organisationcode === s.code) as any;
    expect(stored.organisationname).toBe(s.name);
    const full = (await (await api.get(`/organisation/${stored.organisationid}`)).json()).data;
    expect(full.organisationshortname).toBe(s.short);
    expect(full.organisationpreset).toBe('schoolnetwork');
    expect(full.brandingconfig).toEqual({ tilecolour: '#6D5BD0' });
  });

  test('edit: the code and the starting point are shown but cannot change; a rename saves', async () => {
    const o = await makeViaApi();
    await page.reload();
    await rowOf(o.name).getByRole('button', { name: `Edit ${o.name}` }).click();
    await expect(drawer()).toBeVisible();
    await expect(drawer().getByRole('heading', { name: 'Edit organisation' })).toBeVisible();
    await expect(field('Name')).toHaveValue(o.name);
    await expect(field('Name')).toBeFocused();
    // The code: read-only, with the reason.
    await expect(field('Code')).toHaveValue(o.code);
    await expect(field('Code')).toHaveAttribute('readonly', '');
    await expect(drawer().getByText("The code can't be changed.")).toBeVisible();
    // The starting point: shown, locked.
    await expect(drawer().getByRole('radio', { name: /Company/ })).toBeChecked();
    await expect(drawer().getByRole('radio', { name: /School network/ })).toBeDisabled();

    const renamed = `${o.name} renamed`;
    await field('Name').fill(renamed);
    await submit();
    await expect(drawer()).toBeHidden();
    await expect(toasts()).toContainText('Organisation saved');
    await expect(rowOf(renamed)).toBeVisible();
    await expect(rowOf(renamed).getByRole('button', { name: `Edit ${renamed}` })).toBeFocused();
  });

  test('suspend asks first and says what it does; reactivate is one click', async () => {
    const o = await makeViaApi();
    await page.reload();
    const row = rowOf(o.name);
    await expect(row).toContainText('Active');
    const puts: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'PUT' && r.url().includes('/organisation/')) puts.push(r.url());
    });

    await row.getByRole('button', { name: `More actions for ${o.name}` }).click();
    await page.getByRole('menuitem', { name: 'Suspend' }).click();
    const confirm = page.getByRole('alertdialog', { name: `Suspend “${o.name}”?` });
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText('Its staff will be signed out and cannot sign in until it is reactivated.');
    // Cancel sends nothing.
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(confirm).toBeHidden();
    await page.waitForTimeout(500);
    expect(puts, 'Cancel sent nothing').toEqual([]);
    await expect(row).toContainText('Active');

    await row.getByRole('button', { name: `More actions for ${o.name}` }).click();
    await page.getByRole('menuitem', { name: 'Suspend' }).click();
    await page.getByRole('alertdialog', { name: `Suspend “${o.name}”?` }).getByRole('button', { name: 'Suspend organisation' }).click();
    await expect(toasts()).toContainText('Organisation suspended');
    await expect(row).toContainText('Suspended');
    expect(puts.length, 'confirming sent the change').toBe(1);
    expect((await (await api.get(`/organisation/${o.id}`)).json()).data.organisationstatus).toBe(false);

    // Reactivating asks nothing.
    await row.getByRole('button', { name: `More actions for ${o.name}` }).click();
    await page.getByRole('menuitem', { name: 'Reactivate' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(row).toContainText('Active');
    expect((await (await api.get(`/organisation/${o.id}`)).json()).data.organisationstatus).toBe(true);
    page.removeAllListeners('request');
  });

  test('delete names the organisation, then removes it', async () => {
    const o = await makeViaApi();
    await page.reload();
    const row = rowOf(o.name);
    await row.getByRole('button', { name: `More actions for ${o.name}` }).click();
    await page.getByRole('menuitem', { name: /Delete/ }).click();

    const confirm = page.getByRole('alertdialog', { name: `Delete “${o.name}”?` });
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText(o.code);
    // Cancel keeps it.
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: `More actions for ${o.name}` }).click();
    await page.getByRole('menuitem', { name: /Delete/ }).click();
    await page.getByRole('alertdialog', { name: `Delete “${o.name}”?` }).getByRole('button', { name: 'Delete organisation' }).click();
    await expect(toasts()).toContainText('Organisation deleted');
    await expect(row).toHaveCount(0);
    expect((await api.get(`/organisation/${o.id}`)).status()).toBe(404);
  });

  test('a duplicate name is shown on the Name field, not in a toast', async () => {
    const existing = await makeViaApi();
    const s = sample();
    await openNew();
    await fillValid({ ...s, name: existing.name });
    await submit();

    const error = drawer().getByRole('alert').filter({ hasText: 'name is already in use' });
    await expect(error).toBeVisible();
    await expect(field('Name')).toHaveAttribute('aria-invalid', 'true');
    const described = await field('Name').getAttribute('aria-describedby');
    expect(described, 'the Name field points at its message').toBeTruthy();
    await expect(page.locator(`#${described}`)).toContainText('name is already in use');
    await expect(field('Name')).toBeFocused();
    await expectNoToast();
    // The drawer stays, with what was typed, and the code field is fine.
    await expect(field('Code')).toHaveValue(s.code);
    await expect(drawer().getByRole('alert').filter({ hasText: 'code' })).toHaveCount(0);
  });

  test('a duplicate code is shown on the Code field, not in a toast', async () => {
    const existing = await makeViaApi();
    const s = sample();
    await openNew();
    await fillValid({ ...s, code: existing.code });
    await submit();

    await expect(drawer().getByRole('alert').filter({ hasText: 'code is already in use' })).toBeVisible();
    await expect(field('Code')).toHaveAttribute('aria-invalid', 'true');
    await expect(field('Code')).toBeFocused();
    await expect(field('Name')).not.toHaveAttribute('aria-invalid', 'true');
    await expectNoToast();
  });

  test('a short name of four visible letters is refused in the form, and nothing is sent', async () => {
    const posts: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/organisation')) posts.push(r.url());
    });
    const s = sample();
    await openNew();
    await fillValid({ ...s, short: 'កខគឃ' });
    await submit();
    await expect(drawer().getByRole('alert').filter({ hasText: '3 letters or fewer' })).toBeVisible();
    await expect(field('Short name')).toHaveAttribute('aria-invalid', 'true');
    await expect(field('Short name')).toBeFocused();
    await page.waitForTimeout(500);
    expect(posts, 'nothing was sent').toEqual([]);
    page.removeAllListeners('request');
  });

  test('a short name is counted in visible letters, not characters: three Khmer clusters pass', async () => {
    const s = sample();
    await openNew();
    // Three clusters, nine code points.
    await field('Short name').fill('ក្សក្សក្ស');
    await field('Short name').blur();
    await expect(drawer().getByRole('alert').filter({ hasText: 'letters' })).toHaveCount(0);
    await expect(field('Short name')).not.toHaveAttribute('aria-invalid', 'true');
    // And a Latin one of three, but not four.
    await field('Short name').fill('ABCD');
    await field('Short name').blur();
    await expect(drawer().getByRole('alert').filter({ hasText: '3 letters or fewer' })).toBeVisible();
    await field('Short name').fill('ABC');
    await expect(drawer().getByRole('alert').filter({ hasText: 'letters' })).toHaveCount(0);
    void s;
  });

  test('an empty form says what is missing, beside each field', async () => {
    await openNew();
    await submit();
    for (const message of ['Enter a name.', 'Enter a short name.', 'Enter a code.', 'Choose at least one country.']) {
      await expect(drawer().getByRole('alert').filter({ hasText: message })).toBeVisible();
    }
    await expect(field('Name')).toBeFocused();
    await expectNoToast();
  });

  test('a server 400 that names a field is shown on that field, not in a toast', async () => {
    await page.route('**/organisation', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'INVALID_INPUT',
          errormessage: "Some of the information isn't valid.",
          fields: [{ field: 'organisationcode', message: 'Organisationcode isn\'t in a valid format.' }],
        }),
      });
    });
    const s = sample();
    await openNew();
    await fillValid(s);
    await submit();
    await expect(drawer().getByRole('alert').filter({ hasText: 'lowercase letters and digits' })).toBeVisible();
    await expect(field('Code')).toHaveAttribute('aria-invalid', 'true');
    await expectNoToast();
    await page.unroute('**/organisation');
  });

  test('two submits at once send one request', async () => {
    const posts: string[] = [];
    await page.route('**/organisation', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      posts.push(route.request().url());
      await new Promise((r) => setTimeout(r, 800));
      return route.abort('connectionrefused');
    });
    const s = sample();
    await openNew();
    await fillValid(s);
    // Two submit events in one task: the disabled button cannot stop these, the handler's guard must.
    await drawer().locator('form').evaluate((form: HTMLFormElement) => {
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      form.dispatchEvent(new Event('submit', { cancelable: true }));
    });
    await expect(drawer().getByRole('button', { name: 'Saving…' })).toBeDisabled();
    await page.waitForTimeout(1200);
    expect(posts.length, 'one request').toBe(1);
    // The failure leaves the form usable.
    await expect(drawer().getByRole('button', { name: 'Create organisation' })).toBeEnabled();
    await page.unroute('**/organisation');
  });

  test('Escape closes an untouched drawer and returns focus to the button', async () => {
    await openNew();
    await page.keyboard.press('Escape');
    await expect(drawer()).toBeHidden();
    await expect(newButton()).toBeFocused();
  });

  test('closing with unsaved changes asks first; keep editing, then discard', async () => {
    await openNew();
    await field('Name').fill('Half typed');
    await page.keyboard.press('Escape');
    const confirm = page.getByRole('alertdialog', { name: 'Discard your changes?' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Keep editing' }).click();
    await expect(drawer()).toBeVisible();
    await expect(field('Name')).toHaveValue('Half typed');

    await drawer().getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('alertdialog', { name: 'Discard your changes?' }).getByRole('button', { name: 'Discard changes' }).click();
    await expect(drawer()).toBeHidden();
    await expect(newButton()).toBeFocused();
    // Nothing was created.
    expect((await liveRows()).filter((r) => r.organisationname.includes('Half typed'))).toEqual([]);
  });

  test('the drawer is a labelled dialog whose controls have labels', async () => {
    await openNew();
    await expect(page.getByRole('dialog', { name: 'New organisation' })).toBeVisible();
    for (const label of ['Name', 'Short name', 'Code', 'Countries']) {
      await expect(field(label)).toBeVisible();
    }
    await expect(drawer().getByRole('radiogroup', { name: 'Tile colour' })).toBeVisible();
    await expect(drawer().getByRole('radio', { name: /Company/ })).toBeChecked();
    await expect(drawer().getByRole('radio')).toHaveCount(7);
    // Each swatch has a name.
    for (const name of ['Teal', 'Blue', 'Violet', 'Green', 'Ink']) {
      await expect(drawer().getByRole('radio', { name })).toBeVisible();
    }
    // The first administrator is not asked for: the API cannot create one yet.
    await expect(drawer().getByText('First administrator')).toHaveCount(0);
    await page.keyboard.press('Escape');
  });

  // ---- Saves that fail: every status says something, once ------------------------
  const SAVE_FAILED = "The organisation couldn't be saved. Try again.";
  const json = (status: number, body: unknown = {}) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
  /** Answer the create request (POST /organisation) with `handler`; everything else goes through. */
  async function mockCreate(handler: (route: Route) => Promise<void> | void): Promise<void> {
    await page.route('**/organisation', (route) =>
      route.request().method() === 'POST' ? handler(route) : route.fallback(),
    );
  }
  const submitButton = () => drawer().getByRole('button', { name: /Create organisation|Save changes/ });

  for (const status of [401, 502, 503]) {
    test(`a create answered with HTTP ${status} says it could not be saved, once, in the form`, async () => {
      await mockCreate((route) => route.fulfill(json(status)));
      await openNew();
      await fillValid(sample());
      await submit();
      await expect(drawer().getByRole('alert')).toHaveText(SAVE_FAILED);
      await expectNoToast();
      await expect(drawer()).toBeVisible();
      // Focus is back on the button, not lost to the page.
      await expect(submitButton()).toBeFocused();
      await expect(submitButton()).toBeEnabled();
      await page.unroute('**/organisation');
    });
  }

  test('a create answered with HTTP 500 is left to the interceptor: one toast, nothing in the form', async () => {
    await mockCreate((route) => route.fulfill(json(500, { errormessage: 'Mocked.' })));
    await openNew();
    await fillValid(sample());
    await submit();
    await expect(toasts()).toHaveCount(1);
    await page.waitForTimeout(750);
    expect(await toasts().count(), 'one message, not two').toBe(1);
    await expect(drawer().getByRole('alert')).toHaveCount(0);
    await expect(submitButton()).toBeFocused();
    await page.unroute('**/organisation');
  });

  test('a create that gets no answer is left to the interceptor: one toast, nothing in the form', async () => {
    await mockCreate((route) => route.abort('connectionrefused'));
    await openNew();
    await fillValid(sample());
    await submit();
    await expect(toasts()).toHaveCount(1);
    await page.waitForTimeout(750);
    expect(await toasts().count(), 'one message, not two').toBe(1);
    await expect(drawer().getByRole('alert')).toHaveCount(0);
    await expect(submitButton()).toBeFocused();
    await page.unroute('**/organisation');
  });

  // ---- A 409 is read by the API's own sentences -------------------------------------
  const NAME_409 = 'That organisation name is already in use.';
  const CODE_409 = 'That organisation code is already in use.';
  const COUNTRY_409 = 'A school of this organisation is in a country you are removing.';

  test('a 409 for the name sentence is on Name, for the code sentence on Code, for both on both', async () => {
    await mockCreate((route) => route.fulfill(json(409, { code: 'ALREADY_EXISTS', errormessage: NAME_409 })));
    await openNew();
    await fillValid(sample());
    await submit();
    await expect(field('Name')).toHaveAttribute('aria-invalid', 'true');
    await expect(field('Code')).not.toHaveAttribute('aria-invalid', 'true');
    await page.unroute('**/organisation');

    await mockCreate((route) => route.fulfill(json(409, { code: 'ALREADY_EXISTS', errormessage: CODE_409 })));
    await field('Code').fill(`${RUN}x1`);
    await submit();
    await expect(field('Code')).toHaveAttribute('aria-invalid', 'true');
    await expect(field('Name')).not.toHaveAttribute('aria-invalid', 'true');
    await page.unroute('**/organisation');

    await mockCreate((route) => route.fulfill(json(409, { errormessage: `${NAME_409}, ${CODE_409}` })));
    await field('Code').fill(`${RUN}x2`);
    await submit();
    await expect(field('Name')).toHaveAttribute('aria-invalid', 'true');
    await expect(field('Code')).toHaveAttribute('aria-invalid', 'true');
    await expectNoToast();
    await page.unroute('**/organisation');
  });

  test('a 409 about anything else shows the API\'s message for the form, and an empty one the generic line', async () => {
    // Words that a substring match would have taken for the code or the name.
    const other = "Another organisation's code or name is involved.";
    await mockCreate((route) => route.fulfill(json(409, { errormessage: other })));
    await openNew();
    await fillValid(sample());
    await submit();
    await expect(drawer().getByRole('alert')).toHaveText(other);
    await expect(field('Name')).not.toHaveAttribute('aria-invalid', 'true');
    await expect(field('Code')).not.toHaveAttribute('aria-invalid', 'true');
    await expect(submitButton()).toBeFocused();
    await page.unroute('**/organisation');

    await mockCreate((route) => route.fulfill({ status: 409, contentType: 'application/json', body: '' }));
    await submit();
    await expect(drawer().getByRole('alert')).toHaveText(SAVE_FAILED);
    await expectNoToast();
    await page.unroute('**/organisation');
  });

  test('removing a country that has a school is shown on Countries, from the API\'s own sentence', async () => {
    const o = await makeViaApi();
    await page.reload();
    await rowOf(o.name).getByRole('button', { name: `Edit ${o.name}` }).click();
    await expect(drawer()).toBeVisible();
    await page.route(`**/organisation/${o.id}`, (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill(json(409, { code: 'ALREADY_EXISTS', errormessage: COUNTRY_409, hint: 'Move or remove them first, then try again.' }))
        : route.fallback(),
    );
    await submit();
    // It is the Countries field's own message (its id, and the select points at it), not a form-level one.
    await expect(drawer().locator('#org-countries-error')).toHaveText(COUNTRY_409);
    await expect(drawer().locator('#org-countries')).toHaveAttribute('aria-describedby', /org-countries-error/);
    await expect(drawer().getByRole('alert')).toHaveCount(1);
    await expect(field('Name')).not.toHaveAttribute('aria-invalid', 'true');
    await expectNoToast();
    await page.unroute(`**/organisation/${o.id}`);
  });

  // ---- The look is set at creation only ------------------------------------------------
  const fakeSaved = (body: Record<string, unknown>) => ({
    error: false,
    data: { organisationid: '00000000-0000-4000-8000-0000000000aa', ...body, organisationstatus: true, countries: [] },
  });

  for (const [label, theme] of [
    ['Company', 'corporate'],
    ['School network', 'kids'],
  ] as const) {
    test(`creating from ${label} sends uitheme "${theme}"`, async () => {
      let sent: any;
      await mockCreate((route) => {
        sent = route.request().postDataJSON();
        return route.fulfill(json(200, fakeSaved(sent)));
      });
      await openNew();
      await fillValid(sample());
      await drawer().getByRole('radio', { name: new RegExp(label) }).check();
      await submit();
      await expect(drawer()).toBeHidden();
      expect(sent.uitheme).toBe(theme);
      await page.unroute('**/organisation');
    });
  }

  test('editing never sends uitheme', async () => {
    const o = await makeViaApi();
    await page.reload();
    await rowOf(o.name).getByRole('button', { name: `Edit ${o.name}` }).click();
    let sent: any;
    await page.route(`**/organisation/${o.id}`, (route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      sent = route.request().postDataJSON();
      return route.fulfill(json(200, fakeSaved(sent)));
    });
    await field('Name').fill(`${o.name} again`);
    await submit();
    await expect(drawer()).toBeHidden();
    expect(sent, 'a change was sent').toBeTruthy();
    expect(Object.keys(sent)).not.toContain('uitheme');
    await page.unroute(`**/organisation/${o.id}`);
  });

  // ---- A refused row action says why --------------------------------------------------
  test('a delete refused with a 409 shows the API\'s message and hint; other failures the generic line', async () => {
    const o = await makeViaApi();
    await page.reload();
    const row = rowOf(o.name);
    const answer = { status: 409, body: { code: 'ALREADY_EXISTS', errormessage: 'This organisation still has staff users.', hint: 'Move or remove them first, then try again.' } };
    await page.route(`**/organisation/${o.id}`, (route) =>
      route.request().method() === 'DELETE' ? route.fulfill(json(answer.status, answer.body)) : route.fallback(),
    );
    await row.getByRole('button', { name: `More actions for ${o.name}` }).click();
    await page.getByRole('menuitem', { name: /Delete/ }).click();
    await page.getByRole('alertdialog', { name: `Delete “${o.name}”?` }).getByRole('button', { name: 'Delete organisation' }).click();
    await expect(toasts()).toContainText('This organisation still has staff users.');
    await expect(toasts()).toContainText('Move or remove them first, then try again.');
    await expect(toasts()).not.toContainText('Try again in a moment.');
    await expect(row).toBeVisible();
    await page.unroute(`**/organisation/${o.id}`);

    // Any other failure: the generic line.
    await page.locator('.ant-notification-notice-close').first().click();
    await page.route(`**/organisation/${o.id}`, (route) =>
      route.request().method() === 'DELETE' ? route.fulfill(json(502)) : route.fallback(),
    );
    await row.getByRole('button', { name: `More actions for ${o.name}` }).click();
    await page.getByRole('menuitem', { name: /Delete/ }).click();
    await page.getByRole('alertdialog', { name: `Delete “${o.name}”?` }).getByRole('button', { name: 'Delete organisation' }).click();
    await expect(toasts().filter({ hasText: 'Try again in a moment.' })).toHaveCount(1);
    await page.unroute(`**/organisation/${o.id}`);
  });

  test('a suspend refused with a 409 shows the API\'s message', async () => {
    const o = await makeViaApi();
    await page.reload();
    await page.route(`**/organisation/${o.id}`, (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill(json(409, { errormessage: 'Something is in the way.', hint: 'Sort it out first.' }))
        : route.fallback(),
    );
    await rowOf(o.name).getByRole('button', { name: `More actions for ${o.name}` }).click();
    await page.getByRole('menuitem', { name: 'Suspend' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Suspend organisation' }).click();
    await expect(toasts()).toContainText('Something is in the way. Sort it out first.');
    await page.unroute(`**/organisation/${o.id}`);
  });

  // ---- The drawer cannot be closed while a save is on its way ----------------------------
  test('the drawer does not close while a save is in flight', async () => {
    await mockCreate(async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.abort('connectionrefused');
    });
    await openNew();
    await field('Name').fill('A name');
    await fillValid(sample());
    await submit();
    await expect(drawer().getByRole('button', { name: 'Saving…' })).toBeDisabled();
    // Escape, the close button and Cancel are all ignored, and nothing is asked.
    await page.keyboard.press('Escape');
    await drawer().getByRole('button', { name: 'Close' }).click();
    await drawer().getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(drawer()).toBeVisible();
    // The save fails; the form is still there with what was typed.
    await expect(toasts()).toHaveCount(1);
    await expect(field('Name')).toHaveValue(/./);
    await page.unroute('**/organisation');
  });

  // ---- Short name: three letters built from too many characters ---------------------------
  test('a short name of few letters but many characters has its own message', async () => {
    await openNew();
    // Two letters, each an "a" with six accents: fourteen characters.
    await field('Short name').fill(`a${'\u0301'.repeat(6)}b${'\u0301'.repeat(6)}`);
    await field('Short name').blur();
    await expect(drawer().getByRole('alert').filter({ hasText: 'That short name is too long. Use simpler letters.' })).toBeVisible();
    await expect(drawer().getByText('3 letters or fewer')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click();
  });

  test('search asks the API for names containing the text', async () => {
    const a = await makeViaApi();
    const b = await makeViaApi();
    await page.reload();
    await expect(rowOf(a.name)).toBeVisible();
    await expect(rowOf(b.name)).toBeVisible();
    const asked = page.waitForRequest((r) => r.url().includes('/organisation?') && r.url().includes('organisationname='));
    await page.getByRole('searchbox', { name: 'Search organisations by name' }).fill(`${RUN}-${counter}`);
    const request = await asked;
    expect(new URL(request.url()).searchParams.get('organisationname')).toBe(`${RUN}-${counter}`);
    await expect(rowOf(b.name)).toBeVisible();
    await expect(rowOf(a.name)).toHaveCount(0);
    await expect(page.locator('.sub')).toContainText('1 organisation match');
    // No match: the empty state says so, and offers the way out.
    await page.getByRole('searchbox', { name: 'Search organisations by name' }).fill('zzzz no such organisation');
    await expect(page.getByRole('heading', { name: /No organisations match/ })).toBeVisible();
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(rowOf(a.name)).toBeVisible();
  });
});

test.describe('organisations: list states, with the list mocked', () => {
  test.describe.configure({ mode: 'serial' });
  let own: Page;

  const fake = (n: number, from = 1) =>
    Array.from({ length: n }, (_, i) => ({
      organisationid: `00000000-0000-4000-8000-${String(from + i).padStart(12, '0')}`,
      organisationname: `Sample Company ${from + i}`,
      organisationcode: `sample${from + i}`,
      organisationshortname: 'SC',
      organisationpreset: 'company',
      organisationstatus: true,
      uitheme: 'kids',
      brandingconfig: null,
      countries: [{ countryid: 'c1', countryname: 'Cambodia' }],
    }));

  test.beforeAll(async ({ browser }) => {
    own = await browser.newPage();
    await loginViaUi(own);
  });
  test.afterAll(async () => {
    await own?.close();
  });

  const mockList = async (handler: Parameters<Page['route']>[1]) => {
    await own.unroute('**/organisation?*').catch(() => undefined);
    await own.route('**/organisation?*', handler);
  };
  const json = (data: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(data) });

  test('an empty platform says so and offers the next step', async () => {
    await mockList((route) => route.fulfill(json({ error: false, data: { data: [], total: 0, pageindex: 1, pagesize: 20 } })));
    await own.goto('/organisation');
    await expect(own.getByRole('heading', { name: 'No organisations yet' })).toBeVisible();
    await expect(own.getByRole('button', { name: '+ New organisation' }).first()).toBeVisible();
    await expect(own.locator('.sub')).toHaveText('0 organisations');
  });

  test('the count line uses only what the API returns', async () => {
    await mockList((route) => route.fulfill(json({ error: false, data: { data: fake(3), total: 3, pageindex: 1, pagesize: 20 } })));
    await own.goto('/organisation');
    await expect(own.locator('.sub')).toHaveText('3 organisations · 1 country');
    // The header row and the three organisations, and no empty row.
    await expect(own.getByRole('row')).toHaveCount(4);
  });

  test('a failed load shows an error with Try again, which recovers', async () => {
    let attempts = 0;
    await mockList((route) => {
      attempts++;
      return attempts === 1
        ? route.fulfill(json({ error: true, errormessage: 'Mocked.' }, 500))
        : route.fulfill(json({ error: false, data: { data: fake(1), total: 1, pageindex: 1, pagesize: 20 } }));
    });
    await own.goto('/organisation');
    await expect(own.getByRole('alert').filter({ hasText: "Couldn't load the organisations" })).toBeVisible();
    await own.getByRole('button', { name: 'Try again' }).click();
    await expect(own.getByRole('row').filter({ has: own.getByText('Sample Company 1', { exact: true }) })).toBeVisible();
    expect(attempts).toBe(2);
  });

  test('paging asks the API for the page, one-based, and the size', async () => {
    const seen: URL[] = [];
    await mockList((route) => {
      const url = new URL(route.request().url());
      seen.push(url);
      const index = Number(url.searchParams.get('pageindex'));
      const size = Number(url.searchParams.get('pagesize'));
      return route.fulfill(json({ error: false, data: { data: fake(Math.min(size, 45 - (index - 1) * size), (index - 1) * size + 1), total: 45, pageindex: index, pagesize: size } }));
    });
    await own.goto('/organisation');
    await expect(own.getByRole('row').filter({ has: own.getByText('Sample Company 1', { exact: true }) })).toBeVisible();
    expect(seen[0].searchParams.get('pageindex')).toBe('1');
    expect(seen[0].searchParams.get('pagesize')).toBe('20');
    await expect(own.locator('.sub')).toHaveText('45 organisations');
    await own.locator('li[title="2"]').click();
    await expect(own.getByRole('row').filter({ has: own.getByText('Sample Company 21', { exact: true }) })).toBeVisible();
    expect(seen[seen.length - 1].searchParams.get('pageindex')).toBe('2');
  });

  // ---- Branding: only the keys the form knows are sent back ---------------------------------
  const withBranding = () => ({
    ...fake(1)[0],
    brandingconfig: { tilecolour: '#0B7C85', logourl: 'https://example.com/logo.png', extra: 'must not be sent back' },
  });

  test('suspending sends the known branding keys only', async () => {
    await mockList((route) => route.fulfill(json({ error: false, data: { data: [withBranding()], total: 1, pageindex: 1, pagesize: 20 } })));
    let sent: any;
    await own.route('**/organisation/*', (route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      sent = route.request().postDataJSON();
      return route.fulfill(json({ error: false, data: { ...withBranding(), organisationstatus: false } }));
    });
    await own.goto('/organisation');
    await own.getByRole('button', { name: 'More actions for Sample Company 1' }).click();
    await own.getByRole('menuitem', { name: 'Suspend' }).click();
    await own.getByRole('alertdialog').getByRole('button', { name: 'Suspend organisation' }).click();
    await expect.poll(() => sent, 'the change was sent').toBeTruthy();
    expect(sent.brandingconfig).toEqual({ tilecolour: '#0B7C85', logourl: 'https://example.com/logo.png' });
    expect(Object.keys(sent)).not.toContain('uitheme');
    await own.unroute('**/organisation/*');
  });

  test('editing sends the known branding keys only', async () => {
    await mockList((route) => route.fulfill(json({ error: false, data: { data: [withBranding()], total: 1, pageindex: 1, pagesize: 20 } })));
    let sent: any;
    await own.route('**/organisation/*', (route) => {
      if (route.request().method() !== 'PUT') return route.fallback();
      sent = route.request().postDataJSON();
      return route.fulfill(json({ error: false, data: withBranding() }));
    });
    await own.goto('/organisation');
    await own.getByRole('button', { name: 'Edit Sample Company 1' }).click();
    await own.getByRole('dialog', { name: 'Edit organisation' }).getByRole('button', { name: 'Save changes' }).click();
    await expect.poll(() => sent, 'the change was sent').toBeTruthy();
    expect(sent.brandingconfig).toEqual({ tilecolour: '#0B7C85', logourl: 'https://example.com/logo.png' });
    await own.unroute('**/organisation/*');
  });
});

// ---- Which buttons a person sees follows the permissions they hold -------------------------
test.describe('organisations: the buttons follow the permissions', () => {
  test.describe.configure({ mode: 'serial' });
  let own: Page;

  const row = () => ({
    organisationid: '00000000-0000-4000-8000-000000000001',
    organisationname: 'Sample Company 1',
    organisationcode: 'sample1',
    organisationshortname: 'SC',
    organisationpreset: 'company',
    organisationstatus: true,
    uitheme: 'kids',
    brandingconfig: null,
    countries: [{ countryid: 'c1', countryname: 'Cambodia' }],
  });

  test.beforeAll(async ({ browser }) => {
    own = await browser.newPage();
    await loginViaUi(own);
    // What is mocked: the list answer, and the permission list inside the access
    // token the page keeps in sessionStorage (the payload segment, edited in the
    // browser; the UI reads its permissions from there and never checks the signature).
    await own.route('**/organisation?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ error: false, data: { data: [row()], total: 1, pageindex: 1, pagesize: 20 } }),
      }),
    );
  });
  test.afterAll(async () => {
    await own?.close();
  });

  /** Hold exactly these permissions, then open the page afresh. */
  async function holding(permissions: string[]): Promise<void> {
    await own.evaluate((perms) => {
      const raw = sessionStorage.getItem('lms_access_payload') as string;
      const decode = (t: string) => new TextDecoder().decode(Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));
      const encode = (t: string) => {
        const bytes = new TextEncoder().encode(t);
        let bin = '';
        bytes.forEach((b) => (bin += String.fromCharCode(b)));
        return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      };
      const payload = JSON.parse(decode(raw));
      payload.permissions = perms;
      sessionStorage.setItem('lms_access_payload', encode(JSON.stringify(payload)));
    }, permissions);
    await own.goto('/organisation');
    await expect(own.getByRole('row').filter({ has: own.getByText('Sample Company 1', { exact: true }) })).toBeVisible();
  }
  const newButtons = () => own.getByRole('button', { name: '+ New organisation' });
  const editButton = () => own.getByRole('button', { name: 'Edit Sample Company 1' });
  const moreButton = () => own.getByRole('button', { name: 'More actions for Sample Company 1' });

  test('view alone: no New, no Edit, no menu', async () => {
    await holding(['view_organisation']);
    await expect(newButtons()).toHaveCount(0);
    await expect(editButton()).toHaveCount(0);
    await expect(moreButton()).toHaveCount(0);
  });

  test('view and create: New, and nothing on the rows', async () => {
    await holding(['view_organisation', 'create_organisation']);
    await expect(newButtons().first()).toBeVisible();
    await expect(editButton()).toHaveCount(0);
    await expect(moreButton()).toHaveCount(0);
  });

  test('view and update: Edit and Suspend, but not Delete', async () => {
    await holding(['view_organisation', 'update_organisation']);
    await expect(newButtons()).toHaveCount(0);
    await expect(editButton()).toBeVisible();
    await moreButton().click();
    await expect(own.getByRole('menuitem', { name: 'Suspend' })).toBeVisible();
    await expect(own.getByRole('menuitem', { name: /Delete/ })).toHaveCount(0);
  });

  test('view and delete: Delete, but not Edit or Suspend', async () => {
    await holding(['view_organisation', 'delete_organisation']);
    await expect(newButtons()).toHaveCount(0);
    await expect(editButton()).toHaveCount(0);
    await moreButton().click();
    await expect(own.getByRole('menuitem', { name: /Delete/ })).toBeVisible();
    await expect(own.getByRole('menuitem', { name: 'Suspend' })).toHaveCount(0);
    await expect(own.getByRole('menuitem', { name: 'Reactivate' })).toHaveCount(0);
  });
});

test.describe('organisations, signed in without the permission', () => {
  // One fixed account, not one per run: the API can disable a user but cannot list
  // or re-enable one, so a new account each run only piles up. It holds no
  // organisation permission, so it is safe to leave enabled.
  const TEACHER = { username: 'e2e-org-teacher@example.com', password: 'OrgTeacher_Pass1' };
  let superadmin: APIRequestContext;

  test.beforeAll(async () => {
    superadmin = await apiContext(await apiLogin());
    const res = await superadmin.post('/user/create', {
      data: {
        lmsusername: TEACHER.username,
        lmsuserpasswordhash: TEACHER.password,
        lmsuserroles: [ROLE.teacher],
        countryids: [],
        schoolids: [],
      },
    });
    if (!res.ok()) {
      // Already there from an earlier run is fine; anything else is not.
      const said = JSON.stringify(await res.json().catch(() => ({})));
      expect(said, `could not create the fixture user (HTTP ${res.status()})`).toContain('already registered');
    }
  });

  test.afterAll(async () => {
    await superadmin?.dispose();
  });

  test('the menu has no Organisations item, and the route sends them to the not-authorised page', async ({ browser }) => {
    const p = await browser.newPage();
    try {
      await loginViaUi(p, TEACHER.username, TEACHER.password);
      const nav = p.locator('nav[aria-label="Main"]');
      await expect(nav).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Organisations', exact: true })).toHaveCount(0);
      await expect(nav.getByRole('group', { name: 'Platform' })).toHaveCount(0);
      // Typed in, or followed from a bookmark: refused.
      await p.goto('/organisation');
      await expect(p).toHaveURL(/\/un-authorized/);
      await expect(p.getByRole('heading', { name: 'Organisations' })).toHaveCount(0);
    } finally {
      await p.close();
    }
  });
});
