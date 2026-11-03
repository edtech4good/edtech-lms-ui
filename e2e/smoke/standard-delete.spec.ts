import { Page, expect, test } from '@playwright/test';
import { loginViaUi } from '../fixtures/auth';
import { API_URL } from '../fixtures/env';

/**
 * Deleting a class that still has learners shows the API's sentence, once. The delete request opts out of the error
 * interceptor's notices for 400, 403 and 404 (the interceptor reduces a 400 to "Some of the information isn't valid."), so
 * the class list words each of them. The answers here are mocked routes, in the shape the API sends (edtech-lms-api
 * standard-delete.guard.spec.ts pins the 400's whole body); the sign-in is real. The real API, the class and its learners
 * unchanged, is a manual run.
 */
const CLASS = { standardid: '00000000-0000-4000-8000-0000000000c1', standardname: 'ថ្នាក់ទី៤ក', school: { schoolname: 'សាលាគំរូ' } };
const toasts = (page: Page) => page.locator('.ant-notification-notice');
const texts = (page: Page) => page.locator('.ant-notification-notice-description');
const json = (status: number, body: unknown) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const settled = (page: Page) =>
  page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));

const sentence = (n: number) => `That class has ${n} ${n === 1 ? 'learner' : 'learners'} and can't be deleted. Move or remove them first.`;
const refusal = (n: number) => ({
  error: true,
  code: 'INVALID_INPUT',
  data: false,
  errormessage: "Some of the information isn't valid.",
  fields: [{ field: 'standardid', message: sentence(n) }],
  hint: 'Check the highlighted fields.',
});

/** The class list shows one row; deleting it answers with `answer`. */
async function deleteClassAnswering(page: Page, answer: ReturnType<typeof json>): Promise<void> {
  await page.route(`${API_URL}/standard`, (route) =>
    route.request().method() === 'POST'
      ? route.fulfill(json(200, { error: false, data: { data: [CLASS], total: 1, pageindex: 1, pagesize: 10 } }))
      : route.fallback(),
  );
  await page.route(`${API_URL}/standard/${CLASS.standardid}`, (route) =>
    route.request().method() === 'DELETE' ? route.fulfill(answer) : route.fallback(),
  );
  await page.goto('/standard/index');
  await page.getByRole('row').filter({ hasText: CLASS.standardname }).getByText('Delete').click();
  const deleted = page.waitForResponse((r) => r.url().endsWith(`/standard/${CLASS.standardid}`) && r.request().method() === 'DELETE');
  await page.getByRole('button', { name: 'OK' }).click();
  await deleted;
}

test.describe('deleting a class', () => {
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

  for (const n of [1, 3]) {
    test(`refused for ${n} learner${n === 1 ? '' : 's'}: the toast is the API's sentence, once, and not the generic line`, async () => {
      await deleteClassAnswering(page, json(400, refusal(n)));
      await expect(texts(page)).toHaveText(sentence(n));
      await settled(page);
      expect(await toasts(page).count(), 'one message, not two').toBe(1);
      await expect(texts(page)).toHaveText(sentence(n));
      await expect(page.getByText('Standard deleted sucessfully')).toHaveCount(0);
    });
  }

  test('a 403 says the permission line, once', async () => {
    await deleteClassAnswering(page, json(403, { code: 'FORBIDDEN', errormessage: 'Forbidden.' }));
    await expect(texts(page)).toHaveText("You don't have permission to do that.");
    await settled(page);
    expect(await toasts(page).count(), 'one message, not two').toBe(1);
  });

  test('a 404 says the API\'s words, once', async () => {
    await deleteClassAnswering(page, json(404, { code: 'NOT_FOUND', errormessage: "That standard doesn't exist." }));
    await expect(texts(page)).toHaveText("That standard doesn't exist.");
    await settled(page);
    expect(await toasts(page).count(), 'one message, not two').toBe(1);
  });

  test('a deleted class says it was deleted', async () => {
    await deleteClassAnswering(page, json(200, { error: false, data: true }));
    await expect(texts(page).filter({ hasText: 'Standard deleted sucessfully' })).toHaveCount(1);
  });
});
