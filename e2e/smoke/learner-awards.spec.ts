import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { API_URL, BASE_URL } from '../fixtures/env';

/**
 * A learner's level awards, in a browser, with every answer from the API mocked (none is real, so it runs against any build served on
 * E2E_BASE_URL; E2E_ACCESS_KEYS is "algKey,payloadKey,hashKey" as in notice-placement.spec.ts). Any other host is refused.
 *
 *  - the learner page's "Awards" section: newest first, the "Approx." tag, a missing name shown as a dash, the empty state, the
 *    error state (never an empty list), and nothing at all for a role without the report permission;
 *  - the Reports hub entry and the per-learner Awards report: gated the same way, the offline route by default and the online
 *    route for the online variant, with the Grade column.
 *
 * The answers are what central answers (edtech-lms-api src/modules/report/report.controller.ts, getStudentAwards): { error, data:
 * { data: rows, total, student, pageindex, pagesize } }, rows { studentawardid, levelid, levelname, levelorder, gradeid, gradename,
 * curid, curriculumname, earnedat, earnedat_approximate }. Names are Khmer where they are a person's, a school's or a level's.
 */
const ACCESS_KEYS = (process.env.E2E_ACCESS_KEYS ?? 'lms_access_alg,lms_access_payload,lms_access_hash').split(',');
const ADMIN_ROLE = 'zr5ER4QD';
const OFFLINE = 'report/student-awards';
const ONLINE = 'report/online/student-awards';
const STUDENT = 'stu-1';

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
function sessionToken(permissions: string[]): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ lmsuserid: 'staff-1', lmsuserrole: ADMIN_ROLE, firstname: 'Test', lastname: 'Admin', permissions, isplatform: false, organisationid: 'org-1', exp, iat: exp - 10 })}.c2ln`;
}
const json = (status: number, body: unknown) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

const award = (n: number, over: Record<string, unknown> = {}) => ({
  studentawardid: `aw-${n}`,
  levelid: `lv-${n}`,
  levelname: `ម៉ូឌុល ${n}`,
  levelorder: n,
  gradeid: 'gr-1',
  gradename: 'ថ្នាក់ទី ១',
  curid: 'cur-1',
  curriculumname: 'Sustainable Design',
  earnedat: '2026-09-12T12:00:00.000Z',
  earnedat_approximate: false,
  ...over,
});
/** Out of order on purpose: the page sorts, it does not trust the order. The third (the oldest) has an approximate date. */
const THREE = [
  award(1, { earnedat: '2026-09-12T12:00:00.000Z', earnedat_approximate: true }),
  award(3, { earnedat: '2026-10-03T12:00:00.000Z' }),
  award(2, { earnedat: '2026-09-28T12:00:00.000Z', curriculumname: 'Workplace Skills' }),
];
const answer = (rows: unknown[]) => json(200, { error: false, data: { data: rows, total: rows.length, student: { studentfirstname: 'សុខា', curriculum: { curriculumid: 'cur-1' } }, pageindex: 1, pagesize: 200 } });

interface Call {
  path: string;
  body: any;
}
interface Mock {
  calls: Call[];
  /** What the awards routes answer; set per test. */
  awards: (call: Call) => ReturnType<typeof json>;
}

async function open(context: BrowserContext, permissions: string[], mock: Mock): Promise<void> {
  await context.addInitScript(
    ({ keys, token }) => {
      const [alg, payload, hash] = token.split('.');
      if (!sessionStorage.getItem(keys[0])) {
        sessionStorage.setItem(keys[0], alg);
        sessionStorage.setItem(keys[1], payload);
        sessionStorage.setItem(keys[2], hash);
      }
    },
    { keys: ACCESS_KEYS, token: sessionToken(permissions) },
  );
  await context.route(
    (url) => url.origin !== new URL(BASE_URL).origin && url.origin !== new URL(API_URL).origin,
    (route) => route.abort(),
  );
  await context.route(`${API_URL}/**`, async (route: Route) => {
    const request = route.request();
    const path = decodeURIComponent(new URL(request.url()).pathname).replace(/^\//, '');
    const method = request.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204 });
    if (method === 'POST' && (path === OFFLINE || path === ONLINE)) {
      const call = { path, body: request.postDataJSON() };
      mock.calls.push(call);
      return route.fulfill(mock.awards(call));
    }
    if (method === 'GET' && path === `student/${STUDENT}`) {
      return route.fulfill(
        json(200, {
          data: {
            studentid: STUDENT,
            studentfirstname: 'សុខា',
            studentlastname: 'ចាន់',
            curriculumid: 'cur-1',
            curriculum: { curriculumname: 'Sustainable Design' },
            schooluser: { schoolusername: 'sokha.chan', isdisabled: false },
          },
        }),
      );
    }
    if (method === 'GET' && path === 'country/all') return route.fulfill(json(200, { data: [{ countryid: 'c-1', countryname: 'Testland' }] }));
    if (method === 'GET' && path === 'school/all') return route.fulfill(json(200, { data: [{ schoolname: 'សាលាសាកល្បង' }] }));
    if (method === 'GET' && path === 'student/all') {
      return route.fulfill(json(200, { data: [{ studentid: STUDENT, schooluser: { schoolusername: 'sokha.chan' } }] }));
    }
    return route.fulfill(json(200, { data: [] }));
  });
}

const newMock = (awards: Mock['awards']): Mock => ({ calls: [], awards });

async function learnerPage(context: BrowserContext, permissions: string[], mock: Mock): Promise<Page> {
  await open(context, permissions, mock);
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/student/stats/${STUDENT}`);
  // the page is drawn once the learner's details are (the permission directive has run by then)
  await expect(page.getByText('Student Information')).toBeVisible();
  await expect(page.getByText('sokha.chan').first()).toBeVisible();
  return page;
}

/** A pause: whatever a request that was never going to be made would have caused has happened. */
const fence = (page: Page) => page.evaluate(() => new Promise<void>((done) => setTimeout(done, 600)));

