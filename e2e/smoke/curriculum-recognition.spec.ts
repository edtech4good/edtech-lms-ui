import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { API_URL, BASE_URL } from '../fixtures/env';

/**
 * The curriculum form's Recognition section, in a browser, with every answer from the API mocked (none is real, so it runs
 * against any build served on E2E_BASE_URL; E2E_ACCESS_KEYS is "algKey,payloadKey,hashKey" as in notice-placement.spec.ts). Any
 * other host is refused. The rules themselves are unit-tested in curriculum-recognition-logic.spec.ts.
 *
 *  a. edit shows the stored values; changing Level to Certificate sends levelrecognition 'certificate' (only that tier) and shows the extra line;
 *  b. the Grade and Curriculum selects never offer Award;
 *  c. add preselects the organisation preset's defaults (company: award / none / certificate; a school network: award / certificate / none),
 *     and sends them; with no organisation to read, it shows "Organisation default" and sends none;
 *  d. a 400 on graderecognition (central's real body) shows beside the Grade select and the form stays.
 *
 * The answers are what central answers (edtech-lms-api curriculum.controller.ts and curriculum-recognition.spec.ts): the
 * organisation read `GET organisation/mine` is { data: { organisationpreset, ... } }, a 400 is { error, code: 'INVALID_INPUT',
 * errormessage, hint, fields: [{ field, message }] }.
 */
