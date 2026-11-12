import { BrowserContext, Page, Request, Route, expect, test } from '@playwright/test';
import { API_URL, BASE_URL } from '../fixtures/env';

/**
 * Certificates, slice 1, in a browser with every answer from the API mocked (none is real, so it runs against any build served on
 * E2E_BASE_URL; E2E_ACCESS_KEYS is "algKey,payloadKey,hashKey" as in learner-awards.spec.ts). Any other host is refused.
 *
 * The answers are what central answers (edtech-lms-api src/modules/certificate, src/business/certificate.business.ts), wrapped
 * { error: false, data }: candidates may carry status cant_check with { reason: 'not_on_learning_server' }; a scope with no quizzes is
 * not_yet with { reason: 'no_quizzes' }; issue's refused list carries not_yet, cant_check, not_found or issued; the learning server
 * being down is a 502 with a plain message. Names are Khmer where they are a person's.
 */
const ACCESS_KEYS = (process.env.E2E_ACCESS_KEYS ?? 'lms_access_alg,lms_access_payload,lms_access_hash').split(',');
const ADMIN_ROLE = 'zr5ER4QD';
const ALL = ['list_certificate', 'create_certificate', 'revoke_certificate'];
const ORIGIN = new URL(BASE_URL).origin;

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
function sessionToken(permissions: string[]): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ lmsuserid: 'staff-1', lmsuserrole: ADMIN_ROLE, firstname: 'Test', lastname: 'Admin', permissions, isplatform: false, organisationid: 'org-1', exp, iat: exp - 10 })}.c2ln`;
}
const json = (status: number, body: unknown) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const ok = (data: unknown) => json(200, { error: false, data });

// ---- fixtures ------------------------------------------------------------------
const CUR_ALL = { curriculumid: 'cur-all', curriculumname: 'Digital Skills for Small Business', levelrecognition: 'certificate', graderecognition: 'certificate', curriculumrecognition: 'certificate' };
const CUR_GRADE = { curriculumid: 'cur-grade', curriculumname: 'Grade Maths', levelrecognition: 'award', graderecognition: 'certificate', curriculumrecognition: 'none' };
const CUR_NONE = { curriculumid: 'cur-none', curriculumname: 'Awards Only', levelrecognition: 'award', graderecognition: 'none', curriculumrecognition: 'none' };
const TREE = [{ curriculumid: 'cur-all', grades: [{ gradeid: 'gr-1', gradename: 'Grade 1', levels: [{ levelid: 'lv-1', levelname: 'Module 1' }, { levelid: 'lv-2', levelname: 'Module 2' }] }] }];

const quiz = (state: string, best: number | null, kind = 'level', name = 'Module 2', lesson?: string) => ({
  quiz: { id: `q-${name}-${kind}`, kind, name: kind === 'level' ? `${name} final` : `${lesson} quiz raw` },
  level: { id: 'lv-2', name },
  ...(lesson ? { lesson: { id: 'ls-1', name: lesson } } : {}),
  state,
  bestpercent: best,
});
const cand = (id: string, name: string, status: string, reasons: unknown[] = [], certificate: unknown = null, classname: string | null = 'Cohort II') => ({
  student: { studentid: id, name, standardid: 'std-1', classname },
  status,
  reasons,
  quizcount: 6,
  passedcount: status === 'ready' || status === 'issued' ? 6 : 3,
  certificate,
});
const CERT_1 = { certificateid: 'cert-1', shortcode: '7F3K-92QD', issuedat: '2026-11-12T05:00:00.000Z' };
const record = (over: Record<string, unknown> = {}, snapshot: Record<string, unknown> = {}) => ({
  certificateid: 'cert-1',
  shortcode: '7F3K-92QD',
  organisationid: 'org-1',
  studentid: 'stu-dara',
  curriculumid: 'cur-all',
  scope: 'curriculum',
  scopeid: 'cur-all',
  standardid: 'std-1',
  issuedat: '2026-11-12T05:00:00.000Z',
  issuedby: 'staff-1',
  revokedat: null,
  revokedby: null,
  revokereason: null,
  snapshot: { learnername: 'សុខា ចាន់', curriculumname: 'Digital Skills for Small Business', scopename: 'Digital Skills for Small Business', tierlabel: 'Programme', classname: 'Cohort II', organisationname: 'Example Trading Co', schoolname: 'North Valley School', quizcount: 6, ...snapshot },
  ...over,
});

interface Call {
  method: string;
  path: string;
  body: any;
  authorization: string | undefined;
}
interface Mock {
  calls: Call[];
  candidates: (call: Call) => ReturnType<typeof json>;
  issue: (call: Call) => ReturnType<typeof json>;
  revoke: (call: Call) => ReturnType<typeof json>;
  certificate: Record<string, unknown>;
  forStudent: unknown[];
  uitheme: string;
  verify: (code: string) => ReturnType<typeof json>;
}
const newMock = (over: Partial<Mock> = {}): Mock => ({
  calls: [],
  candidates: () => ok([]),
  issue: () => ok({ issued: [], refused: [] }),
  revoke: () => ok(record()),
  certificate: record(),
  forStudent: [],
  uitheme: 'kids',
  verify: () => json(404, { error: true, errormessage: 'That code does not match a certificate.' }),
  ...over,
});
const paths = (mock: Mock, prefix: string) => mock.calls.filter((c) => c.path.startsWith(prefix));

async function open(context: BrowserContext, permissions: string[], mock: Mock, signedIn = true): Promise<void> {
  if (signedIn) {
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
  }
  // window.print is counted, never opened
  await context.addInitScript(() => {
    (window as any).__prints = 0;
    window.print = () => {
      (window as any).__prints += 1;
    };
  });
  await context.route(
    (url) => url.origin !== new URL(BASE_URL).origin && url.origin !== new URL(API_URL).origin,
    (route) => route.abort(),
  );
  await context.route(`${API_URL}/**`, async (route: Route) => {
    const request: Request = route.request();
    const path = decodeURIComponent(new URL(request.url()).pathname).replace(/^\//, '');
    const method = request.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const call: Call = { method, path, body: method === 'POST' ? request.postDataJSON() : null, authorization: (await request.allHeaders())['authorization'] };
    mock.calls.push(call);
    const cors = { 'access-control-allow-origin': '*' };
    const send = (r: ReturnType<typeof json>) => route.fulfill({ ...r, headers: cors });
    if (method === 'POST' && path === 'curriculum') return send(ok({ data: [CUR_ALL, CUR_GRADE, CUR_NONE], total: 3 }));
    if (method === 'GET' && path === 'curriculum/tree/cur-all') return send(ok(TREE));
    if (method === 'GET' && path === 'standard/all') return send(ok([{ standardid: 'std-1', standardname: 'Cohort II', school: { schoolname: 'North Valley School' } }]));
    if (method === 'POST' && path === 'certificate/candidates') return send(mock.candidates(call));
    if (method === 'POST' && path === 'certificate/issue') return send(mock.issue(call));
    if (method === 'POST' && /^certificate\/[^/]+\/revoke$/.test(path)) return send(mock.revoke(call));
    if (method === 'GET' && path === 'certificate/student/stu-1') return send(ok(mock.forStudent));
    if (method === 'GET' && /^certificate\/[^/]+$/.test(path)) return send(ok(mock.certificate));
    if (method === 'GET' && path === 'organisation/mine') return send(ok({ organisationid: 'org-1', organisationname: 'Example Trading Co', uitheme: mock.uitheme, organisationpreset: 'company' }));
    if (method === 'GET' && path.startsWith('certificates/verify/')) return send(mock.verify(path.replace('certificates/verify/', '')));
    if (method === 'GET' && path === 'student/stu-1') {
      return send(ok({ studentid: 'stu-1', studentfirstname: 'សុខា', studentlastname: 'ចាន់', curriculumid: 'cur-all', curriculum: { curriculumname: 'Digital Skills for Small Business' }, schooluser: { schoolusername: 'sokha.chan', isdisabled: false } }));
    }
    return send(ok([]));
  });
}

async function newPage(context: BrowserContext, url: string): Promise<Page> {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url);
  return page;
}

/** A pause: whatever a request that was never going to be made would have caused has happened. */
const fence = (page: Page) => page.evaluate(() => new Promise<void>((done) => setTimeout(done, 600)));

