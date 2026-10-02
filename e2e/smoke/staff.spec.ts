import { APIRequestContext, Page, Request, expect, test } from '@playwright/test';
import { ROLE } from '../fixtures/accounts';
import { apiContext, jwtClaims, loginViaUi } from '../fixtures/auth';
import { API_URL } from '../fixtures/env';
import { SECOND_FIXTURE_ORGANISATION, fixtureOrganisationId, organisationFor } from '../fixtures/organisation';

/**
 * Staff accounts and organisations. Real API.
 *
 * Every staff account that is not a platform account belongs to one organisation. A
 * platform caller chooses it; an Organisation Admin works inside its own and never
 * sends it. Accounts these tests make are named with RUN and disabled in teardown
 * (DELETE /user/:id disables, so the rows stay in lmsusers: e2e-staff-<RUN>-*). What
 * stays behind besides those rows: the two fixed fixture organisations ("e2efixture"
 * and "e2efixturekm", Khmer named; fixtures/organisation.ts), which are found, never
 * recreated, and cannot be deleted once they have had staff.
 */

const RUN = `e2e${Math.random().toString(36).slice(2, 8)}`;
const PASSWORD = 'Staff_Pass1';
const email = (tag: string) => `e2e-staff-${RUN}-${tag}@example.com`;
const KHMER_ORG = SECOND_FIXTURE_ORGANISATION.name;

const NOT_FOUND = "That person doesn't exist, or isn't in your organisation.";
const MARKED_NOTE = "Roles marked * can't be given back by you if you remove them.";
const SIGN_IN_NOTE = "Only platform staff can change this person's sign-in details.";
const CHOOSE_ORG = 'Choose the organisation this account belongs to.';

const toasts = (p: Page) => p.locator('.ant-notification-notice');
const submit = (p: Page) => p.getByRole('button', { name: 'Submit', exact: true });
const roleBox = (p: Page, name: string | RegExp) => p.getByRole('checkbox', { name });
const orgSelect = (p: Page) => p.getByLabel('Organisation', { exact: true });

async function tokenOf(p: Page): Promise<string> {
  return p.evaluate(() => {
    const g = (k: string) => sessionStorage.getItem(k);
    return `${g('lms_access_alg')}.${g('lms_access_payload')}.${g('lms_access_hash')}`;
  });
}

/** Choose an organisation by name in the form's select. */
async function chooseOrganisation(p: Page, name: string): Promise<void> {
  // The select's own box: its search input is hidden while a value is chosen.
  await p.locator('nz-select').filter({ has: p.locator('#staff-organisationid') }).click();
  await p.keyboard.type(name);
  await p.locator('.ant-select-item-option', { hasText: name }).first().click();
}

/** The staff writes the page sends, bodies parsed. */
function recordStaffWrites(p: Page): { writes: Array<{ method: string; url: string; body: any }>; stop: () => void } {
  const writes: Array<{ method: string; url: string; body: any }> = [];
  const on = (r: Request) => {
    const path = new URL(r.url()).pathname;
    // The writes: POST /user/create and PUT /user/:id (POST /user is the list).
    if ((r.method() === 'POST' && path.endsWith('/user/create')) || (r.method() === 'PUT' && /\/user\/[^/]+$/.test(path))) {
      writes.push({ method: r.method(), url: r.url(), body: r.postDataJSON() });
    }
  };
  p.on('request', on);
  return { writes, stop: () => p.off('request', on) };
}

/** Look once, after a pause, for a toast: a retrying assertion would pass once it faded. */
async function toastCountAfterPause(p: Page): Promise<number> {
  await p.waitForTimeout(750);
  return toasts(p).count();
}

async function findUser(api: APIRequestContext, username: string): Promise<any> {
  const res = await api.post('/user', { data: { pageindex: 1, pagesize: 20, filter: [{ key: 'lmsusername', value: username }] } });
  const rows: any[] = (await res.json()).data.data;
  return rows.find((r) => r.lmsusername === username);
}

async function userDetail(api: APIRequestContext, id: string): Promise<any> {
  return (await (await api.get(`/user/${id}`)).json()).data;
}