const ACCESS_KEYS = (process.env.E2E_ACCESS_KEYS ?? 'lms_access_alg,lms_access_payload,lms_access_hash').split(',');
const PERMISSIONS = ['view_curriculum', 'create_curriculum', 'update_curriculum'];
const CUR = 'cur-1';
const GRADE_REFUSED = 'Graderecognition must be one of the allowed values.';

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
function sessionToken(): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ lmsuserid: 'staff-1', lmsuserrole: 'zr5ER4QD', firstname: 'Test', lastname: 'Admin', permissions: PERMISSIONS, isplatform: false, organisationid: 'org-1', exp, iat: exp - 10 })}.c2ln`;
}
const json = (status: number, body: unknown) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

interface Call {
  method: string;
  path: string;
  body: any;
}
interface Mock {
  calls: Call[];
  /** What GET organisation/mine answers: a preset, or null (a platform account acting in none). */
  preset: string | null;
  /** What the curriculum read carries besides its name. */
  stored: Record<string, unknown>;
  /** What the save (POST create / PUT :id) answers. */
  save: (call: Call) => ReturnType<typeof json>;
}
const newMock = (over: Partial<Mock> = {}): Mock => ({
  calls: [],
  preset: 'schoolnetwork',
  stored: { levelrecognition: 'award', graderecognition: 'certificate', curriculumrecognition: 'none' },
  save: () => json(200, { error: false, data: true }),
  ...over,
});

async function open(context: BrowserContext, mock: Mock): Promise<void> {
  await context.addInitScript(
    ({ keys, token }) => {
      const [alg, payload, hash] = token.split('.');
      if (!sessionStorage.getItem(keys[0])) {
        sessionStorage.setItem(keys[0], alg);
        sessionStorage.setItem(keys[1], payload);
        sessionStorage.setItem(keys[2], hash);
      }
    },
    { keys: ACCESS_KEYS, token: sessionToken() },
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
    if (path === 'curriculum/create' || (method === 'PUT' && path === `curriculum/${CUR}`)) {
      const call = { method, path, body: request.postDataJSON() };
      mock.calls.push(call);
      return route.fulfill(mock.save(call));
    }
    if (method === 'GET' && path === 'organisation/mine') {
      return route.fulfill(json(200, { error: false, data: mock.preset ? { organisationid: 'org-1', organisationname: 'Test Org', organisationpreset: mock.preset } : null }));
    }
    if (method === 'GET' && path === `curriculum/${CUR}`) {
      return route.fulfill(
        json(200, {
          error: false,
          data: { curriculumid: CUR, curriculumname: 'Sustainable Design', curriculumdescription: 'About design', countryid: ['c-1'], subjectid: 's-1', organisationid: 'org-1', ...mock.stored },
        }),
      );
    }
    if (method === 'POST' && path === 'country') return route.fulfill(json(200, { data: { data: [{ countryid: 'c-1', countryname: 'Testland' }] } }));
    if (method === 'POST' && path === 'subject') return route.fulfill(json(200, { data: { data: [{ subjectid: 's-1', subjectname: 'Design' }] } }));
    if (method === 'GET' && path === `curriculum/publication/${CUR}`) {
      return route.fulfill(json(200, { data: { curriculumid: CUR, publicationid: null, publicationstatus: 'never', publishedat: null, changedsincepublish: false, problem: null, pending: null, latest: null, translationcoverage: null } }));
    }
    return route.fulfill(json(200, { data: [] }));
  });
}

async function openPage(context: BrowserContext, mock: Mock, url: string): Promise<Page> {
  await open(context, mock);
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(url);
  await expect(page.getByTestId('recognition-section')).toBeVisible();
  return page;
}

/** The text a select shows as its value (or its placeholder when none is chosen). */
const shown = (page: Page, field: string) => page.getByTestId(`recognition-${field}`).locator('nz-select-item, nz-select-placeholder');

/** Opens a select and lists the options it offers. */
async function offered(page: Page, field: string): Promise<string[]> {
  await page.getByTestId(`recognition-${field}`).click();
  const options = page.locator('.ant-select-dropdown:visible .ant-select-item-option');
  await expect(options.first()).toBeVisible();
  const texts = await options.allTextContents();
  await page.keyboard.press('Escape');
  return texts.map((t) => t.trim());
}

async function choose(page: Page, field: string, label: string): Promise<void> {
  await page.getByTestId(`recognition-${field}`).click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option', { hasText: label }).click();
}

/** Country and Subject on the add form. */
async function chooseOther(page: Page, control: string, label: string): Promise<void> {
  await page.locator(`nz-select[formcontrolname="${control}"]`).click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option', { hasText: label }).click();
  if (control === 'countryid') await page.keyboard.press('Escape'); // a multi-select stays open
}

/** A pause: whatever a request that was never going to be made would have caused has happened. */
const fence = (page: Page) => page.evaluate(() => new Promise<void>((done) => setTimeout(done, 600)));

test.describe('edit', () => {
  test('a. shows the stored values; Level to Certificate sends only that tier and shows the extra line', async ({ context }) => {
    const mock = newMock({ stored: { levelrecognition: 'award', graderecognition: 'none', curriculumrecognition: 'certificate' } });
    const page = await openPage(context, mock, `/curriculum/update/${CUR}`);
    await expect(shown(page, 'levelrecognition')).toHaveText('Award');
    await expect(shown(page, 'graderecognition')).toHaveText('Nothing');
    await expect(shown(page, 'curriculumrecognition')).toHaveText('Certificate (not issued yet)');
    await expect(page.getByTestId('recognition-level-certificate')).toHaveCount(0);
    await expect(page.getByTestId('recognition-help')).toHaveText('Learners see a change after this curriculum is published again.');
    await expect(page.getByTestId('recognition-help-awards')).toHaveText('Switching awards off keeps the awards learners already earned.');

    await choose(page, 'levelrecognition', 'Certificate');
    await expect(shown(page, 'levelrecognition')).toHaveText('Certificate (not issued yet)');
    await expect(page.getByTestId('recognition-level-certificate')).toHaveText('No awards are given for this level, and certificates are not issued yet.');

    await page.getByRole('button', { name: 'Submit' }).click();
    await expect.poll(() => mock.calls.length).toBe(1);
    expect(mock.calls[0].method).toBe('PUT');
    expect(mock.calls[0].body).toEqual({
      curriculumname: 'Sustainable Design',
      curriculumdescription: 'About design',
      countryid: ['c-1'],
      subjectid: 's-1',
      levelrecognition: 'certificate',
    });
  });

  test('an untouched edit sends no recognition at all', async ({ context }) => {
    const mock = newMock();
    const page = await openPage(context, mock, `/curriculum/update/${CUR}`);
    await expect(shown(page, 'graderecognition')).toHaveText('Certificate (not issued yet)');
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect.poll(() => mock.calls.length).toBe(1);
    expect(Object.keys(mock.calls[0].body).sort()).toEqual(['countryid', 'curriculumdescription', 'curriculumname', 'subjectid']);
  });

  test('b. Level offers Nothing, Award, Certificate; Grade and Curriculum never offer Award', async ({ context }) => {
    const page = await openPage(context, newMock(), `/curriculum/update/${CUR}`);
    await expect(shown(page, 'levelrecognition')).toHaveText('Award');
    expect(await offered(page, 'levelrecognition')).toEqual(['Nothing', 'Award', 'Certificate (not issued yet)']);
    expect(await offered(page, 'graderecognition')).toEqual(['Nothing', 'Certificate (not issued yet)']);
    expect(await offered(page, 'curriculumrecognition')).toEqual(['Nothing', 'Certificate (not issued yet)']);
  });

  test('d. a 400 on graderecognition shows beside the Grade select, once, and the form stays', async ({ context }) => {
    const body = {
      error: true, data: false, code: 'INVALID_INPUT', errormessage: "Some of the information isn't valid.", hint: 'Check the highlighted fields.',
      fields: [{ field: 'graderecognition', message: GRADE_REFUSED }],
    };
    const mock = newMock({ save: () => json(400, body) });
    const page = await openPage(context, mock, `/curriculum/update/${CUR}`);
    await choose(page, 'graderecognition', 'Nothing');
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByTestId('recognition-error-graderecognition')).toHaveText(GRADE_REFUSED);
    await expect(page.getByTestId('recognition-error-levelrecognition')).toHaveCount(0);
    await expect(page.getByTestId('recognition-error-curriculumrecognition')).toHaveCount(0);
    expect(new URL(page.url()).pathname, 'still on the edit form').toBe(`/curriculum/update/${CUR}`);
    await fence(page);
    expect(await page.locator('.ant-notification-notice').count(), 'a validation failure is not a toast').toBe(0);
    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0].body.graderecognition).toBe('none');
  });
});

test.describe('add', () => {
  test('c. under a company organisation the selects start at award / none / certificate, and those are sent', async ({ context }) => {
    const mock = newMock({ preset: 'company' });
    const page = await openPage(context, mock, '/curriculum/create');
    await expect(shown(page, 'levelrecognition')).toHaveText('Award');
    await expect(shown(page, 'graderecognition')).toHaveText('Nothing');
    await expect(shown(page, 'curriculumrecognition')).toHaveText('Certificate (not issued yet)');
    await page.getByPlaceholder('Enter curriculum name').fill('Workplace Skills');
    await chooseOther(page, 'countryid', 'Testland');
    await chooseOther(page, 'subjectid', 'Design');
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect.poll(() => mock.calls.length).toBe(1);
    expect(mock.calls[0].path).toBe('curriculum/create');
    expect(mock.calls[0].body).toMatchObject({ levelrecognition: 'award', graderecognition: 'none', curriculumrecognition: 'certificate' });
  });

  test('c. under a school network the selects start at award / certificate / none', async ({ context }) => {
    const page = await openPage(context, newMock({ preset: 'schoolnetwork' }), '/curriculum/create');
    await expect(shown(page, 'levelrecognition')).toHaveText('Award');
    await expect(shown(page, 'graderecognition')).toHaveText('Certificate (not issued yet)');
    await expect(shown(page, 'curriculumrecognition')).toHaveText('Nothing');
  });

  test('with no organisation to read, the selects say Organisation default and nothing is sent', async ({ context }) => {
    const mock = newMock({ preset: null });
    const page = await openPage(context, mock, '/curriculum/create');
    for (const field of ['levelrecognition', 'graderecognition', 'curriculumrecognition']) {
      await expect(page.getByTestId(`recognition-${field}`).locator('nz-select-placeholder')).toHaveText('Organisation default');
    }
    await page.getByPlaceholder('Enter curriculum name').fill('Workplace Skills');
    await chooseOther(page, 'countryid', 'Testland');
    await chooseOther(page, 'subjectid', 'Design');
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect.poll(() => mock.calls.length).toBe(1);
    expect(Object.keys(mock.calls[0].body).sort()).toEqual(['countryid', 'curriculumdescription', 'curriculumname', 'subjectid']);
  });
});