async function choose(page: Page, testid: string, option: string): Promise<void> {
  await page.getByTestId(testid).click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option', { hasText: option }).first().click();
}
async function optionsOf(page: Page, testid: string): Promise<string[]> {
  await page.getByTestId(testid).click();
  const texts = await page.locator('.ant-select-dropdown:visible .ant-select-item-option').allTextContents();
  await page.keyboard.press('Escape');
  return texts.map((t) => t.trim());
}

/** The curriculum tier of "Digital Skills" with the rows a real answer has. */
const MIXED = [
  cand('stu-dara', 'សុខា ចាន់', 'issued', [], CERT_1),
  cand('stu-chenda', 'Chenda Rith', 'ready'),
  cand('stu-piseth', 'Piseth Long', 'ready'),
  cand('stu-bopha', 'Bopha Keo', 'not_yet', [quiz('below', 60), quiz('not_taken', null, 'lesson', 'Module 2', 'Lesson 3')]),
  cand('stu-vuthy', 'Vuthy Sam', 'cant_check', [quiz('unverified', 90, 'lesson', 'Module 2', 'Lesson 4')]),
  cand('stu-neath', 'Neath Pov', 'cant_check', [{ reason: 'not_on_learning_server' }]),
  cand('stu-mony', 'Mony Chea', 'not_yet', [{ reason: 'no_quizzes' }]),
  cand('stu-many', 'Many Reasons', 'not_yet', [quiz('below', 10), quiz('below', 20), quiz('below', 30), quiz('below', 40), quiz('below', 50)]),
];