const madeUserIds: string[] = [];
// One sign-in for the superadmin: a second one (by the API) would end this one's session (one token per user).
let sa: APIRequestContext;
let saPage: Page;
let saToken: string;
let fixtureOrg: string;
let otherOrg: string;

async function makeViaApi(tag: string, roles: string[], organisationid?: string): Promise<{ id: string; username: string }> {
  const username = email(tag);
  const res = await sa.post('/user/create', {
    data: {
      lmsusername: username,
      lmsuserpasswordhash: PASSWORD,
      lmsuserroles: roles,
      ...(organisationid ? { organisationid } : await organisationFor(sa, roles)),
      countryids: [],
      schoolids: [],
    },
  });
  expect(res.ok(), `could not create ${username}: ${res.status()}`).toBeTruthy();
  const id = (await res.json()).data.lmsuserid;
  madeUserIds.push(id);
  return { id, username };
}

test.beforeAll(async ({ browser }) => {
  saPage = await browser.newPage();
  await loginViaUi(saPage);
  saToken = await tokenOf(saPage);
  sa = await apiContext(saToken);
  fixtureOrg = await fixtureOrganisationId(sa);
  otherOrg = await fixtureOrganisationId(sa, undefined, SECOND_FIXTURE_ORGANISATION);
});

test.afterAll(async () => {
  for (const id of madeUserIds) {
    const res = await sa.delete(`/user/${id}`);
    // Already disabled by a test (an account that removed its own roles is fine too).
    if (!res.ok() && res.status() !== 404 && res.status() !== 400) throw new Error(`failed to disable ${id}: HTTP ${res.status()}`);
  }
  await sa.dispose();
  await saPage?.close();
});

