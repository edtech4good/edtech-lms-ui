import { Page, expect, test } from '@playwright/test';
import { loginViaUi } from './fixtures/auth';
import { API_URL } from './fixtures/env';

/**
 * A 502 or 503 is said. The API answers 502 when the student server refused it (edtech-lms-api#150) and 503 when
 * something it needs is down; the body carries the words, a hint and a reference. The error interceptor used to show
 * nothing for either, so "Sync Content" looked dead. Every answer here is a mocked route; the sign-in is real.
 */
const toasts = (page: Page) => page.locator('.ant-notification-notice');
const texts = (page: Page) => page.locator('.ant-notification-notice-description');
const json = (status: number, body: unknown) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

const BAD_GATEWAY = {
  error: true,
  data: false,
  code: 'BAD_GATEWAY',
  errormessage: "The student server refused this server's request.",
  hint: 'This is a setup problem between the two servers, not your sign-in. Contact support with the reference.',
  reference: 'E-7F3K2Q',
};
const UNAVAILABLE = {
  error: true,
  data: false,
  code: 'SERVICE_UNAVAILABLE',
  errormessage: 'The service is temporarily unavailable.',
  hint: 'Try again in a few minutes.',
  reference: 'E-9M4N5P',
};

/** Two animation frames: whatever a failed request was going to put on screen has been put there. */
const settled = (page: Page) =>
  page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));

/** Sync Content on the curriculum list, answered by `answer`. */
async function syncContentAnswering(page: Page, answer: ReturnType<typeof json>): Promise<void> {
  await page.route(`${API_URL}/sync/cloud`, (route) => (route.request().method() === 'POST' ? route.fulfill(answer) : route.fallback()));
  await page.goto('/curriculum/index');
  await page.getByText('Sync Content', { exact: true }).click();
  const synced = page.waitForResponse((r) => r.url() === `${API_URL}/sync/cloud` && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'OK' }).click();
  await synced;
}

test.describe('a 502 or 503 is one message', () => {
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

  test('Sync Content answered 502 with the catalogue body: one toast with the words, the hint and the reference', async () => {
    await syncContentAnswering(page, json(502, BAD_GATEWAY));
    await expect(texts(page)).toHaveText(`${BAD_GATEWAY.errormessage} ${BAD_GATEWAY.hint} Reference: ${BAD_GATEWAY.reference}.`);
    await settled(page);
    expect(await toasts(page).count(), 'one message').toBe(1);
    await expect(page, 'the session is not touched').toHaveURL(/\/curriculum\/index/);
  });

  test('a 503 with the catalogue body is said the same way', async () => {
    await syncContentAnswering(page, json(503, UNAVAILABLE));
    await expect(texts(page)).toHaveText(`${UNAVAILABLE.errormessage} ${UNAVAILABLE.hint} Reference: ${UNAVAILABLE.reference}.`);
    await settled(page);
    expect(await toasts(page).count(), 'one message').toBe(1);
  });

  test('a 502 with no words of its own (a proxy page) says the neutral line, once', async () => {
    await syncContentAnswering(page, { status: 502, contentType: 'text/html', body: '<html><body>Bad gateway</body></html>' });
    await expect(texts(page)).toHaveText('The service is temporarily unavailable. Try again in a few minutes.');
    await settled(page);
    expect(await toasts(page).count(), 'one message').toBe(1);
  });
});
