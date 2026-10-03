import { APIRequestContext, Browser, Page, expect, test } from '@playwright/test';
import { ROLE } from '../fixtures/accounts';
import { apiContext, apiLogin, jwtClaims, loginViaUi } from '../fixtures/auth';
import { API_URL } from '../fixtures/env';
import { ensureLocalFixtureUser } from '../fixtures/local-fixture-user';
import { skipUnlessLocalApi } from '../fixtures/local-only';
import { SECOND_FIXTURE_ORGANISATION, fixtureOrganisationId } from '../fixtures/organisation';

/**
 * The organisation chip at the top of the nav, and the switcher it opens for platform
 * accounts. Real API.
 *
 * Switching reissues the superadmin's tokens (the old ones stop working), so every API
 * call here uses the token the page holds NOW, never one fetched earlier. The throwaway
 * organisations (a styled one, a suspended one, four to make the list searchable) have no
 * staff and are deleted in teardown; staff made while acting go in the fixture organisation
 * and are disabled in teardown (what stays behind is what staff.spec.ts leaves).
 *
 * It makes staff accounts with passwords written in this public repository, so it runs only
 * against a local API.
 */
skipUnlessLocalApi('creates an Organisation Admin and a Teacher staff account');

const RUN = `e2e${Math.random().toString(36).slice(2, 8)}`;
const PASSWORD = 'Switch_Pass1';
const FIXTURE_NAME = 'E2E Fixture Organisation';
const STYLED = `Switcher sample ${RUN}`;
const SUSPENDED = `Switcher suspended ${RUN}`;
const PLATFORM_BACK = "You're back to the platform view.";

let saPage: Page;
let fixtureOrg: string;
let secondOrg: string;
const throwawayOrgs: string[] = [];
const madeUsers: string[] = [];

const toasts = (p: Page) => p.locator('.ant-notification-notice');
const chip = (p: Page) => p.getByRole('button', { name: /^Organisation: .*Switch organisation$/ });
const menu = (p: Page) => p.getByRole('menu', { name: 'Switch organisation' });
const row = (p: Page, name: string) => menu(p).getByRole('menuitemradio', { name });

async function tokenOf(p: Page): Promise<string> {
  return p.evaluate(() => {
    const g = (k: string) => sessionStorage.getItem(k);
    return `${g('lms_access_alg')}.${g('lms_access_payload')}.${g('lms_access_hash')}`;
  });
}

/** An API context on the token the page holds now. */
async function api(p: Page = saPage): Promise<APIRequestContext> {
  return apiContext(await tokenOf(p));
}

async function openSwitcher(p: Page = saPage): Promise<void> {
  await chip(p).click();
  await expect(menu(p)).toBeVisible();
}

/** Choose a row and wait for the page to come back in the new context. */
async function chooseAndSettle(p: Page, name: string, afterChip: RegExp): Promise<void> {
  await openSwitcher(p);
  await row(p, name).click();
  await expect(chip(p)).toHaveAccessibleName(afterChip);
}

async function makeOrg(code: string, name: string, extra: Record<string, unknown> = {}): Promise<string> {
  const client = await api();
  const country = (await (await client.get('/country/all?country=')).json()).data[0].countryid;
  const created = await client.post('/organisation', {
    data: {
      organisationname: name,
      organisationcode: code,
      organisationshortname: 'TS',
      organisationpreset: 'company',
      uitheme: 'corporate',
      countryids: [country],
      ...extra,
    },
  });
  expect(created.ok(), `could not create ${code}: ${created.status()}`).toBeTruthy();
  const id = (await created.json()).data.organisationid;
  throwawayOrgs.push(id);
  await client.dispose();
  return id;
}

async function makeStaff(tag: string, roles: string[]): Promise<{ id: string; username: string }> {
  const client = await api();
  const username = `e2e-sw-${RUN}-${tag}@example.com`;
  const res = await client.post('/user/create', {
    data: { lmsusername: username, lmsuserpasswordhash: PASSWORD, lmsuserroles: roles, organisationid: fixtureOrg, countryids: [], schoolids: [] },
  });
  expect(res.ok(), `could not create ${username}: ${res.status()}`).toBeTruthy();
  const id = (await res.json()).data.lmsuserid;
  madeUsers.push(id);
  await client.dispose();
  return { id, username };
}