// ---- A platform caller chooses the organisation -------------------------------------------
test.describe('staff accounts, signed in as the platform superadmin', () => {
  test.describe.configure({ mode: 'serial' });
  let page: Page;

  test.beforeAll(() => {
    page = saPage;
  });

  test('creating staff in an organisation (named in Khmer) puts them in it, and the list says so', async () => {
    const username = email('khmer');
    await page.goto('/user/create');
    await expect(orgSelect(page)).toBeVisible();
    await page.locator('#staff-lmsusername').fill(username);
    await page.locator('#staff-lmsuserpasswordhash').fill(PASSWORD);
    await chooseOrganisation(page, KHMER_ORG);
    await roleBox(page, 'Teacher').check();
    const rec = recordStaffWrites(page);
    await submit(page).click();
    await expect(page).toHaveURL(/\/user\/index/);
    rec.stop();
    expect(rec.writes).toHaveLength(1);
    expect(rec.writes[0].body.organisationid).toBe(otherOrg);
    const row = await findUser(sa, username);
    madeUserIds.push(row.lmsuserid);
    expect(row.organisationid).toBe(otherOrg);

    // The list has an Organisation column, with this organisation in it.
    await expect(page.getByRole('columnheader', { name: 'Organisation' })).toBeVisible();
    await page.locator('nz-filter-trigger').click();
    await page.getByPlaceholder('Search class').fill(username);
    await page.getByRole('button', { name: 'Search' }).click();
    const listed = page.getByRole('row').filter({ hasText: username });
    await expect(listed).toContainText(KHMER_ORG);
  });

  test('no organisation chosen shows the field error beside Organisation and sends nothing', async () => {
    await page.goto('/user/create');
    await page.locator('#staff-lmsusername').fill(email('noorg'));
    await page.locator('#staff-lmsuserpasswordhash').fill(PASSWORD);
    await roleBox(page, 'Teacher').check();
    const rec = recordStaffWrites(page);
    await submit(page).click();
    await expect(page.locator('#staff-organisationid-error')).toHaveText(CHOOSE_ORG);
    await expect(page.getByRole('alert')).toHaveCount(1);
    await page.waitForTimeout(500);
    rec.stop();
    expect(rec.writes, 'nothing was sent').toEqual([]);
    expect(await toastCountAfterPause(page), 'no toast').toBe(0);
    await expect(page).toHaveURL(/\/user\/create/);
  });

  test('a Super Admin account is created with no organisation: the select clears, disables and says why', async () => {
    const username = email('platform');
    await page.goto('/user/create');
    await page.locator('#staff-lmsusername').fill(username);
    await page.locator('#staff-lmsuserpasswordhash').fill(PASSWORD);
    await chooseOrganisation(page, KHMER_ORG);
    await expect(page.locator('nz-select').filter({ hasText: KHMER_ORG })).toBeVisible();
    await roleBox(page, 'Super Admin').check();
    // Cleared and disabled, with the reason.
    await expect(page.locator('nz-select').filter({ hasText: KHMER_ORG })).toHaveCount(0);
    await expect(page.locator('nz-select.ant-select-disabled')).toHaveCount(1);
    await expect(page.getByText('A platform account has no organisation.')).toBeVisible();
    const rec = recordStaffWrites(page);
    await submit(page).click();
    await expect(page).toHaveURL(/\/user\/index/);
    rec.stop();
    expect(rec.writes).toHaveLength(1);
    expect(rec.writes[0].body.organisationid, 'null, not an organisation').toBeNull();
    const row = await findUser(sa, username);
    madeUserIds.push(row.lmsuserid);
    expect(row.organisationid).toBeNull();
    // And the list says "Platform".
    await page.locator('nz-filter-trigger').click();
    await page.getByPlaceholder('Search class').fill(username);
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByRole('row').filter({ hasText: username })).toContainText('Platform');
  });

  test('an existing account can be moved to another organisation', async () => {
    const { id } = await makeViaApi('move', [ROLE.teacher], fixtureOrg);
    await page.goto(`/user/update/${id}`);
    await expect(orgSelect(page)).toBeVisible();
    await expect(page.locator('nz-select').filter({ hasText: 'E2E Fixture Organisation' })).toBeVisible();
    await chooseOrganisation(page, KHMER_ORG);
    const rec = recordStaffWrites(page);
    await submit(page).click();
    await expect(page).toHaveURL(/\/user\/index/);
    rec.stop();
    expect(rec.writes[0].body.organisationid).toBe(otherOrg);
    expect((await userDetail(sa, id)).user.organisationid).toBe(otherOrg);
  });

  /** Fill the create form far enough to submit, in the fixture organisation. */
  async function fillCreate(username: string, password = PASSWORD): Promise<void> {
    await page.goto('/user/create');
    await page.locator('#staff-lmsusername').fill(username);
    await page.locator('#staff-lmsuserpasswordhash').fill(password);
    await chooseOrganisation(page, 'E2E Fixture Organisation');
    await roleBox(page, 'Teacher').check();
  }

  test('an email that is already registered is said on the email field, once, with nothing in a toast', async () => {
    const taken = await makeViaApi('taken', [ROLE.teacher], fixtureOrg);
    await fillCreate(taken.username);
    await submit(page).click();
    await expect(page.locator('#staff-lmsusername-error')).toHaveText('That email is already registered.');
    await expect(page.getByRole('alert')).toHaveCount(1);
    await expect(page.locator('#staff-lmsusername')).toBeFocused();
    expect(await toastCountAfterPause(page), 'one message, not two').toBe(0);
  });

  test('an email longer than 45 characters, and a weak password, are said on their fields, from the API\'s own 400', async () => {
    await fillCreate(`e2e-staff-${RUN}-${'x'.repeat(30)}@example.com`, 'weak');
    await submit(page).click();
    await expect(page.locator('#staff-lmsusername-error')).toHaveText('Enter an email address of at most 45 characters.');
    await expect(page.locator('#staff-lmsuserpasswordhash-error')).toContainText('8 to 50 characters');
    await expect(page.getByRole('alert')).toHaveCount(2);
    await expect(page.locator('#staff-lmsusername')).toBeFocused();
    expect(await toastCountAfterPause(page), 'a validation failure is never a toast').toBe(0);
  });

  test('a save the API cannot do (503) says so in the form once; a 500 is left to the interceptor', async () => {
    await page.route(`${API_URL}/user/create`, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await fillCreate(email('mock503'));
    await submit(page).click();
    await expect(page.getByRole('alert')).toHaveText("The account couldn't be saved. Try again.");
    expect(await toastCountAfterPause(page), 'one message, not two').toBe(0);
    await expect(submit(page)).toBeFocused();
    await page.unroute(`${API_URL}/user/create`);

    await page.route(`${API_URL}/user/create`, (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ errormessage: 'Mocked.' }) }),
    );
    await fillCreate(email('mock500'));
    await submit(page).click();
    await expect(toasts(page)).toHaveCount(1);
    expect(await toastCountAfterPause(page), 'one message, not two').toBe(1);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.unroute(`${API_URL}/user/create`);
  });

  test('ticking Super Admin on an existing account clears its organisation: it becomes a platform account', async () => {
    const { id } = await makeViaApi('promote', [ROLE.teacher], fixtureOrg);
    await page.goto(`/user/update/${id}`);
    await expect(page.locator('nz-select').filter({ hasText: 'E2E Fixture Organisation' })).toBeVisible();
    await roleBox(page, 'Super Admin').check();
    await expect(page.locator('nz-select').filter({ hasText: 'E2E Fixture Organisation' })).toHaveCount(0);
    await expect(page.getByText('A platform account has no organisation.')).toBeVisible();
    const rec = recordStaffWrites(page);
    await submit(page).click();
    await expect(page).toHaveURL(/\/user\/index/);
    rec.stop();
    expect(rec.writes[0].body.organisationid).toBeNull();
    expect((await userDetail(sa, id)).user.organisationid).toBeNull();
  });

  test('clearing the organisation on an edit shows the field error and sends nothing', async () => {
    const { id } = await makeViaApi('clear', [ROLE.teacher], fixtureOrg);
    await page.goto(`/user/update/${id}`);
    const select = page.locator('nz-select').filter({ has: page.locator('#staff-organisationid') });
    await expect(select).toContainText('E2E Fixture Organisation');
    await select.hover();
    await select.locator('.ant-select-clear').click();
    const rec = recordStaffWrites(page);
    await submit(page).click();
    await expect(page.locator('#staff-organisationid-error')).toHaveText(CHOOSE_ORG);
    await page.waitForTimeout(500);
    rec.stop();
    expect(rec.writes, 'nothing was sent').toEqual([]);
    expect((await userDetail(sa, id)).user.organisationid).toBe(fixtureOrg);
  });

  test('the Organisation select lists every page of organisations, not just the first', async () => {
    const org = (n: string, i: number) => ({
      organisationid: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      organisationname: n,
      organisationcode: `filler${i}`,
      organisationshortname: 'F',
      organisationpreset: 'company',
      organisationstatus: true,
      uitheme: 'corporate',
      brandingconfig: null,
      countries: [],
    });
    const asked: number[] = [];
    await page.route(`${API_URL}/organisation?*`, (route) => {
      const index = Number(new URL(route.request().url()).searchParams.get('pageindex'));
      asked.push(index);
      const rows = index === 1 ? Array.from({ length: 200 }, (_, i) => org(`Filler ${i}`, i + 1)) : [org('Second Page Organisation', 999)];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ error: false, data: { data: rows, total: 201, pageindex: index, pagesize: 200 } }),
      });
    });
    await page.goto('/user/create');
    await expect(orgSelect(page)).toBeVisible();
    await page.locator('nz-select').filter({ has: page.locator('#staff-organisationid') }).click();
    await page.keyboard.type('Second Page');
    await expect(page.locator('.ant-select-item-option', { hasText: 'Second Page Organisation' })).toBeVisible();
    expect(asked, 'both pages were asked for').toEqual([1, 2]);
    await page.unroute(`${API_URL}/organisation?*`);
  });

  test('an id that is not an account shows the not-found state, with a way back, not an empty form', async () => {
    await page.goto('/user/update/00000000-0000-4000-8000-0000000000aa');
    await expect(page.getByRole('alert').filter({ hasText: NOT_FOUND })).toBeVisible();
    await expect(page.locator('#staff-lmsusername')).toHaveCount(0);
    await page.getByRole('link', { name: 'Back to staff accounts' }).click();
    await expect(page).toHaveURL(/\/user\/index/);
  });
});