test.describe('the learner page: Awards', () => {
  test('a. lists the awards newest first, with the Approx. tag on the one whose date is approximate', async ({ context }) => {
    const mock = newMock(() => answer(THREE));
    const page = await learnerPage(context, ['view_offline_report'], mock);
    const section = page.getByTestId('learner-awards');
    await expect(section.getByRole('heading', { name: 'Awards' })).toBeVisible();
    await expect(section.getByTestId('award-level')).toHaveText(['ម៉ូឌុល 3', 'ម៉ូឌុល 2', 'ម៉ូឌុល 1']);
    await expect(section.getByTestId('award-curriculum')).toHaveText(['Sustainable Design', 'Workplace Skills', 'Sustainable Design']);
    await expect(section.getByTestId('awards-summary')).toHaveText('3 earned · 1 with an approximate date');
    await expect(section.getByTestId('award-earned')).toHaveText(['3 Oct 2026', '28 Sep 2026', 'by 12 Sep 2026 Approx.']);
    const tag = section.getByTestId('award-approx');
    await expect(tag, 'one tag, on the oldest row').toHaveCount(1);
    await expect(section.getByTestId('award-row').nth(2).getByTestId('award-approx')).toHaveText('Approx.');
    await expect(tag).toHaveAttribute('aria-label', 'Approx. The exact date was not recorded');
    await tag.hover();
    await expect(page.locator('.ant-tooltip-inner')).toHaveText('The exact date was not recorded');
    // it asked central's offline route for this learner, once
    expect(mock.calls.map((c) => c.path)).toEqual([OFFLINE]);
    expect(mock.calls[0].body.filter).toEqual([{ key: 'studentid', value: STUDENT }]);
  });

  test('b. a level or curriculum with no readable name is shown as a dash', async ({ context }) => {
    const mock = newMock(() => answer([award(1, { levelname: null, curriculumname: null, gradename: null })]));
    const page = await learnerPage(context, ['view_offline_report'], mock);
    const section = page.getByTestId('learner-awards');
    await expect(section.getByTestId('award-level')).toHaveText('—');
    await expect(section.getByTestId('award-curriculum')).toHaveText('—');
    await expect(section.getByTestId('awards-summary')).toHaveText('1 earned');
    await expect(section.getByTestId('award-approx')).toHaveCount(0);
  });

  test('c. no awards: says so, with no table', async ({ context }) => {
    const mock = newMock(() => answer([]));
    const page = await learnerPage(context, ['view_offline_report'], mock);
    const section = page.getByTestId('learner-awards');
    await expect(section.getByTestId('awards-empty')).toHaveText('No awards yet.');
    await expect(section.getByTestId('awards-table')).toHaveCount(0);
    await expect(section.getByTestId('awards-error')).toHaveCount(0);
  });

  test('d. a role without the report permission sees no Awards section and the page asks for none', async ({ context }) => {
    const mock = newMock(() => answer(THREE));
    const page = await learnerPage(context, ['view_student'], mock);
    await fence(page);
    await expect(page.getByTestId('learner-awards')).toHaveCount(0);
    expect(mock.calls, 'no request for awards').toEqual([]);
  });

  test('f. an error from the API is the error state, not an empty list, and not a second message', async ({ context }) => {
    const mock = newMock(() => json(500, { error: true, errormessage: 'Something went wrong' }));
    const page = await learnerPage(context, ['view_offline_report'], mock);
    const section = page.getByTestId('learner-awards');
    await expect(section.getByTestId('awards-error')).toHaveText('Awards could not be loaded. Try again in a moment.');
    await expect(section.getByTestId('awards-empty')).toHaveCount(0);
    await expect(section.getByTestId('awards-table')).toHaveCount(0);
    await fence(page);
    expect(await page.locator('.ant-notification-notice').count(), 'the page says it once; the interceptor stays quiet').toBe(0);
  });
});

