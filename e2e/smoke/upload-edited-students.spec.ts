import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { API_URL, BASE_URL } from '../fixtures/env';

/**
 * Upload Edited Students on the Learners list, in a browser, with every answer from the API mocked (as edit-learner.spec.ts
 * does): a file with the `grade` column the download now has reaches PUT student/update with `grade` intact, and a file saved
 * before the column existed still uploads. Nothing leaves the machine: any other host is refused.
 *
 * Run it against a build served on E2E_BASE_URL; the session keys and the API host are those of that build's environment file.
 */
const ACCESS_KEYS = (process.env.E2E_ACCESS_KEYS ?? 'lms_access_alg,lms_access_payload,lms_access_hash').split(',');
const PERMISSIONS = ['view_student', 'update_student', 'view_school'];
const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
function sessionToken(): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ lmsuserid: 'staff-1', lmsuserrole: 'zr5ER4QD', firstname: 'Test', lastname: 'Admin', permissions: PERMISSIONS, isplatform: false, organisationid: 'org-1', exp, iat: exp - 10 })}.c2ln`;
}
const json = (status: number, body: unknown) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function open(context: BrowserContext, puts: unknown[]): Promise<Page> {
  await context.addInitScript(
    ({ keys, token }) => {
      const [alg, payload, hash] = token.split('.');
      sessionStorage.setItem(keys[0], alg);
      sessionStorage.setItem(keys[1], payload);
      sessionStorage.setItem(keys[2], hash);
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
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    if (request.method() === 'PUT' && path === 'student/update') {
      puts.push(request.postDataJSON());
      return route.fulfill(json(200, { data: 'ok' }));
    }
    if (request.method() === 'POST' && path === 'student') return route.fulfill(json(200, { data: { data: [], total: 0 } }));
    return route.fulfill(json(200, { data: [] }));
  });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/student/index');
  await page.getByRole('tab', { name: 'Edit Student Tab' }).click();
  await expect(page.locator('button', { hasText: 'Upload Edited Students' })).toBeVisible();
  return page;
}

async function upload(page: Page, csv: string): Promise<void> {
  await page.locator('input[type=file]').last().setInputFiles({ name: 'edited.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
}

/** One row with the columns Joi requires (the API's download writes them all); `grade` is added only when a value is given. */
const ROW: Record<string, string> = {
  studentid: '11111111-1111-4111-8111-111111111111',
  schooluserid: '22222222-2222-4222-8222-222222222222',
  studentfirstname: 'Dara',
  studentlastname: 'Rivers',
  genderid: '1',
  city: 'Phnom Penh',
  country: 'Cambodia',
  state: 'Phnom Penh',
  schoolusername: 'dara1',
  dateofjoin: '01-01-2024',
  isactive: '1',
  curriculums: 'cur-1',
};
function csvOf(extra: Record<string, string> = {}): string {
  const row = { ...ROW, ...extra };
  return `${Object.keys(row).join(',')}\n${Object.values(row).join(',')}\n`;
}

test.describe('Upload Edited Students: the grade column', () => {
  test('a file with a grade column reaches PUT student/update with the grade intact', async ({ context }) => {
    const puts: any[] = [];
    const page = await open(context, puts);
    await upload(page, csvOf({ grade: 'Grade 2' }));
    await expect.poll(() => puts.length).toBe(1);
    expect(puts[0].students).toHaveLength(1);
    expect(puts[0].students[0]).toMatchObject({ schoolusername: 'dara1', curriculums: 'cur-1', grade: 'Grade 2' });
  });

  test('a blank grade is sent blank (the API keeps the learner\'s grade)', async ({ context }) => {
    const puts: any[] = [];
    const page = await open(context, puts);
    await upload(page, csvOf({ grade: '' }));
    await expect.poll(() => puts.length).toBe(1);
    expect(puts[0].students[0].grade).toBe('');
  });

  test('a file saved before the column existed still uploads, with no grade key', async ({ context }) => {
    const puts: any[] = [];
    const page = await open(context, puts);
    await upload(page, csvOf());
    await expect.poll(() => puts.length).toBe(1);
    expect(puts[0].students[0]).toMatchObject({ schoolusername: 'dara1' });
    expect('grade' in puts[0].students[0]).toBe(false);
  });
});