async function openCurriculumTier(context: BrowserContext, mock: Mock, permissions = ALL): Promise<Page> {
  await open(context, permissions, mock);
  const page = await newPage(context, '/certificates');
  await choose(page, 'pick-curriculum', 'Digital Skills');
  await choose(page, 'pick-tier', 'Curriculum');
  return page;
}

test.describe('the Certificates page', () => {
  test('a. the table shows the four statuses and the reasons in plain words', async ({ context }) => {
    const mock = newMock({ candidates: () => ok(MIXED) });
    const page = await openCurriculumTier(context, mock);
    const rows = page.getByTestId('cert-row');
    await expect(rows).toHaveCount(8);
    await expect(page.getByTestId('cert-status')).toHaveText(['Issued', 'Ready', 'Ready', 'Not yet', "Can't check", "Can't check", 'Not yet', 'Not yet']);
    const why = (i: number) => rows.nth(i).getByTestId('cert-why-line');
    await expect(why(0)).toHaveText(['Every quiz passed']);
    await expect(rows.nth(0).getByTestId('cert-issued-on')).toHaveText('12 Nov 2026 · 7F3K-92QD');
    await expect(why(3)).toHaveText(['Module 2 quiz: best 60%', 'Lesson 3 quiz: not taken']);
    await expect(why(4)).toHaveText(['Lesson 4 quiz: passed, but the server did not mark it — a retake fixes it']);
    await expect(why(5)).toHaveText(['Not on the learning server yet — sync learners']);
    await expect(why(6)).toHaveText(['No quizzes in this curriculum']);
    await expect(why(7)).toHaveText(['Module 2 quiz: best 10%', 'Module 2 quiz: best 20%', 'Module 2 quiz: best 30%', 'and 2 more']);
    await expect(rows.nth(0).getByTestId('cert-learner')).toContainText('សុខា ចាន់');
    // it asked for exactly the curriculum scope
    expect(paths(mock, 'certificate/candidates')[0].body).toEqual({ curriculumid: 'cur-all', scope: 'curriculum', scopeid: 'cur-all' });
    // actions: Issue on ready rows, View and Revoke on the issued one, nothing on the others
    await expect(page.getByTestId('issue-one')).toHaveCount(2);
    await expect(rows.nth(0).getByTestId('view-one')).toHaveAttribute('href', '/certificates/cert-1/print');
    await expect(rows.nth(0).getByTestId('revoke-one')).toHaveText('Revoke');
    await expect(rows.nth(3).getByRole('button')).toHaveCount(0);
    await expect(rows.nth(3).getByRole('link')).toHaveCount(0);
  });

  test('a. a level is picked from the curriculum, and "No quizzes" names that tier', async ({ context }) => {
    const mock = newMock({ candidates: () => ok([cand('stu-mony', 'Mony Chea', 'not_yet', [{ reason: 'no_quizzes' }])]) });
    await open(context, ALL, mock);
    const page = await newPage(context, '/certificates');
    await choose(page, 'pick-curriculum', 'Digital Skills');
    await choose(page, 'pick-tier', 'Level');
    expect(await optionsOf(page, 'pick-scope')).toEqual(['Module 1', 'Module 2']);
    await choose(page, 'pick-scope', 'Module 2');
    await expect(page.getByTestId('cert-why-line')).toHaveText(['No quizzes in this level']);
    expect(paths(mock, 'certificate/candidates')[0].body).toEqual({ curriculumid: 'cur-all', scope: 'level', scopeid: 'lv-2' });
    // an optional class narrows the list
    await choose(page, 'pick-class', 'Cohort II');
    await expect.poll(() => paths(mock, 'certificate/candidates').length).toBe(2);
    expect(paths(mock, 'certificate/candidates')[1].body).toEqual({ curriculumid: 'cur-all', scope: 'level', scopeid: 'lv-2', standardid: 'std-1' });
  });

  test('b. only the tiers set to certificate are offered; none gives the message', async ({ context }) => {
    const mock = newMock();
    await open(context, ALL, mock);
    const page = await newPage(context, '/certificates');
    await choose(page, 'pick-curriculum', 'Digital Skills');
    expect(await optionsOf(page, 'pick-tier')).toEqual(['Level', 'Grade', 'Curriculum']);
    // a curriculum with one certificate tier has it chosen already
    await choose(page, 'pick-curriculum', 'Grade Maths');
    await expect(page.getByTestId('pick-tier')).toContainText('Grade');
    expect(await optionsOf(page, 'pick-tier')).toEqual(['Grade']);
    // none: the message, no tier pick, no table
    await choose(page, 'pick-curriculum', 'Awards Only');
    await expect(page.getByTestId('cert-no-tiers')).toContainText('This curriculum gives no certificates. Set it under Recognition on the curriculum.');
    await expect(page.getByTestId('pick-tier')).toHaveCount(0);
    await expect(page.getByTestId('cert-table')).toHaveCount(0);
  });

  test('c. "Issue to N ready" sends exactly the ready ids, says what was refused, and refreshes the table', async ({ context }) => {
    let issued = false;
    const mock = newMock({
      candidates: () =>
        ok(
          issued
            ? MIXED.map((c) => (c.student.studentid === 'stu-chenda' ? cand('stu-chenda', 'Chenda Rith', 'issued', [], { certificateid: 'cert-2', shortcode: 'Q2MD-8TXA', issuedat: '2026-11-12T06:00:00.000Z' }) : c))
            : MIXED,
        ),
      issue: () => {
        issued = true;
        return ok({
          issued: [record({ certificateid: 'cert-2', shortcode: 'Q2MD-8TXA', studentid: 'stu-chenda' }, { learnername: 'Chenda Rith' })],
          refused: [
            { studentid: 'stu-piseth', status: 'not_yet', reasons: [quiz('below', 70)] },
            { studentid: 'stu-ghost', status: 'not_found', reasons: [] },
          ],
        });
      },
    });
    const page = await openCurriculumTier(context, mock);
    const button = page.getByTestId('issue-all');
    await expect(button).toHaveText('Issue to 2 ready');
    await button.click();
    await expect(page.getByTestId('issue-headline')).toHaveText('1 certificate issued.');
    await expect(page.getByTestId('issue-code')).toHaveText('Q2MD-8TXA');
    await expect(page.getByTestId('issue-refusal')).toHaveText(['Piseth Long has not passed every quiz yet.', 'A learner is not enrolled on this curriculum any more.']);
    const sent = paths(mock, 'certificate/issue');
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toEqual({ curriculumid: 'cur-all', scope: 'curriculum', scopeid: 'cur-all', studentids: ['stu-chenda', 'stu-piseth'] });
    // the table was asked for again and now shows Chenda as issued
    await expect.poll(() => paths(mock, 'certificate/candidates').length).toBe(2);
    await expect(page.getByTestId('cert-row').nth(1).getByTestId('cert-status')).toHaveText('Issued');
    await expect(button).toHaveText('Issue to 1 ready');
  });

  test('c. the Issue on a row sends only that learner', async ({ context }) => {
    const mock = newMock({ candidates: () => ok(MIXED), issue: () => ok({ issued: [], refused: [] }) });
    const page = await openCurriculumTier(context, mock);
    await page.getByTestId('cert-row').nth(2).getByTestId('issue-one').click();
    await expect.poll(() => paths(mock, 'certificate/issue').length).toBe(1);
    expect(paths(mock, 'certificate/issue')[0].body.studentids).toEqual(['stu-piseth']);
    await expect(page.getByTestId('issue-headline')).toHaveText('No certificates were issued.');
  });

  test('c. without create_certificate there is no Issue, and without revoke_certificate no Revoke', async ({ context }) => {
    const mock = newMock({ candidates: () => ok(MIXED) });
    const page = await openCurriculumTier(context, mock, ['list_certificate']);
    await expect(page.getByTestId('cert-row')).toHaveCount(8);
    await expect(page.getByTestId('issue-all')).toHaveCount(0);
    await expect(page.getByTestId('issue-one')).toHaveCount(0);
    await expect(page.getByTestId('revoke-one')).toHaveCount(0);
    await expect(page.getByTestId('view-one')).toHaveCount(1);
  });

  test('d. a revoke needs a reason, sends it, and the row is no longer Issued', async ({ context }) => {
    let revoked = false;
    const mock = newMock({
      candidates: () => ok(revoked ? MIXED.map((c) => (c.student.studentid === 'stu-dara' ? cand('stu-dara', 'សុខា ចាន់', 'ready') : c)) : MIXED),
      revoke: () => {
        revoked = true;
        return ok(record({ revokedat: '2026-11-13T05:00:00.000Z', revokereason: 'Issued to the wrong learner' }));
      },
    });
    const page = await openCurriculumTier(context, mock);
    await page.getByTestId('cert-row').nth(0).getByTestId('revoke-one').click();
    const confirm = page.getByRole('button', { name: 'Revoke certificate', exact: true });
    await expect(confirm).toBeDisabled();
    await page.getByTestId('revoke-reason').fill('    ');
    await expect(confirm, 'blanks are not a reason').toBeDisabled();
    await page.getByTestId('revoke-reason').fill('  Issued to the wrong learner ');
    await expect(page.getByTestId('revoke-count')).toHaveText('30 / 500');
    await expect(confirm).toBeEnabled();
    expect(paths(mock, 'certificate/cert-1/revoke'), 'nothing sent before the confirm').toHaveLength(0);
    await confirm.click();
    await expect(page.getByTestId('cert-notice')).toContainText('The certificate 7F3K-92QD of សុខា ចាន់ was revoked.');
    const sent = paths(mock, 'certificate/cert-1/revoke');
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toEqual({ reason: 'Issued to the wrong learner' });
    await expect(page.getByTestId('cert-row').nth(0).getByTestId('cert-status')).toHaveText('Ready');
    await expect(page.getByTestId('revoke-one')).toHaveCount(0);
  });

  test('d. cancelling the revoke sends nothing', async ({ context }) => {
    const mock = newMock({ candidates: () => ok(MIXED) });
    const page = await openCurriculumTier(context, mock);
    await page.getByTestId('revoke-one').click();
    await page.getByTestId('revoke-reason').fill('x');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await fence(page);
    expect(paths(mock, 'certificate/cert-1/revoke')).toHaveLength(0);
    await expect(page.getByTestId('cert-row').nth(0).getByTestId('cert-status')).toHaveText('Issued');
  });

  test('g. the learning server being down is one banner; the table already shown stays; nothing crashes', async ({ context }) => {
    let down = false;
    const mock = newMock({
      candidates: () =>
        down
          ? json(502, { error: true, errormessage: "The learning server could not be asked for the learners' quiz results, so nothing was changed. Try again in a few minutes.", hint: 'Nothing was changed.' })
          : ok(MIXED),
    });
    const page = await openCurriculumTier(context, mock);
    await expect(page.getByTestId('cert-row')).toHaveCount(8);
    down = true;
    await choose(page, 'pick-class', 'Cohort II');
    await expect(page.getByTestId('cert-error')).toHaveText("The learning server could not be asked for the learners' quiz results, so nothing was changed. Try again in a few minutes. Nothing was changed.");
    await expect(page.getByTestId('cert-row'), 'the table is kept').toHaveCount(8);
    await fence(page);
    expect(await page.locator('.ant-notification-notice').count(), 'one message, not a banner and a toast').toBe(0);
  });

  test('g. a 502 on the first load shows the banner and no table', async ({ context }) => {
    const mock = newMock({ candidates: () => json(502, { error: true, errormessage: 'The learning server could not be asked.' }) });
    const page = await openCurriculumTier(context, mock);
    await expect(page.getByTestId('cert-error')).toHaveText('The learning server could not be asked.');
    await expect(page.getByTestId('cert-row')).toHaveCount(0);
    await expect(page.getByTestId('cert-none')).toHaveCount(0);
  });

  test('the nav offers Certificates only with list_certificate, and the page is closed without it', async ({ context }) => {
    const mock = newMock();
    await open(context, ['list_certificate', 'view_current_level'], mock);
    const page = await newPage(context, '/report');
    await expect(page.getByRole('link', { name: 'Certificates' })).toHaveAttribute('href', '/certificates');
    const second = await context.browser()!.newContext();
    await open(second, ['view_current_level'], newMock());
    const other = await newPage(second, '/report');
    await expect(other.getByRole('link', { name: 'Current level' })).toBeVisible();
    await expect(other.getByRole('link', { name: 'Certificates' })).toHaveCount(0);
    await other.goto('/certificates');
    await expect(other).toHaveURL(/\/un-authorized$/);
    await second.close();
  });
});

