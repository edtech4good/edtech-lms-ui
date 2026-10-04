import { Page, expect, test } from '@playwright/test';
import { loginViaUi } from './fixtures/auth';
import { API_URL } from './fixtures/env';

/**
 * A 404 is said once. The API answers 404 for a row that does not exist or is not
 * the caller's; the error interceptor toasts the API's words (or a neutral line when
 * it has none), unless the request says what a 404 means itself (NOT_FOUND_HANDLED, or
 * FIELD_ERRORS_INLINE), and never for sign-in.
 *
 * Every 404 here is a mocked route, so the spec does not depend on the API's version.
 * The sign-in is real (the page needs a session); the school list and delete, the
 * staff account read and the sign-in POST are mocked.
 */
const NEUTRAL = 'That record was not found. It may have been removed, or it may not be yours to see.';
const SCHOOL = { schoolid: '00000000-0000-4000-8000-0000000000e1', schoolname: 'sample-school-404', countries: { countryname: 'Sample' }, curriculums: [] };
const STAFF_ID = '00000000-0000-4000-8000-0000000000e2';
const STAFF_NOT_FOUND = "That person doesn't exist, or isn't in your organisation.";

const toasts = (page: Page) => page.locator('.ant-notification-notice');
/** The words of each toast, without its "Error" title. */
const texts = (page: Page) => page.locator('.ant-notification-notice-description');
const json = (status: number, body: unknown) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

// A toast fades after a few seconds, and `toHaveCount` keeps retrying until it has: a "none"
// or "exactly one" check on it could pass because the toast went away. So those are read once,
// after `settled`, with `count()`.

/** Two animation frames: whatever a failed request was going to put on screen has been put there. */
const settled = (page: Page) =>
  page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));

/** The school list shows one row; deleting it answers with `answer`. */
async function deleteSchoolAnswering(page: Page, answer: ReturnType<typeof json>): Promise<void> {
  await page.route(`${API_URL}/school`, (route) =>
    route.request().method() === 'POST'
      ? route.fulfill(json(200, { error: false, data: { data: [SCHOOL], total: 1, pageindex: 1, pagesize: 10 } }))
      : route.fallback(),
  );
  await page.route(`${API_URL}/school/${SCHOOL.schoolid}`, (route) =>
    route.request().method() === 'DELETE' ? route.fulfill(answer) : route.fallback(),
  );
  await page.goto('/school/index');
  await page.getByRole('row').filter({ hasText: SCHOOL.schoolname }).getByText('Delete').click();
  const deleted = page.waitForResponse((r) => r.url().endsWith(`/school/${SCHOOL.schoolid}`) && r.request().method() === 'DELETE');
  await page.getByRole('button', { name: 'OK' }).click();
  await deleted;
}

test.describe('a 404 is one message', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUi(page);
  });
  test.afterAll(async () => {
    await page?.close();
  });
  test.afterEach(async () => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test('a stale school delete answers 404 with words: the toast says them, once', async () => {
    const said = 'That school was not found.';
    await deleteSchoolAnswering(page, json(404, { code: 'NOT_FOUND', errormessage: said }));
    await expect(texts(page)).toHaveText(said);
    await settled(page);
    expect(await toasts(page).count(), 'one message, not two').toBe(1);
    await expect(texts(page)).toHaveText(said);
  });

  test('a 404 without words says the neutral line, once', async () => {
    await deleteSchoolAnswering(page, json(404, {}));
    await expect(texts(page)).toHaveText(NEUTRAL);
    await settled(page);
    expect(await toasts(page).count(), 'one message, not two').toBe(1);
    await expect(texts(page)).toHaveText(NEUTRAL);
  });

  test('an edit page opened on a missing school toasts once, with the API\'s words (not "Invalid link" as well)', async () => {
    const said = 'That school was not found.';
    const id = '00000000-0000-4000-8000-0000000000e3';
    await page.route(`${API_URL}/school/${id}`, (route) =>
      route.request().method() === 'GET' ? route.fulfill(json(404, { code: 'NOT_FOUND', errormessage: said })) : route.fallback(),
    );
    await page.goto(`/school/update/${id}`);
    await expect(texts(page)).toHaveText(said);
    // The screen still leaves the edit page for the list.
    await expect(page).not.toHaveURL(/\/school\/update\//);
    await settled(page);
    expect(await toasts(page).count(), 'one message, not "Invalid link" as well').toBe(1);
    await expect(texts(page)).toHaveText(said);
  });

  test('four requests for the same missing record show one toast', async () => {
    // Learner stats sends four GETs at once for one id; all four are mocked 404.
    const id = '00000000-0000-4000-8000-0000000000e4';
    let asked = 0;
    await page.route(`${API_URL}/student/**`, (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      asked++;
      return route.fulfill(json(404, { code: 'NOT_FOUND', errormessage: 'That learner was not found.' }));
    });
    await page.goto(`/student/stats/${id}`);
    await expect.poll(() => asked, 'the screen asked four times').toBeGreaterThanOrEqual(4);
    await expect(texts(page)).toHaveText('That learner was not found.');
    await settled(page);
    expect(await toasts(page).count(), 'one toast for four 404s').toBe(1);
  });

  test('a request that says its own 404 (NOT_FOUND_HANDLED) shows no toast', async () => {
    // The staff edit page reads the account with NOT_FOUND_HANDLED and puts a message in place of the form.
    await page.route(`${API_URL}/user/${STAFF_ID}`, (route) =>
      route.request().method() === 'GET' ? route.fulfill(json(404, { code: 'NOT_FOUND', errormessage: 'No such account.' })) : route.fallback(),
    );
    await page.goto(`/user/update/${STAFF_ID}`);
    await expect(page.getByRole('alert').filter({ hasText: STAFF_NOT_FOUND })).toBeVisible();
    await settled(page);
    expect(await toasts(page).count(), 'no toast').toBe(0);
  });

  test('a 404 on sign-in shows no toast (the form says it)', async () => {
    const fresh = await page.context().browser()!.newPage();
    try {
      await fresh.route(`${API_URL}/auth/login`, (route) =>
        route.request().method() === 'POST' ? route.fulfill(json(404, { code: 'NOT_FOUND', errormessage: 'Nothing here.' })) : route.fallback(),
      );
      await fresh.goto('/auth');
      await fresh.getByLabel('Email', { exact: true }).fill('nobody@example.com');
      await fresh.getByLabel('Password', { exact: true }).fill('not-a-real-password');
      await fresh.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(fresh.getByRole('main').getByRole('alert').filter({ hasText: "Sign-in isn't available right now." })).toBeVisible();
      await settled(fresh);
      expect(await toasts(fresh).count(), 'no toast').toBe(0);
    } finally {
      await fresh.close();
    }
  });
});
