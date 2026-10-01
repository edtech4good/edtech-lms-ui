import { expect, test } from '@playwright/test';
import { loginViaUi } from '../fixtures/auth';

/**
 * The sign-in fixture's own behaviour, against a mocked API (so these spend none
 * of the real sign-in budget): what it does when a sign-in goes wrong.
 */
test.describe('loginViaUi', () => {
  const answer = (status: number, headers: Record<string, string> = {}) => ({
    status,
    headers,
    contentType: 'application/json',
    body: JSON.stringify({ errormessage: 'Mocked.' }),
  });

  test('a wrong password fails with what the API answered and what the form says', async ({ page }) => {
    await page.route('**/auth/login', (route) => route.fulfill(answer(400)));
    const error = await loginViaUi(page).then(
      () => null,
      (e: Error) => e,
    );
    expect(error, 'the sign-in should have failed').not.toBeNull();
    expect(error!.message).toContain('the API answered HTTP 400');
    expect(error!.message).toContain('The email or password is incorrect.');
  });

  test('a second 429 waits out one window, then fails saying so', async ({ page }) => {
    let calls = 0;
    await page.route('**/auth/login', (route) => {
      calls++;
      return route.fulfill(answer(429, { 'retry-after': '1' }));
    });
    const error = await loginViaUi(page).then(
      () => null,
      (e: Error) => e,
    );
    expect(error, 'the sign-in should have failed').not.toBeNull();
    expect(error!.message).toContain('the API answered HTTP 429');
    expect(error!.message).toContain('Too many sign-in attempts');
    expect(calls, 'it tried once more after the first 429, and no more').toBe(2);
  });
});
