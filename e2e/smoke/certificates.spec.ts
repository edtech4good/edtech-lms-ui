import { BrowserContext, Page, Request, Route, expect, test } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { API_URL, BASE_URL } from '../fixtures/env';

/**
 * Certificates, slices 1 and 2 (admin), in a browser with every answer from the API mocked (none is real, so it runs against any build served on
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
// central's tree carries deleted and switched-off rows too, and the levels under them
const TREE = [
  {
    curriculumid: 'cur-all',
    grades: [
      {
        gradeid: 'gr-1', gradename: 'Grade 1', isdeleted: false, gradestatus: true,
        levels: [
          { levelid: 'lv-1', levelname: 'Module 1', isdeleted: false, levelstatus: true },
          { levelid: 'lv-2', levelname: 'Module 2', isdeleted: false, levelstatus: true },
          { levelid: 'lv-del', levelname: 'Deleted module', isdeleted: true, levelstatus: true },
          { levelid: 'lv-off', levelname: 'Switched-off module', isdeleted: false, levelstatus: false },
        ],
      },
      { gradeid: 'gr-del', gradename: 'Deleted grade', isdeleted: true, gradestatus: true, levels: [{ levelid: 'lv-under-del', levelname: 'Module under deleted grade', isdeleted: false, levelstatus: true }] },
      { gradeid: 'gr-off', gradename: 'Switched-off grade', isdeleted: false, gradestatus: false, levels: [{ levelid: 'lv-under-off', levelname: 'Module under off grade', isdeleted: false, levelstatus: true }] },
    ],
  },
];
/** central's real 502 body */
const BAD_GATEWAY = {
  error: true,
  data: false,
  code: 'BAD_GATEWAY',
  errormessage: "The learning server could not be asked for the learners' quiz results, so nothing was changed. Try again in a few minutes.",
  reference: 'ref-123',
  hint: 'Nothing was changed. If it keeps happening, contact support with the reference.',
};
const BAD_GATEWAY_TEXT = `${BAD_GATEWAY.errormessage} Reference: ref-123.`;

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
  // like central: a learner who holds a certificate (not asked) or is not on the learning server has no counts
  quizcount: status === 'issued' || JSON.stringify(reasons).includes('not_on_learning_server') ? 0 : 6,
  passedcount: status === 'ready' ? 6 : status === 'issued' || JSON.stringify(reasons).includes('not_on_learning_server') ? 0 : 3,
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
  mineFails: boolean;
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
  mineFails: false,
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
    if (method === 'GET' && path === 'organisation/mine' && mock.mineFails) return send(json(500, { error: true, errormessage: 'Something went wrong' }));
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
    expect(await optionsOf(page, 'pick-scope'), 'deleted and switched-off modules, and those under a dropped grade, are not offered').toEqual(['Module 1', 'Module 2']);
    await choose(page, 'pick-scope', 'Module 2');
    await expect(page.getByTestId('cert-why-line')).toHaveText(['No quizzes in this level']);
    expect(paths(mock, 'certificate/candidates')[0].body).toEqual({ curriculumid: 'cur-all', scope: 'level', scopeid: 'lv-2' });
    // an optional class narrows the list
    await choose(page, 'pick-class', 'Cohort II');
    await expect.poll(() => paths(mock, 'certificate/candidates').length).toBe(2);
    expect(paths(mock, 'certificate/candidates')[1].body).toEqual({ curriculumid: 'cur-all', scope: 'level', scopeid: 'lv-2', standardid: 'std-1' });
  });

  test('a. a grade is picked from the live grades only', async ({ context }) => {
    await open(context, ALL, newMock());
    const page = await newPage(context, '/certificates');
    await choose(page, 'pick-curriculum', 'Digital Skills');
    await choose(page, 'pick-tier', 'Grade');
    expect(await optionsOf(page, 'pick-scope')).toEqual(['Grade 1']);
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

  test('c. 250 ready learners are issued in batches of 200 then 50, and one summary says all 250', async ({ context }) => {
    const many = Array.from({ length: 250 }, (_, i) => cand(`stu-${i}`, `Learner ${i}`, 'ready'));
    const mock = newMock({
      candidates: () => ok(many),
      issue: (call) => ok({ issued: call.body.studentids.map((id: string, i: number) => record({ certificateid: `c-${id}`, shortcode: `C${String(i).padStart(3, '0')}-${id.slice(-4).padStart(4, '0')}`, studentid: id }, { learnername: id })), refused: [] }),
    });
    const page = await openCurriculumTier(context, mock);
    await expect(page.getByTestId('issue-all')).toHaveText('Issue to 250 ready');
    await page.getByTestId('issue-all').click();
    await expect(page.getByTestId('issue-headline')).toHaveText('250 certificates issued.');
    const sent = paths(mock, 'certificate/issue');
    expect(sent.map((c) => c.body.studentids.length)).toEqual([200, 50]);
    expect(sent.flatMap((c) => c.body.studentids)).toEqual(many.map((c) => c.student.studentid));
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
    await expect(page.getByTestId('cert-notice')).toContainText('The certificate 7F3K-92QD of សុខា ចាន់ was revoked. A new certificate can be issued if they are still ready.');
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
          ? json(502, BAD_GATEWAY)
          : ok(MIXED),
    });
    const page = await openCurriculumTier(context, mock);
    await expect(page.getByTestId('cert-row')).toHaveCount(8);
    down = true;
    await choose(page, 'pick-class', 'Cohort II');
    await expect(page.getByTestId('cert-error')).toHaveText(BAD_GATEWAY_TEXT);
    await expect(page.getByTestId('cert-row'), 'no table over rows that may be stale').toHaveCount(0);
    await expect(page.getByTestId('issue-all'), 'no "Issue to 0 ready"').toHaveCount(0);
    await expect(page.getByTestId('cert-retry')).toBeVisible();
    await fence(page);
    expect(await page.locator('.ant-notification-notice').count(), 'one message, not a banner and a toast').toBe(0);
    // Retry asks again, and the table comes back
    down = false;
    await page.getByTestId('cert-retry').click();
    await expect(page.getByTestId('cert-row')).toHaveCount(8);
    await expect(page.getByTestId('cert-error')).toHaveCount(0);
    await expect(page.getByTestId('cert-retry')).toHaveCount(0);
  });

  test('g. a 502 on the first load shows the banner and no table', async ({ context }) => {
    const mock = newMock({ candidates: () => json(502, BAD_GATEWAY) });
    const page = await openCurriculumTier(context, mock);
    await expect(page.getByTestId('cert-error')).toHaveText(BAD_GATEWAY_TEXT);
    await expect(page.getByTestId('cert-row')).toHaveCount(0);
    await expect(page.getByTestId('cert-none')).toHaveCount(0);
    await expect(page.getByTestId('issue-all')).toHaveCount(0);
    await expect(page.getByTestId('cert-retry')).toBeVisible();
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
    await expect(level.getByTestId('sheet-subject')).toHaveText('Pricing and Costs');
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

  test('e. a revoked certificate does not print, only its notice does', async ({ context }) => {
    await open(context, ALL, newMock({ certificate: record({ revokedat: '2026-11-13T05:00:00.000Z' }) }));
    const page = await newPage(context, printUrl);
    await expect(page.getByTestId('sheet')).toBeVisible();
    await expect(page.getByTestId('print-revoked-print')).toBeHidden();
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByTestId('sheet')).toBeHidden();
    await expect(page.getByTestId('print-revoked-print')).toBeVisible();
  });

  test('e. a failed read of the organisation shows a one-line notice and the school look', async ({ context }) => {
    await open(context, ALL, newMock({ mineFails: true }));
    const page = await newPage(context, printUrl);
    await expect(page.getByTestId('print-look-note')).toHaveText("Could not read the organisation's look; showing the school look.");
    await expect(page.getByTestId('sheet')).toHaveAttribute('data-look', 'school');
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByTestId('print-look-note')).toBeHidden();
    const ok = await context.browser()!.newContext();
    await open(ok, ALL, newMock());
    const fine = await newPage(ok, printUrl);
    await expect(fine.getByTestId('sheet')).toBeVisible();
    await expect(fine.getByTestId('print-look-note')).toHaveCount(0);
    await ok.close();
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
    expect(await slot.locator('.slot-label').evaluate((el) => getComputedStyle(el).display), 'the label is not printed').toBe('none');
    expect(await page.locator('app-shell-nav').evaluate((el) => getComputedStyle(el).display)).toBe('none');
    // and no placeholder wording is left on the paper (display:none leaves no text for a PDF either)
    const printed = await page.getByTestId('sheet').evaluate((el) => (el as HTMLElement).innerText);
    for (const label of ['LOGO', 'KHMER TITLE', 'SIGNATURE', 'Signatory name', 'Title, organisation']) expect(printed, label).not.toContain(label);
    expect(printed).toContain('7F3K-92QD');
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
  const older = record({ certificateid: 'cert-old', scope: 'level', shortcode: 'AAAA-1111', issuedat: '2026-10-01T05:00:00.000Z', revokedat: '2026-10-05T05:00:00.000Z' }, { scopename: 'Module 1', tierlabel: 'Module' });
  const newer = record({ certificateid: 'cert-new', shortcode: 'BBBB-2222', issuedat: '2026-11-12T05:00:00.000Z' });

  test('lists issued and revoked certificates newest first, with View links', async ({ context }) => {
    const mock = newMock({ forStudent: [older, newer] });
    await open(context, ['list_certificate', 'view_student'], mock);
    const page = await newPage(context, '/student/stats/stu-1');
    const section = page.getByTestId('learner-certificates');
    await expect(section.getByRole('heading', { name: 'Certificates' })).toBeVisible();
    await expect(section.getByTestId('cert-state')).toHaveText(['Issued 12 Nov 2026', 'Revoked 5 Oct 2026']);
    await expect(section.getByTestId('cert-what')).toHaveText(['Digital Skills for Small Business', 'Module 1 — Digital Skills for Small Business']);
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

test.describe('the printed page (a real PDF)', () => {
  /** Pages of a PDF: its page objects (/Type /Page, not /Pages). */
  const pagesOf = (pdf: Buffer): number => (pdf.toString('latin1').match(/\/Type\s*\/Page(?![a-z])/g) ?? []).length;

  for (const [paper, wide, high] of [['A4', 297, 210], ['A3', 420, 297]] as const) {
    test(`e. ${paper} prints as exactly one page with the whole bottom row on it`, async ({ context }) => {
      await open(context, ALL, newMock({ uitheme: 'corporate' }));
      const page = await newPage(context, '/certificates/cert-1/print');
      await expect(page.getByTestId('sheet')).toBeVisible();
      if (paper === 'A3') await page.getByTestId('paper-A3').click();
      await expect.poll(() => page.locator('style#certificate-page-rule').textContent()).toContain(`size: ${paper} landscape`);
      // what the browser lays out for print: the sheet is the page (physical units), and the signatures, code and QR are on it
      await page.emulateMedia({ media: 'print' });
      const mm = (n: number) => (n / 25.4) * 96;
      const sheet = (await page.getByTestId('sheet').boundingBox())!;
      expect(Math.abs(sheet.width - mm(wide)), 'the sheet is as wide as the page').toBeLessThan(1);
      expect(sheet.height, 'and no taller').toBeLessThanOrEqual(mm(high) + 0.5);
      for (const id of ['sheet-code', 'sheet-url', 'qr']) {
        const box = (await page.getByTestId(id).boundingBox())!;
        expect(box.y + box.height, `${id} is inside the page`).toBeLessThanOrEqual(mm(high) + 0.5);
      }
      const pdf = await page.pdf({ preferCSSPageSize: true });
      expect(pagesOf(pdf), `${paper}: one page`).toBe(1);
    });
  }
});

// ---- Slice 2: the public printable page, the "Show certificate" link, and the learning-server note ----------------------------

const PUBLIC_VALID = { status: 'valid', learnername: 'សុខា ចាន់', scope: 'curriculum', tierlabel: 'Programme', scopename: 'Digital Skills for Small Business', curriculumname: 'Digital Skills for Small Business', classname: 'Cohort II', organisationname: 'Example Trading Co', issuedat: '2026-11-12T05:00:00.000Z', shortcode: '7F3K-92QD', schoolname: 'North Valley School', look: 'corporate' };
const PUBLIC_LEVEL = { ...PUBLIC_VALID, scope: 'level', tierlabel: 'Module', scopename: 'Pricing and Costs' };
const PUBLIC_REVOKED = { status: 'revoked', revokedat: '2026-11-20T05:00:00.000Z', shortcode: '7F3K-92QD' };
const NO_SUCH_CODE = json(404, { error: true, errormessage: 'That code does not match a certificate.' });
const publicUrl = '/v/7F3K-92QD/certificate';

test.describe('the public certificate page', () => {
  test('a. valid, corporate and school looks: the sheet, with no Authorization header and exactly one request, signed in or not', async ({ context, browser }) => {
    for (const signedIn of [true, false]) {
      for (const look of ['corporate', 'school']) {
        const ctx = signedIn && look === 'corporate' ? context : await browser.newContext();
        const mock = newMock({ verify: () => ok({ ...PUBLIC_VALID, look }) });
        await open(ctx, ALL, mock, signedIn);
        const page = await newPage(ctx, publicUrl);
        await expect(page.getByTestId('sheet')).toHaveAttribute('data-look', look);
        await expect(page.getByTestId('sheet-name')).toHaveText('សុខា ចាន់');
        await expect(page.getByTestId('sheet-class')).toHaveText('Cohort II');
        await expect(page.getByTestId('sheet-issued')).toHaveText('12 November 2026');
        await expect(page.getByTestId('sheet-code')).toHaveText('7F3K-92QD');
        // the corporate sheet names the issuing organisation; the school look names the school
        await expect(page.getByTestId('sheet')).toContainText(look === 'corporate' ? 'Example Trading Co' : 'North Valley School');
        await expect(page.getByTestId('sheet-title')).toHaveText(look === 'corporate' ? 'Certificate of Completion' : 'Certificate of Achievement');
        await expect(page.getByTestId('qr')).toHaveAttribute('data-qr-text', `${ORIGIN}/v/7F3K-92QD`);
        await fence(page);
        expect(mock.calls.map((c) => c.path), `signed in: ${signedIn}, ${look}: the only call`).toEqual(['certificates/verify/7F3K-92QD']);
        expect(mock.calls[0].authorization, `signed in: ${signedIn}, ${look}`).toBeUndefined();
        expect(page.url()).toBe(`${ORIGIN}${publicUrl}`);
        if (ctx !== context) await ctx.close();
      }
    }
  });

  test('a. a programme reads as the programme; a level or grade by its name, with its tier label only in the eyebrow', async ({ context }) => {
    await open(context, ALL, newMock({ verify: () => ok(PUBLIC_VALID) }), false);
    const programme = await newPage(context, publicUrl);
    await expect(programme.getByTestId('sheet-eyebrow')).toHaveText('Certificate of completion');
    await expect(programme.getByTestId('sheet-subject')).toHaveText('Digital Skills for Small Business');
    await expect(programme.getByTestId('sheet-partof')).toHaveCount(0);
    const second = await context.browser()!.newContext();
    await open(second, ALL, newMock({ verify: () => ok(PUBLIC_LEVEL) }), false);
    const level = await newPage(second, publicUrl);
    await expect(level.getByTestId('sheet-eyebrow')).toHaveText('Module certificate');
    await expect(level.getByTestId('sheet-subject')).toHaveText('Pricing and Costs');
    await expect(level.getByTestId('sheet-partof')).toHaveText(', part of Digital Skills for Small Business');
    await second.close();
  });

  test('a. a withdrawn certificate says so with the date and shows no sheet', async ({ context }) => {
    const mock = newMock({ verify: () => ok(PUBLIC_REVOKED) });
    await open(context, ALL, mock, false);
    const page = await newPage(context, publicUrl);
    await expect(page.getByTestId('public-revoked')).toHaveText('This certificate was withdrawn on 20 November 2026.');
    await fence(page);
    await expect(page.getByTestId('sheet')).toHaveCount(0);
    await expect(page.getByTestId('print-button')).toHaveCount(0);
    expect(mock.calls.map((c) => c.path)).toEqual(['certificates/verify/7F3K-92QD']);
  });

  test('a. an unknown code says so, links back to /v, and is not a toast', async ({ context }) => {
    const mock = newMock({ verify: () => NO_SUCH_CODE });
    await open(context, ALL, mock, false);
    const page = await newPage(context, '/v/ZZZZ-ZZZZ/certificate');
    await expect(page.getByTestId('public-missing')).toHaveText('No certificate has this code');
    await expect(page.getByTestId('sheet')).toHaveCount(0);
    await fence(page);
    expect(await page.locator('.ant-notification-notice').count()).toBe(0);
    await page.getByTestId('public-back').click();
    await expect(page).toHaveURL(`${ORIGIN}/v`);
    await expect(page.getByTestId('check-input')).toBeVisible();
  });

  test('a. the A4 and A3 toggle follows the paper rule, and Print / Save PDF prints', async ({ context }) => {
    await open(context, ALL, newMock({ verify: () => ok(PUBLIC_VALID) }), false);
    const page = await newPage(context, publicUrl);
    const rule = () => page.locator('style#certificate-page-rule').textContent();
    await expect(page.getByTestId('sheet')).toBeVisible();
    expect(await rule()).toContain('size: A4 landscape');
    await page.getByTestId('paper-A3').click();
    await expect.poll(rule).toContain('size: A3 landscape');
    await expect(page.getByTestId('paper')).toHaveAttribute('data-paper', 'A3');
    expect(await page.evaluate(() => (window as any).__prints)).toBe(0);
    await page.getByTestId('print-button').click();
    expect(await page.evaluate(() => (window as any).__prints)).toBe(1);
  });

  test('e. the public route works signed in and signed out, and the staff print route still needs sign-in', async ({ context, browser }) => {
    const signedOut = await browser.newContext();
    await open(signedOut, ALL, newMock({ verify: () => ok(PUBLIC_VALID) }), false);
    const out = await newPage(signedOut, publicUrl);
    await expect(out.getByTestId('sheet')).toBeVisible();
    await expect(out).toHaveURL(`${ORIGIN}${publicUrl}`);
    await open(context, ALL, newMock({ verify: () => ok(PUBLIC_VALID) }), true);
    const inn = await newPage(context, publicUrl);
    await expect(inn.getByTestId('sheet')).toBeVisible();
    await expect(inn).toHaveURL(`${ORIGIN}${publicUrl}`);
    // nothing else became public: a signed-out browser is sent to sign in from the staff print page
    const staff = await newPage(signedOut, '/certificates/cert-1/print');
    await expect(staff).toHaveURL(/\/auth\/login/);
    await signedOut.close();
  });

  for (const [paper, wide, high] of [['A4', 297, 210], ['A3', 420, 297]] as const) {
    test(`b. ${paper} prints as exactly one page, with the code and QR on it and no placeholder text in the PDF`, async ({ context }) => {
      await open(context, ALL, newMock({ verify: () => ok(PUBLIC_VALID) }), false);
      const page = await newPage(context, publicUrl);
      await expect(page.getByTestId('sheet')).toBeVisible();
      if (paper === 'A3') await page.getByTestId('paper-A3').click();
      await expect.poll(() => page.locator('style#certificate-page-rule').textContent()).toContain(`size: ${paper} landscape`);
      await page.emulateMedia({ media: 'print' });
      const mm = (n: number) => (n / 25.4) * 96;
      const sheet = (await page.getByTestId('sheet').boundingBox())!;
      expect(Math.abs(sheet.width - mm(wide)), 'the sheet is as wide as the page').toBeLessThan(1);
      expect(sheet.height, 'and no taller').toBeLessThanOrEqual(mm(high) + 0.5);
      for (const id of ['sheet-code', 'sheet-url', 'qr']) {
        const box = (await page.getByTestId(id).boundingBox())!;
        expect(box.y + box.height, `${id} is inside the page`).toBeLessThanOrEqual(mm(high) + 0.5);
      }
      await expect(page.getByTestId('print-toolbar')).toBeHidden();
      const pdf = await page.pdf({ preferCSSPageSize: true });
      expect((pdf.toString('latin1').match(/\/Type\s*\/Page(?![a-z])/g) ?? []).length, `${paper}: one page`).toBe(1);
      // the words the PDF actually holds (pdftotext reads the file, nothing is piped in)
      const dir = mkdtempSync(join(tmpdir(), 'cert-pdf-'));
      try {
        const file = join(dir, 'c.pdf');
        writeFileSync(file, pdf);
        const text = spawnSync('pdftotext', [file, '-'], { encoding: 'utf8', input: '' }).stdout;
        expect(text, 'the certificate is in the PDF').toContain('7F3K-92QD');
        for (const label of ['LOGO', 'KHMER TITLE', 'SIGNATURE', 'Signatory name', 'Title, organisation']) expect(text, `${label} is not printed`).not.toContain(label);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
});

test.describe('the public check page links to the printable one', () => {
  test('c. a valid code shows "Show certificate" to /v/<code>/certificate; revoked, unknown and the empty page do not', async ({ context }) => {
    const code = { v: ok(PUBLIC_VALID), r: ok(PUBLIC_REVOKED), u: NO_SUCH_CODE };
    await open(context, ALL, newMock({ verify: (c) => (c === '7F3K-92QD' ? code.v : c === 'Q2MD-8TXA' ? code.r : code.u) }), false);
    const valid = await newPage(context, '/v/7F3K-92QD');
    const link = valid.getByTestId('check-show');
    await expect(link).toHaveText('Show certificate');
    await expect(link).toHaveAttribute('href', '/v/7F3K-92QD/certificate');
    await link.click();
    await expect(valid).toHaveURL(`${ORIGIN}/v/7F3K-92QD/certificate`);
    await expect(valid.getByTestId('sheet')).toBeVisible();
    const revoked = await newPage(context, '/v/Q2MD-8TXA');
    await expect(revoked.getByTestId('check-status')).toHaveText('Revoked');
    await expect(revoked.getByTestId('check-show')).toHaveCount(0);
    const unknown = await newPage(context, '/v/ZZZZ-ZZZZ');
    await expect(unknown.getByTestId('check-status')).toHaveText('No certificate has this code');
    await expect(unknown.getByTestId('check-show')).toHaveCount(0);
    const blank = await newPage(context, '/v');
    await expect(blank.getByTestId('check-input')).toBeVisible();
    await expect(blank.getByTestId('check-show')).toHaveCount(0);
  });
});

test.describe('the learning-server note after an issue or a revoke', () => {
  const NOTE = 'The learning server will get it at the next Sync Students.';
  const issued = [record({ certificateid: 'cert-2', shortcode: 'Q2MD-8TXA', studentid: 'stu-chenda' }, { learnername: 'Chenda Rith' })];

  for (const pushed of [false, true, undefined]) {
    test(`d. an issue answered pushed:${pushed} ${pushed === false ? 'says the learning server will get it later' : 'says nothing of the learning server'}`, async ({ context }) => {
      const mock = newMock({ candidates: () => ok(MIXED), issue: () => ok({ issued, refused: [], ...(pushed === undefined ? {} : { pushed }) }) });
      const page = await openCurriculumTier(context, mock);
      await page.getByTestId('issue-all').click();
      await expect(page.getByTestId('issue-headline')).toHaveText('1 certificate issued.');
      if (pushed === false) await expect(page.getByTestId('push-note')).toHaveText(NOTE);
      else {
        await fence(page);
        await expect(page.getByTestId('push-note')).toHaveCount(0);
      }
    });

    test(`d. a revoke answered pushed:${pushed} ${pushed === false ? 'says the learning server will get it later' : 'says nothing of the learning server'}`, async ({ context }) => {
      const mock = newMock({ candidates: () => ok(MIXED), revoke: () => ok({ ...record({ revokedat: '2026-11-13T05:00:00.000Z' }), ...(pushed === undefined ? {} : { pushed }) }) });
      const page = await openCurriculumTier(context, mock);
      await page.getByTestId('cert-row').nth(0).getByTestId('revoke-one').click();
      await page.getByTestId('revoke-reason').fill('Issued to the wrong learner');
      await page.getByRole('button', { name: 'Revoke certificate', exact: true }).click();
      await expect(page.getByTestId('cert-notice')).toContainText('was revoked.');
      if (pushed === false) {
        await expect(page.getByTestId('push-note')).toHaveText(NOTE);
        await expect(page.getByTestId('cert-notice')).toContainText('A new certificate can be issued if they are still ready.');
      } else {
        await fence(page);
        await expect(page.getByTestId('push-note')).toHaveCount(0);
      }
    });
  }
});
