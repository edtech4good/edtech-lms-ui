import { APIRequestContext, Page, expect, test } from '@playwright/test';
import { ROLE } from '../fixtures/accounts';
import { apiContext, jwtClaims, loginViaUi } from '../fixtures/auth';
import { skipUnlessLocalApi } from '../fixtures/local-only';
import { fixtureOrganisationId } from '../fixtures/organisation';

/**
 * Who is offered Sync Students (school list) and Sync Content (curriculum list), in a browser, per role, against the real
 * API (decided 31 Oct 2026, edtech-lms-ui#148, option A): the platform account, an Admin and an Organisation Admin are
 * offered both; a Teacher is offered neither. What each button sends, and that it is only ever the caller's own
 * organisation, is proved against the API (edtech-lms-api src/modules/sync/sync-scope.leak.spec.ts); these specs press no
 * button. The permission arrays are pinned in sync-buttons-logic.spec.ts.
 *
 * It makes staff accounts (with a password written in this public repository) and a school, so it runs only against a
 * local API. Teardown disables the accounts and deletes the school, and checks both.
 */
skipUnlessLocalApi('creates staff accounts and a school');

const RUN = `e2e${Math.random().toString(36).slice(2, 8)}`;
const PASSWORD = 'Staff_Pass1';
const SCHOOL = `Sync buttons school ${RUN}`;
const WHO = {
  organisationAdmin: { name: `e2e-sync-oa-${RUN}@example.com`, roles: [ROLE.organisationadmin] },
  admin: { name: `e2e-sync-admin-${RUN}@example.com`, roles: [ROLE.admin] },
  teacher: { name: `e2e-sync-teacher-${RUN}@example.com`, roles: [ROLE.user, ROLE.teacher] },
} as const;
type Kind = keyof typeof WHO;

let sa: APIRequestContext;
let saPage: Page;
let schoolId = '';
const userIds: Partial<Record<Kind, string>> = {};

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

/** The two buttons on the lists the signed-in page can open: how many Sync Students (in our school's row) and Sync Content there are. */
async function offered(p: Page): Promise<{ students: number; content: number }> {
  await p.goto('/school/index');
  await expect(p.getByRole('columnheader', { name: 'Tools' })).toBeVisible();
  const row = p.locator('tr', { hasText: SCHOOL });
  await expect(row, 'our school is on the list').toHaveCount(1);
  // The buttons are drawn by the permission directive, so a count taken before the permissions are applied would read 0 for
  // everyone. The menu's People group is drawn by the same directive (`*ngxPermissionsOnly` on `view_school` and the others,
  // shell-nav.component.html:36), and all four roles here hold view_school: once it is there the permissions are applied,
  // and a button that is going to appear has appeared. (Not the Home group, `.tone-home`: it is drawn on every render.)
  await expect(p.locator('app-shell-nav .group.tone-people'), 'the People group (drawn from the permissions) is there').toBeVisible();
  await expect(row.locator('td').last()).toBeVisible();
  const students = await row.getByTestId('sync-students').count();
  await p.goto('/curriculum/index');
  await expect(p.getByRole('columnheader', { name: 'Tools' })).toBeVisible();
  // the Content group is drawn by the same directive (`view_curriculum`, held by all four roles)
  await expect(p.locator('app-shell-nav .group.tone-content'), 'the Content group (drawn from the permissions) is there').toBeVisible();
  const content = await p.getByTestId('sync-content').count();
  return { students, content };
}

test.beforeAll(async ({ browser }) => {
  saPage = await browser.newPage();
  await loginViaUi(saPage);
  sa = await apiContext(await tokenOf(saPage));
  const orgId = await fixtureOrganisationId(sa);
  for (const kind of Object.keys(WHO) as Kind[]) {
    const made = await created(
      await sa.post('/user/create', {
        data: { lmsusername: WHO[kind].name, lmsuserpasswordhash: PASSWORD, lmsuserroles: WHO[kind].roles, organisationid: orgId, countryids: [], schoolids: [] },
      }),
      `the ${kind}`,
    );
    userIds[kind] = made.lmsuserid;
  }
  const country = (await (await sa.get('/country/all?country=')).json()).data[0]?.countryid;
  expect(country, 'the local database has a country').toBeTruthy();
  const school = await created(await sa.post('/school/create', { data: { schoolname: SCHOOL, countryid: country, curriculums: [], organisationid: orgId } }), 'the school');
  schoolId = school?.schoolid ?? '';
  if (!schoolId) {
    const list = await (await sa.post('/school', { data: { pagesize: 10, pageindex: 1, filter: [{ key: 'schoolname', value: SCHOOL }] } })).json();
    schoolId = list.data.data.find((s: any) => s.schoolname === SCHOOL)?.schoolid ?? '';
  }
  expect(schoolId, 'the school has an id').toBeTruthy();
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
  if (schoolId) {
    await step('delete the school', () => sa.delete(`/school/${schoolId}`));
    const again = await sa.get(`/school/${schoolId}`);
    const body: any = await again.json().catch(() => ({}));
    if (again.ok() && body?.data && body.data.isdeleted !== true) problems.push('the school still answers GET /school/:id');
  }
  for (const kind of Object.keys(userIds) as Kind[]) await step(`disable the ${kind}`, () => sa.delete(`/user/${userIds[kind]}`));
  await sa?.dispose();
  await saPage?.close();
  // Never swallowed: an account left enabled has a password anyone can read here.
  if (problems.length) throw new Error(`cleanup left things behind: ${problems.join('; ')}`);
});

test.describe('the sync buttons, per role', () => {
  test('the platform superadmin is offered both', async () => {
    expect(await offered(saPage)).toEqual({ students: 1, content: 1 });
  });

  for (const [kind, expected] of [
    ['organisationAdmin', { students: 1, content: 1 }],
    ['admin', { students: 1, content: 1 }],
    ['teacher', { students: 0, content: 0 }],
  ] as const) {
    test(`${kind}: ${expected.students ? 'is offered both' : 'is offered neither'}, and the token says why`, async ({ browser }) => {
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      try {
        await loginViaUi(p, WHO[kind].name, PASSWORD);
        const permissions = (jwtClaims(await tokenOf(p)).permissions ?? []) as string[];
        const holds = (name: string) => permissions.includes('superadmin') || permissions.includes(name);
        expect({ sync_students: holds('sync_students'), sync_content: holds('sync_content') }).toEqual({ sync_students: expected.students === 1, sync_content: expected.content === 1 });
        expect(await offered(p)).toEqual(expected);
      } finally {
        await ctx.close();
      }
    });
  }
});