test.beforeAll(async ({ browser }) => {
  saPage = await browser.newPage();
  await loginViaUi(saPage);
  const client = await api();
  fixtureOrg = await fixtureOrganisationId(client);
  secondOrg = await fixtureOrganisationId(client, undefined, SECOND_FIXTURE_ORGANISATION);
  await client.dispose();
  await makeOrg(`${RUN}a`, STYLED, {
    organisationshortname: 'TS',
    organisationpreset: 'schoolnetwork',
    uitheme: 'kids',
    brandingconfig: { tilecolour: '#6D5BD0' },
  });
  const suspended = await makeOrg(`${RUN}b`, SUSPENDED, { organisationshortname: 'SU' });
  // Four more, so the list is longer than a handful and gets its search box.
  for (let i = 1; i <= 4; i++) await makeOrg(`${RUN}x${i}`, `Switcher extra ${RUN} ${i}`, { organisationshortname: 'EX' });
  const c2 = await api();
  const country = (await (await c2.get('/country/all?country=')).json()).data[0].countryid;
  const off = await c2.put(`/organisation/${suspended}`, {
    data: { organisationname: SUSPENDED, organisationshortname: 'SU', countryids: [country], organisationstatus: false },
  });
  expect(off.ok(), `could not suspend the throwaway organisation: ${off.status()}`).toBeTruthy();
  await c2.dispose();
});

test.afterAll(async () => {
  // A fresh platform-view token: the page's own may be gone (the refresh test ends with another sign-in).
  const platform = await apiContext(await apiLogin());
  for (const id of madeUsers) {
    const res = await platform.delete(`/user/${id}`);
    if (!res.ok()) throw new Error(`failed to disable ${id}: HTTP ${res.status()}`);
  }
  for (const id of throwawayOrgs) {
    const res = await platform.delete(`/organisation/${id}`);
    if (!res.ok()) throw new Error(`the throwaway organisation ${id} was not deleted: HTTP ${res.status()}`);
  }
  await platform.dispose();
  await saPage?.close();
});