test.describe('the print page', () => {
  const printUrl = '/certificates/cert-1/print';
  const LEVEL = record({ scope: 'level', scopeid: 'lv-3' }, { scopename: 'Pricing and Costs', tierlabel: 'Module' });

  test('e. the look follows the organisation theme: the same certificate is corporate or school', async ({ context }) => {
    const mock = newMock({ uitheme: 'corporate' });
    await open(context, ALL, mock);
    const page = await newPage(context, printUrl);
    await expect(page.getByTestId('sheet')).toHaveAttribute('data-look', 'corporate');
    await expect(page.getByTestId('sheet-eyebrow')).toHaveText('Certificate of completion');
    await expect(page.getByTestId('sheet-name')).toHaveText('សុខា ចាន់');
    const second = await context.browser()!.newContext();
    await open(second, ALL, newMock({ uitheme: 'kids' }));
    const school = await newPage(second, printUrl);
    await expect(school.getByTestId('sheet')).toHaveAttribute('data-look', 'school');
    await expect(school.getByTestId('sheet-title')).toHaveText('Certificate of Achievement');
    await second.close();
  });

  test('e. a programme reads as the programme, a level as "<tier label> <name>" and the programme it belongs to', async ({ context }) => {
    const mock = newMock({ uitheme: 'corporate' });
    await open(context, ALL, mock);
    const page = await newPage(context, printUrl);
    await expect(page.getByTestId('sheet-subject')).toHaveText('Digital Skills for Small Business');
    await expect(page.getByTestId('sheet-intro')).toContainText('every part of the programme');
    await expect(page.getByTestId('sheet-partof')).toHaveCount(0);
    await expect(page.getByTestId('sheet-class')).toHaveText('Cohort II');
    await expect(page.getByTestId('sheet-issued')).toHaveText('12 November 2026');
    const second = await context.browser()!.newContext();
    await open(second, ALL, newMock({ uitheme: 'corporate', certificate: LEVEL }));
    const level = await newPage(second, printUrl);
    await expect(level.getByTestId('sheet-eyebrow')).toHaveText('Module certificate');
    await expect(level.getByTestId('sheet-subject')).toHaveText('Module Pricing and Costs');
    await expect(level.getByTestId('sheet-partof')).toHaveText(', part of Digital Skills for Small Business');
    await expect(level.getByTestId('sheet-intro')).toContainText('has completed and passed the quizzes of');
    await second.close();
  });

  test('e. the A3 toggle switches the @page size, and Print / Save PDF prints', async ({ context }) => {
    const mock = newMock({ uitheme: 'corporate' });
    await open(context, ALL, mock);
    const page = await newPage(context, printUrl);
    await expect(page.getByTestId('sheet')).toBeVisible();
    const rule = () => page.locator('style#certificate-page-rule').textContent();
    expect(await rule()).toContain('size: A4 landscape');
    await expect(page.getByTestId('paper')).toHaveAttribute('data-paper', 'A4');
    await page.getByTestId('paper-A3').click();
    await expect.poll(rule).toContain('size: A3 landscape');
    expect(await rule()).not.toContain('A4');
    await expect(page.getByTestId('paper')).toHaveAttribute('data-paper', 'A3');
    await page.getByTestId('paper-A4').click();
    await expect.poll(rule).toContain('size: A4 landscape');
    expect(await page.evaluate(() => (window as any).__prints)).toBe(0);
    await page.getByTestId('print-button').click();
    expect(await page.evaluate(() => (window as any).__prints)).toBe(1);
  });

  test('e. the QR encodes the origin, /v/ and the code', async ({ context }) => {
    await open(context, ALL, newMock());
    const page = await newPage(context, printUrl);
    const qr = page.getByTestId('qr');
    await expect(qr).toHaveAttribute('data-qr-text', `${ORIGIN}/v/7F3K-92QD`);
    await expect(page.getByTestId('sheet-url')).toHaveText(`${ORIGIN}/v/7F3K-92QD`);
    await expect(page.getByTestId('sheet-code')).toHaveText('7F3K-92QD');
    expect((await qr.locator('path').getAttribute('d'))!.length).toBeGreaterThan(500);
  });

  test('e. a revoked certificate shows the mark and cannot be printed', async ({ context }) => {
    await open(context, ALL, newMock({ certificate: record({ revokedat: '2026-11-13T05:00:00.000Z', revokereason: 'x' }) }));
    const page = await newPage(context, printUrl);
    await expect(page.getByTestId('revoked-mark')).toHaveText('REVOKED');
    await expect(page.getByTestId('print-button')).toBeDisabled();
    await expect(page.getByTestId('print-revoked-note')).toBeVisible();
    await page.getByTestId('print-button').click({ force: true });
    expect(await page.evaluate(() => (window as any).__prints)).toBe(0);
    // and a live one has no mark
    const second = await context.browser()!.newContext();
    await open(second, ALL, newMock());
    const live = await newPage(second, printUrl);
    await expect(live.getByTestId('sheet')).toBeVisible();
    await expect(live.getByTestId('revoked-mark')).toHaveCount(0);
    await expect(live.getByTestId('print-button')).toBeEnabled();
    await second.close();
  });

  test('e. on screen the slots are dashed boxes; on paper they are blank and the admin shell is gone', async ({ context }) => {
    await open(context, ALL, newMock({ uitheme: 'corporate' }));
    const page = await newPage(context, printUrl);
    const slot = page.getByTestId('slot').first();
    await expect(slot).toBeVisible();
    expect(await slot.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('dashed');
    expect(await page.locator('app-shell-nav').evaluate((el) => getComputedStyle(el).display)).not.toBe('none');
    await page.emulateMedia({ media: 'print' });
    expect(await slot.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none');
    expect(await slot.evaluate((el) => getComputedStyle(el).backgroundImage)).toBe('none');
    expect(await slot.evaluate((el) => getComputedStyle(el).color)).toBe('rgba(0, 0, 0, 0)');
    expect(await page.locator('app-shell-nav').evaluate((el) => getComputedStyle(el).display)).toBe('none');
    expect(await page.locator('app-shell-breadcrumb').evaluate((el) => getComputedStyle(el).display)).toBe('none');
    await expect(page.getByTestId('print-toolbar')).toBeHidden();
  });
});

test.describe('the public check page', () => {
  const VALID = { status: 'valid', learnername: 'សុខា ចាន់', scope: 'curriculum', tierlabel: 'Programme', scopename: 'Digital Skills for Small Business', curriculumname: 'Digital Skills for Small Business', classname: 'Cohort II', organisationname: 'Example Trading Co', issuedat: '2026-11-12T05:00:00.000Z', shortcode: '7F3K-92QD' };

  test('f. a valid code shows exactly what the certificate says, and makes one call with no Authorization header, signed in or not', async ({ context, browser }) => {
    for (const signedIn of [true, false]) {
      const ctx = signedIn ? context : await browser.newContext();
      const mock = newMock({ verify: () => ok(VALID) });
      await open(ctx, ALL, mock, signedIn);
      const page = await newPage(ctx, '/v/7f3k92qd');
      await expect(page.getByTestId('check-status')).toHaveText('Valid certificate');
      await expect(page.getByTestId('check-fields').locator('dt')).toHaveText(['Awarded to', 'For', 'Cohort', 'Issued by', 'Issued on', 'Code']);
      await expect(page.getByTestId('check-fields').locator('dd')).toHaveText(['សុខា ចាន់', 'Digital Skills for Small Business (programme)', 'Cohort II', 'Example Trading Co', '12 November 2026', '7F3K-92QD']);
      await fence(page);
      expect(mock.calls.map((c) => c.path), `signed in: ${signedIn}; the only call`).toEqual(['certificates/verify/7F3K-92QD']);
      expect(mock.calls[0].authorization, `signed in: ${signedIn}`).toBeUndefined();
      expect(page.url()).toBe(`${ORIGIN}/v/7f3k92qd`);
      if (!signedIn) await ctx.close();
    }
  });

  test('f. a revoked code shows only the date and the code, even if more were sent', async ({ context }) => {
    const mock = newMock({ verify: () => ok({ status: 'revoked', revokedat: '2026-11-20T05:00:00.000Z', shortcode: 'Q2MD-8TXA', learnername: 'សុខា ចាន់', revokereason: 'Issued by mistake' }) });
    await open(context, ALL, mock, false);
    const page = await newPage(context, '/v/Q2MD-8TXA');
    await expect(page.getByTestId('check-status')).toHaveText('Revoked');
    await expect(page.getByTestId('check-revoked-text')).toHaveText('This certificate was withdrawn on 20 November 2026. It is no longer valid.');
    await expect(page.getByTestId('check-fields').locator('dd')).toHaveText(['Q2MD-8TXA']);
    const text = (await page.getByTestId('check-card').textContent()) ?? '';
    expect(text).not.toContain('សុខា');
    expect(text).not.toContain('by mistake');
  });

  test('f. an unknown code says so, and a code can be typed on /v', async ({ context }) => {
    const mock = newMock({ verify: (code) => (code === 'Q2MD-8TXA' ? ok({ ...VALID, shortcode: 'Q2MD-8TXA' }) : json(404, { error: true, errormessage: 'That code does not match a certificate.' })) });
    await open(context, ALL, mock, false);
    const page = await newPage(context, '/v/ZZZZ-ZZZZ');
    await expect(page.getByTestId('check-status')).toHaveText('No certificate has this code');
    await expect(page.getByTestId('check-fields')).toHaveCount(0);
    await fence(page);
    expect(await page.locator('.ant-notification-notice').count(), 'a 404 is the page\'s own message, not a toast').toBe(0);
    await page.goto('/v');
    await expect(page.getByTestId('check-submit')).toBeDisabled();
    await page.getByTestId('check-input').fill('q2md 8txa');
    await page.getByTestId('check-submit').click();
    await expect(page).toHaveURL(/\/v\/Q2MD-8TXA$/);
    await expect(page.getByTestId('check-status')).toHaveText('Valid certificate');
    expect(paths(mock, 'certificates/verify/').map((c) => c.path)).toEqual(['certificates/verify/ZZZZ-ZZZZ', 'certificates/verify/Q2MD-8TXA']);
    expect(mock.calls.every((c) => c.authorization === undefined)).toBe(true);
  });
});

test.describe('the learner page: Certificates', () => {
  const older = record({ certificateid: 'cert-old', shortcode: 'AAAA-1111', issuedat: '2026-10-01T05:00:00.000Z', revokedat: '2026-10-05T05:00:00.000Z' }, { scopename: 'Module 1', tierlabel: 'Module' });
  const newer = record({ certificateid: 'cert-new', shortcode: 'BBBB-2222', issuedat: '2026-11-12T05:00:00.000Z' });

  test('lists issued and revoked certificates newest first, with View links', async ({ context }) => {
    const mock = newMock({ forStudent: [older, newer] });
    await open(context, ['list_certificate', 'view_student'], mock);
    const page = await newPage(context, '/student/stats/stu-1');
    const section = page.getByTestId('learner-certificates');
    await expect(section.getByRole('heading', { name: 'Certificates' })).toBeVisible();
    await expect(section.getByTestId('cert-state')).toHaveText(['Issued 12 Nov 2026', 'Revoked 5 Oct 2026']);
    await expect(section.getByTestId('cert-what')).toHaveText(['Programme Digital Skills for Small Business — Digital Skills for Small Business', 'Module Module 1 — Digital Skills for Small Business']);
    await expect(section.getByTestId('cert-view')).toHaveText(['View', 'View']);
    await expect(section.getByTestId('cert-view').first()).toHaveAttribute('href', '/certificates/cert-new/print');
  });

  test('says so when there are none, and shows nothing and asks nothing without list_certificate', async ({ context }) => {
    const mock = newMock({ forStudent: [] });
    await open(context, ['list_certificate', 'view_student'], mock);
    const page = await newPage(context, '/student/stats/stu-1');
    await expect(page.getByTestId('certs-empty')).toHaveText('No certificates yet.');
    const second = await context.browser()!.newContext();
    const none = newMock();
    await open(second, ['view_student'], none);
    const other = await newPage(second, '/student/stats/stu-1');
    await expect(other.getByText('sokha.chan').first()).toBeVisible();
    await fence(other);
    await expect(other.getByTestId('learner-certificates')).toHaveCount(0);
    expect(paths(none, 'certificate/student')).toEqual([]);
    await second.close();
  });
});
