import { BrowserContext, Page, Route, expect, test } from '@playwright/test';
import { API_URL, BASE_URL } from '../fixtures/env';
import { MockGrade, grade, gradesAnswer } from '../fixtures/grades';

/**
 * Upload Users on the Learners list, in a browser, with every answer from the API mocked (as edit-learner.spec.ts does):
 * the modal's Grade field and what POST student/create is sent. Nothing leaves the machine: any other host is refused.
 *
 * Run it against a build served on E2E_BASE_URL; the session keys and the API host are those of that build's environment file.
 */
const ACCESS_KEYS = (process.env.E2E_ACCESS_KEYS ?? 'lms_access_alg,lms_access_payload,lms_access_hash').split(',');
const PERMISSIONS = ['view_student', 'create_student', 'update_student', 'view_school'];
const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
function sessionToken(): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ lmsuserid: 'staff-1', lmsuserrole: 'zr5ER4QD', firstname: 'Test', lastname: 'Admin', permissions: PERMISSIONS, isplatform: false, organisationid: 'org-1', exp, iat: exp - 10 })}.c2ln`;
}
const json = (status: number, body: unknown) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

const CLASSES = [{ standardid: 'class-a1', standardname: 'Class 1A' }];
const CURRICULA = [
  { curriculumid: 'cur-1', curriculumname: 'Reading Basics' },
  { curriculumid: 'cur-2', curriculumname: 'Number Skills' },
];
const MESSAGE = 'Choose a grade for this student.';

interface Mock {
  grades: Record<string, MockGrade[]>;
  creates: any[];
}

async function open(context: BrowserContext, mock: Mock): Promise<Page> {
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
    const method = request.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204 });
    if (method === 'POST' && path === 'student/create') {
      mock.creates.push(request.postDataJSON());
      return route.fulfill(json(200, { data: 'ok' }));
    }
    if (method === 'POST' && path === 'student') return route.fulfill(json(200, { data: { data: [], total: 0 } }));
    if (method === 'POST' && path === 'school') return route.fulfill(json(200, { data: { data: [{ schoolid: 'school-a', schoolname: 'North Valley School' }], total: 1 } }));
    if (method === 'GET' && path === 'standard/school/school-a') return route.fulfill(json(200, { data: CLASSES }));
    if (method === 'GET' && path === 'school/school-a/curriculums') return route.fulfill(json(200, { data: CURRICULA }));
    const gradesOf = /^grade\/curriculum\/(.+)$/.exec(path);
    if (method === 'GET' && gradesOf) return route.fulfill(gradesAnswer(mock.grades, gradesOf[1]));
    return route.fulfill(json(200, { data: [] }));
  });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/student/index');
  await page.getByRole('button', { name: 'Upload Users', exact: true }).click();
  await expect(page.locator('.ant-modal').getByText('Upload Users', { exact: true }).first()).toBeVisible();
  return page;
}

const modal = (page: Page) => page.locator('.ant-modal');
async function pickIn(page: Page, n: number, option: string): Promise<void> {
  await modal(page).locator('nz-select').nth(n).locator('.ant-select-selector').click();
  await page.locator('.ant-select-item-option', { hasText: option }).first().click();
}
async function fillForm(page: Page, curricula: string[]): Promise<void> {
  await pickIn(page, 0, 'North Valley School');
  await modal(page).locator('nz-select').nth(1).locator('.ant-select-selector').click();
  for (const c of curricula) {
    await page.waitForTimeout(400);
    await page.locator('.ant-select-item-option', { hasText: c }).first().click();
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')).toHaveCount(0);
}
async function chooseClass(page: Page): Promise<void> {
  await modal(page).locator('nz-select').last().locator('.ant-select-selector').click();
  await page.locator('.ant-select-item-option', { hasText: 'Class 1A' }).first().click();
}
const ROW: Record<string, string> = {
  studentfirstname: 'Dara',
  studentlastname: 'Rivers',
  genderid: '1',
  city: 'Phnom Penh',
  country: 'Cambodia',
  state: 'Phnom Penh',
  dateofjoin: '01-01-2024',
  schoolusername: 'dara1',
  schooluserpasswordhash: 'riverlamp47',
  type: 'online',
  is_teacher_acc: '0',
};
const CSV = `${Object.keys(ROW).join(',')}\n${Object.values(ROW).join(',')}\n`;
async function upload(page: Page): Promise<void> {
  await page.locator('input[type=file]').last().setInputFiles({ name: 'users.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });
}
const toasts = (page: Page) => page.locator('.ant-notification-notice-description');

test.describe('Upload Users: the grade', () => {
  test('one grade: no select, and the post carries it as the top-level gradeid next to the curricula', async ({ context }) => {
    const mock: Mock = { grades: {}, creates: [] };
    const page = await open(context, mock);
    await fillForm(page, ['Reading Basics']);
    await chooseClass(page);
    await expect(page.getByTestId('grade-fixed')).toHaveText('Grade: Grade 1 (In Reading Basics)');
    await upload(page);
    await expect.poll(() => mock.creates.length).toBe(1);
    expect(mock.creates[0]).toMatchObject({ curriculumid: ['cur-1'], schoolid: 'school-a', standard: 'class-a1', gradeid: 'gr-cur-1-1' });
    expect(mock.creates[0].students).toHaveLength(1);
    expect(Object.keys(mock.creates[0]).sort()).toEqual(['curriculumid', 'gradeid', 'schoolid', 'standard', 'students']);
  });

  test('several grades: with none chosen nothing is posted and the sentence is said; once one is chosen it is posted', async ({ context }) => {
    const mock: Mock = { grades: { 'cur-1': [grade('cur-1', 1), grade('cur-1', 2)] }, creates: [] };
    const page = await open(context, mock);
    await fillForm(page, ['Reading Basics']);
    await chooseClass(page);
    await expect(page.locator('#upload-grade')).toBeVisible();
    await upload(page);
    await expect(toasts(page)).toHaveText(MESSAGE);
    await expect(page.getByTestId('grade-error')).toHaveText(MESSAGE);
    expect(mock.creates, 'nothing is posted without a grade').toEqual([]);
    await page.locator('#upload-grade .ant-select-selector').click();
    await page.locator('.ant-select-item-option', { hasText: 'Grade 2' }).click();
    await upload(page);
    await expect.poll(() => mock.creates.length).toBe(1);
    expect(mock.creates[0].gradeid).toBe('gr-cur-1-2');
  });

  test('the grade is that of the FIRST curriculum chosen', async ({ context }) => {
    const mock: Mock = { grades: { 'cur-1': [grade('cur-1', 1)], 'cur-2': [grade('cur-2', 1, 'Number Grade')] }, creates: [] };
    const page = await open(context, mock);
    await fillForm(page, ['Number Skills', 'Reading Basics']);
    await chooseClass(page);
    await expect(page.getByTestId('grade-fixed')).toHaveText('Grade: Number Grade (In Number Skills)');
    await upload(page);
    await expect.poll(() => mock.creates.length).toBe(1);
    expect(mock.creates[0].curriculumid).toEqual(['cur-2', 'cur-1']);
    expect(mock.creates[0].gradeid).toBe('gr-cur-2-1');
  });
});