test.describe('the switcher, signed in as the platform superadmin', () => {
  test.describe.configure({ mode: 'serial' });

  test('the chip reads Platform view on an ink tile with a globe', async () => {
    await saPage.goto('/user/index');
    await expect(chip(saPage)).toHaveAccessibleName('Organisation: All organisations, Platform view. Switch organisation');
    await expect(chip(saPage)).toContainText('All organisations');
    await expect(chip(saPage)).toContainText('Platform view');
    await expect(chip(saPage).locator('.tile svg')).toHaveCount(1);
    await expect(chip(saPage).locator('.tile')).toHaveCSS('background-color', 'rgb(30, 41, 59)');
  });

  test('the switcher lists All organisations and every live organisation, marks the current one, labels the suspended', async () => {
    await saPage.goto('/user/index');
    await openSwitcher();
    await expect(row(saPage, 'All organisations')).toHaveAttribute('aria-checked', 'true');
    for (const name of [FIXTURE_NAME, SECOND_FIXTURE_ORGANISATION.name, STYLED]) {
      await expect(row(saPage, name)).toBeVisible();
      await expect(row(saPage, name)).toHaveAttribute('aria-checked', 'false');
    }
    await expect(row(saPage, STYLED)).toContainText('School network');
    // The suspended one is shown, labelled, and cannot be chosen.
    await expect(row(saPage, SUSPENDED).locator('.sub')).toHaveText('Company · suspended');
    await expect(row(saPage, FIXTURE_NAME).locator('.sub')).toHaveText('Company');
    await expect(row(saPage, SUSPENDED)).toHaveAttribute('aria-disabled', 'true');
    // The menu is wider than the nav: its right edge is over the page, and the page must not cover it.
    const box = (await row(saPage, 'All organisations').boundingBox())!;
    // (Polled: the page's loading spinner fades out over everything for a moment first.)
    await expect
      .poll(
        () =>
          saPage.evaluate(({ x, y }) => !document.elementFromPoint(x, y)?.closest('[role="menu"]'), {
            x: box.x + box.width - 8,
            y: box.y + box.height / 2,
          }),
        { message: 'the page covers the open menu' },
      )
      .toBe(false);
    await saPage.keyboard.press('Escape');
    await expect(menu(saPage)).toBeHidden();
    await expect(chip(saPage)).toBeFocused();
  });

  test('a list longer than a handful has a search box, and it is keyboard-operable', async () => {
    await openSwitcher();
    const find = menu(saPage).getByRole('searchbox', { name: 'Find an organisation' });
    await expect(find).toBeFocused();
    await find.fill(`Switcher extra ${RUN}`);
    await expect(menu(saPage).getByRole('menuitemradio')).toHaveCount(4);
    await expect(row(saPage, 'All organisations')).toHaveCount(0);
    await find.fill('zzzz no such');
    await expect(menu(saPage).getByRole('menuitemradio')).toHaveCount(0);
    await expect(menu(saPage).getByText(/No organisation matches/)).toBeVisible();
    await find.fill('');
    // Arrow keys move through the rows, Home and End jump.
    await saPage.keyboard.press('ArrowDown');
    await expect(row(saPage, 'All organisations')).toBeFocused();
    await saPage.keyboard.press('ArrowDown');
    await expect(menu(saPage).getByRole('menuitemradio').nth(1)).toBeFocused();
    await saPage.keyboard.press('End');
    await expect(menu(saPage).getByRole('menuitemradio').last()).toBeFocused();
    await saPage.keyboard.press('Home');
    await expect(find).toBeFocused();
    await saPage.keyboard.press('Escape');
  });

  test('a suspended organisation cannot be chosen: nothing is sent and the chip stays', async () => {
    const sent: string[] = [];
    const on = (r: import('@playwright/test').Request) => {
      if (r.url().endsWith('/auth/organisation') && r.method() === 'POST') sent.push(r.url());
    };
    saPage.on('request', on);
    await openSwitcher();
    // By the keyboard and by a dispatched click: a mouse click would wait for an enabled element.
    await row(saPage, SUSPENDED).focus();
    await saPage.keyboard.press('Enter');
    await row(saPage, SUSPENDED).dispatchEvent('click');
    await saPage.waitForTimeout(500);
    saPage.off('request', on);
    expect(sent, 'no switch was asked for').toEqual([]);
    await expect(chip(saPage)).toHaveAccessibleName('Organisation: All organisations, Platform view. Switch organisation');
    await saPage.keyboard.press('Escape');
  });

  test('a refused switch (403, 404) says so once in the menu; a 429 is the interceptor\'s one toast; the chip stays', async () => {
    const chipName = 'Organisation: All organisations, Platform view. Switch organisation';
    const answer = (status: number, body: object = {}) =>
      (route: import('@playwright/test').Route) =>
        route.request().method() === 'POST' ? route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }) : route.fallback();

    // 403
    await saPage.route(`${API_URL}/auth/organisation`, answer(403, { errormessage: 'No.' }));
    await openSwitcher();
    await row(saPage, STYLED).click();
    await expect(menu(saPage).getByRole('alert')).toHaveText('Only platform staff can switch organisation.');
    await expect(menu(saPage).getByRole('alert')).toHaveCount(1);
    expect(await toasts(saPage).count(), 'one message, not two').toBe(0);
    await expect(chip(saPage)).toHaveAccessibleName(chipName);
    await saPage.unroute(`${API_URL}/auth/organisation`);

    // 404 (suspended or deleted since the list was read)
    await saPage.route(`${API_URL}/auth/organisation`, answer(404, { errormessage: "That organisation doesn't exist." }));
    await row(saPage, STYLED).click();
    await expect(menu(saPage).getByRole('alert')).toHaveText("That organisation isn't available. It may have been suspended or deleted.");
    expect(await toasts(saPage).count(), 'one message, not two').toBe(0);
    await expect(chip(saPage)).toHaveAccessibleName(chipName);
    await saPage.unroute(`${API_URL}/auth/organisation`);
    await saPage.keyboard.press('Escape');

    // 429: the interceptor's toast is the one message; the menu says nothing
    await saPage.route(`${API_URL}/auth/organisation`, answer(429, { errormessage: 'Too many.' }));
    await openSwitcher();
    await row(saPage, STYLED).click();
    await expect(toasts(saPage)).toHaveCount(1);
    await saPage.waitForTimeout(750);
    expect(await toasts(saPage).count(), 'one message, not two').toBe(1);
    await expect(menu(saPage).getByRole('alert')).toHaveCount(0);
    await expect(chip(saPage)).toHaveAccessibleName(chipName);
    await saPage.unroute(`${API_URL}/auth/organisation`);
    await saPage.keyboard.press('Escape');
  });

  test('choosing an organisation updates the chip: its tile colour, short name, name and kind', async () => {
    await saPage.goto('/user/index');
    await chooseAndSettle(saPage, STYLED, new RegExp(`^Organisation: ${STYLED}, School network\\.`));
    await expect(chip(saPage).locator('.tile')).toHaveText('TS');
    await expect(chip(saPage).locator('.tile')).toHaveCSS('background-color', 'rgb(109, 91, 208)');
    await expect(chip(saPage)).toContainText(STYLED);
    await expect(chip(saPage)).toContainText('School network');
    const claims = jwtClaims(await tokenOf(saPage));
    expect(claims.isplatform).toBe(true);
    expect(claims.organisationid).toBe(throwawayOrgs[0]);
    // The current one is marked.
    await openSwitcher();
    await expect(row(saPage, STYLED)).toHaveAttribute('aria-checked', 'true');
    await expect(row(saPage, 'All organisations')).toHaveAttribute('aria-checked', 'false');
    await saPage.keyboard.press('Escape');
  });

  test('while acting, the Organisations screen stays open (platform-only routes are not scoped)', async () => {
    await saPage.goto('/organisation');
    await expect(saPage.getByRole('heading', { level: 1, name: 'Organisations' })).toBeVisible();
    await expect(chip(saPage)).toContainText(STYLED);
  });

  test('"All organisations" returns to the platform view', async () => {
    await chooseAndSettle(saPage, 'All organisations', /^Organisation: All organisations, Platform view\./);
    expect(jwtClaims(await tokenOf(saPage)).organisationid ?? null).toBeNull();
  });

  test('a staff account created while acting lands in that organisation', async () => {
    await saPage.goto('/user/index');
    await chooseAndSettle(saPage, FIXTURE_NAME, /^Organisation: E2E Fixture Organisation, Company\./);
    const username = `e2e-sw-${RUN}-made@example.com`;
    await saPage.goto('/user/create');
    // Acting inside an organisation: no Organisation select, and none is sent.
    await expect(saPage.locator('#staff-lmsusername')).toBeVisible();
    await expect(saPage.getByLabel('Organisation', { exact: true })).toHaveCount(0);
    await saPage.locator('#staff-lmsusername').fill(username);
    await saPage.locator('#staff-lmsuserpasswordhash').fill(PASSWORD);
    await saPage.getByRole('checkbox', { name: 'Teacher' }).check();
    const bodies: any[] = [];
    saPage.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/user/create')) bodies.push(r.postDataJSON());
    });
    await saPage.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(saPage).toHaveURL(/\/user\/index/);
    expect(bodies).toHaveLength(1);
    expect(Object.keys(bodies[0])).not.toContain('organisationid');
    const client = await api();
    const found = await client.post('/user', { data: { pageindex: 1, pagesize: 20, filter: [{ key: 'lmsusername', value: username }] } });
    const created = (await found.json()).data.data.find((u: any) => u.lmsusername === username);
    await client.dispose();
    expect(created, 'the account is visible in the organisation the session acts in').toBeTruthy();
    expect(created.organisationid).toBe(fixtureOrg);
    madeUsers.push(created.lmsuserid);
  });

  test('a page about one record goes Home on a switch; a list stays and reloads', async () => {
    const { id } = await makeStaff('record', [ROLE.teacher]);
    // A list stays where it is.
    await saPage.goto('/user/index');
    await chooseAndSettle(saPage, 'All organisations', /^Organisation: All organisations, Platform view\./);
    await expect(saPage).toHaveURL(/\/user\/index/);
    // An edit page goes Home.
    await saPage.goto(`/user/update/${id}`);
    await expect(saPage.locator('#staff-lmsusername')).toBeVisible();
    await openSwitcher();
    await row(saPage, FIXTURE_NAME).click();
    await expect(saPage).toHaveURL(/\/dashboard\/(index|default)/);
    await expect(chip(saPage)).toHaveAccessibleName(/^Organisation: E2E Fixture Organisation, Company\./);
    // And back to the platform view for what follows.
    await chooseAndSettle(saPage, 'All organisations', /^Organisation: All organisations, Platform view\./);
  });

  test('a switch the person asked for gives no "back to the platform view" notice', async () => {
    await saPage.goto('/user/index');
    await chooseAndSettle(saPage, FIXTURE_NAME, /^Organisation: E2E Fixture Organisation, Company\./);
    await chooseAndSettle(saPage, 'All organisations', /^Organisation: All organisations, Platform view\./);
    await saPage.waitForTimeout(750);
    await expect(toasts(saPage).filter({ hasText: PLATFORM_BACK })).toHaveCount(0);
  });
});