// ---- An Organisation Admin works inside its own organisation ---------------------------------
test.describe('staff accounts, signed in as an Organisation Admin', () => {
  test.describe.configure({ mode: 'serial' });
  let page: Page;
  let admin: { id: string; username: string };
  let wide: { id: string; username: string };
  let platformId: string;
  let colleagueId = '';

  test.beforeAll(async ({ browser }) => {
    admin = await makeViaApi('orgadmin', [ROLE.organisationadmin], fixtureOrg);
    // An account holding Admin, which the platform gave and the Organisation Admin could not.
    wide = await makeViaApi('wide', [ROLE.admin], fixtureOrg);
    platformId = jwtClaims(saToken).lmsuserid as string;
    page = await browser.newPage();
    await loginViaUi(page, admin.username, PASSWORD);
  });
  test.afterAll(async () => {
    await page?.close();
  });

  test('sees Staff accounts, lists only its own organisation, and has no Organisation column', async () => {
    await page.getByRole('button', { name: 'Administration' }).click();
    await expect(page.getByRole('link', { name: 'Staff accounts' })).toBeVisible();
    await page.getByRole('link', { name: 'Staff accounts' }).click();
    await expect(page).toHaveURL(/\/user\/index/);
    await expect(page.getByRole('columnheader', { name: 'Email' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Organisation' })).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: admin.username })).toBeVisible();
    // A platform account is not listed.
    await page.locator('nz-filter-trigger').click();
    await page.getByPlaceholder('Search class').fill('superadmin@');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'superadmin@' })).toHaveCount(0);
  });

  test('the create form has no Organisation select and offers only the roles it may give; the colleague lands in its organisation', async () => {
    const username = email('colleague');
    await page.goto('/user/create');
    await page.locator('#staff-lmsusername').fill(username);
    await expect(orgSelect(page)).toHaveCount(0);
    await expect(page.getByText('Organisation', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('checkbox')).toHaveCount(1);
    await expect(roleBox(page, 'Organisation Admin')).toBeVisible();
    await page.locator('#staff-lmsuserpasswordhash').fill(PASSWORD);
    await roleBox(page, 'Organisation Admin').check();
    const rec = recordStaffWrites(page);
    await submit(page).click();
    await expect(page).toHaveURL(/\/user\/index/);
    rec.stop();
    expect(rec.writes).toHaveLength(1);
    expect(Object.keys(rec.writes[0].body), 'nothing about the organisation is sent').not.toContain('organisationid');
    const row = await findUser(sa, username);
    madeUserIds.push(row.lmsuserid);
    colleagueId = row.lmsuserid;
    expect(row.organisationid).toBe(fixtureOrg);
  });

  test('opening a platform account shows the not-found state, with a link back to the list', async () => {
    await page.goto(`/user/update/${platformId}`);
    await expect(page.getByRole('alert').filter({ hasText: NOT_FOUND })).toBeVisible();
    await expect(page.locator('#staff-lmsusername')).toHaveCount(0);
    await expect(toasts(page)).toHaveCount(0);
    await page.getByRole('link', { name: 'Back to staff accounts' }).click();
    await expect(page).toHaveURL(/\/user\/index/);
  });

  test('editing an account that holds Admin shows the marked role, locks sign-in, and an unchanged save keeps Admin', async () => {
    await page.goto(`/user/update/${wide.id}`);
    await expect(roleBox(page, 'Admin *')).toBeChecked();
    await expect(roleBox(page, 'Organisation Admin')).not.toBeChecked();
    await expect(page.locator('#staff-lmsusername')).toBeDisabled();
    await expect(page.locator('#staff-lmsuserpasswordhash')).toBeDisabled();
    await expect(page.getByText(MARKED_NOTE)).toBeVisible();
    await expect(page.getByText(SIGN_IN_NOTE)).toBeVisible();
    await expect(page.getByText('Organisation', { exact: true })).toBeVisible();
    await expect(page.locator('#staff-organisation-name')).toHaveText('E2E Fixture Organisation');
    const rec = recordStaffWrites(page);
    await submit(page).click();
    await expect(page).toHaveURL(/\/user\/index/);
    rec.stop();
    expect(rec.writes).toHaveLength(1);
    expect(rec.writes[0].body.lmsuserroles).toEqual([ROLE.admin]);
    expect(Object.keys(rec.writes[0].body)).not.toContain('organisationid');
    const roles = (await userDetail(sa, wide.id)).user.roles.map((r: any) => r.roleid);
    expect(roles, 'Admin is still held').toEqual([ROLE.admin]);
  });

  test('an account with nothing beyond its own reach has no marked-role or sign-in notes, and its sign-in fields are open', async () => {
    await page.goto(`/user/update/${colleagueId}`);
    await expect(page.locator('#staff-lmsusername')).toBeEnabled();
    await expect(page.locator('#staff-lmsuserpasswordhash')).toBeEnabled();
    await expect(page.getByText(MARKED_NOTE)).toHaveCount(0);
    await expect(page.getByText(SIGN_IN_NOTE)).toHaveCount(0);
  });

  test('adding a role it may not give is refused with one message, in the form', async () => {
    // The form offers only what the API lets this caller give, so the extra role is offered by a
    // mocked GET; the refusal itself is the real API's.
    await page.route(`**/user/${wide.id}`, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const real = await route.fetch();
      const body = await real.json();
      body.data.roles.push({ id: ROLE.teacher, text: 'Teacher', checked: false, canadd: true });
      return route.fulfill({ response: real, json: body });
    });
    await page.goto(`/user/update/${wide.id}`);
    await roleBox(page, 'Teacher').check();
    await submit(page).click();
    const alert = page.getByRole('alert');
    await expect(alert).toHaveText("You can't give a role that has more access than your own.");
    await expect(alert).toHaveCount(1);
    expect(await toastCountAfterPause(page), 'one message, not two').toBe(0);
    await expect(page).toHaveURL(/\/user\/update\//);
    await expect(submit(page)).toBeFocused();
    await page.unroute(`**/user/${wide.id}`);
    expect((await userDetail(sa, wide.id)).user.roles.map((r: any) => r.roleid)).toEqual([ROLE.admin]);
  });

  test('a refused action on an older screen says so in one toast (a country create without permission)', async () => {
    await page.goto('/country/create');
    await page.locator('[formControlName="countryname"]').fill(`Zz${RUN}`);
    await page.locator('[formControlName="expectedusage"]').fill('10');
    await page.getByRole('button', { name: /submit/i }).click();
    await expect(toasts(page).filter({ hasText: "You don't have permission to do that." })).toHaveCount(1);
    expect(await toastCountAfterPause(page), 'one message, not two').toBe(1);
  });

  test('changing its own roles asks first, sends nothing on Cancel, and ends at the sign-in page with one message', async () => {
    await page.goto(`/user/update/${admin.id}`);
    await expect(roleBox(page, 'Organisation Admin')).toBeChecked();
    await roleBox(page, 'Organisation Admin').uncheck();
    const rec = recordStaffWrites(page);
    await submit(page).click();
    const ask = page.getByRole('alertdialog', { name: 'Changing your own roles signs you out. Continue?' });
    await expect(ask).toBeVisible();
    await ask.getByRole('button', { name: 'Cancel' }).click();
    await expect(ask).toBeHidden();
    await page.waitForTimeout(500);
    expect(rec.writes, 'Cancel sent nothing').toEqual([]);
    await expect(page).toHaveURL(/\/user\/update\//);

    await submit(page).click();
    await ask.getByRole('button', { name: 'Continue' }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
    rec.stop();
    expect(rec.writes).toHaveLength(1);
    await expect(toasts(page).filter({ hasText: 'Your roles changed' })).toHaveCount(1);
    expect(await toastCountAfterPause(page), 'one message').toBe(1);
  });
});

test.describe('staff accounts, an edit that changes nobody\'s roles does not ask about signing out', () => {
  test.describe.configure({ mode: 'serial' });
  let page: Page;
  let self: { id: string; username: string };

  test.beforeAll(async ({ browser }) => {
    self = await makeViaApi('self', [ROLE.organisationadmin], fixtureOrg);
    page = await browser.newPage();
    await loginViaUi(page, self.username, PASSWORD);
  });
  test.afterAll(async () => {
    await page?.close();
  });

  test('saving your own account with the same roles asks nothing and stays signed in', async () => {
    await page.goto(`/user/update/${self.id}`);
    await expect(roleBox(page, 'Organisation Admin')).toBeChecked();
    const rec = recordStaffWrites(page);
    await submit(page).click();
    await expect(page).toHaveURL(/\/user\/index/);
    rec.stop();
    expect(rec.writes).toHaveLength(1);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    // Still signed in: the list loads.
    await expect(page.getByRole('columnheader', { name: 'Email' })).toBeVisible();
  });
});