test.describe('the Reports hub and the Awards report', () => {
  test('d. the hub offers Awards only to a role with the report permission', async ({ context }) => {
    const mock = newMock(() => answer(THREE));
    await open(context, ['view_current_level'], mock);
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/report');
    await expect(page.getByRole('link', { name: 'Current level' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Awards/ }), 'no Awards entry').toHaveCount(0);
  });

  test('the hub entry says what the report is, for each variant the role may open', async ({ context }) => {
    const mock = newMock(() => answer(THREE));
    await open(context, ['view_offline_report'], mock);
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/report');
    const entry = page.getByRole('link', { name: /Awards/ });
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText('Which learners have earned which module awards, and when');
    await expect(entry).toHaveAttribute('href', '/report/student-awards');
  });

  /** Pick the learner the way a person does: country, school, learner. */
  async function pickLearner(page: Page): Promise<void> {
    for (const [id, option] of [['awards-country', 'Testland'], ['awards-school', 'សាលាសាកល្បង'], ['awards-student', 'sokha.chan']] as const) {
      await page.getByTestId(id).click();
      await page.locator('.ant-select-item-option', { hasText: option }).click();
    }
  }

  test('e. the report asks the offline route by default and lists the awards with their grade', async ({ context }) => {
    const mock = newMock(() => answer(THREE));
    await open(context, ['view_offline_report', 'view_online_report'], mock);
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/report/student-awards');
    await pickLearner(page);
    await page.getByTestId('awards-search').click();
    await expect(page.getByTestId('award-level')).toHaveText(['ម៉ូឌុល 3', 'ម៉ូឌុល 2', 'ម៉ូឌុល 1']);
    await expect(page.getByTestId('award-grade')).toHaveText(['ថ្នាក់ទី ១', 'ថ្នាក់ទី ១', 'ថ្នាក់ទី ១']);
    await expect(page.getByTestId('award-approx')).toHaveCount(1);
    expect(mock.calls.map((c) => c.path)).toEqual([OFFLINE]);
    expect(mock.calls[0].body.filter).toEqual([{ key: 'studentid', value: STUDENT }]);
  });

  test('e. the online variant, opened from the hub, asks the online route', async ({ context }) => {
    const mock = newMock(() => answer(THREE));
    await open(context, ['view_offline_report', 'view_online_report'], mock);
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/report');
    const entries = page.getByRole('link', { name: /Awards/ });
    await expect(entries, 'one entry for each variant').toHaveCount(2);
    await entries.nth(1).click();
    await expect(page).toHaveURL(/\/report\/student-awards\/online\?online=true$/);
    await pickLearner(page);
    await page.getByTestId('awards-search').click();
    await expect(page.getByTestId('award-level')).toHaveCount(3);
    expect(mock.calls.map((c) => c.path)).toEqual([ONLINE]);
  });

  test('f. an error from the API is the error state on the report too', async ({ context }) => {
    const mock = newMock(() => json(502, { error: true, errormessage: 'The student server refused this server\'s request.' }));
    await open(context, ['view_offline_report'], mock);
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/report/student-awards');
    await pickLearner(page);
    await page.getByTestId('awards-search').click();
    await expect(page.getByTestId('awards-report-error')).toHaveText('Awards could not be loaded. Try again in a moment.');
    await expect(page.getByTestId('awards-report-empty')).toHaveCount(0);
    await expect(page.getByTestId('awards-table')).toHaveCount(0);
  });
});