test.describe('Organisations needs the platform claim, not just the permission', () => {
  /** A page signed in with the superadmin's stored token, its payload edited to `isplatform: false`. All API calls stubbed. */
  async function pageWithoutPlatformClaim(browser: Browser): Promise<Page> {
    const keys = ['lms_access_alg', 'lms_access_payload', 'lms_access_hash', 'lms_refresh_alg', 'lms_refresh_payload', 'lms_refresh_hash'];
    const stored: Record<string, string> = await saPage.evaluate((ks) => {
      const out: Record<string, string> = {};
      for (const k of ks) {
        const v = sessionStorage.getItem(k);
        if (v) out[k] = v;
      }
      return out;
    }, keys);
    const claims = JSON.parse(Buffer.from(stored['lms_access_payload'], 'base64url').toString('utf8'));
    claims.isplatform = false;
    stored['lms_access_payload'] = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const page = await browser.newPage();
    await page.addInitScript((s) => {
      for (const [k, v] of Object.entries(s)) sessionStorage.setItem(k, v as string);
    }, stored);
    // The edited token no longer matches its signature: nothing may reach the real API with it.
    await page.route(`${API_URL}/**`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: false, data: { data: [], total: 0 } }) }),
    );
    return page;
  }

  test('the nav item is hidden and the route is refused, though the token holds the permission', async ({ browser }) => {
    const page = await pageWithoutPlatformClaim(browser);
    try {
      await page.goto('/dashboard/index');
      await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Organisations' })).toHaveCount(0);
      // (it is hidden by the claim: the token still carries the permission)
      const permissions = jwtClaimsFrom(await page.evaluate(() => `${sessionStorage.getItem('lms_access_alg')}.${sessionStorage.getItem('lms_access_payload')}.${sessionStorage.getItem('lms_access_hash')}`)).permissions as string[];
      expect(permissions).toContain('view_organisation');
      await page.goto('/organisation');
      await expect(page).toHaveURL(/\/un-authorized/);
    } finally {
      await page.close();
    }
  });
});

function jwtClaimsFrom(token: string): Record<string, unknown> {
  return jwtClaims(token);
}

test.describe('an organisation\'s own staff see their organisation and no switcher', () => {
  test.describe.configure({ mode: 'serial' });
  const TEACHER = { username: 'e2e-org-teacher@example.com', password: 'OrgTeacher_Pass1' };

  test('the fixed no-permission teacher: the chip names its organisation generically, and there is no switcher', async ({ browser }) => {
    const client = await api();
    await ensureLocalFixtureUser(client, { ...TEACHER, roles: [ROLE.teacher], organisationid: fixtureOrg });
    await client.dispose();
    const page = await browser.newPage();
    try {
      await loginViaUi(page, TEACHER.username, TEACHER.password);
      const here = page.getByRole('group', { name: /^Organisation: / });
      await expect(here).toBeVisible();
      // Without permission to read staff, a Teacher has no way to learn its organisation's name:
      // the token carries only the id.
      await expect(here).toContainText('Your organisation');
      await expect(chip(page)).toHaveCount(0);
      await expect(page.locator('[aria-haspopup="menu"]').filter({ hasText: 'Organisation' })).toHaveCount(0);
    } finally {
      await page.close();
    }
  });

  test('an Organisation Admin: the chip names its organisation (read from its own record), and there is no switcher', async ({ browser }) => {
    const admin = await makeStaff('oa', [ROLE.organisationadmin]);
    const page = await browser.newPage();
    try {
      await loginViaUi(page, admin.username, PASSWORD);
      const here = page.getByRole('group', { name: 'Organisation: E2E Fixture Organisation' });
      await expect(here).toBeVisible();
      await expect(here).toContainText('E2E Fixture Organisation');
      await expect(chip(page)).toHaveCount(0);
      await expect(page.getByRole('menu', { name: 'Switch organisation' })).toHaveCount(0);
    } finally {
      await page.close();
    }
  });
});

test.describe('a token refresh returns a platform account to the platform view', () => {
  test('the chip is back to the platform view, with one notice', async ({ browser }) => {
    // Its own page and sign-in: a fake clock cannot be taken off a page again, and a page whose clock
    // is far ahead soon finds its token expired.
    const page = await browser.newPage();
    try {
      // A real refresh, by the app's real timer: it refreshes its token shortly before it expires. The
      // fake clock jumps to just before then, so the API's own refresh runs. A refresh returns the
      // account to its own (platform) view.
      await page.clock.install();
      await loginViaUi(page);
      await page.goto('/user/index');
      await chooseAndSettle(page, FIXTURE_NAME, /^Organisation: E2E Fixture Organisation, Company\./);
      expect(await toasts(page).count()).toBe(0);
      await page.clock.fastForward('59:52');
      await expect(chip(page)).toHaveAccessibleName('Organisation: All organisations, Platform view. Switch organisation');
      await expect(toasts(page).filter({ hasText: PLATFORM_BACK })).toHaveCount(1);
      await page.waitForTimeout(750);
      expect(await toasts(page).count(), 'one notice, nothing else').toBe(1);
      expect(jwtClaims(await tokenOf(page)).organisationid ?? null).toBeNull();
    } finally {
      await page.close();
    }
  });
});
